"""The ONE allowed LLM call: a human-readable 'why this route' narrative for the UI.

This NEVER affects the decision (it runs after routing is final) and NEVER throws. With no
GEMINI_API_KEY it returns a templated string built from the routing JSON.
"""
from __future__ import annotations

# Reuse the grading service's Gemini config (model name + key loader).
from backend import config as gemini_config

try:
    from google import genai
    from google.genai import types
except Exception:  # pragma: no cover
    genai = None
    types = None

_SYSTEM = (
    "You are an operations analyst for Amazon Relay, a reverse-logistics system. Given a routing "
    "decision as JSON, write 2-3 short, plain-English sentences explaining WHY this is the right "
    "outcome for the returned item — mention condition, the local-buyer match (or absence), and "
    "the money/CO2 saved by skipping the long warehouse haul when relevant. No markdown, no JSON, "
    "no preamble. Just the explanation."
)


def _template(routing_json: dict) -> str:
    """Deterministic fallback narrative from the routing JSON (no API needed)."""
    d = routing_json.get("decision", "ROUTE")
    econ = routing_json.get("economics", {})
    match = routing_json.get("match", {})
    geo = routing_json.get("geography", {})
    resale = econ.get("resale_price")
    saved = econ.get("savings_if_local")
    co2 = econ.get("co2_saved_kg")

    if d == "RESELL_LOCAL" and match.get("buyer_found"):
        t3 = econ.get("tier3_projection") or {}
        t3_saved = t3.get("savings_if_local", saved)
        t3_co2 = t3.get("co2_saved_kg", co2)
        return (f"This item is in good enough condition to resell and a buyer {match.get('buyer_distance_km')} km "
                f"away (pincode {match.get('buyer_pincode')}) already wants it. Intercepting it locally at the "
                f"{geo.get('nearest_rcc')} centre avoids the long warehouse haul: in a tier-3 city where the FC is "
                f"~{econ.get('warehouse_equivalent_km')} km away that saves about Rs {t3_saved}/item and {t3_co2} kg "
                f"CO2/item (in this metro, with the FC only {geo.get('fc_distance_km')} km away, the saving is a "
                f"smaller Rs {saved}/item).")
    if d == "REFURBISH":
        return (f"The item has repairable wear, so refurbishing it restores resale value of about Rs {resale} "
                f"at a cost that the recovered value clears. It re-enters Amazon Renewed rather than being lost.")
    if d == "DONATE":
        return (f"The recoverable resale/scrap value is low for this category, so donating the item books more "
                f"social and ESG benefit than liquidating it, while still keeping it out of landfill.")
    if d == "LIQUIDATE":
        return (f"There is no nearby buyer and refurbishing would not clear its cost, so liquidation recovers the "
                f"most value for this item.")
    return f"Routed to {d}. Estimated resale value Rs {resale}."


def explain_decision(routing_json: dict) -> str:
    """Return a short narrative. LLM if a key is set, else a templated string. Never raises."""
    if genai is None or not gemini_config.has_api_key():
        return _template(routing_json)

    try:
        import json
        client = genai.Client(api_key=gemini_config.GEMINI_API_KEY)
        resp = client.models.generate_content(
            model=gemini_config.GEMINI_MODEL,
            config=types.GenerateContentConfig(system_instruction=_SYSTEM),
            contents=[json.dumps(routing_json)],
        )
        text = (resp.text or "").strip()
        return text or _template(routing_json)
    except Exception:
        # Any API hiccup -> fall back silently; the decision is unaffected.
        return _template(routing_json)
