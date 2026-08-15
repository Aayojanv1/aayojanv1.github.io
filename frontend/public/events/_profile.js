/* Aayojan · Profile menu
 * ------------------------------------------------------------------
 * Watches Firebase Auth state — when a user signs in (via the Google
 * button in the tools cards), a circular avatar appears top-right.
 * Clicking it opens a dropdown showing profile, credits, transactions,
 * sign-out and delete-my-data.
 */
(function () {
  "use strict";

  var FB = {
    apiKey: "AIzaSyBPvK0452Kgkp0Oevxm1zMRUWiqKdhmaZA",
    authDomain: "aayojan-a8c4f.firebaseapp.com",
    projectId: "aayojan-a8c4f",
    storageBucket: "aayojan-a8c4f.firebasestorage.app",
    messagingSenderId: "673829788583",
    appId: "1:673829788583:web:9f140241bf0466b197b482"
  };
  var DEV_EMAILS = ["gouravchat@gmail.com"];   // KEEP IN SYNC with _paidtools.js + backend main.py
  var DEV_CREDIT_FLOOR = 500;                   // 50 queries × 10 credits each
  var USE_COST = 10;                            // credits debited per query
  var FORCE_PAID = (function () {
    try { return new URLSearchParams(location.search).get("force_paid") === "1"; }
    catch (e) { return false; }
  })();
  function isDev(email) {
    if (FORCE_PAID) return false;
    return email && DEV_EMAILS.indexOf(String(email).trim().toLowerCase()) !== -1;
  }

  var _fbReady;
  function loadFirebase() {
    if (_fbReady) return _fbReady;
    _fbReady = new Promise(function (resolve) {
      if (window.firebase && firebase.auth && firebase.firestore) return resolve(firebase);
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

  function inr(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(+d)) return "";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("navProfile");
    var img = document.getElementById("navProfileImg");
    var init = document.getElementById("navProfileInit");
    var dd = document.getElementById("profileDd");
    if (!btn || !dd) return;

    var badge = document.getElementById("navProfileBadge");
    var _usageUnsub = null;

    function paintBadge(credits, hasFreeLeft, dev) {
      if (!badge) { console.warn("[profile] badge element not found"); return; }
      badge.classList.remove("free", "dev");
      console.log("[profile] paintBadge:", { credits: credits, hasFreeLeft: hasFreeLeft, dev: dev });
      if (dev) {
        badge.removeAttribute("hidden");
        badge.style.display = "";
        badge.classList.add("dev");
        badge.textContent = "∞";
        badge.title = "Developer account · unlimited queries";
        return;
      }
      if (credits >= USE_COST) {
        badge.removeAttribute("hidden");
        badge.style.display = "";
        // Show queries-remaining on the badge (nicer than a big 3-digit number)
        var queriesLeft = Math.floor(credits / USE_COST);
        badge.textContent = queriesLeft > 99 ? "99+" : String(queriesLeft);
        badge.title = credits + " credits = " + queriesLeft + " quer" + (queriesLeft === 1 ? "y" : "ies") + " remaining";
      } else if (hasFreeLeft) {
        badge.removeAttribute("hidden");
        badge.style.display = "";
        badge.classList.add("free");
        badge.textContent = "🎁";
        badge.title = "1 free query available";
      } else {
        badge.setAttribute("hidden", "");
        badge.style.display = "none";
      }
    }

    function ensureDevCredits(user) {
      // For dev accounts, top up Firestore counter to a floor so the profile
      // dropdown & stats look right. Backend still bypasses via DEV_EMAILS.
      loadFirebase().then(function (fb) {
        var ref = fb.firestore().collection("toolUsage").doc(user.uid);
        return ref.get().then(function (doc) {
          var u = doc.exists ? doc.data() : {};
          var cur = u.bundleCreditsRemaining || 0;
          var upd = {
            devAccount: true,
            devGrantedAt: new Date().toISOString(),
            email: user.email || null,
            displayName: user.displayName || null,
          };
          if (cur < DEV_CREDIT_FLOOR) upd.bundleCreditsRemaining = DEV_CREDIT_FLOOR;
          return ref.set(upd, { merge: true }).catch(function(){});
        });
      });
    }

    function subscribeToUsage(uid, dev) {
      if (_usageUnsub) { _usageUnsub(); _usageUnsub = null; }
      loadFirebase().then(function (fb) {
        _usageUnsub = fb.firestore().collection("toolUsage").doc(uid).onSnapshot(function (doc) {
          var u = doc.exists ? doc.data() : {};
          var credits = u.bundleCreditsRemaining || 0;
          var plCount = u.priceLensCount || 0;
          var bbCount = u.bhojonBuddyCount || 0;
          var hasFreeLeft = (plCount === 0) || (bbCount === 0);
          paintBadge(credits, hasFreeLeft, dev);
        }, function () { /* silent */ });
      });
    }

    loadFirebase().then(function (fb) {
      fb.auth().onAuthStateChanged(function (user) {
        console.log("[profile] auth state changed. user:", user ? user.email : "signed out");
        if (!user) {
          btn.style.display = "none";
          hideDd();
          if (_usageUnsub) { _usageUnsub(); _usageUnsub = null; }
          paintBadge(0, false, false);
          return;
        }
        // Signed in: show avatar (with photo or initial)
        btn.style.display = "";
        if (user.photoURL) {
          img.src = user.photoURL; img.style.display = "";
          init.style.display = "none";
        } else {
          img.style.display = "none";
          init.style.display = "";
          init.textContent = (user.displayName || user.email || "?").trim().charAt(0).toUpperCase();
        }
        var dev = isDev(user.email);
        if (dev) ensureDevCredits(user);   // top-up to 50 on Firestore for visibility
        subscribeToUsage(user.uid, dev);   // live badge updates
      });
    });

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (dd.hasAttribute("hidden")) openDd(); else hideDd();
    });
    document.addEventListener("click", function (e) {
      if (!dd.contains(e.target) && e.target !== btn) hideDd();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hideDd();
    });

    function openDd() {
      dd.removeAttribute("hidden");
      renderDd();
    }
    function hideDd() {
      dd.setAttribute("hidden", "");
    }

    function renderDd() {
      loadFirebase().then(function (fb) {
        var user = fb.auth().currentUser;
        if (!user) return;
        var uid = user.uid;

        document.getElementById("pddPhoto").src = user.photoURL || "";
        document.getElementById("pddName").textContent = user.displayName || "(no name)";
        document.getElementById("pddEmail").textContent = user.email || "";

        // Usage → credits
        fb.firestore().collection("toolUsage").doc(uid).get().then(function (doc) {
          var u = doc.exists ? doc.data() : {};
          document.getElementById("pddCredits").textContent = u.bundleCreditsRemaining || 0;
        });

        // Transactions — last 10 for this uid, newest first
        fb.firestore().collection("transactions")
          .where("uid", "==", uid).orderBy("createdAt", "desc").limit(10).get()
          .then(function (snap) {
            var list = document.getElementById("pddTxList");
            var countEl = document.getElementById("pddTxCount");
            var spentEl = document.getElementById("pddSpent");
            if (snap.empty) {
              list.innerHTML = '<div class="pdd-empty">No transactions yet.</div>';
              countEl.textContent = "0"; spentEl.textContent = "₹0";
              return;
            }
            var html = "", total = 0;
            snap.forEach(function (d) {
              var t = d.data();
              total += Number(t.amount || 0);
              var label = t.purpose === "aayojan_ai_bundle_5" ? "Bundle · 5 queries" :
                          (t.tool === "price_lens" ? "PriceLens · 1 query" :
                           t.tool === "bhojon_buddy" ? "Bhojon Buddy · 1 query" :
                           (t.purpose || t.tool || "Payment"));
              html += '<div class="pdd-tx">' +
                        '<div class="pdd-tx-l">' + esc(label) +
                          '<small>' + esc(fmtDate(t.createdAt)) + ' · ' + esc((t.paymentId||"").slice(0, 14)) + '…</small></div>' +
                        '<div class="pdd-tx-r">' + inr(t.amount) + '</div>' +
                      '</div>';
            });
            list.innerHTML = html;
            countEl.textContent = String(snap.size);
            spentEl.textContent = inr(total);
          })
          .catch(function (e) {
            var list = document.getElementById("pddTxList");
            list.innerHTML = '<div class="pdd-empty">Couldn\'t load transactions.</div>';
            console.warn("[profile] tx fetch failed:", e && e.message);
          });
      });
    }

    // Sign-out
    document.getElementById("pddSignout").addEventListener("click", function () {
      loadFirebase().then(function (fb) {
        fb.auth().signOut().then(function () { hideDd(); });
      });
    });

    // Delete my data — nukes user doc + tool usage + all their queries + transactions
    document.getElementById("pddDelete").addEventListener("click", function () {
      if (!confirm("This will permanently delete your profile, usage counters, query history and transaction records from Aayojan. Continue?")) return;
      loadFirebase().then(function (fb) {
        var user = fb.auth().currentUser; if (!user) return;
        var uid = user.uid;
        var db = fb.firestore();
        function deleteWhere(coll) {
          return db.collection(coll).where("uid", "==", uid).get().then(function (snap) {
            var batch = db.batch();
            snap.forEach(function (d) { batch.delete(d.ref); });
            return batch.commit();
          });
        }
        Promise.all([
          db.collection("users").doc(uid).delete().catch(function(){}),
          db.collection("toolUsage").doc(uid).delete().catch(function(){}),
          deleteWhere("priceLensQueries").catch(function(){}),
          deleteWhere("bhojonBuddyQueries").catch(function(){}),
          deleteWhere("transactions").catch(function(){}),
        ]).then(function () {
          alert("Your data has been deleted. Signing you out.");
          fb.auth().signOut().then(function () { hideDd(); });
        }).catch(function (e) {
          alert("Delete failed: " + (e && e.message ? e.message : "unknown"));
        });
      });
    });
  });
})();
