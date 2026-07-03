import { useEffect, useState } from "react";

// Each entry = one editorial feature.
// Order = the order they cycle. Tweak as new partners come in.
const FEATURED = [
  {
    issue: "01",
    slug: "munias-kitchen",
    chef: "Karabi Dey",
    business: "Munia's Kitchen",
    headlinePrefix: "Karabi Dey is cooking",
    headlineAccent: "the food",
    headlineRest: "other caterers wish they had made.",
    quote: "The Doi Ilish carries a grandmother's monsoon mustard. The Galouti, an impossible softness. The Crab Wonton — gone before the second tray arrives.",
    dishes: ["Doi Ilish", "Mutton Galouti", "Mutton Biryani", "Crab Wonton", "Kochu Pata Chingri"],
    href: "/partners/munias-kitchen.html",
    fssai: { status: "applied" },
    // Logo is text-rendered with outline serif
    logoType: "text",
    logoLines: ["MUNIA'S", "KITCHEN"],
    logoScript: "catering",
    logoBg: "#F29E1F",
  },
  {
    issue: "02",
    slug: "curry-katha",
    chef: "Sayan Banerjee",
    business: "Curry-কথা",
    headlinePrefix: "Sayan Banerjee believes",
    headlineAccent: "Bengali catering",
    headlineRest: "should reach every family.",
    quote: "Chicken Paratha, layered patient. Vetki Fish Kachori, Bengal staples reinvented. The kitchen that proves authentic doesn't have to mean expensive.",
    dishes: ["Chicken Paratha", "Vetki Fish Kachori"],
    href: "/partners/curry-katha.html",
    fssai: { status: "verified", number: "22825211000224" },
    // Real image logo
    logoType: "image",
    logoImg: "/partners/curry-katha/logo.png",
    logoAlt: "Curry-কথা — Where every meal feels like home",
    logoBg: "#3a3a3a",
  },
  {
    issue: "03",
    slug: "magnolia-catering",
    chef: "Sandip Sarkar",
    business: "Magnolia Catering Service",
    headlinePrefix: "Sandip Sarkar runs",
    headlineAccent: "the kitchen",
    headlineRest: "that handles any brief.",
    quote: "Bengali for the elders. Chinese for the kids. Kebabs on a live counter. Magnolia delivers all four cuisines without breaking quality — at any scale.",
    dishes: ["Diamond Fish Fry", "Slow Mutton", "Live Kebab Counter"],
    href: "/partners/magnolia-catering.html",
    fssai: { status: "applied" },
    logoType: "text",
    logoLines: ["MAGNOLIA"],
    logoScript: "catering",
    logoBg: "#F29E1F",
  },
  {
    issue: "04",
    slug: "56-bhog-caterer",
    chef: "Krishanu Ghosh",
    business: "56 Bhog Caterer",
    headlinePrefix: "Krishanu Ghosh's kitchen",
    headlineAccent: "scales from 50 to 5,000",
    headlineRest: "— without losing the bhog standard.",
    quote: "Fifty-six dishes offered to Krishna at Govardhan — that's the lineage. Krishanu's team brings that abundance to a 50-guest birthday or a 5,000-guest wedding. Same standard, scaled to fit.",
    dishes: ["Multi-cuisine Spreads", "Bhog-style Feast", "Corporate Tiffin"],
    href: "/partners/56-bhog-caterer.html",
    fssai: { status: "verified", number: "12826019000113" },
    logoType: "text",
    logoLines: ["56 BHOG"],
    logoScript: "৫৬ ভোগ",
    logoBg: "#0F2839",
  },
  {
    issue: "05",
    slug: "tulikas-catering",
    chef: "Tamasree Das",
    business: "Tulika's Catering Service",
    headlinePrefix: "Tamasree Das runs",
    headlineAccent: "the Bengali kitchen",
    headlineRest: "that everyone sits down to.",
    quote: "Bengali at the heart — doi maach, kosha mangsho, mochar ghonto. Mughlai for the bold eaters. Chinese for the younger crowd. Tulika's plans the spread that connects every generation.",
    dishes: ["Doi Maach", "Kosha Mangsho", "Galouti", "Hakka Noodles"],
    href: "/partners/tulikas-catering.html",
    fssai: { status: "applied" },
    logoType: "text",
    logoLines: ["TULIKA'S"],
    logoScript: "তুলিকা'স",
    logoBg: "#B8456A",
  },
  {
    issue: "06",
    slug: "royal-chef",
    business: "Royal Chef Caterer & Events",
    headlinePrefix: "Newtown's",
    headlineAccent: "4.9★ multi-cuisine caterer",
    headlineRest: "— now an Aayojan Verified Partner.",
    quote: "147 Google reviews and a 4.9 rating. Royal Chef has catered Newtown's weddings, parties and corporate events for years — multi-cuisine, dependable, and now matched to you through Aayojan.",
    dishes: ["Multi-cuisine spreads", "Weddings · Parties", "Corporate events"],
    href: "/partners/royal-chef.html",
    fssai: { status: "applied" },
    logoType: "text",
    logoLines: ["ROYAL", "CHEF"],
    logoScript: "Caterer & Events",
    logoBg: "#C0392B",
  },
  {
    issue: "07",
    slug: "mitras-catering",
    chef: "Arittra Mitra",
    business: "Mitra's Catering Service",
    headlinePrefix: "Arittra Mitra plates",
    headlineAccent: "Bengal's seafood",
    headlineRest: "the way a Kolkata table demands.",
    quote: "Bhetki Paturi steamed in banana leaf, Prawn Malai Curry rich with coconut, Mutton Kosha slow-cooked dark — and Chicken Maharani for the crowd. Mitra's Catering Service brings a proper Bengali non-veg feast, now matched to you through Aayojan.",
    dishes: ["Bhetki Paturi · Prawn Malai Curry", "Fish Fry · Fish Amritsari", "Mutton Kosha · Chicken Maharani"],
    href: "/partners/mitras-catering.html",
    fssai: { status: "verified", number: "22821013002888" },
    logoType: "text",
    logoLines: ["MITRA'S", "CATERING"],
    logoScript: "catering service",
    logoBg: "#7A1F2B",
  },
  {
    issue: "08",
    slug: "debi-events-caterers",
    chef: "Madhumita Dalui",
    business: "DEBI Events & Caterers",
    headlinePrefix: "Madhumita Dalui caters",
    headlineAccent: "three cuisines",
    headlineRest: "under one trusted kitchen.",
    quote: "Mughlai biryani and chaap for the feast, Bengali classics for the elders, Indo-Chinese for the younger crowd — DEBI Events & Caterers plates all three at scale, built for 150–200+ guest celebrations across Kolkata.",
    dishes: ["Mughlai · Biryani · Chaap", "Bengali classics", "Indo-Chinese · 150–200+ guests"],
    href: "/partners/debi-events-caterers.html",
    fssai: { status: "applied" },
    logoType: "image",
    logoImg: "/partners/debi-events-caterers/logo.png",
    logoAlt: "DEBI Events & Caterers — Mughlai, Bengali & Chinese catering",
    logoBg: "#FDF1E7",
  },
  {
    issue: "09",
    slug: "krivaans-hensel",
    chef: "Sanat Ghosh",
    business: "Krivaans Hensel & Caterers",
    headlinePrefix: "Sanat Ghosh caters",
    headlineAccent: "Bengali feasts",
    headlineRest: "for every occasion, big or small.",
    quote: "অনুষ্ঠান আপনার, খাবারের স্বাদ ও সঠিক পরিষেবা আমাদের দায়িত্ব — from Rajpur–Sonarpur, Krivaans Hensel & Caterers plates weddings, Annaprashan, birthdays, Puja and corporate events across Kolkata. FSSAI verified and now matched to you through Aayojan.",
    dishes: ["Weddings · Annaprashan", "Birthdays · Corporate", "Puja & social events"],
    href: "/partners/krivaans-hensel.html",
    fssai: { status: "verified", number: "22826176000296" },
    logoType: "image",
    logoImg: "/partners/krivaans-hensel/logo.jpg",
    logoAlt: "Krivaans Hensel & Caterers — Bengali & multi-cuisine catering, Rajpur–Sonarpur",
    logoBg: "#E7D6AE",
  },
];

const HOLD_MS = 6500;
const FADE_MS = 500;

export default function FeaturedSpotlight() {
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIdx(i => (i + 1) % FEATURED.length);
        setFading(false);
      }, FADE_MS);
    }, HOLD_MS);
    return () => clearInterval(t);
  }, []);

  const goTo = (i) => {
    if (i === idx) return;
    setFading(true);
    setTimeout(() => { setIdx(i); setFading(false); }, FADE_MS);
  };

  const f = FEATURED[idx];

  return (
    <div style={{ padding: "44px 14px", background: "#0F0A05", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 80% 50%, rgba(243,200,105,0.10) 0%, transparent 55%)", pointerEvents: "none" }}></div>

      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Masthead */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontSize: 11, color: "#F3C869", letterSpacing: "0.18em", textTransform: "uppercase" }}>The Aayojan Edit · {f.issue}</div>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(243,200,105,0.3), transparent)" }}></div>
          <div style={{ fontSize: 10, color: "rgba(255,248,239,0.4)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>{idx + 1} / {FEATURED.length}</div>
        </div>

        {/* Editorial card — fades on transition */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: 36,
          alignItems: "center",
          opacity: fading ? 0 : 1,
          transform: fading ? "translateY(8px)" : "translateY(0)",
          transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
        }} className="edit-grid">

          {/* LEFT — copy */}
          <div>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(26px,4.4vw,46px)", fontWeight: 900, color: "#FFF8EF", margin: "0 0 14px", lineHeight: 1.02, letterSpacing: "-0.02em" }}>
              {f.headlinePrefix} <span style={{ fontStyle: "italic", fontWeight: 600, color: "#F3C869" }}>{f.headlineAccent}</span> {f.headlineRest}
            </h2>

            <p style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic", fontSize: "clamp(14px,1.7vw,17px)", lineHeight: 1.55, color: "rgba(255,248,239,0.82)", margin: "0 0 16px", fontWeight: 500, borderLeft: "2px solid rgba(243,200,105,0.5)", paddingLeft: 14 }}>
              {f.quote}
            </p>

            <div style={{ fontSize: 12, color: "rgba(255,248,239,0.6)", lineHeight: 1.7, marginBottom: 14 }}>
              {f.dishes.map((d, i) => (
                <span key={i}>
                  <span style={{ fontFamily: "'Playfair Display',serif", fontStyle: "italic", color: "#F3C869" }}>{d}</span>
                  {i < f.dishes.length - 1 && <span style={{ color: "rgba(255,255,255,0.3)", margin: "0 6px" }}>·</span>}
                </span>
              ))}
            </div>

            {/* FSSAI trust badge */}
            {f.fssai && (
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: f.fssai.status === "verified" ? "rgba(35, 107, 67, 0.15)" : "rgba(243, 200, 105, 0.12)",
                border: `1px solid ${f.fssai.status === "verified" ? "rgba(35, 107, 67, 0.4)" : "rgba(243, 200, 105, 0.35)"}`,
                color: f.fssai.status === "verified" ? "#86efac" : "#F3C869",
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 16,
                fontFamily: "'DM Sans',sans-serif",
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: f.fssai.status === "verified" ? "#86efac" : "#F3C869",
                  boxShadow: `0 0 8px ${f.fssai.status === "verified" ? "#86efac" : "#F3C869"}`,
                }}/>
                {f.fssai.status === "verified" ? (
                  <>FSSAI Verified · <span style={{ fontFamily: "monospace", letterSpacing: 0, opacity: 0.85 }}>{f.fssai.number}</span></>
                ) : (
                  <>✓ Aayojan Verified Partner</>
                )}
              </div>
            )}

            <a href={f.href} style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#F3C869", fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, fontStyle: "italic", textDecoration: "none", borderBottom: "1px solid rgba(243,200,105,0.4)", paddingBottom: 3, transition: "color 0.2s, border-color 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.color = "#FFF8EF"; e.currentTarget.style.borderColor = "#FFF8EF"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#F3C869"; e.currentTarget.style.borderColor = "rgba(243,200,105,0.4)"; }}>
              Read {f.business}'s profile <span>→</span>
            </a>
          </div>

          {/* RIGHT — logo card */}
          <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <a href={f.href} style={{
              display: "block",
              width: "min(240px, 80%)",
              aspectRatio: "1/1",
              background: f.logoBg,
              borderRadius: 6,
              padding: f.logoType === "image" ? 0 : 18,
              boxShadow: "0 20px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(243,200,105,0.2)",
              transform: "rotate(-2deg)",
              transition: "transform 0.4s ease",
              textDecoration: "none",
              position: "relative",
              overflow: "hidden",
            }}
              onMouseEnter={e => e.currentTarget.style.transform = "rotate(0deg) scale(1.03)"}
              onMouseLeave={e => e.currentTarget.style.transform = "rotate(-2deg)"}>

              {f.logoType === "image" ? (
                <img src={f.logoImg} alt={f.logoAlt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", border: "1.5px solid #FFF8EF", borderRadius: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 14, position: "relative" }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 400, fontSize: "clamp(16px,2.6vw,24px)", letterSpacing: "0.08em", lineHeight: 1.1, textAlign: "center", WebkitTextStroke: "0.6px #FFF8EF", color: "transparent" }}>
                    {f.logoLines.map((l, i) => (<span key={i}>{l}{i < f.logoLines.length - 1 && <br />}</span>))}
                  </div>
                  {f.logoScript && (
                    <div style={{ position: "absolute", right: "10%", bottom: "-6%", fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic", fontWeight: 500, fontSize: "clamp(13px,1.8vw,18px)", color: "#FFF8EF", transform: "rotate(-3deg)" }}>{f.logoScript}</div>
                  )}
                </div>
              )}

              <div style={{ position: "absolute", top: 8, right: 8, background: "#0F0A05", color: "#F3C869", padding: "3px 8px", borderRadius: 3, fontSize: 8, fontWeight: 700, letterSpacing: "0.14em" }}>FEATURED</div>
            </a>
          </div>
        </div>

        {/* Dot navigation */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 28 }}>
          {FEATURED.map((p, i) => (
            <button key={i} onClick={() => goTo(i)} aria-label={`Show ${p.business}`} style={{
              width: i === idx ? 24 : 8,
              height: 8,
              borderRadius: 99,
              background: i === idx ? "#F3C869" : "rgba(243,200,105,0.3)",
              border: "none",
              cursor: "pointer",
              padding: 0,
              transition: "width 0.4s ease, background 0.2s ease",
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
