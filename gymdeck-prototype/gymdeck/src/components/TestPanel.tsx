"use client";

import { useState } from "react";
import { useGame } from "./GameProvider";
import { Sheet } from "./Sheet";
import { IconFlask } from "./Icons";

/**
 * Comptes qui gardent la fiole même quand elle est masquée pour tout le monde : identifiants Supabase (UID)
 * séparés par des virgules, dans la variable NEXT_PUBLIC_TEST_TOOLS_USERS sur Vercel.
 */
const TESTERS = (process.env.NEXT_PUBLIC_TEST_TOOLS_USERS ?? "").split(",").map((x) => x.trim()).filter(Boolean);

/** Bouton discret (fiole) + panneau d'outils de test (le seul endroit). Masqué en mettant NEXT_PUBLIC_HIDE_TEST_TOOLS=1 sur Vercel. */
export function TestPanel() {
  const g = useGame();
  const [open, setOpen] = useState(false);
  const [resetAsk, setResetAsk] = useState(false);
  const tester = !!g.account?.userId && TESTERS.includes(g.account.userId);
  if (process.env.NEXT_PUBLIC_HIDE_TEST_TOOLS === "1" && !tester) return null;
  const run = (fn: () => void, msg?: string) => { fn(); setOpen(false); if (msg) g.say(msg); };
  const t = g.tools;
  return (
    <>
      <button className="testfab" aria-label="Outils de test" onClick={() => setOpen(true)}><IconFlask /></button>
      {open && (
        <Sheet onClose={() => setOpen(false)} label="Outils de test">
          <div className="sheet-title">Outils de test</div>
          <p className="fine" style={{ margin: "0 0 8px" }}>Ces outils n’existent que dans le prototype.</p>
          <div className="testgrid">
            <button className="btn primary" style={{ gridColumn: "1 / -1" }} onClick={() => run(() => t.openTestBooster("LR"))}>Booster avec une LÉGENDAIRE</button>
            <button className="btn ghost" style={{ gridColumn: "1 / -1" }} onClick={() => run(() => t.openTestBooster("UR"))}>Booster avec une UR</button>
            <button className="btn ghost small" onClick={() => run(() => t.nextDay(), "Jour suivant simulé")}>+1 jour</button>
            <button className="btn ghost small" onClick={() => run(() => t.advanceDays(10), "+10 jours simulés")}>+10 jours</button>
            <button className="btn ghost small" onClick={() => run(() => t.advanceDays(31), "+31 jours : saison terminée")}>+1 mois (saison)</button>
            <button className="btn ghost small" onClick={() => run(() => t.advanceHours(6), "Marché avancé de 6 h")}>Marché +6 h</button>
            <button className="btn ghost small" onClick={() => run(() => t.addGc(75), "+75 GC")}>+75 GC</button>
            <button className="btn ghost small" onClick={() => run(() => t.giveCard("UR"), "Carte UR de test ajoutée")}>Carte UR</button>
            <button className="btn ghost small" onClick={() => run(() => t.giveCard("LR"), "Carte LR de test ajoutée")}>Carte LR</button>
            <button className="btn ghost small" onClick={() => run(() => t.resetTutorial(), "Le tutoriel se relancera sur l’accueil")}>Tutoriel</button>
            <button className="btn ghost small" onClick={() => run(() => t.giveCard("UR", 9), "Carte UR notée 9 ajoutée")}>Carte notée 9</button>
            <button className="btn ghost small" onClick={() => run(() => t.giveCard("LR", 10), "Carte LR notée 10 ajoutée")}>Carte notée 10</button>
            <button className="btn ghost small" onClick={() => run(() => t.finishGradings(), "Expertises terminées")}>Finir expertises</button>
            <button className="btn ghost small" onClick={() => run(() => t.finishGradings(10), "Expertises terminées : note 10")}>Finir (note 10)</button>
            <button className="btn ghost small" onClick={() => run(() => t.addDuels(3), "+3 duels aujourd’hui")}>+3 duels</button>
            <button className="btn ghost small" onClick={() => run(() => t.addPassXp(130), "+1 palier de passe")}>Passe +1 palier</button>
          </div>
          <button className="btn ghost small" onClick={() => { setOpen(false); setResetAsk(true); }}>Tout réinitialiser…</button>
          <button className="btn ghost small" onClick={() => setOpen(false)}>Fermer</button>
        </Sheet>
      )}
      {resetAsk && (
        <Sheet onClose={() => setResetAsk(false)} label="Tout réinitialiser">
          <div className="sheet-title">Tout réinitialiser ?</div>
          <p>Cartes, GC, boosters et deck seront remis à zéro, avec les 2 boosters de bienvenue.</p>
          <button className="btn primary" onClick={() => { t.reset(); setResetAsk(false); g.say("Prototype réinitialisé"); }}>Oui, tout effacer</button>
          <button className="btn ghost small" onClick={() => setResetAsk(false)}>Annuler</button>
        </Sheet>
      )}
    </>
  );
}
