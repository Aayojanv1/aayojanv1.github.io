import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";
import { getAttribution, getAttributionForEvent } from "./attribution";

const track = (event, params = {}) => {
  if (typeof window.gtag === 'function' && !window['ga-disable-G-VSGREVV7RS']) {
    window.gtag('event', event, params);
  }
};

const SYSTEM_PARTNER = `You are Aayojan's partner advisor, talking to a caterer or kitchen owner who is curious about joining.

Facts about Aayojan:
- A catering marketplace for Newtown, Rajarhat, and Salt Lake (Kolkata)
- ₹0 to join. 3% commission only on successful bookings (vs up to 30% on food partners)
- Verified event leads delivered on WhatsApp — no app to learn
- Founding partners get a featured brand page (Munia's Kitchen is the first)

Style:
- Keep each reply to 2-3 short sentences. Warm, conversational, never salesy.
- Ask about their cuisine specialty and service area early.
- After 2-3 exchanges, ask: "I'd love our team to call you. What's your WhatsApp number?" — then wait.
- Do NOT invent numbers or promise specific lead volumes.`;

const SYSTEM_CUSTOMER = `You are Aayojan's catering concierge. Sharp, warm, slightly hyped. NOT corporate, NOT bland.

About Aayojan:
- A catering marketplace for Newtown, Rajarhat, Salt Lake (Kolkata)
- Hand-picked caterers, quotes on WhatsApp within hours
- Cuisines: Bengali, Mughlai, North Indian, South Indian, Chinese, Italian, Continental, and more

Voice — critical. Adopt this energy:
- BOLD, conversational, alive. Like a friend who knows their food.
- Short and punchy. ONE sentence per reply when possible, never more than two.
- Make the user EXCITED about their event. Hype the food. Tease the experience.
- Use food/event language: "we'll plate this", "your guests will remember this", "boring caterers need not apply"
- Sprinkle relevant emojis — 1 or 2 max per reply (🍛 🎉 🔥 ✨ 🥂). Never look corporate.
- One question per reply. Never stack two.
- Reference dishes by name when it lands ("Hilsa season too — Doi Ilish for the elders?")

What to gather (in this order, no questionnaire feel):
event type → date → guest count → cuisine vibe → area → budget per plate

Then close hard: "Done. Drop your WhatsApp — our team will reach out within 24 hours during this pre-launch phase to route your event. 🔥" Then stop and wait.

NEVER: quote real prices, promise specific caterers, invent statistics.`;

export default function AayojanChatBot() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(null);
  const [phase, setPhase] = useState('greet');  // greet | chat | capture | done
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  // Auto-open shortly after landing — slight delay lets the page settle first
  useEffect(() => {
    const t = setTimeout(() => {
      setOpen(true);
      track('chatbot_opened', { trigger: 'auto', ...getAttributionForEvent() });
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, phase]);

  // Lock body scroll on mobile when open
  useEffect(() => {
    if (open && isMobile) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  const openBot = () => {
    setOpen(true);
    if (messages.length === 0) {
      track('chatbot_opened', { trigger: 'fab', ...getAttributionForEvent() });
    }
  };

  const pickMode = (m) => {
    setMode(m);
    track('chatbot_mode_selected', { mode: m, ...getAttributionForEvent() });
    if (m === 'partner') {
      // Partner flow: skip AI conversation, go straight to capture
      setMessages([{
        role: 'assistant',
        text: "🔥 Let's get you on the founding list. Drop your name and number — our team will WhatsApp you in a few hours. Real conversation, no sales pitch."
      }]);
      setPhase('capture');
    } else {
      // Customer flow: AI conversation to gather event details
      setPhase('chat');
      setMessages([{
        role: 'assistant',
        text: "Hey! 🎉 Tell me — what are we celebrating?"
      }]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMsgs = [...messages, { role: 'user', text }];
    setMessages(newMsgs);
    setLoading(true);

    try {
      const recent = newMsgs.slice(-8);
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: recent.map(m => ({ role: m.role, content: m.text })),
          system_prompt: mode === 'partner' ? SYSTEM_PARTNER : SYSTEM_CUSTOMER,
        }),
      });
      const data = await res.json();
      const reply = data.reply || "Sorry, something went wrong. Could you try again?";
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);

      // If AI asked for WhatsApp, prompt the capture form
      if (/whatsapp number|share your whatsapp|drop your whatsapp/i.test(reply)) {
        setTimeout(() => setPhase('capture'), 600);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: '⚠️ Connection hiccup. Try again in a moment, or WhatsApp us directly at +91 80884 34425.' }]);
    }
    setLoading(false);
  };

  const saveLead = async () => {
    if (!whatsapp.trim() || whatsapp.replace(/\D/g, '').length < 10) {
      alert('Please share a valid 10-digit WhatsApp number.');
      return;
    }
    setSaving(true);
    const transcript = messages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n');
    const data = {
      contactPerson: name.trim() || '(name pending)',
      whatsapp: whatsapp.trim(),
      businessName: mode === 'partner' ? '(via AI chatbot — partner)' : '(via AI chatbot — customer)',
      email: '',
      serviceAreas: [],
      cuisines: [],
      cuisine: '',
      capacity: '',
      currentMonthlyOrders: '',
      avgOrderValue: '',
      specialties: '',
      experience: '',
      fssaiLicense: '',
      chatTranscript: transcript,
      leadType: mode,
      status: mode === 'partner' ? 'quick_lead' : 'customer_enquiry',
      source: 'landing_ai_chatbot',
      foundingProgram: mode === 'partner',
      submittedAt: new Date().toISOString(),
      ...getAttribution(),
    };

    try {
      await addDoc(collection(db, 'partnerApplications'), data);
      // Fire-and-forget team alert
      fetch(`${API_URL}/api/notify-partner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {});
      track('chatbot_lead_captured', { mode, has_name: !!name.trim(), ...getAttributionForEvent() });
      setPhase('done');
    } catch (e) {
      alert('Could not save right now. Please WhatsApp us at +91-8088434425.');
    }
    setSaving(false);
  };

  const reset = () => {
    setMode(null); setPhase('greet'); setMessages([]); setInput(""); setName(""); setWhatsapp("");
  };

  // === STYLES ===
  const COLOR = {
    saffron: '#E8760A', saffronDeep: '#C95F08', gold: '#F3C869',
    dark: '#0F0A05', cream: '#FFF8EF', brown: '#513117', muted: '#7B634E',
  };

  const fabStyle = {
    position: 'fixed', bottom: 24, left: 24,
    width: 56, height: 56, borderRadius: '50%',
    background: `linear-gradient(135deg, ${COLOR.saffron}, ${COLOR.saffronDeep})`,
    display: open ? 'none' : 'flex',
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(232,118,10,0.42)',
    cursor: 'pointer', zIndex: 200, border: 'none',
    transition: 'transform 0.2s',
  };

  const panelStyle = isMobile
    ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100%', maxWidth: '100vw', background: COLOR.cream, zIndex: 300, display: 'flex', flexDirection: 'column', animation: 'aayojan-slide-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) both', colorScheme: 'light', overflow: 'hidden', boxSizing: 'border-box' }
    : { position: 'fixed', bottom: 24, left: 24, width: 380, height: 580, background: COLOR.cream, zIndex: 300, borderRadius: 22, boxShadow: '0 30px 60px rgba(0,0,0,0.32), 0 0 0 1px rgba(81,49,23,0.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'aayojan-slide-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both', transformOrigin: 'bottom left', colorScheme: 'light', boxSizing: 'border-box' };

  return (
    <>
      {/* FAB */}
      <button aria-label="Open Aayojan chat" onClick={openBot} style={fabStyle}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
        <span style={{ fontSize: 26 }}>👨‍🍳</span>
        <span style={{ position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: '#236B43', border: '2px solid #FFF8EF' }}></span>
      </button>

      {/* Panel */}
      {open && (
        <div className="aayojan-chat-panel" style={panelStyle}>
          {/* Header — vivid saffron */}
          <div style={{ padding: '16px 18px', background: `linear-gradient(135deg, ${COLOR.saffron} 0%, ${COLOR.saffronDeep} 100%)`, color: 'white', display: 'flex', alignItems: 'center', gap: 12, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-50%', right: '-20%', width: '70%', height: '200%', background: `radial-gradient(ellipse, rgba(243,200,105,0.4) 0%, transparent 60%)`, pointerEvents: 'none' }}></div>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', fontSize: 22, position: 'relative', zIndex: 1, border: '2px solid rgba(255,255,255,0.5)' }}>👨‍🍳</div>
            <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>Aayojan Concierge</div>
              <div style={{ fontSize: 11, opacity: 0.95, marginTop: 2 }}>
                <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#86efac', marginRight: 5, boxShadow: '0 0 0 2px rgba(134,239,172,0.4)' }}></span>
                Live · Replies in seconds
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, position: 'relative', zIndex: 1 }}>
              <button aria-label="Minimize" onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.16)', border: 'none', color: 'white', fontSize: 18, lineHeight: 1, cursor: 'pointer', width: 30, height: 30, borderRadius: 8, fontWeight: 700, display: 'grid', placeItems: 'center' }}>—</button>
              <button aria-label="Close" onClick={() => { setOpen(false); reset(); }} style={{ background: 'rgba(255,255,255,0.16)', border: 'none', color: 'white', fontSize: 14, lineHeight: 1, cursor: 'pointer', width: 30, height: 30, borderRadius: 8, fontWeight: 700, display: 'grid', placeItems: 'center' }}>✕</button>
            </div>
          </div>

          {/* Body */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, width: '100%', boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}>

            {/* Phase: greet */}
            {phase === 'greet' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 800, color: COLOR.dark, marginBottom: 6, lineHeight: 1.2 }}>Let's get you fed.</div>
                <div style={{ fontSize: 13, color: COLOR.muted, marginBottom: 22 }}>Two seconds. Pick the lane:</div>

                <button onClick={() => pickMode('customer')} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 16px', background: 'linear-gradient(135deg, #FFFCF5, #FFF0D5)', border: `2px solid ${COLOR.gold}`, borderRadius: 14, marginBottom: 10, cursor: 'pointer', boxShadow: '0 8px 20px rgba(232,118,10,0.12)' }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>🥂</div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, color: COLOR.dark, marginBottom: 2 }}>I'm hosting something epic</div>
                  <div style={{ fontSize: 12, color: COLOR.muted }}>Wedding · party · office bash · quotes on WhatsApp in hours</div>
                </button>

                <button onClick={() => pickMode('partner')} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 16px', background: `linear-gradient(135deg, ${COLOR.saffron}, ${COLOR.saffronDeep})`, color: 'white', border: 'none', borderRadius: 14, cursor: 'pointer', boxShadow: '0 8px 20px rgba(232,118,10,0.32)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: '-30%', right: '-20%', width: '60%', height: '160%', background: 'radial-gradient(ellipse, rgba(243,200,105,0.35) 0%, transparent 60%)', pointerEvents: 'none' }}></div>
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>🔥</div>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 2 }}>I run a kitchen</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>Founding partner spot · ₹0 to join · 8 left</div>
                  </div>
                </button>
              </div>
            )}

            {/* Phase: chat — render messages */}
            {(phase === 'chat' || phase === 'capture') && messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', width: '100%', boxSizing: 'border-box' }}>
                <div style={{
                  maxWidth: '78%',
                  padding: '10px 14px',
                  borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: m.role === 'user' ? COLOR.saffron : 'white',
                  color: m.role === 'user' ? 'white' : COLOR.dark,
                  fontSize: 14, lineHeight: 1.45,
                  border: m.role === 'user' ? 'none' : `1px solid ${COLOR.gold}33`,
                  boxShadow: m.role === 'user' ? '0 4px 12px rgba(232,118,10,0.24)' : '0 1px 3px rgba(76,43,10,0.06)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  boxSizing: 'border-box',
                }}>{m.text}</div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: 'white', border: `1px solid ${COLOR.gold}33`, padding: '10px 14px', borderRadius: '16px 16px 16px 4px', fontSize: 14, color: COLOR.muted }}>
                  <span style={{ animation: 'aayojan-dot 1.4s infinite' }}>●</span>
                  <span style={{ animation: 'aayojan-dot 1.4s 0.2s infinite' }}>●</span>
                  <span style={{ animation: 'aayojan-dot 1.4s 0.4s infinite' }}>●</span>
                </div>
              </div>
            )}

            {/* Phase: capture */}
            {phase === 'capture' && (
              <div style={{ marginTop: 12, padding: 16, background: 'white', borderRadius: 14, border: `2px solid ${COLOR.gold}`, boxShadow: '0 8px 20px rgba(232,118,10,0.16)' }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 800, color: COLOR.dark, marginBottom: 10 }}>🔥 One step away. Drop your WhatsApp.</div>
                <input type="text" placeholder="Your name (optional)" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '11px 13px', border: `1.5px solid ${COLOR.gold}`, borderRadius: 10, fontSize: 14, marginBottom: 10, outline: 'none', boxSizing: 'border-box', background: '#FFFCF5', color: COLOR.dark, colorScheme: 'light' }} />
                <input type="tel" placeholder="WhatsApp number *" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} style={{ width: '100%', padding: '11px 13px', border: `1.5px solid ${COLOR.gold}`, borderRadius: 10, fontSize: 14, marginBottom: 12, outline: 'none', boxSizing: 'border-box', background: '#FFFCF5', color: COLOR.dark, colorScheme: 'light' }} />
                <button onClick={saveLead} disabled={saving} style={{ width: '100%', padding: 13, background: saving ? COLOR.muted : `linear-gradient(135deg, ${COLOR.saffron}, ${COLOR.saffronDeep})`, color: 'white', border: 'none', borderRadius: 11, fontFamily: "'Playfair Display',serif", fontWeight: 800, fontSize: 15, cursor: saving ? 'wait' : 'pointer', boxShadow: '0 10px 22px rgba(232,118,10,0.36)' }}>
                  {saving ? 'Saving...' : '✅ Confirm — call me in 24h'}
                </button>
              </div>
            )}

            {/* Phase: done */}
            {phase === 'done' && (
              <div style={{ textAlign: 'center', padding: '24px 8px' }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 800, color: COLOR.dark, marginBottom: 8 }}>You're in!</div>
                <div style={{ fontSize: 14, color: COLOR.brown, marginBottom: 18, lineHeight: 1.5 }}>{name ? `Thanks ${name.split(' ')[0]}! ` : 'Thanks! '}Look out for a WhatsApp from <strong>+91 80884 34425</strong> within 24 hours.</div>
                <a href={`https://wa.me/918088434425?text=Hi%20Aayojan!%20I%20just%20left%20my%20details%20via%20chat.`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: '#25D366', color: 'white', padding: '12px 22px', borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: 'none', marginBottom: 12 }}>💬 Open WhatsApp now</a>
                <div><button onClick={reset} style={{ background: 'transparent', border: 'none', color: COLOR.saffronDeep, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Start a new chat</button></div>
              </div>
            )}
          </div>

          {/* Input — only in chat phase */}
          {phase === 'chat' && (
            <div style={{ padding: 12, background: 'white', borderTop: `1px solid ${COLOR.gold}33`, display: 'flex', gap: 8 }}>
              <input ref={inputRef} type="text" placeholder="Type your message..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }} disabled={loading}
                style={{ flex: 1, padding: '10px 14px', border: `1px solid ${COLOR.gold}66`, borderRadius: 10, fontSize: 14, outline: 'none', background: COLOR.cream, color: COLOR.dark, colorScheme: 'light' }} />
              <button onClick={send} disabled={loading || !input.trim()} style={{ padding: '0 16px', background: COLOR.saffron, color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', opacity: loading || !input.trim() ? 0.5 : 1 }}>Send</button>
            </div>
          )}

          {/* Footer for capture phase */}
          {phase === 'capture' && (
            <div style={{ padding: 10, background: 'white', borderTop: `1px solid ${COLOR.gold}33`, fontSize: 11, color: COLOR.muted, textAlign: 'center' }}>No spam. No joining fee. Your number stays private.</div>
          )}
        </div>
      )}

      <style>{`
        @keyframes aayojan-dot { 0%, 60%, 100% { opacity: 0.3; } 30% { opacity: 1; } }
        @keyframes aayojan-slide-in {
          0% { opacity: 0; transform: translateY(40px) scale(0.92); }
          60% { opacity: 1; }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes aayojan-slide-up {
          0% { opacity: 0; transform: translateY(100%); }
          100% { opacity: 1; transform: translateY(0); }
        }
        /* Force light theme on chat — wins over browser dark mode */
        .aayojan-chat-panel { color-scheme: light !important; box-sizing: border-box !important; }
        .aayojan-chat-panel * { box-sizing: border-box !important; }
        .aayojan-chat-panel input,
        .aayojan-chat-panel textarea {
          background-color: #FFFCF5 !important;
          color: #1C130A !important;
          -webkit-text-fill-color: #1C130A !important;
          color-scheme: light !important;
          -webkit-appearance: none !important;
          appearance: none !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        .aayojan-chat-panel input::placeholder,
        .aayojan-chat-panel textarea::placeholder {
          color: #A0937B !important;
          opacity: 1 !important;
        }
        .aayojan-chat-panel input:-webkit-autofill,
        .aayojan-chat-panel input:-webkit-autofill:hover,
        .aayojan-chat-panel input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 30px #FFFCF5 inset !important;
          -webkit-text-fill-color: #1C130A !important;
        }
      `}</style>
    </>
  );
}
