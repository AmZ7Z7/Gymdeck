"use client";

import { useRef } from "react";
import { FRAME_LAYOUT, RARITY_COLOR, exerciseBySlug, type Rarity } from "@/lib/config";
import type { CardData, Passive } from "@/lib/engine";
import { Shield, Swords } from "./Icons";

const pct = (tenths: number) => `+${(tenths / 10).toFixed(1).replace(".", ",")} %`;

function passiveLines(p: Passive): string[] {
  if (p.type === "ATQ") return [`${pct(p.atqTenths)} ATQ`];
  if (p.type === "DEF") return [`${pct(p.defTenths)} DEF`];
  return [`${pct(p.atqTenths)} ATQ`, `${pct(p.defTenths)} DEF`];
}

export function passiveLabel(p: Passive): string {
  return passiveLines(p).join(" · ") + " du deck";
}

export function Card({ card, count, holo = true }: { card: CardData; count?: number; holo?: boolean }) {
  const L = FRAME_LAYOUT[card.rarity];
  const ex = exerciseBySlug(card.exerciseSlug);
  const bandH = (L.statsBottom - L.statsTop) * 144; // en cqw
  const color = RARITY_COLOR[card.rarity as Rarity];
  const top = card.rarity === "UR" || card.rarity === "LR";
  return (
    <div className="card">
      <img className="frame" src={`/assets/frames/${card.rarity}.webp`} alt="" draggable={false} decoding="async" />
      <img
        className="art"
        src={ex.image}
        alt={ex.name}
        draggable={false}
        style={{ top: "8.5%", height: `${L.nameTop * 100 - 10}%` }}
      />
      <span className="brand">GYMDECK</span>
      <span className="badge" style={{ color }}>{card.rarity}</span>
      <div
        className="nameband"
        style={{
          top: `${L.nameTop * 100}%`,
          height: `${(L.statsTop - L.nameTop) * 100}%`,
          ...(ex.name.length > 16 ? { fontSize: "6.9cqw", whiteSpace: "nowrap" } : {}),
        }}
      >
        {ex.name}
      </div>
      <div className="statband" style={{ top: `${L.statsTop * 100}%`, height: `${(L.statsBottom - L.statsTop) * 100}%`, ["--b" as string]: `${bandH}cqw` }}>
        <div className="stats">
          <Swords style={{ width: `calc(var(--b) * .38)`, height: `calc(var(--b) * .38)` }} />
          <span className="lab" style={{ fontSize: `calc(var(--b) * .27)` }}>ATQ</span>
          <span className="val" style={{ fontSize: `calc(var(--b) * .44)` }}>{card.atq}</span>
          <Shield style={{ width: `calc(var(--b) * .38)`, height: `calc(var(--b) * .38)` }} />
          <span className="lab" style={{ fontSize: `calc(var(--b) * .27)` }}>DEF</span>
          <span className="val" style={{ fontSize: `calc(var(--b) * .44)` }}>{card.def}</span>
        </div>
        {top && card.passive && (
          <div className="passive" style={{ fontSize: `calc(var(--b) * .22)` }}>
            <small>PASSIF</small>
            {passiveLines(card.passive).map((l) => <div key={l}>{l}</div>)}
            <div style={{ opacity: .8, fontWeight: 600 }}>du deck</div>
          </div>
        )}
      </div>
      {holo && top && (
        <span
          className={`holo ${card.rarity === "LR" ? "lr" : "ur"}`}
          style={{ ["--mask" as string]: `url(/assets/frames/${card.rarity}.webp)` }}
          aria-hidden
        />
      )}
      {count && count > 1 ? <span className="count">×{count}</span> : null}
    </div>
  );
}

export function CardBack() {
  return <img src="/assets/ui/dos-carte.webp" alt="" draggable={false} />;
}

/** Carte qui s'incline sous le doigt et dont le reflet holographique suit le pointeur. */
export function Tilt({ children, max = 12 }: { children: React.ReactNode; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (x: number, y: number, on: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", on ? `${(0.5 - y) * 2 * max}deg` : "0deg");
    el.style.setProperty("--ry", on ? `${(x - 0.5) * 2 * max}deg` : "0deg");
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  };
  const move = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    set(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)), true);
  };
  return (
    <div ref={ref} className="tilt" onPointerMove={move} onPointerDown={move} onPointerLeave={() => set(0.5, 0.5, false)} onPointerUp={() => set(0.5, 0.5, false)}>
      {children}
    </div>
  );
}
