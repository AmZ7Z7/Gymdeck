import { describe, expect, it } from "vitest";
import {
  buyBooster, claimLogin, createAccount, discardCard, openPendingBooster, parisDay, setDeck, validateSession,
  type PlayerState,
} from "../src/lib/game";
import { seededRng } from "../src/lib/rng";

const d = (iso: string) => new Date(iso);
const ok = <T extends { ok: boolean }>(r: T) => {
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r as Extract<T, { ok: true }>;
};

describe("compte", () => {
  it("démarre à 0 GC avec deux boosters de bienvenue (normal puis amélioré)", () => {
    const s = createAccount();
    expect(s.gc).toBe(0);
    expect(s.boosters.map((b) => b.kind)).toEqual(["welcome1", "welcome2"]);
  });
});

describe("booster de séance : un par jour, reset à minuit heure de Paris", () => {
  it("refuse un 2e booster le même jour, accepte le lendemain", () => {
    let s = createAccount();
    s = ok(validateSession(s, d("2026-10-05T10:00:00Z"))).state;
    expect(validateSession(s, d("2026-10-05T15:00:00Z")).ok).toBe(false);
    s = ok(validateSession(s, d("2026-10-06T08:00:00Z"))).state;
    expect(s.boosters.filter((b) => b.kind === "session")).toHaveLength(2);
    expect(s.sessionsValidated).toBe(2);
  });

  it("la frontière est minuit à Paris (heure d'été UTC+2, puis d'hiver UTC+1)", () => {
    // 23:59 Paris le 5 oct. (été) = 21:59Z ; minuit Paris = 22:00Z
    expect(parisDay(d("2026-10-05T21:59:00Z"))).toBe("2026-10-05");
    expect(parisDay(d("2026-10-05T22:00:00Z"))).toBe("2026-10-06");
    // Hiver : minuit Paris = 23:00Z
    expect(parisDay(d("2026-12-05T22:59:00Z"))).toBe("2026-12-05");
    expect(parisDay(d("2026-12-05T23:00:00Z"))).toBe("2026-12-06");
  });
});

describe("connexion quotidienne", () => {
  it("5 GC par jour, une fois par jour", () => {
    let s = createAccount();
    s = ok(claimLogin(s, d("2026-10-05T10:00:00Z"))).state;
    expect(s.gc).toBe(5);
    expect(claimLogin(s, d("2026-10-05T20:00:00Z")).ok).toBe(false);
  });

  it("7e connexion cumulée (non consécutive) : +5 GC ET un booster, puis nouveau cycle", () => {
    let s: PlayerState = createAccount();
    // 7 jours espacés (pas consécutifs)
    const days = [5, 7, 8, 12, 15, 20, 21].map((n) => d(`2026-10-${String(n).padStart(2, "0")}T10:00:00Z`));
    days.forEach((day, i) => {
      const r = ok(claimLogin(s, day));
      s = r.state;
      expect(r.bonusBooster).toBe(i === 6);
    });
    expect(s.gc).toBe(35);
    expect(s.boosters.filter((b) => b.kind === "login")).toHaveLength(1);
    // 8e connexion : nouveau cycle, pas de booster
    const r8 = ok(claimLogin(s, d("2026-10-22T10:00:00Z")));
    expect(r8.bonusBooster).toBe(false);
    expect(r8.state.loginCount).toBe(8);
  });
});

describe("boutique", () => {
  it("booster à 75 GC, refus si solde insuffisant", () => {
    const s = { ...createAccount(), gc: 74 };
    expect(buyBooster(s).ok).toBe(false);
    const s2 = ok(buyBooster({ ...s, gc: 75 })).state;
    expect(s2.gc).toBe(0);
    expect(s2.boosters.at(-1)!.kind).toBe("shop");
  });

  it("pas de limite quotidienne d'achat tant que le solde suffit", () => {
    let s = { ...createAccount(), gc: 225 };
    for (let i = 0; i < 3; i++) s = ok(buyBooster(s)).state;
    expect(s.gc).toBe(0);
  });
});

describe("ouverture", () => {
  it("enregistre 5 cartes, consomme le booster, met à jour le pity", () => {
    const s0 = createAccount();
    const s0Copy = JSON.stringify(s0);
    const r = ok(openPendingBooster(s0, s0.boosters[0]!.id, seededRng(7)));
    expect(r.cards).toHaveLength(5);
    expect(r.state.cards).toHaveLength(5);
    expect(r.state.boosters).toHaveLength(1);
    expect(JSON.stringify(s0)).toBe(s0Copy); // état d'origine non muté
    expect(openPendingBooster(r.state, s0.boosters[0]!.id, seededRng(7)).ok).toBe(false); // pas de relance
  });

  it("tous les boosters comptent pour le pity (bienvenue compris) : garantie au 12e", () => {
    let s = createAccount();
    s = { ...s, boosters: Array.from({ length: 300 }, (_, i) => ({ id: `b${i}`, kind: "shop" as const })) };
    const rng = seededRng(99);
    let sinceTop = 0;
    for (let i = 0; i < 300; i++) {
      const r = ok(openPendingBooster(s, `b${i}`, rng));
      s = r.state;
      sinceTop = r.cards.some((c) => c.rarity === "UR" || c.rarity === "LR") ? 0 : sinceTop + 1;
      expect(sinceTop).toBeLessThanOrEqual(11);
    }
  });
});

describe("défausse et deck", () => {
  function withCards() {
    let s = createAccount();
    s = ok(openPendingBooster(s, s.boosters[0]!.id, seededRng(11))).state;
    return s;
  }

  it("défausse : rapporte les GC de la rareté, refusée si la carte est dans le deck", () => {
    let s = withCards();
    const c = s.cards[0]!;
    s = ok(setDeck(s, [c.id])).state;
    expect(discardCard(s, c.id).ok).toBe(false);
    const other = s.cards[1]!;
    const gcBefore = s.gc;
    const r = ok(discardCard(s, other.id));
    expect(r.gained).toBeGreaterThan(0);
    expect(r.state.gc).toBe(gcBefore + r.gained);
    expect(r.state.cards.find((x) => x.id === other.id)).toBeUndefined();
  });

  it("deck : un seul exemplaire par exercice", () => {
    let s = withCards();
    // Force deux cartes du même exercice
    s = { ...s, cards: s.cards.map((c, i) => (i < 2 ? { ...c, exerciseSlug: "x" } : c)) };
    expect(setDeck(s, [s.cards[0]!.id, s.cards[1]!.id]).ok).toBe(false);
  });
});

import { autoDeck, completion, discardMany, duplicateIds, msUntilParisMidnight, setName } from "../src/lib/game";
import { deckPower } from "../src/lib/engine";

describe("pseudo", () => {
  it("accepte un pseudo propre, refuse trop court, tronque à 20", () => {
    const s = createAccount();
    expect(ok(setName(s, "  Adrien  ")).state.name).toBe("Adrien");
    expect(setName(s, "A").ok).toBe(false);
    expect(ok(setName(s, "x".repeat(40))).state.name).toHaveLength(20);
  });
});

describe("deck automatique", () => {
  const mk = (id: string, slug: string, rarity: "C" | "R" | "SR" | "SSR" | "UR" | "LR", atq: number, def: number, passive: any = null) =>
    ({ id, obtainedSeq: 0, exerciseSlug: slug, rarity, atq, def, passive } as any);

  it("prend un seul exemplaire par exercice, le meilleur, et jamais plus de 5 cartes", () => {
    const s = { ...createAccount(), cards: [
      mk("a1", "a", "C", 100, 100), mk("a2", "a", "SR", 500, 500),
      mk("b1", "b", "R", 300, 300), mk("c1", "c", "R", 250, 250), mk("d1", "d", "SSR", 700, 700),
      mk("e1", "e", "C", 150, 150), mk("f1", "f", "C", 120, 120), mk("g1", "g", "C", 110, 110),
    ] };
    const deck = ok(autoDeck(s)).state.deck;
    expect(deck).toHaveLength(5);
    expect(deck).toContain("a2");
    expect(deck).not.toContain("a1");
    expect(new Set(deck.map((id) => s.cards.find((c) => c.id === id)!.exerciseSlug)).size).toBe(5);
  });

  it("un passif puissant peut l'emporter sur des stats brutes un peu plus hautes", () => {
    const s = { ...createAccount(), cards: [
      mk("x1", "x", "UR", 900, 900, { type: "BOTH", atqTenths: 20, defTenths: 20 }),
      mk("x2", "x", "UR", 1000, 1000, null),
      mk("y1", "y", "SSR", 800, 800), mk("z1", "z", "SSR", 800, 800), mk("w1", "w", "SSR", 800, 800), mk("v1", "v", "SSR", 800, 800),
    ] };
    const deck = ok(autoDeck(s)).state.deck;
    const chosen = deck.map((id) => s.cards.find((c) => c.id === id)!);
    const alt = chosen.map((c) => (c.id === "x1" ? s.cards.find((k) => k.id === "x2")! : c));
    expect(deckPower(chosen)).toBeGreaterThanOrEqual(deckPower(alt));
  });

  it("refuse si la collection est vide", () => {
    expect(autoDeck(createAccount()).ok).toBe(false);
  });
});

describe("doublons", () => {
  const mk = (id: string, slug: string, rarity: any, atq: number, def: number) => ({ id, obtainedSeq: 0, exerciseSlug: slug, rarity, atq, def, passive: null } as any);

  it("garde la meilleure carte par exercice+rareté, jamais une carte du deck, et crédite les GC", () => {
    let s = { ...createAccount(), cards: [mk("a", "x", "R", 300, 300), mk("b", "x", "R", 250, 250), mk("c", "x", "R", 220, 220), mk("d", "x", "SR", 400, 400)] };
    expect(duplicateIds(s).sort()).toEqual(["b", "c"]);
    s = { ...s, deck: ["c"] }; // la carte du deck est conservée en priorité
    expect(duplicateIds(s).sort()).toEqual(["a", "b"]);
    const r = ok(discardMany(s, ["a", "b", "c"]));
    expect(r.count).toBe(2); // « c » est dans le deck
    expect(r.gained).toBe(4); // 2 × 2 GC (R)
    expect(r.state.cards.map((c) => c.id).sort()).toEqual(["c", "d"]);
  });

  it("complétion : couples exercice+rareté distincts", () => {
    const s = { ...createAccount(), cards: [mk("a", "x", "R", 1, 1), mk("b", "x", "R", 2, 2), mk("c", "y", "R", 1, 1)] };
    expect(completion(s)).toEqual({ owned: 2, total: 192 });
  });
});

describe("minuit à Paris", () => {
  it("compte les millisecondes restantes avant le reset", () => {
    // 21:00Z = 23:00 Paris (été) → 1 h restante
    expect(msUntilParisMidnight(new Date("2026-10-05T21:00:00Z"))).toBe(3600_000);
    // 22:00Z = minuit pile → 24 h restantes
    expect(msUntilParisMidnight(new Date("2026-10-05T22:00:00Z"))).toBe(86400_000);
  });
});
