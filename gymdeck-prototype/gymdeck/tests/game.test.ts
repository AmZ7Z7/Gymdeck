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
