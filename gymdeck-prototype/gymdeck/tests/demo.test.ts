import { describe, expect, it } from "vitest";
import { RARITIES } from "../src/lib/config";
import { demoState, isDemoPath } from "../src/lib/demo";
import { streakNow } from "../src/lib/progress";
import { seededRng } from "../src/lib/rng";

describe("partie de démonstration", () => {
  const today = "2026-10-30";
  const s = demoState(today, seededRng(42));

  it("une collection avec toutes les raretés et un deck complet", () => {
    const rarities = new Set(s.cards.map((c) => c.rarity));
    for (const r of RARITIES) expect(rarities.has(r)).toBe(true);
    expect(s.cards.length).toBeGreaterThanOrEqual(60);
    expect(s.deck).toHaveLength(5);
    for (const id of s.deck) expect(s.cards.some((c) => c.id === id)).toBe(true);
  });

  it("des boosters à ouvrir, dont une légendaire garantie, et des GC", () => {
    expect(s.boosters).toHaveLength(3);
    expect(s.boosters.some((b) => b.force === "LR")).toBe(true);
    expect(s.gc).toBeGreaterThan(1000);
  });

  it("une série de séances en cours, et la séance du jour encore à valider", () => {
    expect(streakNow(s.extra!, today)).toBeGreaterThanOrEqual(7);
    expect(s.lastSessionDay).not.toBe(today);
    expect(s.extra!.history!.length).toBeGreaterThanOrEqual(15);
    expect(s.extra!.tutorialDone).toBe(true);
  });

  it("l'adresse /demo ouvre la démo, pas les autres pages", () => {
    expect(isDemoPath("/demo")).toBe(true);
    expect(isDemoPath("/")).toBe(false);
    expect(isDemoPath("/mentions-legales")).toBe(false);
  });
});
