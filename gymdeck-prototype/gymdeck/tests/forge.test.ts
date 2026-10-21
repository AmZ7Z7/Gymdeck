import { describe, expect, it } from "vitest";
import {
  EXERCISES, LR_PITY_THRESHOLD, NORMAL_WEIGHTS, SESSION_WEIGHTS, SHARDS_CRAFT, SHARDS_DISCARD, STAT_RANGE, STREAK_BOOSTER_EVERY, WELCOME2_WEIGHTS,
} from "../src/lib/config";
import { openBooster, weightsFor } from "../src/lib/engine";
import { craftCard, createAccount, discardCard, discardMany, openPendingBooster, type OwnedCard, type PlayerState } from "../src/lib/game";
import { track } from "../src/lib/progress";
import { finalRank } from "../src/lib/social";
import { seededRng, type Rng } from "../src/lib/rng";

/** RNG qui renvoie toujours la borne basse : tout est « C », exercice n°0, stats minimales. */
const lowRng: Rng = { int: (min) => min };

const card = (o: Partial<OwnedCard> = {}): OwnedCard =>
  ({ id: "c1", obtainedSeq: 1, exerciseSlug: EXERCISES[0]!.slug, rarity: "SR", atq: 400, def: 400, passive: null, ...o });

describe("booster de séance amélioré", () => {
  it("a sa propre table : SR et SSR en hausse, UR et LR inchangées", () => {
    expect(Object.values(SESSION_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(10000);
    expect(weightsFor("session")).toBe(SESSION_WEIGHTS);
    expect(weightsFor("shop")).toBe(NORMAL_WEIGHTS);
    expect(weightsFor("streak")).toBe(WELCOME2_WEIGHTS);
    expect(SESSION_WEIGHTS.SR).toBeGreaterThan(NORMAL_WEIGHTS.SR);
    expect(SESSION_WEIGHTS.SSR).toBeGreaterThan(NORMAL_WEIGHTS.SSR);
    expect(SESSION_WEIGHTS.UR).toBe(NORMAL_WEIGHTS.UR);
    expect(SESSION_WEIGHTS.LR).toBe(NORMAL_WEIGHTS.LR);
  });
});

describe("garantie LR", () => {
  it(`le ${LR_PITY_THRESHOLD}e booster d'affilée sans LR en contient forcément une`, () => {
    const before = openBooster(lowRng, "shop", 0, undefined, LR_PITY_THRESHOLD - 2);
    expect(before.cards.some((c) => c.rarity === "LR")).toBe(false);
    expect(before.lrPityAfter).toBe(LR_PITY_THRESHOLD - 1);

    const res = openBooster(lowRng, "shop", 0, undefined, LR_PITY_THRESHOLD - 1);
    expect(res.lrPityTriggered).toBe(true);
    expect(res.cards.filter((c) => c.rarity === "LR")).toHaveLength(1);
    expect(res.lrPityAfter).toBe(0);
    // une LR compte aussi pour la garantie UR
    expect(res.pityAfter).toBe(0);
  });

  it("le compteur suit la partie et repart de zéro sur les anciennes sauvegardes", () => {
    const s = createAccount();
    expect(s.lrPityCounter).toBeUndefined();
    const r = openPendingBooster(s, s.boosters[0]!.id, lowRng);
    expect(r.ok && r.state.lrPityCounter).toBe(1);
  });
});

describe("booster de série", () => {
  it(`tous les ${STREAK_BOOSTER_EVERY} jours de série, un booster bonus`, () => {
    let s: PlayerState = createAccount();
    const rng = seededRng(1);
    const day = (n: number) => `2026-10-${String(n).padStart(2, "0")}`;
    for (let d = 1; d <= STREAK_BOOSTER_EVERY - 1; d++) s = track(s, "session", rng, day(d), finalRank);
    expect(s.boosters.filter((b) => b.kind === "streak")).toHaveLength(0);
    s = track(s, "session", rng, day(STREAK_BOOSTER_EVERY), finalRank);
    expect(s.boosters.filter((b) => b.kind === "streak")).toHaveLength(1);
    // une 2e séance le même jour ne redonne rien
    s = track(s, "session", rng, day(STREAK_BOOSTER_EVERY), finalRank);
    expect(s.boosters.filter((b) => b.kind === "streak")).toHaveLength(1);
  });
});

describe("Forge", () => {
  it("la défausse rapporte des éclats selon la rareté", () => {
    const s: PlayerState = { ...createAccount(), cards: [card({ rarity: "UR" })] };
    const r = discardCard(s, "c1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shards).toBe(SHARDS_DISCARD.UR);
    expect(r.state.shards).toBe(SHARDS_DISCARD.UR);
    const m = discardMany({ ...createAccount(), shards: 5, cards: [card({ id: "a", rarity: "C" }), card({ id: "b", rarity: "R" })] }, ["a", "b"]);
    expect(m.ok && m.state.shards).toBe(5 + SHARDS_DISCARD.C + SHARDS_DISCARD.R);
  });

  it("fabrique la carte choisie et dépense les éclats", () => {
    const slug = EXERCISES[5]!.slug;
    const s: PlayerState = { ...createAccount(), shards: SHARDS_CRAFT.LR + 7 };
    const r = craftCard(s, slug, "LR", seededRng(4));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.card.exerciseSlug).toBe(slug);
    expect(r.card.rarity).toBe("LR");
    expect(r.card.passive).not.toBeNull();
    expect(r.card.atq).toBeGreaterThanOrEqual(STAT_RANGE.LR.min);
    expect(r.card.atq).toBeLessThanOrEqual(STAT_RANGE.LR.max);
    expect(r.state.shards).toBe(7);
    expect(r.state.cards).toHaveLength(1);
  });

  it("refuse sans assez d'éclats, ou pour un exercice inconnu", () => {
    const s: PlayerState = { ...createAccount(), shards: SHARDS_CRAFT.SR - 1 };
    const r = craftCard(s, EXERCISES[0]!.slug, "SR", seededRng(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("1 éclat");
    expect(craftCard({ ...s, shards: 99999 }, "exercice-inconnu", "C", seededRng(1)).ok).toBe(false);
  });
});
