import { useEffect, useState } from "react";

// English + Bengali rotation — anchors, emotions, and 30% memes
const HEADLINES = [
  // 🔧 Anchors — the value prop
  { text: "Cook. Quote. Get paid. Repeat.", lang: "en" },
  { text: "রান্না করো। অর্ডার নাও। টাকা গোনো।", lang: "bn" },

  // 🔥 30% memes — punchlines without naming names
  { text: "Other apps: 30%. Us: 3%. The math is mathing. 🧮", lang: "en" },
  { text: "৩০% কমিশন? এটা পার্টনারশিপ না, স্পনসরশিপ 🎤", lang: "bn" },
  { text: "Why give 30% to an app? Keep your 27. 💰", lang: "en" },
  { text: "১ লাখের অর্ডার। ৩০ হাজার গায়েব। কাকে? 🙃", lang: "bn" },

  // ❤️ Emotional pulls — speak to the pain
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
