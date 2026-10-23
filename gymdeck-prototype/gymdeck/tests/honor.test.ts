import { describe, expect, it } from "vitest";
import { HONOR_LINES, honorLine } from "../src/lib/honor";

describe("phrases sur l'honneur", () => {
  it("la phrase change d'un jour à l'autre", () => {
    expect(honorLine("2026-10-23")).not.toBe(honorLine("2026-10-24"));
  });

  it("deux emplacements ne montrent jamais la même phrase le même jour", () => {
    for (let d = 1; d <= 31; d++) {
      const day = `2026-10-${String(d).padStart(2, "0")}`;
      expect(honorLine(day, 0)).not.toBe(honorLine(day, 1));
    }
  });

  it("toutes les phrases finissent par passer, et aucune ne reprend la phrase de l'accueil", () => {
    const seen = new Set(Array.from({ length: HONOR_LINES.length }, (_, k) => honorLine(`2026-11-${String(k + 1).padStart(2, "0")}`)));
    expect(seen.size).toBe(HONOR_LINES.length);
    for (const l of HONOR_LINES) expect(l).not.toMatch(/On ne viendra pas vérifier/);
  });
});
