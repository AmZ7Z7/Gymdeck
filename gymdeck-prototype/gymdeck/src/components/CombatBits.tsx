"use client";

import { DUEL, GROUPS, RARITY_COLOR, CAPACITIES, SECOND_WIND, type CapKind, type MuscleGroup } from "@/lib/config";
import { BEATS } from "@/lib/config";
import { capacityOf, capacityText, combatPower, deckBonus, groupOf, groupShort, teamHp, POSTURE_INFO, CONSIGNES } from "@/lib/duel";
import type { CardData } from "@/lib/engine";
import { GroupIcon, IconBolt, IconCombo, IconEye, IconFist, IconHeartPlus, IconReturn, IconWind, Shield } from "./Icons";

const ICONS: Record<CapKind, (p: React.SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  power: IconFist, counter: IconReturn, feint: IconEye, combo: IconCombo, wall: Shield, heal: IconHeartPlus, replay: IconBolt, second: IconWind,
};

/** Icône d'une capacité (chacune a sa forme et sa couleur). */
export function CapIcon({ kind, ...p }: React.SVGProps<SVGSVGElement> & { kind: CapKind }) {
  const I = ICONS[kind];
  return <I {...p} />;
}

/** Pastille ronde de capacité (posée sur les cartes SSR, UR et LR). */
export function CapDot({ card, size }: { card: Pick<CardData, "exerciseSlug" | "rarity">; size?: number }) {
  const c = capacityOf(card);
  return (
    <span className={`capdot k-${c.kind}`} style={{ ["--cc" as string]: c.color, ...(size ? { width: size, height: size } : {}) }} title={c.name} aria-label={`Capacité : ${c.name}`}>
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

/** Règles complètes des combats (page « Règles »). */
export function RulesBody() {
  const P = POSTURE_INFO;
  return (
    <div className="crules">
      <section>
        <h3>Le principe</h3>
        <p>Tu affrontes le deck d’un autre joueur. Chaque équipe a des <b>PV</b> : la somme des (ATQ + DEF) / 2 de ses 5 cartes. À chaque manche, vous posez une carte et une posture en même temps. 5 manches au plus.</p>
        <p>Le premier à 0 PV perd (KO). Sinon, après 5 manches, celui qui garde le plus de PV (en %) gagne.</p>
      </section>
      <section>
        <h3>Une manche</h3>
        <p>Choisis une carte de ta main (chaque carte ne sert qu’une fois), puis une posture. Tu vois les groupes des cartes adverses, pas laquelle il va jouer.</p>
        <p>Dégâts = ATQ − la moitié de la DEF adverse (au moins 15 % de l’ATQ), avec ± {DUEL.noisePct} % de hasard. Un coup ne dépasse jamais <b>{DUEL.hitCapPct} %</b> des PV adverses : la barre affiche alors <b>MAX</b>.</p>
      </section>
      <section>
        <h3>Les postures</h3>
        <div className="rtable">
          {(["force", "technique", "garde"] as const).map((k) => <div key={k}><b>{P[k].name}</b><span>{P[k].short}</span></div>)}
        </div>
        <p className="fine">Force bat Garde, Technique bat Force, Garde bat Technique.</p>
      </section>
      <section>
        <h3>Le triangle des groupes</h3>
        <p>Pecs › Épaules › Dos › Pecs, et Jambes › Abdos › Cardio › Jambes : +{DUEL.trianglePct} % d’ATQ pour la carte en avantage. Les Bras sont neutres.</p>
        <p>Synergies : 2 cartes du même groupe +{DUEL.synergyPct[2]} %, 3 → +{DUEL.synergyPct[3]} %, 4 → +{DUEL.synergyPct[4]} %, 5 → +{DUEL.synergyPct[5]} %. Cinq groupes différents : +{DUEL.allGroupsPct} % à tout le deck. Les passifs UR et LR comptent aussi.</p>
      </section>
      <section>
        <h3>La jauge et les capacités</h3>
        <p>La jauge se remplit à chaque manche, et plus vite quand tu prends des coups (encore plus vite avec une LR dans ton deck). Pleine, elle permet <b>une capacité par combat</b> : celle de la carte que tu poses.</p>
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
        <p className="fine">Les valeurs affichées sont les vraies valeurs : elles s’ajoutent après la limite de {DUEL.hitCapPct} %. Même le plus gros coup (Coup puissant LR) ne peut pas finir un combat d’un seul coup.</p>
      </section>
      <section>
        <h3>Adversaires</h3>
        <p>On te propose un adversaire contre qui tes chances sont proches de 50 % : des milliers de combats sont simulés pour le choisir. Il joue avec une IA qui suit sa consigne (Agressif, Équilibré ou Prudent), ne voit jamais tes choix et se trompe parfois.</p>
      </section>
      <section>
        <h3>Défense</h3>
        <p>Quand tu n’es pas là, d’autres joueurs attaquent ton deck. Il se défend seul avec ta consigne :</p>
        <div className="rtable">{CONSIGNES.map((c) => <div key={c.id}><b>{c.name}</b><span>{c.desc}</span></div>)}</div>
        <p>+{DUEL.defenseGc} GC par attaque repoussée. Choisis ta consigne dans l’onglet Deck.</p>
      </section>
      <section>
        <h3>Duels et récompenses</h3>
        <p>{DUEL.daily} duels par jour, +{DUEL.perSession} le jour où tu valides ta séance. Victoire : +{DUEL.winGc} GC et +{DUEL.passWin} points de passe. Défaite : +{DUEL.passLoss} points de passe. Les duels entre amis se jouent avec des decks de même puissance, sans récompense.</p>
      </section>
    </div>
  );
}

/** Petite étiquette de groupe musculaire sous une carte. */
export function GroupTag({ card }: { card: CardData }) {
  const g = groupOf(card);
  return <span className={`gtag g-${g}`}>{groupShort(g)}</span>;
}
