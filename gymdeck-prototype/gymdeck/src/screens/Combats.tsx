"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { GcPill, Wordmark } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { Sheet } from "@/components/Sheet";
import { deckPower } from "@/lib/engine";
import { seasonEndsIn, seasonOf } from "@/lib/progress";
import { monthName, RankingBody } from "./Social";

/** Règles PROPOSÉES (rien n'est actif) : à valider avant de construire les combats. */
const RULES: { t: string; d: string }[] = [
  { t: "Duel asynchrone", d: "Tu défies le deck d’un autre joueur, sans qu’il ait besoin d’être connecté." },
  { t: "5 manches", d: "Ta carte n°1 contre sa carte n°1, puis n°2, etc. Dégâts = ton ATQ − sa DEF (passifs compris), avec ±10 % de hasard. Qui gagne 3 manches gagne le combat." },
  { t: "3 combats par jour", d: "+2 combats offerts à chaque séance validée dans l’app : plus tu t’entraînes, plus tu combats." },
  { t: "Récompenses", d: "Quelques GC par victoire et un classement mensuel. Aucun booster gratuit, pour garder les raretés précieuses." },
];

export function Combats() {
  const g = useGame();
  const [rules, setRules] = useState(false);
  const deck = g.deckCards;
  const power = deck.length >= 5 ? deckPower(deck) : 0;
  const days = seasonEndsIn(g.day);

  return (
    <div className="screen">
      <div className="topbar"><Wordmark /><GcPill gc={g.player.gc} /></div>
      <h1 className="title" style={{ marginTop: 14, marginBottom: 4 }}>Combats</h1>
      <div style={{ color: "#cfd6e8", fontSize: 15, marginBottom: 12 }}>Saison {monthName(seasonOf(g.day))} · fin dans {days} jour{days > 1 ? "s" : ""}</div>

      <div className="panel arena">
        <span className="soon">Bientôt</span>
        <div className="arena-t">Les duels arrivent</div>
        <p>Ton deck de 5 cartes affrontera celui des autres joueurs. En attendant, prépare-le : c’est lui qui te classe.</p>
        {deck.length > 0 ? (
          <div className="arena-deck">{deck.map((c) => <div key={c.id}><Card card={c} holo={false} /></div>)}</div>
        ) : (
          <div className="arena-empty">Aucun deck pour l’instant. Compose-le dans l’onglet GymDeck.</div>
        )}
        <div className="arena-power"><span>Puissance du deck</span><b>{power > 0 ? power : "—"}</b></div>
        <button className="btn ghost small" onClick={() => setRules(true)}>Voir les règles prévues</button>
      </div>

      <h2 className="section" style={{ margin: "18px 0 8px" }}>Classement de saison</h2>
      <RankingBody />

      {rules && (
        <Sheet onClose={() => setRules(false)} label="Règles prévues des combats">
          <div className="sheet-title">Règles prévues</div>
          <p className="fine" style={{ margin: "0 0 10px" }}>Proposition en cours de validation : rien n’est encore actif dans le prototype.</p>
          <div className="rules">
            {RULES.map((r, i) => <div key={r.t}><b>{i + 1}</b><div><strong>{r.t}</strong><span>{r.d}</span></div></div>)}
          </div>
          <button className="btn primary small" style={{ marginTop: 14 }} onClick={() => setRules(false)}>Compris</button>
        </Sheet>
      )}
    </div>
  );
}
