import time
from functools import lru_cache

import fastf1
import fastf1.core
import pandas as pd

# L1: FastF1 disk cache — survives process restarts
fastf1.Cache.enable_cache("cache/")


def _session_to_laps(session: fastf1.core.Session) -> list[dict]:
    """Convert a loaded session's laps DataFrame to a JSON-safe list."""
    laps = session.laps[["Driver", "LapNumber", "LapTime", "Compound", "TyreLife"]].copy()
    laps = laps.dropna(subset=["LapTime"])
    laps["LapTimeSeconds"] = laps["LapTime"].dt.total_seconds()
    laps = laps.drop(columns=["LapTime"])
    laps["Compound"] = laps["Compound"].fillna("UNKNOWN")
    laps["TyreLife"] = laps["TyreLife"].fillna(0).astype(int)
    return laps.rename(columns={
        "Driver": "driver",
        "LapNumber": "lapNumber",
        "LapTimeSeconds": "lapTimeSeconds",
        "Compound": "compound",
        "TyreLife": "tyreAge",
    }).to_dict(orient="records")


# L2: In-memory LRU cache — eliminates repeat fetches within a session
@lru_cache(maxsize=128)
def get_lap_times(season: int, race: str) -> dict:
    """Return per-driver lap timing data for a race."""
    start = time.monotonic()
    try:
        session = fastf1.get_session(season, race, "R")
        session.load(telemetry=False, weather=False, messages=False)
    except Exception as exc:
        return {"error": "Race not found", "detail": str(exc)}

    records = _session_to_laps(session)
    elapsed_ms = round((time.monotonic() - start) * 1000)

    # Group by driver so the frontend can iterate drivers without filtering
    grouped: dict[str, list[dict]] = {}
    for row in records:
        driver = row["driver"]
        grouped.setdefault(driver, []).append({k: v for k, v in row.items() if k != "driver"})

    return {
        "data": grouped,
        "cached": elapsed_ms < 500,
        "response_time_ms": elapsed_ms,
    }


@lru_cache(maxsize=128)
def get_tyre_strategy(season: int, race: str) -> dict:
    """Return compound stint data (start/end lap) for all drivers in a race."""
    start = time.monotonic()
    try:
        session = fastf1.get_session(season, race, "R")
        session.load(telemetry=False, weather=False, messages=False)
    except Exception as exc:
        return {"error": "Race not found", "detail": str(exc)}

    laps = session.laps[["Driver", "LapNumber", "Compound", "Stint"]].copy()
    laps["Compound"] = laps["Compound"].fillna("UNKNOWN")

    stints: list[dict] = []
    for (driver, stint_num), group in laps.groupby(["Driver", "Stint"]):
        stints.append({
            "driver": driver,
            "compound": group["Compound"].iloc[0],
            "startLap": int(group["LapNumber"].min()),
            "endLap": int(group["LapNumber"].max()),
        })

    elapsed_ms = round((time.monotonic() - start) * 1000)
    return {
        "data": stints,
        "cached": elapsed_ms < 500,
        "response_time_ms": elapsed_ms,
    }


@lru_cache(maxsize=128)
def get_pit_stops(season: int, race: str) -> dict:
    """Return pit stop lap numbers and durations (ms) for all drivers in a race."""
    start = time.monotonic()
    try:
        session = fastf1.get_session(season, race, "R")
        session.load(telemetry=False, weather=False, messages=False)
    except Exception as exc:
        return {"error": "Race not found", "detail": str(exc)}

    laps = session.laps[["Driver", "LapNumber", "PitInTime", "PitOutTime"]].copy()
    pit_laps = laps.dropna(subset=["PitInTime", "PitOutTime"]).copy()
    pit_laps["durationMs"] = (
        (pit_laps["PitOutTime"] - pit_laps["PitInTime"]).dt.total_seconds() * 1000
    ).round().astype(int)

    records = pit_laps.rename(columns={
        "Driver": "driver",
        "LapNumber": "lap",
    })[["driver", "lap", "durationMs"]].to_dict(orient="records")

    for r in records:
        r["lap"] = int(r["lap"])

    elapsed_ms = round((time.monotonic() - start) * 1000)
    return {
        "data": records,
        "cached": elapsed_ms < 500,
        "response_time_ms": elapsed_ms,
    }
