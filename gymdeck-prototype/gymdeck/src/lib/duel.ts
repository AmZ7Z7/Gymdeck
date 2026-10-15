import {
  BEATS, CAPACITIES, DUEL, EXERCISES, GROUPS, RARITIES, SECOND_WIND, STAT_RANGE, groupOfSlug,
  type CapKind, type MuscleGroup, type Posture, type Rarity,
} from "./config";
import { deckPower, drawPassive, type CardData } from "./engine";
import type { PlayerState, Result } from "./game";
import { addPassXp, type Extra } from "./progress";
import { seededRng, type Rng } from "./rng";

/**
 * Combats v11 (règles validées par Adrien le 15 oct. 2026) — moteur pur, testable.
 *  - PV de l'équipe = somme des (ATQ + DEF) / 2 des 5 cartes (passifs et synergies compris).
 *  - 5 manches max : chaque joueur pose une carte de sa main (jouée une seule fois) et choisit une posture,
 *    les deux cartes sont révélées en même temps.
 *  - Dégâts = max(ATQ − 50 % DEF adverse, 15 % ATQ), plafonnés à 35 % des PV max adverses (« MAX »).
 *    Les capacités s'appliquent APRÈS ce plafond : la valeur affichée est la valeur réelle. Jamais de coup fatal.
 *  - Jauge : +22 % par manche + 90 % des dégâts reçus (part des PV max), ×1,3 avec une LR. Une capacité par combat.
 *  - KO à 0 PV ; sinon, après 5 manches, le plus haut % de PV restants gagne.
 */

export type Side = "me" | "them";
export type Outcome = "win" | "loss" | "draw";
export type Consigne = "agressif" | "prudent" | "equilibre";

export const CONSIGNES: { id: Consigne; name: string; desc: string }[] = [
  { id: "agressif", name: "Agressif", desc: "Surtout en Force, capacité lancée tôt." },
  { id: "equilibre", name: "Équilibré", desc: "Varie les postures, capacité au milieu du combat." },
  { id: "prudent", name: "Prudent", desc: "Surtout en Garde, capacité gardée pour les moments difficiles." },
];

export const POSTURE_INFO: Record<Posture, { name: string; short: string; desc: string }> = {
  force: { name: "Force", short: "ATQ ×1,3 · DEF ×0,7", desc: "Frappe fort, mais se découvre." },
  technique: { name: "Technique", short: "×1,4 contre Force · ×0,7 contre Garde", desc: "Punit la Force, bloquée par la Garde." },
  garde: { name: "Garde", short: "ATQ ×0,6 · DEF ×1,5", desc: "Encaisse bien, frappe peu." },
};
/** Posture qui bat chaque posture. */
export const counterOf = (p: Posture): Posture => (p === "force" ? "technique" : p === "technique" ? "garde" : "force");

export interface Synergy { group: MuscleGroup; count: number; pct: number }
export interface DeckBonus {
  /** Bonus de synergie (%) de chaque carte, dans l'ordre reçu. */
  perCard: number[];
  groups: Synergy[];
  allDistinct: boolean;
  passiveAtq: number;
  passiveDef: number;
}

export const groupOf = (c: Pick<CardData, "exerciseSlug">): MuscleGroup => groupOfSlug(c.exerciseSlug);
export const beats = (a: MuscleGroup, b: MuscleGroup) => BEATS[a] === b;
export const groupShort = (g: MuscleGroup) => GROUPS.find((x) => x.id === g)!.short;

/** Bonus d'un deck : passifs UR/LR (tout le deck) et synergies de groupe (cartes concernées). */
export function deckBonus(cards: CardData[]): DeckBonus {
  const counts = new Map<MuscleGroup, number>();
  for (const c of cards) counts.set(groupOf(c), (counts.get(groupOf(c)) ?? 0) + 1);
  const allDistinct = cards.length === 5 && counts.size === 5;
  const groups: Synergy[] = [...counts.entries()].filter(([, n]) => n >= 2).map(([group, count]) => ({ group, count, pct: DUEL.synergyPct[count] ?? 0 }));
  const perCard = cards.map((c) => (DUEL.synergyPct[counts.get(groupOf(c)) ?? 0] ?? 0) + (allDistinct ? DUEL.allGroupsPct : 0));
  const passiveAtq = cards.reduce((s, c) => s + (c.passive?.atqTenths ?? 0), 0) / 10;
  const passiveDef = cards.reduce((s, c) => s + (c.passive?.defTenths ?? 0), 0) / 10;
  return { perCard, groups, allDistinct, passiveAtq, passiveDef };
}

/** ATQ / DEF de combat de chaque carte (passifs + synergies). */
export function combatStats(cards: CardData[]) {
  const b = deckBonus(cards);
  return cards.map((c, i) => ({
    atq: Math.round(c.atq * (1 + (b.passiveAtq + b.perCard[i]!) / 100)),
    def: Math.round(c.def * (1 + (b.passiveDef + b.perCard[i]!) / 100)),
  }));
}

/** Puissance de combat : ATQ + DEF de combat des 5 cartes. */
export const combatPower = (cards: CardData[]) => combatStats(cards).reduce((s, x) => s + x.atq + x.def, 0);
/** PV de l'équipe. */
export const teamHp = (cards: CardData[]) => Math.round(combatStats(cards).reduce((s, x) => s + (x.atq + x.def) / 2, 0));

// ───────────── Capacités ─────────────

export interface CapInfo { kind: CapKind; name: string; color: string; value: number; group: MuscleGroup | null; top: boolean }

/** Capacité d'une carte : celle de son groupe pour SSR / UR / LR, Second souffle pour C / R / SR. */
export function capacityOf(c: Pick<CardData, "exerciseSlug" | "rarity">): CapInfo {
  if (c.rarity === "SSR" || c.rarity === "UR" || c.rarity === "LR") {
    const g = groupOf(c);
    const d = CAPACITIES[g];
    return { kind: d.kind, name: d.name, color: d.color, value: d.values[c.rarity], group: g, top: true };
  }
  return { kind: "second", name: SECOND_WIND.name, color: SECOND_WIND.color, value: DUEL.secondWind, group: null, top: false };
}

const pc = (v: number) => `${Math.round(v * 100)} %`;
const mult = (v: number) => `×${String(v).replace(".", ",")}`;

/** Texte de la capacité (valeurs réelles). */
export function capacityText(kind: CapKind, v: number): string {
  switch (kind) {
    case "power": return `Dégâts ${mult(v)} sur cette manche.`;
    case "counter": return `Renvoie ${pc(v)} des dégâts reçus sur cette manche.`;
    case "feint": return v > 0 ? `Tu vois la posture adverse avant de choisir la tienne, et +${pc(v)} de dégâts.` : "Tu vois la posture adverse avant de choisir la tienne.";
    case "combo": return `Frappe 2 fois à ${pc(v)} (${pc(2 * v)} au total).`;
    case "wall": return `Bloque ${pc(v)} des dégâts reçus sur cette manche.`;
    case "heal": return `Soigne ${pc(v)} de tes PV max.`;
    case "replay": return `Ta meilleure carte déjà jouée revient dans ta main à ${pc(v)} de sa force (jamais une LR).`;
    case "second": return `Dégâts ${mult(v)} sur cette manche.`;
  }
}

/** Valeurs SSR / UR / LR d'une capacité, pour le tableau des règles. */
export const capacityValues = (g: MuscleGroup) => CAPACITIES[g].values;

// ───────────── Combat pas à pas ─────────────

export interface FCard { key: string; card: CardData; atq: number; def: number; replay?: boolean }

export interface Fighter {
  name: string;
  consigne: Consigne;
  hand: FCard[];
  used: FCard[];
  maxHp: number;
  hp: number;
  /** Jauge de capacité (0 à 1). */
  gauge: number;
  capUsed: boolean;
  lr: boolean;
  postures: Posture[];
}

export interface Move { key: string; posture: Posture; cap: boolean; /** Joué par l'IA : avec Feinte, elle adapte sa posture. */ auto?: boolean }

export interface SideRound {
  card: FCard;
  posture: Posture;
  cap: CapInfo | null;
  /** Dégâts infligés à l'adversaire (renvoi compris). */
  dealt: number;
  /** Coups (deux avec Enchaînement), hors renvoi. */
  hits: number[];
  capped: boolean;
  adv: boolean;
  /** Multiplicateur de posture Technique (1, 1,4 ou 0,7). */
  tech: number;
  reflect: number;
  blocked: number;
  heal: number;
  replayed: FCard | null;
  hpAfter: number;
}

export interface RoundLog { n: number; me: SideRound; them: SideRound }

export interface Fight {
  me: Fighter;
  them: Fighter;
  /** Manche en cours (0 à 4). */
  round: number;
  log: RoundLog[];
  over: boolean;
  outcome: Outcome | null;
  ko: Side | "both" | null;
}

const other = (s: Side): Side => (s === "me" ? "them" : "me");

export function makeFighter(name: string, cards: (CardData & { id?: string })[], consigne: Consigne): Fighter {
  const st = combatStats(cards);
  const hand = cards.map((c, i) => ({ key: c.id ?? `c${i}`, card: c, atq: st[i]!.atq, def: st[i]!.def }));
  const maxHp = Math.round(hand.reduce((s, x) => s + (x.atq + x.def) / 2, 0));
  return { name, consigne, hand, used: [], maxHp, hp: maxHp, gauge: 0, capUsed: false, lr: cards.some((c) => c.rarity === "LR"), postures: [] };
}

export function startFight(me: Fighter, them: Fighter): Fight {
  return { me, them, round: 0, log: [], over: false, outcome: null, ko: null };
}

/** Carte qu'Endurance ferait revenir (meilleure carte déjà jouée, jamais une LR ni une carte déjà rejouée). */
export function replayTarget(f: Fighter, exceptKey?: string): FCard | null {
  const list = f.used.filter((u) => u.card.rarity !== "LR" && !u.replay && u.key !== exceptKey);
  if (!list.length) return null;
  return list.reduce((a, b) => (b.atq + b.def > a.atq + a.def ? b : a));
}

/** La capacité de cette carte peut-elle être lancée maintenant ? (raison sinon) */
export function capCheck(f: Fight, side: Side, key: string): { ok: boolean; reason?: string } {
  const me = f[side];
  if (me.capUsed) return { ok: false, reason: "Capacité déjà utilisée dans ce combat." };
  if (me.gauge < 1) return { ok: false, reason: "Jauge pas encore remplie." };
  const c = me.hand.find((x) => x.key === key);
  if (!c) return { ok: false, reason: "Choisis d’abord une carte." };
  const cap = capacityOf(c.card);
  if (cap.kind === "replay") {
    if (f.round >= DUEL.rounds - 1) return { ok: false, reason: "Endurance : plus de manche pour rejouer une carte." };
    if (!replayTarget(me, key)) return { ok: false, reason: "Endurance : aucune carte à rejouer (les LR ne reviennent pas)." };
  }
  return { ok: true };
}

const noise = (rng: Rng) => 1 + rng.int(-DUEL.noisePct * 100, DUEL.noisePct * 100) / 10000;

function strike(att: FCard, ap: Posture, def: FCard, dp: Posture, targetMax: number, rng: Rng) {
  const adv = beats(groupOf(att.card), groupOf(def.card));
  const tech = ap === "technique" ? (dp === "force" ? DUEL.techVsForce : dp === "garde" ? DUEL.techVsGarde : 1) : 1;
  const atk = att.atq * DUEL.posture[ap].atq * tech * (adv ? 1 + DUEL.trianglePct / 100 : 1) * noise(rng);
  const dd = def.def * DUEL.posture[dp].def;
  const raw = Math.max(atk - DUEL.defFactor * dd, (DUEL.minHitPct / 100) * atk);
  const cap = (DUEL.hitCapPct / 100) * targetMax;
  return { dmg: Math.min(raw, cap), capped: raw > cap, adv, tech };
}

/** Joue une manche. `mine` / `theirs` : coups des deux côtés (l'IA ne voit jamais le choix du joueur). */
export function playRound(f: Fight, mine: Move, theirs: Move, rng: Rng): Fight {
  if (f.over) return f;
  const A = f.me, B = f.them;
  const ca = A.hand.find((x) => x.key === mine.key) ?? A.hand[0]!;
  const cb = B.hand.find((x) => x.key === theirs.key) ?? B.hand[0]!;
  const capA = mine.cap && capCheck(f, "me", ca.key).ok ? capacityOf(ca.card) : null;
  const capB = theirs.cap && capCheck(f, "them", cb.key).ok ? capacityOf(cb.card) : null;
  let pa = mine.posture, pb = theirs.posture;
  // Feinte : l'IA qui la lance voit la posture d'en face (si les deux feintent, personne ne s'adapte)
  if (capA?.kind === "feint" && capB?.kind !== "feint" && mine.auto) pa = counterOf(pb);
  if (capB?.kind === "feint" && capA?.kind !== "feint" && theirs.auto) pb = counterOf(pa);

  const sA = strike(ca, pa, cb, pb, B.maxHp, rng);
  const sB = strike(cb, pb, ca, pa, A.maxHp, rng);
  const out = (cap: CapInfo | null, d: number): { d: number; hits: number[] } => {
    if (!cap) return { d, hits: [d] };
    switch (cap.kind) {
      case "power": return { d: d * cap.value, hits: [d * cap.value] };
      case "feint": return { d: d * (1 + cap.value), hits: [d * (1 + cap.value)] };
      case "combo": return { d: 2 * d * cap.value, hits: [d * cap.value, d * cap.value] };
      case "second": return { d: d * cap.value, hits: [d * cap.value] };
      default: return { d, hits: [d] };
    }
  };
  const oA = out(capA, sA.dmg), oB = out(capB, sB.dmg);
  let dA = oA.d, dB = oB.d;
  let blockA = 0, blockB = 0;
  if (capA?.kind === "wall") { blockA = dB * capA.value; dB -= blockA; }
  if (capB?.kind === "wall") { blockB = dA * capB.value; dA -= blockB; }
  const refA = capA?.kind === "counter" ? dB * capA.value : 0;
  const refB = capB?.kind === "counter" ? dA * capB.value : 0;
  dA += refA; dB += refB;
  const healA = capA?.kind === "heal" ? capA.value * A.maxHp : 0;
  const healB = capB?.kind === "heal" ? capB.value * B.maxHp : 0;
  const r = Math.round;
  dA = r(dA); dB = r(dB);
  const hpA = Math.min(A.maxHp, A.hp - dB + r(healA));
  const hpB = Math.min(B.maxHp, B.hp - dA + r(healB));

  const advance = (F: Fighter, card: FCard, cap: CapInfo | null, posture: Posture, taken: number, hp: number): { f: Fighter; replayed: FCard | null } => {
    let hand = F.hand.filter((x) => x !== card);
    const used = [...F.used, card];
    let replayed: FCard | null = null;
    if (cap?.kind === "replay") {
      const t = replayTarget({ ...F, used: F.used }, card.key);
      if (t) {
        replayed = { key: `${t.key}~r`, card: t.card, atq: r(t.atq * cap.value), def: r(t.def * cap.value), replay: true };
        hand = [...hand, replayed];
      }
    }
    const gauge = cap ? 0 : F.capUsed ? 0 : Math.min(1, F.gauge + (DUEL.gaugeBase + DUEL.gaugeDamage * (taken / F.maxHp)) * (F.lr ? DUEL.gaugeLr : 1));
    return { f: { ...F, hand, used, hp, gauge, capUsed: F.capUsed || !!cap, postures: [...F.postures, posture] }, replayed };
  };
  const nA = advance(A, ca, capA, pa, dB, hpA);
  const nB = advance(B, cb, capB, pb, dA, hpB);
  const log: RoundLog = {
    n: f.round + 1,
    me: { card: ca, posture: pa, cap: capA, dealt: dA, hits: oA.hits.map(r), capped: sA.capped, adv: sA.adv, tech: sA.tech, reflect: r(refA), blocked: r(blockA), heal: r(healA), replayed: nA.replayed, hpAfter: hpA },
    them: { card: cb, posture: pb, cap: capB, dealt: dB, hits: oB.hits.map(r), capped: sB.capped, adv: sB.adv, tech: sB.tech, reflect: r(refB), blocked: r(blockB), heal: r(healB), replayed: nB.replayed, hpAfter: hpB },
  };
  const round = f.round + 1;
  const ko: Fight["ko"] = hpA <= 0 && hpB <= 0 ? "both" : hpA <= 0 ? "me" : hpB <= 0 ? "them" : null;
  const over = !!ko || round >= DUEL.rounds || !nA.f.hand.length || !nB.f.hand.length;
  let outcome: Outcome | null = null;
  if (over) {
    const ra = Math.max(0, hpA) / A.maxHp, rb = Math.max(0, hpB) / B.maxHp;
    outcome = ra > rb ? "win" : ra < rb ? "loss" : "draw";
  }
  return { me: nA.f, them: nB.f, round, log: [...f.log, log], over, outcome, ko };
}

// ───────────── IA adverse (niveau moyen) ─────────────

const POSTURE_WEIGHTS: Record<Consigne, Record<Posture, number>> = {
  agressif: { force: 60, technique: 25, garde: 15 },
  prudent: { force: 15, technique: 25, garde: 60 },
  equilibre: { force: 34, technique: 33, garde: 33 },
};

function weighted<T extends string>(rng: Rng, w: Record<T, number>): T {
  const keys = Object.keys(w) as T[];
  let roll = rng.int(1, keys.reduce((s, k) => s + w[k], 0));
  for (const k of keys) { roll -= w[k]; if (roll <= 0) return k; }
  return keys[0]!;
}

const mostUsed = (list: Posture[]): Posture | null => {
  if (!list.length) return null;
  const n = (p: Posture) => list.filter((x) => x === p).length;
  return (["force", "technique", "garde"] as Posture[]).reduce((a, b) => (n(b) > n(a) ? b : a));
};

/**
 * Coup de l'IA, d'après sa consigne. Elle connaît les groupes des cartes qui restent en face (comme le joueur),
 * jamais la carte ni la posture choisies ce tour-ci. Garde sa meilleure carte pour le milieu / la fin, joue le
 * triangle, et fait environ 25 % de choix au hasard.
 */
export function aiMove(f: Fight, side: Side, rng: Rng): Move {
  const self = f[side], foe = f[other(side)];
  const rnd = f.round;
  const randomPick = rng.int(1, 100) <= DUEL.aiRandomPct;
  const hand = self.hand;
  let card: FCard;
  if (randomPick || hand.length === 1) card = hand[rng.int(0, hand.length - 1)]!;
  else {
    const best = hand.reduce((a, b) => (b.atq + b.def > a.atq + a.def ? b : a));
    const gaugeFull = self.gauge >= 1 && !self.capUsed;
    const score = (c: FCard) => {
      let s = c.atq + c.def;
      const g = groupOf(c.card);
      const foeG = foe.hand.map((x) => groupOf(x.card));
      const win = foeG.filter((x) => beats(g, x)).length, lose = foeG.filter((x) => beats(x, g)).length;
      s *= 1 + (0.2 * (win - lose)) / Math.max(1, foeG.length);
      if (c === best && rnd < 2 && hand.length > 2) s *= 0.55; // garde sa meilleure carte
      if (gaugeFull && capacityOf(c.card).top) s *= self.consigne === "agressif" ? 1.35 : 1.15;
      return s * (0.9 + rng.int(0, 20) / 100);
    };
    card = hand.reduce((a, b) => (score(b) > score(a) ? b : a));
  }
  let posture = weighted(rng, POSTURE_WEIGHTS[self.consigne]);
  const foeHabit = mostUsed(foe.postures);
  if (!randomPick && foeHabit && rng.int(1, 100) <= (self.consigne === "equilibre" ? 45 : 25)) posture = counterOf(foeHabit);

  let cap = false;
  if (capCheck(f, side, card.key).ok) {
    const c = capacityOf(card.card);
    const hpPct = self.hp / self.maxHp;
    const last = rnd >= DUEL.rounds - 1;
    if (c.kind === "heal") cap = hpPct < 0.7 || last;
    else if (c.kind === "second") cap = last || hpPct < 0.35 || foe.hp / foe.maxHp < 0.3;
    else if (last) cap = true;
    else if (self.consigne === "agressif") cap = true;
    else if (self.consigne === "prudent") cap = hpPct < 0.55;
    else cap = rnd >= 2;
    if (randomPick && rng.int(0, 1) === 0) cap = !cap && c.kind !== "heal";
  }
  return { key: card.key, posture, cap, auto: true };
}

/** Combat complet IA contre IA (simulations, défense). */
export function autoFight(a: Fighter, b: Fighter, rng: Rng): Fight {
  let f = startFight(a, b);
  while (!f.over) {
    const ma = aiMove(f, "me", rng);
    const mb = aiMove(f, "them", rng);
    f = playRound(f, ma, mb, rng);
  }
  return f;
}

/** Chance de victoire estimée (combats simulés, le joueur joue « Équilibré »). */
export function winChance(mine: CardData[], opp: Opponent, rng: Rng, n: number = DUEL.matchSims): number {
  let w = 0;
  for (let i = 0; i < n; i++) {
    const f = autoFight(makeFighter("A", mine, "equilibre"), makeFighter("B", opp.cards, opp.consigne), rng);
    w += f.outcome === "win" ? 1 : f.outcome === "draw" ? 0.5 : 0;
  }
  return w / n;
}

// ───────────── Adversaires (simulés pendant le prototype) ─────────────

export interface Opponent {
  key: string;
  name: string;
  cards: CardData[];
  power: number;
  consigne: Consigne;
  /** Chance de victoire estimée au moment du choix. */
  chance?: number;
  /** Duel amical : decks égalisés, sans récompense. */
  friendly?: boolean;
}

export interface DuelRecord {
  at: number;
  opp: string;
  outcome: Outcome;
  /** PV restants (en %) des deux côtés. */
  myHp: number;
  theirHp: number;
  ko: boolean;
  gc: number;
  /** Points du passe de saison. */
  pts: number;
  friendly?: boolean;
}

const NAMES = [
  "Léa_Fit", "Karim92", "BigSquat", "Camille.R", "IronMaxime", "Nora.Lifts", "TomPush", "Sarah_Gym", "Yanis75", "LiftOrDie",
  "Mathis.B", "Jade_Pull", "Hugo.Deadlift", "Inès_Move", "Théo.Bench", "Manon.Fit", "Rayan_Iron", "Clara.Squat", "Lucas93", "Anaïs_Gains",
  "PumpKing", "Zoé.Strong", "Enzo_Rows", "Lola.Lifts", "Adam_Curl", "Eva.Trainer", "Noah.Press", "Maëlle_Fit", "Nils.Gym", "Sofia_Power",
];

/** Valeur moyenne (ATQ + DEF) d'une carte de chaque rareté. */
const MEAN: Record<Rarity, number> = Object.fromEntries(RARITIES.map((r) => [r, STAT_RANGE[r].min + STAT_RANGE[r].max])) as Record<Rarity, number>;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function shuffle<T>(rng: Rng, list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

function botCard(rng: Rng, slug: string, rarity: Rarity): CardData {
  const r = STAT_RANGE[rarity];
  return {
    exerciseSlug: slug, rarity,
    atq: rng.int(r.min, r.max), def: rng.int(r.min, r.max),
    passive: rarity === "UR" || rarity === "LR" ? drawPassive(rng, rarity) : null,
  };
}

/** Rapproche la puissance d'un deck d'une cible en ajustant les stats, sans sortir des fourchettes de rareté. */
function tune(cards: CardData[], target: number): CardData[] {
  let out = cards;
  for (let k = 0; k < 6; k++) {
    const f = target / Math.max(1, deckPower(out));
    if (Math.abs(f - 1) < 0.01) break;
    out = out.map((c) => {
      const r = STAT_RANGE[c.rarity];
      return { ...c, atq: clamp(Math.round(c.atq * f), r.min, r.max), def: clamp(Math.round(c.def * f), r.min, r.max) };
    });
  }
  return out;
}

const CONS: Consigne[] = ["agressif", "equilibre", "prudent"];

/** Deck simulé d'une puissance donnée : 5 exercices différents, raretés choisies pour viser la cible. */
export function makeOpponent(rng: Rng, target: number, avoid: string[] = []): Opponent {
  const names = NAMES.filter((n) => !avoid.includes(n));
  const name = names[rng.int(0, names.length - 1)] ?? NAMES[0]!;
  target = Math.max(1000, Math.round(target));
  const per = target / 5;
  let lo: Rarity = "C", hi: Rarity = "C";
  if (per >= MEAN.LR) { lo = "LR"; hi = "LR"; }
  else if (per > MEAN.C) {
    for (let i = 0; i < RARITIES.length - 1; i++) {
      if (per >= MEAN[RARITIES[i]!] && per <= MEAN[RARITIES[i + 1]!]) { lo = RARITIES[i]!; hi = RARITIES[i + 1]!; break; }
    }
  }
  let best: CardData[] = [];
  let bestGap = Infinity;
  for (let attempt = 0; attempt < 12; attempt++) {
    const k = lo === hi ? 0 : clamp(Math.round((5 * (per - MEAN[lo])) / (MEAN[hi] - MEAN[lo])) + rng.int(-1, 1), 0, 5);
    const rarities: Rarity[] = shuffle(rng, [...Array(5 - k).fill(lo), ...Array(k).fill(hi)]);
    const slugs = shuffle(rng, EXERCISES.map((e) => e.slug)).slice(0, 5);
    const cards = tune(rarities.map((r, i) => botCard(rng, slugs[i]!, r)), target);
    const gap = Math.abs(deckPower(cards) - target);
    if (gap < bestGap) { bestGap = gap; best = cards; }
    if (gap / target < 0.03) break;
  }
  return { key: `${name}-${rng.int(0, 1e9)}`, name, cards: best, power: deckPower(best), consigne: CONS[rng.int(0, 2)]! };
}

/**
 * Matchmaking : on cherche un adversaire contre qui la chance de victoire simulée est proche de 50 % (45 à 58 %).
 * (La puissance totale ne suffit pas : une LR pèse bien plus que ses points.)
 */
export function findMatch(rng: Rng, mine: CardData[], avoid: string[] = []): Opponent {
  const sim = seededRng(rng.int(0, 2 ** 31 - 1));
  const myPower = deckPower(mine);
  // encadrement de la puissance adverse (en part de la mienne), resserré à chaque essai
  let lo = 0.6, hi = 1.4;
  let best: Opponent | null = null, bestGap = Infinity;
  for (let i = 0; i < DUEL.matchTries; i++) {
    const f = i === 0 ? 0.95 + rng.int(0, 100) / 1000 : lo + ((hi - lo) * rng.int(250, 750)) / 1000;
    const opp = makeOpponent(rng, myPower * f, avoid);
    const chance = winChance(mine, opp, sim);
    const gap = Math.abs(chance - 0.5);
    if (gap < bestGap) { best = { ...opp, chance }; bestGap = gap; }
    if (chance >= DUEL.matchLo && chance <= DUEL.matchHi) return { ...opp, chance };
    if (chance > DUEL.matchHi) lo = Math.max(lo, f); else hi = Math.min(hi, f);
    if (hi - lo < 0.04) { lo = Math.max(0.4, lo - 0.1); hi = Math.min(2, hi + 0.1); }
  }
  return best!;
}

/** Duel amical : le deck de l'ami est ramené à la même puissance que le mien (stats ajustées). */
export function equalize(theirs: CardData[], myPower: number): CardData[] {
  let out = theirs;
  for (let k = 0; k < 4; k++) {
    const f = myPower / Math.max(1, deckPower(out));
    if (Math.abs(f - 1) < 0.002) break;
    out = out.map((c) => ({ ...c, atq: Math.max(1, Math.round(c.atq * f)), def: Math.max(1, Math.round(c.def * f)) }));
  }
  return out;
}

// ───────────── Compteurs du jour, récompenses, défense ─────────────

export interface DuelDay { day: string; used: number; bonus: number }

/** Duels restants aujourd'hui (5 + 2 si la séance est validée). */
export function duelsLeft(s: PlayerState, day: string): number {
  const d = s.extra?.duel;
  const bonus = d?.day === day ? d.bonus : s.lastSessionDay === day ? DUEL.perSession : 0;
  const used = d?.day === day ? d.used : 0;
  return Math.max(0, DUEL.daily + bonus - used);
}

/** Vérifie le deck et décompte un duel (au lancement : quitter en cours de route ne le rend pas). */
export function beginDuel(s: PlayerState, day: string): Result<{ state: PlayerState }> {
  const e = s.extra;
  if (!e) return { ok: false, error: "Indisponible." };
  if (s.deck.length < 5) return { ok: false, error: "Il te faut un deck de 5 cartes pour combattre." };
  if (duelsLeft(s, day) <= 0) return { ok: false, error: "Plus de duel aujourd’hui. Reviens demain, ou valide ta séance pour en gagner 2 de plus." };
  const d = e.duel?.day === day ? e.duel : { day, used: 0, bonus: s.lastSessionDay === day ? DUEL.perSession : 0 };
  return { ok: true, state: { ...s, extra: { ...e, duel: { ...d, used: d.used + 1 } } } };
}

/** Enregistre la fin d'un duel : GC, points du passe, classement, historique. */
export function finishDuel(s: PlayerState, f: Fight, opp: Opponent, day: string, now: number): { state: PlayerState; record: DuelRecord } {
  const e = s.extra!;
  const outcome = f.outcome ?? "loss";
  const win = outcome === "win";
  const friendly = !!opp.friendly;
  const gc = friendly ? 0 : win ? DUEL.winGc : 0;
  const pts = friendly ? 0 : win ? DUEL.passWin : DUEL.passLoss;
  const record: DuelRecord = {
    at: now, opp: opp.name, outcome, friendly,
    myHp: Math.round((Math.max(0, f.me.hp) / f.me.maxHp) * 100),
    theirHp: Math.round((Math.max(0, f.them.hp) / f.them.maxHp) * 100),
    ko: !!f.ko, gc, pts,
  };
  const se = e.season;
  let next: Extra = { ...e, duels: [record, ...(e.duels ?? [])].slice(0, 12) };
  if (!friendly) {
    next = {
      ...next,
      season: {
        ...se,
        points: (se.points ?? 0) + (win ? DUEL.winPts : outcome === "draw" ? DUEL.drawPts : DUEL.lossPts),
        wins: (se.wins ?? 0) + (win ? 1 : 0),
        losses: (se.losses ?? 0) + (outcome === "loss" ? 1 : 0),
        draws: (se.draws ?? 0) + (outcome === "draw" ? 1 : 0),
      },
    };
    next = addPassXp(next, pts, day);
  }
  return { record, state: { ...s, gc: s.gc + gc, extra: next } };
}

export interface DefenseRecord { at: number; opp: string; won: boolean; gc: number }

/**
 * Défense (simulée pendant le prototype) : une fois par jour, jusqu'à 3 joueurs attaquent ton deck, qui se défend
 * seul avec ta consigne. +2 GC par attaque repoussée.
 */
export function runDefenses(s: PlayerState, rng: Rng, day: string, now: number): { state: PlayerState; won: number; total: number; gc: number } {
  const e = s.extra;
  if (!e || e.defenseDay === day) return { state: s, won: 0, total: 0, gc: 0 };
  const deck = s.deck.map((id) => s.cards.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c);
  if (deck.length < 5 || !(e.duels?.length)) return { state: { ...s, extra: { ...e, defenseDay: day } }, won: 0, total: 0, gc: 0 };
  const n = rng.int(1, DUEL.defenseMaxPerDay);
  const sim = seededRng(rng.int(0, 2 ** 31 - 1));
  const power = deckPower(deck);
  const recs: DefenseRecord[] = [];
  for (let i = 0; i < n; i++) {
    const opp = makeOpponent(rng, power * (0.85 + rng.int(0, 300) / 1000), recs.map((r) => r.opp));
    const fight = autoFight(makeFighter("Toi", deck, e.consigne ?? "equilibre"), makeFighter(opp.name, opp.cards, opp.consigne), sim);
    const won = fight.outcome === "win";
    recs.push({ at: now - (n - i) * 3_600_000, opp: opp.name, won, gc: won ? DUEL.defenseGc : 0 });
  }
  const gc = recs.reduce((a, r) => a + r.gc, 0);
  return {
    won: recs.filter((r) => r.won).length, total: n, gc,
    state: { ...s, gc: s.gc + gc, extra: { ...e, defenseDay: day, defenses: [...recs.reverse(), ...(e.defenses ?? [])].slice(0, 10) } },
  };
}

/** Bilan court de la saison : « 3 V · 1 D » (+ égalités s'il y en a). */
export const recordShort = (se: { wins?: number; losses?: number; draws?: number }) =>
  `${se.wins ?? 0} V · ${se.losses ?? 0} D${se.draws ? ` · ${se.draws} N` : ""}`;
