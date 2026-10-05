import {
  BOOSTER_PRICE_GC, BoosterKind, DAILY_LOGIN_GC, DECK_SIZE, DISCARD_GC, LOGIN_CYCLE, PARIS_TZ,
} from "./config";
import { CardData, openBooster, validateDeck } from "./engine";
import type { Rng } from "./rng";

export interface OwnedCard extends CardData {
  id: string;
  /** Numéro d'obtention (ordre de tirage), pour l'affichage « Récentes ». */
  obtainedSeq: number;
}

export interface PendingBooster {
  id: string;
  kind: BoosterKind;
}

/** État sérialisable d'un joueur — c'est ce qui sera stocké en base. */
export interface PlayerState {
  gc: number;
  boosters: PendingBooster[];
  cards: OwnedCard[];
  deck: string[]; // ids de cartes
  pityCounter: number;
  lastSessionDay: string | null;
  loginCount: number;
  lastLoginDay: string | null;
  sessionsValidated: number;
  seq: number;
}

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

let idCounter = 0;
const newId = () =>
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
): Result<{ state: PlayerState; cards: OwnedCard[]; pityTriggered: boolean; rPlusTriggered: boolean }> {
  const booster = s.boosters.find((b) => b.id === boosterId);
  if (!booster) return { ok: false, error: "Booster introuvable." };
  const res = openBooster(rng, booster.kind, s.pityCounter);
  let seq = s.seq;
  const cards: OwnedCard[] = res.cards.map((c) => ({ ...c, id: newId(), obtainedSeq: ++seq }));
  return {
    ok: true,
    cards,
    pityTriggered: res.pityTriggered,
    rPlusTriggered: res.rPlusTriggered,
    state: {
      ...s,
      boosters: s.boosters.filter((b) => b.id !== boosterId),
      cards: [...s.cards, ...cards],
      pityCounter: res.pityAfter,
      seq,
    },
  };
}

/** Défausse : rapporte des GC selon la rareté. Impossible tant que la carte est dans le deck. */
export function discardCard(s: PlayerState, cardId: string): Result<{ state: PlayerState; gained: number }> {
  const card = s.cards.find((c) => c.id === cardId);
  if (!card) return { ok: false, error: "Carte introuvable." };
  if (s.deck.includes(cardId)) return { ok: false, error: "Retire d'abord cette carte de ton deck." };
  const gained = DISCARD_GC[card.rarity];
  return { ok: true, gained, state: { ...s, gc: s.gc + gained, cards: s.cards.filter((c) => c.id !== cardId) } };
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
