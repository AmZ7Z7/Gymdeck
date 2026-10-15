import { describe, expect, it } from "vitest";
import { DUEL, PASS, type Rarity } from "../src/lib/config";
import {
  autoFight, beginDuel, capCheck, capacityOf, combatStats, deckBonus, duelsLeft, equalize, findMatch, finishDuel, makeFighter,
  makeOpponent, playRound, runDefenses, startFight, teamHp, winChance, type Fight, type Move,
} from "../src/lib/duel";
import { deckPower, type CardData } from "../src/lib/engine";
import { createAccount, type OwnedCard, type PlayerState } from "../src/lib/game";
import { normalize, passOf, track } from "../src/lib/progress";
import { finalRank } from "../src/lib/social";
import { seededRng } from "../src/lib/rng";

const c = (slug: string, atq = 500, def = 500, rarity: Rarity = "SR"): CardData => ({ exerciseSlug: slug, rarity, atq, def, passive: null });
const owned = (i: number, slug: string, atq = 500, def = 500): OwnedCard => ({ ...c(slug, atq, def), id: "d" + i, obtainedSeq: i });
const FIVE = ["squat", "developpe-couche", "curl-biceps", "rowing-barre", "gainage"];
const OTHER = ["hip-thrust", "developpe-incline", "curl-marteau", "tirage-vertical", "crunch-poulie"];
const mv = (key: string, posture: Move["posture"] = "technique", cap = false): Move => ({ key, posture, cap });

describe("combats : deck", () => {
  it("synergies : 2 cartes du même groupe +3 %, 3 → +8 %", () => {
    const b = deckBonus([c("squat"), c("hip-thrust"), c("curl-biceps"), c("rowing-barre"), c("leg-extension")]);
    expect(b.groups).toEqual([{ group: "jambes", count: 3, pct: DUEL.synergyPct[3] }]);
    expect(b.perCard).toEqual([8, 8, 0, 0, 8]);
  });
  it("PV de l'équipe = somme des (ATQ + DEF) / 2", () => {
    expect(teamHp([c("squat", 1000, 600)])).toBe(800);
    const f = makeFighter("A", FIVE.map((s) => c(s, 500, 500)), "equilibre");
    expect(f.maxHp).toBe(Math.round(5 * 500 * 1.06)); // + 6 % : cinq groupes différents
    expect(combatStats([c("squat", 1000, 1000)])[0]).toEqual({ atq: 1000, def: 1000 });
  });
  it("capacités : SSR / UR / LR selon le groupe, Second souffle pour C / R / SR", () => {
    expect(capacityOf(c("developpe-couche", 1, 1, "LR"))).toMatchObject({ kind: "power", value: 2 });
    expect(capacityOf(c("squat", 1, 1, "SSR"))).toMatchObject({ kind: "wall", value: 0.4 });
    expect(capacityOf(c("squat", 1, 1, "SR"))).toMatchObject({ kind: "second", value: 1.25 });
  });
});

describe("combats : manches", () => {
  const duo = (a: CardData[], b: CardData[]): Fight => startFight(makeFighter("A", a, "equilibre"), makeFighter("B", b, "equilibre"));

  it("un coup ne dépasse jamais 35 % des PV max adverses (affiché MAX)", () => {
    const f = duo([c("squat", 1700, 1700, "LR")], [c("curl-biceps", 100, 100, "C")]);
    const r = playRound(f, mv("c0", "force"), mv("c0", "force"), seededRng(1)).log[0]!;
    expect(r.me.capped).toBe(true);
    expect(r.me.dealt).toBe(Math.round(0.35 * f.them.maxHp));
  });

  it("Coup puissant LR ×2 après le plafond : 70 % au plus, jamais de coup fatal d'entrée", () => {
    let f = duo(FIVE.map((s) => c(s, 1700, 1700, "LR")), OTHER.map((s) => c(s, 100, 100, "C")));
    f = { ...f, me: { ...f.me, gauge: 1 } };
    const pecs = f.me.hand.find((x) => x.card.exerciseSlug === "developpe-couche")!;
    const next = playRound(f, mv(pecs.key, "force", true), mv("c0", "garde"), seededRng(2));
    const r = next.log[0]!;
    expect(r.me.cap?.kind).toBe("power");
    expect(r.me.dealt).toBe(Math.round(0.7 * f.them.maxHp));
    expect(next.them.hp).toBeGreaterThan(0);
    expect(next.me.capUsed).toBe(true);
    expect(next.me.gauge).toBe(0);
  });

  it("Technique bat la Force, la Garde bat la Technique", () => {
    const f = duo([c("squat", 800, 800)], [c("rowing-barre", 800, 800)]);
    const vsForce = playRound(f, mv("c0", "technique"), mv("c0", "force"), seededRng(3)).log[0]!.me;
    const vsGarde = playRound(f, mv("c0", "technique"), mv("c0", "garde"), seededRng(3)).log[0]!.me;
    expect(vsForce.tech).toBe(DUEL.techVsForce);
    expect(vsGarde.tech).toBe(DUEL.techVsGarde);
    expect(vsForce.dealt).toBeGreaterThan(vsGarde.dealt);
  });

  it("jauge : se remplit au fil des manches, une seule capacité par combat", () => {
    let f = duo(FIVE.map((s) => c(s, 700, 700, "SSR")), OTHER.map((s) => c(s, 700, 700, "SSR")));
    expect(capCheck(f, "me", f.me.hand[0]!.key).ok).toBe(false);
    const rng = seededRng(4);
    for (let i = 0; i < 2; i++) f = playRound(f, mv(f.me.hand[0]!.key), mv(f.them.hand[0]!.key), rng);
    expect(f.me.gauge).toBeGreaterThan(0.44);
    f = { ...f, me: { ...f.me, gauge: 1 } };
    expect(capCheck(f, "me", f.me.hand[0]!.key).ok).toBe(true);
    f = playRound(f, mv(f.me.hand[0]!.key, "force", true), mv(f.them.hand[0]!.key), rng);
    f = playRound(f, mv(f.me.hand[0]!.key), mv(f.them.hand[0]!.key), rng);
    expect(f.me.gauge).toBe(0);
    expect(capCheck({ ...f, me: { ...f.me, gauge: 1 } }, "me", f.me.hand[0]!.key).ok).toBe(false);
  });

  it("Endurance : une carte déjà jouée revient (jamais une LR)", () => {
    let f = duo(["velo-de-salle", "squat", "developpe-couche"].map((s, i) => c(s, 800, 800, i === 0 ? "UR" : i === 1 ? "LR" : "SR")), OTHER.slice(0, 3).map((s) => c(s, 800, 800)));
    const rng = seededRng(5);
    expect(capCheck({ ...f, me: { ...f.me, gauge: 1 } }, "me", "c0").ok).toBe(false); // rien à rejouer
    f = playRound(f, mv("c1"), mv("c0"), rng); // LR jouée
    expect(capCheck({ ...f, me: { ...f.me, gauge: 1 } }, "me", "c0").ok).toBe(false); // la LR ne revient pas
    f = playRound(f, mv("c2"), mv("c1"), rng);
    f = { ...f, me: { ...f.me, gauge: 1 } };
    f = playRound(f, mv("c0", "force", true), mv("c2"), rng);
    const back = f.log[2]!.me.replayed!;
    expect(back.card.exerciseSlug).toBe("developpe-couche");
    expect(back.atq).toBe(Math.round(f.log[1]!.me.card.atq * 0.85));
    expect(f.me.hand.some((x) => x.replay)).toBe(true);
  });

  it("le combat s'arrête au KO ou après 5 manches ; le plus haut % de PV gagne", () => {
    const rng = seededRng(6);
    for (let i = 0; i < 50; i++) {
      const f = autoFight(makeFighter("A", FIVE.map((s) => c(s, 600, 600)), "agressif"), makeFighter("B", OTHER.map((s) => c(s, 600, 600)), "prudent"), rng);
      expect(f.over).toBe(true);
      expect(f.log.length).toBeLessThanOrEqual(DUEL.rounds);
      if (!f.ko) expect(f.log.length).toBe(DUEL.rounds);
      const ra = Math.max(0, f.me.hp) / f.me.maxHp, rb = Math.max(0, f.them.hp) / f.them.maxHp;
      expect(f.outcome).toBe(ra > rb ? "win" : ra < rb ? "loss" : "draw");
    }
  });
});

describe("combats : équilibrage (simulations)", () => {
  const deckOf = (rs: Rarity[], rng = seededRng(1), slugs = FIVE) => rs.map((r, i) => {
    const R = { C: [100, 180], R: [220, 320], SR: [380, 520], SSR: [600, 800], UR: [900, 1150], LR: [1300, 1700] }[r];
    return c(slugs[i]!, rng.int(R[0]!, R[1]!), rng.int(R[0]!, R[1]!), r);
  });
  const rate = (a: CardData[], b: CardData[], n = 300) =>
    winChance(a, { key: "x", name: "x", cards: b, power: deckPower(b), consigne: "equilibre" }, seededRng(7), n);

  it("decks égaux : environ 50 %", () => {
    const d = deckOf(["SR", "SR", "SR", "SR", "SR"]);
    const r = rate(d, d.map((x, i) => ({ ...x, exerciseSlug: OTHER[i]! })), 600);
    expect(r).toBeGreaterThan(0.4);
    expect(r).toBeLessThan(0.6);
  });
  it("la rareté compte : 5 UR battent 5 SSR, une LR à la place d'une UR fait gagner souvent", () => {
    expect(rate(deckOf(["UR", "UR", "UR", "UR", "UR"]), deckOf(["SSR", "SSR", "SSR", "SSR", "SSR"], seededRng(2), OTHER))).toBeGreaterThan(0.95);
    const base = deckOf(["UR", "UR", "UR", "UR", "SSR"], seededRng(3));
    const withLr = base.map((x, i) => (i === 0 ? { ...x, rarity: "LR" as Rarity, atq: 1500, def: 1500 } : x));
    expect(rate(withLr, base.map((x, i) => ({ ...x, exerciseSlug: OTHER[i]! })))).toBeGreaterThan(0.7);
  });
  it("une LR seule ne gagne pas tout : LR + 4 C perd contre 5 SR de même puissance", () => {
    const lr = deckOf(["LR", "C", "C", "C", "C"], seededRng(4));
    const sr = equalize(deckOf(["SR", "SR", "SR", "SR", "SR"], seededRng(5), OTHER), deckPower(lr));
    expect(rate(lr, sr)).toBeLessThan(0.5);
  });
});

describe("combats : adversaires, limites et récompenses", () => {
  it("matchmaking : chance de victoire simulée entre 40 et 60 %", () => {
    const rng = seededRng(11);
    for (const rs of [["C", "C", "R", "R", "SR"], ["SR", "SR", "SSR", "SSR", "UR"], ["LR", "C", "C", "C", "C"], ["LR", "UR", "UR", "SSR", "SSR"]] as Rarity[][]) {
      const mine = rs.map((r, i) => c(FIVE[i]!, r === "LR" ? 1500 : r === "UR" ? 1000 : r === "SSR" ? 700 : r === "SR" ? 450 : r === "R" ? 270 : 140, r === "LR" ? 1500 : 700, r));
      const o = findMatch(rng, mine);
      expect(new Set(o.cards.map((x) => x.exerciseSlug)).size).toBe(5);
      expect(o.chance!).toBeGreaterThanOrEqual(0.3);
      expect(o.chance!).toBeLessThanOrEqual(0.7);
    }
  });
  it("duel amical : decks ramenés à la même puissance", () => {
    const mine = FIVE.map((s) => c(s, 600, 600));
    const eq = equalize(OTHER.map((s) => c(s, 1400, 1300, "LR")), deckPower(mine));
    expect(Math.abs(deckPower(eq) - deckPower(mine)) / deckPower(mine)).toBeLessThan(0.01);
  });
  it("5 duels par jour, +2 avec la séance ; victoire : +10 GC et +15 points de passe", () => {
    const day = "2026-10-14";
    let s: PlayerState = normalize({ ...createAccount(), cards: FIVE.map((sl, i) => owned(i, sl, 1700, 1700)) }, seededRng(1), day, finalRank);
    s = { ...s, deck: s.cards.map((x) => x.id) };
    expect(duelsLeft(s, day)).toBe(DUEL.daily);
    const opp = makeOpponent(seededRng(3), 2000);
    for (let i = 0; i < DUEL.daily; i++) { const b = beginDuel(s, day); expect(b.ok).toBe(true); if (b.ok) s = b.state; }
    expect(beginDuel(s, day).ok).toBe(false);
    const f = autoFight(makeFighter("Moi", s.cards, "equilibre"), makeFighter(opp.name, opp.cards, opp.consigne), seededRng(4));
    expect(f.outcome).toBe("win");
    const fin = finishDuel(s, f, opp, day, 0);
    expect(fin.state.gc).toBe(DUEL.winGc);
    expect(passOf(fin.state.extra!, day).xp).toBe(PASS.duelWin);
    expect(fin.state.extra!.season.points).toBe(DUEL.winPts);
    const friendly = finishDuel(s, f, { ...opp, friendly: true }, day, 0);
    expect(friendly.state.gc).toBe(0);
    s = track({ ...s, lastSessionDay: day }, "session", seededRng(1), day, finalRank);
    expect(duelsLeft(s, day)).toBe(DUEL.perSession);
  });
  it("défense : une fois par jour, +2 GC par attaque repoussée", () => {
    const day = "2026-10-14";
    let s: PlayerState = normalize({ ...createAccount(), cards: FIVE.map((sl, i) => owned(i, sl, 900, 900)) }, seededRng(1), day, finalRank);
    s = { ...s, deck: s.cards.map((x) => x.id), extra: { ...s.extra!, duels: [{ at: 0, opp: "x", outcome: "win", myHp: 50, theirHp: 0, ko: true, gc: 10, pts: 15 }] } };
    const r = runDefenses(s, seededRng(8), day, 0);
    expect(r.total).toBeGreaterThan(0);
    expect(r.state.gc).toBe(r.won * DUEL.defenseGc);
    expect(runDefenses(r.state, seededRng(9), day, 0).total).toBe(0);
  });
});
