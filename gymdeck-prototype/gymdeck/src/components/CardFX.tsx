"use client";

import { useEffect, useRef } from "react";
import { RARITY_COLOR } from "@/lib/config";
import type { CardData } from "@/lib/engine";
import { Card, fxTier } from "./Card";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Carte avec l'effet de sa rareté. C, R, SR : aucun effet lumineux.
 * À partir de SSR, crescendo : SSR reflet doux sur le cadre · UR lumière qui fait le tour du cadre, lueur, étincelles ·
 * LR deux lumières, halo multicolore, éclats en étoile, étincelles. La lumière ne passe jamais sur l'illustration.
 * Tout en CSS ; le JS ne sert qu'à l'inclinaison (souris, doigt ou gyroscope).
 */
export function CardFX({ card, tilt = true, className = "" }: { card: CardData; tilt?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const tier = fxTier(card.rarity);
  const moving = tilt && tier !== "mat";
  const top = tier === "holo";
  const lit = tier === "metal" || top;

  useEffect(() => {
    const el = ref.current;
    if (!el || !moving || reduced()) return;
    let raf = 0;
    const set = (x: number, y: number) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--fx-x", x.toFixed(3));
        el.style.setProperty("--fx-y", y.toFixed(3));
      });
    };
    // gyroscope du téléphone (si disponible et autorisé) : la carte suit l'inclinaison
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      set(Math.max(-1, Math.min(1, e.gamma / 30)), Math.max(-1, Math.min(1, (e.beta - 45) / 30)));
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("deviceorientation", onTilt); };
  }, [moving]);

  const move = (e: React.PointerEvent) => {
    if (!moving || reduced()) return;
    const r = ref.current!.getBoundingClientRect();
    ref.current!.style.setProperty("--fx-x", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    ref.current!.style.setProperty("--fx-y", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  };
  const leave = () => { ref.current?.style.setProperty("--fx-x", "0"); ref.current?.style.setProperty("--fx-y", "0"); };

  return (
    <div
      ref={ref}
      className={`cfx cfx-${tier} cfx-${card.rarity} ${moving ? "cfx-tilt" : ""} ${className}`}
      style={{ ["--rc" as string]: RARITY_COLOR[card.rarity], ["--fmask" as string]: `url(/assets/frames/${card.rarity}.webp)` }}
      onPointerMove={move}
      onPointerLeave={leave}
      onPointerUp={leave}
    >
      {top && <span className="cfx-aura" aria-hidden />}
      <div className="cfx-in">
        <Card card={card} holo={false} />
        {/* la lumière reste sur le cadre : le masque découpe la forme de la carte, puis retire l'intérieur */}
        {lit && <span className="cfx-rim" aria-hidden><i /></span>}
        {card.rarity === "LR" && (
          <span className="cfx-stars" aria-hidden>
            {Array.from({ length: 5 }, (_, k) => <i key={k} style={{ ["--k" as string]: k }} />)}
          </span>
        )}
      </div>
      {top && (
        <span className="cfx-sparks" aria-hidden>
          {Array.from({ length: card.rarity === "LR" ? 8 : 4 }, (_, k) => <i key={k} style={{ ["--k" as string]: k * (card.rarity === "LR" ? 1 : 2) }} />)}
        </span>
      )}
    </div>
  );
}
