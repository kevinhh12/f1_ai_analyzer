"""
routers/f1.py

Route layer — only responsible for receiving requests, calling the data layer, and returning responses.
It does not directly access the OpenF1 API or contain any request logic.

All data comes from services/openf1.py
"""

from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
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
)
from app.services.ai import ask


# ── Chat request / response models ───────────────────────────────────────────

class ChatHistoryMessage(BaseModel):
    role: str    # "user" | "ai"
    content: str

class RaceContext(BaseModel):
    race: dict
    current_lap: int
    standings: List[dict]
    results: List[dict]
    drivers: List[dict]

class ChatRequest(BaseModel):
    message: str
    history: List[ChatHistoryMessage] = []
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── AI Chat ───────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
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
    try:
        result = ask(
            message=req.message,
            history=[m.model_dump() for m in req.history],
            context=req.context.model_dump(),
        )
        return ChatResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
