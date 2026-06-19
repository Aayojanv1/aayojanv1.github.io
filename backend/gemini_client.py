"""
Gemini SDK client wrapper for AayojanAI.
Handles all LLM interactions with retry logic and prompt management.
"""

import json
import asyncio
from typing import Optional

from google import genai
from google.genai import types


class GeminiClient:
    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        self.model = model
        self.api_key = api_key
        if api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            self.client = None

    async def chat(
        self,
        messages: list[dict],
        system_prompt: Optional[str] = None,
        use_tools: bool = True,
    ) -> str:
        """Send a conversational message and get a reply."""
        if not self.client:
            return "I'm running in demo mode. Please configure a Gemini API key."

        contents = []
        for msg in messages:
            role = "user" if msg.get("role") == "user" else "model"
            content = msg.get("content", "")
            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=content)]))

        cfg = dict(
            system_instruction=system_prompt or "You are AayojanAI, a helpful catering assistant.",
            temperature=0.7,
            max_output_tokens=1000,
        )
        if use_tools:
            cfg["tools"] = [types.Tool(google_search=types.GoogleSearch())]
        config = types.GenerateContentConfig(**cfg)

        response = await asyncio.to_thread(
            self.client.models.generate_content,
            model=self.model,
            contents=contents,
            config=config,
        )
        return response.text or ""

    async def generate_menu(
        self, party_type: str, guest_count: int, pincode: str
    ) -> dict:
        """Generate a curated menu as structured JSON."""
        prompt = f"""You are MoodMunch AI, the intelligence behind AayojanAI catering platform.
The user chose party type "{party_type}" for {guest_count} guests in pincode {pincode} (Kolkata).
Create a curated base catering menu and return ONLY valid JSON:
{{
  "party_type": "{party_type}",
  "description": "one short inviting sentence",
  "items": [
    {{"name": "Item name", "category": "Starters", "pricePerPlate": 80, "emoji": "🍽️"}}
  ]
}}
Rules:
- Include 12 to 18 total items.
- Use categories: Starters, Main Course, Desserts, Drinks, Sides, Bread.
- Keep prices as integers in INR per plate.
- Pick items that genuinely fit the party type and Kolkata market.
- No markdown, no code fences, no extra text."""

        reply = await self.chat(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="You are a catering menu expert. Return only valid JSON.",
        )
        return json.loads(self._extract_json(reply))

    async def estimate_price(
        self, party_type: str, guest_count: int, pincode: str, selected_items: list[dict]
    ) -> dict:
        """Estimate fair per-plate pricing."""
        items_text = ", ".join(
            f"{item.get('name', '')} (₹{item.get('pricePerPlate', 0)})"
            for item in selected_items
        )
        prompt = f"""You are MoodMunch AI pricing a catered menu for Kolkata.
Return ONLY valid JSON:
{{
  "per_plate_estimate": 420,
  "summary": "one short sentence about the estimate",
  "pricing_reason": "one short sentence explaining why"
}}
Context:
- Party type: {party_type}
- Guest count: {guest_count}
- Pincode: {pincode}
- Selected items: {items_text}
Rules:
- Price must be a single integer INR per plate.
- No markdown, no code fences."""

        reply = await self.chat(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="You are a pricing expert. Return only valid JSON.",
        )
        return json.loads(self._extract_json(reply))

    async def rank_caterers(
        self,
        party_type: str,
        guest_count: int,
        pincode: str,
        per_plate_budget: int,
        selected_items: list[str],
        candidates: list[dict],
    ) -> list[dict]:
        """Rank caterers based on fit."""
        candidates_text = "\n".join(
            f"- {c.get('name', '')} | rating {c.get('rating', 0)} | cuisines: {', '.join(c.get('cuisineSpecialties', []))} | price: {c.get('priceRange', '')}"
            for c in candidates
        )
        prompt = f"""Rank the best 3 caterers for this order. Return ONLY a JSON array:
[
  {{"name": "Caterer name", "matchReason": "why they fit", "rank": 1}}
]
Context:
- Party type: {party_type}, Guests: {guest_count}, Budget: ₹{per_plate_budget}/plate
- Menu: {', '.join(selected_items[:10])}
Candidates:
{candidates_text}
Rules: Rank top 3 only. No markdown."""

        reply = await self.chat(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="You are a caterer ranking expert. Return only valid JSON array.",
        )
        return json.loads(self._extract_json(reply))

    async def plan(self, messages: list[dict]) -> dict:
        """Aayojan AI event planner — converses AND extracts a structured brief as JSON."""
        system = (
            "You are Aayojan AI, a warm, sharp catering planner serving ALL of Kolkata — every neighbourhood, every area. "
            "You handle everything from small party orders and birthdays to grand weddings and corporate events anywhere in Kolkata. "
            "NEVER say any area is outside your service zone. Accept any Kolkata location the customer mentions and move on. "
            "Gather the requirements through a warm, natural chat — ONE question per reply, no exceptions. "
            "Never combine two questions in a single message. Ask only the single most important missing detail. "
            "Order to collect: event type → guest count → cuisine/diet (veg / non-veg / satwik / jain) → date → area → budget per plate. "
            "If the customer volunteers several details in one message, capture them ALL at once and skip those steps — NEVER re-ask anything you already know. "
            "Acknowledge their answer warmly in one short sentence, then ask ONE question. Keep each reply under 20 words. "
            "When you ask about cuisine/diet, after they answer suggest 2-3 Bengali crowd-favourites that match their event AND diet in the same reply — no separate turn for dishes. "
            "Tailor by event — weddings: Kosha Mangsho, Chingri Malai Curry, Gandharaj Bhetki, Mutton Biryani; Jamai Sasthi (the Bengali son-in-law feast): a lavish spread of Ilish Bhapa, Chingri Malai Curry, Mutton Kosha, Bhetki Paturi, mishti & mango; annaprasan: Payesh, Luchi, Macher Jhol; parties: Biryani, Chicken Chaap, Fish Fry; corporate: Biryani, Paneer, Fish Kalia; and always a sweet like Mishti Doi, Rosogolla or Sandesh. "
            "STRICT DIET RULE: for VEGETARIAN never mention any non-veg dish; for JAIN suggest only Jain food (no onion, garlic, potato or other root vegetables) and never any non-veg. "
            "For WEDDINGS only, simply add 'and we'll set up a free tasting before you book' to your final confirming line — do NOT spend a separate question on tasting. Record brief.tasting only if they bring it up. "
            "As soon as you have the six basics (several may arrive together), set complete=true and make the reply a short confident line like "
            "'Perfect — matching you with verified kitchens now.' "
            "NEVER quote real prices, NEVER name specific caterers, NEVER invent statistics. "
            "Stay strictly on catering planning. If the user is off-topic, abusive, or uses profanity, "
            "gently redirect them to their event, never echo profanity, and keep every reply clean and professional. "
            "Respond with ONLY valid JSON, no markdown:\n"
            '{"reply":"your next message","brief":{"event":"","guests":"","cuisine":"","date":"","area":"","budget":"","tasting":""},"complete":false}\n'
            "Fill the brief fields known so far; leave unknown ones as empty strings."
        )
        reply = await self.chat(messages=messages, system_prompt=system, use_tools=False)
        try:
            data = json.loads(self._extract_json(reply))
            if not isinstance(data, dict):
                raise ValueError("not an object")
            data.setdefault("reply", "")
            data.setdefault("brief", {})
            data.setdefault("complete", False)
            return data
        except Exception:
            return {"reply": (reply or "Tell me a bit about your event 🙂")[:300], "brief": {}, "complete": False}

    @staticmethod
    def _extract_json(text: str) -> str:
        """Extract JSON from response, stripping any markdown fences."""
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            lines = lines[1:]  # remove opening fence
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines)
        text = text.strip()
        # Models sometimes wrap the JSON in prose ("Sure! {...}"). Extract the
        # outermost {...} object so json.loads still succeeds.
        if not text.startswith("{"):
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                text = text[start:end + 1]
        return text.strip()
