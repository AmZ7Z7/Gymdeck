"use client";

import { CARD_LAYOUT, GRADE_LABEL, RARITY_COLOR, exerciseBySlug, gradeMedal, medalSrc, type Rarity } from "@/lib/config";
import type { CardData, Passive } from "@/lib/engine";
import { Shield, Swords } from "./Icons";
import { CapDot } from "./CombatBits";
import { capacityOf } from "@/lib/duel";

const pct = (tenths: number) => `+${(tenths / 10).toFixed(1).replace(".", ",")} %`;

function passiveLines(p: Passive): string[] {
  if (p.type === "ATQ") return [`${pct(p.atqTenths)} ATQ`];
  if (p.type === "DEF") return [`${pct(p.defTenths)} DEF`];
  return [`${pct(p.atqTenths)} ATQ`, `${pct(p.defTenths)} DEF`];
}

export function passiveLabel(p: Passive): string {
  return passiveLines(p).join(" · ") + " du deck";
}

/** Image du cadre v2 (carte vierge complète : fond + bordure, kit du 24 oct. 2026). */
export const frameSrc = (r: Rarity) => `/assets/frames/v2/${r}.webp`;

/** Zone de l'illustration : toute la largeur de la fenêtre, du haut (sous le cartouche) jusqu'au bandeau du nom. */
const artBox = (L: { art: { x: number; y: number; w: number; h: number }; title: { y: number } }) => {
  const top = L.art.y - 0.055;
  return { x: 0.105, y: top, w: 0.79, h: L.title.y - 0.012 - top };
};

/** Couleur des lettres de rareté, accordée à chaque cadre. */
const BADGE_COLOR: Record<Rarity, string> = { C: "#e3e7ee", R: "#3ee88a", SR: "#5cc8ff", SSR: "#d77bff", UR: "#ffc93c", LR: "#8fdcff" };

const pos = (b: { x: number; y: number; w: number; h: number }): React.CSSProperties => ({
  left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`,
});

/** `hideStats` : aperçu (Forge) où ATQ et DEF ne sont pas encore tirées. */
export function Card({ card, count, holo = true, cap = true, hideStats = false }: { card: CardData; count?: number; holo?: boolean; cap?: boolean; hideStats?: boolean }) {
  const L = CARD_LAYOUT[card.rarity];
  const ex = exerciseBySlug(card.exerciseSlug);
  const color = RARITY_COLOR[card.rarity as Rarity];
  const top = card.rarity === "UR" || card.rarity === "LR";
  const capa = capacityOf(card);
  // effet de rareté, version légère et fixe (grilles, listes) ; la version animée complète est CardFX
  const tier = fxTier(card.rarity);
  const n = ex.name.length;
  return (
    <div
      className={`card ${card.grade ? "graded" : ""} ${holo ? `fxl fxl-${tier} fxl-${card.rarity}` : ""}`}
      style={holo ? { ["--rc" as string]: color, ["--fmask" as string]: `url(${frameSrc(card.rarity)})` } : undefined}
    >
      <img className="frame" src={frameSrc(card.rarity)} alt="" draggable={false} decoding="async" />
      {/* fenêtre de l'illustration : le personnage et son matériel ne débordent jamais sur le nom, la rareté ou le panneau du bas */}
      <div className="artwin" style={{ clipPath: L.clip }}>
        <i className="floor" style={{ left: "18%", width: "64%", top: `${(L.title.y - 0.05) * 100}%`, height: "6%" }} aria-hidden />
        <img
          className="art"
          src={ex.image}
          alt={ex.name}
          draggable={false}
          style={{
            ...pos(artBox(L)),
            ...(ex.fit ? { transform: `translate(${ex.fit.x ?? 0}%, ${ex.fit.y ?? 0}%) scale(${ex.fit.s ?? 1})` } : {}),
          }}
        />
      </div>
      {/* lettre de rareté : grande, pleine, dans le cartouche du cadre (comme les anciens cadres) */}
      <span className="badge" style={{ ...pos(L.rarity), fontSize: `${L.rarity.h * 150 * (card.rarity.length > 2 ? 0.86 : 1.02)}cqw`, color: BADGE_COLOR[card.rarity] }}>{card.rarity}</span>
      {/* note de Basile : patch dans l'espace libre en haut au centre (rien du tout si la carte n'est pas notée) */}
      {card.grade ? <GradePatch grade={card.grade} className="oncard" style={{ left: "38%", top: `${(L.rarity.y + 0.004) * 100}%` }} /> : null}
      <div className="nameband" style={{ ...pos(L.title), ...(n > 26 ? { fontSize: "4.6cqw" } : n > 18 ? { fontSize: "5.4cqw" } : {}) }}>
        <span>{ex.name}</span>
      </div>
      {/* panneau du bas : ATQ/DEF à gauche, symbole de capacité au milieu, passif (UR/LR) ou nom de capacité à droite */}
      <div className="cpanel" style={{ ...pos({ x: L.stats.x, y: L.stats.y, w: L.right.x + L.right.w - L.stats.x, h: L.stats.h }), ["--k" as string]: Math.max(1, Math.min(1.3, L.stats.h / 0.1)) }}>
        <div className="cstats">
          <Swords /><span className="lab">ATQ</span><span className="val">{hideStats ? "?" : card.atq}</span>
          <Shield /><span className="lab">DEF</span><span className="val">{hideStats ? "?" : card.def}</span>
        </div>
        <i className="csep" style={{ ["--pc" as string]: BADGE_COLOR[card.rarity] }} />
        <span className="cability">{cap && <CapDot card={card} />}</span>
        <i className="csep" style={{ ["--pc" as string]: BADGE_COLOR[card.rarity] }} />
        <div className={`cright ${top && card.passive?.type === "BOTH" ? "both" : ""}`} style={{ ["--pc" as string]: BADGE_COLOR[card.rarity] }}>
          {top && card.passive ? (
            <>
              <small>PASSIF</small>
              {passiveLines(card.passive).map((l) => <b key={l}>{l}</b>)}
              <em>du deck</em>
            </>
          ) : cap ? (
            <>
              <small>CAPACITÉ</small>
              <b className="capname" style={{ color: capa.color }}>{capa.name}</b>
            </>
          ) : null}
        </div>
      </div>
      {holo && tier !== "mat" && <span className="fxl-sheen" aria-hidden />}
      {holo && tier === "holo" && <span className="fxl-rainbow" aria-hidden />}
      {count && count > 1 ? <span className="count">×{count}</span> : null}
    </div>
  );
}

/** Niveau d'effet selon la rareté, de plus en plus spectaculaire (l'ordre C → LR ne change pas). */
export const fxTier = (r: Rarity) => (r === "C" ? "mat" : r === "R" || r === "SR" ? "rare" : r === "SSR" ? "metal" : "holo");

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
