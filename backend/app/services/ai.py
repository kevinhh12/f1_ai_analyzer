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
import logging
import os
import re
import time
from datetime import date
from openai import OpenAI
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

from ddgs import DDGS

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
        # Without a timeout, a hung OpenAI request blocks the request thread
        # indefinitely — /chat is a sync route, so that thread never returns
        # to FastAPI's pool.
        _client = OpenAI(api_key=api_key, timeout=30.0, max_retries=2)
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
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": (
                "Search the web for F1 information not available in the live race data: "
                "driver career stats, historical race results, championship standings, "
                "team news, technical regulations, or any fact you are not certain about. "
                "Prefer this over guessing from training memory for anything from 2024 onwards."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query, e.g. 'Max Verstappen 2025 championship points'",
                    }
                },
                "required": ["query"],
            },
        },
    },
]


# ── Tool execution ────────────────────────────────────────────────────────────

def _execute_tool(name: str, args: dict, session_key: int, current_lap: int) -> str:
    """Run the named tool and return its result as a JSON string."""
    t0 = time.perf_counter()
    try:
        if name == "get_live_standings":
            data = get_intervals(session_key)
            latest: dict[int, dict] = {}
            for entry in data:
                num = entry.get("driver_number")
                if num is not None:
                    latest[num] = entry
            result = json.dumps(list(latest.values()))
            logger.info("[tool] %s → %d drivers (%.0fms)", name, len(latest), (time.perf_counter() - t0) * 1000)
            return result

        if name == "get_lap_time_data":
            driver_number = args.get("driver_number")
            data = get_lap_times(session_key, driver_number)
            filtered = [lap for lap in data if (lap.get("lap_number") or 0) <= current_lap]
            result = json.dumps(filtered)
            logger.info("[tool] %s (driver=%s) → %d laps (%.0fms)", name, driver_number or "all", len(filtered), (time.perf_counter() - t0) * 1000)
            return result

        if name == "get_tyre_stint_data":
            data = get_tyre_strategy(session_key)
            result = json.dumps(data)
            logger.info("[tool] %s → %d stints (%.0fms)", name, len(data), (time.perf_counter() - t0) * 1000)
            return result

        if name == "get_pit_stop_data":
            data = get_pit_stops(session_key)
            result = json.dumps(data)
            logger.info("[tool] %s → %d stops (%.0fms)", name, len(data), (time.perf_counter() - t0) * 1000)
            return result

        if name == "get_race_control_data":
            data = get_race_control(session_key)
            result = json.dumps(data)
            logger.info("[tool] %s → %d messages (%.0fms)", name, len(data), (time.perf_counter() - t0) * 1000)
            return result

        if name == "get_weather_data":
            data = get_weather(session_key)
            result = json.dumps(data)
            logger.info("[tool] %s → %d readings (%.0fms)", name, len(data), (time.perf_counter() - t0) * 1000)
            return result

        if name == "get_driver_info":
            data = get_drivers(session_key)
            result = json.dumps(data)
            logger.info("[tool] %s → %d items (%.0fms)", name, len(data), (time.perf_counter() - t0) * 1000)
            return result

        if name == "web_search":
            query = args.get("query", "")
            raw_results = DDGS(timeout=10).text(query, max_results=5)
            formatted = [
                {"title": r.get("title"), "snippet": r.get("body"), "url": r.get("href")}
                for r in (raw_results or [])
            ]
            result = json.dumps(formatted)
            logger.info("[tool] web_search q=%r → %d results (%.0fms)", query, len(formatted), (time.perf_counter() - t0) * 1000)
            for i, r in enumerate(formatted):
                logger.debug("[tool]   [%d] %s — %s", i, r.get("title"), (r.get("snippet") or "")[:80])
            return result

        logger.warning("[tool] unknown tool requested: %s", name)
        return json.dumps({"error": f"Unknown tool: {name}"})

    except Exception as exc:
        logger.error("[tool] %s failed: %s", name, exc)
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
- For anything outside this race (career stats, historical results, other seasons), use web_search to get up-to-date information.
- When writing search queries, use short factual phrases like "F1 2025 drivers championship standings" — do NOT include today's date or year in the query, let the search engine return the latest results naturally.
- If web_search returns 0 results, try a shorter simpler query once, then answer from training knowledge."""


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
    race_name = context.get("race", {}).get("name", "?")

    logger.info("[ask] session=%d lap=%d race=%r  q=%r", session_key, current_lap, race_name, message[:80])
    t_start = time.perf_counter()

    messages: list[dict] = [{"role": "system", "content": _build_system_prompt(context)}]

    for msg in history:
        role = "user" if msg["role"] == "user" else "assistant"
        messages.append({"role": role, "content": msg["content"]})

    messages.append({"role": "user", "content": message})

    MAX_ROUNDS = 4
    last_choice = None
    for round_num in range(MAX_ROUNDS):
        t_llm = time.perf_counter()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
        )
        logger.info("[ask] round %d — LLM %.0fms  finish=%s  tokens=%s",
            round_num + 1,
            (time.perf_counter() - t_llm) * 1000,
            response.choices[0].finish_reason,
            response.usage.total_tokens if response.usage else "?",
        )

        last_choice = response.choices[0]
        messages.append(last_choice.message)

        if last_choice.finish_reason != "tool_calls":
            break

        for tool_call in last_choice.message.tool_calls:
            fn = tool_call.function.name
            args = json.loads(tool_call.function.arguments or "{}")
            logger.info("[ask]   → calling %s  args=%s", fn, args or "{}")
            result = _execute_tool(fn, args, session_key, current_lap)
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })
    else:
        # Exhausted MAX_ROUNDS still on tool calls — force a plain-text answer
        logger.warning("[ask] hit round limit, forcing final answer")
        t_llm = time.perf_counter()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tool_choice="none",
        )
        logger.info("[ask] forced answer — LLM %.0fms  tokens=%s",
            (time.perf_counter() - t_llm) * 1000,
            response.usage.total_tokens if response.usage else "?",
        )
        last_choice = response.choices[0]

    raw = (last_choice.message.content or "") if last_choice else ""
    logger.info("[ask] raw output: %s", raw[:400])
    parsed = _extract_json(raw)

    logger.info("[ask] done in %.0fms — answer=%r", (time.perf_counter() - t_start) * 1000, parsed.get("answer", "")[:80])

    return {
        "answer": parsed.get("answer", raw),
        "insights": parsed.get("insights", []),
        "highlight": parsed.get("highlight", None),
    }
