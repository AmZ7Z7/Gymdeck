"use client";

import { useRef } from "react";
import { FRAME_LAYOUT, GRADE_LABEL, RARITY_COLOR, exerciseBySlug, gradeMedal, medalSrc, type Rarity } from "@/lib/config";
import type { CardData, Passive } from "@/lib/engine";
import { Shield, Swords } from "./Icons";
import { CapDot } from "./CombatBits";

const pct = (tenths: number) => `+${(tenths / 10).toFixed(1).replace(".", ",")} %`;

function passiveLines(p: Passive): string[] {
  if (p.type === "ATQ") return [`${pct(p.atqTenths)} ATQ`];
  if (p.type === "DEF") return [`${pct(p.defTenths)} DEF`];
  return [`${pct(p.atqTenths)} ATQ`, `${pct(p.defTenths)} DEF`];
}

export function passiveLabel(p: Passive): string {
  return passiveLines(p).join(" · ") + " du deck";
}

/** `hideStats` : aperçu (Forge) où ATQ et DEF ne sont pas encore tirées. */
export function Card({ card, count, holo = true, cap = true, hideStats = false }: { card: CardData; count?: number; holo?: boolean; cap?: boolean; hideStats?: boolean }) {
  const L = FRAME_LAYOUT[card.rarity];
  const ex = exerciseBySlug(card.exerciseSlug);
  const bandH = (L.statsBottom - L.statsTop) * 144; // en cqw
  const color = RARITY_COLOR[card.rarity as Rarity];
  const top = card.rarity === "UR" || card.rarity === "LR";
  return (
    <div className={`card ${card.grade ? "graded" : ""}`}>
      <img className="frame" src={`/assets/frames/${card.rarity}.webp`} alt="" draggable={false} decoding="async" />
      {holo && top && (
        <span
          className={`holo ${card.rarity === "LR" ? "lr" : "ur"}`}
          style={{ ["--mask" as string]: `url(/assets/frames/${card.rarity}-shine.webp)` }}
          aria-hidden
        />
      )}
      <img
        className="art"
        src={ex.image}
        alt={ex.name}
        draggable={false}
        style={{
          top: "8.5%", height: `${L.nameTop * 100 - 10}%`,
          ...(ex.fit ? { transform: `translate(${ex.fit.x ?? 0}%, ${ex.fit.y ?? 0}%) scale(${ex.fit.s ?? 1})` } : {}),
        }}
      />
      <img className="brand" src="/assets/ui/wordmark.webp" alt="" draggable={false} decoding="async" />
      <span className="badge" style={{ color }}>{card.rarity}</span>
      {/* note de Basile : patch posé sur les traits décoratifs de l'en-tête (rien du tout si la carte n'est pas notée) */}
      {card.grade ? <GradePatch grade={card.grade} className="oncard" style={{ left: `${L.gradeX * 100}%`, top: `${L.gradeTop * 100}%` }} /> : null}
      <div
        className={`nameband ${cap ? "withcap" : ""}`}
        style={{
          top: `${L.nameTop * 100}%`,
          height: `${(L.statsTop - L.nameTop) * 100}%`,
          // avec le symbole de capacité à droite, un nom long passe sur deux lignes au lieu de rétrécir
          ...(cap
            ? (ex.name.length > 30 ? { fontSize: "5.3cqw" } : ex.name.length > 16 ? { fontSize: "6.2cqw" } : {})
            : (ex.name.length > 30 ? { fontSize: "5.6cqw" } : ex.name.length > 16 ? { fontSize: "6.9cqw", whiteSpace: "nowrap" } : {})),
        }}
      >
        {ex.name}
      </div>
      {cap && (
        <span className="capslot" style={{ top: `${L.nameTop * 100}%`, height: `${(L.statsTop - L.nameTop) * 100}%` }}>
          <CapDot card={card} />
        </span>
      )}
      <div className="statband" style={{ top: `${L.statsTop * 100}%`, height: `${(L.statsBottom - L.statsTop) * 100}%`, ["--b" as string]: `${bandH}cqw` }}>
        <div className="stats">
          <Swords style={{ width: `calc(var(--b) * .38)`, height: `calc(var(--b) * .38)` }} />
          <span className="lab" style={{ fontSize: `calc(var(--b) * .27)` }}>ATQ</span>
          <span className="val" style={{ fontSize: `calc(var(--b) * .44)` }}>{hideStats ? "?" : card.atq}</span>
          <Shield style={{ width: `calc(var(--b) * .38)`, height: `calc(var(--b) * .38)` }} />
          <span className="lab" style={{ fontSize: `calc(var(--b) * .27)` }}>DEF</span>
          <span className="val" style={{ fontSize: `calc(var(--b) * .44)` }}>{hideStats ? "?" : card.def}</span>
        </div>
        {top && card.passive && (
          <>
            <i className="sep" style={{ background: `linear-gradient(180deg, transparent, ${color} 18%, ${color} 82%, transparent)` }} />
            <div className={`passive ${card.passive.type === "BOTH" ? "both" : ""}`} style={{ ["--pc" as string]: color }}>
              <small>{card.passive.type === "BOTH" ? "PASSIF · DU DECK" : "PASSIF"}</small>
              {passiveLines(card.passive).map((l) => <b key={l}>{l}</b>)}
              {card.passive.type !== "BOTH" && <em>du deck</em>}
            </div>
          </>
        )}
      </div>
      {count && count > 1 ? <span className="count">×{count}</span> : null}
    </div>
  );
}

/** Couleur du patch selon la note : bronze 1-3, argent 4-5, bleu 6-7, violet 8, or 9, platine noir 10. */
export const gradeTier = (g: number) => (g >= 10 ? "t10" : g === 9 ? "t9" : g === 8 ? "t8" : g >= 6 ? "t67" : g >= 4 ? "t45" : "t13");

/** Patch de certification : rectangle biseauté, uniquement le chiffre de la note. */
export function GradePatch({ grade, className = "", style }: { grade: number; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`gpatch ${gradeTier(grade)} ${className}`} style={style} role="img" aria-label={`Note de Basile : ${grade} sur 10 (${GRADE_LABEL[grade]})`} title={`Note ${grade}/10 · ${GRADE_LABEL[grade]}`}>
      <b>{grade}</b>
    </span>
  );
}

/** Grand bandeau de certification (fiche détaillée uniquement) : identité GymDeck, carte, et note dans son patch. */
export function GradeBanner({ card }: { card: CardData }) {
  if (!card.grade) return null;
  return (
    <div className={`gbanner ${gradeTier(card.grade)}`}>
      <div className="gb-l">
        <img src="/assets/ui/wordmark.webp" alt="GymDeck" draggable={false} />
        <span className="gb-cert">Expertisée par Basile</span>
        <b className="gb-name">{exerciseBySlug(card.exerciseSlug).name}</b>
        <span className="gb-sub"><i style={{ color: RARITY_COLOR[card.rarity] }}>{card.rarity}</i> · {GRADE_LABEL[card.grade]}</span>
      </div>
      <GradePatch grade={card.grade} className="big" />
    </div>
  );
}

/** Médaille seule (carte, atelier, règles, listes) : l'image et le chiffre gravé dessus. */
export function Medal({ grade, className = "" }: { grade: number; className?: string }) {
  return (
    <i className={`medal m-${gradeMedal(grade)} ${className}`} aria-hidden>
      <img src={medalSrc(grade)} alt="" draggable={false} decoding="async" />
      <b>{grade}</b>
    </i>
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
