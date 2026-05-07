"""
routers/f1.py

Route layer — only responsible for receiving requests, calling the data layer, and returning responses.
It does not directly access the OpenF1 API or contain any request logic.

All data comes from services/openf1.py
"""

from fastapi import APIRouter, HTTPException
from app.services.openf1 import (
    get_races,
    get_drivers,
    get_lap_times,
    get_tyre_strategy,
    get_pit_stops,
    get_position,
    get_session_key,
)

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