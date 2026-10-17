import { STAT_RANGE, exerciseBySlug, type Rarity } from "./config";
import { CardData, drawRarity, makeCard, type Weights } from "./engine";
import { atWorkshop, newId, type OwnedCard, type PlayerState, type Result } from "./game";
import { drawGrade, gradedStats } from "./grading";
import type { Rng } from "./rng";

/**
 * Marché aux enchères (prototype).
 * Les autres joueurs sont SIMULÉS ici (pseudos fictifs) : la vraie version fera tourner ces règles sur le serveur.
 * Pas de commission : le vendeur reçoit toute la mise finale. Les GC d'une mise sont bloqués jusqu'à la fin de
 * l'enchère ou jusqu'à ce qu'on te surenchérisse (ils te sont alors rendus).
 */

export const ME = "me";
export const HOUR = 3_600_000;

export const MARKET = {
  minActive: 10,
  stepMs: 15 * 60_000,
  incrementPct: 0.05,
  snipeWindowMs: 2 * 60_000,
  snipeExtendMs: 2 * 60_000,
  durationsH: [6, 12, 24] as const,
  maxPrice: 9999,
  maxMyListings: 5,
  historyMax: 30,
};

/** Valeur de référence d'une carte moyenne de la rareté, en GC (sert aux prix de départ conseillés et aux acheteurs simulés). */
export const FAIR_VALUE: Record<Rarity, number> = { C: 3, R: 8, SR: 24, SSR: 60, UR: 200, LR: 600 };

const BOT_NAMES = ["Léa_Fit", "Karim92", "BigSquat", "Camille.R", "IronMaxime", "Nora.Lifts", "TomPush", "Sarah_Gym", "Yanis75", "LiftOrDie"];

const MARKET_WEIGHTS: Weights = { C: 2500, R: 3000, SR: 2500, SSR: 1500, UR: 400, LR: 100 };

export interface Auction {
  id: string;
  card: CardData;
  /** "me" ou pseudo simulé */
  seller: string;
  startPrice: number;
  /** 0 tant que personne n'a enchéri */
  currentBid: number;
  /** "me", pseudo simulé, ou null */
  bidder: string | null;
  createdAt: number;
  endsAt: number;
  /** Jusqu'où les acheteurs simulés ont été simulés (ms). */
  simAt: number;
  /** Plafond privé des acheteurs simulés. */
  cap: number;
}

export type MarketEventKind = "won" | "sold" | "unsold" | "outbid" | "cancelled";
export interface MarketEntry { id: string; at: number; kind: MarketEventKind; card: CardData; price: number }
export interface MarketState { auctions: Auction[]; history: MarketEntry[]; offsetMs: number }

export const emptyMarket = (): MarketState => ({ auctions: [], history: [], offsetMs: 0 });

export const marketNow = (m: MarketState | undefined, realNow: number) => realNow + (m?.offsetMs ?? 0);

const valueFactor = (c: CardData) => {
  const r = STAT_RANGE[c.rarity];
  const f = ((c.atq + c.def) / 2 - r.min) / (r.max - r.min);
  return 0.85 + 0.3 * Math.max(0, Math.min(1, f));
};
/**
 * Les joueurs (ici simulés) paient plus cher une carte bien notée par Basile : ce n'est pas un prix fixé par le jeu,
 * c'est la façon dont les acheteurs simulés estiment la carte.
 */
export const gradeAppeal = (grade?: number) =>
  !grade ? 1 : grade >= 10 ? 1.8 : grade === 9 ? 1.35 : grade === 8 ? 1.12 : grade >= 5 ? 1 : 0.88;
export const fairValue = (c: CardData) => Math.max(1, Math.round(FAIR_VALUE[c.rarity] * valueFactor(c) * gradeAppeal(c.grade)));
export const suggestedStart = (c: CardData) => Math.max(1, Math.round(fairValue(c) * 0.5));

export const priceShown = (a: Auction) => (a.bidder ? a.currentBid : a.startPrice);
export const bidStep = (a: Auction) => Math.max(1, Math.ceil(a.currentBid * MARKET.incrementPct));
export const minNextBid = (a: Auction) => (a.bidder ? a.currentBid + bidStep(a) : a.startPrice);
export const isEnded = (a: Auction, now: number) => now >= a.endsAt;

export interface MarketEvent { kind: MarketEventKind; message: string }

const name = (c: CardData) => `${exerciseBySlug(c.exerciseSlug).name} ${c.rarity}`;
const pick = <T,>(rng: Rng, list: readonly T[]) => list[rng.int(0, list.length - 1)]!;
const rnd = (rng: Rng, min: number, max: number) => min + (rng.int(0, 10000) / 10000) * (max - min);

function npcAuction(rng: Rng, now: number): Auction {
  const rarity = drawRarity(rng, MARKET_WEIGHTS);
  let card = makeCard(rng, rarity);
  // environ une annonce sur six est une carte déjà expertisée
  if (rng.int(0, 99) < 16) {
    const grade = drawGrade(rng);
    const g = gradedStats(card.atq, card.def, grade);
    card = { ...card, raw: { atq: card.atq, def: card.def }, atq: g.atq, def: g.def, grade };
  }
  const fair = fairValue(card);
  const duration = Math.round(rnd(rng, 0.4, 24) * HOUR);
  return {
    id: newId(), card, seller: pick(rng, BOT_NAMES),
    startPrice: Math.max(1, Math.round(fair * rnd(rng, 0.3, 0.6))),
    currentBid: 0, bidder: null,
    createdAt: now, endsAt: now + duration, simAt: now,
    cap: Math.max(1, Math.round(fair * rnd(rng, 0.7, 1.8))),
  };
}

const pushHistory = (m: MarketState, e: Omit<MarketEntry, "id">): MarketState =>
  ({ ...m, history: [{ ...e, id: newId() }, ...m.history].slice(0, MARKET.historyMax) });

/**
 * Fait avancer le marché jusqu'à `now` : acheteurs simulés, fins d'enchères (cartes / GC remis), nouvelles annonces.
 * Pur : renvoie un nouvel état et la liste des événements à annoncer au joueur.
 */
export function syncMarket(s: PlayerState, rng: Rng, now: number): { state: PlayerState; events: MarketEvent[]; changed: boolean } {
  let m: MarketState = s.market ?? emptyMarket();
  let gc = s.gc;
  let cards = s.cards;
  let seq = s.seq;
  const events: MarketEvent[] = [];
  let changed = !s.market;
  const next: Auction[] = [];

  for (const orig of m.auctions) {
    const a: Auction = { ...orig };
    // 1) acheteurs simulés, par pas de 15 minutes
    let t = a.simAt;
    while (t + MARKET.stepMs <= Math.min(now, a.endsAt)) {
      t += MARKET.stepMs;
      const chance = a.seller === ME ? 1400 : 1000; // sur 10000, par pas
      if (rng.int(0, 9999) < chance) {
        const bid = minNextBid(a) + rng.int(0, Math.max(1, Math.round(a.currentBid * 0.1)));
        if (bid <= a.cap) {
          if (a.bidder === ME) {
            gc += a.currentBid; // surenchère : mes GC me sont rendus
            events.push({ kind: "outbid", message: `Surenchéri sur ${name(a.card)} : ${a.currentBid} GC rendus.` });
            m = pushHistory(m, { at: t, kind: "outbid", card: a.card, price: a.currentBid });
          }
          a.currentBid = bid;
          a.bidder = pick(rng, BOT_NAMES);
          if (a.endsAt - t <= MARKET.snipeWindowMs) a.endsAt += MARKET.snipeExtendMs;
          changed = true;
        }
      }
    }
    a.simAt = Math.max(a.simAt, Math.min(now, a.endsAt));
    if (a.simAt !== orig.simAt) changed = true;

    // 2) fin de l'enchère
    if (now >= a.endsAt) {
      changed = true;
      if (a.seller === ME) {
        if (a.bidder) {
          gc += a.currentBid;
          events.push({ kind: "sold", message: `Vendu : ${name(a.card)} pour ${a.currentBid} GC !` });
          m = pushHistory(m, { at: a.endsAt, kind: "sold", card: a.card, price: a.currentBid });
        } else {
          cards = [...cards, { ...a.card, id: newId(), obtainedSeq: ++seq }];
          events.push({ kind: "unsold", message: `Invendue : ${name(a.card)} est revenue dans ta collection.` });
          m = pushHistory(m, { at: a.endsAt, kind: "unsold", card: a.card, price: 0 });
        }
      } else if (a.bidder === ME) {
        cards = [...cards, { ...a.card, id: newId(), obtainedSeq: ++seq }];
        events.push({ kind: "won", message: `Enchère gagnée : ${name(a.card)} pour ${a.currentBid} GC !` });
        m = pushHistory(m, { at: a.endsAt, kind: "won", card: a.card, price: a.currentBid });
      }
      continue;
    }
    next.push(a);
  }

  // 3) nouvelles annonces pour garder un marché vivant
  while (next.filter((a) => a.seller !== ME).length < MARKET.minActive) {
    next.push(npcAuction(rng, now));
    changed = true;
  }

  if (!changed) return { state: s, events, changed: false };
  return { state: { ...s, gc, cards, seq, market: { ...m, auctions: next } }, events, changed: true };
}

/** Enchérir : les GC sont bloqués immédiatement. */
export function placeBid(s: PlayerState, auctionId: string, amount: number, now: number): Result<{ state: PlayerState }> {
  const m = s.market ?? emptyMarket();
  const a = m.auctions.find((x) => x.id === auctionId);
  if (!a || isEnded(a, now)) return { ok: false, error: "Cette enchère est terminée." };
  if (a.seller === ME) return { ok: false, error: "Tu ne peux pas enchérir sur ta propre carte." };
  if (a.bidder === ME) return { ok: false, error: "Tu es déjà en tête." };
  if (!Number.isInteger(amount)) return { ok: false, error: "Mise invalide." };
  if (amount < minNextBid(a)) return { ok: false, error: `Mise minimum : ${minNextBid(a)} GC.` };
  if (amount > s.gc) return { ok: false, error: `Il manque ${amount - s.gc} GC.` };
  const snipe = a.endsAt - now <= MARKET.snipeWindowMs;
  const updated: Auction = { ...a, currentBid: amount, bidder: ME, endsAt: snipe ? a.endsAt + MARKET.snipeExtendMs : a.endsAt };
  return { ok: true, state: { ...s, gc: s.gc - amount, market: { ...m, auctions: m.auctions.map((x) => (x.id === a.id ? updated : x)) } } };
}

/** Mettre une carte aux enchères : elle quitte la collection (séquestre) jusqu'à la fin. */
export function listCard(s: PlayerState, rng: Rng, cardId: string, price: number, hours: number, now: number): Result<{ state: PlayerState }> {
  const card = s.cards.find((c) => c.id === cardId);
  if (!card) return { ok: false, error: "Carte introuvable." };
  if (s.deck.includes(cardId)) return { ok: false, error: "Retire d’abord cette carte de ton deck." };
  if (atWorkshop(s, cardId)) return { ok: false, error: "Cette carte est chez Basile : attends la fin de l’expertise." };
  if (!Number.isInteger(price) || price < 1 || price > MARKET.maxPrice) return { ok: false, error: `Prix de départ : de 1 à ${MARKET.maxPrice} GC.` };
  if (!(MARKET.durationsH as readonly number[]).includes(hours)) return { ok: false, error: "Durée invalide." };
  const m = s.market ?? emptyMarket();
  if (m.auctions.filter((a) => a.seller === ME).length >= MARKET.maxMyListings) return { ok: false, error: `Maximum ${MARKET.maxMyListings} ventes en même temps.` };
  const { id: _id, obtainedSeq: _o, ...data } = card;
  const auction: Auction = {
    id: newId(), card: data, seller: ME, startPrice: price, currentBid: 0, bidder: null,
    createdAt: now, endsAt: now + hours * HOUR, simAt: now,
    cap: Math.max(1, Math.round(fairValue(data) * rnd(rng, 0.6, 1.7))),
  };
  return { ok: true, state: { ...s, cards: s.cards.filter((c) => c.id !== cardId), market: { ...m, auctions: [...m.auctions, auction] } } };
}

/** Annuler une vente : seulement si personne n'a enchéri. */
export function cancelAuction(s: PlayerState, auctionId: string): Result<{ state: PlayerState }> {
  const m = s.market ?? emptyMarket();
  const a = m.auctions.find((x) => x.id === auctionId);
  if (!a || a.seller !== ME) return { ok: false, error: "Vente introuvable." };
  if (a.bidder) return { ok: false, error: "Quelqu’un a déjà enchéri : impossible d’annuler." };
  const back: OwnedCard = { ...a.card, id: newId(), obtainedSeq: s.seq + 1 };
  return {
    ok: true,
    state: {
      ...s, seq: s.seq + 1, cards: [...s.cards, back],
      market: { ...pushHistory(m, { at: Date.now(), kind: "cancelled", card: a.card, price: 0 }), auctions: m.auctions.filter((x) => x.id !== a.id) },
    },
  };
}

