"use client";

import { useState } from "react";
import { CardFX } from "@/components/CardFX";
import { CardBack } from "@/components/Card";
import { RARITIES, RARITY_COLOR } from "@/lib/config";
import type { CardData } from "@/lib/engine";

/** Page de test (non liée depuis le jeu) : une carte de chaque rareté avec son nouvel effet, et l'ouverture une par une. */
const DEMO: CardData[] = [
  { exerciseSlug: "rameur", rarity: "C", atq: 142, def: 151, passive: null },
  { exerciseSlug: "rameur", rarity: "R", atq: 288, def: 301, passive: null },
  { exerciseSlug: "squat", rarity: "SR", atq: 468, def: 431, passive: null },
  { exerciseSlug: "gainage", rarity: "SSR", atq: 742, def: 688, passive: null },
  { exerciseSlug: "developpe-incline", rarity: "UR", atq: 1104, def: 966, passive: { type: "ATQ", atqTenths: 36, defTenths: 0 } },
  { exerciseSlug: "leg-extension", rarity: "LR", atq: 1560, def: 1490, passive: { type: "BOTH", atqTenths: 31, defTenths: 29 } },
];
const LABEL: Record<string, string> = { C: "Commune · mate", R: "Rare · bordure colorée", SR: "Rare · bordure colorée", SSR: "Très rare · bordure métallique", UR: "Haute rareté · holographique", LR: "Rareté maximale · holographique" };

export default function TestCartes() {
  const [run, setRun] = useState(0);
  const [shown, setShown] = useState(0);
  // ouverture : une carte se retourne toutes les 0,9 s, la LR prend son temps
  const play = () => {
    setRun((r) => r + 1);
    setShown(0);
    DEMO.forEach((c, i) => window.setTimeout(() => setShown(i + 1), 400 + i * 900 + (c.rarity === "LR" ? 400 : 0)));
  };
  return (
    <main className="fxtest">
      <meta name="robots" content="noindex" />
      <h1>Aperçu des raretés</h1>
      <p>Passe la souris sur une carte, ou touche-la sur téléphone (le gyroscope marche aussi sur Android). Ordre des raretés inchangé : {RARITIES.join(" → ")}.</p>
      <div className="fxgrid">
        {DEMO.map((c) => (
          <figure key={c.rarity}>
            <CardFX card={c} />
            <figcaption><b style={{ color: RARITY_COLOR[c.rarity] }}>{c.rarity}</b> {LABEL[c.rarity]}</figcaption>
          </figure>
        ))}
      </div>
      <h2>Ouverture d’un booster</h2>
      <button className="btn primary" onClick={play}>{run ? "Rejouer" : "Lancer"} l’ouverture</button>
      <div className="fxgrid open" key={run}>
        {DEMO.map((c, i) => (
          <div key={c.rarity} className={`cfx-flip ${i < shown ? "go" : ""} ${c.rarity === "LR" ? "max" : ""}`} style={{ ["--rc" as string]: RARITY_COLOR[c.rarity] }}>
            <span className="cfx-burst" />
            {c.rarity === "LR" && <span className="cfx-flash" />}
            <div className="cfx-face">
              <div className="cfx-back"><CardBack /></div>
              <div className="cfx-front"><CardFX card={c} tilt={false} /></div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
