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
    ) -> str:
        """Send a conversational message and get a reply."""
        if not self.client:
            return "I'm running in demo mode. Please configure a Gemini API key."

        contents = []
        for msg in messages:
            role = "user" if msg.get("role") == "user" else "model"
            content = msg.get("content", "")
            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=content)]))

        config = types.GenerateContentConfig(
            system_instruction=system_prompt or "You are AayojanAI, a helpful catering assistant.",
            temperature=0.7,
            max_output_tokens=1000,
        )

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
        return text.strip()
