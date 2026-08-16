#!/usr/bin/env node
/*
 * Quick Firestore counter for PriceLens + Bhojon Buddy queries.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./sa-key.json node tools/free-trial-count.js
 *   node tools/free-trial-count.js --days 7          (last 7 days only)
 *   node tools/free-trial-count.js --sample          (also print 3 sample docs per tool)
 *
 * Requires: firebase-admin (npm i -g firebase-admin  OR  add to a local package.json)
 * Service-account key: download from Firebase Console → Project settings → Service accounts.
 */

const admin = require("firebase-admin");

const args = new Set(process.argv.slice(2));
const daysIdx = process.argv.indexOf("--days");
const days = daysIdx > -1 ? parseInt(process.argv[daysIdx + 1], 10) : null;
const sample = args.has("--sample");

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const cutoffIso = days ? new Date(Date.now() - days * 86400000).toISOString() : null;

async function countFor(coll) {
  let free = db.collection(coll).where("wasFree", "==", true);
  let paid = db.collection(coll).where("wasFree", "==", false);
  if (cutoffIso) {
    free = free.where("createdAt", ">=", cutoffIso);
    paid = paid.where("createdAt", ">=", cutoffIso);
  }
  const [f, p] = await Promise.all([free.count().get(), paid.count().get()]);
  return { free: f.data().count, paid: p.data().count };
}

async function sampleFor(coll) {
  const snap = await db.collection(coll).orderBy("createdAt", "desc").limit(3).get();
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      when: x.createdAt,
      wasFree: x.wasFree,
      email: x.email,
      input: x.input,
    };
  });
}

(async () => {
  const label = cutoffIso ? `last ${days} day(s)` : "all-time";
  console.log(`\nFirestore query counts — ${label}\n`);

  for (const coll of ["priceLensQueries", "bhojonBuddyQueries"]) {
    const { free, paid } = await countFor(coll);
    const total = free + paid;
    const freePct = total ? ((free / total) * 100).toFixed(1) : "0.0";
    console.log(
      `  ${coll.padEnd(20)}  ${String(total).padStart(4)} total  ·  ` +
        `${String(free).padStart(4)} free (${freePct}%)  ·  ` +
        `${String(paid).padStart(4)} paid`
    );

    if (sample) {
      const rows = await sampleFor(coll);
      rows.forEach((r) => {
        const inputStr = JSON.stringify(r.input).slice(0, 80);
        console.log(`    · ${r.when}  ${r.wasFree ? "FREE" : "PAID"}  ${r.email || "?"}  ${inputStr}`);
      });
    }
  }
  console.log("");
  process.exit(0);
})().catch((e) => {
  console.error("Error:", e.message || e);
  process.exit(1);
});
