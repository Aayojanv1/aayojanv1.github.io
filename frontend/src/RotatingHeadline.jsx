import { useEffect, useState } from "react";

// English + Bengali rotation — built for the intelligent Bengali reader
// Style: wit over volume. Wordplay over confrontation. Let the math do the punching.
const HEADLINES = [
  // 🔧 Anchors — three places, three outcomes
  { text: "Fire in the kitchen. Orders in WhatsApp. Cash in the bank. 🔥📱🏦", lang: "en" },
  { text: "আগুন রান্নায়। অর্ডার মোবাইলে। লাভ ব্যাঙ্কে। 🔥📱🏦", lang: "bn" },
  { text: "Cook. Quote. Get paid. Repeat.", lang: "en" },

  // 🧠 The 30% comparison — intelligent, not loud
  { text: "₹1L on the menu — keep ₹97K with us, ₹70K elsewhere. Same kitchen, different math. 🧮", lang: "en" },
  { text: "৩০% কমিশন? এটা পার্টনারশিপ না, স্পনসরশিপ 🎤", lang: "bn" },
  { text: "Same dish. Same effort. 27% more in your pocket. ✨", lang: "en" },
  { text: "অ্যাপ বলে 'পার্টনার'। চুক্তি বলে অন্য কিছু 📜", lang: "bn" },

  // ❤️ Emotional — the gentle truths
  { text: "Your kitchen's been ready. Your phone hasn't.", lang: "en" },
  { text: "এবার বাজবে আপনার ফোন।", lang: "bn" },
  { text: "Cook more. Chase less.", lang: "en" },
  { text: "চা দিয়ে অর্ডার আসে না। Aayojan এ আসে। ☕→🍛", lang: "bn" },
];

const HOLD_MS = 3500;
const FADE_MS = 450;

export default function RotatingHeadline() {
  const [idx, setIdx] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setFadingOut(true);
      setTimeout(() => {
        setIdx((i) => (i + 1) % HEADLINES.length);
        setFadingOut(false);
      }, FADE_MS);
    }, HOLD_MS);
    return () => clearInterval(t);
  }, []);

  const h = HEADLINES[idx];
  const bengali = h.lang === "bn";

  return (
    <span
      style={{
        color: "#E8760A",
        display: "inline-block",
        transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
        opacity: fadingOut ? 0 : 1,
        transform: fadingOut ? "translateY(-10px)" : "translateY(0)",
        fontFamily: bengali
          ? "'Noto Serif Bengali','Playfair Display',serif"
          : "'Playfair Display',serif",
        letterSpacing: bengali ? "-0.005em" : undefined,
      }}
    >
      {h.text}
    </span>
  );
}
