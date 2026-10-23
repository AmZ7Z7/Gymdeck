import { newId, type OwnedCard, type PlayerState } from "./game";

/**
 * Booster invité : un seul booster gratuit par navigateur, ouvert avant de créer son compte.
 * Ses cartes sont gardées dans le navigateur, puis ajoutées à la collection à la création du compte.
 */
export const GUEST_KEY = "gymdeck:guest:v1";

export interface GuestRecord {
  /** Cartes tirées, en attente d'un compte. Vide une fois ajoutées à un compte. */
  cards: OwnedCard[];
  /** Le booster invité a déjà été utilisé sur ce navigateur (reste vrai après l'ajout des cartes). */
  used: true;
}

export function loadGuest(): GuestRecord | null {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    return raw ? (JSON.parse(raw) as GuestRecord) : null;
  } catch {
    return null;
  }
}

export function saveGuest(g: GuestRecord) {
  try { localStorage.setItem(GUEST_KEY, JSON.stringify(g)); } catch { /* stockage indisponible */ }
}

/** Ajoute les cartes du booster invité à une partie : nouveaux identifiants, à la suite des cartes du joueur. */
export function addGuestCards(s: PlayerState, cards: OwnedCard[]): PlayerState {
  if (!cards.length) return s;
  let seq = s.seq;
  const added = cards.map((c) => ({ ...c, id: newId(), obtainedSeq: ++seq }));
  return { ...s, seq, cards: [...s.cards, ...added] };
}
