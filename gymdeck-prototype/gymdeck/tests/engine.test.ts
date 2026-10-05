import { describe, expect, it } from "vitest";
import { DISCARD_GC, NORMAL_WEIGHTS, PASSIVE_TENTHS, STAT_RANGE, WELCOME2_WEIGHTS } from "../src/lib/config";
import { deckTotals, drawPassive, makeCard, openBooster, validateDeck, type CardData } from "../src/lib/engine";
import { seededRng, type Rng } from "../src/lib/rng";

/** RNG qui renvoie toujours la borne basse : tout est « C », exercice n°0, stats minimales. */
const lowRng: Rng = { int: (min) => min };
/** RNG qui renvoie toujours la borne haute. */
const highRng: Rng = { int: (_min, max) => max };

describe("tables de probabilités", () => {
  it("somment à 100 %", () => {
    expect(Object.values(NORMAL_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(10000);
    expect(Object.values(WELCOME2_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(10000);
  });
});

describe("cartes", () => {
  it("respectent les fourchettes de stats et les passifs", () => {
    const rng = seededRng(1);
    for (const r of ["C", "R", "SR", "SSR", "UR", "LR"] as const) {
      for (let i = 0; i < 500; i++) {
        const c = makeCard(rng, r);
        expect(c.atq).toBeGreaterThanOrEqual(STAT_RANGE[r].min);
        expect(c.atq).toBeLessThanOrEqual(STAT_RANGE[r].max);
        expect(c.def).toBeGreaterThanOrEqual(STAT_RANGE[r].min);
        expect(c.def).toBeLessThanOrEqual(STAT_RANGE[r].max);
        expect(c.passive !== null).toBe(r === "UR" || r === "LR");
      }
    }
  });

  it("passifs : bornes par type, ATQ seule / DEF seule / les deux", () => {
    const rng = seededRng(2);
    for (const r of ["UR", "LR"] as const) {
      const cfg = PASSIVE_TENTHS[r];
      const types = new Set<string>();
      for (let i = 0; i < 2000; i++) {
        const p = drawPassive(rng, r);
        types.add(p.type);
        if (p.type === "ATQ") {
          expect(p.defTenths).toBe(0);
          expect(p.atqTenths).toBeGreaterThanOrEqual(cfg.single.min);
          expect(p.atqTenths).toBeLessThanOrEqual(cfg.single.max);
        } else if (p.type === "DEF") {
          expect(p.atqTenths).toBe(0);
          expect(p.defTenths).toBeGreaterThanOrEqual(cfg.single.min);
          expect(p.defTenths).toBeLessThanOrEqual(cfg.single.max);
        } else {
          for (const v of [p.atqTenths, p.defTenths]) {
            expect(v).toBeGreaterThanOrEqual(cfg.both.min);
            expect(v).toBeLessThanOrEqual(cfg.both.max);
          }
        }
      }
      expect(types.size).toBe(3);
    }
  });

  it("bornes extrêmes atteintes (UR/LR)", () => {
    expect(makeCard(lowRng, "LR").atq).toBe(1300);
    expect(makeCard(highRng, "LR").atq).toBe(1700);
    expect(drawPassive(lowRng, "UR")).toEqual({ type: "ATQ", atqTenths: 20, defTenths: 0 });
    expect(drawPassive(highRng, "LR")).toEqual({ type: "BOTH", atqTenths: 35, defTenths: 35 });
  });
});

describe("booster", () => {
  it("contient 5 cartes", () => {
    expect(openBooster(seededRng(3), "shop", 0).cards).toHaveLength(5);
  });

  it("garantie R+ : cinq C → une devient R", () => {
    const res = openBooster(lowRng, "session", 0);
    expect(res.rPlusTriggered).toBe(true);
    expect(res.cards.filter((c) => c.rarity === "R")).toHaveLength(1);
    expect(res.cards.filter((c) => c.rarity === "C")).toHaveLength(4);
  });

  it("pity : le 12e booster sans UR/LR garantit une UR et remet le compteur à zéro", () => {
    const res = openBooster(lowRng, "shop", 11);
    expect(res.pityTriggered).toBe(true);
    expect(res.cards.filter((c) => c.rarity === "UR")).toHaveLength(1);
    expect(res.cards.some((c) => c.passive)).toBe(true);
    expect(res.pityAfter).toBe(0);
    expect(res.rPlusTriggered).toBe(false);
  });

  it("pity : au 11e booster (compteur 10) rien n'est garanti, le compteur monte", () => {
    const res = openBooster(lowRng, "shop", 10);
    expect(res.pityTriggered).toBe(false);
    expect(res.cards.some((c) => c.rarity === "UR")).toBe(false);
    expect(res.pityAfter).toBe(11);
  });

  it("pity : une UR ou LR naturelle remet le compteur à zéro, sans garantie", () => {
    // Tirage de 0 → C ; on force un LR en faisant renvoyer 9999 (≥ somme des poids avant LR).
    const res = openBooster(highRng, "shop", 5);
    expect(res.cards.every((c) => c.rarity === "LR")).toBe(true);
    expect(res.pityAfter).toBe(0);
    expect(res.pityTriggered).toBe(false);
  });

  it("le 2e booster de bienvenue utilise les probabilités améliorées", () => {
    // Tirage 2900 : amélioré → R (2900 ≥ 2840) ; normal → C (2900 < 4200).
    // On lit la carte n°2 : la carte n°1 peut être remplacée par la garantie R+ en normal (5 C).
    const rng: Rng = { int: (min, max) => (max === 9999 ? 2900 : min) };
    expect(openBooster(rng, "welcome2", 0).cards[1]!.rarity).toBe("R");
    expect(openBooster(rng, "shop", 0).cards[1]!.rarity).toBe("C");
  });
});

describe("deck", () => {
  const card = (slug: string, atq: number, def: number, passive: CardData["passive"] = null): CardData => ({
    exerciseSlug: slug, rarity: passive ? "UR" : "R", atq, def, passive,
  });

  it("refuse deux exemplaires du même exercice, toutes raretés confondues", () => {
    expect(validateDeck([card("a", 1, 1), card("a", 2, 2)])).not.toBeNull();
    expect(validateDeck([card("a", 1, 1), card("b", 2, 2)])).toBeNull();
  });

  it("refuse plus de 5 cartes", () => {
    expect(validateDeck(["a", "b", "c", "d", "e", "f"].map((s) => card(s, 1, 1)))).not.toBeNull();
  });

  it("cumul additif des passifs sur les stats de base, porteuse comprise", () => {
    const deck = [
      card("a", 1000, 1000, { type: "ATQ", atqTenths: 30, defTenths: 0 }), // +3 % ATQ
      card("b", 500, 500, { type: "BOTH", atqTenths: 15, defTenths: 20 }), // +1,5 % ATQ, +2 % DEF
      card("c", 500, 500),
    ];
    const t = deckTotals(deck);
    expect(t.baseAtq).toBe(2000);
    expect(t.bonusAtqPct).toBe(4.5);
    expect(t.bonusDefPct).toBe(2);
    expect(t.totalAtq).toBe(2090); // 2000 × 1,045
    expect(t.totalDef).toBe(2040); // 2000 × 1,02
  });
});

it("montants de défausse", () => {
  expect(DISCARD_GC).toEqual({ C: 1, R: 2, SR: 4, SSR: 6, UR: 12, LR: 25 });
});
