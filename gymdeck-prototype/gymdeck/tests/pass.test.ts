import { describe, expect, it } from "vitest";
import { COMMUNITY_GC, PASS, PASS_REWARDS } from "../src/lib/config";
import { createAccount, type PlayerState } from "../src/lib/game";
import { addPassXp, challengeState, claimChallenge, claimMission, claimPass, normalize, passClaimable, passLevel, passOf, track } from "../src/lib/progress";
import { finalRank } from "../src/lib/social";
import { seededRng } from "../src/lib/rng";

const day = "2026-10-15";
const fresh = (): PlayerState => normalize({ ...createAccount(), boosters: [] }, seededRng(1), day, finalRank);

describe("passe de saison", () => {
  it("30 paliers : GC partout, un booster tous les 5, 2 boosters au 30e", () => {
    expect(PASS_REWARDS).toHaveLength(30);
    expect(PASS_REWARDS.filter((r) => r.boosters > 0).map((r) => r.tier)).toEqual([5, 10, 15, 20, 25, 30]);
    expect(PASS_REWARDS[29]).toEqual({ tier: 30, gc: 0, boosters: 2 });
    expect(PASS_REWARDS.filter((r) => !r.boosters).every((r) => r.gc > 0)).toBe(true);
  });
  it("130 points par palier ; séance +100, mission du jour +20", () => {
    expect(passLevel(129).level).toBe(0);
    expect(passLevel(130)).toMatchObject({ level: 1, inTier: 0 });
    expect(passLevel(99999).level).toBe(30);
    let s = fresh();
    s = track({ ...s, lastSessionDay: day }, "session", seededRng(1), day, finalRank);
    expect(passOf(s.extra!, day).xp).toBe(PASS.session);
    const r = claimMission(s, "daily", "d-session", day);
    expect(r.ok).toBe(true);
    if (r.ok) expect(passOf(r.state.extra!, day).xp).toBe(PASS.session + PASS.dailyMission);
  });
  it("récupérer : GC et boosters, une seule fois ; le passe repart à zéro le mois suivant", () => {
    let s = fresh();
    s = { ...s, extra: addPassXp(s.extra!, 5 * PASS.perTier, day) };
    expect(passClaimable(s.extra!, day)).toEqual([1, 2, 3, 4, 5]);
    const r = claimPass(s, day);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.gc).toBe(40);
    expect(r.boosters).toBe(1);
    expect(r.state.boosters.filter((b) => b.kind === "pass")).toHaveLength(1);
    expect(claimPass(r.state, day).ok).toBe(false);
    const next = normalize(r.state, seededRng(2), "2026-11-01", finalRank);
    expect(passOf(next.extra!, "2026-11-01").xp).toBe(0);
  });
});

describe("défi de la semaine", () => {
  it("la communauté avance au fil de la semaine ; il faut participer pour être récompensé", () => {
    const s = fresh();
    const monday = Date.parse("2026-10-12T08:00:00+02:00");
    const sunday = Date.parse("2026-10-18T20:00:00+02:00");
    const a = challengeState(s.extra!, "2026-10-12", monday);
    const b = challengeState(s.extra!, "2026-10-18", sunday);
    expect(a.value).toBeLessThan(b.value);
    expect(b.done).toBe(true);
    expect(b.claimable).toBe(false);
    expect(claimChallenge(s, "2026-10-18", sunday).ok).toBe(false);
    const c = b.challenge;
    let t = s;
    for (const k of c.kinds.slice(0, 1)) t = track(t, k, seededRng(3), "2026-10-18", finalRank);
    const r = claimChallenge(t, "2026-10-18", sunday);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.gc).toBe(t.gc + COMMUNITY_GC);
    expect(passOf(r.state.extra!, "2026-10-18").xp - passOf(t.extra!, "2026-10-18").xp).toBe(PASS.weeklyChallenge);
    expect(claimChallenge(r.state, "2026-10-18", sunday).ok).toBe(false);
  });
});
