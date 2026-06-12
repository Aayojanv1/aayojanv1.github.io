/* ============================================================================
 * Aayojan · Quick Quote — 1-screen lead capture (fast path, no full AI chat)
 * For impulse/party orders: name + phone + date + guests + diet -> Firestore
 * customerLeads, then offer WhatsApp. Triggered by any [data-quick-quote].
 * Firebase is lazy-loaded only on submit (zero page-load cost otherwise).
 * ========================================================================== */
(function () {
  "use strict";
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

  var css = document.createElement("style");
  css.textContent =
    ".qq-ov{position:fixed;inset:0;z-index:100002;display:none;align-items:center;justify-content:center;background:rgba(20,12,4,0.62);padding:16px;}" +
    ".qq-ov.on{display:flex;}" +
    ".qq-modal{background:#fff;border-radius:20px;max-width:380px;width:100%;max-height:92vh;overflow:auto;padding:24px 22px;position:relative;font-family:'DM Sans',system-ui,sans-serif;box-shadow:0 30px 80px rgba(0,0,0,0.4);}" +
    ".qq-x{position:absolute;top:8px;right:12px;border:none;background:none;font-size:26px;color:#8B6E52;cursor:pointer;line-height:1;}" +
    ".qq-h{font-family:'Playfair Display',serif;font-weight:800;font-size:1.3rem;color:#1A1208;margin:0 0 4px;}" +
    ".qq-sub{font-size:0.84rem;color:#8B6E52;margin:0 0 14px;line-height:1.45;}" +
    ".qq-form{display:flex;flex-direction:column;gap:9px;}" +
    ".qq-in{width:100%;padding:11px 12px;border:1.5px solid #EDD8BC;border-radius:10px;font-size:0.95rem;font-family:inherit;color:#1A1208;background:#fff;}" +
    ".qq-in:focus{outline:none;border-color:#E8760A;}" +
    ".qq-row{display:flex;gap:8px;}.qq-row>*{flex:1;}" +
    ".qq-seg{display:flex;gap:6px;}" +
    ".qq-seg label{flex:1;}.qq-seg input{position:absolute;opacity:0;pointer-events:none;}" +
    ".qq-seg span{display:block;text-align:center;font-size:0.8rem;font-weight:700;padding:9px 4px;border:1.5px solid #EDD8BC;border-radius:10px;color:#6b4a2a;cursor:pointer;}" +
    ".qq-seg input:checked+span{background:#E8760A;border-color:#E8760A;color:#fff;}" +
    ".qq-submit{width:100%;min-height:48px;background:#E8760A;color:#fff;border:none;border-radius:11px;font-weight:800;font-size:1rem;cursor:pointer;margin-top:4px;}" +
    ".qq-submit:disabled{opacity:0.6;cursor:default;}" +
    ".qq-consent{font-size:0.7rem;color:#8B6E52;text-align:center;line-height:1.4;}" +
    ".qq-consent a{color:#E8760A;}" +
    ".qq-err{color:#c0392b;font-size:0.8rem;display:none;}" +
    ".qq-done{text-align:center;display:none;}" +
    ".qq-done h4{color:#236B43;font-weight:800;font-size:1.05rem;margin:6px 0 12px;}" +
    ".qq-go{display:inline-block;background:#25D366;color:#fff;font-weight:800;padding:12px 24px;border-radius:99px;text-decoration:none;}";
  document.head.appendChild(css);

  var ov = document.createElement("div");
  ov.className = "qq-ov";
  ov.setAttribute("aria-hidden", "true");
  ov.innerHTML =
    '<div class="qq-modal" role="dialog" aria-modal="true" aria-label="Quick quote">' +
    '<button class="qq-x" aria-label="Close">&times;</button>' +
    '<h3 class="qq-h">⚡ Get a quick quote</h3>' +
    '<p class="qq-sub">30 seconds. We&#39;ll WhatsApp you a menu &amp; price <strong>within 4 hours — usually sooner</strong>. Free · no advance.</p>' +
    '<form class="qq-form" novalidate>' +
    '<input class="qq-in" name="name" placeholder="Your name *" autocomplete="name">' +
    '<input class="qq-in" name="phone" type="tel" placeholder="Phone / WhatsApp number *" autocomplete="tel" inputmode="tel">' +
    '<select class="qq-in" name="event">' +
    '<option value="Party">🎉 Party / get-together</option>' +
    '<option value="Birthday">🎂 Birthday</option>' +
    '<option value="Jamai Sasthi">🎣 Jamai Sasthi</option>' +
    '<option value="Wedding">💍 Wedding</option>' +
    '<option value="Annaprasan">🍚 Annaprasan</option>' +
    '<option value="Corporate">🏢 Corporate</option>' +
    "</select>" +
    '<div class="qq-row">' +
    '<input class="qq-in" name="date" placeholder="Date (e.g. Sat 14)">' +
    '<input class="qq-in" name="guests" type="number" inputmode="numeric" placeholder="Guests">' +
    "</div>" +
    '<div class="qq-seg">' +
    '<label><input type="radio" name="diet" value="Veg"><span>🥗 Veg</span></label>' +
    '<label><input type="radio" name="diet" value="Non-veg" checked><span>🍗 Non-veg</span></label>' +
    '<label><input type="radio" name="diet" value="Both"><span>🍽️ Both</span></label>' +
    "</div>" +
    '<button class="qq-submit" type="submit">📩 Get my quote on WhatsApp</button>' +
    '<div class="qq-consent">We&#39;ll only use this to contact you about your enquiry. <a href="/privacy.html" target="_blank" rel="noopener">Privacy</a></div>' +
    '<div class="qq-err"></div>' +
    "</form>" +
    '<div class="qq-done"><h4>✓ Saved! We&#39;ll WhatsApp you within 4 hours — usually sooner.</h4><a class="qq-go" target="_blank" rel="noopener">💬 Open WhatsApp now →</a></div>' +
    "</div>";
  document.body.appendChild(ov);

  var form = ov.querySelector(".qq-form");
  var doneBox = ov.querySelector(".qq-done");
  var goBtn = ov.querySelector(".qq-go");
  var errMsg = ov.querySelector(".qq-err");
  var qp = new URLSearchParams(location.search);

  function openModal(presetEvent) {
    form.style.display = "";
    doneBox.style.display = "none";
    errMsg.style.display = "none";
    var btn = form.querySelector(".qq-submit");
    btn.disabled = false; btn.textContent = "📩 Get my quote on WhatsApp";
    // preset the event from ?event= or the trigger
    var ev = (presetEvent || qp.get("event") || "").toLowerCase();
    var map = { party: "Party", birthday: "Birthday", jamai: "Jamai Sasthi", sasthi: "Jamai Sasthi", wedding: "Wedding", annaprasan: "Annaprasan", corporate: "Corporate" };
    for (var k in map) { if (ev.indexOf(k) >= 0) { form.querySelector('[name="event"]').value = map[k]; break; } }
    ov.classList.add("on");
    track("quick_quote_open", { event: ev || "any" });
  }
  function closeModal() { ov.classList.remove("on"); }
  ov.addEventListener("click", function (e) {
    if (e.target === ov || (e.target.classList && e.target.classList.contains("qq-x"))) closeModal();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

  // --- Firebase (lazy) ------------------------------------------------------
  function withDb(cb, onerr) {
    function go() {
      try {
        if (!window.firebase.apps || !window.firebase.apps.length) window.firebase.initializeApp(FIREBASE_CONFIG);
        cb(window.firebase.firestore());
      } catch (e) { onerr(e); }
    }
    if (window.firebase && window.firebase.firestore) return go();
    var base = "https://www.gstatic.com/firebasejs/10.12.2/";
    var s1 = document.createElement("script"); s1.src = base + "firebase-app-compat.js";
    s1.onload = function () { var s2 = document.createElement("script"); s2.src = base + "firebase-firestore-compat.js"; s2.onload = go; s2.onerror = onerr; document.head.appendChild(s2); };
    s1.onerror = onerr; document.head.appendChild(s1);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errMsg.style.display = "none";
    var name = (form.querySelector('[name="name"]').value || "").trim();
    var phoneEl = form.querySelector('[name="phone"]');
    var phone = (phoneEl.value || "").trim();
    if (phone.replace(/\D/g, "").length < 10) {
      phoneEl.style.borderColor = "#c0392b"; phoneEl.focus();
      errMsg.textContent = "Please enter a valid phone number."; errMsg.style.display = "block"; return;
    }
    var event = form.querySelector('[name="event"]').value;
    var dateEl = form.querySelector('[name="date"]'), guestsEl = form.querySelector('[name="guests"]');
    var date = (dateEl.value || "").trim();
    var guests = (guestsEl.value || "").trim();
    // anti-spam minimum: guest count + date required on every lead
    var missEl = !guests ? guestsEl : !date ? dateEl : null;
    if (missEl) {
      guestsEl.style.borderColor = ""; dateEl.style.borderColor = "";
      missEl.style.borderColor = "#c0392b"; missEl.focus();
      errMsg.textContent = "Please add guest count and event date so we can quote."; errMsg.style.display = "block"; return;
    }
    var diet = (form.querySelector('[name="diet"]:checked') || {}).value || "";
    var brief = "Event: " + event + (guests ? " · Guests: " + guests : "") + (date ? " · Date: " + date : "") + (diet ? " · " + diet : "");
    var message = "Hi Aayojan! I'd like a quick quote.\nEvent: " + event + "\nGuests: " + guests + "\nDate: " + date + "\nFood: " + diet;

    var btn = form.querySelector(".qq-submit");
    btn.disabled = true; btn.textContent = "Saving…";
    function fail() { btn.disabled = false; btn.textContent = "📩 Get my quote on WhatsApp"; errMsg.textContent = "Couldn't save — please WhatsApp us at +91 80884 34425."; errMsg.style.display = "block"; }

    var lead = {
      name: name, phone: phone, event: event, brief: brief, message: message,
      guests: guests, date: date, diet: diet,
      source: "quick_quote", page: location.pathname,
      gclid: qp.get("gclid") || "", utm_source: qp.get("utm_source") || "", utm_campaign: qp.get("utm_campaign") || "",
      status: "new", createdAt: new Date().toISOString()
    };
    withDb(function (db) {
      db.collection("customerLeads").add(lead).then(function () {
        form.style.display = "none"; doneBox.style.display = "block";
        goBtn.setAttribute("href", "https://wa.me/" + WA + "?text=" + encodeURIComponent(message));
        track("lead_submitted", { event: event, source: "quick_quote", hasBrief: true });
      }).catch(fail);
    }, fail);
  });

  // --- triggers -------------------------------------------------------------
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-quick-quote]") : null;
    if (!t) return;
    e.preventDefault();
    openModal(t.getAttribute("data-quick-quote") || "");
  });
})();
