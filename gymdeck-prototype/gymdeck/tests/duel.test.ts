import { describe, expect, it } from "vitest";
import { DUEL } from "../src/lib/config";
import { combatStats, deckBonus, duelsLeft, makeOpponent, playDuel, resolveDuel } from "../src/lib/duel";
import { deckPower, type CardData } from "../src/lib/engine";
import { createAccount, type OwnedCard, type PlayerState } from "../src/lib/game";
import { normalize, track } from "../src/lib/progress";
import { finalRank } from "../src/lib/social";
import { seededRng } from "../src/lib/rng";

const c = (slug: string, atq = 500, def = 500): CardData => ({ exerciseSlug: slug, rarity: "SR", atq, def, passive: null });
const owned = (i: number, slug: string, atq = 500, def = 500): OwnedCard => ({ ...c(slug, atq, def), id: "d" + i, obtainedSeq: i });

describe("combats : bonus de deck", () => {
  it("synergies : 2 cartes du même groupe +3 %, 3 → +8 %", () => {
    const b = deckBonus([c("squat"), c("hip-thrust"), c("curl-biceps"), c("rowing-barre"), c("leg-extension")]);
    // squat, hip-thrust, leg-extension = jambes ×3 ; bras ; dos
    expect(b.groups).toEqual([{ group: "jambes", count: 3, pct: DUEL.synergyPct[3] }]);
    expect(b.perCard).toEqual([8, 8, 0, 0, 8]);
    expect(b.allDistinct).toBe(false);
  });
  it("cinq groupes différents : +6 % à tout le deck", () => {
    const b = deckBonus([c("squat"), c("developpe-couche"), c("curl-biceps"), c("rowing-barre"), c("gainage")]);
    expect(b.allDistinct).toBe(true);
    expect(b.perCard.every((p) => p === DUEL.allGroupsPct)).toBe(true);
    expect(combatStats([c("squat", 1000, 1000)])[0]).toEqual({ atq: 1000, def: 1000 });
  });
});

describe("combats : manches", () => {
  it("le triangle donne +20 % à la carte en avantage", () => {
    // pecs bat épaules ; mêmes stats : les pecs gagnent toujours la manche
    const r = resolveDuel([c("developpe-couche")], [c("developpe-militaire")], seededRng(1));
    expect(r.rounds[0]!.adv).toBe("me");
    expect(r.rounds[0]!.myAtq).toBe(600);
    expect(r.rounds[0]!.winner).toBe("me");
  });
  it("l'écart d'une manche est plafonné à ±350", () => {
    const r = resolveDuel([c("squat", 1700, 1700)], [c("curl-biceps", 100, 100)], seededRng(2));
    expect(r.rounds[0]!.margin).toBe(DUEL.cap);
  });
  it("3 manches sur 5 gagnent le duel ; un deck bien plus fort gagne presque toujours", () => {
    const strong = ["squat", "developpe-couche", "curl-biceps", "rowing-barre", "gainage"].map((s) => c(s, 1500, 1500));
    const weak = ["hip-thrust", "developpe-incline", "curl-marteau", "tirage-vertical", "crunch-poulie"].map((s) => c(s, 300, 300));
    let wins = 0;
    for (let i = 0; i < 200; i++) if (resolveDuel(strong, weak, seededRng(i)).outcome === "win") wins++;
    expect(wins).toBe(200);
  });
  it("entre decks égaux, le résultat reste ouvert (hasard ± 10 %)", () => {
    const deck = ["squat", "developpe-couche", "curl-biceps", "rowing-barre", "gainage"].map((s) => c(s, 800, 800));
    const rng = seededRng(5);
    let wins = 0;
    for (let i = 0; i < 2000; i++) if (resolveDuel(deck, deck, rng).outcome === "win") wins++;
    expect(wins / 2000).toBeGreaterThan(0.4);
    expect(wins / 2000).toBeLessThan(0.6);
  });
});

describe("combats : adversaires et limites", () => {
  it("l'adversaire a une puissance proche (± 25 %) et 5 exercices différents", () => {
    const rng = seededRng(11);
    for (const power of [1500, 3000, 6000, 9000, 14000]) {
      for (let k = 0; k < 30; k++) {
        const o = makeOpponent(rng, power);
        expect(new Set(o.cards.map((x) => x.exerciseSlug)).size).toBe(5);
        expect(o.power).toBe(deckPower(o.cards));
        expect(o.power / power).toBeGreaterThan(1 - DUEL.matchBand);
        expect(o.power / power).toBeLessThan(1 + DUEL.matchBand);
      }
    }
  });
  it("3 duels par jour, +2 avec la séance ; victoire : +5 GC et +3 points", () => {
    const day = "2026-10-14";
    let s: PlayerState = normalize({ ...createAccount(), cards: ["squat", "developpe-couche", "curl-biceps", "rowing-barre", "gainage"].map((sl, i) => owned(i, sl, 1700, 1700)) }, seededRng(1), day, finalRank);
    s = { ...s, deck: s.cards.map((x) => x.id) };
    expect(duelsLeft(s, day)).toBe(DUEL.daily);
    const weak = { key: "w", name: "Test", cards: ["hip-thrust", "developpe-incline", "curl-marteau", "tirage-vertical", "crunch-poulie"].map((sl) => c(sl, 200, 200)), power: 2000 };
    const r = playDuel(s, s.deck, weak, seededRng(3), day, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.outcome).toBe("win");
    expect(r.state.gc).toBe(DUEL.winGc);
    expect(r.state.extra!.season.points).toBe(DUEL.winPts);
    expect(duelsLeft(r.state, day)).toBe(DUEL.daily - 1);
    let t = r.state;
    for (let i = 0; i < 2; i++) { const x = playDuel(t, t.deck, weak, seededRng(i), day, 0); if (x.ok) t = x.state; }
    expect(duelsLeft(t, day)).toBe(0);
    expect(playDuel(t, t.deck, weak, seededRng(9), day, 0).ok).toBe(false);
    // séance validée : 2 duels de plus
    t = track({ ...t, lastSessionDay: day }, "session", seededRng(1), day, finalRank);
    expect(duelsLeft(t, day)).toBe(DUEL.perSession);
  });
  it("refuse un ordre qui n'est pas le deck", () => {
    const day = "2026-10-14";
    let s: PlayerState = normalize({ ...createAccount(), cards: ["squat", "developpe-couche", "curl-biceps", "rowing-barre", "gainage", "hip-thrust"].map((sl, i) => owned(i, sl)) }, seededRng(1), day, finalRank);
    s = { ...s, deck: s.cards.slice(0, 5).map((x) => x.id) };
    const o = makeOpponent(seededRng(2), deckPower(s.cards.slice(0, 5)));
    expect(playDuel(s, ["d0", "d1", "d2", "d3", "d5"], o, seededRng(1), day, 0).ok).toBe(false);
    expect(playDuel(s, ["d0", "d1", "d2", "d3"], o, seededRng(1), day, 0).ok).toBe(false);
  });
});
