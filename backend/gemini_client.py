"""
Gemini SDK client wrapper for AayojanAI.
Handles all LLM interactions with retry logic and prompt management.
"""

import json
import asyncio
from typing import Optional

from google import genai
from google.genai import types


def _bhojon_tier_for_budget(budget: int) -> tuple[str, str]:
    """Map a per-plate budget to a tier slug + human label. Used to scale menu
    scope across ALL occasions (weddings, birthdays, corporate, etc.) so the
    same occasion at different price points produces genuinely different menus."""
    if budget < 500:
        return ("budget", "Budget tier — smaller spread, essentials only")
    if budget < 800:
        return ("mid", "Mid tier — adds variety, one live counter")
    if budget < 1200:
        return ("premium", "Premium tier — multiple live counters, richer proteins")
    return ("luxury", "Luxury tier — full spread, premium proteins, all counters")


# Explicit ITEM LADDERS by budget tier. Give the AI concrete anchors so it
# doesn't default to the same crowd-pleaser regardless of price.
_NONVEG_STARTER_LADDER = {
    "budget":  "1-2 items: Chicken Kabab OR Fish Fry",
    "mid":     "2-3 items: Fish Fry + Chicken Kabab (+ Fish Finger optional)",
    "premium": "3-4 items: Reshmi Kabab + Fish Fry + Chicken Tikka + Fish Finger",
    "luxury":  "4-5 items: Mutton Seekh + Chingri Kabab + Reshmi Kabab + Fish Fry + Chicken Tikka",
}
_VEG_STARTER_LADDER = {
    "budget":  "1-2 items: Veg Cutlet OR Paneer Tikka",
    "mid":     "2 items: Paneer Tikka + Veg Cutlet",
    "premium": "3 items: Paneer Tikka + Cocktail Kabab + Veg Cutlet",
    "luxury":  "3-4 items: Malai Chaap + Paneer Tikka + Corn Sticks + Veg Cutlet",
}
_NONVEG_MAIN_LADDER = {
    "budget":  "1-2 mains: Chicken Kosha (+ Rohu curry optional). NO mutton at this tier.",
    "mid":     "2-3 mains: Chicken Kosha + Fish curry (Bhetki/Rohu) (+ 1 veg main)",
    "premium": "3-4 mains: Mutton Kosha + Fish curry + Chicken Kosha + Paneer main",
    "luxury":  "4-5 mains: Mutton Kosha + Chingri Malaikari + Ilish Bhapa + Fish curry + Paneer signature",
}
_VEG_MAIN_LADDER = {
    "budget":  "1-2 mains: Paneer Butter Masala OR Alu Dom + 1 sabzi",
    "mid":     "2-3 mains: Paneer Butter Masala + Dhokar Dalna + 1 sabzi",
    "premium": "3-4 mains: Paneer Signature + Dhokar Dalna + Malai Kofta + 1 sabzi",
    "luxury":  "4-5 mains: Paneer Signature + Chhanar Dalna + Dhokar Dalna + Malai Kofta + Alu Phulkopi",
}
_SWEET_LADDER = {
    "budget":  "1-2 sweets: Rasogolla OR Payesh",
    "mid":     "2-3 sweets: Rasogolla + Payesh + Mishti Doi",
    "premium": "4-5 sweets: Rasogolla + Sandesh + Payesh + Mishti Doi + Kaju Barfi",
    "luxury":  "6-8 sweets: Rasogolla + Sandesh + Rajbhog + Mihidana + Sitabhog + Nolen Gur Sandesh + Payesh + Mishti Doi",
}


def _pick_ladder(diet_norm: str, ladder_nv: dict, ladder_v: dict, tier: str) -> str:
    """Pick the right item-ladder line for the diet + tier."""
    if diet_norm in ("veg", "jain", "satwik"):
        return ladder_v.get(tier, ladder_v["mid"])
    return ladder_nv.get(tier, ladder_nv["mid"])


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

4. Server applies overhead deterministically as a FIXED per-event lump sum divided by
   guest count. Report raw ingredient cost honestly. For reference: server adds
   ₹3,500 fixed for ≤50 guests (bulk order) or ₹15,000 fixed for >50 guests (full
   catering), then ÷ guests → per-plate overhead. Composition-aware floors still
   apply as a safety net (₹180/260/380 bulk, ₹450/550/700 full for veg/nonveg/premium).
   The overhead ALREADY COVERS fuel, water, packaging, labour, staff, delivery, cutlery,
   transport, and caterer margin.

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
  "guestScaleNote": "one-line note on scale — server will overwrite this with the fixed-overhead ÷ guests breakdown",
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
        tier_slug, tier_label = _bhojon_tier_for_budget(budget_per_plate)

        # Course template by occasion (Bengali Kolkata norms)
        if "wedding" in occ_lower:
            # Budget-tiered section counts. Kolkata Bengali/Marwari weddings are
            # long-form dining events; a real menu spans 12-22 sections including
            # multiple live counters. The AI must scale sections + variety-per-
            # counter to the plate budget, not just drop items.
            if budget_per_plate < 500:
                tier_label = "BUDGET wedding (₹300–500/plate) — 10-12 sections"
                counter_rules = (
                    "    · Mocktails: 8-10 varieties (Aam Panna · Rose Sherbet · Jaljeera · "
                    "Watermelon Cooler · Litchi Cooler · Kokum · Cucumber Mint · Nolen Gur Sherbet)\n"
                    "    · Salad Bar: 5-6 varieties\n"
                    "    · Sweet Counter: 3-4 sweets (Rasogolla · Sandesh · Mihidana)\n"
                    "    · SKIP: Chaat / Chinese / Tandoor / Ice Cream / Paan / Soup counters\n")
                seated_rules = (
                    "    - Welcome Drink (1)\n"
                    "    - Starters: {starter_split}\n"
                    "    - Rice/Bread: Basanti Pulao (mandatory)\n"
                    "    - Dal: 1 (Chana Dal or Musur Dal)\n"
                    "    - Main Course: 2-3 (one non-veg protein + fish curry + paneer/veg)\n"
                    "    - Accompaniments: Chatni + Papad\n"
                    "    - Dessert (plated): Payesh or Mishti Doi\n")
            elif budget_per_plate < 800:
                tier_label = "MID-RANGE wedding (₹500–800/plate) — 14-16 sections"
                counter_rules = (
                    "    · Mocktails: 10-12 varieties (add Gondhoraj Lemonade · Jamun Cooler · "
                    "Blue Lagoon · Thandai · Cucumber Mint to the base list)\n"
                    "    · Salad Bar: 6-8 varieties\n"
                    "    · Chaat Counter: 3-4 items (Puchka · Aloo Kabli · Ghugni · Papdi Chaat)\n"
                    "    · Chinese Counter: 3-4 items (Chowmein · Chilli Chicken · Veg Manchurian · Fried Rice)\n"
                    "    · Sweet Counter: 5-7 sweets (Rasogolla · Sandesh · Rajbhog · Mihidana · Sitabhog · Kheer Kadam)\n"
                    "    · Tea/Coffee: Masala Chai + Filter Coffee\n"
                    "    · SKIP: Tandoor / Ice Cream / Paan\n")
                seated_rules = (
                    "    - Welcome Drink (1)\n"
                    "    - Starters (passed): {starter_split}\n"
                    "    - Rice/Bread: Basanti Pulao + Luchi\n"
                    "    - Dal: 1 (Chana Dal or Sona Moong)\n"
                    "    - Main Course: 3-4 (mutton or fish + fish curry + paneer + one veg)\n"
                    "    - Accompaniments: Chatni · Papad · Kachumber\n"
                    "    - Dessert (plated): Payesh + Mishti Doi\n")
            elif budget_per_plate < 1200:
                tier_label = "PREMIUM wedding (₹800–1200/plate) — 17-20 sections"
                counter_rules = (
                    "    · Mocktails: 12-15 varieties (add Pina Colada · Mango Lassi · Watermelon "
                    "Basil · Grape Fizz · Rose Falooda to the base list)\n"
                    "    · Salad Bar: 8-10 varieties (add Waldorf · Caesar · Corn & Bean · Pasta Salad)\n"
                    "    · Chaat Counter: 4-5 items (Puchka · Aloo Kabli · Ghugni · Papdi Chaat · Jhal Muri)\n"
                    "    · Chinese Counter: 4-5 items (add Prawn Manchurian or Chilli Fish)\n"
                    "    · Tandoor/Kebab Counter: 4-6 varieties (Reshmi Kabab · Chicken Tikka · "
                    "Paneer Tikka · Fish Tikka · Mutton Seekh · Malai Chaap)\n"
                    "    · Soup: 1-2 (Sweet Corn + Cream of Tomato or Thai)\n"
                    "    · Sweet Counter: 8-10 sweets (add Kaju Barfi · Chomchom · Malpua · Nolen Gur Sandesh)\n"
                    "    · Ice Cream / Kulfi Counter: 5-7 flavours (Nolen Gur · Kesar · Chocolate · "
                    "Kulfi Falooda · Vanilla · Strawberry · Mango)\n"
                    "    · Paan Counter: 3-4 varieties (Meetha Paan · Chocolate Paan · Silver Paan · Gulkand Paan)\n"
                    "    · Tea/Coffee: Masala Chai + Filter Coffee + Green Tea\n")
                seated_rules = (
                    "    - Welcome Drink (1)\n"
                    "    - Starters (passed): {starter_split}\n"
                    "    - Rice/Bread: Basanti Pulao + Luchi + Roti (choice)\n"
                    "    - Dal: Chana Dal (signature) or Sona Moong\n"
                    "    - Main Course: 4-5 (Mutton Kosha + Chingri Malaikari + Fish curry + Paneer + one veg)\n"
                    "    - Accompaniments: Chatni · Papad · Salad\n"
                    "    - Dessert (plated): Payesh + Mishti Doi (from the sweet counter)\n")
            else:  # ≥ 1200 luxury
                tier_label = "LUXURY wedding (₹1200+/plate) — 20-22 sections, everything"
                counter_rules = (
                    "    · Mocktails: 12-15 varieties (full premium list)\n"
                    "    · Salad Bar: 8-10 varieties incl. imported greens\n"
                    "    · Chaat Counter: 5 items (full spread)\n"
                    "    · Chinese Counter: 5 items (add Chilli Fish · Hakka Noodles)\n"
                    "    · Tandoor/Kebab Counter: 6 varieties\n"
                    "    · Pasta / Continental Counter: 2-3 items (Alfredo · Arrabbiata · Grilled Veg)\n"
                    "    · Soup: 2 varieties\n"
                    "    · Sweet Counter: 8-10 sweets (Bengali premium + one Marwari sweet)\n"
                    "    · Ice Cream / Kulfi Counter: 6-7 flavours\n"
                    "    · Paan Counter: 4 varieties\n"
                    "    · Tea/Coffee: Masala Chai + Filter Coffee + Green Tea + Herbal\n")
                seated_rules = (
                    "    - Welcome Drink (1) · premium (Rose sherbet or Nolen gur sherbet)\n"
                    "    - Starters (passed): {starter_split}\n"
                    "    - Rice/Bread: Basanti Pulao + Luchi + Roti + Kashmiri Pulao (choice)\n"
                    "    - Dal: Chana Dal (signature)\n"
                    "    - Main Course: 5-6 (Mutton Kosha + Chingri Malaikari + Ilish Bhapa + "
                    "Fish curry + Paneer signature + one veg)\n"
                    "    - Accompaniments: Chatni · Papad · Salad · Kachori\n"
                    "    - Dessert (plated): Payesh + Mishti Doi (from the sweet counter)\n")

            template = (f"Bengali WEDDING full course — {tier_label}.\n"
                        f"Kolkata weddings are LONG-FORM dining events. The menu MUST be comprehensive.\n"
                        f"Bunch items into the courses below. Do NOT drop courses to save cost — reduce\n"
                        f"variety within each counter instead. Order matters (courses appear in this order):\n\n"
                        f"  LIVE COUNTERS (before seated dinner, guests visit as they arrive):\n"
                        f"{counter_rules}"
                        f"    Format: each Live Counter is ONE row in the menu array with the varieties\n"
                        f"    listed in the item text, e.g. \"Mocktail Bar (12) — Aam Panna · Rose Sherbet · \n"
                        f"    Jaljeera · Gondhoraj Lemonade · Watermelon Cooler · Litchi Cooler · Blue Lagoon · \n"
                        f"    Thandai · Kokum · Jamun Cooler · Cucumber Mint · Nolen Gur Sherbet\". Portion: 'per guest'.\n\n"
                        f"  SEATED / SERVED PHASE (guests sit down, courses served in order):\n"
                        f"{seated_rules}")
            if diet_norm == "veg" or diet_norm == "jain" or diet_norm == "satwik":
                starter_split = "3-4 veg starters (Paneer Tikka, Veg Cutlet, Paneer Butter Fry, Corn Sticks etc.)"
            else:
                starter_split = "2 non-veg starters + 2 veg starters (STRICT). Non-veg examples: Fish Fry / Fish Finger / Chicken Kabab / Chicken Chaap / Reshmi Kabab. Veg examples: Paneer Tikka / Paneer Butter Fry / Veg Cutlet / Cocktail Kabab"
            template = template.format(starter_split=starter_split)
        elif "annaprasan" in occ_lower:
            # Traditional Bengali baby's first-rice — Payesh is ritual-mandatory at every tier.
            if tier_slug == "budget":
                template = ("ANNAPRASAN — BUDGET tier (₹300-499/plate) · 5-6 items:\n"
                            "  - Rice + Payesh (MANDATORY ritual dish)\n"
                            "  - Luchi + Chholar Dal\n"
                            "  - 1 vegetable (Alu Phulkopi or Dhokar Dalna)\n"
                            "  - 1 sweet (Rasogolla or Sandesh)")
            elif tier_slug == "mid":
                template = ("ANNAPRASAN — MID tier (₹500-799/plate) · 8-9 items:\n"
                            "  - Rice + Payesh (MANDATORY)\n"
                            "  - Luchi + Chholar Dal\n"
                            "  - Basanti Pulao\n"
                            "  - 1-2 vegetables (Alu Phulkopi + Dhokar Dalna)\n"
                            "  - Fish (Rohu or Bhetki curry) if non-veg preferred\n"
                            "  - Chatni · Papad\n"
                            "  - Mishti Doi + Sandesh")
            elif tier_slug == "premium":
                template = ("ANNAPRASAN — PREMIUM tier (₹800-1199/plate) · 11-13 items:\n"
                            "  - Welcome Drink (Aam Panna or Rose Sherbet)\n"
                            "  - Rice + Payesh (MANDATORY)\n"
                            "  - Luchi + Chholar Dal\n"
                            "  - Basanti Pulao\n"
                            "  - 2 vegetables (Alu Phulkopi + Dhokar Dalna)\n"
                            "  - 1 non-veg main (Bhetki curry / Chicken Kosha)\n"
                            "  - 1 paneer main\n"
                            "  - Chatni · Papad · Salad\n"
                            "  - Sweet plate: Rasogolla + Sandesh + Mihidana\n"
                            "  - Mishti Doi")
            else:  # luxury
                template = ("ANNAPRASAN — LUXURY tier (₹1200+/plate) · 14-16 items:\n"
                            "  - Welcome Drink + Live Counter · Mocktails (6-8 varieties)\n"
                            "  - Rice + Payesh (MANDATORY)\n"
                            "  - Luchi + Chholar Dal + Basanti Pulao\n"
                            "  - 2-3 vegetables\n"
                            "  - Fish (Bhetki or Ilish) + 1 more non-veg (Chingri Malaikari / Mutton Kosha)\n"
                            "  - 1 paneer signature main\n"
                            "  - Chatni · Papad · Salad · Kachori\n"
                            "  - Sweet Counter: 5-6 varieties (Rasogolla + Sandesh + Rajbhog + Mihidana + Sitabhog + Nolen Gur Sandesh)\n"
                            "  - Mishti Doi (plated dessert)")
        elif "griha pravesh" in occ_lower or "grihapravesh" in occ_lower:
            nv_start = _pick_ladder(diet_norm, _NONVEG_STARTER_LADDER, _VEG_STARTER_LADDER, tier_slug)
            nv_main = _pick_ladder(diet_norm, _NONVEG_MAIN_LADDER, _VEG_MAIN_LADDER, tier_slug)
            sweets = _SWEET_LADDER[tier_slug]
            if tier_slug == "budget":
                template = (f"GRIHA PRAVESH — BUDGET tier (₹300-499/plate) · 6-7 items:\n"
                            f"  - Welcome Drink (1 · Aam Panna or Rose Sherbet)\n"
                            f"  - Starters: {nv_start}\n"
                            f"  - Radhaballabi + Chana Dal OR Basanti Pulao\n"
                            f"  - Mains: {nv_main}\n"
                            f"  - Chatni · Papad · Salad\n"
                            f"  - Sweet: {sweets}")
            elif tier_slug == "mid":
                template = (f"GRIHA PRAVESH — MID tier (₹500-799/plate) · 9-11 items:\n"
                            f"  - Welcome Drink (1)\n"
                            f"  - Starters: {nv_start}\n"
                            f"  - Basanti Pulao + Luchi\n"
                            f"  - Dal (Chana Dal or Sona Moong)\n"
                            f"  - Mains: {nv_main}\n"
                            f"  - Chatni · Papad · Salad\n"
                            f"  - Sweets: {sweets}")
            elif tier_slug == "premium":
                template = (f"GRIHA PRAVESH — PREMIUM tier (₹800-1199/plate) · 12-14 items:\n"
                            f"  - Welcome Drink + Live Counter · Mocktails (8-10 varieties)\n"
                            f"  - Live Counter · Salad Bar (6 varieties)\n"
                            f"  - Starters (passed): {nv_start}\n"
                            f"  - Basanti Pulao + Luchi + Roti\n"
                            f"  - Dal (Chana Dal signature)\n"
                            f"  - Mains: {nv_main}\n"
                            f"  - Chatni · Papad\n"
                            f"  - Sweet Counter: {sweets}\n"
                            f"  - Plated Dessert: Payesh + Mishti Doi")
            else:  # luxury
                template = (f"GRIHA PRAVESH — LUXURY tier (₹1200+/plate) · 15-17 items:\n"
                            f"  - Welcome Drink + Live Counter · Mocktails (10-12 varieties)\n"
                            f"  - Live Counter · Salad Bar (8 varieties)\n"
                            f"  - Live Counter · Chinese (Chowmein · Chilli Chicken · Manchurian)\n"
                            f"  - Starters (passed): {nv_start}\n"
                            f"  - Basanti Pulao + Luchi + Roti + Kashmiri Pulao\n"
                            f"  - Dal (Chana Dal signature)\n"
                            f"  - Mains: {nv_main}\n"
                            f"  - Chatni · Papad · Salad · Kachori\n"
                            f"  - Sweet Counter: {sweets}\n"
                            f"  - Plated Dessert: Payesh + Mishti Doi + Nolen Gur Ice Cream")
        elif "corporate" in occ_lower:
            # Corporate lunch tiers reflect box vs buffet vs live-counter setup
            if tier_slug == "budget":
                template = ("CORPORATE LUNCH — BUDGET tier (₹200-499/plate) · 5-6 items · lunch box:\n"
                            "  - 1 protein main (Chicken Kosha OR Paneer Butter Masala)\n"
                            "  - Basanti Pulao or Basmati Rice\n"
                            "  - Dal (Chana or Musur)\n"
                            "  - 1 sabzi\n"
                            "  - Salad + Papad\n"
                            "  - 1 sweet (Rasogolla)")
            elif tier_slug == "mid":
                template = ("CORPORATE LUNCH — MID tier (₹500-799/plate) · 8-10 items · buffet:\n"
                            "  - Welcome Drink (1)\n"
                            "  - 1 veg starter (Paneer Tikka)\n"
                            "  - 2 mains (1 non-veg + 1 paneer)\n"
                            "  - Basanti Pulao + Roti\n"
                            "  - Dal + 1 sabzi\n"
                            "  - Salad · Chatni · Papad\n"
                            "  - 2 sweets (Rasogolla + Mishti Doi)")
            elif tier_slug == "premium":
                template = ("CORPORATE LUNCH — PREMIUM tier (₹800-1199/plate) · 11-13 items · buffet + counter:\n"
                            "  - Welcome Drink + Live Counter · Mocktails (5-6 varieties)\n"
                            "  - Live Counter · Salad Bar (5-6 varieties)\n"
                            "  - Starters: 1 non-veg + 1 veg\n"
                            "  - 3 mains (Chicken Kosha + Fish curry + Paneer)\n"
                            "  - Basanti Pulao + Luchi + Roti\n"
                            "  - Dal + 2 sabzi\n"
                            "  - Chatni · Papad\n"
                            "  - Sweet Counter (3-4 sweets)")
            else:  # luxury
                template = ("CORPORATE LUNCH — LUXURY tier (₹1200+/plate) · 14-17 items · full buffet + live counters:\n"
                            "  - Welcome Drink + Live Counter · Mocktails (8-10 varieties)\n"
                            "  - Live Counter · Salad Bar (8 varieties)\n"
                            "  - Live Counter · Chaat (Puchka · Ghugni · Aloo Kabli)\n"
                            "  - Live Counter · Chinese (Chowmein · Chilli Chicken)\n"
                            "  - Starters: 2 non-veg + 2 veg (passed)\n"
                            "  - 4 mains (Mutton Kosha + Fish curry + Chicken Kosha + Paneer signature)\n"
                            "  - Basanti Pulao + Luchi + Roti\n"
                            "  - Dal + 2 sabzi\n"
                            "  - Chatni · Papad · Salad\n"
                            "  - Sweet Counter (5-6 sweets)\n"
                            "  - Ice Cream Counter (3-4 flavours)")
        else:
            # General party / Birthday / Bhai Phota / anything else
            nv_start = _pick_ladder(diet_norm, _NONVEG_STARTER_LADDER, _VEG_STARTER_LADDER, tier_slug)
            nv_main = _pick_ladder(diet_norm, _NONVEG_MAIN_LADDER, _VEG_MAIN_LADDER, tier_slug)
            sweets = _SWEET_LADDER[tier_slug]
            is_birthday = "birthday" in occ_lower
            cake_line = "\n  - Birthday Cake (mandatory, 1 kg per 25 guests)" if is_birthday else ""
            if tier_slug == "budget":
                template = (f"{'BIRTHDAY' if is_birthday else 'GENERAL PARTY'} — BUDGET tier (₹200-499/plate) · 5-7 items:\n"
                            f"  - Welcome Drink (1) OR skip\n"
                            f"  - Starters: {nv_start}\n"
                            f"  - Basanti Pulao or Basmati Rice\n"
                            f"  - Mains: {nv_main}\n"
                            f"  - Chatni · Papad\n"
                            f"  - Sweet: {sweets}"
                            f"{cake_line}")
            elif tier_slug == "mid":
                template = (f"{'BIRTHDAY' if is_birthday else 'GENERAL PARTY'} — MID tier (₹500-799/plate) · 8-10 items:\n"
                            f"  - Welcome Drink (1)\n"
                            f"  - Starters: {nv_start}\n"
                            f"  - Basanti Pulao + Luchi or Roti\n"
                            f"  - Dal\n"
                            f"  - Mains: {nv_main}\n"
                            f"  - Chatni · Papad · Salad\n"
                            f"  - Sweets: {sweets}"
                            f"{cake_line}")
            elif tier_slug == "premium":
                template = (f"{'BIRTHDAY' if is_birthday else 'GENERAL PARTY'} — PREMIUM tier (₹800-1199/plate) · 12-14 items:\n"
                            f"  - Welcome Drink + Live Counter · Mocktails (8-10 varieties)\n"
                            f"  - Live Counter · Chaat (Puchka · Ghugni · Aloo Kabli) OR Chinese Counter\n"
                            f"  - Starters (passed): {nv_start}\n"
                            f"  - Basanti Pulao + Luchi + Roti\n"
                            f"  - Dal\n"
                            f"  - Mains: {nv_main}\n"
                            f"  - Chatni · Papad · Salad\n"
                            f"  - Sweet Counter: {sweets}"
                            f"{cake_line}")
            else:  # luxury
                template = (f"{'BIRTHDAY' if is_birthday else 'GENERAL PARTY'} — LUXURY tier (₹1200+/plate) · 15-18 items:\n"
                            f"  - Welcome Drink + Live Counter · Mocktails (10-12 varieties)\n"
                            f"  - Live Counter · Salad Bar (8 varieties)\n"
                            f"  - Live Counter · Chaat (5 items)\n"
                            f"  - Live Counter · Chinese (4-5 items)\n"
                            f"  - Starters (passed): {nv_start}\n"
                            f"  - Basanti Pulao + Luchi + Roti + Kashmiri Pulao\n"
                            f"  - Dal (Chana Dal signature)\n"
                            f"  - Mains: {nv_main}\n"
                            f"  - Chatni · Papad · Salad · Kachori\n"
                            f"  - Sweet Counter: {sweets}\n"
                            f"  - Ice Cream Counter (5-6 flavours)"
                            f"{cake_line}")

        prompt = f"""You are Bhojon Buddy, a warm Bengali menu curator for Kolkata events.
Design a REALISTIC menu a verified Aayojan kitchen can actually cook and serve profitably.

TODAY'S KOLKATA MARKET RATES:
{market_prices_block}

BRIEF:
- Occasion: {occasion or 'general party'}
- Guests: {guests}
- Budget per plate: ₹{budget_per_plate}
- Diet: {diet_norm}
- Pricing tier: {tier_slug.upper()} ({tier_label})

OCCASION TEMPLATE (follow this course structure strictly for THIS tier):
{template}

TIER DIFFERENTIATION IS CRITICAL — a menu at ₹500 must look OBVIOUSLY different
from one at ₹1000 for the SAME occasion. The section count, item count, protein
choices, and counter presence should all shift. Do not default to the same
crowd-pleaser regardless of budget.

Pricing tier hints (Bengali wedding norms):
- ₹300–500 budget/plate → budget wedding · standard chicken/fish · Rasogolla · 10-12 sections
- ₹500–800 → mid-range · mutton or fish + paneer premium · adds chaat + chinese counters · 14-16 sections
- ₹800–1200 → premium · Mutton Kosha + Chingri Malaikari · adds tandoor + ice cream + paan · 17-20 sections
- ₹1200+ → luxury · Ilish Bhapa + Chingri Malaikari + Mutton · adds pasta/continental · 20-22 sections

Rules:
- Target ingredient cost per plate: plate budget MINUS per-plate overhead (server applies overhead
  as ₹3,500 fixed for ≤50 guests OR ₹15,000 fixed for >50 guests, then ÷ by guest count).
    * Example: 200 guests @ ₹700 budget → overhead ≈ 15000/200 = ₹75 → ingredient target ≈ ₹625.
    * Example: 30 guests @ ₹500 budget → overhead ≈ 3500/30 = ₹117 → ingredient target ≈ ₹383.
  Compute for THIS guest count + budget and hit that ingredient number.
- Do NOT exceed the ingredient budget. Prefer FEWER well-made items over stretched cheap ones.
- Portions must be realistic (mutton 150g, fish 120g, rice 200g, paneer 60g, sweets 1-2 pc).
- Bengali crowd-favourites first; Indian classics second.
- For WEDDING non-veg (or 'mix'), the starters MUST be exactly 2 non-veg + 2 veg unless the customer explicitly requested pure-veg.
- Use the market rates provided; do not invent items not in the rate list.
- WEDDING SECTION FLOOR: at all budgets the wedding menu MUST include the mocktail bar, salad bar,
  tea/coffee counter, starters, rice/bread, dal, main course, accompaniments and dessert. Additional
  counters (chaat, chinese, tandoor, ice cream, paan, soup, pasta) get added as budget rises per the
  tier rules above. If a required course is missing, the menu is INCOMPLETE.

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
Course labels to use: "Live Counter · Mocktails", "Live Counter · Salad Bar", "Live Counter · Chaat", "Live Counter · Chinese", "Live Counter · Tandoor", "Live Counter · Pasta", "Live Counter · Ice Cream", "Live Counter · Tea/Coffee", "Welcome Drink", "Soup", "Starter · Non-Veg", "Starter · Veg", "Rice / Bread", "Dal", "Main · Non-Veg", "Main · Veg", "Accompaniment", "Sweet Counter", "Dessert", "Paan Counter".
For weddings: emit rows in this order — (1) All Live Counters at the top (Mocktails first, then Salad Bar, Chaat, Chinese, Tandoor, Pasta, Ice Cream, Tea/Coffee — whichever are in the tier); (2) Welcome Drink; (3) Soup (if applicable); (4) Starters (Non-Veg then Veg); (5) Rice/Bread; (6) Dal; (7) Mains (Non-Veg then Veg); (8) Accompaniments; (9) Sweet Counter; (10) Dessert (plated); (11) Paan Counter (if applicable).
No markdown. Integers only for money."""

        reply = await self.chat(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="You are Bhojon Buddy, a Bengali menu curator. Return only valid JSON.",
            use_tools=False,
            max_tokens=4000,
            temperature=0.6,
            json_mode=True,
        )
        result = json.loads(self._extract_json(reply))
        # Annotate with the tier we picked so the UI can render a chip and
        # so telemetry can measure which tier converts best.
        result["pricingTier"] = tier_slug
        result["pricingTierLabel"] = tier_label
        return result

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
