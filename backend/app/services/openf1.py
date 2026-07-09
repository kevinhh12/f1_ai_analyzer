"""
services/openf1.py

Data layer — all OpenF1 API requests live here.
Routers never call OpenF1 directly; they only call functions in this module.

Caching strategy:
  Static data (races, drivers):  lru_cache — never expires, data never changes
  Finished-race live data:       TTL of 1 hour — OpenF1 never updates past races
  Live data (laps, positions, tyres, pit stops): short TTL — expires after N seconds
    - Positions: 10s  (updates every few seconds during live race)
    - Laps:      30s  (new lap every ~90s, 30s gives a reasonable refresh window)
    - Tyres/Pits: 60s (only changes on pit stops)
"""

import random
import time
import threading
import httpx
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Callable

BASE = "https://api.openf1.org/v1"

TTL_LIVE_POSITION = 10
TTL_LIVE_LAPS     = 30
TTL_LIVE_PITS     = 60
TTL_FINISHED      = 7200 # past races never change

# At most 3 outbound OpenF1 requests at a time — bounds in-flight connections.
_openf1_semaphore = threading.Semaphore(3)

# Rate limiter: OpenF1's free tier limits by requests-per-second, not concurrency.
# A semaphore alone can't prevent 429s — 3 slots turning over every 200ms is
# 15 req/s. This token-bucket spaces outbound requests >= MIN_INTERVAL apart
# globally, keeping the rate at ~3 req/s no matter how many callers queue up.
MIN_INTERVAL = 0.35  # seconds between outbound requests (~3 req/s)

_rate_lock = threading.Lock()
_next_slot = 0.0


def _acquire_rate_slot() -> None:
    """Block until this thread's turn to fire an outbound request."""
    global _next_slot
    with _rate_lock:
        now = time.monotonic()
        slot = max(now, _next_slot)
        _next_slot = slot + MIN_INTERVAL
    wait = slot - now
    if wait > 0:
        time.sleep(wait)


# ── HTTP with retry/backoff ───────────────────────────────────────────────────

def _get(endpoint: str, params: dict, retries: int = 3) -> list:
    """Rate-limited GET with exponential backoff on 429 / 5xx.

    Every attempt waits for a rate slot (~3 req/s globally) before firing.
    On 429, the Retry-After header is honoured when present — OpenF1 tells us
    exactly how long the limit window lasts, so guessing with backoff alone
    tends to retry inside the same window and burn the attempt.

    Worst case is bounded (~35s) because the caller (_ttl_get) holds a per-key
    lock for the duration — an unbounded fetch would pin FastAPI threadpool
    threads and exhaust the pool under load.
    """
    for attempt in range(retries):
        _acquire_rate_slot()
        with _openf1_semaphore:
            response = httpx.get(f"{BASE}/{endpoint}", params=params, timeout=10.0)

        if response.status_code == 429 or response.status_code >= 500:
            if attempt == retries - 1:
                response.raise_for_status()

            retry_after = response.headers.get("Retry-After")
            wait = 0.0
            if retry_after is not None:
                try:
                    wait = float(retry_after) + random.uniform(0, 0.5)
                except ValueError:
                    wait = 0.0
            if wait <= 0:
                wait = (2 ** attempt) + random.uniform(0, 1)  # 1–2s, 2–3s

            time.sleep(wait)
            continue

        response.raise_for_status()
        return response.json()
    return []  # unreachable, but satisfies type checkers


# ── TTL cache with request coalescing ────────────────────────────────────────

NEGATIVE_TTL = 60   # failed fetches are cached briefly — repeated garbage
                    # session_keys can't bypass the cache and hammer OpenF1
MAX_STORE    = 512  # hard cap on cached entries — laps/intervals blobs are MBs
                    # each, an unbounded store is an OOM waiting to happen

_ttl_store: dict[str, tuple[Any, float]] = {}
_ttl_locks: dict[str, threading.Lock] = {}
_ttl_meta_lock = threading.Lock()


class _FetchFailure:
    """Sentinel stored in place of a value when the upstream fetch raised."""
    def __init__(self, message: str):
        self.message = message


def _store_put(key: str, value: Any, expires_at: float) -> None:
    """Insert into the store, evicting expired then oldest entries past MAX_STORE.

    Different keys are protected by different per-key locks (see _get_lock),
    so without a lock around the shared dict here, concurrent inserts for
    different keys could mutate _ttl_store while another thread's eviction
    loop is iterating it (RuntimeError: dictionary changed size during
    iteration). _ttl_meta_lock serializes all writes to the store itself.
    """
    with _ttl_meta_lock:
        if len(_ttl_store) >= MAX_STORE:
            now = time.time()
            expired = [k for k, (_, exp) in _ttl_store.items() if exp < now]
            for k in expired:
                _ttl_store.pop(k, None)
            while len(_ttl_store) >= MAX_STORE:
                oldest = min(_ttl_store, key=lambda k: _ttl_store[k][1])
                _ttl_store.pop(oldest, None)
        _ttl_store[key] = (value, expires_at)


def _get_lock(key: str) -> threading.Lock:
    with _ttl_meta_lock:
        if key not in _ttl_locks:
            _ttl_locks[key] = threading.Lock()
            # Prune expired keys to prevent unbounded lock accumulation
            if len(_ttl_locks) > 500:
                now = time.time()
                stale = [k for k in _ttl_locks if k not in _ttl_store or _ttl_store[k][1] < now]
                for k in stale:
                    _ttl_locks.pop(k, None)
        return _ttl_locks[key]


def _ttl_get(key: str, fetch_fn: Callable, ttl: int) -> Any:
    """
    Return cached value if still fresh, otherwise fetch once (coalescing
    concurrent callers so only one outbound request fires per cache miss).
    Failed fetches are negatively cached for NEGATIVE_TTL seconds and re-raised.
    """
    now = time.time()
    if key in _ttl_store:
        value, expires_at = _ttl_store[key]
        if now < expires_at:
            if isinstance(value, _FetchFailure):
                raise RuntimeError(f"upstream fetch failed recently: {value.message}")
            return value

    lock = _get_lock(key)
    with lock:
        # Re-check after acquiring lock — another thread may have populated it
        now = time.time()
        if key in _ttl_store:
            value, expires_at = _ttl_store[key]
            if now < expires_at:
                if isinstance(value, _FetchFailure):
                    raise RuntimeError(f"upstream fetch failed recently: {value.message}")
                return value

        try:
            value = fetch_fn()
        except Exception as exc:
            _store_put(key, _FetchFailure(str(exc)), now + NEGATIVE_TTL)
            raise

        _store_put(key, value, now + ttl)
        return value


# ── Session freshness helper ──────────────────────────────────────────────────

def _session_is_finished(session_key: int) -> bool:
    """
    Return True if the session ended in the past.
    Finished sessions are cached permanently; live sessions re-check every 5 minutes
    so the TTL can flip from short (live) to long (finished) during a session.
    """
    def fetch() -> bool:
        sessions = _get("sessions", {"session_key": session_key})
        if not sessions:
            return False
        date_end = sessions[0].get("date_end")
        if not date_end:
            return False
        end_dt = datetime.fromisoformat(date_end.replace("Z", "+00:00"))
        return end_dt < datetime.now(timezone.utc)

    key = f"_finished_{session_key}"
    # Once confirmed finished, cache forever; otherwise re-check every 5 min.
    # `is True` guards against the _FetchFailure sentinel (truthy) being
    # mistaken for a finished session.
    if _ttl_store.get(key, (False, 0))[0] is True:
        return _ttl_get(key, fetch, ttl=TTL_FINISHED)
    return _ttl_get(key, fetch, ttl=300)


def _ttl_for(session_key: int, live_ttl: int) -> int:
    """Pick a long TTL for finished sessions, short TTL for live ones."""
    return TTL_FINISHED if _session_is_finished(session_key) else live_ttl


# ── Static data — lru_cache (never changes once a session is over) ────────────

@lru_cache(maxsize=16)
def get_races(season: int) -> list:
    """All race sessions for a given season."""
    return _get("sessions", {
        "year": season,
        "session_name": "Race",
    })


@lru_cache(maxsize=64)
def get_session_key(season: int, circuit: str) -> int:
    """Resolve (season, circuit slug) → OpenF1 session_key."""
    sessions = _get("sessions", {
        "year": season,
        "session_name": "Race",
        "country_name": circuit,
    })
    if not sessions:
        raise ValueError(f"No race found for {circuit} {season}")
    return sessions[0]["session_key"]


@lru_cache(maxsize=32)
def get_drivers(session_key: int) -> list:
    """Driver info for a session — static, never changes."""
    return _get("drivers", {"session_key": session_key})

# ── Live data — TTL cache (stale data = wrong live standings) ─────────────────

def get_location_for_lap(session_key: int, lap: int) -> dict:
    """
    All location samples for a single lap, grouped by driver_number.
    Uses lap boundary timestamps derived from the lap data to slice the
    location stream — keeps each response small (~400 rows) instead of
    returning the full ~1M-row session dataset.

    Returns:
        {
          "from": <ISO timestamp>,
          "to":   <ISO timestamp>,
          "drivers": {
            "<driver_number>": [{"date": ..., "x": ..., "y": ...}, ...]
          }
        }
    """
    cache_key = f"location_lap_{session_key}_{lap}"
    ttl = _ttl_for(session_key, TTL_LIVE_LAPS)

    def fetch():
        laps = get_lap_times(session_key)

        # Collect all rows for the requested lap number
        lap_rows = []
        for row in laps:
            if row.get("lap_number") == lap:
                lap_rows.append(row)

        if not lap_rows:
            return {"from": None, "to": None, "drivers": {}}

        # Earliest date_start across all drivers = lap start
        starts = []
        for row in lap_rows:
            if row.get("date_start"):
                starts.append(row["date_start"])

        if not starts:
            return {"from": None, "to": None, "drivers": {}}

        t_from = min(starts)

        # Earliest date_start of the next lap = current lap end
        next_lap_starts = []
        for row in laps:
            if row.get("lap_number") == lap + 1 and row.get("date_start"):
                next_lap_starts.append(row["date_start"])

        t_to = min(next_lap_starts) if next_lap_starts else None

        # Query OpenF1 location endpoint with the time window
        params: dict = {
            "session_key": session_key,
            "date>": t_from,
        }
        if t_to:
            params["date<"] = t_to

        samples = _get("location", params)

        # Group samples by driver number
        grouped: dict[str, list] = {}
        for s in samples:
            num = str(s.get("driver_number", ""))
            if not num:
                continue
            if num not in grouped:
                grouped[num] = []
            grouped[num].append({
                "date": s.get("date"),
                "x":    s.get("x"),
                "y":    s.get("y"),
            })

        return {"from": t_from, "to": t_to, "drivers": grouped}

    return _ttl_get(cache_key, fetch, ttl=ttl)


def get_location_bounds(session_key: int) -> dict:
    """
    Min/max X and Y across the entire session — used by the frontend to
    normalize driver coordinates into a fixed SVG viewBox.
    Derived from lap 1 location data (covers the full circuit outline).
    Cached permanently for finished sessions.
    """
    cache_key = f"location_bounds_{session_key}"
    ttl = _ttl_for(session_key, TTL_LIVE_LAPS)

    def fetch():
        # Lap 1 traces the full circuit — enough to establish coordinate bounds
        lap1 = get_location_for_lap(session_key, 1)

        xs = []
        ys = []
        for driver_samples in lap1["drivers"].values():
            for s in driver_samples:
                if s.get("x") is not None:
                    xs.append(s["x"])
                if s.get("y") is not None:
                    ys.append(s["y"])

        if not xs:
            return {}
        return {"x_min": min(xs), "x_max": max(xs), "y_min": min(ys), "y_max": max(ys)}

    return _ttl_get(cache_key, fetch, ttl=ttl)


def get_weather(session_key: int) -> list:
    """All weather readings for a session, ordered by time."""
    key = f"weather_{session_key}"
    return _ttl_get(key, lambda: _get("weather", {"session_key": session_key}), ttl=_ttl_for(session_key, TTL_LIVE_LAPS))

def get_lap_times(session_key: int, driver_number: int = None) -> list:
    key = f"laps_{session_key}_{driver_number}"
    params = {"session_key": session_key}
    if driver_number is not None:
        params["driver_number"] = driver_number
    return _ttl_get(key, lambda: _get("laps", params), ttl=_ttl_for(session_key, TTL_LIVE_LAPS))


def get_total_laps(session_key: int):
    """
    Derive total laps from the highest lap_number in the session.
    Returns None if no lap data is available yet.
    """
    key = f"total_laps_{session_key}"
    def fetch():
        laps = get_lap_times(session_key)
        if not laps:
            return None
        return max(lap["lap_number"] for lap in laps if lap.get("lap_number"))
    return _ttl_get(key, fetch, ttl=_ttl_for(session_key, TTL_LIVE_LAPS))


def get_tyre_strategy(session_key: int) -> list:
    key = f"tyres_{session_key}"
    return _ttl_get(key, lambda: _get("stints", {"session_key": session_key}), ttl=_ttl_for(session_key, TTL_LIVE_PITS))


def get_pit_stops(session_key: int) -> list:
    key = f"pits_{session_key}"
    return _ttl_get(key, lambda: _get("pit", {"session_key": session_key}), ttl=_ttl_for(session_key, TTL_LIVE_PITS))


def get_position(session_key: int, driver_number: int = None) -> list:
    key = f"position_{session_key}_{driver_number}"
    params = {"session_key": session_key}
    if driver_number is not None:
        params["driver_number"] = driver_number
    return _ttl_get(key, lambda: _get("position", params), ttl=_ttl_for(session_key, TTL_LIVE_POSITION))


def get_intervals(session_key: int) -> list:
    """All interval readings for a session.

    Each entry contains gap_to_leader and interval (gap to car ahead) in seconds,
    with a timestamp so the frontend can find the closest reading at any race time.
    """
    key = f"intervals_{session_key}"
    return _ttl_get(key, lambda: _get("intervals", {"session_key": session_key}), ttl=_ttl_for(session_key, TTL_LIVE_POSITION))

def get_race_control(session_key: int) -> list:
    """All race control messages for a session, ordered by time."""
    key = f"race_control_{session_key}"
    return _ttl_get(key, lambda: _get("race_control", {"session_key": session_key}), ttl=_ttl_for(session_key, TTL_LIVE_POSITION))


def get_car_data_for_lap(session_key: int, driver_number: int, lap: int) -> dict:
    """Car telemetry for a single driver during one lap (speed, rpm, gear, throttle, brake, drs)."""
    cache_key = f"car_data_{session_key}_{driver_number}_{lap}"
    ttl = _ttl_for(session_key, TTL_LIVE_LAPS)

    def fetch():
        laps = get_lap_times(session_key)

        lap_rows = [r for r in laps if r.get("lap_number") == lap]
        if not lap_rows:
            return {"from": None, "to": None, "samples": []}

        starts = [r["date_start"] for r in lap_rows if r.get("date_start")]
        if not starts:
            return {"from": None, "to": None, "samples": []}

        t_from = min(starts)
        next_starts = [r["date_start"] for r in laps if r.get("lap_number") == lap + 1 and r.get("date_start")]
        t_to = min(next_starts) if next_starts else None

        params: dict = {
            "session_key": session_key,
            "driver_number": driver_number,
            "date>": t_from,
        }
        if t_to:
            params["date<"] = t_to

        raw = _get("car_data", params)
        samples = [
            {
                "date": s.get("date"),
                "speed": s.get("speed", 0),
                "rpm": s.get("rpm", 0),
                "gear": s.get("n_gear", 0),
                "throttle": s.get("throttle", 0),
                "brake": s.get("brake", 0),
                "drs": s.get("drs", 0),
            }
            for s in raw
        ]
        return {"from": t_from, "to": t_to, "samples": samples}

    return _ttl_get(cache_key, fetch, ttl=ttl)

