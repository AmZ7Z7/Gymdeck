import { describe, expect, it } from "vitest";
import { HONOR_LINES, honorLine } from "../src/lib/honor";

const day = (k: number) => new Date(Date.UTC(2026, 9, 1 + k)).toISOString().slice(0, 10);

describe("phrases sur l'honneur", () => {
  it("la phrase change d'un jour à l'autre", () => {
    expect(honorLine("2026-10-23")).not.toBe(honorLine("2026-10-24"));
  });

  it("les 3 emplacements ne montrent jamais la même phrase le même jour", () => {
    for (let k = 0; k < 60; k++) {
      const shown = new Set([honorLine(day(k), 0), honorLine(day(k), 1), honorLine(day(k), 2)]);
      expect(shown.size).toBe(3);
    }
  });

  it("toutes les phrases finissent par passer à chaque emplacement", () => {
    for (const slot of [0, 1, 2] as const) {
      const seen = new Set(HONOR_LINES.map((_, k) => honorLine(day(k), slot)));
      expect(seen.size).toBe(HONOR_LINES.length);
    }
  });
});
