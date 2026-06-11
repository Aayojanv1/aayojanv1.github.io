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

  // --- aliased verified kitchens (names withheld until the lead connects) ----
  var KITCHENS = [
    { tag: "Multi-Cuisine Kitchen · Newtown", cuisines: "Bengali · Mughlai · Continental", pMin: 350, pMax: 1200, gMin: 10, gMax: 1000, events: ["Wedding", "Party", "Birthday", "Corporate", "Annaprasan", "Griha Pravesh", "Bhai Phota"], areas: ["Newtown", "Salt Lake", "Rajarhat"] },
    { tag: "Bengali Home-Style · Salt Lake", cuisines: "Bengali · home-style · niramish", pMin: 300, pMax: 600, gMin: 10, gMax: 300, events: ["Party", "Annaprasan", "Bhai Phota", "Griha Pravesh", "Birthday"], areas: ["Salt Lake", "Newtown"] },
    { tag: "Banquet Kitchen · Rajarhat", cuisines: "Multi-cuisine · up to 5000", pMin: 350, pMax: 1200, gMin: 50, gMax: 5000, events: ["Wedding", "Corporate", "Party", "Birthday"], areas: ["Rajarhat", "Newtown", "Salt Lake"] },
    { tag: "Premium Bengali & Mughlai", cuisines: "Bengali · Mughlai · Chinese", pMin: 400, pMax: 1300, gMin: 15, gMax: 800, events: ["Wedding", "Party", "Annaprasan", "Birthday"], areas: ["Newtown", "Salt Lake"] },
    { tag: "Continental & Chinese Kitchen", cuisines: "Continental · Chinese · multi", pMin: 350, pMax: 900, gMin: 10, gMax: 600, events: ["Party", "Birthday", "Corporate", "Wedding"], areas: ["Newtown", "Salt Lake", "Rajarhat"] }
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
    if (/jamai|sasthi|shashti|son.?in.?law/.test(s)) return "Jamai";
    if (/party|get.?together|kitty|anniversary|house ?party|reunion|farewell|small order|order for/.test(s)) return "Party";
    return "Party";
  }
  // --- service area: Newtown, Salt Lake, Rajarhat + adjoining -----------------
  var CATCHMENT = ["Newtown", "Salt Lake", "Rajarhat", "Baguiati", "Kestopur", "VIP Road",
    "Lake Town", "Chinar Park", "Teghoria", "Dum Dum", "Ultadanga", "Kaikhali", "Hatiara", "Sector V"];
  function normArea(a) {
    a = (a || "").toLowerCase();
    var map = [
      ["newtown|new town|action area|eco ?park", "Newtown"],
      ["salt ?lake|bidhannagar|sector ?v|sector ?5|sec ?5", "Salt Lake"],
      ["rajarhat|gopalpur", "Rajarhat"],
      ["bagui?h?ati", "Baguiati"], ["ke?shtopur|kestopur", "Kestopur"], ["vip ?(road|rd)", "VIP Road"],
      ["lake ?town", "Lake Town"], ["chinar", "Chinar Park"], ["teghor", "Teghoria"],
      ["dum ?dum", "Dum Dum"], ["ultadanga", "Ultadanga"], ["kaikhali", "Kaikhali"], ["hatiara", "Hatiara"]
    ];
    for (var i = 0; i < map.length; i++) { if (new RegExp(map[i][0]).test(a)) return map[i][1]; }
    return a ? a.charAt(0).toUpperCase() + a.slice(1) : "";
  }
  function inCatchment(area) { return !area || CATCHMENT.indexOf(area) >= 0; }
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
    if (b.area && (k.areas.indexOf(b.area) >= 0 || CATCHMENT.indexOf(b.area) >= 0)) r.push("Covers " + b.area);
    var g = b.guestsNum || 50;
    if (g >= k.gMin && g <= k.gMax) r.push(g + "-guest capacity");
    if (b.budgetMid && b.budgetMid >= k.pMin - 80 && b.budgetMid <= k.pMax + 80) r.push("Within budget");
    if (!r.length) r.push("Matched to your event");
    return r.slice(0, 3);
  }

  // --- guided fallback steps (used only if Gemini is unavailable) -----------
  var STEPS = [
    { key: "event", q: "What are you planning?", chips: ["🎣 Jamai Sasthi", "💍 Wedding", "🎉 Party order", "🎂 Birthday", "🏢 Corporate"], ph: "your event" },
    { key: "guests", q: "Roughly how many guests?", chips: ["25", "50", "100", "200", "500"], ph: "guests" },
    { key: "cuisine", q: "Veg, non-veg, or both — any must-haves?", chips: ["🥬 Veg", "🍗 Non-veg", "🍽️ Both", "🌱 Jain"], ph: "e.g. both, must have biryani" },
    { key: "date", q: "When's the event?", chips: ["This month", "Next month", "In 2–3 months"], ph: "date / timeframe" },
    { key: "area", q: "Which area? (we cover Newtown, Salt Lake, Rajarhat & nearby)", chips: ["Newtown", "Salt Lake", "Rajarhat", "Baguiati", "VIP Road", "Other"], ph: "your area" },
    { key: "budget", q: "Budget per plate?", chips: ["₹300–500", "₹500–800", "₹800–1200"], ph: "₹ per plate" }
  ];

  // --- styles ---------------------------------------------------------------
  var css = document.createElement("style");
  css.textContent =
    ".aip-ov{position:fixed;top:0;left:0;right:0;height:100vh;height:100dvh;z-index:100000;display:none;background:linear-gradient(180deg,#1A1208,#0F0A05);overflow:hidden;}" +
    ".aip-ov.on{display:flex;flex-direction:column;}" +
    ".aip-ov::before{content:'';position:absolute;top:-120px;left:50%;transform:translateX(-50%);width:700px;height:400px;background:radial-gradient(ellipse,rgba(232,118,10,0.18),transparent 65%);pointer-events:none;}" +
    ".aip-top{position:relative;display:flex;align-items:center;gap:10px;padding:calc(14px + env(safe-area-inset-top)) 16px 14px;border-bottom:1px solid rgba(243,200,105,0.15);}" +
    ".aip-bot{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 50% 35%,#FFF4DC,#F3C869);font-size:18px;}" +
    ".aip-ttl{font-family:'Playfair Display',serif;font-weight:800;color:#FFF8EF;font-size:1rem;line-height:1.1;}" +
    ".aip-ttl small{display:block;font-family:'DM Sans',sans-serif;font-weight:600;font-size:0.7rem;color:#86efac;}" +
    ".aip-x{margin-left:auto;background:none;border:none;color:#cbbfa9;font-size:24px;cursor:pointer;line-height:1;}" +
    ".aip-brief{margin:10px 14px 0;background:rgba(255,248,239,0.05);border:1px solid rgba(243,200,105,0.2);border-radius:14px;padding:10px 12px;}" +
    ".aip-brief-h{font-size:0.72rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#F3C869;margin-bottom:7px;}" +
    ".aip-brief-grid{display:flex;flex-wrap:wrap;gap:6px;}" +
    ".aip-bf{background:rgba(35,107,67,0.18);border:1px solid rgba(134,239,172,0.3);color:#cdebd6;border-radius:8px;padding:4px 9px;font-size:12px;font-weight:600;opacity:0;transform:translateY(6px);animation:aipPop .35s ease forwards;}" +
    "@keyframes aipPop{to{opacity:1;transform:none;}}" +
    ".aip-body{position:relative;flex:1;display:flex;flex-direction:column;max-width:560px;width:100%;margin:0 auto;overflow:hidden;}" +
    ".aip-chat{flex:1;overflow-y:auto;padding:14px 14px 8px;display:flex;flex-direction:column;gap:9px;}" +
    ".aip-msg{max-width:84%;padding:10px 13px;border-radius:15px;font-size:14.5px;line-height:1.4;font-weight:500;white-space:pre-wrap;overflow-wrap:break-word;word-break:break-word;}" +
    ".aip-msg.bot{background:rgba(255,248,239,0.08);border:1px solid rgba(255,248,239,0.12);color:#FFF8EF;border-bottom-left-radius:5px;margin-right:auto;}" +
    ".aip-msg.usr{background:var(--saffron,#E8760A);color:#fff;border-bottom-right-radius:5px;margin-left:auto;}" +
    ".aip-typing{display:flex;gap:4px;padding:12px 14px;}" +
    ".aip-typing i{width:7px;height:7px;border-radius:50%;background:#F3C869;animation:aipBlink 1.2s infinite;}" +
    ".aip-typing i:nth-child(2){animation-delay:.2s;}.aip-typing i:nth-child(3){animation-delay:.4s;}" +
    "@keyframes aipBlink{0%,80%,100%{opacity:.3;transform:translateY(0);}40%{opacity:1;transform:translateY(-3px);}}" +
    ".aip-input{padding:8px 14px calc(14px + env(safe-area-inset-bottom));}" +
    ".aip-chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:8px;}" +
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
    ".aip-card{background:rgba(255,248,239,0.06);border:1px solid rgba(243,200,105,0.2);border-radius:16px;padding:13px;margin-bottom:10px;display:flex;gap:12px;align-items:center;}" +
    ".aip-score{flex-shrink:0;width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#FFF4DC,#F3C869);color:#236B43;font-weight:900;font-size:15px;}" +
    ".aip-cbody{flex:1;min-width:0;}" +
    ".aip-cname{font-family:'Playfair Display',serif;font-weight:800;color:#FFF8EF;font-size:15px;display:flex;align-items:center;gap:6px;}" +
    ".aip-lock{filter:blur(5px);user-select:none;}" +
    ".aip-ccui{font-size:11.5px;color:#cbbfa9;margin:2px 0;}" +
    ".aip-why{font-size:11px;color:#86efac;}" +
    ".aip-pick{flex-shrink:0;align-self:center;background:#25D366;color:#fff;border-radius:11px;padding:10px 12px;font-weight:800;font-size:12.5px;text-decoration:none;white-space:nowrap;box-shadow:0 8px 20px rgba(37,211,102,0.3);}" +
    ".aip-unlock{display:block;width:100%;margin-top:8px;background:transparent;border:1.5px solid rgba(243,200,105,0.45);color:#F3C869;text-align:center;border-radius:13px;padding:12px;font-weight:800;font-size:13.5px;text-decoration:none;cursor:pointer;}" +
    ".aip-free{display:flex;align-items:center;justify-content:center;gap:7px;background:rgba(37,211,102,0.12);border:1px solid rgba(37,211,102,0.32);color:#86efac;font-size:12.5px;font-weight:700;border-radius:11px;padding:11px 12px;margin:2px 0 10px;text-align:center;line-height:1.45;}" +
    ".aip-taste{background:rgba(243,200,105,0.12);border:1px solid rgba(243,200,105,0.34);color:#F3C869;font-size:12.5px;border-radius:11px;padding:11px 12px;margin:0 0 10px;text-align:center;line-height:1.45;}" +
    ".aip-taste b{color:#FFE9B0;}" +
    ".aip-note{text-align:center;color:#a89878;font-size:11px;margin-top:8px;}" +
    ".aip-launch{display:inline-flex;align-items:center;gap:9px;background:linear-gradient(135deg,#E8760A,#C95F08);color:#fff;border:none;border-radius:99px;padding:15px 26px;font-family:'Playfair Display',serif;font-weight:800;font-size:1rem;cursor:pointer;box-shadow:0 14px 36px rgba(232,118,10,0.4);animation:aipGlow 2.4s ease-in-out infinite;}" +
    "@keyframes aipGlow{0%,100%{box-shadow:0 14px 36px rgba(232,118,10,0.4);}50%{box-shadow:0 14px 46px rgba(232,118,10,0.65);}}";
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
  var MAX_TURNS = 15;
  var PROFANITY = /\b(fuck|f+u+c+k|shit|bullshit|bitch|asshole|a\$\$|bastard|cunt|dick|prick|pussy|slut|whore|wanker|bollocks|motherf|mf|bhenchod|madarchod|chutiya|chutiye|gandu|randi|lund|behenchod|bsdk|mc|bc)\b/i;
  function isProfane(t) { return PROFANITY.test(t || ""); }

  ov.querySelector(".aip-x").addEventListener("click", close);
  function close() { ov.classList.remove("on"); document.body.style.overflow = ""; }

  function buildChatLayout() {
    bodyWrap.innerHTML = '<div class="aip-body"><div class="aip-chat" id="aipChat"></div><div class="aip-input" id="aipInput"></div></div>';
    chat = ov.querySelector("#aipChat"); inputArea = ov.querySelector("#aipInput");
  }
  function addMsg(text, who) {
    var d = document.createElement("div"); d.className = "aip-msg " + who; d.textContent = text;
    chat.appendChild(d); chat.scrollTop = chat.scrollHeight;
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
      ["🎣 Jamai Sasthi", "💍 Wedding", "🎉 Party order", "🎂 Birthday", "🏢 Corporate lunch"].forEach(function (c) {
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
      runEngine();
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
        if (data.complete || filled || saysDone) { track("ai_planner_brief_complete", { source: "gemini" }); runEngine(); }
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
    if (guidedIdx >= STEPS.length) { track("ai_planner_brief_complete", { source: "guided" }); runEngine(); return; }
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
    var saysNon = /non.?veg|nonveg/.test(s);
    var saysVeg = /\b(pure ?veg|veg|vegetarian|niramish)\b/.test(s);
    if (saysVeg && !saysNon) return "veg";          // explicit veg wins over dish words
    if (saysNon) return "nonveg";
    if (/chicken|mutton|fish|egg|prawn|chingri|kebab|ilish|hilsa|\bmeat/.test(s)) return "nonveg";
    if (/paneer|aloo|dal|sabzi|niramish/.test(s)) return "veg";
    return "nonveg";
  }
  function dishesFor(val) {
    var ev = detectEvent(brief.event || "");
    var key = MENU[ev] ? ev : (ev === "Birthday" ? "Party" : "default");
    return MENU[key][dietOf(val)];
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
  function runEngine() {
    derive();
    bodyWrap.innerHTML =
      '<div class="aip-engine"><div class="aip-radar"></div><h3>Matching you with verified kitchens…</h3><div class="aip-crit">' +
      ["🍽️ Cuisine fit", "👥 Guest capacity", "📍 Area coverage", "💰 Budget range", "📅 Availability", "✓ FSSAI verified"].map(function (c, i) {
        return '<span style="animation-delay:' + (0.3 + i * 0.32) + 's">' + c + " ✓</span>";
      }).join("") + "</div></div>";
    setTimeout(showResults, 2600);
  }
  function showResults() {
    var ranked = KITCHENS.map(function (k) { return { k: k, pct: score(k, brief) }; })
      .sort(function (a, b) { return b.pct - a.pct; }).slice(0, 3);
    var taste = (brief.tasting && !/^no/i.test(brief.tasting)) ? brief.tasting
      : (brief.eventType === "Wedding" ? "yes — before booking" : "");
    var bl = "Event: " + (brief.event || "") + "\nGuests: " + (brief.guests || "") + "\nFood: " + (brief.cuisine || "") +
      "\nDate: " + (brief.date || "") + "\nArea: " + (brief.area || "") + "\nBudget: " + (brief.budget || "") +
      (taste ? "\nTasting: " + taste : "");
    function waFor(label) {
      return "https://wa.me/" + WA + "?text=" + encodeURIComponent(
        "Hi Aayojan! Aayojan AI matched me — please connect me with " + label + ".\n" + bl);
    }
    var html = '<div class="aip-res"><h3>✨ 3 kitchens matched</h3><p class="sub">Your AI shortlist · ' + (brief.eventType || "event").toLowerCase() + " · " + (brief.guestsNum || "") + ' guests · unlock any you like</p>' +
      '<div class="aip-free">💬 100% free — no payment, no spam. We just connect you on WhatsApp 🙂</div>' +
      (brief.eventType === "Wedding" ? '<div class="aip-taste">🍴 <b>Free food tasting</b> — for weddings we set up a tasting with your matched kitchens before you book.</div>' : "");
    ranked.forEach(function (r, i) {
      var label = "match #" + (i + 1) + " (" + r.pct + "% · " + r.k.cuisines + ")";
      html += '<div class="aip-card"><div class="aip-score">' + r.pct + '%</div><div class="aip-cbody">' +
        '<div class="aip-cname">🔒 <span class="aip-lock">' + r.k.tag + "</span></div>" +
        '<div class="aip-ccui">' + r.k.cuisines + "</div>" +
        '<div class="aip-why">✓ ' + reasons(r.k, brief).join(" · ") + "</div></div>" +
        '<a class="aip-pick" href="' + waFor(label) + '" target="_blank" rel="noopener" data-pick="' + (i + 1) + '">🔓 Unlock</a></div>';
    });
    html += '<a class="aip-unlock" id="aipAll" href="' + waFor("all 3 shortlisted kitchens — I want to compare quotes") + '" target="_blank" rel="noopener">Or get all 3 quotes to compare →</a>' +
      '<div class="aip-note">Kitchen names &amp; contacts are shared once you connect. Free · no advance payment.</div></div>';
    bodyWrap.innerHTML = html;
    track("ai_planner_matches_shown", { event: brief.eventType, count: ranked.length });
    bodyWrap.addEventListener("click", function (e) {
      var pk = e.target.closest && e.target.closest(".aip-pick");
      var al = e.target.closest && e.target.closest("#aipAll");
      if (pk) track("ai_planner_whatsapp_click", { pick: pk.getAttribute("data-pick"), event: brief.eventType });
      else if (al) track("ai_planner_whatsapp_click", { pick: "all", event: brief.eventType });
    });
  }

  // --- open -----------------------------------------------------------------
  function open() {
    brief = {}; history = []; mode = "gemini"; guidedIdx = 0; turnCount = 0;
    briefGrid.innerHTML = ""; briefBox.style.display = "none";
    buildChatLayout();
    ov.classList.add("on"); document.body.style.overflow = "hidden";
    track("ai_planner_opened", {});
    addMsg("Hi! I'm Aayojan AI 👋 Tell me about your event — what are you planning?", "bot");
    history.push({ role: "assistant", content: "Hi! I'm Aayojan AI. What are you planning?" });
    renderFree(true);
  }
  window.AayojanAI = { open: open };

  function wire() {
    var btns = document.querySelectorAll("[data-ai-planner], #ai-planner-open");
    Array.prototype.forEach.call(btns, function (b) { b.addEventListener("click", function (e) { e.preventDefault(); open(); }); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
})();
