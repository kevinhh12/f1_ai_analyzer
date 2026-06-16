"""
services/openf1.py

Data layer — all OpenF1 API requests live here.
Routers never call OpenF1 directly; they only call functions in this module.

Caching strategy:
  Static data (races, drivers):  lru_cache — never expires, data never changes
  Live data (laps, positions, tyres, pit stops): TTL cache — expires after N seconds
    - Positions: 10s  (updates every few seconds during live race)
    - Laps:      30s  (new lap every ~90s, 30s gives a reasonable refresh window)
    - Tyres/Pits: 60s (only changes on pit stops)
"""

import time
import httpx
from functools import lru_cache
from typing import Any, Callable

BASE = "https://api.openf1.org/v1"


# ── HTTP ──────────────────────────────────────────────────────────────────────

def _get(endpoint: str, params: dict) -> list:
    response = httpx.get(f"{BASE}/{endpoint}", params=params, timeout=30.0)
    response.raise_for_status()
    return response.json()


# ── TTL cache ─────────────────────────────────────────────────────────────────

_ttl_store: dict[str, tuple[Any, float]] = {}


def _ttl_get(key: str, fetch_fn: Callable, ttl: int) -> Any:
    """
    Return cached value if still fresh, otherwise call fetch_fn, store, and return.
    ttl: seconds before the cached value is considered stale
    """
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

def get_lap_times(session_key: int, driver_number: int = None) -> list:
    """
    Lap timing data. Refreshes every 30s during a live race.
    A new lap completes every ~90s so 30s gives at most one missed lap.
    """
    key = f"laps_{session_key}_{driver_number}"
    params = {"session_key": session_key}
    if driver_number is not None:
        params["driver_number"] = driver_number
    return _ttl_get(key, lambda: _get("laps", params), ttl=30)


def get_total_laps(session_key: int):
    """
    Derive total laps from the highest lap_number in the session.
    Works correctly for finished races.
    For a live race this returns the current lap, not the final total —
    caller should fall back to a known circuit lap count in that case.
    Returns None if no lap data is available yet (session hasn't started).
    """
    key = f"total_laps_{session_key}"
    def fetch():
        laps = _get("laps", {"session_key": session_key})
        if not laps:
            return None
        return max(lap["lap_number"] for lap in laps if lap.get("lap_number"))
    return _ttl_get(key, fetch, ttl=30)


def get_tyre_strategy(session_key: int) -> list:
    """
    Tyre stint data. Refreshes every 60s — only changes on pit stops.
    """
    key = f"tyres_{session_key}"
    return _ttl_get(key, lambda: _get("stints", {"session_key": session_key}), ttl=60)


def get_pit_stops(session_key: int) -> list:
    """
    Pit stop data. Refreshes every 60s — only changes on pit stops.
    """
    key = f"pits_{session_key}"
    return _ttl_get(key, lambda: _get("pit", {"session_key": session_key}), ttl=60)


def get_position(session_key: int, driver_number: int = None) -> list:
    """
    Car position data. Refreshes every 10s — positions change frequently.
    """
    key = f"position_{session_key}_{driver_number}"
    params = {"session_key": session_key}
    if driver_number is not None:
        params["driver_number"] = driver_number
    return _ttl_get(key, lambda: _get("position", params), ttl=10)

