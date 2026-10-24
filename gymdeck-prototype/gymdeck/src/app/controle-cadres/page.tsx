"use client";

import { Card } from "@/components/Card";
import { CardFX } from "@/components/CardFX";
import type { CardData } from "@/lib/engine";

/** Page de contrôle des cadres v2 (non liée depuis le jeu) : 6 raretés + cas limites. */
const CASES: [string, CardData][] = [
  ["C", { exerciseSlug: "rameur", rarity: "C", atq: 142, def: 151, passive: null }],
  ["R · nom long", { exerciseSlug: "extension-triceps-overhead", rarity: "R", atq: 288, def: 301, passive: null }],
  ["SR · machine", { exerciseSlug: "developpe-poitrine-machine", rarity: "SR", atq: 468, def: 431, passive: null }],
  ["SSR · notée 8", { exerciseSlug: "squat", rarity: "SSR", atq: 742, def: 688, passive: null, grade: 8 }],
  ["UR · passif", { exerciseSlug: "developpe-incline", rarity: "UR", atq: 1104, def: 966, passive: { type: "ATQ", atqTenths: 36, defTenths: 0 } }],
  ["LR · passif double, notée 10", { exerciseSlug: "developpe-militaire-halteres", rarity: "LR", atq: 1560, def: 1490, passive: { type: "BOTH", atqTenths: 31, defTenths: 29 }, grade: 10 }],
];

export default function ControleCadres() {
  return (
    <main style={{ padding: 16, display: "grid", gap: 16 }}>
      <meta name="robots" content="noindex" />
      <h1>Contrôle des cadres</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
        {CASES.map(([lab, c]) => (
          <figure key={lab} style={{ margin: 0 }}><Card card={c} /><figcaption style={{ fontSize: 12 }}>{lab}</figcaption></figure>
        ))}
      </div>
      <h2>Grand format (effets)</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
        {CASES.map(([lab, c]) => <CardFX key={lab} card={c} />)}
      </div>
    </main>
  );
}
