import { describe, expect, it } from "vitest";
import { createAccount, openPendingBooster, type PlayerState } from "../src/lib/game";
import { HOUR, ME, MARKET, cancelAuction, listCard, minNextBid, placeBid, syncMarket, type Auction } from "../src/lib/market";
import { seededRng } from "../src/lib/rng";

const ok = <T extends { ok: boolean }>(r: T) => {
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r as Extract<T, { ok: true }>;
};
const T0 = 1_800_000_000_000;

function withCards(): PlayerState {
  let s = createAccount();
  s = ok(openPendingBooster(s, s.boosters[0]!.id, seededRng(3))).state;
  return { ...s, gc: 500 };
}
const synced = (s: PlayerState, now = T0) => syncMarket(s, seededRng(7), now).state;
const mine = (s: PlayerState) => s.market!.auctions.find((a) => a.seller === ME)!;

describe("marché aux enchères", () => {
  it("garde au moins 10 annonces simulées", () => {
    const s = synced(withCards());
    expect(s.market!.auctions.filter((a) => a.seller !== ME).length).toBeGreaterThanOrEqual(MARKET.minActive);
  });

  it("enchérir bloque les GC ; mise minimum, pas de mise sur sa propre vente, pas de double mise", () => {
    let s = synced(withCards());
    const a = s.market!.auctions.find((x) => x.seller !== ME && !x.bidder)!;
    expect(placeBid(s, a.id, minNextBid(a) - 1, T0).ok).toBe(false);
    s = ok(placeBid(s, a.id, minNextBid(a), T0)).state;
    expect(s.gc).toBe(500 - a.startPrice);
    expect(placeBid(s, a.id, minNextBid(s.market!.auctions.find((x) => x.id === a.id)!), T0).ok).toBe(false); // déjà en tête
    const poor = { ...synced(withCards()), gc: 0 };
    const b = poor.market!.auctions[0]!;
    expect(placeBid(poor, b.id, minNextBid(b), T0).ok).toBe(false);
  });

  it("gagner : la carte arrive dans la collection à la fin, sans autre débit", () => {
    let s = synced(withCards());
    const a = s.market!.auctions.find((x) => x.seller !== ME && !x.bidder)!;
    const before = s.cards.length;
    s = ok(placeBid(s, a.id, a.cap + 5, T0)).state; // personne ne pourra surenchérir
    const gcAfterBid = s.gc;
    const r = syncMarket(s, seededRng(9), a.endsAt + 1);
    expect(r.state.cards.length).toBe(before + 1);
    expect(r.state.gc).toBe(gcAfterBid);
    expect(r.events.some((e) => e.kind === "won")).toBe(true);
  });

  it("mettre en vente : la carte sort de la collection, refusée si elle est dans le deck", () => {
    let s = synced(withCards());
    const c = s.cards[0]!;
    const withDeck = { ...s, deck: [c.id] };
    expect(listCard(withDeck, seededRng(1), c.id, 5, 12, T0).ok).toBe(false);
    s = ok(listCard(s, seededRng(1), c.id, 5, 12, T0)).state;
    expect(s.cards.find((x) => x.id === c.id)).toBeUndefined();
    expect(mine(s).endsAt).toBe(T0 + 12 * HOUR);
    expect(listCard(s, seededRng(1), s.cards[0]!.id, 5, 7, T0).ok).toBe(false); // durée invalide
  });

  it("vente sans enchère : la carte revient ; avec enchère : le vendeur reçoit toute la mise (aucune commission)", () => {
    let s = synced(withCards());
    const c = s.cards[0]!;
    const n = s.cards.length;
    s = ok(listCard(s, seededRng(1), c.id, 5, 6, T0)).state;
    const unsold = syncMarket({ ...s, market: { ...s.market!, auctions: s.market!.auctions.map((a) => (a.seller === ME ? { ...a, cap: 0 } : a)) } }, seededRng(2), T0 + 7 * HOUR);
    expect(unsold.state.cards.length).toBe(n);
    expect(unsold.events.some((e) => e.kind === "unsold")).toBe(true);

    // une offre simulée à 40 GC puis fin d'enchère
    const forced: Auction = { ...mine(s), bidder: "Karim92", currentBid: 40, cap: 0 };
    const sold = syncMarket({ ...s, market: { ...s.market!, auctions: s.market!.auctions.map((a) => (a.seller === ME ? forced : a)) } }, seededRng(2), T0 + 7 * HOUR);
    expect(sold.state.gc).toBe(s.gc + 40);
    expect(sold.state.cards.length).toBe(n - 1);
  });

  it("surenchère simulée : mes GC me sont rendus", () => {
    let s = synced(withCards());
    const a = s.market!.auctions.find((x) => x.seller !== ME && !x.bidder)!;
    s = ok(placeBid(s, a.id, minNextBid(a), T0)).state;
    const gcBlocked = s.gc;
    // plafond très haut + temps long : un acheteur simulé finit par surenchérir
    s = { ...s, market: { ...s.market!, auctions: s.market!.auctions.map((x) => (x.id === a.id ? { ...x, cap: 99999, endsAt: T0 + 40 * HOUR } : x)) } };
    const r = syncMarket(s, seededRng(11), T0 + 30 * HOUR);
    expect(r.events.some((e) => e.kind === "outbid")).toBe(true);
    expect(r.state.gc).toBeGreaterThan(gcBlocked);
  });

  it("annuler : possible sans enchère seulement", () => {
    let s = synced(withCards());
    const c = s.cards[0]!;
    s = ok(listCard(s, seededRng(1), c.id, 5, 24, T0)).state;
    const id = mine(s).id;
    const back = ok(cancelAuction(s, id)).state;
    expect(back.cards.length).toBe(s.cards.length + 1);
    const bid = { ...s, market: { ...s.market!, auctions: s.market!.auctions.map((a) => (a.id === id ? { ...a, bidder: "Karim92", currentBid: 9 } : a)) } };
    expect(cancelAuction(bid, id).ok).toBe(false);
  });

  it("fin en dernière minute : l'enchère est prolongée", () => {
    let s = synced(withCards());
    const a = s.market!.auctions.find((x) => x.seller !== ME && !x.bidder)!;
    const near = { ...s, market: { ...s.market!, auctions: s.market!.auctions.map((x) => (x.id === a.id ? { ...x, endsAt: T0 + 60_000 } : x)) } };
    const r = ok(placeBid(near, a.id, minNextBid(a), T0));
    expect(r.state.market!.auctions.find((x) => x.id === a.id)!.endsAt).toBe(T0 + 60_000 + MARKET.snipeExtendMs);
  });
});
