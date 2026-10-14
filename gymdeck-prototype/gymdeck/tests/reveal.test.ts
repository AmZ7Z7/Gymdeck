import { describe, expect, it } from "vitest";
import { revealOrder } from "../src/lib/engine";

describe("ordre de révélation du booster", () => {
  it("met la carte la plus rare en 5e et garde l'ordre des autres", () => {
    const cards = [
      { rarity: "R" as const, atq: 200, def: 200 },
      { rarity: "UR" as const, atq: 900, def: 900 },
      { rarity: "C" as const, atq: 100, def: 100 },
      { rarity: "SR" as const, atq: 300, def: 300 },
      { rarity: "C" as const, atq: 120, def: 90 },
    ];
    expect(revealOrder(cards)).toEqual([0, 2, 3, 4, 1]);
  });
  it("à rareté égale, la plus forte passe en dernier", () => {
    const cards = [
      { rarity: "SSR" as const, atq: 700, def: 600 },
      { rarity: "SSR" as const, atq: 750, def: 640 },
      { rarity: "C" as const, atq: 100, def: 100 },
    ];
    expect(revealOrder(cards)).toEqual([0, 2, 1]);
  });
});
