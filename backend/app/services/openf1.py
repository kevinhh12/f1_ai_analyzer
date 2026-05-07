
"""
services/openf1.py

Data layer — all OpenF1 API requests live here.
Routers never call OpenF1 directly; they only call functions in this module.

Caching strategy:
  Now:   functools.lru_cache (in-process memory cache, sufficient for development)
  Later: swap in Redis by changing only this file; routers stay untouched
"""

import httpx
from functools import lru_cache

BASE = "https://api.openf1.org/v1"


def _get(endpoint: str, params: dict) -> list:
    """
    Single HTTP entry point for all requests.
    Adding Redis caching later only requires changing this function.
    """
    response = httpx.get(f"{BASE}/{endpoint}", params=params, timeout=30.0)
    response.raise_for_status()
    return response.json()


@lru_cache(maxsize=64)
def get_session_key(season: int, circuit: str) -> int:
    """
    Resolves (season, circuit slug) to an OpenF1 session_key.
    All other functions depend on this, so caching is especially important.

    circuit format: lowercase English, e.g. "monaco" / "silverstone" / "suzuka"
    """
    sessions = _get("sessions", {
        "year": season,
        "session_name": "Race",
        "country_name": circuit,
    })

    if not sessions:
        raise ValueError(f"No race data found for {circuit} in the {season} season")

    return sessions[0]["session_key"]


@lru_cache(maxsize=16)
def get_races(season: int) -> list[dict]:
    """
    Returns all race sessions for a given season.
    Route: GET /races?season=2023
    """
    return _get("sessions", {
        "year": season,
        "session_name": "Race",
    })


@lru_cache(maxsize=32)
def get_drivers(session_key: int) -> list[dict]:
    """
    Returns all driver info for a session.
    Route: GET /drivers?session_key=9158
    """
    return _get("drivers", {"session_key": session_key})


@lru_cache(maxsize=32)
def get_lap_times(session_key: int, driver_number: int = None) -> list[dict]:
    """
    Returns lap timing data, optionally filtered by driver number.
    Route: GET /laps?session_key=9158&driver_number=1
    """
    params = {"session_key": session_key}
    if driver_number is not None:
        params["driver_number"] = driver_number
    return _get("laps", params)


@lru_cache(maxsize=32)
def get_tyre_strategy(session_key: int) -> list[dict]:
    """
    Returns tyre stint data for all drivers (pit lap, compound, stint length).
    Route: GET /tyres?session_key=9158
    """
    return _get("stints", {"session_key": session_key})


@lru_cache(maxsize=32)
def get_pit_stops(session_key: int) -> list[dict]:
    """
    Returns all pit stop data (pit lap, stop duration).
    Route: GET /pitstops?session_key=9158
    """
    return _get("pit", {"session_key": session_key})


@lru_cache(maxsize=32)
def get_position(session_key: int, driver_number: int = None) -> list[dict]:
    """
    Returns car position data, optionally filtered by driver number.
    Route: GET /position?session_key=9158&driver_number=1
    """
    params = {"session_key": session_key}
    if driver_number is not None:
        params["driver_number"] = driver_number
    return _get("position", params)