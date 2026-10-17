import {
  BoosterKind, CARDS_PER_BOOSTER, DECK_SIZE, EXERCISES, NORMAL_WEIGHTS, PASSIVE_TENTHS, PITY_THRESHOLD,
  RARITIES, RARITY_RANK, STAT_RANGE, WELCOME2_WEIGHTS, type Rarity,
} from "./config";
import type { Rng } from "./rng";

export type PassiveType = "ATQ" | "DEF" | "BOTH";

/** Bonus en dixièmes de % (35 = +3,5 %). */
export interface Passive {
  type: PassiveType;
  atqTenths: number;
  defTenths: number;
}

export interface CardData {
  exerciseSlug: string;
  rarity: Rarity;
  atq: number;
  def: number;
  passive: Passive | null;
  /** Note de l'expertise de Basile (1 à 10), une fois révélée. Elle suit la carte partout (Marché, échanges). */
  grade?: number;
  /** ATQ / DEF avant l'effet de la note (présent dès qu'une carte est notée). */
  raw?: { atq: number; def: number };
}

export type Weights = Record<Rarity, number>;

export function weightsFor(kind: BoosterKind): Weights {
  return kind === "welcome2" ? WELCOME2_WEIGHTS : NORMAL_WEIGHTS;
}

export function drawRarity(rng: Rng, weights: Weights): Rarity {
  let roll = rng.int(0, 9999);
  for (const r of RARITIES) {
    if (roll < weights[r]) return r;
    roll -= weights[r];
  }
  throw new Error("Table de probabilités invalide");
}

export function drawPassive(rng: Rng, rarity: "UR" | "LR"): Passive {
  const cfg = PASSIVE_TENTHS[rarity];
  const type: PassiveType = (["ATQ", "DEF", "BOTH"] as const)[rng.int(0, 2)] as PassiveType;
  if (type === "BOTH") {
    return {
      type,
      atqTenths: rng.int(cfg.both.min, cfg.both.max),
      defTenths: rng.int(cfg.both.min, cfg.both.max),
    };
  }
  const v = rng.int(cfg.single.min, cfg.single.max);
  return { type, atqTenths: type === "ATQ" ? v : 0, defTenths: type === "DEF" ? v : 0 };
}

/** Génère une carte complète : exercice, stats ATQ/DEF indépendantes, passif si UR/LR. */
export function makeCard(rng: Rng, rarity: Rarity): CardData {
  const range = STAT_RANGE[rarity];
  const exercise = EXERCISES[rng.int(0, EXERCISES.length - 1)]!;
  return {
    exerciseSlug: exercise.slug,
    rarity,
    atq: rng.int(range.min, range.max),
    def: rng.int(range.min, range.max),
    passive: rarity === "UR" || rarity === "LR" ? drawPassive(rng, rarity) : null,
  };
}

export const isTop = (r: Rarity) => r === "UR" || r === "LR";

export interface BoosterResult {
  cards: CardData[];
  /** Nouveau compteur de pity après ce booster. */
  pityAfter: number;
  /** Garanties déclenchées (utile pour l'affichage et les tests). */
  pityTriggered: boolean;
  rPlusTriggered: boolean;
}

/** Index de la carte de plus faible rareté (première en cas d'égalité). */
function lowestIndex(rarities: Rarity[]): number {
  let best = 0;
  for (let i = 1; i < rarities.length; i++) {
    if (RARITY_RANK[rarities[i]!] < RARITY_RANK[rarities[best]!]) best = i;
  }
  return best;
}

/**
 * Ouvre un booster (5 cartes). Ordre des règles :
 *  1. tirage des 5 raretés avec la table du booster ;
 *  2. pity : si 11 boosters consécutifs sans UR/LR et aucune UR/LR ici → une carte devient UR ;
 *  3. garantie R+ : si les 5 cartes sont C → une devient R ;
 *  4. génération des exemplaires (exercice, stats, passif).
 * Un booster contenant au moins une UR/LR remet le compteur à zéro, sinon il l'incrémente.
 */
export function openBooster(rng: Rng, kind: BoosterKind, pityBefore: number, force?: Rarity): BoosterResult {
  const weights = weightsFor(kind);
  const rarities: Rarity[] = Array.from({ length: CARDS_PER_BOOSTER }, () => drawRarity(rng, weights));

  // Booster de test : une carte de la rareté demandée est garantie, le compteur de pity ne bouge pas.
  if (force) {
    rarities[rng.int(0, rarities.length - 1)] = force;
    return { cards: rarities.map((r) => makeCard(rng, r)), pityAfter: pityBefore, pityTriggered: false, rPlusTriggered: false };
  }

  let pityTriggered = false;
  if (pityBefore >= PITY_THRESHOLD - 1 && !rarities.some(isTop)) {
    rarities[lowestIndex(rarities)] = "UR";
    pityTriggered = true;
  }

  let rPlusTriggered = false;
  const allCommon = rarities.filter((r) => r === "C").length === rarities.length;
  if (allCommon) {
    rarities[rng.int(0, rarities.length - 1)] = "R";
    rPlusTriggered = true;
  }

  const cards = rarities.map((r) => makeCard(rng, r));
  const pityAfter = rarities.some(isTop) ? 0 : pityBefore + 1;
  return { cards, pityAfter, pityTriggered, rPlusTriggered };
}

// ───────────── Deck ─────────────

export interface DeckTotals {
  baseAtq: number;
  baseDef: number;
  bonusAtqPct: number;
  bonusDefPct: number;
  totalAtq: number;
  totalDef: number;
}

/** Valide : 5 cartes max, un seul exemplaire par exercice (toutes raretés confondues). */
export function validateDeck(cards: Pick<CardData, "exerciseSlug">[]): string | null {
  if (cards.length > DECK_SIZE) return `Un deck contient au maximum ${DECK_SIZE} cartes.`;
  const seen = new Set<string>();
  for (const c of cards) {
    if (seen.has(c.exerciseSlug)) return "Un seul exemplaire par exercice.";
    seen.add(c.exerciseSlug);
  }
  return null;
}

/** Passifs appliqués à tout le deck (porteuse comprise), cumul additif sur les stats de base. */
export function deckTotals(cards: CardData[]): DeckTotals {
  const baseAtq = cards.reduce((s, c) => s + c.atq, 0);
  const baseDef = cards.reduce((s, c) => s + c.def, 0);
  const atqTenths = cards.reduce((s, c) => s + (c.passive?.atqTenths ?? 0), 0);
  const defTenths = cards.reduce((s, c) => s + (c.passive?.defTenths ?? 0), 0);
  return {
    baseAtq,
    baseDef,
    bonusAtqPct: atqTenths / 10,
    bonusDefPct: defTenths / 10,
    totalAtq: Math.round((baseAtq * (1000 + atqTenths)) / 1000),
    totalDef: Math.round((baseDef * (1000 + defTenths)) / 1000),
  };
}

// ───────────── Aides deck ─────────────

/** Puissance d'un deck = ATQ totale + DEF totale (passifs inclus). */
export function deckPower(cards: CardData[]): number {
  const t = deckTotals(cards);
  return t.totalAtq + t.totalDef;
}

/**
 * Meilleur deck possible parmi les cartes possédées : un exemplaire par exercice, passifs compris.
 * Glouton (on ajoute la carte qui fait le plus monter la puissance) puis améliorations par échanges.
 */
export function bestDeckIds<T extends CardData & { id: string }>(cards: T[], size = DECK_SIZE): string[] {
  const picked: T[] = [];
  const power = (list: T[]) => deckPower(list);

  while (picked.length < size) {
    let best: T | null = null;
    let bestPower = -1;
    for (const c of cards) {
      if (picked.some((p) => p.exerciseSlug === c.exerciseSlug)) continue;
      const pw = power([...picked, c]);
      if (pw > bestPower) { bestPower = pw; best = c; }
    }
    if (!best) break;
    picked.push(best);
  }

  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < picked.length; i++) {
      for (const c of cards) {
        if (picked[i]!.id === c.id) continue;
        if (picked.some((p, k) => k !== i && p.exerciseSlug === c.exerciseSlug)) continue;
        const candidate = picked.map((p, k) => (k === i ? c : p));
        if (power(candidate) > power(picked)) { picked[i] = c; improved = true; }
      }
    }
  }
  return picked.map((c) => c.id);
}

/**
 * Ordre d'affichage d'un booster : la carte la plus rare est toujours révélée en dernier (5e).
 * À rareté égale, la plus forte (ATQ + DEF). Les autres gardent l'ordre du tirage.
 * Cela ne change que l'affichage : les cartes et leurs probabilités restent identiques.
 */
export function revealOrder(cards: Pick<CardData, "rarity" | "atq" | "def">[]): number[] {
  if (cards.length === 0) return [];
  let best = 0;
  cards.forEach((c, i) => {
    const b = cards[best]!;
    const d = RARITY_RANK[c.rarity] - RARITY_RANK[b.rarity];
    if (d > 0 || (d === 0 && c.atq + c.def > b.atq + b.def)) best = i;
  });
  return [...cards.keys()].filter((i) => i !== best).concat(best);
}
