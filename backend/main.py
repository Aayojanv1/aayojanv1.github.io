"""
AayojanAI Backend — FastAPI + Gemini SDK
Serves as the AI brain for both the React landing page and Flutter app.
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .gemini_client import GeminiClient

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Gemini client on startup."""
    api_key = os.getenv("GEMINI_API_KEY", "")
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    if not api_key:
        print("⚠️  GEMINI_API_KEY not set — running in echo mode")
    app.state.gemini = GeminiClient(api_key=api_key, model=model)
    yield


app = FastAPI(
    title="AayojanAI API",
    description="Gemini-powered catering chatbot backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Models ──────────────────────────────────────────────────────────────────


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    system_prompt: Optional[str] = None
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    session_id: Optional[str] = None


class MenuRequest(BaseModel):
    party_type: str
    guest_count: int = 100
    pincode: str = "700156"


class MenuResponse(BaseModel):
    party_type: str
    description: str
    items: list[dict]


class PriceRequest(BaseModel):
    party_type: str
    guest_count: int
    pincode: str
    selected_items: list[dict]


class PriceResponse(BaseModel):
    per_plate_estimate: int
    summary: str
    pricing_reason: str


class CatererRankRequest(BaseModel):
    party_type: str
    guest_count: int
    pincode: str
    per_plate_budget: int
    selected_items: list[str]
    candidates: list[dict]


# ─── Endpoints ───────────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {"status": "ok", "model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash")}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Main conversational endpoint — used by both React and Flutter."""
    gemini: GeminiClient = app.state.gemini
    try:
        messages_dicts = [{"role": m.role, "content": m.content} for m in req.messages]
        reply = await gemini.chat(
            messages=messages_dicts,
            system_prompt=req.system_prompt,
        )
        return ChatResponse(reply=reply, session_id=req.session_id)
    except Exception as e:
        error_msg = str(e)
        print(f"[WARN] Chat error: {error_msg[:200]}", flush=True)
        # Return a friendly fallback instead of 500
        if "quota" in error_msg.lower() or "429" in error_msg or "resource" in error_msg.lower():
            fallback = "I'm getting a lot of requests right now! The AI quota is temporarily exhausted (free tier: 20 requests/day). Please try again in a few minutes or tomorrow. Meanwhile, you can browse caterers using the service cards below!"
        else:
            fallback = f"Something went wrong connecting to the AI. Please try again. (Error: {error_msg[:100]})"
        return ChatResponse(reply=fallback, session_id=req.session_id)


@app.post("/api/menu/generate", response_model=MenuResponse)
async def generate_menu(req: MenuRequest):
    """Generate a curated menu for a party type."""
    gemini: GeminiClient = app.state.gemini
    try:
        result = await gemini.generate_menu(
            party_type=req.party_type,
            guest_count=req.guest_count,
            pincode=req.pincode,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/price/estimate", response_model=PriceResponse)
async def estimate_price(req: PriceRequest):
    """Estimate fair per-plate pricing for selected menu."""
    gemini: GeminiClient = app.state.gemini
    try:
        result = await gemini.estimate_price(
            party_type=req.party_type,
            guest_count=req.guest_count,
            pincode=req.pincode,
            selected_items=req.selected_items,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/caterers/rank")
async def rank_caterers(req: CatererRankRequest):
    """Rank caterers using AI based on party context."""
    gemini: GeminiClient = app.state.gemini
    try:
        result = await gemini.rank_caterers(
            party_type=req.party_type,
            guest_count=req.guest_count,
            pincode=req.pincode,
            per_plate_budget=req.per_plate_budget,
            selected_items=req.selected_items,
            candidates=req.candidates,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
