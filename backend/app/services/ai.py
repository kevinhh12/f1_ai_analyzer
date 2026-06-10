"""
services/ai.py

AI analyst service — builds race context prompts and calls the OpenAI API.
Returns structured responses: { answer, insights, highlight }.
"""

from __future__ import annotations
import json
import os
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

    standings_text = "\n".join(
        f"  P{s['pos']}. {s['code']}  {s['gap']}"
        for s in standings
    ) or "  Not available"

    results_text = "\n".join(
        f"  {r['code']}: best={r['best']}, stops={r['stops']}, tyres={' → '.join(r['tyres'])}"
        for r in results
    ) or "  Not available"

    drivers_text = "\n".join(
        f"  {d['code']} — {d['name']} ({d['team']}) #{d['num']}"
        for d in drivers
    ) or "  Not available"

    return f"""You are an expert F1 race analyst AI embedded in a live race dashboard.
Answer questions about the ongoing race using only the data provided below.
Be direct, specific, and concise. Use F1 terminology naturally.

RACE: {race.get('name', 'Unknown')} {race.get('year', '')} · Round {race.get('round', '?')}
LAP:  {context.get('current_lap', '?')} / {race.get('total_laps', '?')}

LIVE STANDINGS (lap {context.get('current_lap', '?')}):
{standings_text}

DRIVER & TYRE DATA:
{results_text}

DRIVER INFO:
{drivers_text}

Respond with a JSON object in this exact structure:
{{
  "answer": "Main response (1-3 sentences, direct and specific to the data above)",
  "insights": ["supporting point", "another point"],
  "highlight": {{ "label": "stat name", "value": "stat value" }}
}}

Rules:
- "insights": 0 to 3 items. Empty array [] if none genuinely add value.
- "highlight": single most relevant stat (gap, lap time, stop count). null if not applicable.
- Never invent data not present above. If unsure, say so in the answer.
- Keep "answer" under 60 words."""


def ask(message: str, history: list[dict], context: dict) -> dict:
    """
    Send a message to GPT-4o-mini with race context and conversation history.
    Returns { answer: str, insights: list[str], highlight: dict | None }
    """
    client = _get_client()
    system = _build_system_prompt(context)

    messages = [{"role": "system", "content": system}]

    for msg in history:
        role = "user" if msg["role"] == "user" else "assistant"
        messages.append({"role": role, "content": msg["content"]})

    messages.append({"role": "user", "content": message})

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=512,
        messages=messages,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content.strip()

    try:
        parsed = json.loads(raw)
        return {
            "answer": parsed.get("answer", raw),
            "insights": parsed.get("insights", []),
            "highlight": parsed.get("highlight", None),
        }
    except json.JSONDecodeError:
        return {"answer": raw, "insights": [], "highlight": None}
