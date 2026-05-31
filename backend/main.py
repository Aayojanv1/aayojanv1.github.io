"""
AayojanAI Backend — FastAPI + Gemini SDK
Serves as the AI brain for both the React landing page and Flutter app.
"""

import os
import time
import asyncio
import random
import string
from collections import defaultdict
from contextlib import asynccontextmanager
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import aiosmtplib
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator

from gemini_client import GeminiClient

load_dotenv()


# ─── Rate Limiter ─────────────────────────────────────────────────────────────
class RateLimiter:
    """Simple in-memory rate limiter per IP."""
    def __init__(self, max_requests: int = 30, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, ip: str) -> bool:
        now = time.time()
        # Clean old entries
        self.requests[ip] = [t for t in self.requests[ip] if now - t < self.window]
        if len(self.requests[ip]) >= self.max_requests:
            return False
        self.requests[ip].append(now)
        return True

rate_limiter = RateLimiter(max_requests=30, window_seconds=60)
chat_limiter = RateLimiter(max_requests=10, window_seconds=60)  # Stricter for AI endpoints


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

# CORS — restricted to known origins only
origins = os.getenv("CORS_ORIGINS", "https://aayojan.online,https://www.aayojan.online,https://aayojanv1.github.io").split(",")
if os.getenv("ENV", "production") == "development":
    origins.append("http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


# ─── Security Middleware ──────────────────────────────────────────────────────
@app.middleware("http")
async def security_middleware(request: Request, call_next):
    # Rate limiting
    client_ip = request.headers.get("X-Forwarded-For", request.client.host).split(",")[0].strip()
    
    # Stricter limit for AI endpoints
    if request.url.path.startswith("/api/chat") or request.url.path.startswith("/api/menu") or request.url.path.startswith("/api/price"):
        if not chat_limiter.is_allowed(client_ip):
            return JSONResponse(status_code=429, content={"detail": "Too many requests. Please wait a minute."})
    else:
        if not rate_limiter.is_allowed(client_ip):
            return JSONResponse(status_code=429, content={"detail": "Too many requests. Please slow down."})
    
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    return response


# ─── Models ──────────────────────────────────────────────────────────────────


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in ("user", "assistant"):
            raise ValueError("role must be 'user' or 'assistant'")
        return v

    @field_validator("content")
    @classmethod
    def validate_content(cls, v):
        if len(v) > 5000:
            raise ValueError("message too long (max 5000 chars)")
        return v.strip()


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    system_prompt: Optional[str] = None
    session_id: Optional[str] = None

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, v):
        if len(v) > 50:
            raise ValueError("too many messages (max 50)")
        if len(v) == 0:
            raise ValueError("at least one message required")
        return v


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


# ─── OTP Store (in-memory, 5-min TTL) ────────────────────────────────────────

OTP_TTL = 300  # seconds

class OTPStore:
    def __init__(self):
        self._store: dict[str, tuple[str, float]] = {}  # phone → (otp, expires_at)

    def generate(self, phone: str) -> str:
        otp = "".join(random.choices(string.digits, k=6))
        self._store[phone] = (otp, time.time() + OTP_TTL)
        return otp

    def verify(self, phone: str, otp: str) -> bool:
        entry = self._store.get(phone)
        if not entry:
            return False
        stored_otp, expires_at = entry
        if time.time() > expires_at:
            del self._store[phone]
            return False
        if stored_otp != otp:
            return False
        del self._store[phone]  # one-time use
        return True

otp_store = OTPStore()


# ─── AiSensy WhatsApp Sender ──────────────────────────────────────────────────

async def send_whatsapp_aisensy(phone: str, campaign: str, params: list[str], name: str = "") -> bool:
    """Send a WhatsApp template message via AiSensy."""
    api_key = os.getenv("AISENSY_API_KEY", "")
    if not api_key or not campaign:
        print(f"⚠️  AiSensy not configured — skipping WhatsApp to {phone}")
        return False

    # Normalise to 91XXXXXXXXXX
    phone_clean = phone.replace("+", "").replace(" ", "").replace("-", "")
    if not phone_clean.startswith("91"):
        phone_clean = "91" + phone_clean

    payload = {
        "apiKey": api_key,
        "campaignName": campaign,
        "destination": phone_clean,
        "userName": name or phone_clean,
        "templateParams": params,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://backend.aisensy.com/campaign/t1/api/v2",
                json=payload,
            )
            ok = resp.status_code == 200
            if not ok:
                print(f"[AISENSY] {resp.status_code}: {resp.text[:200]}", flush=True)
            return ok
    except Exception as e:
        print(f"[AISENSY ERROR] {e}", flush=True)
        return False


# ─── Partner Welcome Notifications ───────────────────────────────────────────

class OTPSendRequest(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        digits = "".join(c for c in v if c.isdigit())
        if len(digits) < 10:
            raise ValueError("phone number too short")
        return v.strip()


class OTPVerifyRequest(BaseModel):
    phone: str
    otp: str


class PartnerNotifyRequest(BaseModel):
    businessName: str
    contactPerson: str
    whatsapp: str
    email: str
    serviceAreas: list[str] = []
    cuisine: str = ""
    capacity: str = ""
    specialties: str = ""
    fssaiLicense: str = ""


async def send_email(to: str, subject: str, html: str, text: str = "") -> bool:
    """Send email via Gmail SMTP. Returns True on success."""
    gmail_user = os.getenv("GMAIL_USER", "")
    gmail_pass = os.getenv("GMAIL_APP_PASSWORD", "")
    if not gmail_user or not gmail_pass:
        print("⚠️  GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping email")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Aayojan <{gmail_user}>"
    msg["To"] = to
    if text:
        msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=465,
            use_tls=True,
            username=gmail_user,
            password=gmail_pass,
        )
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] {e}", flush=True)
        return False


def partner_welcome_email(name: str, business: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{{margin:0;padding:0;background:#f5f5f5;font-family:'DM Sans',Arial,sans-serif}}
  .wrap{{max-width:580px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}}
  .hero{{background:linear-gradient(135deg,#E8760A,#C95F08);padding:36px 32px;text-align:center;color:#fff}}
  .hero h1{{font-size:28px;font-weight:800;margin:0 0 8px}}
  .hero p{{font-size:15px;opacity:.9;margin:0}}
  .badge{{display:inline-block;background:rgba(255,255,255,.2);border-radius:20px;padding:6px 16px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:16px}}
  .body{{padding:32px}}
  .body p{{color:#444;font-size:15px;line-height:1.7;margin:0 0 16px}}
  .steps{{background:#fff8f0;border-radius:12px;padding:20px 24px;margin:20px 0}}
  .step{{display:flex;gap:14px;margin-bottom:14px;align-items:flex-start}}
  .step:last-child{{margin:0}}
  .step-num{{width:28px;height:28px;border-radius:50%;background:#E8760A;color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px}}
  .step-txt b{{color:#111;font-size:14px}}
  .step-txt span{{color:#666;font-size:13px;display:block;margin-top:2px}}
  .cta{{background:#E8760A;color:#fff;border-radius:12px;padding:14px 24px;display:block;text-align:center;font-weight:700;font-size:15px;text-decoration:none;margin:24px 0}}
  .footer{{background:#f9f9f9;padding:20px 32px;text-align:center;color:#888;font-size:12px;border-top:1px solid #eee}}
  .footer a{{color:#E8760A;text-decoration:none}}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <div class="badge">🏅 Founding Partner</div>
    <h1>Welcome to Aayojan, {name}!</h1>
    <p>You're officially part of our founding caterer network.</p>
  </div>
  <div class="body">
    <p>Hi {name},</p>
    <p>Thank you for registering <strong>{business}</strong> on Aayojan. You're one of the first caterers to join our network in Newtown & Rajarhat — and that matters.</p>
    <p>As a <strong>Founding Partner</strong>, you get:</p>
    <div class="steps">
      <div class="step"><div class="step-num">1</div><div class="step-txt"><b>Verified badge on your profile</b><span>Customers trust verified caterers first.</span></div></div>
      <div class="step"><div class="step-num">2</div><div class="step-txt"><b>Priority in early leads</b><span>Founding partners get first look at new customer requests.</span></div></div>
      <div class="step"><div class="step-num">3</div><div class="step-txt"><b>Zero commission on your first 3 orders</b><span>Build your reputation risk-free.</span></div></div>
      <div class="step"><div class="step-num">4</div><div class="step-txt"><b>Direct WhatsApp support</b><span>We're at +91-8088434425 — reply anytime.</span></div></div>
    </div>
    <p><strong>What happens next?</strong> Our team will review your profile and reach out within 24 hours on WhatsApp. Once approved, you'll start receiving event leads directly on WhatsApp — no app needed.</p>
    <a href="https://aayojan.online" class="cta">Visit Aayojan →</a>
    <p style="font-size:13px;color:#888">Questions? Reply to this email or WhatsApp us at <a href="https://wa.me/918088434425" style="color:#E8760A">+91-8088434425</a></p>
  </div>
  <div class="footer">
    © 2026 Aayojan · Newtown, Kolkata<br>
    <a href="https://aayojan.online">aayojan.online</a>
  </div>
</div>
</body>
</html>"""


def team_alert_email(data: PartnerNotifyRequest) -> tuple[str, str]:
    """Returns (subject, html) for the internal team alert."""
    areas = ", ".join(data.serviceAreas) if data.serviceAreas else "—"
    wa_message = (
        f"Hi {data.contactPerson}! 👋\n\n"
        f"Welcome to Aayojan! 🍽️\n\n"
        f"You're officially a *Founding Partner* — one of the very first caterers in Newtown & Rajarhat to join our network.\n\n"
        f"Here's what happens next:\n"
        f"1️⃣ We'll verify your profile within 24 hrs\n"
        f"2️⃣ When a matching event comes in, we'll send you the details right here on WhatsApp\n"
        f"3️⃣ You reply with your availability & rate — customer picks, you cook 🍛\n\n"
        f"No app needed. No website. Just this WhatsApp.\n\n"
        f"Any questions? Reply anytime.\n\n"
        f"— Gourav\nAayojan 🍽️\naayojan.online"
    )

    subject = f"🍽️ New Partner: {data.businessName} ({data.contactPerson})"
    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body{{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:32px}}
  .card{{background:#fff;border-radius:12px;padding:24px;max-width:560px;margin:0 auto;box-shadow:0 2px 12px rgba(0,0,0,.08)}}
  h2{{color:#E8760A;margin:0 0 16px}}
  table{{width:100%;border-collapse:collapse;margin-bottom:20px}}
  td{{padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px}}
  td:first-child{{color:#888;width:140px;font-weight:600}}
  td:last-child{{color:#111;font-weight:700}}
  .wa-box{{background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:16px;font-size:13px;white-space:pre-wrap;line-height:1.6;color:#111;margin-top:16px}}
  .wa-label{{font-size:11px;font-weight:700;color:#166534;letter-spacing:.5px;margin-bottom:8px}}
  .note{{font-size:12px;color:#888;margin-top:12px}}
</style>
</head>
<body>
<div class="card">
  <h2>🍽️ New Partner Application</h2>
  <table>
    <tr><td>Business</td><td>{data.businessName}</td></tr>
    <tr><td>Contact</td><td>{data.contactPerson}</td></tr>
    <tr><td>WhatsApp</td><td><a href="https://wa.me/{data.whatsapp.replace('+','').replace(' ','')}">{''.join(c for c in data.whatsapp if c.isdigit() or c=='+')}</a></td></tr>
    <tr><td>Email</td><td>{data.email or '—'}</td></tr>
    <tr><td>Cuisine</td><td>{data.cuisine or '—'}</td></tr>
    <tr><td>Capacity</td><td>{data.capacity or '—'}</td></tr>
    <tr><td>Areas</td><td>{areas}</td></tr>
    <tr><td>FSSAI</td><td>{data.fssaiLicense or 'Not provided'}</td></tr>
    <tr><td>Specialties</td><td>{data.specialties or '—'}</td></tr>
  </table>
  <div class="wa-label">📋 COPY-PASTE WHATSAPP WELCOME MESSAGE:</div>
  <div class="wa-box">{wa_message}</div>
  <div class="note">⬆️ Open WhatsApp Business, paste this to {data.whatsapp}, then send. Takes 30 seconds.</div>
</div>
</body>
</html>"""
    return subject, html


@app.post("/api/otp/send")
async def otp_send(req: OTPSendRequest):
    """Generate OTP and send via AiSensy WhatsApp."""
    otp = otp_store.generate(req.phone)
    campaign = os.getenv("AISENSY_CAMPAIGN_OTP", "")
    sent = await send_whatsapp_aisensy(
        phone=req.phone,
        campaign=campaign,
        params=[otp],
        name=req.phone,
    )
    if not sent:
        # Still return success but log — don't expose internal state
        print(f"[OTP] Failed to send to {req.phone}, OTP={otp}", flush=True)
    return {"sent": True}  # always return true to avoid phone enumeration


@app.post("/api/otp/verify")
async def otp_verify(req: OTPVerifyRequest):
    """Verify OTP. Returns {valid: bool}."""
    valid = otp_store.verify(req.phone, req.otp)
    return {"valid": valid}


@app.post("/api/notify-partner")
async def notify_partner(req: PartnerNotifyRequest):
    """
    Send welcome email to partner + internal alert to Aayojan team.
    Called by partners.html after successful Firestore save.
    """
    team_email = os.getenv("TEAM_EMAIL", "gouravchat@gmail.com")

    subject_team, html_team = team_alert_email(req)

    wa_campaign = os.getenv("AISENSY_CAMPAIGN_WELCOME", "")

    results = await asyncio.gather(
        # 1. Welcome email → partner
        send_email(
            to=req.email,
            subject="Welcome to Aayojan! You're a Founding Partner 🍽️",
            html=partner_welcome_email(req.contactPerson, req.businessName),
        ),
        # 2. Internal alert → team (with WA message to copy-paste)
        send_email(
            to=team_email,
            subject=subject_team,
            html=html_team,
        ),
        # 3. WhatsApp welcome → partner via AiSensy
        send_whatsapp_aisensy(
            phone=req.whatsapp,
            campaign=wa_campaign,
            params=[req.contactPerson, req.businessName],
            name=req.contactPerson,
        ),
        return_exceptions=True,
    )

    partner_email_ok = results[0] is True
    team_email_ok = results[1] is True
    wa_ok = results[2] is True

    print(
        f"[NOTIFY] {req.businessName} — "
        f"partner_email={'✓' if partner_email_ok else '✗'} "
        f"team_alert={'✓' if team_email_ok else '✗'} "
        f"whatsapp={'✓' if wa_ok else '✗'}",
        flush=True,
    )

    return {
        "partner_email_sent": partner_email_ok,
        "team_alert_sent": team_email_ok,
        "whatsapp_sent": wa_ok,
    }
