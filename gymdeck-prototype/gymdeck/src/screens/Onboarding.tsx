"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useGame } from "@/components/GameProvider";

/** Premier lancement : on choisit un pseudo, puis on enchaîne directement sur l'ouverture du premier booster. */
export function Onboarding() {
  const g = useGame();
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const hasWelcome = g.player.boosters.length > 0;

  const submit = () => {
    const e = g.setName(name);
    if (e) { setErr(e); return; }
    if (hasWelcome) g.startOpening(g.player.boosters[0]!.id);
  };

  return (
    <motion.div className="onboard" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <div className="wordmark">GYM<b>DECK</b></div>
      <h1>Ta séance,<br />ton booster.</h1>
      <div className="steps3">
        <div><b>1</b> Valide ta séance du jour</div>
        <div><b>2</b> Ouvre ton booster de 5 cartes</div>
        <div><b>3</b> Compose ton deck de 5 exercices</div>
      </div>
      <div className="field">
        <label htmlFor="pseudo">Choisis ton pseudo</label>
        <input
          id="pseudo"
          value={name}
          maxLength={20}
          autoComplete="nickname"
          placeholder="Ton pseudo"
          onChange={(e) => { setName(e.target.value); setErr(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
        {err && <span style={{ color: "#ff8a8a", fontSize: 14 }}>{err}</span>}
      </div>
      <button className="btn primary" onClick={submit}>C’est parti</button>
      <p className="fine" style={{ textAlign: "center" }}>
        {hasWelcome ? "2 boosters de bienvenue t’attendent. " : ""}GymDeck est gratuit : les cartes et les GymCoins n’ont aucune valeur en argent.
      </p>
    </motion.div>
  );
}
