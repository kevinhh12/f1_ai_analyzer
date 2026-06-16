"""
services/ai.py

AI analyst service — builds race context prompts and calls the OpenAI API.
Uses the Responses API with web_search_preview so the model can look up
accurate real-time F1 results, standings, and driver history.
Returns structured responses: { answer, insights, highlight }.
"""

from __future__ import annotations
import json
import os
import re
from datetime import date
from openai import OpenAI
from dotenv import load_dotenv

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


def _build_system_prompt(context: dict) -> str:
    race = context.get("race", {})
    standings = context.get("standings", [])
    results = context.get("results", [])
    drivers = context.get("drivers", [])

    today = date.today().strftime("%B %d, %Y")

    standings_text = "\n".join(
        f"  P{s['pos']}. {s['code']}  {s['gap']}"
        for s in standings
    ) or "  Not available"

    results_text = "\n".join(
        f"  {r['code']}: best={r['best']}, stops={r['stops']}, tyres={' -> '.join(r['tyres'])}"
        for r in results
    ) or "  Not available"

    drivers_text = "\n".join(
        f"  {d['code']} — {d['name']} ({d['team']}) #{d['num']}"
        for d in drivers
    ) or "  Not available"

    return f"""You are an expert F1 race analyst AI embedded in a live race dashboard.
Today's date is {today}.

You have two knowledge sources — always use the most accurate one:

1. LIVE RACE DATA (below) — use for questions about the current race: gaps, lap times, tyre strategy, pit stops, live standings.
2. WEB SEARCH — you can search the web for anything outside the current race: driver career stats, 2025 season results, championship standings, historical races, team news, regulations. Always search when asked about specific results, standings, or recent events you are not certain about. Prefer searched results over training knowledge for anything from 2024 onwards.

CURRENT RACE CONTEXT
Race: {race.get('name', 'Unknown')} {race.get('year', '')} · Round {race.get('round', '?')}
Lap:  {context.get('current_lap', '?')} / {race.get('total_laps', '?')}

LIVE STANDINGS (lap {context.get('current_lap', '?')}):
{standings_text}

DRIVER & TYRE DATA:
{results_text}

DRIVER INFO:
{drivers_text}

Always respond with ONLY a valid JSON object in this exact structure (no markdown, no extra text):
{{
  "answer": "Main response (1-3 sentences, direct and specific)",
  "insights": ["supporting point", "another point"],
  "highlight": {{ "label": "stat name", "value": "stat value" }}
}}

Rules:
- "insights": 0 to 3 items. Empty array [] if none add value.
- "highlight": single most relevant stat or fact. null if not applicable.
- Keep "answer" under 80 words.
- If you searched the web, base your answer on those results, not on training memory."""


def _extract_json(text: str) -> dict:
    """Parse JSON from model output, with regex fallback for wrapped responses."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try to find a JSON object inside the text
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    # Last resort: return raw text as answer
    return {"answer": text, "insights": [], "highlight": None}


def ask(message: str, history: list[dict], context: dict) -> dict:
    """
    Send a message to GPT-4o with web search enabled.
    Returns { answer: str, insights: list[str], highlight: dict | None }
    """
    client = _get_client()
    system = _build_system_prompt(context)

    input_messages = [{"role": "system", "content": system}]
    for msg in history:
        role = "user" if msg["role"] == "user" else "assistant"
        input_messages.append({"role": role, "content": msg["content"]})
    input_messages.append({"role": "user", "content": message})

    response = client.responses.create(
        model="gpt-4o",
        tools=[{"type": "web_search_preview"}],
        input=input_messages,
    )

    raw = response.output_text.strip()
    parsed = _extract_json(raw)

    return {
        "answer": parsed.get("answer", raw),
        "insights": parsed.get("insights", []),
        "highlight": parsed.get("highlight", None),
    }
