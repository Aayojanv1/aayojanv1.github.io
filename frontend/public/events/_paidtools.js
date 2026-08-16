/* Aayojan · Paid tools — PriceLens + Bhojon Buddy
 * ------------------------------------------------------------------
 * Flow: card input → Google Sign-In → free-first-use check (Firestore)
 * → (₹9 Razorpay if not first) → backend Gemini call → result inline.
 * Firestore is source of truth for "first use per Google account".
 * Backend verifies the Firebase ID token so uid is trustworthy.
 */
(function () {
  "use strict";

  // ── config ─────────────────────────────────────────────────────────
  var WA = "918088434425";
  var API_BASE = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://localhost:8000" : "https://aayojan-a1fi.onrender.com";
  var BUNDLE_PRICE = 15;
  var BUNDLE_CREDITS = 50;                     // ₹15 buys 50 credits
  var USE_COST = 10;                           // each query debits 10 credits (=5 queries per pack)
  var DEV_EMAILS = ["gouravchat@gmail.com"];   // KEEP IN SYNC with backend main.py DEV_EMAILS
  var DEV_CREDIT_FLOOR = 500;                  // dev accounts always show ≥500 credits (=50 queries)
  // QA toggle: ?force_paid=1 in URL disables dev bypass on frontend so you can
  // exercise the full Razorpay + credit-decrement flow with the dev Google account.
  var FORCE_PAID = (function () {
    try { return new URLSearchParams(location.search).get("force_paid") === "1"; }
    catch (e) { return false; }
  })();
  function isDev(email) {
    if (FORCE_PAID) return false;
    return email && DEV_EMAILS.indexOf(String(email).trim().toLowerCase()) !== -1;
  }
  var FB = {
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
  function inr(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ── firebase (app + firestore + auth) ──────────────────────────────
  var _fbReady;
  function loadFirebase() {
    if (_fbReady) return _fbReady;
    _fbReady = new Promise(function (resolve) {
      if (window.firebase && firebase.firestore && firebase.auth) return resolve(firebase);
      var b = "https://www.gstatic.com/firebasejs/10.12.2/";
      function chain(srcs, done) {
        if (!srcs.length) return done();
        var s = document.createElement("script");
        s.src = b + srcs[0];
        s.onload = function () { chain(srcs.slice(1), done); };
        document.head.appendChild(s);
      }
      chain(["firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js"], function () {
        if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FB);
        resolve(firebase);
      });
    });
    return _fbReady;
  }

  function loadRazorpay() {
    return new Promise(function (resolve) {
      if (window.Razorpay) return resolve(window.Razorpay);
      var s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = function () { resolve(window.Razorpay || null); };
      s.onerror = function () { resolve(null); };
      document.head.appendChild(s);
    });
  }

  function signInWithGoogle() {
    return loadFirebase().then(function (fb) {
      var provider = new fb.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      return fb.auth().signInWithPopup(provider).then(function (result) {
        var user = result.user;
        return user.getIdToken(/* forceRefresh */ true).then(function (idToken) {
          return { user: user, idToken: idToken };
        });
      });
    });
  }

  // ── firestore helpers (four collections) ──────────────────────────
  // users/{uid}                 — sign-in profile
  // toolUsage/{uid}             — fast free/paid gate counter
  // transactions/{autoId}       — Razorpay ₹9 payments
  // priceLensQueries/{autoId}    — Price Corrector history
  // bhojonBuddyQueries/{autoId} — Bhojon Buddy history

  function upsertUser(user) {
    return loadFirebase().then(function (fb) {
      var ref = fb.firestore().collection("users").doc(user.uid);
      var nowIso = new Date().toISOString();
      var profile = {
        uid: user.uid,
        email: user.email || null,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        emailVerified: !!user.emailVerified,
        lastSignInAt: nowIso,
        signInCount: firebase.firestore.FieldValue.increment(1),
      };
      // firstSignInAt only set on create (via serverTimestamp fallback pattern)
      return ref.get().then(function (doc) {
        if (!doc.exists) profile.firstSignInAt = nowIso;
        return ref.set(profile, { merge: true });
      }).catch(function () { /* silent */ });
    });
  }

  function getUsage(uid) {
    return loadFirebase().then(function (fb) {
      return fb.firestore().collection("toolUsage").doc(uid).get()
        .then(function (doc) { return doc.exists ? doc.data() : {}; });
    });
  }

  function bumpUsage(uid, tool, paymentId, extra) {
    return loadFirebase().then(function (fb) {
      var FV = firebase.firestore.FieldValue;
      var ref = fb.firestore().collection("toolUsage").doc(uid);
      var upd = { lastUsedAt: new Date().toISOString() };
      upd[tool === "price_lens" ? "priceLensCount" : "bhojonBuddyCount"] = FV.increment(1);
      if (paymentId) upd.lastPaymentId = paymentId;
      // Paid bundle credits: debit USE_COST per query. Dev grants: no decrement.
      if (paymentId && paymentId.indexOf("bundle_") === 0) {
        upd.bundleCreditsRemaining = FV.increment(-USE_COST);
        upd.bundleUsesCount = FV.increment(1);
      } else if (paymentId && paymentId.indexOf("dev_") === 0) {
        upd.devUsesCount = FV.increment(1);
      }
      if (extra) Object.assign(upd, extra);
      return ref.set(upd, { merge: true }).catch(function () { /* silent */ });
    });
  }

  function addBundleCredits(uid, purchasePaymentId) {
    return loadFirebase().then(function (fb) {
      var FV = firebase.firestore.FieldValue;
      var ref = fb.firestore().collection("toolUsage").doc(uid);
      return ref.set({
        bundleCreditsRemaining: FV.increment(BUNDLE_CREDITS),
        bundlesPurchasedCount: FV.increment(1),
        lastBundlePaymentId: purchasePaymentId,
        lastBundlePurchasedAt: new Date().toISOString(),
      }, { merge: true }).catch(function () { /* silent */ });
    });
  }

  // ── Transaction log with retry + local queue ──────────────────────
  // We MUST NOT lose a paid transaction. On write failure we:
  //   1. Retry 3× with backoff (0.5s, 1.5s, 4s)
  //   2. If still failing, stash to localStorage 'pendingTx' array
  //   3. On next page load, retry the queue
  // Also mirror every attempt to the browser console with a distinct tag
  // so it's grep-able in DevTools even if Firestore is down.

  var TX_QUEUE_KEY = "aayojan_pending_tx_v1";

  function loadPendingTx() {
    try { return JSON.parse(localStorage.getItem(TX_QUEUE_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function savePendingTx(list) {
    try { localStorage.setItem(TX_QUEUE_KEY, JSON.stringify(list || [])); } catch (e) {}
  }
  function enqueuePending(rec) {
    var q = loadPendingTx();
    if (!q.some(function (r) { return r.paymentId && r.paymentId === rec.paymentId; })) {
      q.push(rec); savePendingTx(q);
    }
    console.warn("[TX-QUEUED]", rec.paymentId, "· amount:", rec.amount, "· total pending:", q.length);
  }

  function _writeTxOnce(rec) {
    return loadFirebase().then(function (fb) {
      return fb.firestore().collection("transactions").add(rec);
    });
  }

  function logTransaction(rec) {
    rec.createdAt = rec.createdAt || new Date().toISOString();
    rec.status = rec.status || "paid";
    console.log("[TX-ATTEMPT]", rec.paymentId, "· amount:", rec.amount);
    var delays = [500, 1500, 4000];
    function attempt(i) {
      return _writeTxOnce(rec).then(function (r) {
        console.log("[TX-OK]", rec.paymentId, "· doc:", r.id);
        return r;
      }).catch(function (e) {
        console.warn("[TX-FAIL " + (i + 1) + "/" + delays.length + "]", rec.paymentId, e && (e.code || e.message));
        if (i + 1 >= delays.length) {
          enqueuePending(rec);   // give up on live, stash for later
          throw e;
        }
        return new Promise(function (resolve) { setTimeout(resolve, delays[i]); }).then(function () { return attempt(i + 1); });
      });
    }
    return attempt(0);
  }

  // On every page load, try to flush any pending transactions from localStorage
  function flushPendingTx() {
    var q = loadPendingTx();
    if (!q.length) return;
    console.log("[TX-FLUSH] draining " + q.length + " pending transaction(s)");
    // Try each one — if it succeeds, drop from queue
    (function next(idx) {
      if (idx >= q.length) {
        // Rebuild queue from anything still unflushed (flagged with _flushed=false)
        var remaining = q.filter(function (r) { return !r._flushed; });
        remaining.forEach(function (r) { delete r._flushed; });
        savePendingTx(remaining);
        return;
      }
      _writeTxOnce(q[idx]).then(function (r) {
        console.log("[TX-FLUSH-OK]", q[idx].paymentId, "· doc:", r.id);
        q[idx]._flushed = true;
      }).catch(function (e) {
        console.warn("[TX-FLUSH-FAIL]", q[idx].paymentId, e && (e.code || e.message));
      }).then(function () { next(idx + 1); });
    })(0);
  }

  function logQuery(tool, rec) {
    return loadFirebase().then(function (fb) {
      rec.createdAt = new Date().toISOString();
      var coll = tool === "price_lens" ? "priceLensQueries" : "bhojonBuddyQueries";
      return fb.firestore().collection(coll).add(rec).catch(function () { /* silent */ });
    });
  }

  // ── backend ────────────────────────────────────────────────────────
  function api(path, body) {
    return fetch(API_BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.detail || "Request failed");
        return j;
      });
    });
  }

  // ── main state per card ───────────────────────────────────────────
  function initCard(card) {
    var tool = card.getAttribute("data-tool");   // "price_lens" | "bhojon_buddy"
    var state = { user: null, idToken: null, paymentId: null };
    var input = {};
    var _fired = {};   // per-card single-fire analytics guards

    // Card impression: fires once when the card is ≥50% visible
    if (typeof IntersectionObserver === "function") {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !_fired.view) {
            _fired.view = true;
            track("ptool_view", { tool: tool });
            io.disconnect();
          }
        });
      }, { threshold: 0.5 });
      io.observe(card);
    }

    // First input focus: strongest early-intent signal
    card.addEventListener("focusin", function (e) {
      if (_fired.focus) return;
      if (!e.target.matches("input, textarea, select")) return;
      _fired.focus = true;
      track("ptool_input_focus", { tool: tool, field: e.target.getAttribute("data-in") || "" });
    });

    // WhatsApp click from the Aayojan-price result panel (conversion moment)
    card.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest(".ptool-aay a[href*='wa.me']");
      if (!a) return;
      track("ptool_result_whatsapp", { tool: tool, wasFree: !!state.paymentId ? false : true });
    });

    function step(name) {
      card.querySelectorAll(".ptool-step").forEach(function (el) {
        el.style.display = el.getAttribute("data-step") === name ? "" : "none";
      });
    }
    function err(msg) {
      var e = card.querySelector(".ptool-err");
      if (!msg) { e.style.display = "none"; return; }
      e.textContent = msg; e.style.display = "block";
    }
    function prettyToolName() { return tool === "price_lens" ? "PriceLens" : "Bhojon Buddy"; }

    function collectInput() {
      if (tool === "price_lens") {
        var lines = (card.querySelector('[data-in="menu"]').value || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
        var guests = parseInt(card.querySelector('[data-in="guests"]').value, 10) || 30;
        if (lines.length === 0) throw new Error("Add at least one menu item.");
        if (lines.length > 40) throw new Error("Too many items (max 40).");
        if (guests < 15) throw new Error("Minimum 15 guests (we don't quote smaller orders).");
        return { menu: lines, guests: guests };
      } else {
        var budget = parseInt(card.querySelector('[data-in="budget"]').value, 10) || 0;
        var g = parseInt(card.querySelector('[data-in="guests"]').value, 10) || 30;
        var occ = card.querySelector('[data-in="occasion"]').value.trim();
        var diet = card.querySelector('[data-in="diet"]').value;
        if (budget < 100 || budget > 5000) throw new Error("Budget must be ₹100–5000/plate.");
        if (g < 15) throw new Error("Minimum 15 guests (we don't quote smaller orders).");
        return { budgetPerPlate: budget, guests: g, occasion: occ, diet: diet };
      }
    }

    // — Start: collect inputs, then go to Google sign-in step
    card.querySelector('[data-act="start"]').addEventListener("click", function () {
      err("");
      try { input = collectInput(); }
      catch (e) {
        track("ptool_validation_fail", { tool: tool, reason: String(e.message || e).slice(0, 80) });
        err(e.message); return;
      }
      track("ptool_start", { tool: tool });
      // If already signed in, skip straight ahead
      loadFirebase().then(function (fb) {
        var u = fb.auth().currentUser;
        if (u) {
          state.user = u;
          return u.getIdToken(true).then(function (t) { state.idToken = t; afterSignIn(); });
        } else {
          step("google");
        }
      });
    });

    // — Google sign-in
    card.querySelector('[data-act="google"]').addEventListener("click", function () {
      err("");
      var btn = this; btn.disabled = true; btn.textContent = "Opening Google…";
      signInWithGoogle()
        .then(function (r) {
          state.user = r.user; state.idToken = r.idToken;
          upsertUser(r.user);              // record sign-in in users/{uid}
          track("ptool_signed_in", { tool: tool });
          btn.disabled = false; btn.textContent = "Continue with Google";
          afterSignIn();
        })
        .catch(function (e) {
          btn.disabled = false; btn.textContent = "Continue with Google";
          if (e && e.code === "auth/popup-closed-by-user") { err(""); return; }
          err("Sign-in failed: " + (e && e.message ? e.message : "unknown"));
        });
    });

    function afterSignIn() {
      // Eligibility ladder:
      //   - No use of THIS tool yet → free first-use
      //   - Bundle credits available (shared across both tools) → consume 1 credit
      //   - Otherwise → paywall (single ₹9, plus bundle upsell if they've already paid once)
      var uid = state.user.uid;
      showSignedInBar();
      // Dev accounts: always unlimited (backend confirms via DEV_EMAILS whitelist)
      if (isDev(state.user.email)) {
        state.paymentId = "dev_" + uid + "_" + Date.now();
        runTool(false);
        return;
      }
      getUsage(uid).then(function (usage) {
        var toolCount = usage[tool === "price_lens" ? "priceLensCount" : "bhojonBuddyCount"] || 0;
        var bundleCredits = usage.bundleCreditsRemaining || 0;

        if (toolCount === 0) {
          state.paymentId = null;
          runTool(true);
        } else if (bundleCredits >= USE_COST) {
          state.paymentId = "bundle_" + uid + "_" + Date.now();
          runTool(false);
        } else {
          showPayScreen();
        }
      });
    }

    function showPayScreen() {
      // Only offer: ₹15 for 5 queries. No single-query path.
      var bundleBtn = card.querySelector('[data-act="pay-bundle"]');
      bundleBtn.disabled = false;
      bundleBtn.textContent = "Unlock 5 queries for ₹15 →";
      // Optional footnote in the reason slot (rendered small under the button)
      var reason = card.querySelector('[data-out="pay-reason"]');
      if (reason) reason.textContent = "Powered by Razorpay · One-time payment · No auto-renewal";
      track("ptool_paywall_shown", { tool: tool });
      step("pay");
    }

    function showSignedInBar() {
      var bar = card.querySelector('[data-out="signed-in"]');
      var u = state.user;
      if (!bar || !u) return;
      var name = u.displayName || (u.email || "").split("@")[0] || "You";
      var photo = u.photoURL ? '<img src="' + esc(u.photoURL) + '" alt="" referrerpolicy="no-referrer">' : '';
      // Dev accounts: show a special pill and skip Firestore lookup
      if (isDev(u.email)) {
        bar.innerHTML = photo + '<span>Signed in as <b>' + esc(name) + '</b></span>' +
                        '<span class="sib-credits sib-dev">∞ <b>Developer</b> · unlimited</span>';
        bar.style.display = "";
        return;
      }
      // Normal accounts: live credit balance from Firestore
      getUsage(u.uid).then(function (usage) {
        var credits = usage.bundleCreditsRemaining || 0;
        var toolCount = usage[tool === "price_lens" ? "priceLensCount" : "bhojonBuddyCount"] || 0;
        var queriesLeft = Math.floor(credits / USE_COST);
        var tail;
        if (credits >= USE_COST) {
          tail = '<span class="sib-credits">🎟️ <b>' + credits + '</b> credits · ' + queriesLeft + ' quer' + (queriesLeft === 1 ? 'y' : 'ies') + ' left</span>';
        } else if (toolCount === 0) {
          tail = '<span class="sib-credits sib-free">🎁 <b>1 free</b> query</span>';
        } else {
          tail = '<span class="sib-credits sib-empty">No credits · unlock 50 for ₹15</span>';
        }
        bar.innerHTML = photo + '<span>Signed in as <b>' + esc(name) + '</b></span>' + tail;
        bar.style.display = "";
      });
    }

    // Single-query ₹9 path removed — only ₹15/5-pack sold now.

    // — Bundle purchase (₹15 for 5 credits, shared across tools)
    var bundleBtnEl = card.querySelector('[data-act="pay-bundle"]');
    if (bundleBtnEl) bundleBtnEl.addEventListener("click", function () {
      err("");
      var btn = this; btn.disabled = true; btn.textContent = "Opening Razorpay…";
      track("ptool_bundle_start", { tool: tool });
      var u = state.user;
      var contactPhone = (u && u.phoneNumber) ? String(u.phoneNumber).replace(/^\+?91/, "") : "";
      api("/api/rzp/create-order", {
        amount: BUNDLE_PRICE,
        name: u.displayName || "",
        email: u.email || "",
        phone: contactPhone || "0000000000",
        purpose: "aayojan_ai_bundle_5"
      })
        .then(function (data) {
          if (!data.order_id) throw new Error("Order failed");
          return loadRazorpay().then(function (RZP) {
            if (!RZP) throw new Error("Razorpay checkout unavailable");
            var rz = new RZP({
              key: data.key, order_id: data.order_id, amount: data.amount, currency: data.currency || "INR",
              name: "Aayojan", description: BUNDLE_CREDITS + " credits (5 queries) · non-refundable digital purchase",
              image: "https://aayojan.online/img/aayojan-cloche.png", theme: { color: "#E8760A" },
              prefill: { name: u.displayName || "", email: u.email || "", contact: contactPhone },
              handler: function (resp) {
                api("/api/rzp/verify", resp).then(function (v) {
                  if (!v.verified) { err("Payment verification failed."); btn.disabled = false; btn.textContent = "Get 50 credits for ₹15 →"; return; }
                  logTransaction({
                    uid: u.uid, email: u.email || null, displayName: u.displayName || null,
                    tool: tool, purpose: "aayojan_ai_bundle_5",
                    amount: BUNDLE_PRICE, currency: "INR", creditsGranted: BUNDLE_CREDITS,
                    orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id,
                    signature: resp.razorpay_signature, gateway: "razorpay",
                    refundable: false, tncAccepted: true,
                  });
                  addBundleCredits(u.uid, resp.razorpay_payment_id).then(function () {
                    // Use one credit right now for the current query
                    state.paymentId = "bundle_" + u.uid + "_" + Date.now();
                    track("ptool_bundle_purchased", { tool: tool, amount: BUNDLE_PRICE, credits: BUNDLE_CREDITS });
                    runTool(false);
                  });
                }).catch(function () { err("Could not verify payment."); btn.disabled = false; btn.textContent = "Get 50 credits for ₹15 →"; });
              },
              modal: { ondismiss: function () { btn.disabled = false; btn.textContent = "Get 50 credits for ₹15 →"; } }
            });
            rz.on("payment.failed", function () { err("Payment failed — try again."); btn.disabled = false; btn.textContent = "Get 50 credits for ₹15 →"; });
            rz.open();
          });
        })
        .catch(function (e) { err("Razorpay: " + e.message); btn.disabled = false; btn.textContent = "Get 50 credits for ₹15 →"; });
    });

    card.querySelector('[data-act="restart"]').addEventListener("click", function () {
      err(""); state.paymentId = null;
      step("input");
    });

    // Per-step delays for the live-activity theatre. Sum ≈ 27s; hard-capped at 40s total.
    var STEP_DELAYS = [3800, 4500, 6000, 7500, 5200];
    var HARD_MAX_MS = 40000;

    function playLoaderAnim() {
      var loader = card.querySelector('[data-step="loading"] .ptool-loader');
      if (!loader) return Promise.resolve();
      var items = loader.querySelectorAll("li");
      items.forEach(function (li) {
        li.classList.remove("on", "done");
        var m = li.querySelector(".pl-mark"); if (m) m.textContent = "○";
      });
      return new Promise(function (resolve) {
        function activate(i) {
          if (i >= items.length) return resolve();
          var li = items[i], mark = li.querySelector(".pl-mark");
          li.classList.add("on"); if (mark) mark.textContent = "◐";
          setTimeout(function () {
            li.classList.remove("on"); li.classList.add("done");
            if (mark) mark.textContent = "✓";
            activate(i + 1);
          }, STEP_DELAYS[i] || 5000);
        }
        activate(0);
      });
    }

    function runTool(isFree) {
      step("loading");
      var animDone = playLoaderAnim();
      var apiCall = state.user.getIdToken(true).then(function (freshToken) {
        state.idToken = freshToken;
        var body = Object.assign({ idToken: freshToken }, input);
        if (state.paymentId) body.paymentId = state.paymentId;
        var path = tool === "price_lens" ? "/api/tools/price-lens" : "/api/tools/bhojon-buddy";
        return api(path, body);
      });
      var timeout = new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error("Taking too long — please try again")); }, HARD_MAX_MS);
      });
      Promise.race([
        // Result appears only when BOTH the API is done AND the theatre is finished
        Promise.all([apiCall, animDone]).then(function (arr) { return arr[0]; }),
        timeout
      ]).then(function (r) {
        renderResult(r.result);
        bumpUsage(state.user.uid, tool, state.paymentId || null, {
          email: state.user.email || null,
          displayName: state.user.displayName || null,
        }).then(showSignedInBar);   // refresh credit count in the pill
        logQuery(tool, {
          uid: state.user.uid, email: state.user.email || null,
          displayName: state.user.displayName || null,
          input: input, output: r.result,
          wasFree: !!isFree, paymentId: state.paymentId || null,
        });
        track("ptool_success", { tool: tool, wasFree: !!isFree });
      }).catch(function (e) {
        step("input"); err("Something went wrong: " + (e.message || e));
        track("ptool_error", { tool: tool, msg: String(e.message || e).slice(0, 80) });
      });
    }

    function aayojanPanel(res) {
      if (!res.aayojanPrice) return "";
      // marketDisplayPrice = fair × 1.20 anchor; aayojanPrice = market × 0.80
      var anchor = res.marketDisplayPrice || 0;
      var save = res.aayojanSavingsPerPlate || 0;
      var total = res.aayojanSavingsTotal || 0;
      var totalLine = total > 0 ? ' · Total save <b>' + inr(total) + '</b>' : '';
      var msg = tool === "price_lens"
        ? "I want to book at the Aayojan-network price of " + inr(res.aayojanPrice) + "/plate (saves " + inr(save) + "/plate)."
        : "I want to book this Bhojon Buddy menu at the Aayojan-network price of " + inr(res.aayojanPrice) + "/plate.";
      var url = "https://wa.me/" + WA + "?text=" + encodeURIComponent("Hi Aayojan! " + msg);
      return '' +
        '<div class="ptool-aay">' +
          '<div class="pa-eyebrow">🏷️ ' + (res.aayojanDiscountPct || 20) + '% off with Aayojan Kitchens</div>' +
          '<div class="pa-row">' +
            (anchor ? '<span class="pa-strike">' + inr(anchor) + '</span>' : '') +
            '<span class="pa-price">' + inr(res.aayojanPrice) + '<small>/plate</small></span></div>' +
          '<div class="pa-save">You save <b>' + inr(save) + '/plate</b>' + totalLine + '</div>' +
          '<a class="pa-cta" href="' + url + '" target="_blank" rel="noopener">📱 Lock this price on WhatsApp →</a>' +
          '<div class="pa-fine">Verified-kitchen network price. Final confirmation on WhatsApp.</div>' +
        '</div>';
    }

    var DISCLAIMER = '<div class="ptool-disclaimer">⚠️ <b>Indicative only.</b> Actual price may vary by <b>event date</b>, <b>delivery location</b>, and <b>seasonal availability</b> of ingredients (esp. Ilish, fresh Chingri, vegetables). Confirm final quote on WhatsApp before booking.</div>';

    // Dish → real photo URL map (extend as you gather real photography).
    // Any dish not here falls back to a category-tinted gradient tile with emoji.
    var DISH_PHOTOS = {
      // "chicken kosha": "/events/img/dishes/chicken-kosha.jpg",
      // "mutton kosha":  "/events/img/dishes/mutton-kosha.jpg",
    };

    function dishMeta(item) {
      var lower = (item || "").toLowerCase();
      if (/mutton|chicken|kebab|kabab|chaap|reshmi/.test(lower))                          return { emoji: "🍗", cls: "nonveg" };
      if (/fish|chingri|prawn|ilish|bhetki|katla|rohu|paturi|kalia/.test(lower))          return { emoji: "🐟", cls: "nonveg" };
      if (/pulao|rice|luchi|roti|bread|paratha|khichuri|radhaballabi/.test(lower))        return { emoji: "🍚", cls: "rice" };
      if (/rasogolla|payesh|sandesh|gulab|mishti|kaju|barfi|halwa|rajbhog|jamun|dessert|ice cream|nolen/.test(lower)) return { emoji: "🍮", cls: "sweet" };
      if (/sherbet|panna|jaljeera|drink|mocktail|tea|coffee|chai|lassi|water/.test(lower)) return { emoji: "🥤", cls: "drink" };
      if (/salad|chutney|chatni|papad|accomp/.test(lower))                                return { emoji: "🥗", cls: "salad" };
      if (/paneer|dal|sabzi|dalna|dum|cutlet|dhokar|veg|alu|phulkopi|malaikari|makhani/.test(lower)) return { emoji: "🥘", cls: "veg" };
      return { emoji: "🍽️", cls: "veg" };
    }

    function dishThumb(item) {
      var key = (item || "").trim().toLowerCase();
      if (DISH_PHOTOS[key]) return '<img class="pc-thumb" src="' + esc(DISH_PHOTOS[key]) + '" alt="">';
      var meta = dishMeta(item);
      return '<div class="pc-thumb ' + meta.cls + '">' + meta.emoji + '</div>';
    }

    function guestTotalLine(pricePerPlate) {
      var guests = input.guests || 0;
      if (!guests || !pricePerPlate) return "";
      var total = pricePerPlate * guests;
      return '<div class="pv-totals">' +
               'For <b>' + guests + ' guests</b>  ·  Total order value <b>' + inr(total) + '</b>' +
             '</div>';
    }

    function renderResult(res) {
      var host = card.querySelector('[data-out="result"]');
      if (tool === "price_lens") {
        var rows = (res.breakdown || []).map(function (b) {
          return '<tr><td>' + esc(b.item) + '</td><td class="r">' + inr(b.ingredientCost || 0) + '</td></tr>';
        }).join("");
        host.innerHTML =
          '<div class="ptool-verdict"><span class="pv-price">' + inr(res.pricePerPlate) + '/plate</span>' +
          '<span class="pv-range">Fair range: ' + inr(res.fairRangeLow) + '–' + inr(res.fairRangeHigh) + '</span></div>' +
          guestTotalLine(res.pricePerPlate) +
          '<div class="ptool-verdict-note"><b>Verdict:</b> ' + esc(res.verdict || "") + '</div>' +
          aayojanPanel(res) +
          (rows ? '<table class="ptool-table"><thead><tr><th>Item</th><th class="r">Cost/plate</th></tr></thead><tbody>' + rows + '</tbody></table>' : '') +
          (res.notes ? '<div class="ptool-note">' + esc(res.notes) + '</div>' : '') +
          DISCLAIMER;
      } else {
        var items = (res.menu || []).map(function (m) {
          return '<li>' + dishThumb(m.item) +
                 '<div class="pc-content">' +
                   '<div class="pc-head"><span class="pc-course">' + esc(m.course) + '</span>' +
                   (m.portion ? '<span class="pc-portion">' + esc(m.portion) + '</span>' : '') + '</div>' +
                   '<span class="pc-item">' + esc(m.item) + '</span>' +
                   (m.rationale ? '<div class="pc-rat">' + esc(m.rationale) + '</div>' : '') +
                 '</div></li>';
        }).join("");
        host.innerHTML =
          '<div class="ptool-verdict"><span class="pv-price">' + inr(res.estimatedPlateCost) + '/plate</span>' +
          '<span class="pv-range">' + esc(res.budgetFit || "") + '</span></div>' +
          guestTotalLine(res.estimatedPlateCost) +
          (res.occasionNote ? '<div class="ptool-verdict-note">' + esc(res.occasionNote) + '</div>' : '') +
          aayojanPanel(res) +
          '<ul class="ptool-menu">' + items + '</ul>' +
          ((res.warnings && res.warnings.length) ? '<div class="ptool-note"><b>Note:</b> ' + res.warnings.map(esc).join(" · ") + '</div>' : '') +
          DISCLAIMER;
      }
      step("result");
    }

    function waCTA(msg) {
      var url = "https://wa.me/" + WA + "?text=" + encodeURIComponent("Hi Aayojan! " + msg);
      return '<a class="ptool-wa" href="' + url + '" target="_blank" rel="noopener">📱 Book verified kitchens on WhatsApp →</a>';
    }
  }

  function boot() {
    document.querySelectorAll(".ptool[data-tool]").forEach(initCard);
    // Drain any transactions that failed to write last session
    setTimeout(flushPendingTx, 2000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
