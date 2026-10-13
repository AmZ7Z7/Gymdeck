import { describe, expect, it } from "vitest";
import { createAccount, type OwnedCard, type PlayerState } from "../src/lib/game";
import {
  ACHIEVEMENTS, STREAK_MILESTONES, WEEKLY, claimAchievement, claimMission, claimSet, claimSeason, claimStreak, claimableCount, dailyMissions,
  normalize, seasonOf, setProgress, streakNow, track, weekOf, daysBetween, toggleDeclaredDay, trainingDays, monthStats,
} from "../src/lib/progress";
import { BOTS, addFriend, botOffers, finalRank, leaderboard, normalizeState, proposeTrade, toggleShowcase } from "../src/lib/social";
import { fairValue } from "../src/lib/market";
import { seededRng } from "../src/lib/rng";

const rng = seededRng(7);
const ranker = finalRank;
const card = (i: number, slug: string, rarity: OwnedCard["rarity"], atq = 150, def = 150): OwnedCard => ({ id: "c" + i, obtainedSeq: i, exerciseSlug: slug, rarity, atq, def, passive: null });
const base = (): PlayerState => normalizeState(createAccount(), rng, "2026-10-13");

describe("dates", () => {
  it("semaine commence le lundi", () => { expect(weekOf("2026-10-13")).toBe("2026-10-12"); expect(weekOf("2026-10-11")).toBe("2026-10-05"); });
  it("écart de jours", () => { expect(daysBetween("2026-10-13", "2026-10-15")).toBe(2); expect(seasonOf("2026-10-13")).toBe("2026-10"); });
});

describe("série de séances", () => {
  it("monte avec 1 jour de repos toléré et retombe après 2 jours de repos", () => {
    let s = base();
    s = track(s, "session", rng, "2026-10-13", ranker);
    s = track(s, "session", rng, "2026-10-15", ranker); // 1 jour de repos
    expect(s.extra!.streak.current).toBe(2);
    s = track(s, "session", rng, "2026-10-19", ranker); // 3 jours de repos : repart à 1
    expect(s.extra!.streak.current).toBe(1);
    expect(s.extra!.streak.best).toBe(2);
    expect(streakNow(s.extra!, "2026-10-22")).toBe(0);
  });
  it("palier récupérable une seule fois", () => {
    let s = base();
    for (const d of ["2026-10-13", "2026-10-14", "2026-10-15"]) s = track(s, "session", rng, d, ranker);
    const r = claimStreak(s, 3, "2026-10-15");
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.state.gc).toBe(STREAK_MILESTONES[0]!.reward); expect(claimStreak(r.state, 3, "2026-10-15").ok).toBe(false); }
    expect(claimStreak(s, 7, "2026-10-15").ok).toBe(false);
  });
});

describe("missions", () => {
  it("3 missions par jour, dont la séance, stables pour une date", () => {
    const m = dailyMissions("2026-10-13");
    expect(m).toHaveLength(3);
    expect(m[0]!.id).toBe("d-session");
    expect(new Set(m.map((x) => x.id)).size).toBe(3);
    expect(dailyMissions("2026-10-13")).toEqual(m);
  });
  it("récompense après progression, une seule fois, et remise à zéro le lendemain", () => {
    let s = base();
    expect(claimMission(s, "daily", "d-session", "2026-10-13").ok).toBe(false);
    s = track(s, "session", rng, "2026-10-13", ranker);
    const r = claimMission(s, "daily", "d-session", "2026-10-13");
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.state.gc).toBe(6); expect(claimMission(r.state, "daily", "d-session", "2026-10-13").ok).toBe(false); }
    const next = normalize(s, rng, "2026-10-14", ranker);
    expect(next.extra!.daily.session ?? 0).toBe(0);
    expect(next.extra!.weekly.session).toBe(1); // même semaine
    const nw = normalize(s, rng, "2026-10-19", ranker);
    expect(nw.extra!.weekly.session ?? 0).toBe(0);
  });
  it("hebdo : 3 séances", () => {
    let s = base();
    for (const d of ["2026-10-13", "2026-10-14", "2026-10-15"]) s = track(s, "session", rng, d, ranker);
    expect(claimMission(s, "weekly", WEEKLY[0]!.id, "2026-10-15").ok).toBe(true);
  });
});

describe("extensions et succès", () => {
  it("palier Découverte du groupe pecs", () => {
    let s = base();
    s = { ...s, cards: [card(1, "developpe-couche", "C")] };
    expect(setProgress(s, "pecs", "C").done).toBe(false);
    s = { ...s, cards: [...s.cards, card(2, "developpe-incline", "R")] };
    expect(setProgress(s, "pecs", "C").done).toBe(false);
    s = { ...s, cards: [...s.cards, card(3, "developpe-poitrine-machine", "R")] };
    expect(setProgress(s, "pecs", "C").done).toBe(true);
    expect(setProgress(s, "pecs", "R").done).toBe(false);
    const r = claimSet(s, "pecs", "t1");
    expect(r.ok && r.reward).toBe(15);
    if (r.ok) expect(claimSet(r.state, "pecs", "t1").ok).toBe(false);
  });
  it("succès : débloqué puis récupéré une fois", () => {
    let s = base();
    expect(claimAchievement(s, "a-ur").ok).toBe(false);
    s = { ...s, cards: [card(1, "squat", "UR", 1000, 1000)] };
    const r = claimAchievement(s, "a-ur");
    expect(r.ok).toBe(true);
    if (r.ok) expect(claimAchievement(r.state, "a-ur").ok).toBe(false);
    expect(ACHIEVEMENTS.every((a) => a.target > 0)).toBe(true);
  });
  it("compte les récompenses prêtes", () => {
    let s = base();
    expect(claimableCount(s, "2026-10-13")).toBe(0);
    s = track(s, "session", rng, "2026-10-13", ranker);
    expect(claimableCount(s, "2026-10-13")).toBeGreaterThan(0);
  });
});

describe("amis, vitrine, échanges", () => {
  it("ajoute un ami fictif par son code, refuse le reste", () => {
    const s = base();
    expect(addFriend(s, "n'importe").ok).toBe(false);
    expect(addFriend(s, s.extra!.friendCode).ok).toBe(false);
    const r = addFriend(s, BOTS[0]!.code.toLowerCase());
    expect(r.ok).toBe(true);
    if (r.ok) expect(addFriend(r.state, BOTS[0]!.code).ok).toBe(false);
  });
  it("vitrine limitée à 3", () => {
    let s = base();
    s = { ...s, cards: [1, 2, 3, 4].map((i) => card(i, "squat", "C")) };
    for (const id of ["c1", "c2", "c3"]) { const r = toggleShowcase(s, id); expect(r.ok).toBe(true); if (r.ok) s = r.state; }
    expect(toggleShowcase(s, "c4").ok).toBe(false);
  });
  it("échange : accepté seulement à valeur équivalente, jamais depuis le deck", () => {
    let s = base();
    const f = addFriend(s, BOTS[2]!.code);
    if (!f.ok) throw new Error("ami");
    s = f.state;
    const offers = botOffers(BOTS[2]!, 0);
    const cheapest = offers.reduce((a, b) => (fairValue(a) <= fairValue(b) ? a : b));
    const idx = offers.indexOf(cheapest);
    // une carte nettement plus chère que l'offre : acceptée
    s = { ...s, cards: [{ ...card(1, "squat", "LR", 1700, 1700) }, card(2, "squat", "C", 100, 100)] };
    const ok = proposeTrade(s, BOTS[2]!.id, "c1", idx, 0);
    expect(ok.ok).toBe(true);
    if (ok.ok) { expect(ok.state.cards.some((c) => c.id === "c1")).toBe(false); expect(ok.state.cards).toHaveLength(2); expect(ok.state.extra!.tradeNonce[BOTS[2]!.id]).toBe(1); }
    // carte de très faible valeur contre carte de plus grande valeur : refusée
    const priciest = offers.reduce((a, b) => (fairValue(a) >= fairValue(b) ? a : b));
    if (fairValue(priciest) > fairValue(s.cards[1]!)) expect(proposeTrade(s, BOTS[2]!.id, "c2", offers.indexOf(priciest), 0).ok).toBe(false);
    // deck
    expect(proposeTrade({ ...s, deck: ["c1"] }, BOTS[2]!.id, "c1", idx, 0).ok).toBe(false);
    // limite quotidienne
    expect(proposeTrade(s, BOTS[2]!.id, "c1", idx, 5).ok).toBe(false);
  });
});

describe("saison", () => {
  const deckOf = (): PlayerState => {
    const slugs = ["squat", "hip-thrust", "curl-biceps", "rowing-barre", "developpe-couche"];
    const cards = slugs.map((sl, i) => card(i + 1, sl, "LR", 1700, 1700));
    return { ...base(), cards, deck: cards.map((c) => c.id) };
  };
  it("un deck complet est classé et grimpe au classement", () => {
    let s = deckOf();
    s = track(s, "deck", rng, "2026-10-13", ranker);
    expect(s.extra!.season.bestPower).toBeGreaterThan(0);
    const lb = leaderboard(s, "2026-10-13");
    expect(lb.find((r) => r.me)!.rank).toBeLessThanOrEqual(5);
    expect(lb).toHaveLength(BOTS.length + 1);
  });
  it("sans deck complet : pas classé", () => {
    expect(leaderboard(base(), "2026-10-13").some((r) => r.me)).toBe(false);
  });
  it("changement de mois : la récompense de la saison passée est proposée puis récupérée", () => {
    let s = deckOf();
    s = track(s, "deck", rng, "2026-10-13", ranker);
    const n = normalize(s, rng, "2026-11-02", ranker);
    expect(n.extra!.pendingSeason?.id).toBe("2026-10");
    expect(n.extra!.pendingSeason!.reward).toBeGreaterThan(0);
    const r = claimSeason(n);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.extra!.pendingSeason).toBeNull();
  });
});

describe("calendrier des séances", () => {
  it("une séance validée entre au calendrier, une seule fois par jour", () => {
    let s = base();
    s = track(s, "session", rng, "2026-10-13", ranker);
    s = track(s, "session", rng, "2026-10-13", ranker);
    expect(trainingDays(s.extra)).toEqual(["2026-10-13"]);
  });
  it("on coche / décoche un jour passé sans toucher à la série ni aux GC", () => {
    let s = base();
    const gc = s.gc;
    const on = toggleDeclaredDay(s, "2026-10-10", "2026-10-13");
    expect(on.ok && on.on).toBe(true);
    if (!on.ok) return;
    s = on.state;
    expect(trainingDays(s.extra)).toEqual(["2026-10-10"]);
    expect(s.gc).toBe(gc);
    expect(s.extra!.streak.current).toBe(0);
    const off = toggleDeclaredDay(s, "2026-10-10", "2026-10-13");
    expect(off.ok && off.on).toBe(false);
    if (off.ok) expect(trainingDays(off.state.extra)).toEqual([]);
  });
  it("refuse le futur, les dates invalides, les jours trop anciens et les jours déjà validés", () => {
    let s = base();
    expect(toggleDeclaredDay(s, "2026-10-14", "2026-10-13").ok).toBe(false);
    expect(toggleDeclaredDay(s, "13/10/2026", "2026-10-13").ok).toBe(false);
    expect(toggleDeclaredDay(s, "2024-01-01", "2026-10-13").ok).toBe(false);
    s = track(s, "session", rng, "2026-10-13", ranker);
    expect(toggleDeclaredDay(s, "2026-10-13", "2026-10-13").ok).toBe(false);
  });
  it("statistiques du mois : total et plus longue suite", () => {
    let s = base();
    for (const d of ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-07", "2026-10-08"]) {
      const r = toggleDeclaredDay(s, d, "2026-10-13"); if (r.ok) s = r.state;
    }
    expect(monthStats(s.extra, "2026-10")).toEqual({ count: 5, best: 3 });
    expect(monthStats(s.extra, "2026-09")).toEqual({ count: 0, best: 0 });
  });
});
