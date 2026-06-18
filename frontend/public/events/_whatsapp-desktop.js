/* ============================================================================
 * Aayojan · Universal WhatsApp lead gate  (mobile + desktop)
 * ----------------------------------------------------------------------------
 * Raw wa.me links attract bots / spammers / accidental ad-clicks and capture
 * NOTHING when a visitor bails. So on EVERY device we intercept WhatsApp clicks
 * and gate them behind a short high-intent form:
 *   • the event brief (carried in the wa.me ?text=) is shown pre-filled
 *   • visitor leaves just name + phone  -> stored in Firestore (customerLeads)
 *   • THEN we offer "Open WhatsApp now" to continue the chat (native on mobile,
 *     WhatsApp Web / QR on desktop)
 * This filters bots (they won't fill a form), captures the lead even if they
 * never message, and gives Google Ads a clean conversion (lead_submitted).
 * Firebase is LAZY-loaded only on submit -> zero page-load cost otherwise.
 * Privacy: minimal fields, explicit consent, /privacy.html linked, honeypot.
 * ========================================================================== */
(function () {
  "use strict";

  function isDesktop() {
    var ua = navigator.userAgent || "";
    var mobileUA = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry|Opera Mini/i.test(ua);
    var coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    return !mobileUA && !coarse;
  }
  var MOBILE = !isDesktop();

  var NUMBER_DISPLAY = "+91 80884 34425";
  var WA = "918088434425";
  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyBPvK0452Kgkp0Oevxm1zMRUWiqKdhmaZA",
    authDomain: "aayojan-a8c4f.firebaseapp.com",
    projectId: "aayojan-a8c4f",
    storageBucket: "aayojan-a8c4f.firebasestorage.app",
    messagingSenderId: "673829788583",
    appId: "1:673829788583:web:9f140241bf0466b197b482"
  };

  function track(e, p) {
    if (typeof window.aTrack === "function") window.aTrack(e, p || {});
    else if (typeof window.gtag === "function") window.gtag("event", e, p || {});
  }

  // --- styles ---------------------------------------------------------------
  var css = document.createElement("style");
  css.textContent =
    ".wad-overlay{position:fixed;inset:0;background:rgba(20,12,4,0.62);display:none;align-items:center;justify-content:center;z-index:100002;padding:20px;}" +
    ".wad-overlay.wad-open{display:flex;}" +
    ".wad-modal{background:#fff;border-radius:20px;max-width:360px;width:100%;max-height:92vh;overflow:auto;padding:28px 24px 24px;text-align:center;position:relative;box-shadow:0 30px 80px rgba(0,0,0,0.4);font-family:'DM Sans',system-ui,sans-serif;}" +
    ".wad-close{position:absolute;top:8px;right:12px;border:none;background:none;font-size:28px;line-height:1;color:#8B6E52;cursor:pointer;}" +
    ".wad-title{font-family:'Playfair Display',serif;font-size:1.35rem;font-weight:800;color:#1A1208;margin:0 0 6px;}" +
    ".wad-sub{font-size:0.86rem;color:#8B6E52;line-height:1.5;margin:0 auto 16px;max-width:300px;}" +
    ".wad-brief{background:#FFF7EC;border:1px solid #EDD8BC;border-radius:12px;padding:12px 14px;margin:0 0 14px;text-align:left;}" +
    ".wad-brief-h{font-size:0.76rem;font-weight:800;color:#236B43;margin-bottom:6px;}" +
    ".wad-brow{font-size:0.84rem;color:#5b4632;line-height:1.65;}" +
    ".wad-brow b{color:#8B6E52;font-weight:700;}" +
    ".wad-form{display:flex;flex-direction:column;gap:8px;text-align:left;}" +
    ".wad-xhint{font-size:0.74rem;font-weight:800;color:#236B43;margin:2px 2px 2px;}" +
    ".wad-extra select.wad-in{background:#fff;}" +
    ".wad-in{width:100%;padding:12px 12px;border:1.5px solid #EDD8BC;border-radius:10px;font-size:0.95rem;font-family:inherit;}" +
    ".wad-in:focus{outline:none;border-color:#E8760A;}" +
    ".wad-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0;}" +
    ".wad-submit{width:100%;min-height:48px;background:#E8760A;color:#fff;border:none;border-radius:10px;font-weight:800;font-size:1rem;cursor:pointer;}" +
    ".wad-submit:disabled{opacity:0.6;cursor:default;}" +
    ".wad-consent{font-size:0.72rem;color:#8B6E52;text-align:center;line-height:1.45;}" +
    ".wad-direct{display:block;text-align:center;margin-top:12px;color:#1FA855;font-weight:800;font-size:0.92rem;text-decoration:none;}" +
    ".wad-direct:hover{text-decoration:underline;}" +
    ".wad-err{color:#c0392b;font-size:0.82rem;margin-top:8px;}" +
    ".wad-done{color:#236B43;font-weight:800;font-size:1rem;margin:6px 0 14px;}" +
    ".wad-go{display:block;width:100%;min-height:50px;line-height:50px;background:#25D366;color:#fff;border-radius:12px;font-weight:800;font-size:1rem;text-decoration:none;box-shadow:0 12px 30px rgba(37,211,102,0.32);}" +
    ".wad-secondary{margin-top:18px;border-top:1px solid #F0E3CE;padding-top:14px;}" +
    ".wad-or{margin:0 0 12px;color:#8B6E52;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.1em;}" +
    ".wad-qr{width:200px;height:200px;border-radius:12px;border:1px solid #EDD8BC;display:inline-block;background:#FFF9F1;}" +
    ".wad-num{margin-top:12px;font-weight:800;font-size:1.05rem;color:#1A1208;letter-spacing:0.02em;}" +
    ".wad-web{display:inline-block;margin-top:10px;font-size:0.82rem;color:#E8760A;font-weight:700;text-decoration:none;}" +
    ".wad-web:hover{text-decoration:underline;}";
  document.head.appendChild(css);

  // --- modal (built once) ---------------------------------------------------
  var overlay = document.createElement("div");
  overlay.className = "wad-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML =
    '<div class="wad-modal" role="dialog" aria-modal="true" aria-label="Get your kitchens on WhatsApp">' +
    '<button class="wad-close" aria-label="Close">&times;</button>' +
    '<h3 class="wad-title">Almost there 🎉</h3>' +
    '<p class="wad-sub">A few quick details and we&#39;ll WhatsApp you menus &amp; quotes. <strong>100% free — no payment, no spam.</strong></p>' +
    '<div class="wad-brief" style="display:none"></div>' +
    '<form class="wad-form" novalidate>' +
    '<input class="wad-in" name="name" placeholder="Your name *" autocomplete="name">' +
    '<input class="wad-in" name="phone" type="tel" placeholder="Phone / WhatsApp number *" autocomplete="tel" inputmode="tel">' +
    // event + guests + date are required on EVERY lead (pre-filled from the planner when available)
    '<div class="wad-extra">' +
    '<select class="wad-in" name="xevent">' +
    '<option value="">Event type *…</option>' +
    '<option>Party / get-together</option><option>Birthday</option><option>Jamai Sasthi</option>' +
    '<option>Wedding</option><option>Annaprasan</option><option>Corporate</option><option>Bhai Phota</option><option>Griha Pravesh</option>' +
    "</select>" +
    '<div style="display:flex;gap:8px;margin-top:8px">' +
    '<input class="wad-in" name="xguests" type="number" inputmode="numeric" placeholder="Guest count *" style="flex:1">' +
    '<input class="wad-in" name="xdate" placeholder="Event date *" style="flex:1">' +
    "</div></div>" +
    '<input class="wad-hp" name="company" tabindex="-1" autocomplete="off" aria-hidden="true">' +
    '<button class="wad-submit" type="submit">Get my kitchens →</button>' +
    '<div class="wad-consent">We&#39;ll only use this to contact you about your enquiry. <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a></div>' +
    '<a class="wad-direct" data-no-gate target="_blank" rel="noopener">💬 Or talk to us directly on WhatsApp →</a>' +
    '<div class="wad-err" style="display:none"></div>' +
    "</form>" +
    '<div class="wad-success" style="display:none">' +
    '<div class="wad-done">✓ Saved! Our team will WhatsApp you <strong>within 4 hours</strong> — usually much sooner.</div>' +
    '<a class="wad-go" target="_blank" rel="noopener">💬 Open WhatsApp now →</a>' +
    "</div>" +
    '<div class="wad-secondary">' +
    '<div class="wad-or">— or message us directly —</div>' +
    '<img class="wad-qr" alt="WhatsApp QR code">' +
    '<div class="wad-num">📱 ' + NUMBER_DISPLAY + "</div>" +
    '<a class="wad-web" target="_blank" rel="noopener">Open WhatsApp on this computer &rarr;</a>' +
    "</div>" +
    "</div>";
  document.body.appendChild(overlay);

  var qr = overlay.querySelector(".wad-qr");
  var web = overlay.querySelector(".wad-web");
  var briefBox = overlay.querySelector(".wad-brief");
  var secondary = overlay.querySelector(".wad-secondary");
  var successBox = overlay.querySelector(".wad-success");
  var goBtn = overlay.querySelector(".wad-go");
  var form = overlay.querySelector(".wad-form");
  var directLink = overlay.querySelector(".wad-direct");

  // brief carried in the wa.me ?text=, populated when any WhatsApp CTA is pressed
  var ctxMessage = "", ctxEvent = "", ctxBrief = "", ctxHref = "";

  function parseText(href) {
    try {
      // URLSearchParams.get() already decodes — do NOT decodeURIComponent again
      // (the planner link contains a literal "%" from the match score, which
      // made a second decode throw and silently drop the whole brief).
      var q = href.split("?")[1] || "";
      return (new URLSearchParams(q)).get("text") || "";
    } catch (e) { return ""; }
  }
  // event / guests / date are now collected as required fields, so the read-only
  // brief box only shows the EXTRA context (food, area, budget, tasting…).
  function renderBrief(text) {
    var rows = [];
    (text || "").split("\n").forEach(function (l) {
      l = l.trim();
      if (/^(Food|Cuisine|Area|Budget|Tasting|Pick|Match):/i.test(l)) rows.push(l);
    });
    if (!rows.length) { briefBox.style.display = "none"; return ""; }
    briefBox.innerHTML = '<div class="wad-brief-h">✓ Your event details — already saved:</div>' +
      rows.map(function (r) {
        var i = r.indexOf(":");
        return '<div class="wad-brow"><b>' + r.slice(0, i) + ':</b> ' + r.slice(i + 1).trim() + "</div>";
      }).join("");
    briefBox.style.display = "block";
    return rows.join(" · ");
  }

  // parse "Key: value" lines from a carried brief, and map a free-form event
  // string onto one of the dropdown options so planner leads pre-fill cleanly.
  function parseBriefMap(msg) {
    var m = {};
    (msg || "").split("\n").forEach(function (l) {
      var i = l.indexOf(":"); if (i < 0) return;
      var k = l.slice(0, i).trim().toLowerCase(), v = l.slice(i + 1).trim();
      if (k && !m[k]) m[k] = v;
    });
    return m;
  }
  var EVMAP = [
    ["jamai|sasthi|shashti", "Jamai Sasthi"], ["wedding|reception|shaadi|marriage", "Wedding"],
    ["birthday|bday", "Birthday"], ["annaprasan|mukhe|aiburo|bhat", "Annaprasan"],
    ["corporate|office|conference|lunch", "Corporate"], ["bhai|phota", "Bhai Phota"],
    ["griha|housewarm|pravesh", "Griha Pravesh"], ["party|get.?together|kitty|anniversary|reunion", "Party / get-together"]
  ];
  function matchEvent(s) { s = (s || "").toLowerCase(); for (var i = 0; i < EVMAP.length; i++) { if (new RegExp(EVMAP[i][0]).test(s)) return EVMAP[i][1]; } return ""; }

  function openModal(href) {
    ctxHref = href;
    ctxMessage = parseText(href);
    ctxBrief = renderBrief(ctxMessage);
    var m = /Event:\s*(.+)/i.exec(ctxMessage);
    ctxEvent = m ? m[1].trim() : "";
    goBtn.setAttribute("href", href);
    if (directLink) directLink.setAttribute("href", href);
    web.setAttribute("href", href);
    // reset state for reuse
    form.style.display = "";
    successBox.style.display = "none";
    var btn = form.querySelector(".wad-submit");
    btn.disabled = false; btn.textContent = "Get my kitchens →";
    overlay.querySelector(".wad-err").style.display = "none";
    // pre-fill event / guests / date from the carried brief (planner) so it's one tap;
    // empty otherwise (generic clicks) — but always required before we save.
    var bm = parseBriefMap(ctxMessage);
    var xev = form.querySelector('[name="xevent"]'), xg = form.querySelector('[name="xguests"]'), xd = form.querySelector('[name="xdate"]');
    xev.value = matchEvent(ctxEvent || bm.event || "");
    xg.value = (bm.guests || "").replace(/[^\d]/g, "");
    xd.value = bm.date || "";
    [xev, xg, xd].forEach(function (el) { el.style.borderColor = ""; });
    // QR / "open on this computer" only make sense on desktop
    if (MOBILE) {
      secondary.style.display = "none";
    } else {
      secondary.style.display = "block";
      qr.src = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=" + encodeURIComponent(href);
    }
    overlay.classList.add("wad-open");
    overlay.setAttribute("aria-hidden", "false");
    track("whatsapp_gate_open", { url: href, device: MOBILE ? "mobile" : "desktop", hasBrief: !!ctxBrief });
  }
  function closeModal() {
    overlay.classList.remove("wad-open");
    overlay.setAttribute("aria-hidden", "true");
  }
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay || (e.target.classList && e.target.classList.contains("wad-close"))) closeModal();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });
  qr.addEventListener("error", function () { qr.style.display = "none"; });
  goBtn.addEventListener("click", function () { track("whatsapp_continue", { event: ctxEvent, device: MOBILE ? "mobile" : "desktop" }); });
  if (directLink) directLink.addEventListener("click", function () { track("whatsapp_direct_skip", { event: ctxEvent, device: MOBILE ? "mobile" : "desktop" }); closeModal(); });

  // --- Firebase (lazy-loaded only when the form is submitted) ----------------
  function withDb(cb, onerr) {
    function go() {
      try {
        if (!window.firebase.apps || !window.firebase.apps.length) window.firebase.initializeApp(FIREBASE_CONFIG);
        cb(window.firebase.firestore());
      } catch (e) { onerr(e); }
    }
    if (window.firebase && window.firebase.firestore) return go();
    var base = "https://www.gstatic.com/firebasejs/10.12.2/";
    var s1 = document.createElement("script");
    s1.src = base + "firebase-app-compat.js";
    s1.onload = function () {
      var s2 = document.createElement("script");
      s2.src = base + "firebase-firestore-compat.js";
      s2.onload = go;
      s2.onerror = onerr;
      document.head.appendChild(s2);
    };
    s1.onerror = onerr;
    document.head.appendChild(s1);
  }

  // --- high-intent form (consent-based; stored in Firestore customerLeads) ---
  var nameIn = form.querySelector('[name="name"]');
  var phoneIn = form.querySelector('[name="phone"]');
  var hpIn = form.querySelector('[name="company"]'); // honeypot
  var errMsg = overlay.querySelector(".wad-err");
  var qp = new URLSearchParams(location.search);

  function showSuccess() {
    form.style.display = "none";
    briefBox.style.display = "none";
    secondary.style.display = "none";
    successBox.style.display = "block";
    // on mobile, auto-focus the continue button so one tap finishes into WhatsApp
    if (MOBILE) { try { goBtn.focus(); } catch (e) {} }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errMsg.style.display = "none";

    // honeypot: bots fill hidden fields -> pretend success, store nothing
    if (hpIn && hpIn.value) { showSuccess(); return; }

    var phone = (phoneIn.value || "").trim();
    if (phone.replace(/\D/g, "").length < 10) {
      phoneIn.style.borderColor = "#c0392b"; phoneIn.focus();
      errMsg.textContent = "Please enter a valid phone number."; errMsg.style.display = "block";
      return;
    }
    // require event + guests + date on EVERY lead (anti-spam minimum)
    var xev = form.querySelector('[name="xevent"]'), xg = form.querySelector('[name="xguests"]'), xd = form.querySelector('[name="xdate"]');
    var evV = (xev.value || "").trim(), gV = (xg.value || "").trim(), dV = (xd.value || "").trim();
    var miss = !evV ? xev : !gV ? xg : !dV ? xd : null;
    if (miss) {
      [xev, xg, xd].forEach(function (el) { el.style.borderColor = ""; });
      miss.style.borderColor = "#c0392b"; miss.focus();
      errMsg.textContent = "Please add your event, guest count and date so we can quote.";
      errMsg.style.display = "block";
      return;
    }
    // keep any extra context the planner already gathered (food / area / budget / tasting)
    var extras = [];
    (ctxMessage || "").split("\n").forEach(function (l) { l = l.trim(); if (/^(Food|Cuisine|Area|Budget|Tasting):/i.test(l)) extras.push(l); });
    ctxEvent = evV;
    var lines = ["Event: " + evV, "Guests: " + gV, "Date: " + dV].concat(extras);
    ctxBrief = lines.join(" · ");
    ctxMessage = "Hi Aayojan! I'd like a quote.\n" + lines.join("\n");
    var nh = "https://wa.me/" + WA + "?text=" + encodeURIComponent(ctxMessage);
    goBtn.setAttribute("href", nh); web.setAttribute("href", nh); // carry full brief into WhatsApp

    var btn = form.querySelector(".wad-submit");
    btn.disabled = true; btn.textContent = "Saving…";

    function fail() {
      btn.disabled = false; btn.textContent = "Get my kitchens →";
      errMsg.textContent = "Couldn't save right now — please WhatsApp us at " + NUMBER_DISPLAY + ".";
      errMsg.style.display = "block";
    }

    var lead = {
      name: (nameIn.value || "").trim(),
      phone: phone,
      event: ctxEvent || "",
      guests: gV || "",
      date: dV || "",
      brief: ctxBrief || "",
      message: ctxMessage || "",
      source: (location.pathname.split("/").filter(Boolean)[0] || "home"),
      sid: window.aSID || "",
      device: MOBILE ? "mobile" : "desktop",
      page: location.pathname,
      gclid: qp.get("gclid") || "",
      utm_source: qp.get("utm_source") || "",
      utm_campaign: qp.get("utm_campaign") || "",
      status: "new",
      createdAt: new Date().toISOString()
    };

    withDb(function (db) {
      db.collection("customerLeads").add(lead)
        .then(function () {
          showSuccess();
          // canonical conversion -> mark this as a key event in GA4 & import to Google Ads
          track("lead_submitted", { event: lead.event, device: lead.device, hasBrief: !!ctxBrief, page: lead.page });
          track("callback_requested", { event: lead.event, hasBrief: !!ctxBrief }); // back-compat
        })
        .catch(fail);
    }, fail);
  });

  // --- intercept customer WhatsApp clicks (every device) --------------------
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (!/wa\.me|api\.whatsapp\.com/i.test(href)) return;
    // Do NOT gate caterer/partner-recruitment chats — those aren't customer leads.
    if (a.hasAttribute("data-no-gate")) return;                 // explicit opt-out
    if (/partner/i.test(href.split("text=")[1] || "")) return;  // "...join as partner" / "I am a caterer ... partner"
    e.preventDefault();
    openModal(href);
  });
})();
