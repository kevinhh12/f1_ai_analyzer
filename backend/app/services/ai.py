"""
services/ai.py

AI analyst service — uses OpenAI function calling so the model fetches only
the data it needs rather than receiving a full race dump upfront.

Flow:
  1. Send user message + minimal race metadata (no data blobs)
  2. Model decides which tool(s) to call
  3. We execute each call against the existing service functions
  4. Results are fed back; model produces a final structured answer
"""

from __future__ import annotations
import json
import os
import re
from datetime import date
from openai import OpenAI
from dotenv import load_dotenv

from app.services.openf1 import (
    get_lap_times,
    get_tyre_strategy,
    get_pit_stops,
    get_race_control,
    get_weather,
    get_intervals,
    get_drivers,
)

load_dotenv()

_client = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set in .env")
        _client = OpenAI(api_key=api_key)
    return _client


# ── Tool definitions (OpenAI function calling schema) ────────────────────────

TOOLS = [
    
    {
        "type": "function",
        "function": {
            "name": "get_live_standings",
            "description": (
                "Get real-time race gaps and intervals between drivers. "
                "Use this for questions about who is leading, gaps between cars, "
                "interval to the car ahead, or current race order."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_lap_time_data",
            "description": (
                "Get lap-by-lap timing data. Use for questions about fastest laps, "
                "lap time trends, pace comparisons between drivers, or sector times."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "driver_number": {
                        "type": "integer",
                        "description": "Specific driver number to filter (e.g. 1 for Verstappen). Omit to get all drivers.",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_tyre_stint_data",
            "description": (
                "Get tyre compound and stint information for all drivers. "
                "Use for questions about tyre strategy, what compound each driver is on, "
                "how many stints remain, or undercut/overcut potential."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pit_stop_data",
            "description": (
                "Get pit stop history including lap number and stop duration. "
                "Use for questions about pit stop counts, undercuts, stop timing, "
                "or comparing pit stop times between drivers."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_race_control_data",
            "description": (
                "Get safety car, virtual safety car, red flag, and other race director messages. "
                "Use for questions about incidents, neutralisation periods, penalties, or flags shown."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather_data",
            "description": (
                "Get weather readings: air temperature, track temperature, humidity, wind speed, rainfall. "
                "Use for questions about track conditions, rain probability, or how weather affects tyre strategy."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_driver_info",
            "description": (
                "Get driver details: name, team, car number, and team colour for all drivers in the session. "
                "Use when you need to look up who drives for which team or identify a driver by number."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]


# ── Tool execution ────────────────────────────────────────────────────────────

def _execute_tool(name: str, args: dict, session_key: int, current_lap: int) -> str:
    """Run the named tool and return its result as a JSON string."""
    try:
        if name == "get_live_standings":
            data = get_intervals(session_key)
            # Return only the latest interval entry per driver
            latest: dict[int, dict] = {}
            for entry in data:
                num = entry.get("driver_number")
                if num is not None:
                    latest[num] = entry
            return json.dumps(list(latest.values()))

        if name == "get_lap_time_data":
            driver_number = args.get("driver_number")
            data = get_lap_times(session_key, driver_number)
            filtered = [lap for lap in data if (lap.get("lap_number") or 0) <= current_lap]
            return json.dumps(filtered)

        if name == "get_tyre_stint_data":
            data = get_tyre_strategy(session_key)
            return json.dumps(data)

        if name == "get_pit_stop_data":
            data = get_pit_stops(session_key)
            return json.dumps(data)

        if name == "get_race_control_data":
            data = get_race_control(session_key)
            return json.dumps(data)

        if name == "get_weather_data":
            data = get_weather(session_key)
            return json.dumps(data)

        if name == "get_driver_info":
            data = get_drivers(session_key)
            return json.dumps(data)

        return json.dumps({"error": f"Unknown tool: {name}"})

    except Exception as exc:
        return json.dumps({"error": str(exc)})


# ── Prompt ────────────────────────────────────────────────────────────────────

def _build_system_prompt(context: dict) -> str:
    race = context.get("race", {})
    today = date.today().strftime("%B %d, %Y")

    return f"""You are an expert F1 race analyst AI embedded in a live race dashboard.
Today's date is {today}.

CURRENT RACE: {race.get('name', 'Unknown')} {race.get('year', '')} · Round {race.get('round', '?')}
CURRENT LAP:  {context.get('current_lap', '?')} / {race.get('total_laps', '?')}

You have access to tools that fetch live race data. Call only the tools you need to answer the question.

After fetching data, respond with ONLY a valid JSON object (no markdown, no extra text):
{{
  "answer": "Main response (1-3 sentences, direct and specific)",
  "insights": ["supporting point", "another point"],
  "highlight": {{ "label": "stat name", "value": "stat value" }}
}}

Rules:
- "insights": 0 to 3 items. Empty array [] if none add value.
- "highlight": single most relevant stat or fact. null if not applicable.
- Keep "answer" under 80 words.
- For anything outside this race (career stats, historical results, other seasons), answer from your training knowledge without calling tools."""


# ── JSON extraction ───────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict:
    """Parse JSON from model output, with regex fallback for wrapped responses."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {"answer": text, "insights": [], "highlight": None}


# ── Main entry point ──────────────────────────────────────────────────────────

def ask(message: str, history: list[dict], context: dict) -> dict:
    """
    Send a message to GPT-4o-mini with function calling enabled.
    The model fetches only the data it needs via tools.
    Returns { answer: str, insights: list[str], highlight: dict | None }
    """
    client = _get_client()
    session_key: int = context.get("session_key", 0)
    current_lap: int = context.get("current_lap", 0)

    messages: list[dict] = [{"role": "system", "content": _build_system_prompt(context)}]

    for msg in history:
        role = "user" if msg["role"] == "user" else "assistant"
        messages.append({"role": role, "content": msg["content"]})

    messages.append({"role": "user", "content": message})

    # Tool-call loop — model may chain multiple tool calls before giving a final answer
    MAX_ROUNDS = 5
    last_choice = None
    for _ in range(MAX_ROUNDS):
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
        )

        last_choice = response.choices[0]
        messages.append(last_choice.message)

        if last_choice.finish_reason != "tool_calls":
            break

        # Execute every tool the model requested in this round
        for tool_call in last_choice.message.tool_calls:
            args = json.loads(tool_call.function.arguments or "{}")
            result = _execute_tool(tool_call.function.name, args, session_key, current_lap)
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })

    raw = (last_choice.message.content or "") if last_choice else ""
    parsed = _extract_json(raw)

    return {
        "answer": parsed.get("answer", raw),
        "insights": parsed.get("insights", []),
        "highlight": parsed.get("highlight", None),
    }
