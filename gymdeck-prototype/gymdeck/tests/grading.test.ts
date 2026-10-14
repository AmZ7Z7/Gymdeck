import { describe, expect, it } from "vitest";
import { GRADE_PRICE, GRADE_SLOTS, GRADE_WEIGHTS, GRADES, gradeStatPct } from "../src/lib/config";
import { createAccount, discardCard, duplicateIds, type OwnedCard, type PlayerState } from "../src/lib/game";
import { drawGrade, finishAll, gradeBlocker, gradedStats, revealGrading, submitGrading } from "../src/lib/grading";
import { listCard } from "../src/lib/market";
import { seededRng } from "../src/lib/rng";

const H = 3_600_000;
const card = (i: number, rarity: OwnedCard["rarity"] = "UR", atq = 1000, def = 1000): OwnedCard => ({ id: "c" + i, obtainedSeq: i, exerciseSlug: "squat", rarity, atq, def, passive: null });
const withCards = (gc = 500, cards: OwnedCard[] = [card(1), card(2, "C", 150, 150), card(3, "R", 250, 250), card(4, "LR", 1500, 1500)]): PlayerState =>
  ({ ...createAccount(), gc, cards });

describe("expertise : règles", () => {
  it("la table des notes fait 100 % et respecte les chances validées", () => {
    expect(Object.values(GRADE_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(10000);
    expect(GRADE_WEIGHTS[10]).toBe(150);
    expect(GRADE_WEIGHTS[3]! + GRADE_WEIGHTS[2]! + GRADE_WEIGHTS[1]!).toBe(550);
  });
  it("les tirages suivent la table (200 000 notes)", () => {
    const rng = seededRng(42);
    const n = 200_000;
    const count: Record<number, number> = {};
    for (let i = 0; i < n; i++) { const g = drawGrade(rng); count[g] = (count[g] ?? 0) + 1; }
    for (const g of GRADES) expect(Math.abs(count[g]! / n - GRADE_WEIGHTS[g]! / 10000)).toBeLessThan(0.004);
  });
  it("effets : −1 % (≤ 4), 0 (5 à 7), +1 % (8), +2 % (9), +4 % (10)", () => {
    expect([1, 4, 5, 7, 8, 9, 10].map(gradeStatPct)).toEqual([-1, -1, 0, 0, 1, 2, 4]);
    expect(gradedStats(1000, 950, 10)).toEqual({ atq: 1040, def: 988, pct: 4 });
    expect(gradedStats(150, 151, 3)).toEqual({ atq: 149, def: 149, pct: -1 });
  });
});

describe("expertise : parcours", () => {
  it("paiement, attente de 24 h, puis note appliquée une seule fois", () => {
    const s0 = withCards();
    const r = submitGrading(s0, "c1", seededRng(1), 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.gc).toBe(500 - GRADE_PRICE.UR);
    expect(revealGrading(r.state, "c1", 23 * H).ok).toBe(false);
    const done = revealGrading(r.state, "c1", 24 * H);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.card.grade).toBe(r.job.grade);
    expect(done.state.grading).toHaveLength(0);
    expect(done.card.atq).toBe(gradedStats(1000, 1000, r.job.grade).atq);
    // une seule expertise par carte
    expect(gradeBlocker(done.state, "c1")).toMatch(/déjà/);
  });
  it("refuse sans GC, en double, et au-delà de 3 cartes sur l'établi", () => {
    expect(gradeBlocker(withCards(0), "c1")).toMatch(/manque/);
    let s = withCards(1000, [1, 2, 3, 4, 5].map((i) => card(i, "C", 150, 150)));
    for (let i = 1; i <= GRADE_SLOTS; i++) { const r = submitGrading(s, "c" + i, seededRng(i), 0); expect(r.ok).toBe(true); if (r.ok) s = r.state; }
    expect(submitGrading(s, "c1", seededRng(9), 0).ok).toBe(false);
    expect(gradeBlocker(s, "c5")).toMatch(/plein/);
  });
  it("pendant l'expertise : ni défausse, ni vente, ni nettoyage des doublons", () => {
    const s0 = withCards(500, [card(1, "C", 150, 150), card(2, "C", 120, 120)]);
    const r = submitGrading(s0, "c2", seededRng(3), 0);
    if (!r.ok) throw new Error(r.error);
    expect(discardCard(r.state, "c2").ok).toBe(false);
    expect(listCard(r.state, seededRng(1), "c2", 5, 24, 0).ok).toBe(false);
    expect(duplicateIds(r.state)).not.toContain("c2");
    const f = finishAll(r.state, 1);
    expect(revealGrading(f, "c2", 1).ok).toBe(true);
  });
});
