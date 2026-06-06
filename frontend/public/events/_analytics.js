/* ============================================================================
 * Aayojan · /events analytics — engagement & conversion instrumentation
 * ----------------------------------------------------------------------------
 * Static event pages previously fired ZERO GA4 events after page_view, so every
 * visitor who tapped a WhatsApp CTA (i.e. converted) and left the tab was logged
 * as a 0-second bounce. This script wires the real signals via delegation, so no
 * per-link edits are needed:
 *   • whatsapp_click / phone_click / email_click / outbound_click
 *   • faq_open            (engagement)
 *   • scroll_depth        25 / 50 / 75 / 100
 *   • engaged_15s         dwell marker for "stayed long" funnels
 * Respects the same ga_opt_out flag the pages already honour.
 * ========================================================================== */
(function () {
  "use strict";

  function gaReady() {
    return typeof window.gtag === "function" && !window["ga-disable-G-VSGREVV7RS"];
  }

  function track(event, params) {
    if (!gaReady()) return;
    try { window.gtag("event", event, params || {}); } catch (e) { /* never break the page */ }
  }
  // expose for any inline use later
  window.aTrack = track;

  // Stable page id for segmenting in GA (e.g. "birthday-caterer-newtown", "events-index")
  var page = (location.pathname.split("/").pop() || "").replace(/\.html$/, "") || "events-index";

  function clean(t) {
    return (t || "").trim().replace(/\s+/g, " ").slice(0, 80);
  }

  /* --- Click intent (capture phase so it runs before navigation) ----------- */
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    var label = clean(a.textContent);

    if (/wa\.me|api\.whatsapp\.com|whatsapp:/i.test(href)) {
      track("whatsapp_click", { page: page, link_text: label, link_url: href });
    } else if (/^tel:/i.test(href)) {
      track("phone_click", { page: page, link_text: label });
    } else if (/^mailto:/i.test(href)) {
      track("email_click", { page: page });
    } else if (/^https?:/i.test(href) && href.indexOf(location.host) === -1) {
      track("outbound_click", { page: page, link_url: href });
    } else if (href && href.charAt(0) !== "#" && (href.charAt(0) === "/" || href.indexOf(location.host) !== -1)) {
      // internal navigation: event cards, cuisine pills, featured kitchens, nav, cross-links
      track("internal_nav_click", { page: page, link_text: label, link_url: href });
    }
  }, true);

  /* --- FAQ engagement ------------------------------------------------------ */
  document.addEventListener("click", function (e) {
    var q = e.target && e.target.closest ? e.target.closest(".faq-q, .faq-button") : null;
    if (!q) return;
    track("faq_open", { page: page, question: clean(q.textContent) });
  });

  /* --- Scroll depth -------------------------------------------------------- */
  var marks = [25, 50, 75, 100], fired = {}, ticking = false;
  function onScroll() {
    var st = window.pageYOffset || document.documentElement.scrollTop || 0;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (h <= 0) return;
    var pct = (st / h) * 100;
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i];
      if (pct >= m && !fired[m]) { fired[m] = 1; track("scroll_depth", { page: page, percent: m }); }
    }
  }
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { onScroll(); ticking = false; });
  }, { passive: true });

  /* --- Dwell marker: fires once if the visitor is still here at 15s --------- */
  var dwellFired = false;
  function fireDwell() {
    if (dwellFired) return;
    if (document.visibilityState === "hidden") return; // don't count backgrounded tabs
    dwellFired = true;
    track("engaged_15s", { page: page });
  }
  setTimeout(fireDwell, 15000);
})();
