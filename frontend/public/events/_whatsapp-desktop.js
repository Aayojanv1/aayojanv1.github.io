/* ============================================================================
 * Aayojan · Desktop WhatsApp bridge + callback form
 * ----------------------------------------------------------------------------
 * ~68% of visitors are on desktop, where wa.me opens WhatsApp Web (needs a QR
 * login) and most people abandon. On desktop we intercept WhatsApp clicks and
 * show a popup with:
 *   • a QR code that encodes the SAME pre-filled chat -> scan with phone
 *   • the number + a "WhatsApp Web" fallback
 *   • a "leave your number, we'll WhatsApp you" form -> stored in Firestore
 *     (customerLeads collection). Firebase is LAZY-loaded only on submit, so
 *     there is zero page-load cost for everyone who doesn't use the form.
 * On mobile/tablet we do nothing — the native wa.me link already works.
 * Privacy: minimal fields, explicit consent, /privacy.html linked.
 * ========================================================================== */
(function () {
  "use strict";

  function isDesktop() {
    var ua = navigator.userAgent || "";
    var mobileUA = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry|Opera Mini/i.test(ua);
    var coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    return !mobileUA && !coarse;
  }
  if (!isDesktop()) return; // mobile/tablet: leave native wa.me alone

  var NUMBER_DISPLAY = "+91 80884 34425";
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
    ".wad-overlay{position:fixed;inset:0;background:rgba(20,12,4,0.62);display:none;align-items:center;justify-content:center;z-index:99999;padding:20px;}" +
    ".wad-overlay.wad-open{display:flex;}" +
    ".wad-modal{background:#fff;border-radius:20px;max-width:360px;width:100%;max-height:92vh;overflow:auto;padding:28px 24px 24px;text-align:center;position:relative;box-shadow:0 30px 80px rgba(0,0,0,0.4);font-family:'DM Sans',system-ui,sans-serif;}" +
    ".wad-close{position:absolute;top:8px;right:12px;border:none;background:none;font-size:28px;line-height:1;color:#8B6E52;cursor:pointer;}" +
    ".wad-title{font-family:'Playfair Display',serif;font-size:1.35rem;font-weight:800;color:#1A1208;margin:0 0 6px;}" +
    ".wad-sub{font-size:0.86rem;color:#8B6E52;line-height:1.5;margin:0 auto 16px;max-width:280px;}" +
    ".wad-qr{width:220px;height:220px;border-radius:12px;border:1px solid #EDD8BC;display:inline-block;background:#FFF9F1;}" +
    ".wad-num{margin-top:14px;font-weight:800;font-size:1.1rem;color:#1A1208;letter-spacing:0.02em;}" +
    ".wad-web{display:inline-block;margin-top:12px;font-size:0.82rem;color:#E8760A;font-weight:700;text-decoration:none;}" +
    ".wad-web:hover{text-decoration:underline;}" +
    ".wad-or{margin:18px 0 12px;color:#8B6E52;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.1em;}" +
    ".wad-fmsg{font-size:0.9rem;color:#1A1208;font-weight:700;margin-bottom:8px;}" +
    ".wad-form{display:flex;flex-direction:column;gap:8px;text-align:left;}" +
    ".wad-in{width:100%;padding:11px 12px;border:1.5px solid #EDD8BC;border-radius:10px;font-size:0.95rem;font-family:inherit;}" +
    ".wad-in:focus{outline:none;border-color:#E8760A;}" +
    ".wad-submit{width:100%;min-height:46px;background:#E8760A;color:#fff;border:none;border-radius:10px;font-weight:800;font-size:0.95rem;cursor:pointer;}" +
    ".wad-submit:disabled{opacity:0.6;cursor:default;}" +
    ".wad-consent{font-size:0.72rem;color:#8B6E52;text-align:center;line-height:1.45;}" +
    ".wad-done{color:#236B43;font-weight:700;margin-top:14px;}" +
    ".wad-err{color:#c0392b;font-size:0.82rem;margin-top:8px;}";
  document.head.appendChild(css);

  // --- modal (built once) ---------------------------------------------------
  var overlay = document.createElement("div");
  overlay.className = "wad-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML =
    '<div class="wad-modal" role="dialog" aria-modal="true" aria-label="Chat on WhatsApp">' +
    '<button class="wad-close" aria-label="Close">&times;</button>' +
    '<h3 class="wad-title">Chat with us on WhatsApp</h3>' +
    '<p class="wad-sub">Scan with your phone&#39;s camera &mdash; the chat opens with your message ready to send.</p>' +
    '<img class="wad-qr" alt="WhatsApp QR code">' +
    '<div class="wad-num">📱 ' + NUMBER_DISPLAY + '</div>' +
    '<a class="wad-web" target="_blank" rel="noopener">Have WhatsApp on this computer? Open chat &rarr;</a>' +
    '<div class="wad-or">— or —</div>' +
    '<div class="wad-fmsg">Leave your number, we&#39;ll WhatsApp you</div>' +
    '<form class="wad-form" novalidate>' +
    '<input class="wad-in" name="name" placeholder="Your name" autocomplete="name">' +
    '<input class="wad-in" name="phone" type="tel" placeholder="Phone number *" autocomplete="tel" inputmode="tel">' +
    '<input class="wad-in" name="event" placeholder="Event (e.g. Wedding)">' +
    '<button class="wad-submit" type="submit">Request a callback</button>' +
    '<div class="wad-consent">We&#39;ll only use this to contact you about your enquiry. <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a></div>' +
    '<div class="wad-err" style="display:none"></div>' +
    "</form>" +
    '<div class="wad-done" style="display:none">✓ Thanks! We&#39;ll WhatsApp you shortly.</div>' +
    "</div>";
  document.body.appendChild(overlay);

  var qr = overlay.querySelector(".wad-qr");
  var web = overlay.querySelector(".wad-web");

  function openModal(href) {
    qr.src = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=" + encodeURIComponent(href);
    web.setAttribute("href", href);
    overlay.classList.add("wad-open");
    overlay.setAttribute("aria-hidden", "false");
    track("desktop_whatsapp_modal", { url: href });
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

  // --- callback form (consent-based; stored in Firestore customerLeads) -----
  var form = overlay.querySelector(".wad-form");
  var nameIn = form.querySelector('[name="name"]');
  var phoneIn = form.querySelector('[name="phone"]');
  var eventIn = form.querySelector('[name="event"]');
  var doneMsg = overlay.querySelector(".wad-done");
  var errMsg = overlay.querySelector(".wad-err");

  var qp = new URLSearchParams(location.search);
  try { var ev = qp.get("event"); if (ev) eventIn.value = ev.charAt(0).toUpperCase() + ev.slice(1); } catch (e) {}

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errMsg.style.display = "none";
    var phone = (phoneIn.value || "").trim();
    if (phone.replace(/\D/g, "").length < 10) {
      phoneIn.style.borderColor = "#c0392b"; phoneIn.focus();
      errMsg.textContent = "Please enter a valid phone number."; errMsg.style.display = "block";
      return;
    }
    var btn = form.querySelector(".wad-submit");
    btn.disabled = true; btn.textContent = "Sending…";

    function fail() {
      btn.disabled = false; btn.textContent = "Request a callback";
      errMsg.textContent = "Couldn't send right now — please WhatsApp us at " + NUMBER_DISPLAY + ".";
      errMsg.style.display = "block";
    }

    var lead = {
      name: (nameIn.value || "").trim(),
      phone: phone,
      event: (eventIn.value || "").trim(),
      source: "events-desktop",
      page: location.pathname,
      gclid: qp.get("gclid") || "",
      utm_source: qp.get("utm_source") || "",
      status: "new",
      createdAt: new Date().toISOString()
    };

    withDb(function (db) {
      db.collection("customerLeads").add(lead)
        .then(function () {
          form.style.display = "none";
          doneMsg.style.display = "block";
          track("callback_requested", { event: lead.event });
        })
        .catch(fail);
    }, fail);
  });

  // --- intercept WhatsApp clicks (bubble phase, after _analytics.js) ---------
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (/wa\.me|api\.whatsapp\.com/i.test(href)) {
      e.preventDefault();
      openModal(href);
    }
  });
})();
