/* ============================================================================
 * Aayojan Menu Picker — /events/#menu-picker
 * ----------------------------------------------------------------------------
 * Loads /menu/menu-data.json and renders tiles into #mpick-grid. Two filters:
 * price band (starting-from) + type (veg/non-veg). Whole tile is a WhatsApp
 * link that pre-fills a lead message with the menu name + per-plate price.
 * Empty state (band=199, no matches) offers a "custom quote" WhatsApp CTA.
 * Mobile-first: 2-col grid, 44px touch targets, no horizontal overflow.
 * ========================================================================== */
(function () {
  "use strict";
  var GRID = document.getElementById("mpick-grid");
  var EMPTY = document.getElementById("mpick-empty");
  if (!GRID) return;

  var WA = "918088434425";
  var state = { band: "all", type: "all", menus: [] };

  function inr(n) { return "₹" + (n || 0).toLocaleString("en-IN"); }
  function typeLabel(t) { return t === "pure-veg" ? "🌿 Pure Veg" : t === "veg" ? "🌿 Veg" : "🍗 Non-Veg"; }
  function typeClass(t) { return t === "pure-veg" ? "pure-veg" : t === "veg" ? "veg" : "non-veg"; }
  function esc(s) { return String(s || "").replace(/[<>&"']/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function track(ev, params) {
    if (typeof window.aTrack === "function") window.aTrack(ev, params || {});
    else if (typeof window.gtag === "function") window.gtag("event", ev, params || {});
  }

  function tile(m) {
    var msg = "Hi Aayojan! Interested in *" + m.title + "* (party size " + (m.minHeads || 20) + "–" + (m.maxHeads || 70) + " guests).\n\nMenu:\n" +
      (m.items || []).map(function (it) { return "• " + it; }).join("\n") +
      "\n\nPlease share details.";
    var waHref = "https://wa.me/" + WA + "?text=" + encodeURIComponent(msg);
    var MAX_ITEMS = 4;
    var allItems = m.items || [];
    var shown = allItems.slice(0, MAX_ITEMS);
    var extra = allItems.length - shown.length;
    var items = shown.map(function (it) { return '<li>' + esc(it) + '</li>'; }).join('');
    if (extra > 0) items += '<li class="more">' + extra + ' more</li>';

    var wrap = document.createElement("a");
    wrap.className = "mp-tile";
    wrap.href = waHref;
    wrap.target = "_blank";
    wrap.rel = "noopener";
    wrap.setAttribute("role", "listitem");
    wrap.setAttribute("aria-label", "Book " + m.title + " (₹" + m.perPlate + " per plate) on WhatsApp");
    wrap.setAttribute("data-type", m.type);
    wrap.setAttribute("data-price", m.perPlate);
    wrap.innerHTML =
      '<img class="mp-tile-img" loading="lazy" src="' + esc(m.photo) + '" alt="' + esc(m.title) + '">' +
      '<div class="mp-tile-body">' +
        '<div class="mp-tile-title">' + esc(m.title) + '</div>' +
        '<div class="mp-tile-meta"><span class="mp-tile-type ' + typeClass(m.type) + '">' + typeLabel(m.type) + '</span><span class="dot">·</span><span>' + allItems.length + ' items</span>' + (m.delivery ? '<span class="dot">·</span><span>📦 ' + esc(m.delivery) + '</span>' : '') + '</div>' +
        '<ul class="mp-tile-items">' + items + '</ul>' +
        '<span class="mp-tile-cta">💬 Book on WhatsApp</span>' +
      '</div>';

    wrap.addEventListener("click", function () {
      track("menu_tile_click", { menu: m.slug, price: m.perPlate, type: m.type });
    });
    return wrap;
  }

  function render() {
    var band = state.band, type = state.type;
    var minPrice = band === "all" ? 0 : parseInt(band, 10);
    var visible = state.menus.filter(function (m) {
      if ((m.perPlate || 0) < minPrice) return false;
      if (type === "all") return true;
      if (type === "veg") return m.type === "veg" || m.type === "pure-veg";
      if (type === "non-veg") return m.type === "non-veg";
      return true;
    });
    GRID.innerHTML = "";
    if (visible.length === 0) {
      EMPTY.hidden = false;
    } else {
      EMPTY.hidden = true;
      var trackEl = document.createElement("div");
      trackEl.className = "mpick-track";
      visible.forEach(function (m) { trackEl.appendChild(tile(m)); });
      // duplicate set for seamless marquee loop
      visible.forEach(function (m) {
        var t = tile(m); t.setAttribute("aria-hidden", "true"); t.tabIndex = -1; trackEl.appendChild(t);
      });
      GRID.appendChild(trackEl);
    }
    track("menu_filter", { band: band, type: type, count: visible.length });
  }

  function wireChips(attr, key) {
    document.querySelectorAll("[" + attr + "]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state[key] = btn.getAttribute(attr);
        document.querySelectorAll("[" + attr + "]").forEach(function (b) {
          var active = b === btn;
          b.classList.toggle("active", active);
          b.setAttribute("aria-pressed", active ? "true" : "false");
        });
        render();
      });
    });
  }
  wireChips("data-mp-band", "band");
  wireChips("data-mp-type", "type");

  fetch("/menu/menu-data.json?v=" + Date.now(), { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      state.menus = (data && data.menus) || [];
      render();
    })
    .catch(function (e) {
      GRID.innerHTML =
        '<p style="grid-column:1/-1;color:#B8456A;text-align:center;padding:2rem 1rem;font-size:0.9rem;">' +
        'Could not load menus. Please <a href="https://wa.me/' + WA + '" style="color:#B8456A;text-decoration:underline;font-weight:800;">WhatsApp us</a>.' +
        '</p>';
      console.warn("[menupicker] load failed", e);
    });
})();
