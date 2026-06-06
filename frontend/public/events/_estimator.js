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
    '</div>';

  // --- Refs -----------------------------------------------------------------
  var numEl = root.querySelector("#est-guest-num");
  var rangeEl = root.querySelector("#est-range");
  var plateEl = root.querySelector("#est-plate");
  var totalEl = root.querySelector("#est-total");
  var ctaEl = root.querySelector("#est-cta");
  var chips = root.querySelectorAll(".est-chip");

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

  render();
})();
