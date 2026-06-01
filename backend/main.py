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
        await asyncio.wait_for(
            aiosmtplib.send(
                msg,
                hostname="smtp.gmail.com",
                port=465,
                use_tls=True,
                username=gmail_user,
                password=gmail_pass,
                timeout=10,
            ),
            timeout=12,
        )
        return True
    except asyncio.TimeoutError:
        print(f"[EMAIL TIMEOUT] to={to} subject={subject!r}", flush=True)
        return False
    except Exception as e:
        print(f"[EMAIL ERROR] {e}", flush=True)
        return False


def partner_welcome_email(name: str, business: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Welcome to Aayojan</title>
</head>
<body style="margin:0;padding:0;background:#FFF8EF;font-family:'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(232,118,10,0.13)">

  <!-- TOP STRIPE -->
  <tr><td style="height:5px;background:linear-gradient(90deg,#E8760A,#F3C869,#E8760A)"></td></tr>

  <!-- DARK HERO -->
  <tr><td style="background:linear-gradient(160deg,#1C130A 0%,#3d2009 100%);padding:48px 40px 40px;text-align:center">
    <div style="font-size:56px;margin-bottom:4px">🍽️</div>
    <div style="display:inline-block;background:rgba(243,200,105,0.2);border:1px solid rgba(243,200,105,0.5);border-radius:20px;padding:6px 18px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F3C869;margin-bottom:20px">🏅 Founding Partner</div>
    <h1 style="margin:0 0 10px;font-size:30px;font-weight:800;color:#fff;line-height:1.2">Welcome aboard,<br>{name}!</h1>
    <p style="margin:0;color:rgba(255,255,255,0.65);font-size:15px;line-height:1.6"><strong style="color:#F3A84E">{business}</strong> is now part of<br>Aayojan's founding caterer network.</p>
  </td></tr>

  <!-- WARM INTRO -->
  <tr><td style="padding:36px 40px 24px">
    <p style="margin:0 0 16px;font-size:16px;color:#333;line-height:1.7">Hi {name},</p>
    <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.75">You're one of the <strong style="color:#1C130A">very first caterers</strong> in Newtown &amp; Rajarhat to join Aayojan — before we open to the public. The caterers who join now shape what this platform becomes.</p>
    <p style="margin:0;font-size:15px;color:#555;line-height:1.75">Here is how it works and what you get as a Founding Partner:</p>
  </td></tr>

  <!-- HOW IT WORKS -->
  <tr><td style="padding:0 40px 8px">
    <div style="background:#FFF8EF;border-radius:16px;overflow:hidden;border:1px solid #f0e4d0">

      <div style="padding:18px 22px;border-bottom:1px solid #f0e4d0">
        <table cellpadding="0" cellspacing="0" width="100%"><tr>
          <td style="width:36px;font-size:20px;vertical-align:top;padding-top:2px">🎯</td>
          <td style="padding-left:12px">
            <strong style="font-size:14px;color:#1C130A">Customers come to you on WhatsApp</strong><br>
            <span style="font-size:13px;color:#777;line-height:1.5">When a customer posts an event in your area, Aayojan sends you the brief on WhatsApp — event type, guest count, cuisine and budget. You decide whether to quote.</span>
          </td>
        </tr></table>
      </div>

      <div style="padding:18px 22px;border-bottom:1px solid #f0e4d0">
        <table cellpadding="0" cellspacing="0" width="100%"><tr>
          <td style="width:36px;font-size:20px;vertical-align:top;padding-top:2px">💰</td>
          <td style="padding-left:12px">
            <strong style="font-size:14px;color:#1C130A">3% only on successful bookings — nothing else</strong><br>
            <span style="font-size:13px;color:#777;line-height:1.5">No joining fee. No monthly subscription. No hidden charges. Aayojan takes a <strong style="color:#1C130A">3% commission only when you close a booking</strong>. You keep 97%. Zomato and Swiggy take 25–30% — we take 3%.</span>
          </td>
        </tr></table>
      </div>

      <div style="padding:18px 22px;border-bottom:1px solid #f0e4d0">
        <table cellpadding="0" cellspacing="0" width="100%"><tr>
          <td style="width:36px;font-size:20px;vertical-align:top;padding-top:2px">🏅</td>
          <td style="padding-left:12px">
            <strong style="font-size:14px;color:#1C130A">Founding badge — permanently on your profile</strong><br>
            <span style="font-size:13px;color:#777;line-height:1.5">Your profile will carry the Founding Partner badge forever. Less category crowding right now means customers are more likely to notice and trust you before the platform fills up.</span>
          </td>
        </tr></table>
      </div>

      <div style="padding:18px 22px;border-bottom:1px solid #f0e4d0">
        <table cellpadding="0" cellspacing="0" width="100%"><tr>
          <td style="width:36px;font-size:20px;vertical-align:top;padding-top:2px">⚡</td>
          <td style="padding-left:12px">
            <strong style="font-size:14px;color:#1C130A">Early lead priority</strong><br>
            <span style="font-size:13px;color:#777;line-height:1.5">New customer requests are shown to founding partners first, before the platform opens to everyone.</span>
          </td>
        </tr></table>
      </div>

      <div style="padding:18px 22px">
        <table cellpadding="0" cellspacing="0" width="100%"><tr>
          <td style="width:36px;font-size:20px;vertical-align:top;padding-top:2px">🤝</td>
          <td style="padding-left:12px">
            <strong style="font-size:14px;color:#1C130A">Free-forever onboarding support + no lock-in</strong><br>
            <span style="font-size:13px;color:#777;line-height:1.5">Direct access to the Aayojan team on WhatsApp. No contract. Leave anytime. We win only when you win.</span>
          </td>
        </tr></table>
      </div>

    </div>
  </td></tr>

  <!-- PRICING CALLOUT -->
  <tr><td style="padding:24px 40px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1C130A,#3d2009);border-radius:14px">
      <tr><td style="padding:20px 24px;text-align:center">
        <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#F3C869;margin-bottom:6px">Simple pricing</div>
        <div style="font-size:32px;font-weight:900;color:#fff;margin-bottom:4px">₹0 to join &nbsp;·&nbsp; 3% per booking</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.55)">No registration fee &nbsp;·&nbsp; No monthly fee &nbsp;·&nbsp; No contract</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- WHAT HAPPENS NEXT -->
  <tr><td style="padding:0 40px 32px">
    <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#1C130A">What happens next?</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" width="33%" style="padding:0 5px 0 0">
          <div style="background:#FFF8EF;border:1.5px solid #f0e4d0;border-radius:14px;padding:18px 10px;text-align:center">
            <div style="font-size:22px;margin-bottom:8px">✅</div>
            <div style="font-size:12px;font-weight:700;color:#1C130A;margin-bottom:3px">Profile Review</div>
            <div style="font-size:11px;color:#999">Within 24 hours</div>
          </div>
        </td>
        <td align="center" width="33%" style="padding:0 2px">
          <div style="background:#FFF8EF;border:1.5px solid #f0e4d0;border-radius:14px;padding:18px 10px;text-align:center">
            <div style="font-size:22px;margin-bottom:8px">💬</div>
            <div style="font-size:12px;font-weight:700;color:#1C130A;margin-bottom:3px">WhatsApp Intro</div>
            <div style="font-size:11px;color:#999">Team reaches out</div>
          </div>
        </td>
        <td align="center" width="33%" style="padding:0 0 0 5px">
          <div style="background:#FFF8EF;border:1.5px solid #f0e4d0;border-radius:14px;padding:18px 10px;text-align:center">
            <div style="font-size:22px;margin-bottom:8px">🚪</div>
            <div style="font-size:12px;font-weight:700;color:#1C130A;margin-bottom:3px">First Lead</div>
            <div style="font-size:11px;color:#999">Customer finds you</div>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:0 40px 36px;text-align:center">
    <a href="https://aayojan.online" style="display:inline-block;background:linear-gradient(135deg,#E8760A,#C95F08);color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:16px 40px;border-radius:14px;letter-spacing:0.3px">Explore Aayojan →</a>
    <p style="margin:20px 0 6px;font-size:13px;color:#aaa">Any questions? We're easy to reach.</p>
    <a href="https://wa.me/918088434425" style="font-size:13px;color:#E8760A;font-weight:700;text-decoration:none">💬 WhatsApp +91-8088434425</a>
    &nbsp;&nbsp;
    <a href="mailto:aayojan11@gmail.com" style="font-size:13px;color:#E8760A;font-weight:700;text-decoration:none">✉️ aayojan11@gmail.com</a>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#1C130A;padding:24px 40px;text-align:center">
    <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.4)">© 2026 Aayojan · Newtown, Kolkata</p>
    <a href="https://aayojan.online" style="font-size:12px;color:#E8760A;text-decoration:none">aayojan.online</a>
  </td></tr>

</table>
</td></tr>
</table>
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
        print(f"[OTP] Failed to send to {req.phone}, OTP={otp}", flush=True)
    return {"sent": True}


@app.post("/api/otp/verify")
async def otp_verify(req: OTPVerifyRequest):
    """Verify OTP. Returns {valid: bool}."""
    valid = otp_store.verify(req.phone, req.otp)
    return {"valid": valid}


class EmailOTPRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if "@" not in v or "." not in v:
            raise ValueError("invalid email")
        return v.strip().lower()


class EmailOTPVerifyRequest(BaseModel):
    email: str
    otp: str


def otp_email_html(otp: str) -> str:
    digits = list(otp)
    digit_boxes = "".join(
        f'<span style="display:inline-block;width:48px;height:60px;line-height:60px;'
        f'background:#fff;border:2px solid #E8760A;border-radius:12px;'
        f'font-size:32px;font-weight:900;color:#E8760A;text-align:center;'
        f'margin:0 4px;font-family:monospace">{d}</span>'
        for d in digits
    )
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verify your Aayojan account</title>
</head>
<body style="margin:0;padding:0;background:#FFF8EF;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(232,118,10,0.12)">

        <!-- TOP STRIPE -->
        <tr><td style="height:5px;background:linear-gradient(90deg,#E8760A,#F3A84E,#E8760A)"></td></tr>

        <!-- HERO -->
        <tr><td style="background:linear-gradient(160deg,#1C130A 0%,#3d2009 100%);padding:40px 40px 32px;text-align:center">
          <div style="font-size:48px;margin-bottom:12px">🍽️</div>
          <div style="display:inline-block;background:rgba(232,118,10,0.25);border:1px solid rgba(232,118,10,0.5);border-radius:20px;padding:5px 14px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#F3A84E;margin-bottom:16px">Partner Verification</div>
          <h1 style="margin:0;font-size:26px;font-weight:800;color:#fff;line-height:1.2">One step away from<br>joining Aayojan</h1>
          <p style="margin:10px 0 0;color:rgba(255,255,255,0.65);font-size:14px">Use this code to verify your email address</p>
        </td></tr>

        <!-- OTP BLOCK -->
        <tr><td style="padding:40px 40px 32px;text-align:center;background:#fff">
          <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6">Enter this code on the Aayojan partner registration page:</p>

          <!-- digit boxes -->
          <div style="margin:0 0 8px">{digit_boxes}</div>

          <!-- expiry bar -->
          <div style="margin:20px auto 0;max-width:320px;background:#f5f5f5;border-radius:20px;height:6px;overflow:hidden">
            <div style="width:100%;height:100%;background:linear-gradient(90deg,#E8760A,#F3A84E);border-radius:20px"></div>
          </div>
          <p style="margin:8px 0 0;font-size:12px;color:#bbb">Expires in 5 minutes &nbsp;·&nbsp; One-time use only</p>

          <!-- divider -->
          <div style="border-top:1px solid #f0f0f0;margin:32px 0"></div>

          <p style="margin:0;font-size:13px;color:#888;line-height:1.6">
            You're registering <strong style="color:#111">your catering business</strong> on Aayojan as a Founding Partner.<br>
            If this wasn't you, simply ignore this email.
          </p>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background:#FFF8EF;padding:24px 40px;text-align:center;border-top:1px solid #f0e8d8">
          <p style="margin:0 0 6px;font-size:13px;color:#555">Questions? We're on WhatsApp</p>
          <a href="https://wa.me/918088434425" style="color:#E8760A;font-weight:700;font-size:13px;text-decoration:none">+91-8088434425</a>
          <p style="margin:16px 0 0;font-size:11px;color:#bbb">© 2026 Aayojan &nbsp;·&nbsp; Newtown, Kolkata &nbsp;·&nbsp; <a href="https://aayojan.online" style="color:#bbb">aayojan.online</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


@app.post("/api/otp/email/send")
async def otp_email_send(req: EmailOTPRequest):
    """Generate OTP and fire-and-forget email send. Returns immediately."""
    otp = otp_store.generate(req.email)
    asyncio.create_task(send_email(
        to=req.email,
        subject=f"{otp} is your Aayojan verification code",
        html=otp_email_html(otp),
    ))
    return {"sent": True}


@app.post("/api/otp/email/verify")
async def otp_email_verify(req: EmailOTPVerifyRequest):
    """Verify email OTP. Returns {valid: bool}."""
    valid = otp_store.verify(req.email.strip().lower(), req.otp.strip())
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
