from app.services.openf1 import get_lap_times, get_tyre_strategy, get_pit_stops



SESSION_KEY = 9158  # Monaco 2023

# ── Sample Test Cases for OpenF1 Service Functions ──────────────────────────────────────

def test_get_lap_times_returns_list():
    result = get_lap_times(SESSION_KEY)
    assert isinstance(result, list)
    assert len(result) > 0

def test_get_tyre_strategy_returns_list():
    result = get_tyre_strategy(SESSION_KEY)
    assert isinstance(result, list)

def test_get_pit_stops_returns_list():
    result = get_pit_stops(SESSION_KEY)
    assert isinstance(result, list)

# ── Test Cases for OpenF1 Service Functions ──────────────────────────────────────