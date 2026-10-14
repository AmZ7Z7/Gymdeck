"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { GcPill, Wordmark } from "@/components/Bits";
import { BonusLine, DuelFlow, GroupTag } from "@/components/Duel";
import { useGame } from "@/components/GameProvider";
import { Sheet } from "@/components/Sheet";
import { DUEL } from "@/lib/config";
import { combatPower } from "@/lib/duel";
import { seasonEndsIn, seasonOf } from "@/lib/progress";
import type { Tab } from "@/app/page";
import { monthName, RankingBody } from "./Social";

/** Règles des combats (validées par Adrien le 14 oct. 2026). */
export const RULES: { t: string; d: string }[] = [
  { t: "Duel asynchrone", d: "Tu affrontes le deck d’un joueur de puissance proche (± 25 %), sans qu’il ait besoin d’être connecté." },
  { t: "Ordre caché", d: "Avant chaque duel, tu ranges tes 5 cartes. Ta n°1 affronte sa n°1, puis la n°2, etc. Tu vois ses cartes, mais pas son ordre : c’est un pari." },
  { t: "Synergies de groupe", d: `2 cartes du même groupe : +${DUEL.synergyPct[2]} %. 3 : +${DUEL.synergyPct[3]} %. 4 : +${DUEL.synergyPct[4]} %. 5 : +${DUEL.synergyPct[5]} % (ATQ et DEF de ces cartes). Cinq groupes différents : +${DUEL.allGroupsPct} % à tout le deck.` },
  { t: "Triangle des groupes", d: `Pecs > Épaules > Dos > Pecs, et Jambes > Abdos > Cardio > Jambes. La carte en avantage gagne +${DUEL.trianglePct} % d’ATQ et de DEF sur la manche. Les Bras sont neutres.` },
  { t: "Une manche", d: `Chaque carte frappe l’autre : son ATQ (± ${DUEL.noisePct} % de hasard) moins la DEF adverse, passifs du deck compris. L’écart compté est plafonné à ${DUEL.cap} : écraser l’adversaire ne vaut pas plus qu’une victoire nette.` },
  { t: "Victoire", d: "Qui gagne 3 manches sur 5 gagne le duel. À égalité de manches, l’écart total départage." },
  { t: `${DUEL.daily} duels par jour`, d: `+${DUEL.perSession} duels le jour où tu valides ta séance dans l’app : plus tu t’entraînes, plus tu combats.` },
  { t: "Récompenses", d: `+${DUEL.winGc} GC par victoire. Points de saison : victoire +${DUEL.winPts}, égalité ou défaite +${DUEL.lossPts}. Classement mensuel, sans booster gratuit pour garder les raretés précieuses.` },
];

const OUT: Record<string, string> = { win: "Victoire", loss: "Défaite", draw: "Égalité" };

export function Combats({ go }: { go: (t: Tab) => void }) {
  const g = useGame();
  const [rules, setRules] = useState(false);
  const [duel, setDuel] = useState(false);
  const deck = g.deckCards;
  const ready = deck.length >= 5;
  const days = seasonEndsIn(g.day);
  const left = g.duelsLeft;
  const total = DUEL.daily + (g.sessionDoneToday ? DUEL.perSession : 0);
  const history = g.extra.duels ?? [];

  return (
    <div className="screen">
      <div className="topbar"><Wordmark /><GcPill gc={g.player.gc} /></div>
      <h1 className="title" style={{ marginTop: 14, marginBottom: 4 }}>Combats</h1>
      <div style={{ color: "#cfd6e8", fontSize: 15, marginBottom: 12 }}>Saison {monthName(seasonOf(g.day))} · fin dans {days} jour{days > 1 ? "s" : ""}</div>

      <div className="panel arena">
        <div className="arena-top">
          <span className="arena-t">Arène</span>
          <span className="duelpips" aria-label={`${left} duel${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""} aujourd’hui`}>
            {Array.from({ length: Math.max(total, left) }, (_, i) => <i key={i} className={i < left ? "on" : ""} />)}
            <b>{left} duel{left > 1 ? "s" : ""}</b>
          </span>
        </div>
        {ready ? (
          <>
            <div className="arena-deck">{deck.map((c) => <div key={c.id}><Card card={c} holo={false} /><GroupTag card={c} /></div>)}</div>
            <BonusLine cards={deck} />
            <div className="arena-power"><span>Puissance de combat</span><b>{combatPower(deck).toLocaleString("fr-FR")}</b></div>
            <button className="btn primary" disabled={left <= 0} onClick={() => setDuel(true)}>
              {left > 0 ? "Trouver un adversaire" : "Plus de duel aujourd’hui"}
            </button>
            {!g.sessionDoneToday && <p className="fine" style={{ textAlign: "center" }}>Valide ta séance du jour : +{DUEL.perSession} duels.</p>}
          </>
        ) : (
          <>
            <div className="arena-empty">Il te faut un deck de 5 cartes pour combattre ({deck.length}/5).</div>
            <button className="btn primary small" onClick={() => go("gymdeck")}>Compléter mon deck</button>
          </>
        )}
        <button className="link" style={{ justifySelf: "center" }} onClick={() => setRules(true)}>Règles des combats ›</button>
      </div>

      {history.length > 0 && (
        <>
          <h2 className="section" style={{ fontSize: 24, margin: "18px 0 8px" }}>Derniers duels</h2>
          <div className="board">
            {history.slice(0, 5).map((h) => (
              <div className={`brow hist ${h.outcome}`} key={h.at}>
                <span className="rk">{h.outcome === "win" ? "✓" : h.outcome === "loss" ? "✗" : "="}</span>
                <span className="bn">{OUT[h.outcome]} contre {h.opp}<small>{h.myWins} – {h.theirWins}</small></span>
                <span className="bp">+{h.pts} pt{h.pts > 1 ? "s" : ""}{h.gc ? ` · +${h.gc} GC` : ""}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="section" style={{ margin: "18px 0 8px" }}>Classement de saison</h2>
      <RankingBody />

      {duel && <DuelFlow onClose={() => setDuel(false)} />}
      {rules && (
        <Sheet onClose={() => setRules(false)} label="Règles des combats">
          <div className="sheet-title">Règles des combats</div>
          <div className="rulelist">
            {RULES.map((r, i) => <div key={r.t}><b>{i + 1}</b><div><strong>{r.t}</strong><span>{r.d}</span></div></div>)}
          </div>
          <button className="btn primary small" style={{ marginTop: 14 }} onClick={() => setRules(false)}>Compris</button>
        </Sheet>
      )}
    </div>
  );
}
