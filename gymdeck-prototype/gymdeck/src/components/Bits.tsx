"use client";

import { useEffect, useState } from "react";
import { DISCARD_GC, NORMAL_WEIGHTS, PITY_THRESHOLD, RARITIES, RARITY_COLOR, STAT_RANGE, WELCOME2_WEIGHTS } from "@/lib/config";
import { Sheet } from "./Sheet";

export function Wordmark() {
  return <div className="wordmark">GYM<b>DECK</b></div>;
}

export function GcPill({ gc }: { gc: number }) {
  return (
    <div className="gc"><span className="coin" />{gc} GC</div>
  );
}

/** Heure courante, rafraîchie toutes les `ms` millisecondes (compte à rebours). */
export function useNow(ms = 30000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function formatDuration(msLeft: number): string {
  const totalMin = Math.max(1, Math.ceil(msLeft / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

const pctFmt = (bp: number) => `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : bp % 10 === 0 ? 1 : 2).replace(".", ",")} %`;

/** Taux de drop publics, garanties comprises : transparence obligatoire avant publication. */
export function OddsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet onClose={onClose} label="Taux de drop">
      <div className="sheet-title">Taux de drop</div>
      <div className="odds">
        <div className="odds-row head"><span>Rareté</span><span>Booster</span><span>Bienvenue #2</span><span>Défausse</span></div>
        {RARITIES.map((r) => (
          <div className="odds-row" key={r}>
            <span style={{ color: RARITY_COLOR[r], fontWeight: 800 }}>{r}</span>
            <span>{pctFmt(NORMAL_WEIGHTS[r])}</span>
            <span>{pctFmt(WELCOME2_WEIGHTS[r])}</span>
            <span>{DISCARD_GC[r]} GC</span>
          </div>
        ))}
      </div>
      <p className="fine">Probabilités par carte, avant garanties. ATQ et DEF sont tirées au hasard dans la fourchette de la rareté
        ({RARITIES.map((r) => `${r} ${STAT_RANGE[r].min}–${STAT_RANGE[r].max}`).join(" · ")}).</p>
      <ul className="rules">
        <li><b>5 cartes</b> par booster.</li>
        <li><b>Au moins une R :</b> si les 5 cartes sont des C, l’une d’elles devient R.</li>
        <li><b>Garantie UR :</b> après {PITY_THRESHOLD - 1} boosters sans UR ni LR, le {PITY_THRESHOLD}e en contient forcément une UR.</li>
        <li>Une UR ou une LR remet ce compteur à zéro.</li>
        <li>Seules les UR et LR ont un passif.</li>
      </ul>
      <button className="btn ghost small" onClick={onClose}>Fermer</button>
    </Sheet>
  );
}

/** Progression de la connexion quotidienne : 7 points, le 7e donne un booster. */
export function LoginDots({ done, total }: { done: number; total: number }) {
  return (
    <div className="logindots" aria-label={`${done} connexions sur ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < done ? "on" : ""}>{i === total - 1 ? "🎁" : ""}</i>
      ))}
    </div>
  );
}
