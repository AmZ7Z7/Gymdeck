"use client";

import { DUEL, GROUPS, RARITY_COLOR, CAPACITIES, SECOND_WIND, capIconSrc, type CapKind, type MuscleGroup } from "@/lib/config";
import { BEATS } from "@/lib/config";
import { capacityOf, capacityText, combatPower, deckBonus, groupOf, groupShort, teamHp, POSTURE_INFO } from "@/lib/duel";
import type { CardData } from "@/lib/engine";
import { GroupIcon } from "./Icons";

/** Icône d'une capacité : l'image fournie, sans fond ni cadre (décorative : le nom est toujours écrit à côté ou en libellé). */
export function CapIcon({ kind, className = "" }: { kind: CapKind; className?: string }) {
  return <img className={`capimg ${className}`} src={capIconSrc(kind)} alt="" draggable={false} decoding="async" />;
}

/** Symbole de la capacité de combat d'une carte (à droite du nom sur les cartes, ou seul). */
export function CapDot({ card, size }: { card: Pick<CardData, "exerciseSlug" | "rarity">; size?: number }) {
  const c = capacityOf(card);
  return (
    <span className={`capdot k-${c.kind}`} style={size ? { width: size, height: size } : undefined} title={`Capacité : ${c.name}`} role="img" aria-label={`Capacité : ${c.name}`}>
      <CapIcon kind={c.kind} />
    </span>
  );
}

const fmtV = (kind: CapKind, v: number) =>
  kind === "power" || kind === "second" ? `×${String(v).replace(".", ",")}`
    : kind === "feint" ? (v > 0 ? `+${Math.round(v * 100)} %` : "posture")
      : kind === "combo" ? `2 × ${Math.round(v * 100)} %`
        : `${Math.round(v * 100)} %`;

const beatsOf = (g: MuscleGroup) => BEATS[g];
const beatenBy = (g: MuscleGroup) => (Object.keys(BEATS) as MuscleGroup[]).find((k) => BEATS[k] === g);
const gname = (g?: MuscleGroup) => (g ? groupShort(g) : "");

/** Section « En combat » du détail d'une carte : capacité, valeurs par rareté, triangle, PV apportés. */
export function CombatInfo({ card }: { card: CardData }) {
  const c = capacityOf(card);
  const g = groupOf(card);
  const def = CAPACITIES[g];
  const b = beatsOf(g), by = beatenBy(g);
  return (
    <div className="combatinfo" style={{ ["--cc" as string]: c.color }}>
      <div className="ci-head">En combat</div>
      <div className="ci-cap">
        <span className={`capdot big k-${c.kind}`} style={{ ["--cc" as string]: c.color }}><CapIcon kind={c.kind} /></span>
        <div>
          <b>{c.name}</b>
          <span>{capacityText(c.kind, c.value)}</span>
        </div>
      </div>
      {c.top ? (
        <div className="ci-vals">
          {(["SSR", "UR", "LR"] as const).map((r) => (
            <span key={r} className={card.rarity === r ? "on" : ""}><i style={{ color: RARITY_COLOR[r] }}>{r}</i>{fmtV(def.kind, def.values[r])}</span>
          ))}
        </div>
      ) : (
        <div className="ci-note">Les cartes C, R et SR ont toutes Second souffle. Les SSR, UR et LR ont une capacité propre à leur groupe : {def.name} pour {groupShort(g)}.</div>
      )}
      <div className="ci-rows">
        <div><span>Groupe</span><b><GroupIcon id={g} width={16} height={16} /> {GROUPS.find((x) => x.id === g)!.name}</b></div>
        <div><span>Triangle</span><b>{b ? `bat ${gname(b)} · battu par ${gname(by)}` : "neutre (ni avantage, ni faiblesse)"}</b></div>
        <div><span>PV apportés</span><b>{Math.round((card.atq + card.def) / 2).toLocaleString("fr-FR")}</b></div>
      </div>
    </div>
  );
}

/** Résumé des bonus de combat d'un deck (synergies + passifs). */
export function BonusLine({ cards }: { cards: CardData[] }) {
  const b = deckBonus(cards);
  const parts: string[] = [];
  for (const s of b.groups) parts.push(`${groupShort(s.group)} ×${s.count} +${s.pct} %`);
  if (b.allDistinct) parts.push(`5 groupes +${DUEL.allGroupsPct} %`);
  if (b.passiveAtq > 0) parts.push(`Passifs +${b.passiveAtq.toFixed(1).replace(".", ",")} % ATQ`);
  if (b.passiveDef > 0) parts.push(`Passifs +${b.passiveDef.toFixed(1).replace(".", ",")} % DEF`);
  if (parts.length === 0) return <div className="bonusline none">Aucune synergie : regroupe 2 cartes du même groupe, ou prends 5 groupes différents.</div>;
  return <div className="bonusline">{parts.map((p) => <span key={p}>{p}</span>)}</div>;
}

export const deckStats = (cards: CardData[]) => ({ hp: teamHp(cards), power: combatPower(cards) });

/** Règles des combats (courtes : l'essentiel, puis le tableau des capacités). */
export function RulesBody() {
  const P = POSTURE_INFO;
  return (
    <div className="crules">
      <section>
        <h3>Le combat</h3>
        <p>5 manches. À chaque manche, chacun pose une carte (une seule fois) et choisit une posture. Le premier à 0 PV perd ; sinon, le plus de PV restants gagne.</p>
      </section>
      <section>
        <h3>Postures</h3>
        <div className="rtable">
          {(["force", "technique", "garde"] as const).map((k) => <div key={k}><b>{P[k].name}</b><span>{P[k].short}</span></div>)}
        </div>
      </section>
      <section>
        <h3>Groupes</h3>
        <p>Pecs › Épaules › Dos › Pecs · Jambes › Abdos › Cardio › Jambes : +{DUEL.trianglePct} % d’ATQ. Plusieurs cartes du même groupe se renforcent.</p>
      </section>
      <section>
        <h3>Capacités</h3>
        <p>La jauge (éclair) se remplit à chaque manche. Pleine : une capacité par combat, celle de la carte posée. Un coup ne dépasse jamais {DUEL.hitCapPct} % des PV (« MAX »).</p>
        <div className="captable">
          <div className="ct-h"><span /><span>SSR</span><span>UR</span><span>LR</span></div>
          {(Object.keys(CAPACITIES) as MuscleGroup[]).map((g) => {
            const d = CAPACITIES[g];
            return (
              <div key={g} className="ct-r" style={{ ["--cc" as string]: d.color }}>
                <span className="ct-n"><span className={`capdot k-${d.kind}`} style={{ ["--cc" as string]: d.color }}><CapIcon kind={d.kind} /></span><b>{d.name}</b><small>{groupShort(g)}</small></span>
                {(["SSR", "UR", "LR"] as const).map((r) => <span key={r}>{fmtV(d.kind, d.values[r])}</span>)}
              </div>
            );
          })}
          <div className="ct-r" style={{ ["--cc" as string]: SECOND_WIND.color }}>
            <span className="ct-n"><span className="capdot k-second" style={{ ["--cc" as string]: SECOND_WIND.color }}><CapIcon kind="second" /></span><b>Second souffle</b><small>C · R · SR</small></span>
            <span className="span3">dégâts ×{String(DUEL.secondWind).replace(".", ",")}</span>
          </div>
        </div>
      </section>
      <section>
        <h3>Récompenses</h3>
        <p>{DUEL.daily} duels par jour (+{DUEL.perSession} avec ta séance). Victoire : +{DUEL.winGc} GC. Ton deck se défend seul : +{DUEL.defenseGc} GC par attaque repoussée.</p>
      </section>
    </div>
  );
}

/** Petite étiquette de groupe musculaire sous une carte. */
export function GroupTag({ card }: { card: CardData }) {
  const g = groupOf(card);
  return <span className={`gtag g-${g}`}>{groupShort(g)}</span>;
}
