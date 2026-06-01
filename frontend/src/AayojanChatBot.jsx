import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

const track = (event, params = {}) => {
  if (typeof window.gtag === 'function' && !window['ga-disable-G-VSGREVV7RS']) {
    window.gtag('event', event, params);
  }
};

const SYSTEM_PARTNER = `You are Aayojan's partner advisor, talking to a caterer or kitchen owner who is curious about joining.

Facts about Aayojan:
- A catering marketplace for Newtown, Rajarhat, and Salt Lake (Kolkata)
- ₹0 to join. 3% commission only on successful bookings (vs 30% on Zomato/Swiggy)
- Verified event leads delivered on WhatsApp — no app to learn
- Founding partners get a featured brand page (Munia's Kitchen is the first)

Style:
- Keep each reply to 2-3 short sentences. Warm, conversational, never salesy.
- Ask about their cuisine specialty and service area early.
- After 2-3 exchanges, ask: "I'd love our team to call you. What's your WhatsApp number?" — then wait.
- Do NOT invent numbers or promise specific lead volumes.`;

const SYSTEM_CUSTOMER = `You are Aayojan's friendly catering concierge, talking to someone planning an event.

Facts about Aayojan:
- A catering marketplace for Newtown, Rajarhat, and Salt Lake (Kolkata)
- Verified caterers send quotes on WhatsApp within hours
- Cuisines: Bengali, Mughlai, North Indian, South Indian, Chinese, Italian, Continental, and more

Style:
- Keep each reply to 2-3 short sentences. Warm, conversational.
- Gather basic event info: date, guest count, cuisine preference, area, budget range.
- After basics are in, ask: "Let me have caterers send you quotes. What's your WhatsApp number?" — then wait.
- Do NOT quote specific prices or promise specific caterers. Don't make up data.`;

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

  // Auto-open once per session, ~3s after landing
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('aayojan_chat_seen') === '1') return;
    const t = setTimeout(() => {
      setOpen(true);
      sessionStorage.setItem('aayojan_chat_seen', '1');
      track('chatbot_opened', { trigger: 'auto' });
    }, 3000);
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
      track('chatbot_opened', { trigger: 'fab' });
    }
  };

  const pickMode = (m) => {
    setMode(m);
    setPhase('chat');
    const opener = m === 'customer'
      ? "Hi! I'm here to help you find the right caterer. What's the occasion you're planning?"
      : "Hi! Tell me a bit about your kitchen — what cuisines do you specialise in?";
    setMessages([{ role: 'assistant', text: opener }]);
    track('chatbot_mode_selected', { mode: m });
    setTimeout(() => inputRef.current?.focus(), 100);
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
    };

    try {
      await addDoc(collection(db, 'partnerApplications'), data);
      // Fire-and-forget team alert
      fetch(`${API_URL}/api/notify-partner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {});
      track('chatbot_lead_captured', { mode, has_name: !!name.trim() });
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
    ? { position: 'fixed', inset: 0, background: COLOR.cream, zIndex: 300, display: 'flex', flexDirection: 'column' }
    : { position: 'fixed', bottom: 24, left: 24, width: 380, height: 580, background: COLOR.cream, zIndex: 300, borderRadius: 22, boxShadow: '0 30px 60px rgba(0,0,0,0.32), 0 0 0 1px rgba(81,49,23,0.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden' };

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
        <div style={panelStyle}>
          {/* Header */}
          <div style={{ padding: '14px 16px', background: COLOR.dark, color: COLOR.cream, display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(243,200,105,0.18)' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg, ${COLOR.gold}, ${COLOR.saffron})`, display: 'grid', placeItems: 'center', fontSize: 18 }}>👨‍🍳</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 800 }}>Aayojan AI Assistant</div>
              <div style={{ fontSize: 11, color: 'rgba(255,248,239,0.6)' }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#22c55e', marginRight: 5 }}></span>
                Usually replies instantly
              </div>
            </div>
            <button aria-label="Close" onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: COLOR.cream, fontSize: 22, cursor: 'pointer', padding: 4, opacity: 0.7 }}>✕</button>
          </div>

          {/* Body */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Phase: greet */}
            {phase === 'greet' && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👋</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 800, color: COLOR.dark, marginBottom: 6, lineHeight: 1.2 }}>Hi! How can I help?</div>
                <div style={{ fontSize: 13, color: COLOR.muted, marginBottom: 22 }}>Choose one to start:</div>

                <button onClick={() => pickMode('customer')} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 16px', background: 'white', border: `1px solid ${COLOR.gold}`, borderRadius: 14, marginBottom: 10, cursor: 'pointer', boxShadow: '0 4px 14px rgba(76,43,10,0.08)' }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>🎉</div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, color: COLOR.dark, marginBottom: 2 }}>I'm planning an event</div>
                  <div style={{ fontSize: 12, color: COLOR.muted }}>Get catering quotes for your party, wedding or office event</div>
                </button>

                <button onClick={() => pickMode('partner')} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 16px', background: COLOR.dark, color: COLOR.cream, border: `1px solid ${COLOR.gold}`, borderRadius: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.18)' }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>👨‍🍳</div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, color: COLOR.cream, marginBottom: 2 }}>I run a kitchen</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,248,239,0.65)' }}>Become a partner caterer · ₹0 to join, 3% commission</div>
                </button>
              </div>
            )}

            {/* Phase: chat — render messages */}
            {(phase === 'chat' || phase === 'capture') && messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '82%',
                  padding: '10px 14px',
                  borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: m.role === 'user' ? COLOR.saffron : 'white',
                  color: m.role === 'user' ? 'white' : COLOR.dark,
                  fontSize: 14, lineHeight: 1.45,
                  border: m.role === 'user' ? 'none' : `1px solid ${COLOR.gold}33`,
                  boxShadow: m.role === 'user' ? '0 4px 12px rgba(232,118,10,0.24)' : '0 1px 3px rgba(76,43,10,0.06)',
                  whiteSpace: 'pre-wrap',
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
              <div style={{ marginTop: 12, padding: 14, background: 'white', borderRadius: 14, border: `1px solid ${COLOR.gold}66` }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 700, color: COLOR.dark, marginBottom: 8 }}>Drop your details — we'll WhatsApp within 24 hours</div>
                <input type="text" placeholder="Your name (optional)" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1px solid ${COLOR.gold}55`, borderRadius: 8, fontSize: 13, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }} />
                <input type="tel" placeholder="WhatsApp number *" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1px solid ${COLOR.gold}55`, borderRadius: 8, fontSize: 13, marginBottom: 10, outline: 'none', boxSizing: 'border-box' }} />
                <button onClick={saveLead} disabled={saving} style={{ width: '100%', padding: 12, background: saving ? COLOR.muted : `linear-gradient(135deg, ${COLOR.gold}, ${COLOR.saffron})`, color: COLOR.dark, border: 'none', borderRadius: 10, fontFamily: "'Playfair Display',serif", fontWeight: 800, fontSize: 14, cursor: saving ? 'wait' : 'pointer' }}>
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
                style={{ flex: 1, padding: '10px 14px', border: `1px solid ${COLOR.gold}66`, borderRadius: 10, fontSize: 14, outline: 'none', background: COLOR.cream }} />
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
      `}</style>
    </>
  );
}
