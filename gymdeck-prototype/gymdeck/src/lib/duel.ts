import { BEATS, DUEL, EXERCISES, GROUPS, RARITIES, STAT_RANGE, groupOfSlug, type MuscleGroup, type Rarity } from "./config";
import { deckPower, drawPassive, type CardData } from "./engine";
import type { PlayerState, Result } from "./game";
import type { Rng } from "./rng";

/**
 * Combats (règles validées par Adrien le 14 oct. 2026) — moteur pur, testable.
 *  1. Duel asynchrone contre un deck de puissance proche (± 25 %).
 *  2. Ordre caché : chacun range ses 5 cartes ; n°1 contre n°1, etc.
 *  3. Synergies de groupe : 2 cartes du même groupe +3 %, 3 → +8 %, 4 → +14 %, 5 → +20 % ; 5 groupes différents → +6 %.
 *  4. Triangle : Pecs > Épaules > Dos > Pecs, Jambes > Abdos > Cardio > Jambes (Bras neutres) : +20 % sur la manche.
 *  5. Manche : chaque carte frappe l'autre (ATQ ± 10 % de hasard − DEF adverse), écart plafonné à ± 350.
 *  6. Victoire : 3 manches sur 5 (égalité de manches : l'écart total départage).
 */

export type Side = "me" | "them";
export type Outcome = "win" | "loss" | "draw";

export interface Synergy { group: MuscleGroup; count: number; pct: number }
export interface DeckBonus {
  /** Bonus de synergie (%) de chaque carte, dans l'ordre reçu. */
  perCard: number[];
  groups: Synergy[];
  allDistinct: boolean;
  passiveAtq: number;
  passiveDef: number;
}

export interface RoundResult {
  i: number;
  mine: CardData;
  theirs: CardData;
  /** Côté qui profite du triangle des groupes sur cette manche. */
  adv: Side | null;
  myAtq: number; myDef: number; theirAtq: number; theirDef: number;
  /** Frappes après hasard (peuvent être négatives : la DEF adverse a tout encaissé). */
  myHit: number; theirHit: number;
  /** Écart plafonné, vu de mon côté. */
  margin: number;
  winner: Side | "draw";
}

export interface DuelResult {
  rounds: RoundResult[];
  myWins: number;
  theirWins: number;
  score: number;
  outcome: Outcome;
}

export interface Opponent {
  key: string;
  name: string;
  cards: CardData[];
  power: number;
}

export interface DuelRecord {
  at: number;
  opp: string;
  outcome: Outcome;
  myWins: number;
  theirWins: number;
  gc: number;
  pts: number;
}

export const groupOf = (c: CardData): MuscleGroup => groupOfSlug(c.exerciseSlug);
export const beats = (a: MuscleGroup, b: MuscleGroup) => BEATS[a] === b;

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

/** ATQ / DEF de combat de chaque carte (passifs + synergies, sans le triangle qui dépend de l'adversaire). */
export function combatStats(cards: CardData[]) {
  const b = deckBonus(cards);
  return cards.map((c, i) => ({
    atq: Math.round(c.atq * (1 + (b.passiveAtq + b.perCard[i]!) / 100)),
    def: Math.round(c.def * (1 + (b.passiveDef + b.perCard[i]!) / 100)),
  }));
}

/** Puissance de combat : ATQ + DEF de combat des 5 cartes. */
export const combatPower = (cards: CardData[]) => combatStats(cards).reduce((s, x) => s + x.atq + x.def, 0);

const noise = (rng: Rng) => 1 + rng.int(-DUEL.noisePct * 100, DUEL.noisePct * 100) / 10000;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Joue un duel complet. `mine` et `theirs` sont déjà dans l'ordre de combat. */
export function resolveDuel(mine: CardData[], theirs: CardData[], rng: Rng): DuelResult {
  const ms = combatStats(mine);
  const ts = combatStats(theirs);
  const rounds: RoundResult[] = [];
  let myWins = 0, theirWins = 0, score = 0;
  for (let i = 0; i < Math.min(mine.length, theirs.length); i++) {
    const a = mine[i]!, b = theirs[i]!;
    const adv: Side | null = beats(groupOf(a), groupOf(b)) ? "me" : beats(groupOf(b), groupOf(a)) ? "them" : null;
    const kA = adv === "me" ? 1 + DUEL.trianglePct / 100 : 1;
    const kB = adv === "them" ? 1 + DUEL.trianglePct / 100 : 1;
    const myAtq = Math.round(ms[i]!.atq * kA), myDef = Math.round(ms[i]!.def * kA);
    const theirAtq = Math.round(ts[i]!.atq * kB), theirDef = Math.round(ts[i]!.def * kB);
    const myHit = Math.round(myAtq * noise(rng)) - theirDef;
    const theirHit = Math.round(theirAtq * noise(rng)) - myDef;
    const margin = clamp(myHit - theirHit, -DUEL.cap, DUEL.cap);
    const winner: Side | "draw" = margin > 0 ? "me" : margin < 0 ? "them" : "draw";
    if (winner === "me") myWins++; else if (winner === "them") theirWins++;
    score += margin;
    rounds.push({ i, mine: a, theirs: b, adv, myAtq, myDef, theirAtq, theirDef, myHit, theirHit, margin, winner });
  }
  const outcome: Outcome = myWins !== theirWins ? (myWins > theirWins ? "win" : "loss") : score > 0 ? "win" : score < 0 ? "loss" : "draw";
  return { rounds, myWins, theirWins, score, outcome };
}

// ───────────── Adversaires (simulés pendant le prototype) ─────────────

const NAMES = [
  "Léa_Fit", "Karim92", "BigSquat", "Camille.R", "IronMaxime", "Nora.Lifts", "TomPush", "Sarah_Gym", "Yanis75", "LiftOrDie",
  "Mathis.B", "Jade_Pull", "Hugo.Deadlift", "Inès_Move", "Théo.Bench", "Manon.Fit", "Rayan_Iron", "Clara.Squat", "Lucas93", "Anaïs_Gains",
  "PumpKing", "Zoé.Strong", "Enzo_Rows", "Lola.Lifts", "Adam_Curl", "Eva.Trainer", "Noah.Press", "Maëlle_Fit", "Nils.Gym", "Sofia_Power",
];

/** Valeur moyenne (ATQ + DEF) d'une carte de chaque rareté. */
const MEAN: Record<Rarity, number> = Object.fromEntries(RARITIES.map((r) => [r, STAT_RANGE[r].min + STAT_RANGE[r].max])) as Record<Rarity, number>;

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

/**
 * Trouve un adversaire de puissance proche (± 25 %) : 5 exercices différents, raretés choisies pour viser la cible,
 * stats ajustées dans leurs fourchettes. Les vrais joueurs remplaceront ces decks simulés.
 */
export function makeOpponent(rng: Rng, myPower: number, avoid: string[] = []): Opponent {
  const names = NAMES.filter((n) => !avoid.includes(n));
  const name = names[rng.int(0, names.length - 1)] ?? NAMES[0]!;
  const target = Math.max(1000, Math.round(myPower * (0.82 + rng.int(0, 3600) / 10000))); // 0,82 – 1,18
  const per = target / 5;
  const tiers = RARITIES;
  let lo: Rarity = "C", hi: Rarity = "C";
  if (per >= MEAN.LR) { lo = "LR"; hi = "LR"; }
  else if (per > MEAN.C) {
    for (let i = 0; i < tiers.length - 1; i++) {
      if (per >= MEAN[tiers[i]!] && per <= MEAN[tiers[i + 1]!]) { lo = tiers[i]!; hi = tiers[i + 1]!; break; }
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
  return { key: `${name}-${rng.int(0, 1e9)}`, name, cards: best, power: deckPower(best) };
}

// ───────────── Compteurs du jour, saison ─────────────

export interface DuelDay { day: string; used: number; bonus: number }

/** Duels restants aujourd'hui (3 + 2 si la séance est validée). */
export function duelsLeft(s: PlayerState, day: string): number {
  const d = s.extra?.duel;
  const bonus = d?.day === day ? d.bonus : s.lastSessionDay === day ? DUEL.perSession : 0;
  const used = d?.day === day ? d.used : 0;
  return Math.max(0, DUEL.daily + bonus - used);
}

/**
 * Joue un duel : l'ordre de mes cartes est choisi par le joueur, celui de l'adversaire est tiré au hasard (caché).
 * Le résultat et les récompenses sont enregistrés tout de suite : quitter l'animation ne change rien.
 */
export function playDuel(
  s: PlayerState, order: string[], opp: Opponent, rng: Rng, day: string, now: number,
): Result<{ state: PlayerState; result: DuelResult; theirOrder: CardData[]; record: DuelRecord }> {
  const e = s.extra;
  if (!e) return { ok: false, error: "Indisponible." };
  if (s.deck.length < 5) return { ok: false, error: "Il te faut un deck de 5 cartes pour combattre." };
  if (order.length !== 5 || new Set(order).size !== 5 || order.some((id) => !s.deck.includes(id))) return { ok: false, error: "Ordre de combat invalide." };
  if (duelsLeft(s, day) <= 0) return { ok: false, error: "Plus de duel aujourd’hui. Reviens demain, ou valide ta séance pour en gagner 2 de plus." };
  if (opp.cards.length !== 5) return { ok: false, error: "Adversaire invalide." };
  const mine = order.map((id) => s.cards.find((c) => c.id === id)!);
  const theirOrder = shuffle(rng, opp.cards);
  const result = resolveDuel(mine, theirOrder, rng);
  const win = result.outcome === "win";
  const gc = win ? DUEL.winGc : 0;
  const pts = win ? DUEL.winPts : result.outcome === "draw" ? DUEL.drawPts : DUEL.lossPts;
  const d = e.duel?.day === day ? e.duel : { day, used: 0, bonus: s.lastSessionDay === day ? DUEL.perSession : 0 };
  const se = e.season;
  const record: DuelRecord = { at: now, opp: opp.name, outcome: result.outcome, myWins: result.myWins, theirWins: result.theirWins, gc, pts };
  return {
    ok: true, result, theirOrder, record,
    state: {
      ...s, gc: s.gc + gc,
      extra: {
        ...e,
        duel: { ...d, used: d.used + 1 },
        duels: [record, ...(e.duels ?? [])].slice(0, 12),
        season: {
          ...se,
          points: (se.points ?? 0) + pts,
          wins: (se.wins ?? 0) + (win ? 1 : 0),
          losses: (se.losses ?? 0) + (result.outcome === "loss" ? 1 : 0),
          draws: (se.draws ?? 0) + (result.outcome === "draw" ? 1 : 0),
        },
      },
    },
  };
}

export const groupShort = (g: MuscleGroup) => GROUPS.find((x) => x.id === g)!.short;

/** Bilan court de la saison : « 3 V · 1 D » (+ égalités s'il y en a). */
export const recordShort = (se: { wins?: number; losses?: number; draws?: number }) =>
  `${se.wins ?? 0} V · ${se.losses ?? 0} D${se.draws ? ` · ${se.draws} N` : ""}`;
