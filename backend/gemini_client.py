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
        max_tokens: int = 1000,
        temperature: float = 0.7,
        json_mode: bool = False,
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
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        if use_tools:
            cfg["tools"] = [types.Tool(google_search=types.GoogleSearch())]
        if json_mode:
            # Force pure JSON output + disable thinking (thinking tokens eat max_output_tokens on 2.5-flash)
            cfg["response_mime_type"] = "application/json"
            cfg["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
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

    async def price_lens(
        self,
        menu: list[str],
        guests: int,
        market_prices_block: str,
    ) -> dict:
        """PriceLens — estimate a fair per-plate price for the given menu using live market rates."""
        menu_text = "\n".join(f"- {m}" for m in menu if str(m).strip())
        prompt = f"""You are PriceLens, a Kolkata catering price analyst.
Given the menu below and today's Kolkata market rates, estimate a FAIR per-plate cost.
Be RIGOROUS — do not anchor to a "typical Kolkata plate" average. Compute strictly from ingredients.

TODAY'S KOLKATA MARKET RATES:
{market_prices_block}

MENU REQUESTED ({guests} guests):
{menu_text}

CRITICAL RULES (violating any of these makes the answer wrong):
- Portion size per person is FIXED — it does NOT change with guest count. Chicken kosha is 150g
  whether serving 10 people or 300. So `ingredientCost` for a given menu is IDENTICAL regardless
  of guest count. Do not vary it.
- Do NOT anchor to a "typical Kolkata plate ≈ ₹380". Compute from ingredients only.

Method (follow strictly, item by item):
1. The breakdown must contain ONLY edible dishes that appear on the plate.
   HARD BAN — NEVER add these to the breakdown (they're overhead, not ingredients):
     ❌ Cooking Fuel / LPG / Gas
     ❌ Water bottle / Drinking water / Packaged water
     ❌ Packaging / Foil / Boxes / Trays / Disposables / Cutlery
     ❌ Labour / Prep time / Delivery / Transport
     ❌ Any "Misc" / "Other" / "Overhead" line
   These are already baked into the overhead the server applies. Adding them here
   is DOUBLE-COUNTING and produces wrong prices.

2. For each menu item, list actual raw ingredients + per-plate portion.
   REALISTIC Kolkata per-plate portions (do not go below these):
     - chicken bone-in (curry / kosha): 150g
     - mutton bone-in (curry / kosha): 150g
     - fish (any): 100-120g          - prawn: 80-100g
     - paneer main: 100g (NOT 60g)   - dal: 80-100ml
     - plain rice / pulao: 180-220g  - sabzi / veg curry: 100-120g
     - salad: 80-100g                - chutney/papad: 50g / 2 pcs
     - sweets (rasogolla / gulab jamun / rajbhog / mishti doi): 1-2 PIECES per person,
       ~30-40g each. Portion field MUST be like "2 pc" or "1 pc (30g)" — NEVER "1g" or "2g".
     - drinks (welcome drink / mocktail): 150-200ml per guest

   BIRYANI is different — treat these portions as MANDATORY:
     - KOLKATA MUTTON BIRYANI plate (500-600g total): 200g mutton bone-in + 250g basmati
       + 80-100g aloo (potato) + optional 1 egg + ghee 25g + saffron/spices/kaju.
       Ingredient should be ~₹200-240/plate. Anything below ₹180 is UNDER-PORTIONED.
     - KOLKATA CHICKEN BIRYANI (450-550g total): 150g chicken + 250g basmati + 80g aloo
       + optional egg + ghee + spices. Ingredient ~₹110-140/plate.
     - Aloo is COMPULSORY in Kolkata biryani — never skip it.

3. Sum ingredient cost per plate strictly from the rates above. Do NOT invent items.

4. Server applies overhead + guest-count scaling deterministically. Report raw ingredient
   cost honestly. For reference: server adds 35% for ≤50 guests, 90% for >50 guests, and
   applies a floor (₹180 bulk, ₹450 full). This overhead ALREADY COVERS fuel, water,
   packaging, labour, staff, delivery, cutlery, transport, and caterer margin.

5. Fair-range = ±10% (server may recompute).

6. Sanity floors — if your ingredient sum is below these, you're under-portioning:
     - pure veg party menu (4-5 items):  ingredient ≥ ₹90/plate
     - non-veg party menu (with chicken + fish): ingredient ≥ ₹170/plate
     - premium wedding (mutton/chingri/ilish): ingredient ≥ ₹400/plate
   If your first pass falls below these, RECHECK your portion sizes — you likely
   under-portioned paneer, protein, or forgot ghee/oil/spices in ingredient math.
   Do NOT add fake "misc" or "fuel" items to inflate the total — that's banned above.

Return ONLY valid JSON, no markdown:
{{
  "pricePerPlate": 380,
  "fairRangeLow": 342,
  "fairRangeHigh": 418,
  "ingredientCostPerPlate": 240,
  "overheadPct": 25,
  "guestScaleNote": "one-line note on scale — e.g. '30% overhead applied for small event'",
  "breakdown": [
    {{"item": "Chicken Kosha", "portionGrams": 150, "ingredientCost": 55, "note": "chicken ₹260/kg + masalas"}}
  ],
  "verdict": "one warm one-line verdict — 'fair', 'slightly high', 'below market'",
  "notes": "one line explaining any assumption (e.g., 'assumed 150g rice/plate')"
}}
Rules: integers only for money. Verdict must be encouraging, not accusatory."""

        reply = await self.chat(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="You are PriceLens, a Kolkata catering price analyst. Return only valid JSON.",
            use_tools=False,
            max_tokens=4000,
            temperature=0.15,
            json_mode=True,
        )
        return json.loads(self._extract_json(reply))

    async def bhojon_buddy(
        self,
        budget_per_plate: int,
        guests: int,
        occasion: str,
        diet: str,
        market_prices_block: str,
    ) -> dict:
        """Bhojon Buddy — curate a realistic menu for a given budget/plate + guest count + occasion."""
        diet_norm = (diet or "any").lower().strip()
        occ_lower = (occasion or "").lower()

        # Course template by occasion (Bengali Kolkata norms)
        if "wedding" in occ_lower:
            template = ("Bengali WEDDING full course:\n"
                        "  LIVE COUNTERS — MANDATORY at every Bengali wedding, ALWAYS include ALL THREE:\n"
                        "    1. 'Live Counter · Mocktails' — Item text should list 2-3 mocktail varieties in one line "
                        "(e.g. 'Mocktail Bar — Aam Panna · Rose Sherbet · Jaljeera'). Portion: 'per guest'.\n"
                        "    2. 'Live Counter · Tea/Coffee' — Item text: 'Tea/Coffee Counter — Masala Chai · Filter Coffee "
                        "(+ Green Tea for premium)'. Portion: 'per guest'.\n"
                        "    3. 'Live Counter · Salad Bar' — Item text MUST list 5-6 salad varieties in one line "
                        "(e.g. 'Salad Bar (6 varieties) — Green Salad · Kachumber · Russian Salad · Fruit Salad · "
                        "Sprouts Salad · Corn Salad'). Portion: 'buffet · 5-6 types'.\n"
                        "  SEATED COURSE (in order):\n"
                        "    - Welcome Drink (1) · e.g. Aam Panna / Rose Sherbet on arrival\n"
                        "    - Starters — {starter_split}\n"
                        "    - Rice / Bread (1-2) · Basanti Pulao or Gobindobhog Pulao (mandatory), plus Luchi/Roti if premium\n"
                        "    - Main Course (3-4) · one signature protein (Mutton Kosha / Chingri Malaikari / Ilish Bhapa) + "
                        "fish curry + paneer/dal + one veg\n"
                        "    - Accompaniments · Chatni · Papad (kept separate from the Salad Bar)\n"
                        "    - Dessert (1-2) · Rasogolla + Payesh or Mishti Doi (premium: add Sandesh / Rajbhog / Ice cream)")
            if diet_norm == "veg" or diet_norm == "jain" or diet_norm == "satwik":
                starter_split = "3-4 veg starters (Paneer Tikka, Veg Cutlet, Paneer Butter Fry, Corn Sticks etc.)"
            else:
                starter_split = "2 non-veg starters + 2 veg starters (STRICT). Non-veg examples: Fish Fry / Fish Finger / Chicken Kabab / Chicken Chaap / Reshmi Kabab. Veg examples: Paneer Tikka / Paneer Butter Fry / Veg Cutlet / Cocktail Kabab"
            template = template.format(starter_split=starter_split)
        elif "annaprasan" in occ_lower:
            template = ("ANNAPRASAN course structure (traditional Bengali baby's first-rice):\n"
                        "  - Rice · Payesh (rice + milk + jaggery/sugar) — MANDATORY as the ritual dish\n"
                        "  - Luchi + Chholar Dal · classic pairing\n"
                        "  - 1-2 Vegetables (Alu Phulkopi / Dhokar Dalna / Chatni)\n"
                        "  - Fish (Bhetki / Rohu curry if non-veg preferred)\n"
                        "  - Mishti Doi + Sandesh + Rasogolla")
        elif "griha pravesh" in occ_lower or "grihapravesh" in occ_lower:
            template = ("GRIHA PRAVESH lunch/dinner:\n"
                        "  - 1-2 Starters (light — Veg Cutlet + optional Fish Fry)\n"
                        "  - Pulao or Radhaballabi + Chana Dal\n"
                        "  - 2-3 Mains (Paneer Butter Masala + Alu Dom / Fish curry / Chicken Kosha)\n"
                        "  - Chatni · Papad · Salad · Rasogolla")
        elif "corporate" in occ_lower:
            template = ("CORPORATE LUNCH box/buffet:\n"
                        "  - 1 protein main (Chicken Kosha / Paneer) + Pulao/Rice + Dal + 1 sabzi + salad + 1 sweet")
        else:
            template = ("General party — 1-2 Starters + Rice/Bread + 2-3 Mains (per diet) + 1 Accompaniment + 1 Dessert")

        prompt = f"""You are Bhojon Buddy, a warm Bengali menu curator for Kolkata events.
Design a REALISTIC menu a verified Aayojan kitchen can actually cook and serve profitably.

TODAY'S KOLKATA MARKET RATES:
{market_prices_block}

BRIEF:
- Occasion: {occasion or 'general party'}
- Guests: {guests}
- Budget per plate: ₹{budget_per_plate}
- Diet: {diet_norm}

OCCASION TEMPLATE (follow this course structure strictly):
{template}

Pricing tier hints (Bengali wedding norms):
- ₹300–500 budget/plate → budget wedding · standard chicken/fish · Rasogolla
- ₹500–800 → mid-range · mutton or fish + paneer premium · Rasogolla + Payesh
- ₹800–1200 → premium · Mutton Kosha + Chingri Malaikari · Payesh + Sandesh
- ₹1200+ → luxury · Ilish Bhapa + Chingri Malaikari + Mutton · full dessert spread

Rules:
- Target ingredient cost per plate based on delivery mode (server applies the overhead):
    * ≤50 guests (bulk delivery, 18% overhead) → ingredient budget ≈ 85% of plate budget
    * >50 guests (full catering, 60% overhead)  → ingredient budget ≈ 62% of plate budget
- Do NOT exceed the ingredient budget. Prefer FEWER well-made items over stretched cheap ones.
- Portions must be realistic (mutton 150g, fish 120g, rice 200g, paneer 60g, sweets 1-2 pc).
- Bengali crowd-favourites first; Indian classics second.
- For WEDDING non-veg (or 'mix'), the starters MUST be exactly 2 non-veg + 2 veg unless the customer explicitly requested pure-veg.
- Use the market rates provided; do not invent items not in the rate list.

Return ONLY valid JSON, no markdown:
{{
  "menu": [
    {{"course": "Starter · Non-Veg", "item": "Fish Fry", "portion": "80 g", "rationale": "wedding classic"}}
  ],
  "estimatedIngredientCost": 460,
  "estimatedPlateCost": 720,
  "budgetFit": "well within budget | tight | over — reduce by ₹X",
  "occasionNote": "one warm line tying the menu to the occasion",
  "warnings": ["any caveats — e.g. 'Ilish adds seasonality risk'"]
}}
Course labels to use: "Live Counter · Mocktails", "Live Counter · Tea/Coffee", "Live Counter · Salad Bar", "Welcome Drink", "Starter · Non-Veg", "Starter · Veg", "Rice / Bread", "Main · Non-Veg", "Main · Veg", "Accompaniment", "Dessert".
For weddings: the three Live Counters must appear at the TOP of the menu array, before Welcome Drink.
No markdown. Integers only for money."""

        reply = await self.chat(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="You are Bhojon Buddy, a Bengali menu curator. Return only valid JSON.",
            use_tools=False,
            max_tokens=4000,
            temperature=0.4,
            json_mode=True,
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
        text = text.strip()
        # Models sometimes wrap the JSON in prose ("Sure! {...}"). Extract the
        # outermost {...} object so json.loads still succeeds.
        if not text.startswith("{"):
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                text = text[start:end + 1]
        return text.strip()
