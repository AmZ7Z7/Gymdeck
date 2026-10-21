import {
  BOOSTER_PRICE_GC, BoosterKind, DAILY_LOGIN_GC, DECK_SIZE, DISCARD_GC, EXERCISES, LOGIN_CYCLE, PARIS_TZ, RARITIES,
  SHARDS_CRAFT, SHARDS_DISCARD, type Rarity,
} from "./config";
import { CardData, bestDeckIds, makeChosenCard, openBooster, validateDeck } from "./engine";
import type { Rng } from "./rng";
import type { MarketState } from "./market";
import type { Extra } from "./progress";
import type { GradingJob } from "./grading";

export interface OwnedCard extends CardData {
  id: string;
  /** Numéro d'obtention (ordre de tirage), pour l'affichage « Récentes ». */
  obtainedSeq: number;
}

export interface PendingBooster {
  id: string;
  kind: BoosterKind;
  /** Booster de test uniquement : rareté garantie. */
  force?: Rarity;
}

/** État sérialisable d'un joueur — c'est ce qui sera stocké en base. */
export interface PlayerState {
  /** Pseudo choisi à l'arrivée (absent sur les anciennes sauvegardes : on le redemande). */
  name?: string;
  gc: number;
  boosters: PendingBooster[];
  cards: OwnedCard[];
  deck: string[]; // ids de cartes
  pityCounter: number;
  /** Boosters ouverts d'affilée sans LR (filet de sécurité LR ; absent sur les anciennes sauvegardes = 0). */
  lrPityCounter?: number;
  /** Éclats de la Forge, gagnés en défaussant des cartes (absent sur les anciennes sauvegardes = 0). */
  shards?: number;
  lastSessionDay: string | null;
  loginCount: number;
  lastLoginDay: string | null;
  sessionsValidated: number;
  seq: number;
  /** Marché aux enchères (absent sur les anciennes sauvegardes : créé au premier passage). */
  market?: MarketState;
  /** Missions, série, succès, profil social, saison (créé au premier passage). */
  extra?: Extra;
  /** Cartes confiées à Basile pour une expertise (24 h). */
  grading?: GradingJob[];
}

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

let idCounter = 0;
export const newId = () =>
  globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `id-${Date.now()}-${idCounter++}`;

/** Jour calendaire à Paris (AAAA-MM-JJ) : le reset des boosters de séance se fait à minuit, heure de Paris. */
export function parisDay(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: PARIS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Création de compte : 0 GC, deux boosters de bienvenue (normal puis amélioré). */
export function createAccount(): PlayerState {
  return {
    gc: 0,
    boosters: [
      { id: newId(), kind: "welcome1" },
      { id: newId(), kind: "welcome2" },
    ],
    cards: [],
    deck: [],
    pityCounter: 0,
    lastSessionDay: null,
    loginCount: 0,
    lastLoginDay: null,
    sessionsValidated: 0,
    seq: 0,
  };
}

/** Valider une séance : un booster de séance maximum par jour (jour de Paris). */
export function validateSession(s: PlayerState, now: Date): Result<{ state: PlayerState }> {
  const day = parisDay(now);
  if (s.lastSessionDay === day) return { ok: false, error: "Booster de séance déjà obtenu aujourd'hui." };
  return {
    ok: true,
    state: {
      ...s,
      lastSessionDay: day,
      sessionsValidated: s.sessionsValidated + 1,
      boosters: [...s.boosters, { id: newId(), kind: "session" }],
    },
  };
}

/** Récompense de connexion : +5 GC par jour ; à la 7e connexion cumulée, un booster en plus. */
export function claimLogin(s: PlayerState, now: Date): Result<{ state: PlayerState; bonusBooster: boolean }> {
  const day = parisDay(now);
  if (s.lastLoginDay === day) return { ok: false, error: "Récompense de connexion déjà récupérée aujourd'hui." };
  const loginCount = s.loginCount + 1;
  const bonusBooster = loginCount % LOGIN_CYCLE === 0;
  return {
    ok: true,
    bonusBooster,
    state: {
      ...s,
      gc: s.gc + DAILY_LOGIN_GC,
      loginCount,
      lastLoginDay: day,
      boosters: bonusBooster ? [...s.boosters, { id: newId(), kind: "login" }] : s.boosters,
    },
  };
}

/** Achat d'un booster en boutique (75 GC). Pas de limite quotidienne tant que le solde suffit. */
export function buyBooster(s: PlayerState): Result<{ state: PlayerState }> {
  if (s.gc < BOOSTER_PRICE_GC) return { ok: false, error: `Il manque ${BOOSTER_PRICE_GC - s.gc} GC.` };
  return {
    ok: true,
    state: { ...s, gc: s.gc - BOOSTER_PRICE_GC, boosters: [...s.boosters, { id: newId(), kind: "shop" }] },
  };
}

/**
 * Ouvre un booster conservé. Les cartes sont générées et enregistrées dans l'état avant toute animation :
 * aucune possibilité de relancer le tirage.
 */
export function openPendingBooster(
  s: PlayerState,
  boosterId: string,
  rng: Rng,
): Result<{ state: PlayerState; cards: OwnedCard[]; pityTriggered: boolean; lrPityTriggered: boolean; rPlusTriggered: boolean }> {
  const booster = s.boosters.find((b) => b.id === boosterId);
  if (!booster) return { ok: false, error: "Booster introuvable." };
  const res = openBooster(rng, booster.kind, s.pityCounter, booster.force, s.lrPityCounter ?? 0);
  let seq = s.seq;
  const cards: OwnedCard[] = res.cards.map((c) => ({ ...c, id: newId(), obtainedSeq: ++seq }));
  return {
    ok: true,
    cards,
    pityTriggered: res.pityTriggered,
    lrPityTriggered: res.lrPityTriggered,
    rPlusTriggered: res.rPlusTriggered,
    state: {
      ...s,
      boosters: s.boosters.filter((b) => b.id !== boosterId),
      cards: [...s.cards, ...cards],
      pityCounter: res.pityAfter,
      lrPityCounter: res.lrPityAfter,
      seq,
    },
  };
}

/** Défausse : rapporte des GC et des éclats de Forge selon la rareté. Impossible tant que la carte est dans le deck. */
export function discardCard(s: PlayerState, cardId: string): Result<{ state: PlayerState; gained: number; shards: number }> {
  const card = s.cards.find((c) => c.id === cardId);
  if (!card) return { ok: false, error: "Carte introuvable." };
  if (s.deck.includes(cardId)) return { ok: false, error: "Retire d'abord cette carte de ton deck." };
  if (atWorkshop(s, cardId)) return { ok: false, error: "Cette carte est chez Basile : attends la fin de l’expertise." };
  const gained = DISCARD_GC[card.rarity];
  const shards = SHARDS_DISCARD[card.rarity];
  return {
    ok: true, gained, shards,
    state: { ...s, gc: s.gc + gained, shards: (s.shards ?? 0) + shards, cards: s.cards.filter((c) => c.id !== cardId) },
  };
}

/** Forge : fabrique la carte de son choix (exercice + rareté) en dépensant des éclats. */
export function craftCard(s: PlayerState, exerciseSlug: string, rarity: Rarity, rng: Rng): Result<{ state: PlayerState; card: OwnedCard }> {
  if (!EXERCISES.some((e) => e.slug === exerciseSlug)) return { ok: false, error: "Exercice introuvable." };
  if (!RARITIES.includes(rarity)) return { ok: false, error: "Rareté inconnue." };
  const cost = SHARDS_CRAFT[rarity];
  const have = s.shards ?? 0;
  if (have < cost) return { ok: false, error: `Il manque ${cost - have} éclat${cost - have > 1 ? "s" : ""}.` };
  const card: OwnedCard = { ...makeChosenCard(rng, exerciseSlug, rarity), id: newId(), obtainedSeq: s.seq + 1 };
  return { ok: true, card, state: { ...s, shards: have - cost, seq: s.seq + 1, cards: [...s.cards, card] } };
}

/** Définit le deck (5 cartes max, un exemplaire par exercice). */
export function setDeck(s: PlayerState, cardIds: string[]): Result<{ state: PlayerState }> {
  if (new Set(cardIds).size !== cardIds.length) return { ok: false, error: "Carte en double dans le deck." };
  const cards: OwnedCard[] = [];
  for (const id of cardIds) {
    const c = s.cards.find((x) => x.id === id);
    if (!c) return { ok: false, error: "Carte non possédée." };
    cards.push(c);
  }
  if (cardIds.length > DECK_SIZE) return { ok: false, error: `Un deck contient au maximum ${DECK_SIZE} cartes.` };
  const err = validateDeck(cards);
  if (err) return { ok: false, error: err };
  return { ok: true, state: { ...s, deck: cardIds } };
}


// ───────────── Compléments : pseudo, deck auto, doublons, progression ─────────────

export function setName(s: PlayerState, name: string): Result<{ state: PlayerState }> {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 20);
  if (clean.length < 2) return { ok: false, error: "Ton pseudo doit faire au moins 2 caractères." };
  return { ok: true, state: { ...s, name: clean } };
}

/** Remplit / optimise le deck avec les meilleures cartes possédées. */
export function autoDeck(s: PlayerState): Result<{ state: PlayerState }> {
  const ids = bestDeckIds(s.cards);
  if (ids.length === 0) return { ok: false, error: "Tu n'as pas encore de carte." };
  return { ok: true, state: { ...s, deck: ids } };
}

/**
 * Doublons défaussables : pour chaque couple (exercice, rareté), on garde la meilleure carte
 * (celle du deck en priorité) et on propose les autres. Une carte du deck n'est jamais proposée.
 */
export function duplicateIds(s: PlayerState): string[] {
  const groups = new Map<string, OwnedCard[]>();
  // les cartes expertisées (ou chez Basile) ne sont jamais proposées au nettoyage
  for (const c of s.cards.filter((x) => !x.grade && !atWorkshop(s, x.id))) {
    const key = `${c.exerciseSlug}|${c.rarity}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const out: string[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) =>
      Number(s.deck.includes(b.id)) - Number(s.deck.includes(a.id)) || b.atq + b.def - (a.atq + a.def));
    for (const c of sorted.slice(1)) if (!s.deck.includes(c.id)) out.push(c.id);
  }
  return out;
}

export function discardMany(s: PlayerState, ids: string[]): Result<{ state: PlayerState; gained: number; shards: number; count: number }> {
  const set = new Set(ids);
  const removable = s.cards.filter((c) => set.has(c.id) && !s.deck.includes(c.id) && !atWorkshop(s, c.id));
  if (removable.length === 0) return { ok: false, error: "Rien à défausser." };
  const gained = removable.reduce((sum, c) => sum + DISCARD_GC[c.rarity], 0);
  const shards = removable.reduce((sum, c) => sum + SHARDS_DISCARD[c.rarity], 0);
  const gone = new Set(removable.map((c) => c.id));
  return {
    ok: true, gained, shards, count: removable.length,
    state: { ...s, gc: s.gc + gained, shards: (s.shards ?? 0) + shards, cards: s.cards.filter((c) => !gone.has(c.id)) },
  };
}

/** Carte en cours d'expertise chez Basile (verrouillée : ni vente, ni échange, ni défausse). */
export const atWorkshop = (s: PlayerState, cardId: string) => !!s.grading?.some((j) => j.cardId === cardId);

/** Complétion : nombre de couples (exercice, rareté) possédés sur le total possible. */
export function completion(s: PlayerState): { owned: number; total: number } {
  const owned = new Set(s.cards.map((c) => `${c.exerciseSlug}|${c.rarity}`)).size;
  return { owned, total: EXERCISES.length * RARITIES.length };
}

/** Millisecondes avant le prochain minuit à Paris (reset du booster de séance). */
export function msUntilParisMidnight(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: PARIS_TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const elapsed = v("hour") * 3600 + v("minute") * 60 + v("second");
  return Math.max(0, (86400 - elapsed) * 1000);
}
