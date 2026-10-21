import { describe, expect, it } from "vitest";
import { dueNotifications, parisParts, type Prefs, type SaveState } from "../supabase/functions/send-notifications";

const ALL: Prefs = { session: true, grading: true, streak: true };
/** Mercredi 21 octobre 2026 (heure d'été, UTC+2). */
const at = (hhmm: string, day = "2026-10-21") => new Date(`${day}T${hhmm}:00+02:00`);
const base = (o: Partial<SaveState> = {}): SaveState => ({
  lastSessionDay: "2026-10-20",
  extra: { reminder: { days: [2], time: "18:00" }, streak: { current: 0, lastDay: null } }, // 2 = mercredi
  ...o,
});

describe("heure de Paris", () => {
  it("donne le jour, le jour de la semaine (lundi = 0) et l'heure", () => {
    expect(parisParts(at("18:05"))).toEqual({ day: "2026-10-21", weekday: 2, minutes: 18 * 60 + 5 });
    // en hiver (UTC+1)
    expect(parisParts(new Date("2026-11-02T06:30:00Z"))).toEqual({ day: "2026-11-02", weekday: 0, minutes: 7 * 60 + 30 });
  });
});

describe("rappel de séance", () => {
  it("part à l'heure choisie, une seule fois par jour", () => {
    expect(dueNotifications(base(), ALL, {}, at("17:55")).notes).toHaveLength(0);
    const r = dueNotifications(base(), ALL, {}, at("18:05"));
    expect(r.notes.map((n) => n.kind)).toEqual(["session"]);
    expect(dueNotifications(base(), ALL, r.sent, at("18:20")).notes).toHaveLength(0);
  });

  it("ne part pas si la séance est déjà validée, un autre jour, trop tard, ou si le joueur l'a coupé", () => {
    expect(dueNotifications(base({ lastSessionDay: "2026-10-21" }), ALL, {}, at("18:05")).notes).toHaveLength(0);
    expect(dueNotifications(base(), ALL, {}, at("18:05", "2026-10-22")).notes).toHaveLength(0); // jeudi
    expect(dueNotifications(base(), ALL, {}, at("21:30")).notes).toHaveLength(0);
    expect(dueNotifications(base(), { ...ALL, session: false }, {}, at("18:05")).notes).toHaveLength(0);
  });
});

describe("expertise de Basile", () => {
  it("annonce une note prête, une seule fois", () => {
    const now = at("10:00");
    const s = base({ grading: [{ cardId: "c1", readyAt: now.getTime() - 60_000 }, { cardId: "c2", readyAt: now.getTime() + 3_600_000 }] });
    const r = dueNotifications(s, ALL, {}, now);
    expect(r.notes.map((n) => n.kind)).toEqual(["grading"]);
    expect(r.notes[0]!.url).toBe("/#atelier");
    expect(dueNotifications(s, ALL, r.sent, now).notes).toHaveLength(0);
  });

  it("n'annonce pas une vieille note (plus d'un jour)", () => {
    const now = at("10:00");
    expect(dueNotifications(base({ grading: [{ cardId: "c1", readyAt: now.getTime() - 2 * 86_400_000 }] }), ALL, {}, now).notes).toHaveLength(0);
  });
});

describe("série en danger", () => {
  const danger = base({ lastSessionDay: "2026-10-19", extra: { reminder: null, streak: { current: 5, lastDay: "2026-10-19" } } });

  it("prévient à partir de 18 h le dernier jour pour garder la série, une fois", () => {
    expect(dueNotifications(danger, ALL, {}, at("17:00")).notes).toHaveLength(0);
    const r = dueNotifications(danger, ALL, {}, at("18:15"));
    expect(r.notes.map((n) => n.kind)).toEqual(["streak"]);
    expect(r.notes[0]!.title).toContain("5 jours");
    expect(dueNotifications(danger, ALL, r.sent, at("20:00")).notes).toHaveLength(0);
  });

  it("ne prévient pas si la série n'est pas en danger ou trop courte", () => {
    const hier = base({ extra: { reminder: null, streak: { current: 5, lastDay: "2026-10-20" } } });
    expect(dueNotifications(hier, ALL, {}, at("19:00")).notes).toHaveLength(0);
    const courte = base({ lastSessionDay: "2026-10-19", extra: { reminder: null, streak: { current: 1, lastDay: "2026-10-19" } } });
    expect(dueNotifications(courte, ALL, {}, at("19:00")).notes).toHaveLength(0);
  });
});
