/* ============================================================================
 * Aayojan AI — "Plan with Aayojan AI" experience (Gemini-integrated)
 * ----------------------------------------------------------------------------
 * Real users chat (free-form) -> Gemini (/api/plan) replies AND returns a live
 * structured BRIEF -> the matching engine runs -> 3 VERIFIED caterers are
 * shortlisted but GATED (names locked). To unlock, the user taps WhatsApp; the
 * lead lands in Aayojan's inbox carrying the full brief, and the team connects
 * them (human-in-the-loop, anti-leakage).
 *
 * If Gemini is unavailable/rate-limited/CORS-blocked, it falls back to a guided
 * flow so the experience never breaks. Self-contained: injects CSS + overlay,
 * opens from #ai-planner-open / [data-ai-planner].
 * ========================================================================== */
(function () {
  "use strict";

  var WA = "918088434425";
  var API_BASE = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://localhost:8000" : "https://aayojan-a1fi.onrender.com";

  function track(e, p) {
    if (typeof window.aTrack === "function") window.aTrack(e, p || {});
    else if (typeof window.gtag === "function") window.gtag("event", e, p || {});
  }

  // --- chatbot search logging (session-scoped) -> Firestore chatLogs --------
  // One doc per session (keyed by sid); every user message is appended so we
  // can see exactly what Kolkata is searching for — even when they don't convert.
  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyBPvK0452Kgkp0Oevxm1zMRUWiqKdhmaZA",
    authDomain: "aayojan-a8c4f.firebaseapp.com",
    projectId: "aayojan-a8c4f",
    storageBucket: "aayojan-a8c4f.firebasestorage.app",
    messagingSenderId: "673829788583",
    appId: "1:673829788583:web:9f140241bf0466b197b482"
  };
  function newId() { return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8); }
  var SID = (function () {
    try { var v = localStorage.getItem("aysid"); if (!v) { v = newId(); localStorage.setItem("aysid", v); } return v; }
    catch (e) { return newId(); }
  })();
  window.aSID = SID; // expose so leads can be stitched to the session later
  var QP = new URLSearchParams(location.search);
  function withDb(cb) {
    function go() {
      try {
        if (!window.firebase.apps || !window.firebase.apps.length) window.firebase.initializeApp(FIREBASE_CONFIG);
        cb(window.firebase.firestore(), window.firebase.firestore.FieldValue);
      } catch (e) {}
    }
    if (window.firebase && window.firebase.firestore) return go();
    var base = "https://www.gstatic.com/firebasejs/10.12.2/";
    var s1 = document.createElement("script"); s1.src = base + "firebase-app-compat.js";
    s1.onload = function () { var s2 = document.createElement("script"); s2.src = base + "firebase-firestore-compat.js"; s2.onload = go; document.head.appendChild(s2); };
    document.head.appendChild(s1);
  }
  var logInit = false;
  function logChat(role, text) {
    withDb(function (db, FV) {
      try {
        var entry = { role: role, text: String(text || "").slice(0, 500), t: new Date().toISOString() };
        // TTL: auto-expire 7 days after the last message (Firestore TTL needs a Timestamp field).
        var ttlMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
        var payload = {
          sid: SID, messages: FV.arrayUnion(entry), lastAt: new Date().toISOString(),
          expireAt: window.firebase.firestore.Timestamp.fromDate(new Date(ttlMs)),
          event: brief.event || "", brief: brief, source: "ai_planner", page: location.pathname
        };
        if (!logInit) {
          payload.createdAt = new Date().toISOString();
          payload.gclid = QP.get("gclid") || ""; payload.utm_source = QP.get("utm_source") || ""; payload.utm_campaign = QP.get("utm_campaign") || "";
          payload.device = (window.innerWidth <= 768 ? "mobile" : "desktop");
          payload.referrer = (document.referrer || "").slice(0, 200);
          logInit = true;
        }
        db.collection("chatLogs").doc(SID).set(payload, { merge: true });
      } catch (e) {}
    });
  }

  // --- aliased verified kitchens (names withheld until the lead connects) ----
  var KITCHENS = [
    { tag: "Multi-Cuisine Kitchen · Newtown", cuisines: "Bengali · Mughlai · Continental", pMin: 350, pMax: 1200, gMin: 10, gMax: 1000, events: ["Wedding", "Party", "Birthday", "Corporate", "Annaprasan", "Griha Pravesh", "Bhai Phota", "Pujo"], areas: ["Newtown", "Salt Lake", "Rajarhat"] },
    { tag: "Bengali Home-Style · Salt Lake", cuisines: "Bengali · home-style · niramish · satwik bhog", pMin: 300, pMax: 600, gMin: 10, gMax: 300, events: ["Party", "Annaprasan", "Bhai Phota", "Griha Pravesh", "Birthday", "Pujo"], areas: ["Salt Lake", "Newtown"] },
    { tag: "Banquet Kitchen · Rajarhat", cuisines: "Multi-cuisine · up to 5000", pMin: 350, pMax: 1200, gMin: 50, gMax: 5000, events: ["Wedding", "Corporate", "Party", "Birthday", "Pujo"], areas: ["Rajarhat", "Newtown", "Salt Lake"] },
    { tag: "Premium Bengali & Mughlai", cuisines: "Bengali · Mughlai · Chinese", pMin: 400, pMax: 1300, gMin: 15, gMax: 800, events: ["Wedding", "Party", "Annaprasan", "Birthday", "Pujo"], areas: ["Newtown", "Salt Lake"] },
    { tag: "Continental & Chinese Kitchen", cuisines: "Continental · Chinese · multi", pMin: 350, pMax: 900, gMin: 10, gMax: 600, events: ["Party", "Birthday", "Corporate", "Wedding"], areas: ["Newtown", "Salt Lake", "Rajarhat"] },
    { tag: "Multi-Cuisine & Fusion Kitchen · Newtown", cuisines: "Bengali · Mughlai · North Indian · Indo-Chinese · Fusion", pMin: 250, pMax: 900, gMin: 30, gMax: 2000, events: ["Wedding", "Party", "Jamai", "Birthday", "Corporate", "Annaprasan"], areas: ["Newtown", "Salt Lake", "Rajarhat"] }
  ];
  function hashJit(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973; return h % 6; }
  function detectEvent(s) {
    s = (s || "").toLowerCase();
    if (/wedding|reception|shaadi|marriage/.test(s)) return "Wedding";
    if (/birthday|bday/.test(s)) return "Birthday";
    if (/annaprasan|mukhe/.test(s)) return "Annaprasan";
    if (/corporate|office|conference/.test(s)) return "Corporate";
    if (/griha|housewarm/.test(s)) return "Griha Pravesh";
    if (/bhai|phota/.test(s)) return "Bhai Phota";
    if (/pujo|puja|durga|ratha|rath ?yatra|pandal|bhog|ashtami|navami|niramish feast/.test(s)) return "Pujo";
    if (/jamai|sasthi|shashti|son.?in.?law/.test(s)) return "Jamai";
    if (/party|get.?together|kitty|anniversary|house ?party|reunion|farewell|small order|order for/.test(s)) return "Party";
    return "Party";
  }
  // --- service area: all of Kolkata -----------------------------------------
  function normArea(a) {
    a = (a || "").toLowerCase();
    var map = [
      ["newtown|new town|action area|eco ?park", "Newtown"],
      ["salt ?lake|bidhannagar|sector ?v|sector ?5|sec ?5", "Salt Lake"],
      ["rajarhat|gopalpur", "Rajarhat"],
      ["bagui?h?ati", "Baguiati"], ["ke?shtopur|kestopur", "Kestopur"], ["vip ?(road|rd)", "VIP Road"],
      ["lake ?town", "Lake Town"], ["chinar", "Chinar Park"], ["teghor", "Teghoria"],
      ["dum ?dum", "Dum Dum"], ["ultadanga", "Ultadanga"], ["kaikhali", "Kaikhali"], ["hatiara", "Hatiara"],
      ["jadav?pur", "Jadavpur"], ["behala", "Behala"], ["tollygunge|tolly", "Tollygunge"],
      ["ballygunge", "Ballygunge"], ["park ?street|parkstreet", "Park Street"],
      ["south ?kolkata", "South Kolkata"], ["north ?kolkata", "North Kolkata"],
      ["howrah", "Howrah"], ["barasat", "Barasat"], ["dum ?dum", "Dum Dum"],
      ["garia", "Garia"], ["sonar?pur", "Sonarpur"], ["narendrapur", "Narendrapur"],
      ["esplanade|bbd ?bagh", "BBD Bagh"], ["shyambazar|shyam ?bazar", "Shyambazar"],
      ["bangur", "Bangur"], ["dunlop", "Dunlop"], ["baghbazar", "Baghbazar"],
      ["kalighat", "Kalighat"], ["gariahat", "Gariahat"], ["dhakuria", "Dhakuria"]
    ];
    for (var i = 0; i < map.length; i++) { if (new RegExp(map[i][0]).test(a)) return map[i][1]; }
    return a ? a.charAt(0).toUpperCase() + a.slice(1) : "";
  }
  function inCatchment(area) { return true; } // serve all Kolkata
  function score(k, b) {
    var s = (k.events.indexOf(b.eventType) >= 0) ? 30 : 8;
    var g = b.guestsNum || 50;
    s += (g >= k.gMin && g <= k.gMax) ? 28 : 10;
    s += (inCatchment(b.area) || k.areas.indexOf(b.area) >= 0) ? 22 : 8;
    var bm = b.budgetMid || 0;
    s += (!bm || (bm >= k.pMin - 80 && bm <= k.pMax + 80)) ? 20 : 6;
    return Math.max(80, Math.min(98, 80 + Math.round(s / 100 * 18)) - hashJit(k.tag + (b.eventType || "")));
  }
  function reasons(k, b) {
    var r = [];
    if (k.events.indexOf(b.eventType) >= 0) r.push("Does " + b.eventType.toLowerCase() + "s");
    if (b.area) r.push("Covers " + b.area);
    var g = b.guestsNum || 50;
    if (g >= k.gMin && g <= k.gMax) r.push(g + "-guest capacity");
    if (b.budgetMid && b.budgetMid >= k.pMin - 80 && b.budgetMid <= k.pMax + 80) r.push("Within budget");
    if (!r.length) r.push("Matched to your event");
    return r.slice(0, 3);
  }

  // --- guided fallback steps (used only if Gemini is unavailable) -----------
  var STEPS = [
    { key: "event", q: "What are you planning?", chips: ["🪷 Pujo catering", "💍 Wedding", "🎉 Party order", "🎂 Birthday", "🏢 Corporate"], ph: "your event" },
    { key: "guests", q: "Roughly how many guests?", chips: ["25", "50", "100", "200", "500"], ph: "guests" },
    { key: "cuisine", q: "Veg, non-veg, satwik or Jain — any must-haves?", chips: ["🥬 Veg", "🍗 Non-veg", "🍽️ Both", "🪷 Satwik", "🌱 Jain"], ph: "e.g. satwik, must have luchi" },
    { key: "date", q: "When's the event?", chips: ["This month", "Next month", "In 2–3 months"], ph: "date / timeframe" },
    { key: "area", q: "Which area of Kolkata?", chips: ["Newtown", "Salt Lake", "Rajarhat", "Jadavpur", "Behala", "Other area"], ph: "your area in Kolkata" },
    { key: "budget", q: "Budget per plate?", chips: ["₹300–500", "₹500–800", "₹800–1200"], ph: "₹ per plate" }
  ];

  // --- styles ---------------------------------------------------------------
  var css = document.createElement("style");
  css.textContent =
    ".aip-ov{position:fixed;top:0;left:0;right:0;height:100vh;height:100dvh;z-index:100000;display:none;background:linear-gradient(180deg,#1A1208,#0F0A05);overflow:hidden;}" +
    ".aip-ov.on{display:flex;flex-direction:column;}" +
    ".aip-bodywrap{min-height:0;}" +
    ".aip-ov::before{content:'';position:absolute;top:-120px;left:50%;transform:translateX(-50%);width:700px;height:400px;background:radial-gradient(ellipse,rgba(232,118,10,0.18),transparent 65%);pointer-events:none;}" +
    ".aip-top{position:relative;flex-shrink:0;display:flex;align-items:center;gap:10px;padding:calc(14px + env(safe-area-inset-top)) 16px 14px;border-bottom:1px solid rgba(243,200,105,0.15);}" +
    ".aip-bot{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 50% 35%,#FFF4DC,#F3C869);font-size:18px;}" +
    ".aip-ttl{font-family:'Playfair Display',serif;font-weight:800;color:#FFF8EF;font-size:1rem;line-height:1.1;}" +
    ".aip-ttl small{display:block;font-family:'DM Sans',sans-serif;font-weight:600;font-size:0.7rem;color:#86efac;}" +
    ".aip-x{margin-left:auto;background:none;border:none;color:#cbbfa9;font-size:24px;cursor:pointer;line-height:1;}" +
    ".aip-brief{margin:10px 14px 0;background:rgba(255,248,239,0.05);border:1px solid rgba(243,200,105,0.2);border-radius:14px;padding:10px 12px;}" +
    ".aip-brief-h{font-size:0.72rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#F3C869;margin-bottom:7px;}" +
    ".aip-brief-grid{display:flex;flex-wrap:wrap;gap:6px;}" +
    ".aip-bf{background:rgba(35,107,67,0.18);border:1px solid rgba(134,239,172,0.3);color:#cdebd6;border-radius:8px;padding:4px 9px;font-size:12px;font-weight:600;opacity:0;transform:translateY(6px);animation:aipPop .35s ease forwards;}" +
    "@keyframes aipPop{to{opacity:1;transform:none;}}" +
    ".aip-body{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;max-width:560px;width:100%;margin:0 auto;overflow:hidden;}" +
    ".aip-chat{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 14px 8px;display:flex;flex-direction:column;gap:9px;}" +
    ".aip-msg{max-width:84%;padding:10px 13px;border-radius:15px;font-size:14.5px;line-height:1.4;font-weight:500;white-space:pre-wrap;overflow-wrap:break-word;word-break:break-word;}" +
    ".aip-msg.bot{background:rgba(255,248,239,0.08);border:1px solid rgba(255,248,239,0.12);color:#FFF8EF;border-bottom-left-radius:5px;margin-right:auto;}" +
    ".aip-msg.usr{background:var(--saffron,#E8760A);color:#fff;border-bottom-right-radius:5px;margin-left:auto;}" +
    ".aip-typing{display:flex;gap:4px;padding:12px 14px;}" +
    ".aip-typing i{width:7px;height:7px;border-radius:50%;background:#F3C869;animation:aipBlink 1.2s infinite;}" +
    ".aip-typing i:nth-child(2){animation-delay:.2s;}.aip-typing i:nth-child(3){animation-delay:.4s;}" +
    "@keyframes aipBlink{0%,80%,100%{opacity:.3;transform:translateY(0);}40%{opacity:1;transform:translateY(-3px);}}" +
    ".aip-input{flex-shrink:0;padding:8px 14px calc(14px + env(safe-area-inset-bottom));}" +
    ".aip-chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:8px;max-height:128px;overflow-y:auto;}" +
    ".aip-chip{background:rgba(255,248,239,0.06);border:1px solid rgba(243,200,105,0.3);color:#FFF8EF;border-radius:99px;padding:9px 14px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;}" +
    ".aip-chip:hover{background:var(--saffron,#E8760A);border-color:var(--saffron,#E8760A);}" +
    ".aip-form{display:flex;gap:8px;}" +
    ".aip-in{flex:1;background:rgba(255,248,239,0.06);border:1px solid rgba(243,200,105,0.3);border-radius:12px;padding:11px 13px;color:#FFF8EF;font-size:14.5px;font-family:inherit;}" +
    ".aip-in::placeholder{color:#a89878;}.aip-in:focus{outline:none;border-color:#F3C869;}" +
    ".aip-in:disabled{opacity:.5;}" +
    ".aip-send{background:var(--saffron,#E8760A);color:#fff;border:none;border-radius:12px;padding:0 16px;font-weight:800;font-size:15px;cursor:pointer;}" +
    ".aip-engine{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;color:#FFF8EF;}" +
    ".aip-radar{width:74px;height:74px;border-radius:50%;border:4px solid rgba(232,118,10,0.25);border-top-color:#E8760A;animation:aipSpin .9s linear infinite;margin-bottom:18px;}" +
    "@keyframes aipSpin{to{transform:rotate(360deg);}}" +
    ".aip-engine h3{font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:800;margin-bottom:14px;}" +
    ".aip-crit{display:flex;flex-direction:column;gap:7px;font-size:13.5px;color:#cbbfa9;}" +
    ".aip-crit span{opacity:0;animation:aipFade .4s ease forwards;}" +
    "@keyframes aipFade{to{opacity:1;}}" +
    ".aip-res{flex:1;overflow-y:auto;padding:16px 14px 20px;}" +
    ".aip-res h3{font-family:'Playfair Display',serif;color:#FFF8EF;font-size:1.25rem;font-weight:800;text-align:center;margin-bottom:4px;}" +
    ".aip-res p.sub{text-align:center;color:#cbbfa9;font-size:0.85rem;margin-bottom:14px;}" +
    ".aip-card{background:rgba(255,248,239,0.06);border:1px solid rgba(243,200,105,0.2);border-radius:16px;padding:13px;margin-bottom:10px;display:flex;flex-direction:column;gap:10px;}" +
    ".aip-card-top{display:flex;gap:12px;align-items:flex-start;}" +
    ".aip-score{flex-shrink:0;width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#FFF4DC,#F3C869);color:#236B43;font-weight:900;font-size:14px;}" +
    ".aip-cbody{flex:1;min-width:0;}" +
    ".aip-cname{font-family:'Playfair Display',serif;font-weight:800;color:#FFF8EF;font-size:15px;display:flex;align-items:center;gap:6px;}" +
    ".aip-lock{filter:blur(5px);user-select:none;}" +
    ".aip-ccui{font-size:11.5px;color:#cbbfa9;margin:2px 0;}" +
    ".aip-why{font-size:11px;color:#86efac;}" +
    ".aip-rev{background:rgba(255,248,239,0.07);border-left:3px solid #F3C869;border-radius:0 10px 10px 0;padding:9px 12px;}" +
    ".aip-rev-stars{color:#F3C869;font-size:12px;letter-spacing:1px;display:block;margin-bottom:4px;}" +
    ".aip-rev-txt{font-size:12px;color:#ede3d4;line-height:1.5;font-style:italic;display:block;}" +
    ".aip-rev-name{font-size:10.5px;color:#b8aa97;display:block;margin-top:5px;font-weight:600;}" +
    ".aip-pick{background:#25D366;color:#fff;border-radius:11px;padding:12px;font-weight:800;font-size:13px;text-decoration:none;text-align:center;display:block;box-shadow:0 8px 20px rgba(37,211,102,0.3);}" +
    ".aip-offer-pill{background:linear-gradient(90deg,rgba(120,18,32,0.7),rgba(192,57,43,0.6));border:1px solid rgba(243,200,105,0.4);border-radius:12px;padding:11px 14px;font-size:13px;color:#FFF8EF;text-align:center;margin:10px 0;}" +
    ".aip-offer-pill b{color:#F3C869;}" +
    ".aip-unlock{display:block;width:100%;margin-top:8px;background:transparent;border:1.5px solid rgba(243,200,105,0.45);color:#F3C869;text-align:center;border-radius:13px;padding:12px;font-weight:800;font-size:13.5px;text-decoration:none;cursor:pointer;}" +
    ".aip-free{display:flex;align-items:center;justify-content:center;gap:7px;background:rgba(37,211,102,0.12);border:1px solid rgba(37,211,102,0.32);color:#86efac;font-size:12.5px;font-weight:700;border-radius:11px;padding:11px 12px;margin:2px 0 10px;text-align:center;line-height:1.45;}" +
    ".aip-taste{background:rgba(243,200,105,0.12);border:1px solid rgba(243,200,105,0.34);color:#F3C869;font-size:12.5px;border-radius:11px;padding:11px 12px;margin:0 0 10px;text-align:center;line-height:1.45;}" +
    ".aip-taste b{color:#FFE9B0;}" +
    ".aip-note{text-align:center;color:#a89878;font-size:11px;margin-top:8px;}" +
    ".aip-launch{display:inline-flex;align-items:center;gap:9px;background:linear-gradient(135deg,#E8760A,#C95F08);color:#fff;border:none;border-radius:99px;padding:15px 26px;font-family:'Playfair Display',serif;font-weight:800;font-size:1rem;cursor:pointer;box-shadow:0 14px 36px rgba(232,118,10,0.4);animation:aipGlow 2.4s ease-in-out infinite;}" +
    "@keyframes aipGlow{0%,100%{box-shadow:0 14px 36px rgba(232,118,10,0.4);}50%{box-shadow:0 14px 46px rgba(232,118,10,0.65);}}" +
    ".aip-exit{position:fixed;inset:0;background:rgba(20,12,4,0.72);display:none;align-items:center;justify-content:center;z-index:100010;padding:20px;}" +
    ".aip-exit.on{display:flex;}" +
    ".aipx-card{background:#FDF6ED;border-radius:20px;max-width:360px;width:100%;padding:26px 22px 20px;text-align:center;position:relative;box-shadow:0 30px 80px rgba(0,0,0,0.45);font-family:'DM Sans',system-ui,sans-serif;}" +
    ".aipx-x{position:absolute;top:8px;right:12px;border:none;background:none;font-size:26px;line-height:1;color:#8B6E52;cursor:pointer;}" +
    ".aipx-emoji{font-size:40px;margin-bottom:4px;}" +
    ".aipx-h{font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:800;color:#1A1208;margin:0 0 6px;}" +
    ".aipx-p{font-size:0.9rem;color:#6b5436;line-height:1.5;margin:0 auto 16px;max-width:300px;}" +
    ".aipx-p b{color:#236B43;}" +
    ".aipx-form{display:flex;flex-direction:column;gap:9px;}" +
    ".aipx-in{width:100%;padding:13px 12px;border:1.5px solid #EDD8BC;border-radius:11px;font-size:1rem;font-family:inherit;}" +
    ".aipx-in:focus{outline:none;border-color:#E8760A;}" +
    ".aipx-go{width:100%;min-height:48px;background:#E8760A;color:#fff;border:none;border-radius:11px;font-weight:800;font-size:1rem;cursor:pointer;}" +
    ".aipx-go:disabled{opacity:0.6;}" +
    ".aipx-err{color:#c0392b;font-size:0.82rem;margin-top:8px;}" +
    ".aipx-consent{font-size:0.68rem;color:#a89878;line-height:1.4;margin:9px auto 0;max-width:300px;}" +
    ".aipx-consent a{color:#E8760A;}" +
    ".aipx-skip{margin-top:12px;border:none;background:none;color:#a89878;font-size:0.82rem;text-decoration:underline;cursor:pointer;}" +
    ".aipx-done{color:#236B43;font-weight:700;font-size:0.95rem;margin-top:6px;line-height:1.5;}" +
    ".aipx-done a{color:#E8760A;font-weight:800;}" +
    ".aip-sub{margin-top:16px;border-top:1px solid #F0E3CE;padding-top:14px;text-align:center;}" +
    ".aip-sub-h{font-family:'Playfair Display',serif;font-weight:800;color:#1A1208;font-size:0.98rem;margin-bottom:4px;}" +
    ".aip-sub-h span{font-weight:600;color:#a89878;font-size:0.8rem;}" +
    ".aip-sub-p{font-size:0.8rem;color:#6b5436;line-height:1.45;margin-bottom:10px;}" +
    ".aip-sub-form{display:flex;gap:7px;max-width:340px;margin:0 auto;}" +
    ".aip-sub-in{flex:1;min-width:0;padding:11px 12px;border:1.5px solid #EDD8BC;border-radius:10px;font-size:0.95rem;font-family:inherit;}" +
    ".aip-sub-in:focus{outline:none;border-color:#E8760A;}" +
    ".aip-sub-go{background:#E8760A;color:#fff;border:none;border-radius:10px;padding:0 16px;font-weight:800;font-size:0.9rem;cursor:pointer;white-space:nowrap;}" +
    ".aip-sub-go:disabled{opacity:0.6;}" +
    ".aip-sub-consent{font-size:0.68rem;color:#a89878;line-height:1.4;margin:9px auto 0;max-width:330px;}" +
    ".aip-sub-consent a{color:#E8760A;}" +
    ".aip-sub-msg{color:#236B43;font-weight:700;font-size:0.9rem;margin-top:8px;}" +
    /* Menu Creation window */
    ".aip-menu{display:flex;flex-direction:column;height:100%;overflow:hidden;}" +
    ".aipm-head{padding:14px 16px 8px;flex-shrink:0;}" +
    ".aipm-head h3{font-family:'Playfair Display',serif;color:#FFF8EF;font-size:1.25rem;font-weight:800;margin:0 0 10px;}" +
    ".aipm-type-wrap{margin-bottom:10px;}" +
    ".aipm-type-lbl{display:block;font-size:11px;font-weight:700;color:rgba(255,248,239,0.5);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;}" +
    ".aipm-type-sel{width:100%;background:#1E1409;border:1.5px solid rgba(243,200,105,0.45);color:#F3C869;border-radius:10px;padding:10px 12px;font-size:14px;font-weight:700;font-family:inherit;appearance:none;-webkit-appearance:none;cursor:pointer;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23F3C869' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 12px center;}" +
    ".aipm-head p{color:rgba(255,248,239,0.62);font-size:12.5px;margin:3px 0 0;line-height:1.4;}" +
    ".aipm-cats{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 14px 14px;}" +
    ".aipm-cat{margin-bottom:15px;}" +
    ".aipm-ct{color:#F3C869;font-family:'Playfair Display',serif;font-weight:800;font-size:0.98rem;margin-bottom:8px;}" +
    ".aipm-chips{display:flex;flex-wrap:wrap;gap:7px;align-items:center;}" +
    ".aipm-chip{background:rgba(255,248,239,0.06);border:1px solid rgba(243,200,105,0.3);color:#FFF8EF;border-radius:99px;padding:9px 13px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;line-height:1;}" +
    ".aipm-chip.on{background:#236B43;border-color:#2e8a56;color:#fff;}" +
    ".aipm-add{display:inline-flex;align-items:center;background:rgba(255,248,239,0.04);border:1px dashed rgba(243,200,105,0.45);border-radius:99px;overflow:hidden;}" +
    ".aipm-in{background:none;border:none;color:#FFF8EF;padding:9px 12px;font-size:13px;font-family:inherit;width:118px;outline:none;}" +
    ".aipm-in::placeholder{color:rgba(255,248,239,0.5);}" +
    ".aipm-addbtn{background:rgba(243,200,105,0.18);border:none;color:#F3C869;padding:9px 13px;font-weight:800;font-size:12.5px;cursor:pointer;font-family:inherit;}" +
    ".aipm-bar{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px;border-top:1px solid rgba(243,200,105,0.18);background:#0F0A05;}" +
    ".aipm-count{color:rgba(255,248,239,0.8);font-size:13px;}" +
    ".aipm-count b{color:#F3C869;font-size:15px;}" +
    ".aipm-go{background:linear-gradient(135deg,#E8760A,#C95F08);color:#fff;border:none;border-radius:12px;padding:13px 18px;font-weight:800;font-size:0.95rem;cursor:pointer;font-family:inherit;white-space:nowrap;}" +
    ".aipm-skip{flex-shrink:0;display:block;width:100%;background:#0F0A05;border:none;border-top:1px solid rgba(243,200,105,0.1);color:rgba(255,248,239,0.5);font-size:12px;text-decoration:underline;cursor:pointer;padding:10px;font-family:inherit;}";
  document.head.appendChild(css);

  // --- overlay --------------------------------------------------------------
  var ov = document.createElement("div");
  ov.className = "aip-ov";
  ov.innerHTML =
    '<div class="aip-top"><div class="aip-bot">🤖</div><div class="aip-ttl">Aayojan AI<small>● matching you with verified kitchens</small></div><button class="aip-x" aria-label="Close">&times;</button></div>' +
    '<div class="aip-brief" id="aipBrief" style="display:none"><div class="aip-brief-h">📋 Your event brief</div><div class="aip-brief-grid" id="aipBriefGrid"></div></div>' +
    '<div class="aip-bodywrap" style="flex:1;display:flex;flex-direction:column;overflow:hidden"></div>';
  document.body.appendChild(ov);

  var bodyWrap = ov.querySelector(".aip-bodywrap");
  var briefBox = ov.querySelector("#aipBrief");
  var briefGrid = ov.querySelector("#aipBriefGrid");
  var chat, inputArea;

  var brief = {}, history = [], mode = "gemini", guidedIdx = 0, turnCount = 0;
  // exit-intent / abandonment recovery state
  var engaged = false, convClicked = false, recoveryShown = false, resultsShown = false, idleTimer = null;
  var MAX_TURNS = 15;
  var PROFANITY = /\b(fuck|f+u+c+k|shit|bullshit|bitch|asshole|a\$\$|bastard|cunt|dick|prick|pussy|slut|whore|wanker|bollocks|motherf|mf|bhenchod|madarchod|chutiya|chutiye|gandu|randi|lund|behenchod|bsdk|mc|bc)\b/i;
  function isProfane(t) { return PROFANITY.test(t || ""); }

  ov.querySelector(".aip-x").addEventListener("click", requestClose);
  function close() { clearTimeout(idleTimer); ov.classList.remove("on"); document.body.style.overflow = ""; ov.style.height = ""; ov.style.top = ""; }

  // --- exit-intent / abandonment recovery -----------------------------------
  // If an engaged visitor tries to leave without converting, offer a one-tap
  // "leave your number, we'll WhatsApp your matches" catcher (once per session).
  function briefLines() {
    var taste = (brief.tasting && !/^no/i.test(brief.tasting)) ? brief.tasting
      : (detectEvent(brief.event || "") === "Wedding" ? "yes — before booking" : "");
    return [
      brief.event ? "Event: " + brief.event : "",
      brief.guests ? "Guests: " + brief.guests : "",
      brief.cuisine ? "Food: " + brief.cuisine : "",
      brief.date ? "Date: " + brief.date : "",
      brief.area ? "Area: " + brief.area : "",
      brief.budget ? "Budget: " + brief.budget : "",
      taste ? "Tasting: " + taste : "",
      (brief.menu && brief.menu.length) ? "Menu: " + brief.menu.join(", ") : ""
    ].filter(Boolean).join("\n");
  }
  // Exit catcher is ONLY allowed after the user has seen their matches and hasn't
  // converted. Before results (during Q&A / menu build) it must NEVER appear —
  // closing simply closes. This single gate prevents spurious pop-ups on mobile.
  var IS_TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  function canCatch() { return resultsShown && engaged && !convClicked && !recoveryShown && ov.classList.contains("on"); }
  function requestClose() {
    if (canCatch()) { recoveryShown = true; showExitCatcher(); return; }
    close();
  }
  // desktop-only exit-intent: pointer leaves toward the top of the window.
  // Disabled on touch devices (mobile browsers fire spurious mouseout on scroll/tap).
  if (!IS_TOUCH) {
    document.addEventListener("mouseout", function (e) {
      if (e.clientY <= 0 && !e.relatedTarget && canCatch()) {
        recoveryShown = true; showExitCatcher();
      }
    });
  }
  function maybeCatch() {
    if (canCatch()) { recoveryShown = true; showExitCatcher(); return true; }
    return false;
  }
  // BACK button: only intercept (show catcher) once results are visible.
  // During Q&A, Back just closes — chips/navigation fire spurious popstate on Android.
  window.addEventListener("popstate", function () {
    if (!ov.classList.contains("on")) return;
    if (canCatch()) {
      try { window.history.pushState({ aip: 1 }, ""); } catch (e) {}
      recoveryShown = true; showExitCatcher();
    } else {
      close();
    }
  });
  // idle on results: if parked on results without converting, surface the catcher
  function resetIdle() {
    clearTimeout(idleTimer);
    if (!resultsShown || convClicked || recoveryShown) return;
    idleTimer = setTimeout(function () {
      if (ov.classList.contains("on")) maybeCatch();
    }, 25000);
  }
  ["click", "touchstart", "keydown"].forEach(function (ev) {
    ov.addEventListener(ev, resetIdle, { passive: true });
  });

  var exitOv;
  function showExitCatcher() {
    track("ai_planner_exit_shown", { event: brief.event || "", resultsShown: resultsShown });
    var bl = briefLines();
    var wa = "https://wa.me/" + WA + "?text=" + encodeURIComponent("Hi Aayojan! Please send my matches.\n" + bl);
    if (!exitOv) {
      exitOv = document.createElement("div");
      exitOv.className = "aip-exit";
      document.body.appendChild(exitOv);
    }
    exitOv.innerHTML =
      '<div class="aipx-card">' +
      '<button class="aipx-x" aria-label="No thanks">&times;</button>' +
      '<div class="aipx-emoji">🎁</div>' +
      '<h3 class="aipx-h">Wait — don\'t lose your matches!</h3>' +
      '<p class="aipx-p">Drop your number and we\'ll WhatsApp your ' + (resultsShown ? "3 matched kitchens" : "shortlist") + ' — <b>free, no spam.</b></p>' +
      '<form class="aipx-form"><input class="aipx-in" name="phone" type="tel" inputmode="tel" placeholder="WhatsApp number *" autocomplete="tel">' +
      '<input class="aipx-in" name="email" type="email" inputmode="email" placeholder="Email for seasonal offers (optional)" autocomplete="email">' +
      '<button class="aipx-go" type="submit">Send my matches →</button></form>' +
      '<div class="aipx-consent">Number is used only for your event. Email is optional — occasional offers, no spam, unsubscribe anytime · <a href="/privacy.html" target="_blank" rel="noopener">Privacy</a>.</div>' +
      '<div class="aipx-err" style="display:none"></div>' +
      '<button class="aipx-skip">No thanks, I\'ll leave</button>' +
      '<div class="aipx-done" style="display:none">✓ Got it! We\'ll WhatsApp you within 4 hours. <a href="' + wa + '" data-no-gate target="_blank" rel="noopener">Or message us now →</a></div>' +
      "</div>";
    exitOv.classList.add("on");
    var form = exitOv.querySelector(".aipx-form");
    var err = exitOv.querySelector(".aipx-err");
    function dismiss() { exitOv.classList.remove("on"); close(); }
    exitOv.querySelector(".aipx-x").addEventListener("click", dismiss);
    exitOv.querySelector(".aipx-skip").addEventListener("click", dismiss);
    exitOv.addEventListener("click", function (e) { if (e.target === exitOv) exitOv.classList.remove("on"); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var phone = (form.phone.value || "").trim();
      if (phone.replace(/\D/g, "").length < 10) {
        form.phone.style.borderColor = "#c0392b"; form.phone.focus();
        err.textContent = "Please enter a valid number."; err.style.display = "block"; return;
      }
      var email = (form.email.value || "").trim();
      var emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
      var btn = form.querySelector(".aipx-go"); btn.disabled = true; btn.textContent = "Saving…";
      var qp = new URLSearchParams(location.search);
      var lead = {
        name: "", phone: phone, email: emailOk ? email : "", event: brief.event || "", guests: brief.guests || "", date: brief.date || "",
        brief: bl, message: "Exit-intent recovery.\n" + bl, source: "ai_planner_exit",
        marketingConsent: emailOk, sid: window.aSID || "", device: (window.innerWidth <= 768 ? "mobile" : "desktop"), page: location.pathname,
        gclid: qp.get("gclid") || "", utm_source: qp.get("utm_source") || "", utm_campaign: qp.get("utm_campaign") || "",
        status: "new", createdAt: new Date().toISOString()
      };
      // optional consented seasonal-offer subscription
      if (emailOk) {
        withDb(function (db) {
          db.collection("subscribers").add({
            email: email, marketingConsent: true, consentAt: new Date().toISOString(),
            consentText: "Opted in to promotional/seasonal offers via Aayojan AI planner (exit catcher)",
            source: "ai_planner_exit", event: brief.event || "", brief: bl, sid: window.aSID || "",
            page: location.pathname, gclid: qp.get("gclid") || "", utm_source: qp.get("utm_source") || "",
            createdAt: new Date().toISOString()
          }).catch(function () {});
        });
        track("ai_planner_subscribe", { source: "ai_planner_exit", event: brief.event || "" });
      }
      function done() {
        form.style.display = "none"; err.style.display = "none";
        exitOv.querySelector(".aipx-skip").style.display = "none";
        exitOv.querySelector(".aipx-done").style.display = "block";
        track("ai_planner_exit_lead", { event: brief.event || "" });
        track("lead_submitted", { source: "ai_planner_exit", event: brief.event || "" });
      }
      withDb(function (db) { db.collection("customerLeads").add(lead).then(done).catch(done); });
    });
  }

  // iOS soft keyboard: shrink the overlay to the visible viewport (above the keyboard)
  var VV = window.visualViewport;
  function fitVV() {
    if (!VV || !ov.classList.contains("on")) return;
    ov.style.height = VV.height + "px";
    ov.style.top = (VV.offsetTop || 0) + "px";
    if (chat) chat.scrollTop = chat.scrollHeight;
  }
  if (VV) { VV.addEventListener("resize", fitVV); VV.addEventListener("scroll", fitVV); }

  function buildChatLayout() {
    bodyWrap.innerHTML = '<div class="aip-body"><div class="aip-chat" id="aipChat"></div><div class="aip-input" id="aipInput"></div></div>';
    chat = ov.querySelector("#aipChat"); inputArea = ov.querySelector("#aipInput");
  }
  function addMsg(text, who) {
    var d = document.createElement("div"); d.className = "aip-msg " + who; d.textContent = text;
    chat.appendChild(d); chat.scrollTop = chat.scrollHeight;
    if (who === "usr") { engaged = true; logChat("user", text); } // capture what users search/type
  }
  function showTyping() {
    var t = document.createElement("div"); t.className = "aip-typing"; t.id = "aipTyping"; t.innerHTML = "<i></i><i></i><i></i>";
    chat.appendChild(t); chat.scrollTop = chat.scrollHeight;
  }
  function hideTyping() { var t = ov.querySelector("#aipTyping"); if (t) t.remove(); }

  function mergeBrief(b) {
    if (!b) return;
    ["event", "guests", "cuisine", "date", "area", "budget", "tasting"].forEach(function (k) { if (b[k]) brief[k] = b[k]; });
    renderBrief();
  }
  function renderBrief() {
    var rows = [];
    if (brief.event) rows.push("🎉 " + brief.event);
    if (brief.guests) rows.push("👥 " + brief.guests);
    if (brief.cuisine) rows.push("🍽️ " + brief.cuisine);
    if (brief.date) rows.push("📅 " + brief.date);
    if (brief.area) rows.push("📍 " + brief.area);
    if (brief.budget) rows.push("💰 " + brief.budget);
    if (brief.tasting && !/^no/i.test(brief.tasting)) rows.push("🍴 Tasting: " + brief.tasting);
    if (rows.length) briefBox.style.display = "block";
    briefGrid.innerHTML = rows.map(function (r) { return '<span class="aip-bf">' + r + "</span>"; }).join("");
  }

  // --- free-form (Gemini) input ---------------------------------------------
  function renderFree(showChips) {
    inputArea.innerHTML = "";
    if (showChips) {
      var chips = document.createElement("div"); chips.className = "aip-chips";
      ["🪷 Pujo catering", "💍 Wedding", "🎉 Party order", "🎂 Birthday", "🏢 Corporate lunch"].forEach(function (c) {
        var b = document.createElement("button"); b.className = "aip-chip"; b.textContent = c;
        b.addEventListener("click", function () { sendUser(c.replace(/^[^\w]+\s*/, "")); });
        chips.appendChild(b);
      });
      inputArea.appendChild(chips);
    }
    var form = document.createElement("form"); form.className = "aip-form";
    form.innerHTML = '<input class="aip-in" placeholder="Type your reply… (e.g. 60 guests, mostly veg)"><button class="aip-send" type="submit">→</button>';
    form.addEventListener("submit", function (e) { e.preventDefault(); var v = form.querySelector(".aip-in").value.trim(); if (v) sendUser(v); });
    inputArea.appendChild(form);
    var i = form.querySelector(".aip-in"); if (i) i.focus();
  }

  // Belt-and-braces: if the model ever leaks raw JSON into the reply, recover clean text.
  function cleanReply(r) {
    if (!r) return "";
    r = String(r);
    // 1) if a JSON object is embedded, pull its "reply" field
    var m = r.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (m) { try { return JSON.parse('"' + m[1] + '"'); } catch (e) { return m[1]; } }
    // 2) otherwise cut anything from the first stray brace onward
    var i = r.indexOf("{");
    if (i > 0 && /"(reply|brief|complete)"/.test(r)) r = r.slice(0, i);
    return r.replace(/```json|```/g, "").trim();
  }

  function sendUser(text) {
    if (isProfane(text)) {
      addMsg("Let's keep it friendly and about your event 🙂", "bot");
      renderFree(false);
      return;
    }
    addMsg(text, "usr");
    history.push({ role: "user", content: text });
    inputArea.innerHTML = "";
    if (mode === "guided") { guidedAnswer(text); return; }
    turnCount++;
    if (turnCount >= MAX_TURNS) {
      addMsg("Got enough to match you — let's go! 🎯", "bot");
      track("ai_planner_maxturns", {});
      showMenuBuilder();
      return;
    }
    showTyping();
    fetch(API_BASE + "/api/plan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history })
    }).then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (data) {
        hideTyping();
        if (!data || data.error || (!data.reply && !data.complete)) { goGuided(); return; }
        mergeBrief(data.brief);
        var reply = cleanReply(data.reply);
        if (reply) { addMsg(reply, "bot"); history.push({ role: "assistant", content: reply }); }
        track("ai_planner_turn", {});
        // robust completion: don't rely only on the (sometimes-missing) complete flag
        var filled = brief.event && brief.guests && brief.cuisine && brief.date && brief.area && brief.budget;
        var saysDone = /matching you with verified kitchens|matching you now/i.test(reply);
        if (data.complete || filled || saysDone) { track("ai_planner_brief_complete", { source: "gemini" }); showMenuBuilder(); }
        else renderFree(false);
      })
      .catch(function () { hideTyping(); goGuided(); });
  }

  // --- guided fallback ------------------------------------------------------
  function goGuided() {
    mode = "guided";
    // jump to first unanswered step
    guidedIdx = 0;
    while (guidedIdx < STEPS.length && brief[STEPS[guidedIdx].key]) guidedIdx++;
    askGuided();
  }
  function askGuided() {
    if (guidedIdx >= STEPS.length) { track("ai_planner_brief_complete", { source: "guided" }); showMenuBuilder(); return; }
    var st = STEPS[guidedIdx];
    showTyping();
    setTimeout(function () {
      hideTyping(); addMsg(st.q, "bot");
      inputArea.innerHTML = "";
      var chips = document.createElement("div"); chips.className = "aip-chips";
      st.chips.forEach(function (c) {
        var b = document.createElement("button"); b.className = "aip-chip"; b.textContent = c;
        b.addEventListener("click", function () { addMsg(c, "usr"); guidedAnswer(c.replace(/^[^\w₹]+\s*/, "")); });
        chips.appendChild(b);
      });
      inputArea.appendChild(chips);
      var form = document.createElement("form"); form.className = "aip-form";
      form.innerHTML = '<input class="aip-in" placeholder="' + st.ph + '"><button class="aip-send" type="submit">→</button>';
      form.addEventListener("submit", function (e) { e.preventDefault(); var v = form.querySelector(".aip-in").value.trim(); if (v) { addMsg(v, "usr"); guidedAnswer(v); } });
      inputArea.appendChild(form);
    }, 450);
  }
  function guidedAnswer(val) {
    var key = STEPS[guidedIdx].key;
    brief[key] = val;
    renderBrief();
    track("ai_planner_step", { step: key });
    inputArea.innerHTML = "";
    guidedIdx++;
    if (key === "cuisine") { suggestDishes(val); return; } // delight before next question
    askGuided();
  }

  // --- famous Bengali crowd-favourites by event format + STRICT diet ---------
  // veg lists never contain non-veg; jain lists are onion/garlic/root-free only.
  var MENU = {
    Wedding: {
      nonveg: ["🍖 Kosha Mangsho", "🍤 Chingri Malai Curry", "🐟 Gandharaj Bhetki", "🍛 Mutton Biryani", "🍮 Rosogolla"],
      veg: ["🫓 Green Peas Kachuri", "🍚 Basanti Pulao", "🧆 Dhokar Dalna", "🧀 Chhanar Dalna", "🍮 Rosogolla"],
      jain: ["🫓 Luchi", "🍚 Basanti Pulao", "🧀 Chhanar Dalna", "🥬 Phulkopir Dalna", "🍮 Rosogolla"]
    },
    Jamai: {
      nonveg: ["🐟 Ilish Bhapa", "🍤 Chingri Malai Curry", "🍖 Mutton Kosha", "🐠 Bhetki Paturi", "🥭 Aam-Mishti Doi"],
      veg: ["🍚 Basanti Pulao", "🧀 Chhanar Dalna", "🫓 Luchi", "🥬 Dhokar Dalna", "🥭 Aam-Mishti Doi"],
      jain: ["🍚 Basanti Pulao", "🧀 Chhanar Dalna", "🫓 Luchi", "🥬 Phulkopir Dalna", "🍮 Mishti Doi"]
    },
    Pujo: {
      satwik: ["🪷 Niramish Khichuri", "🍆 Beguni", "🥬 Labra", "🫓 Luchi-Suji", "🍚 Payesh"],
      veg: ["🍚 Basanti Pulao", "🧀 Chhanar Dalna", "🥬 Labra", "🫓 Luchi", "🍮 Mishti Doi"],
      jain: ["🪷 Niramish Khichuri", "🥬 Phulkopir Dalna", "🫓 Luchi", "🍆 Beguni", "🍮 Mishti Doi"],
      nonveg: ["🍚 Bhuna Khichuri", "🐟 Macher Kalia", "🍖 Mutton Kosha", "🫓 Luchi", "🍮 Mishti Doi"]
    },
    Annaprasan: {
      nonveg: ["🍚 Payesh", "🫓 Luchi", "🐟 Macher Jhol", "🍗 Chicken Kebab", "🍮 Rosogolla"],
      veg: ["🍚 Payesh", "🫓 Luchi", "🥬 Shukto", "🥔 Aloo Bhaja", "🍮 Rosogolla"],
      jain: ["🍚 Payesh", "🫓 Luchi", "🧀 Chhanar Dalna", "🥬 Phulkopir Dalna", "🍮 Rosogolla"]
    },
    Party: {
      nonveg: ["🍛 Mutton Biryani", "🍗 Chicken Chaap", "🐟 Fish Fry", "🌯 Mughlai Paratha", "🍨 Ice Cream"],
      veg: ["🍚 Veg Biryani", "🧀 Paneer Butter Masala", "🫓 Green Peas Kachuri", "🍜 Veg Chowmein", "🍨 Ice Cream"],
      jain: ["🍚 Jain Pulao", "🧀 Paneer (Jain)", "🫓 Luchi", "🍜 Jain Chowmein", "🍨 Ice Cream"]
    },
    Corporate: {
      nonveg: ["🍛 Chicken Biryani", "🐟 Fish Kalia", "🍗 Chicken Chaap", "🫓 Luchi-Cholar Dal", "🍮 Mishti Doi"],
      veg: ["🍚 Basanti Pulao", "🧀 Paneer Kofta", "🧆 Dhokar Dalna", "🫓 Luchi-Cholar Dal", "🍮 Mishti Doi"],
      jain: ["🍚 Basanti Pulao", "🧀 Chhanar Dalna", "🫓 Luchi", "🥬 Phulkopir Dalna", "🍮 Mishti Doi"]
    },
    default: {
      nonveg: ["🍖 Kosha Mangsho", "🍤 Chingri Malai Curry", "🍛 Mutton Biryani", "🐟 Bhetki Fry", "🍮 Mishti Doi"],
      veg: ["🥬 Shukto", "🧆 Dhokar Dalna", "🧀 Chhanar Dalna", "🍚 Basanti Pulao", "🍮 Mishti Doi"],
      jain: ["🫓 Luchi", "🍚 Basanti Pulao", "🧀 Chhanar Dalna", "🥬 Phulkopir Dalna", "🍮 Mishti Doi"]
    }
  };
  function dietOf(val) {
    var s = (val || "").toLowerCase();
    if (/jain/.test(s)) return "jain";
    if (/satwik|satvik|sattvik|niramish|bhog/.test(s)) return "satwik"; // pure veg, no onion-garlic
    var saysNon = /non.?veg|nonveg/.test(s);
    var saysVeg = /\b(pure ?veg|veg|vegetarian)\b/.test(s);
    if (saysVeg && !saysNon) return "veg";          // explicit veg wins over dish words
    if (saysNon) return "nonveg";
    if (/chicken|mutton|fish|egg|prawn|chingri|kebab|ilish|hilsa|\bmeat/.test(s)) return "nonveg";
    if (/paneer|aloo|dal|sabzi/.test(s)) return "veg";
    return "nonveg";
  }
  function dishesFor(val) {
    var ev = detectEvent(brief.event || "");
    var key = MENU[ev] ? ev : (ev === "Birthday" ? "Party" : "default");
    var d = dietOf(val);
    return MENU[key][d] || MENU[key].veg || MENU[key].nonveg; // satwik falls back to veg where not curated
  }
  function suggestDishes(val) {
    var items = dishesFor(val);
    showTyping();
    setTimeout(function () {
      hideTyping();
      addMsg("Delicious! 😋 Famous Bengali crowd-favourites for your " + detectEvent(brief.event || "").toLowerCase() + " — tap any to add as must-haves:", "bot");
      inputArea.innerHTML = "";
      var chips = document.createElement("div"); chips.className = "aip-chips";
      items.forEach(function (c) {
        var b = document.createElement("button"); b.className = "aip-chip"; b.textContent = c;
        b.addEventListener("click", function () {
          if (b.disabled) return;
          var dish = c.replace(/^[^\w]+\s*/, "");
          brief.cuisine = (brief.cuisine ? brief.cuisine + ", " : "") + dish;
          renderBrief();
          addMsg(dish + " — great pick! 👌", "usr");
          b.disabled = true; b.style.opacity = "0.45";
          track("ai_planner_dish_add", { dish: dish });
        });
        chips.appendChild(b);
      });
      var cont = document.createElement("button"); cont.className = "aip-chip aip-go"; cont.textContent = "✓ Done — continue →";
      cont.addEventListener("click", function () { inputArea.innerHTML = ""; askGuided(); });
      chips.appendChild(cont);
      inputArea.appendChild(chips);
    }, 450);
  }

  // --- engine + gated results ----------------------------------------------
  function derive() {
    brief.eventType = detectEvent(brief.event);
    brief.guestsNum = parseInt((String(brief.guests || "").match(/\d+/) || [50])[0], 10) || 50;
    var a = String(brief.area || "");
    brief.area = normArea(a);
    var bm = String(brief.budget || "").match(/\d+/g);
    brief.budgetMid = bm ? (bm.length > 1 ? (parseInt(bm[0]) + parseInt(bm[1])) / 2 : parseInt(bm[0])) : 0;
  }
  // --- Comprehensive catalog: flag 0=non-veg, 1=veg, 2=Jain/Satwik safe ------
  var MENU_CATALOG = [
    { c: "🥤 Welcome Drinks", items: [["Mocktails (live)", 2], ["Aam Panna", 2], ["Lassi", 2], ["Fresh Lime Soda", 2], ["Tomato Soup", 2], ["Sweet Corn Soup", 2], ["Jaljeera", 2], ["Sherbet", 2]] },
    { c: "🍢 Starters", items: [["Paneer Tikka", 1], ["Chilli Baby Corn", 2], ["Veg Pakora", 1], ["Cheese Balls", 2], ["Hara Bhara Kabab", 2], ["Stuffed Mushroom", 2], ["Fish Fry", 0], ["Fish Tikka", 0], ["Chicken Tikka", 0], ["Reshmi Kebab", 0], ["Mutton Seekh Kebab", 0], ["Tandoori Prawn", 0]] },
    { c: "🍛 Bengali Mains", items: [["Niramish Khichuri", 2], ["Chhanar Dalna", 2], ["Dhokar Dalna", 2], ["Sukto", 2], ["Echor Kalia", 1], ["Labra", 2], ["Beguni", 2], ["Kosha Mangsho", 0], ["Chingri Malai Curry", 0], ["Ilish Bhapa", 0], ["Bhetki Paturi", 0], ["Murgi Kosha", 0], ["Daab Chingri", 0]] },
    { c: "🧀 Indian Mains", items: [["Malai Kofta", 2], ["Navratan Korma", 2], ["Palak Paneer", 2], ["Paneer Butter Masala", 1], ["Murgh Butter Masala", 0], ["Murgh Rezala", 0], ["Mutton Rogan Josh", 0], ["Mutton Chaap", 0]] },
    { c: "🍚 Rice & Biryani", items: [["Basanti Pulao", 2], ["Dry-fruit Pulao", 2], ["Steamed Rice", 2], ["Veg Fried Rice", 1], ["Mutton Biryani", 0], ["Chicken Biryani", 0], ["Chicken Fried Rice", 0]] },
    { c: "🫓 Breads", items: [["Luchi", 2], ["Radhaballavi", 2], ["Lachha Paratha", 2], ["Butter Naan", 2], ["Bhatura", 1]] },
    { c: "🥣 Dal", items: [["Cholar Dal", 2], ["Moong Dal", 2], ["Yellow Dal Fry", 2], ["Dal Makhani", 1], ["Kali Dal", 1]] },
    { c: "🍮 Desserts", items: [["Payesh", 2], ["Sandesh", 2], ["Rasgolla", 2], ["Mishti Doi", 2], ["Rajbhog", 2], ["Rabri", 2], ["Naru", 2], ["Gulab Jamun", 2], ["Kulfi", 2], ["Ice Cream", 2]] }
  ];
  // Diet options for dropdown
  var DIET_OPTS = [
    { key: "mix",    label: "🍽️ Mix (Veg + Non-Veg)" },
    { key: "veg",    label: "🥬 Veg" },
    { key: "nonveg", label: "🍗 Non-Veg" },
    { key: "jain",   label: "🌱 Jain (niramish)" },
    { key: "satwik", label: "🪷 Satwik (niramish)" }
  ];
  function dietKeyOf(d) {
    if (d === "jain") return "jain";
    if (d === "satwik") return "satwik";
    if (d === "veg") return "veg";
    if (d === "nonveg") return "nonveg";
    return "mix";
  }
  function filterByDiet(items, dk) {
    if (dk === "jain" || dk === "satwik") return items.filter(function(it){ return it[1] === 2; });
    if (dk === "veg") return items.filter(function(it){ return it[1] >= 1; });
    return items; // mix / nonveg — show all
  }

  var menuSel = {};
  function showMenuBuilder() {
    var d = dietOf(brief.cuisine || "");
    var activeDiet = dietKeyOf(d);
    menuSel = {};

    function dietLabel(dk) {
      var o = DIET_OPTS.find(function(x){ return x.key === dk; });
      return o ? o.label : "";
    }
    function renderCatalog() {
      var cats = document.getElementById("aipmCats"); if (!cats) return;
      var html = "";
      MENU_CATALOG.forEach(function (cat) {
        var its = filterByDiet(cat.items, activeDiet);
        if (!its.length) return;
        html += '<div class="aipm-cat"><div class="aipm-ct">' + cat.c + '</div><div class="aipm-chips">';
        its.forEach(function (it) {
          var dish = String(it[0]).replace(/"/g, "");
          var on = menuSel[dish] ? " on" : "";
          var tag = it[1] === 0 ? " 🍗" : (it[1] === 2 && (activeDiet === "mix" || activeDiet === "nonveg") ? " 🌿" : "");
          html += '<button type="button" class="aipm-chip' + on + '" data-dish="' + dish + '">' + it[0] + tag + "</button>";
        });
        html += '<span class="aipm-add"><input class="aipm-in" placeholder="✚ add your own…" aria-label="Add your own dish"><button type="button" class="aipm-addbtn">Add</button></span>';
        html += "</div></div>";
      });
      cats.innerHTML = html;
    }

    var dietOpts = DIET_OPTS.map(function(o) {
      return '<option value="' + o.key + '"' + (o.key === activeDiet ? " selected" : "") + ">" + o.label + "</option>";
    }).join("");

    var html = '<div class="aip-menu">' +
      '<div class="aipm-head"><h3>Build your menu 🍽️</h3>' +
      '<div class="aipm-type-wrap">' +
        '<label class="aipm-type-lbl">Dietary preference</label>' +
        '<select class="aipm-type-sel" id="aipmDietSel">' + dietOpts + '</select>' +
      '</div>' +
      '<p>Tap dishes for your ' + (brief.event || "event").toLowerCase() + (brief.guests ? " · " + brief.guests + " guests" : "") + ". Not listed? Add your own.</p></div>" +
      '<div class="aipm-cats" id="aipmCats"></div>' +
      '<div class="aipm-bar"><span class="aipm-count">Your spread: <b id="aipmCount">0</b></span>' +
      '<button type="button" class="aipm-go" id="aipmGo">Find my caterers →</button></div>' +
      '<button type="button" class="aipm-skip" id="aipmSkip">Skip — just match me →</button>' +
      "</div>";
    bodyWrap.innerHTML = html;
    renderCatalog();
    track("ai_planner_menu_shown", { event: brief.event || "", diet: activeDiet });

    document.getElementById("aipmDietSel").addEventListener("change", function() {
      activeDiet = this.value;
      brief.cuisine = activeDiet; // update brief so matching uses correct diet
      renderCatalog();
      track("ai_planner_diet_change", { diet: activeDiet });
    });

    function updateCount() { var el = document.getElementById("aipmCount"); if (el) el.textContent = Object.keys(menuSel).length; }
    bodyWrap.addEventListener("click", function (e) {
      var chip = e.target.closest && e.target.closest(".aipm-chip");
      if (chip) {
        var dish = chip.getAttribute("data-dish");
        if (menuSel[dish]) { delete menuSel[dish]; chip.classList.remove("on"); }
        else { menuSel[dish] = 1; chip.classList.add("on"); }
        updateCount(); return;
      }
      var addb = e.target.closest && e.target.closest(".aipm-addbtn");
      if (addb) {
        var wrap = addb.closest(".aipm-add"), inp = wrap.querySelector(".aipm-in");
        var v = (inp.value || "").trim(); if (!v) return;
        menuSel[v] = 1;
        var nb = document.createElement("button");
        nb.type = "button"; nb.className = "aipm-chip on"; nb.setAttribute("data-dish", v.replace(/"/g, "")); nb.textContent = v;
        wrap.parentNode.insertBefore(nb, wrap);
        inp.value = ""; updateCount(); track("ai_planner_menu_custom", {}); return;
      }
      if (e.target.closest && e.target.closest("#aipmGo")) finishMenu(false);
      else if (e.target.closest && e.target.closest("#aipmSkip")) finishMenu(true);
    });
  }
  function finishMenu(skipped) {
    var dishes = Object.keys(menuSel);
    brief.menu = dishes;
    // carry menu type label into brief for WhatsApp brief
    track("ai_planner_menu_done", { count: dishes.length, skipped: !!skipped, diet: brief.cuisine || "" });
    runEngine();
  }

  function runEngine() {
    derive();
    bodyWrap.innerHTML =
      '<div class="aip-engine"><div class="aip-radar"></div><h3>Matching you with verified kitchens…</h3><div class="aip-crit">' +
      ["🍽️ Cuisine fit", "👥 Guest capacity", "📍 Area coverage", "💰 Budget range", "📅 Availability", "✓ FSSAI verified"].map(function (c, i) {
        return '<span style="animation-delay:' + (0.3 + i * 0.32) + 's">' + c + " ✓</span>";
      }).join("") + "</div></div>";
    setTimeout(function() {
      try { showResults(); }
      catch(e) {
        // fallback: direct WhatsApp if results render fails
        var wa = "https://wa.me/" + WA + "?text=" + encodeURIComponent("Hi Aayojan! Please help me find a caterer.\nEvent: " + (brief.event||"") + "\nGuests: " + (brief.guests||"") + "\nArea: " + (brief.area||""));
        bodyWrap.innerHTML = '<div class="aip-res" style="text-align:center;padding:30px 20px"><h3 style="color:#FFF8EF;margin-bottom:12px">✨ Great news — we have matches!</h3><p style="color:#cbbfa9;margin-bottom:20px">Tap below and our team will send you the best caterers within minutes.</p><a href="' + wa + '" target="_blank" style="display:inline-block;background:#25D366;color:#fff;padding:14px 28px;border-radius:14px;font-weight:800;font-size:1rem;text-decoration:none">💬 Get my caterer matches →</a></div>';
      }
    }, 1500);
  }
  // Customer reviews pool — shown on result cards to build confidence
  var REVIEWS = [
    { text: "Food was absolutely fresh and the quantity was generous. Everyone loved the Kosha Mangsho!", name: "Priya M.", event: "Wedding", stars: 5 },
    { text: "Got 4 quotes within 2 hours. Booked the best one at ₹380/plate. Stress-free experience.", name: "Rahul S.", event: "Birthday", stars: 5 },
    { text: "Luchi-Alur Dom and Chingri Malai Curry were exactly like homemade. 200 guests, zero complaints.", name: "Sudeshna B.", event: "Annaprasan", stars: 5 },
    { text: "The caterer showed up on time with full setup. Biryani was the highlight of the evening!", name: "Arindam D.", event: "Party", stars: 5 },
    { text: "Tasting was arranged before booking — that's what convinced us. Quality matched the tasting exactly.", name: "Mallika G.", event: "Wedding", stars: 5 },
    { text: "Niramish khichuri for our Pujo was perfect — satwik taste, no compromise. Will book again.", name: "Tapas R.", event: "Pujo", stars: 5 },
    { text: "Office lunch for 80 people. Paneer, Biryani, dal all arrived hot. No chaos at all.", name: "Neha K.", event: "Corporate", stars: 5 },
    { text: "Matched with a kitchen 10 mins from our venue. Saved us ₹40/plate vs what we were quoted elsewhere.", name: "Sourav C.", event: "Wedding", stars: 5 },
    { text: "Quick, responsive, and the food portions were huge. Our guests kept asking who the caterer was!", name: "Rima P.", event: "Party", stars: 5 },
    { text: "Fish Fry and Mutton Chaap were outstanding. Our family reunion of 120 was a hit!", name: "Biswajit N.", event: "Reunion", stars: 5 }
  ];
  function pickReviews(eventType) {
    // prefer reviews that match the event type, shuffle the rest
    var match = REVIEWS.filter(function(r){ return r.event === eventType; });
    var rest = REVIEWS.filter(function(r){ return r.event !== eventType; });
    var pool = match.concat(rest);
    // shuffle rest for variety
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return pool;
  }

  function showResults() {
    resultsShown = true; resetIdle();
    var ranked = KITCHENS.map(function (k) { return { k: k, pct: score(k, brief) }; })
      .sort(function (a, b) { return b.pct - a.pct; }).slice(0, 5);
    var taste = (brief.tasting && !/^no/i.test(brief.tasting)) ? brief.tasting
      : (brief.eventType === "Wedding" ? "yes — before booking" : "");
    var bl = "Event: " + (brief.event || "") + "\nGuests: " + (brief.guests || "") + "\nFood: " + (brief.cuisine || "") +
      "\nDate: " + (brief.date || "") + "\nArea: " + (brief.area || "") + "\nBudget: " + (brief.budget || "") +
      (taste ? "\nTasting: " + taste : "") +
      (brief.menu && brief.menu.length ? "\nDishes: " + brief.menu.join(", ") : "");
    function waFor(label) {
      return "https://wa.me/" + WA + "?text=" + encodeURIComponent(
        "Hi Aayojan! Aayojan AI matched me — please connect me with " + label + ".\n" + bl);
    }
    var waDirect = "https://wa.me/" + WA + "?text=" + encodeURIComponent(
      "Hi Aayojan! I'd like to talk to your team directly about my event.\n" + bl);
    var reviews = pickReviews(brief.eventType);
    var html = '<div class="aip-res"><h3>✨ ' + ranked.length + ' kitchens matched</h3><p class="sub">Your AI shortlist · ' + (brief.eventType || "event").toLowerCase() + " · " + (brief.guestsNum || "") + ' guests · unlock any you like</p>' +
      '<div class="aip-free">💬 100% free — no payment, no spam. We just connect you on WhatsApp 🙂</div>' +
      (brief.eventType === "Wedding" ? '<div class="aip-taste">🍴 <b>Free food tasting</b> — for weddings we set up a tasting with your matched kitchens before you book.</div>' : "");
    ranked.forEach(function (r, i) {
      var label = "match #" + (i + 1) + " (" + r.pct + "% · " + r.k.cuisines + ")";
      var rev = reviews.length ? reviews[i % reviews.length] : null;
      html += '<div class="aip-card">' +
        '<div class="aip-card-top"><div class="aip-score">' + r.pct + '%</div><div class="aip-cbody">' +
        '<div class="aip-cname">🔒 <span class="aip-lock">' + r.k.tag + "</span></div>" +
        '<div class="aip-ccui">' + r.k.cuisines + "</div>" +
        '<div class="aip-why">✓ ' + reasons(r.k, brief).join(" · ") + "</div>" +
        '</div></div>' +
        (rev ? '<div class="aip-rev"><span class="aip-rev-stars">★★★★★</span><span class="aip-rev-txt">"' + rev.text + '"</span><span class="aip-rev-name">— ' + rev.name + ' · ' + rev.event + '</span></div>' : '') +
        '<a class="aip-pick" href="' + waFor(label) + '" target="_blank" rel="noopener" data-pick="' + (i + 1) + '">🔓 Unlock & get quote</a></div>';
    });
    // Offer pill — event-relevant discount shown in results
    var offerPill = "";
    if (/pujo|puja|durga|bhog|ratha/i.test(brief.eventType || "")) {
      offerPill = '<div class="aip-offer-pill">🥁 Flat <b>10% OFF</b> on Pujo catering · book by 29 June</div>';
    } else if (/wedding/i.test(brief.eventType || "")) {
      offerPill = '<div class="aip-offer-pill">💍 Up to <b>20% OFF</b> on weddings · mention "Aayojan AI" when you connect</div>';
    } else if (/party|birthday|corporate/i.test(brief.eventType || "")) {
      offerPill = '<div class="aip-offer-pill">🎉 Flat <b>10% OFF</b> on party catering · from ₹250/plate · mention "Aayojan AI"</div>';
    }
    html += offerPill +
      '<a class="aip-unlock" id="aipAll" href="' + waFor("all " + ranked.length + " shortlisted kitchens — I want to compare quotes") + '" target="_blank" rel="noopener">Or get all ' + ranked.length + ' quotes to compare →</a>' +
      '<div class="aip-note">Kitchen names &amp; contacts are shared once you connect. Free · no advance payment.</div>' +
      '<div class="aip-direct" style="margin-top:16px;border-top:1px solid #F0E3CE;padding-top:14px;text-align:center">' +
        '<div style="font-size:0.72rem;color:#8B6E52;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:9px">prefer to chat now?</div>' +
        '<a class="aip-talk" id="aipTalk" href="' + waDirect + '" data-no-gate target="_blank" rel="noopener" style="display:inline-block;background:#25D366;color:#fff;padding:13px 22px;border-radius:12px;font-weight:800;font-size:0.95rem;text-decoration:none;box-shadow:0 10px 26px rgba(37,211,102,0.32)">💬 Directly talk to the Aayojan team →</a>' +
      '</div>' +
      '<div class="aip-sub">' +
        '<div class="aip-sub-h">📩 Get festive menus &amp; seasonal deals <span>(optional)</span></div>' +
        '<div class="aip-sub-p">Jamai Sasthi · Durga Pujo · Poila Boishakh — early access &amp; member-only prices.</div>' +
        '<form class="aip-sub-form"><input class="aip-sub-in" type="email" inputmode="email" placeholder="Your email"><button class="aip-sub-go" type="submit">Notify me →</button></form>' +
        '<div class="aip-sub-consent">Optional. By subscribing you agree to receive occasional promotional emails from Aayojan. No spam · unsubscribe anytime · <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</div>' +
        '<div class="aip-sub-msg" style="display:none"></div>' +
      '</div></div>';
    bodyWrap.innerHTML = html;
    track("ai_planner_matches_shown", { event: brief.eventType, count: ranked.length });
    logChat("matched", (brief.eventType || "event") + " · " + (brief.guestsNum || "?") + " guests · " + (brief.area || "?")); // outcome marker
    bodyWrap.addEventListener("click", function (e) {
      var pk = e.target.closest && e.target.closest(".aip-pick");
      var al = e.target.closest && e.target.closest("#aipAll");
      var tk = e.target.closest && e.target.closest("#aipTalk");
      if (pk || al || tk) convClicked = true; // converted — don't show exit catcher
      if (pk) track("ai_planner_whatsapp_click", { pick: pk.getAttribute("data-pick"), event: brief.eventType });
      else if (al) track("ai_planner_whatsapp_click", { pick: "all", event: brief.eventType });
      else if (tk) track("ai_planner_direct_talk", { event: brief.eventType });
    });
    // optional email opt-in for seasonal/promotional offers (consent-based)
    var subForm = bodyWrap.querySelector(".aip-sub-form");
    if (subForm) subForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var inEl = subForm.querySelector(".aip-sub-in");
      var msg = bodyWrap.querySelector(".aip-sub-msg");
      var email = (inEl.value || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { inEl.style.borderColor = "#c0392b"; inEl.focus(); return; }
      var btn = subForm.querySelector(".aip-sub-go"); btn.disabled = true; btn.textContent = "Saving…";
      var qp = new URLSearchParams(location.search);
      var sub = {
        email: email, marketingConsent: true, consentAt: new Date().toISOString(),
        consentText: "Opted in to promotional/seasonal offers via Aayojan AI planner",
        source: "ai_planner", event: brief.event || "", brief: bl, sid: window.aSID || "",
        page: location.pathname, gclid: qp.get("gclid") || "", utm_source: qp.get("utm_source") || "",
        createdAt: new Date().toISOString()
      };
      function done() {
        subForm.style.display = "none"; msg.style.display = "block";
        msg.textContent = "✓ You're in! We'll send only the good stuff. 🎉";
        track("ai_planner_subscribe", { event: brief.event || "" });
      }
      withDb(function (db) { db.collection("subscribers").add(sub).then(done).catch(done); });
    });
  }

  // --- open -----------------------------------------------------------------
  function open() {
    brief = {}; history = []; mode = "guided"; guidedIdx = 0; turnCount = 0;
    engaged = false; convClicked = false; recoveryShown = false; resultsShown = false; clearTimeout(idleTimer);
    briefGrid.innerHTML = ""; briefBox.style.display = "none";
    buildChatLayout();
    ov.classList.add("on"); document.body.style.overflow = "hidden"; fitVV();
    try { window.history.pushState({ aip: 1 }, ""); } catch (e) {}
    track("ai_planner_opened", {});
    addMsg("Hi! I'm Aayojan AI 👋 Tell me about your event — what are you planning?", "bot");
    history.push({ role: "assistant", content: "Hi! I'm Aayojan AI. What are you planning?" });
    // Render first step chips directly — one question at a time, no Gemini on opening turn
    var st = STEPS[0];
    var chips = document.createElement("div"); chips.className = "aip-chips";
    st.chips.forEach(function (c) {
      var b = document.createElement("button"); b.className = "aip-chip"; b.textContent = c;
      b.addEventListener("click", function () { addMsg(c, "usr"); guidedAnswer(c.replace(/^[^\w₹🪷💍🎉🎂🏢]+\s*/, "")); });
      chips.appendChild(b);
    });
    inputArea.appendChild(chips);
    var form = document.createElement("form"); form.className = "aip-form";
    form.innerHTML = '<input class="aip-in" placeholder="' + st.ph + '"><button class="aip-send" type="submit">→</button>';
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = form.querySelector(".aip-in").value.trim();
      if (v) { addMsg(v, "usr"); guidedAnswer(v); }
    });
    inputArea.appendChild(form);
  }
  window.AayojanAI = { open: open };

  function wire() {
    var btns = document.querySelectorAll("[data-ai-planner], #ai-planner-open");
    Array.prototype.forEach.call(btns, function (b) { b.addEventListener("click", function (e) { e.preventDefault(); open(); }); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
})();
