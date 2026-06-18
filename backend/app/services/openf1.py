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


# ── HTTP with retry/backoff ───────────────────────────────────────────────────

def _get(endpoint: str, params: dict, retries: int = 4) -> list:
    """GET with exponential backoff on 429 / 5xx."""
    for attempt in range(retries):
        response = httpx.get(f"{BASE}/{endpoint}", params=params, timeout=30.0)
        if response.status_code == 429 or response.status_code >= 500:
            if attempt == retries - 1:
                response.raise_for_status()
            wait = 2 ** attempt  # 1s, 2s, 4s, 8s
            time.sleep(wait)
            continue
        response.raise_for_status()
        return response.json()
    return []  # unreachable, but satisfies type checkers


# ── TTL cache with request coalescing ────────────────────────────────────────

_ttl_store: dict[str, tuple[Any, float]] = {}
_ttl_locks: dict[str, threading.Lock] = {}
_ttl_meta_lock = threading.Lock()


def _get_lock(key: str) -> threading.Lock:
    with _ttl_meta_lock:
        if key not in _ttl_locks:
            _ttl_locks[key] = threading.Lock()
        return _ttl_locks[key]


def _ttl_get(key: str, fetch_fn: Callable, ttl: int) -> Any:
    """
    Return cached value if still fresh, otherwise fetch once (coalescing
    concurrent callers so only one outbound request fires per cache miss).
    """
    now = time.time()
    if key in _ttl_store:
        value, expires_at = _ttl_store[key]
        if now < expires_at:
            return value

    lock = _get_lock(key)
    with lock:
        # Re-check after acquiring lock — another thread may have populated it
        now = time.time()
        if key in _ttl_store:
            value, expires_at = _ttl_store[key]
            if now < expires_at:
                return value

        value = fetch_fn()
        _ttl_store[key] = (value, now + ttl)
        return value


def _ttl_invalidate(key: str) -> None:
    """Force-expire a cache entry so the next call fetches fresh data."""
    _ttl_store.pop(key, None)


# ── Session freshness helper ──────────────────────────────────────────────────

@lru_cache(maxsize=128)
def _session_is_finished(session_key: int) -> bool:
    """
    Return True if the session ended in the past.
    Result is cached permanently — a finished session never becomes live again.
    """
    sessions = _get("sessions", {"session_key": session_key})
    if not sessions:
        return False
    date_end = sessions[0].get("date_end")
    if not date_end:
        return False
    end_dt = datetime.fromisoformat(date_end.replace("Z", "+00:00"))
    return end_dt < datetime.now(timezone.utc)


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

@lru_cache(maxsize=32)
def get_location(session_key: int) -> dict:
    # Unfinished
    """Location info for a session — static, never changes."""
    locations = _get("location", {"session_key": session_key})
    return locations[0] if locations else {}


# ── Live data — TTL cache (stale data = wrong live standings) ─────────────────

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
        laps = _get("laps", {"session_key": session_key})
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

