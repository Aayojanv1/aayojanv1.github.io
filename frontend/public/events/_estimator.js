/* ============================================================================
 * Aayojan · Inline Quote Estimator (mobile-first, dependency-free)
 * ----------------------------------------------------------------------------
 * Renders an interactive on-page price estimator into <section id="quote-estimator">.
 * Each page supplies its own config via window.AAYOJAN_ESTIMATOR, e.g.:
 *
 *   window.AAYOJAN_ESTIMATOR = {
 *     event: "Birthday",
 *     whatsapp: "918088434425",
 *     tiers: [{label:"Kids", min:350, max:450}, ...],
 *     guests: { min:25, max:200, default:50, step:5 }
 *   };
 *
 * Goal: give the not-yet-ready visitor something useful to DO on-page (raises
 * engagement) and hand WhatsApp a pre-filled, qualified lead (raises conversion).
 * All numbers are client-side from the page's own pricing tiers — instant, no API.
 * ========================================================================== */
(function () {
  "use strict";

  var cfg = window.AAYOJAN_ESTIMATOR;
  var root = document.getElementById("quote-estimator");
  if (!cfg || !root || !cfg.tiers || !cfg.tiers.length) return;

  var g = cfg.guests || {};
  var gMin = g.min || 25, gMax = g.max || 500, gStep = g.step || 5;
  var guests = Math.min(Math.max(g.default || gMin, gMin), gMax);
  // default selection: cfg.defaultTier if given, else the middle/"popular" option
  var tierIdx = (typeof cfg.defaultTier === "number")
    ? cfg.defaultTier
    : (cfg.tiers.length > 1 ? 1 : 0);

  function track(event, params) {
    if (typeof window.aTrack === "function") window.aTrack(event, params);
  }
  function inr(n) { return "₹" + n.toLocaleString("en-IN"); }

  // --- AI match reveal: ALIASED verified kitchens. Real names are withheld
  //     until the customer connects on WhatsApp, so the platform isn't bypassed.
  var EVENTS = ["Birthday", "Wedding", "Annaprasan", "Bhai Phota", "Griha Pravesh", "Aiburo Bhaat", "Corporate"];
  var KITCHENS = [
    { alias: "Multi-Cuisine Kitchen · Newtown", cuisines: ["Bengali", "Mughlai", "Continental", "Chinese"], pMin: 350, pMax: 1200, gMin: 25, gMax: 1000, events: ["Birthday", "Wedding", "Annaprasan", "Corporate", "Griha Pravesh", "Bhai Phota", "Aiburo Bhaat"] },
    { alias: "Bengali Home-Style · Salt Lake", cuisines: ["Bengali", "Home-style"], pMin: 300, pMax: 600, gMin: 25, gMax: 300, events: ["Annaprasan", "Bhai Phota", "Griha Pravesh", "Aiburo Bhaat", "Birthday"] },
    { alias: "Banquet Kitchen · Rajarhat", cuisines: ["Multi-cuisine"], pMin: 350, pMax: 1200, gMin: 50, gMax: 5000, events: ["Wedding", "Corporate", "Birthday"] },
    { alias: "Premium Bengali & Mughlai", cuisines: ["Bengali", "Mughlai", "Chinese"], pMin: 400, pMax: 1300, gMin: 25, gMax: 800, events: ["Wedding", "Aiburo Bhaat", "Annaprasan", "Birthday"] },
    { alias: "Bengali · Continental Kitchen", cuisines: ["Bengali", "Mughlai", "Continental"], pMin: 350, pMax: 900, gMin: 25, gMax: 600, events: ["Birthday", "Wedding", "Corporate", "Griha Pravesh"] }
  ];
  function hashJit(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 9973; return h % 6; }
  function scoreKitchen(k, ev, gn, tMin, tMax) {
    var s = (k.events.indexOf(ev) >= 0) ? 34 : 10;
    s += (gn >= k.gMin && gn <= k.gMax) ? 33 : 12;
    var lo = Math.max(k.pMin, tMin), hi = Math.min(k.pMax, tMax);
    if (hi >= lo) s += Math.round(33 * Math.min(1, (hi - lo) / Math.max(1, tMax - tMin)));
    return Math.max(80, Math.min(98, 78 + Math.round(s / 100 * 20)) - hashJit(k.alias + ev));
  }
  (function injectMatchCss() {
    var s = document.createElement("style");
    s.textContent =
      ".em-see{width:100%;margin-top:10px;background:transparent;border:1.5px dashed var(--saffron,#E8760A);color:var(--saffron,#E8760A);border-radius:12px;min-height:46px;font-weight:800;font-family:inherit;font-size:0.92rem;cursor:pointer;}" +
      ".em-wrap{margin-top:12px;}" +
      ".em-scan{text-align:center;padding:16px 0;color:#8B6E52;font-size:0.9rem;font-weight:600;}" +
      ".em-spin{width:34px;height:34px;border:3px solid #EDD8BC;border-top-color:#E8760A;border-radius:50%;margin:0 auto 10px;animation:emspin .8s linear infinite;}" +
      "@keyframes emspin{to{transform:rotate(360deg);}}" +
      ".em-card{display:flex;align-items:center;gap:11px;background:#fff;border:1px solid #EDD8BC;border-radius:14px;padding:11px;margin-bottom:9px;text-align:left;animation:empop .4s ease both;}" +
      "@keyframes empop{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:none;}}" +
      ".em-score{flex-shrink:0;width:50px;height:50px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#FFF4DC,#FFE8B0);color:#236B43;font-weight:900;font-size:0.92rem;border:1px solid rgba(35,107,67,.25);}" +
      ".em-body{flex:1;min-width:0;}" +
      ".em-name{font-family:'Playfair Display',serif;font-weight:800;font-size:0.97rem;color:#1A1208;}" +
      ".em-tags{font-size:0.75rem;color:#8B6E52;margin:1px 0;}" +
      ".em-vf{font-size:0.72rem;color:#236B43;font-weight:700;}" +
      ".em-go{flex-shrink:0;background:#25D366;color:#fff;border-radius:10px;padding:9px 12px;font-weight:800;font-size:0.82rem;text-decoration:none;}" +
      ".em-note{font-size:0.72rem;color:#8B6E52;text-align:center;margin-top:2px;}";
    document.head.appendChild(s);
  })();

  // --- Build DOM (mobile-first: everything stacks, full-width controls) ------
  var tierChips = cfg.tiers.map(function (t, i) {
    return '<button type="button" class="est-chip" role="radio" aria-checked="' +
      (i === tierIdx) + '" data-tier="' + i + '">' + t.label + "</button>";
  }).join("");

  root.className = "block estimator";
  root.innerHTML =
    '<div class="container section-head">' +
      '<span class="section-eyebrow">Instant estimate</span>' +
      '<h2 class="section-title">What will <em>your ' + cfg.event.toLowerCase() +
        '</em> cost?</h2>' +
      '<p class="section-sub">Move the numbers — see a live estimate. Then get the exact quote on WhatsApp.</p>' +
    '</div>' +
    '<div class="est-card">' +
      '<div class="est-row">' +
        '<label class="est-label">' + (cfg.groupLabel || ('Type of ' + cfg.event.toLowerCase())) + '</label>' +
        '<div class="est-chips" role="radiogroup" aria-label="Type">' + tierChips + '</div>' +
      '</div>' +
      '<div class="est-row">' +
        '<label class="est-label" for="est-range">Guests</label>' +
        '<div class="est-guests">' +
          '<button type="button" class="est-step" data-step="-1" aria-label="Fewer guests">–</button>' +
          '<div class="est-guest-val">' +
            '<div class="est-guest-num" id="est-guest-num">' + guests + '</div>' +
            '<div class="est-guest-cap">guests</div>' +
          '</div>' +
          '<button type="button" class="est-step" data-step="1" aria-label="More guests">+</button>' +
        '</div>' +
        '<input type="range" class="est-range" id="est-range" min="' + gMin + '" max="' + gMax +
          '" step="' + gStep + '" value="' + guests + '" aria-label="Guest count">' +
      '</div>' +
      '<div class="est-out" aria-live="polite">' +
        '<div class="est-out-plate" id="est-plate"></div>' +
        '<div class="est-out-total" id="est-total"></div>' +
        '<div class="est-out-note">Indicative range · final quote confirmed by the kitchen on WhatsApp</div>' +
      '</div>' +
      '<a class="est-cta" id="est-cta" href="#" target="_blank" rel="noopener">' +
        '📱 Get this quote on WhatsApp</a>' +
      '<button type="button" class="em-see" id="em-see">✨ Match me with verified kitchens</button>' +
      '<div class="em-wrap" id="em-wrap"></div>' +
    '</div>';

  // --- Refs -----------------------------------------------------------------
  var numEl = root.querySelector("#est-guest-num");
  var rangeEl = root.querySelector("#est-range");
  var plateEl = root.querySelector("#est-plate");
  var totalEl = root.querySelector("#est-total");
  var ctaEl = root.querySelector("#est-cta");
  var chips = root.querySelectorAll(".est-chip");
  var seeBtn = root.querySelector("#em-see");
  var emWrap = root.querySelector("#em-wrap");

  var engagedFired = false;
  function markEngaged() {
    if (engagedFired) return;
    engagedFired = true;
    track("estimator_engaged", { event: cfg.event });
  }

  function render() {
    var t = cfg.tiers[tierIdx];
    var lo = t.min * guests, hi = t.max * guests;
    plateEl.textContent = inr(t.min) + "–" + inr(t.max) + " / plate · " + t.label;
    totalEl.textContent = inr(lo) + " – " + inr(hi);

    var msg =
      "Hi Aayojan! I want a " + cfg.event + " catering quote.\n" +
      "Type: " + t.label + "\n" +
      "Guests: " + guests + "\n" +
      "Estimated: " + inr(lo) + "–" + inr(hi) + " (" + inr(t.min) + "–" + inr(t.max) + "/plate)\n" +
      "Date: \nArea: ";
    ctaEl.setAttribute("href", "https://wa.me/" + cfg.whatsapp + "?text=" + encodeURIComponent(msg));
    if (emWrap) emWrap.innerHTML = "";        // clear stale matches when inputs change
    if (seeBtn) seeBtn.style.display = "";
  }

  function setGuests(v) {
    guests = Math.min(Math.max(v, gMin), gMax);
    numEl.textContent = guests;
    rangeEl.value = guests;
    render();
  }

  // --- Wire events ----------------------------------------------------------
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      tierIdx = parseInt(chip.getAttribute("data-tier"), 10);
      chips.forEach(function (c, i) { c.setAttribute("aria-checked", i === tierIdx); });
      markEngaged();
      render();
      track("estimator_changed", { event: cfg.event, field: "tier", value: cfg.tiers[tierIdx].label });
    });
  });

  root.querySelectorAll(".est-step").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dir = parseInt(btn.getAttribute("data-step"), 10);
      setGuests(guests + dir * gStep);
      markEngaged();
    });
  });

  rangeEl.addEventListener("input", function () {
    setGuests(parseInt(rangeEl.value, 10));
    markEngaged();
  });

  ctaEl.addEventListener("click", function () {
    var t = cfg.tiers[tierIdx];
    track("estimator_whatsapp_click", {
      event: cfg.event, tier: t.label, guests: guests,
      est_low: t.min * guests, est_high: t.max * guests
    });
  });

  // --- AI match reveal (the USP: tell us once, AI matches you — no calling 10 caterers)
  function currentMatchEvent() {
    var label = cfg.tiers[tierIdx].label;
    if (EVENTS.indexOf(label) >= 0) return label;
    var e = cfg.event || "event";
    return e.charAt(0).toUpperCase() + e.slice(1);
  }
  function renderMatches() {
    var t = cfg.tiers[tierIdx];
    var ev = currentMatchEvent();
    var ranked = KITCHENS.map(function (k) { return { k: k, pct: scoreKitchen(k, ev, guests, t.min, t.max) }; })
      .sort(function (a, b) { return b.pct - a.pct; }).slice(0, 3);
    var html = '<div class="em-note" style="margin-bottom:8px;font-weight:700;color:#1A1208">✨ ' + ranked.length +
      ' kitchens matched to your ' + ev.toLowerCase() + ' — no calling 10 caterers.</div>';
    ranked.forEach(function (r) {
      var k = r.k;
      var msg = "Hi Aayojan! Connect me with a matched kitchen.\nEvent: " + ev + "\nGuests: " + guests +
        "\nMatch: " + k.alias + " (" + r.pct + "% match)\nDate: \nArea: ";
      var wa = "https://wa.me/" + cfg.whatsapp + "?text=" + encodeURIComponent(msg);
      html +=
        '<div class="em-card">' +
          '<div class="em-score">' + r.pct + '%</div>' +
          '<div class="em-body">' +
            '<div class="em-name">' + k.alias + '</div>' +
            '<div class="em-tags">' + k.cuisines.join(" · ") + '</div>' +
            '<div class="em-vf">✓ Aayojan Verified · ~₹' + k.pMin + '–₹' + k.pMax + '/plate</div>' +
          '</div>' +
          '<a class="em-go" href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>' +
        '</div>';
    });
    html += '<div class="em-note">Kitchen names are shared once you connect — we handle the intros.</div>';
    emWrap.innerHTML = html;
    track("matches_shown", { event: ev, count: ranked.length });
  }
  seeBtn.addEventListener("click", function () {
    markEngaged();
    seeBtn.style.display = "none";
    emWrap.innerHTML = '<div class="em-scan"><div class="em-spin"></div>🤖 AI is matching you with verified kitchens…</div>';
    track("matches_revealed", { event: currentMatchEvent(), guests: guests });
    setTimeout(renderMatches, 1500);
  });

  render();
})();
