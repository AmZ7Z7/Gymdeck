"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

const hue = (h: number, l = 62) => `hsl(${h} 100% ${l}%)`;
const RAINBOW = "conic-gradient(from 0deg, #ff3b6b, #ffb020, #f6ff3b, #2dff8a, #3cc4ff, #8a5bff, #ff4fa3, #ff3b6b)";

/** Rend une fissure irrégulière qui part du centre, en coordonnées d'un carré de 200 × 200. */
function crackPath(angle: number, len: number, seed: number) {
  const pts: string[] = ["100,100"];
  let a = angle;
  let r = 0;
  for (let k = 1; k <= 5; k++) {
    r += len / 5;
    a += Math.sin(seed * 7.3 + k * 2.1) * 0.28;
    pts.push(`${(100 + Math.cos(a) * r).toFixed(1)},${(100 + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}

/**
 * Cinématique « légendaire » : suspense (fissures prismatiques, vignette) puis explosion
 * (flash, ondes arc-en-ciel, pilier de lumière, éclats, bandeau LÉGENDAIRE).
 */
export function LegendaryFX({ phase, cardW }: { phase: "charge" | "boom" | null; cardW: number }) {
  const cracks = useMemo(
    () => Array.from({ length: 9 }, (_, k) => ({
      d: crackPath((k / 9) * Math.PI * 2 + 0.3, 70 + ((k * 37) % 30), k + 1),
      delay: 0.25 + k * 0.14,
    })),
    [],
  );
  const shards = useMemo(
    () => Array.from({ length: 18 }, (_, k) => {
      const a = (k / 18) * Math.PI * 2 + (k % 3) * 0.12;
      const d = cardW * (0.8 + ((k * 53) % 70) / 50);
      return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: (k % 2 ? 1 : -1) * (180 + k * 40), s: 10 + ((k * 29) % 18), h: (k * 20) % 360 };
    }),
    [cardW],
  );
  const word = "LÉGENDAIRE".split("");

  if (!phase) return null;
  const size = cardW * 1.7;
  return (
    <div className="lgfx" aria-hidden>
      {phase === "charge" && (
        <>
          <motion.div className="lg-vignette" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.7, 0.5, 1] }} transition={{ duration: 1.9, times: [0, 0.2, 0.6, 1] }} />
          <motion.div
            className="lg-core"
            style={{ width: size * 0.7, height: size * 0.7 }}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 0.35, 0.6, 1], scale: [0.3, 0.8, 1, 1.5] }}
            transition={{ duration: 1.9, ease: "easeIn" }}
          />
          <svg className="lg-cracks" viewBox="0 0 200 200" style={{ width: size, height: size }}>
            <defs>
              <linearGradient id="lgcrack" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ff3b6b" /><stop offset=".25" stopColor="#ffd23b" /><stop offset=".5" stopColor="#2dff8a" />
                <stop offset=".75" stopColor="#3cc4ff" /><stop offset="1" stopColor="#c05bff" />
              </linearGradient>
            </defs>
            {cracks.map((c, i) => (
              <motion.path
                key={i}
                d={c.d}
                fill="none"
                stroke="url(#lgcrack)"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: [0, 1, 1] }}
                transition={{ duration: 0.45, delay: c.delay, ease: "easeOut" }}
              />
            ))}
          </svg>
        </>
      )}

      {phase === "boom" && (
        <>
          <motion.div className="lg-flash" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} />
          {[0, 1, 2].map((k) => (
            <motion.i
              key={k}
              className="lg-ring"
              style={{ borderColor: hue(k * 130 + 10), boxShadow: `0 0 30px ${hue(k * 130 + 10)}, inset 0 0 24px ${hue(k * 130 + 10)}` }}
              initial={{ scale: 0.15, opacity: 1 }}
              animate={{ scale: 3.6, opacity: 0 }}
              transition={{ duration: 1.25, delay: k * 0.13, ease: "easeOut" }}
            />
          ))}
          <motion.div
            className="lg-pillar"
            initial={{ opacity: 0, scaleX: 0.2, scaleY: 0.2 }}
            animate={{ opacity: [0, 1, 0.8, 0], scaleX: [0.2, 1, 1.5, 0.4], scaleY: [0.2, 1, 1, 1] }}
            transition={{ duration: 1.6, times: [0, 0.18, 0.55, 1], ease: "easeOut" }}
          />
          {shards.map((s, k) => (
            <motion.i
              key={k}
              className="lg-shard"
              style={{ width: s.s, height: s.s * 1.8, background: `linear-gradient(160deg, #fff, ${hue(s.h)})`, boxShadow: `0 0 14px ${hue(s.h)}` }}
              initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }}
              animate={{ x: s.x, y: s.y, rotate: s.r, opacity: 0, scale: 0.3 }}
              transition={{ duration: 1.1 + (k % 4) * 0.12, ease: [0.1, 0.7, 0.3, 1] }}
            />
          ))}
          <motion.div
            className="lg-banner"
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 1, 1, 0], y: [0, 0, 0, -8] }}
            transition={{ duration: 2.9, times: [0, 0.1, 0.78, 1] }}
          >
            <motion.i className="lg-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.25, duration: 0.5 }} />
            <div className="lg-word">
              {word.map((ch, k) => (
                <motion.span
                  key={k}
                  style={{ color: hue((k / word.length) * 330 + 5, 66), textShadow: `0 0 18px ${hue((k / word.length) * 330 + 5)}, 0 3px 0 rgba(0,0,0,.55)` }}
                  initial={{ opacity: 0, scale: 3.2, y: -26, filter: "blur(10px)" }}
                  animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ type: "spring", stiffness: 420, damping: 17, delay: 0.18 + k * 0.06 }}
                >
                  {ch}
                </motion.span>
              ))}
            </div>
            <motion.i className="lg-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.25, duration: 0.5 }} />
          </motion.div>
        </>
      )}
    </div>
  );
}

/** Étincelles qui montent doucement autour d'une carte légendaire révélée. */
export function LegendSparkles({ cardW }: { cardW: number }) {
  const items = useMemo(
    () => Array.from({ length: 16 }, (_, k) => ({
      x: ((k * 61) % 100) / 100 - 0.5,
      d: 2.4 + ((k * 17) % 20) / 10,
      delay: ((k * 37) % 30) / 10,
      s: 4 + ((k * 13) % 6),
      h: (k * 47) % 360,
    })),
    [],
  );
  return (
    <div className="lg-sparkles" aria-hidden>
      {items.map((p, k) => (
        <motion.i
          key={k}
          style={{ left: `${50 + p.x * 120}%`, width: p.s, height: p.s, background: hue(p.h, 75), boxShadow: `0 0 10px ${hue(p.h)}` }}
          initial={{ y: cardW * 0.7, opacity: 0, scale: 0.4 }}
          animate={{ y: -cardW * 0.8, opacity: [0, 1, 1, 0], scale: [0.4, 1, 0.8, 0.2] }}
          transition={{ duration: p.d, delay: p.delay, repeat: Infinity, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

export { RAINBOW };
