"""
routers/f1.py

Route layer — only responsible for receiving requests, calling the data layer, and returning responses.
It does not directly access the OpenF1 API or contain any request logic.

All data comes from services/openf1.py
"""

from __future__ import annotations
import logging
import threading
import time
import anyio
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from app.services.openf1 import (
    get_races,
    get_drivers,
    get_lap_times,
    get_tyre_strategy,
    get_pit_stops,
    get_position,
    get_session_key,
    get_total_laps,
    get_weather,
    get_location_for_lap,
    get_location_bounds,
    get_intervals,
    get_race_control,
    get_car_data_for_lap,
)
from app.services.ai import ask

logger = logging.getLogger(__name__)


# ── Rate limiting for /chat ───────────────────────────────────────────────────
# /chat fans out to up to 5 LLM calls per request with no per-account auth, so
# request *frequency* — not just payload size — is a direct billing attack.
# A simple sliding-window limiter per client IP keeps this bounded.

CHAT_RATE_LIMIT = 10     # max requests
CHAT_RATE_WINDOW = 60.0  # per this many seconds, per IP
_MAX_TRACKED_IPS = 1000  # hard cap so the bucket dict can't grow unbounded

_chat_rate_buckets: dict[str, list[float]] = defaultdict(list)
_chat_rate_lock = threading.Lock()


def _check_chat_rate_limit(client_ip: str) -> bool:
    """Return True if this IP is still under the request limit for the window."""
    now = time.time()
    cutoff = now - CHAT_RATE_WINDOW
    with _chat_rate_lock:
        bucket = _chat_rate_buckets[client_ip]
        while bucket and bucket[0] < cutoff:
            bucket.pop(0)

        if len(bucket) >= CHAT_RATE_LIMIT:
            return False

        bucket.append(now)

        if len(_chat_rate_buckets) > _MAX_TRACKED_IPS:
            stale = [ip for ip, b in _chat_rate_buckets.items() if not b or b[-1] < cutoff]
            for ip in stale:
                _chat_rate_buckets.pop(ip, None)

        return True


# ── Chat request / response models ───────────────────────────────────────────

class ChatHistoryMessage(BaseModel):
    role: str = Field(pattern="^(user|ai)$")
    content: str = Field(max_length=4000)

class RaceContext(BaseModel):
    session_key: int = Field(ge=1)
    race: dict
    current_lap: int = Field(ge=0)

class ChatRequest(BaseModel):
    # Size limits cap the token cost per request — each /chat call fans out to
    # up to 5 LLM calls, so an unbounded history is a direct billing attack.
    message: str = Field(min_length=1, max_length=2000)
    history: List[ChatHistoryMessage] = Field(default_factory=list, max_length=20)
    context: RaceContext

class HighlightStat(BaseModel):
    label: str
    value: str

class ChatResponse(BaseModel):
    answer: str
    insights: List[str]
    highlight: Optional[HighlightStat] = None

router = APIRouter()



@router.get("/health")
def health():
    """
    Service health check.
    Monitoring tools or load balancers use this endpoint to confirm the service is online.
    """
    return {
        "status": "ok",
        "message": "F1 AI Analyzer API is healthy",
    }


# Shared pool for /race-data fan-out — one app-wide pool instead of a new
# ThreadPoolExecutor per request (which would create unbounded threads under load).
_race_data_pool = ThreadPoolExecutor(max_workers=8)


def _fetch_race_data(session_key: int) -> dict:
    """Fetch all race data for a session in parallel. Blocking — run in a worker thread."""
    tasks = {
        "laps":         lambda: get_lap_times(session_key),
        "stints":       lambda: get_tyre_strategy(session_key),
        "pit_stops":    lambda: get_pit_stops(session_key),
        "positions":    lambda: get_position(session_key),
        "intervals":    lambda: get_intervals(session_key),
        "race_control": lambda: get_race_control(session_key),
        "weather":      lambda: get_weather(session_key),
        "drivers":      lambda: get_drivers(session_key),
    }
    results: dict = {}
    futures = {}
    for name, fn in tasks.items():
        futures[_race_data_pool.submit(fn)] = name
    for future in as_completed(futures):
        name = futures[future]
        try:
            results[name] = future.result()
        except Exception:
            results[name] = None
    return results


@router.get("/race-data")
async def race_data(session_key: int, request: Request):
    """
    Single aggregation endpoint — fetches all race data for one session in parallel
    and returns it as one JSON blob. Replaces 9 separate frontend calls with 1,
    eliminating the thundering-herd of simultaneous OpenF1 requests on race selection.

    The blocking fan-out runs in a worker thread (anyio.to_thread) so the event
    loop is never blocked. The underlying service functions share the same
    semaphore (max 3 concurrent OpenF1 requests) and TTL cache.

    Example: GET /race-data?session_key=9158
    """
    if await request.is_disconnected():
        return {}

    try:
        results = await anyio.to_thread.run_sync(_fetch_race_data, session_key)
    except Exception:
        logger.exception("race-data fetch failed for session_key=%s", session_key)
        raise HTTPException(status_code=500, detail="Internal server error")

    if await request.is_disconnected():
        return {}

    laps = results.get("laps") or []
    total_laps = max((l["lap_number"] for l in laps if l.get("lap_number")), default=None)

    return {
        "session_key":  session_key,
        "total_laps":   total_laps,
        "laps":         laps,
        "stints":       results.get("stints") or [],
        "pit_stops":    results.get("pit_stops") or [],
        "positions":    results.get("positions") or [],
        "intervals":    results.get("intervals") or [],
        "race_control": results.get("race_control") or [],
        "weather":      results.get("weather") or [],
        "drivers":      results.get("drivers") or [],
    }


@router.get("/races")
def list_races(season: int):
    """
    Return the list of all Grand Prix races for a given season.

    Parameters:
        season: Season year, such as 2023

    Example: GET /races?season=2023
    """
    try:
        races = get_races(season)
        return {"season": season, "count": len(races), "races": races}
    except Exception:
        logger.exception("races fetch failed for season=%s", season)
        raise HTTPException(status_code=500, detail="Internal server error")



@router.get("/drivers")
def list_drivers(session_key: int):
    """
    Return all driver information for a specific race session.
    The session_key comes from the /races endpoint response.

    Example: GET /drivers?session_key=9158
    """
    try:
        drivers = get_drivers(session_key)
        return {"session_key": session_key, "count": len(drivers), "drivers": drivers}
    except Exception:
        logger.exception("drivers fetch failed for session_key=%s", session_key)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/laps")
def list_laps(session_key: int, driver_number: int = None):
    """
    Return lap timing data, optionally filtered by driver number.

    Parameters:
        session_key:   Retrieved from /races
        driver_number: Optional driver number, such as 1 = Verstappen

    Examples:
        GET /laps?session_key=9158
        GET /laps?session_key=9158&driver_number=1
    """
    try:
        laps = get_lap_times(session_key, driver_number)
        return {"session_key": session_key, "count": len(laps), "laps": laps}
    except Exception:
        logger.exception("laps fetch failed for session_key=%s", session_key)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/tyres")
def list_tyres(session_key: int):
    """
    Return tyre stint data for all drivers.
    Includes: pit lap, tyre compound (SOFT/MEDIUM/HARD/WET), and stint length.
    Data source for the frontend tyre strategy Gantt chart.

    Example: GET /tyres?session_key=9158
    """
    try:
        stints = get_tyre_strategy(session_key)
        return {"session_key": session_key, "count": len(stints), "stints": stints}
    except Exception:
        logger.exception("tyres fetch failed for session_key=%s", session_key)
        raise HTTPException(status_code=500, detail="Internal server error")


# ── Pit Stop Data ─────────────────────────────────────────────────────────────

@router.get("/pitstops")
def list_pitstops(session_key: int):
    """
    Return all pit stop data.
    Includes: pit stop lap and stop duration in seconds.
    Data source for the frontend Pit Stop analysis chart.

    Example: GET /pitstops?session_key=9158
    """
    try:
        pits = get_pit_stops(session_key)
        return {"session_key": session_key, "count": len(pits), "pit_stops": pits}
    except Exception:
        logger.exception("pitstops fetch failed for session_key=%s", session_key)
        raise HTTPException(status_code=500, detail="Internal server error")


# ── Position Data ─────────────────────────────────────────────────────────────

@router.get("/position")
def list_position(session_key: int, driver_number: int = None):
    """
    Return car position data, optionally filtered by driver number.

    Examples:
        GET /position?session_key=9158
        GET /position?session_key=9158&driver_number=1
    """
    try:
        positions = get_position(session_key, driver_number)
        return {"session_key": session_key, "count": len(positions), "positions": positions}
    except Exception:
        logger.exception("position fetch failed for session_key=%s", session_key)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/session")
def get_session(season: int, circuit: str):
    """
    Query the session_key using season + circuit abbreviation, so the frontend does not need to call /races first.

    Parameters:
        season:  Season year, such as 2023
        circuit: Circuit abbreviation in lowercase, such as monaco / silverstone / suzuka

    Example: GET /session?season=2023&circuit=monaco
    """
    try:
        key = get_session_key(season, circuit)
        return {"season": season, "circuit": circuit, "session_key": key}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        logger.exception("session lookup failed for season=%s circuit=%s", season, circuit)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/total-laps")
def total_laps(session_key: int):
    """
    Return the total lap count for a session derived from actual lap data.
    For finished races this is the exact race distance.
    For live races this is the current lap — use LAPS_BY_CIRCUIT as a fallback.

    Example: GET /total-laps?session_key=9158
    """
    try:
        laps = get_total_laps(session_key)
        return {"session_key": session_key, "total_laps": laps}
    except Exception:
        logger.exception("total-laps fetch failed for session_key=%s", session_key)
        raise HTTPException(status_code=500, detail="Internal server error")


# ── AI Chat ───────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, request: Request):
    """
    Send a user message with race context to Claude and get a structured analysis response.

    Body:
        message:  The user's question
        history:  Previous messages in the conversation (role + content)
        context:  Live race data snapshot (standings, results, drivers, current lap)

    Returns:
        answer:    Main response text
        insights:  Supporting bullet points (0-3 items)
        highlight: Key stat callout e.g. { label: "Gap", value: "+4.3s" }

    Example: POST /chat
    """
    client_ip = "unknown"
    if request.client:
        client_ip = request.client.host
    if not _check_chat_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests — please wait a moment before trying again.")

    try:
        result = ask(
            message=req.message,
            history=[m.model_dump() for m in req.history],
            context=req.context.model_dump(),
        )
        return ChatResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception:
        logger.exception("chat request failed")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/weather")
def weather(session_key: int):
    """
    Return all weather readings for a session.
    Each entry has a date field for correlating with lap timestamps.

    Example: GET /weather?session_key=9158
    """
    try:
        entries = get_weather(session_key)
        readings = [
            {
                "date":              e.get("date"),
                "air_temperature":   e.get("air_temperature"),
                "track_temperature": e.get("track_temperature"),
                "humidity":          e.get("humidity"),
                "wind_speed":        e.get("wind_speed"),
                "rainfall":          e.get("rainfall"),
            }
            for e in entries
        ]
        return {"session_key": session_key, "readings": readings}
    except Exception:
        logger.exception("weather fetch failed for session_key=%s", session_key)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/location")
def location(session_key: int, lap: int):
    """
    Location samples for all drivers during a single lap.
    Returns per-driver arrays of {date, x, y} plus the lap's time window.
    Designed for smooth playback: fetch lap N+1 while N is playing.

    Example: GET /location?session_key=9158&lap=1
    """
    try:
        data = get_location_for_lap(session_key, lap)
        return {"session_key": session_key, "lap": lap, **data}
    except Exception:
        logger.exception("location fetch failed for session_key=%s lap=%s", session_key, lap)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/intervals")
def intervals(session_key: int):
    """
    All interval readings for a session, ordered by time.
    Each entry has date, driver_number, gap_to_leader (s), interval (s).

    Example: GET /intervals?session_key=9158
    """
    try:
        data = get_intervals(session_key)
        return {"session_key": session_key, "count": len(data), "intervals": data}
    except Exception:
        logger.exception("intervals fetch failed for session_key=%s", session_key)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/location-bounds")
def location_bounds(session_key: int):
    """
    Min/max X and Y coordinates for the session circuit.
    Fetch once per session to build the SVG normalization constants.

    Example: GET /location-bounds?session_key=9158
    """
    try:
        bounds = get_location_bounds(session_key)
        if not bounds:
            raise HTTPException(status_code=404, detail="No location data available")
        return {"session_key": session_key, **bounds}
    except HTTPException:
        raise
    except Exception:
        logger.exception("location-bounds fetch failed for session_key=%s", session_key)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/race-controls")
def race_controls(session_key: int):
    """
    Return all safety car and virtual safety car intervals for a session.
    Each entry has start_lap, end_lap, and type (SC or VSC).

    Example: GET /race-controls?session_key=9158
    """
    try:
        controls = get_race_control(session_key)
        return {"session_key": session_key, "count": len(controls), "controls": controls}

    except Exception:
        logger.exception("race-controls fetch failed for session_key=%s", session_key)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/car-data")
def car_data(session_key: int, driver_number: int, lap: int):
    """
    Car telemetry for one driver during one lap.
    Returns speed, rpm, gear, throttle, brake, drs samples.

    Example: GET /car-data?session_key=9158&driver_number=1&lap=5
    """
    try:
        data = get_car_data_for_lap(session_key, driver_number, lap)
        return {"session_key": session_key, "driver_number": driver_number, "lap": lap, **data}
    except Exception:
        logger.exception("car-data fetch failed for session_key=%s driver_number=%s lap=%s", session_key, driver_number, lap)
        raise HTTPException(status_code=500, detail="Internal server error")