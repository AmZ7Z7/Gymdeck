"use client";

import { useEffect, useRef, useState } from "react";
import {
  DISCARD_GC, LR_PITY_THRESHOLD, NORMAL_WEIGHTS, PITY_THRESHOLD, RARITIES, RARITY_COLOR, SESSION_WEIGHTS, SHARDS_DISCARD, STAT_RANGE,
  STREAK_BOOSTER_EVERY, WELCOME2_WEIGHTS,
} from "@/lib/config";
import { Sheet } from "./Sheet";
import { IconGift } from "./Icons";

export function Wordmark() {
  return (
    <div className="wordmark">
      <img className="wm" src="/assets/ui/wordmark.webp" alt="GymDeck" draggable={false} />
    </div>
  );
}

/** Pastille de GC : le compteur défile quand le solde change, avec un petit « +5 » qui s'envole. */
export function GcPill({ gc }: { gc: number }) {
  const [shown, setShown] = useState(gc);
  const [delta, setDelta] = useState<{ v: number; k: number } | null>(null);
  const prev = useRef(gc);
  useEffect(() => {
    const from = prev.current;
    prev.current = gc;
    if (from === gc) return;
    setDelta({ v: gc - from, k: Date.now() });
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    if (reduced) setShown(gc);
    else {
      const t0 = performance.now();
      const dur = Math.min(900, 380 + Math.abs(gc - from) * 4);
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        setShown(Math.round(from + (gc - from) * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    const to = window.setTimeout(() => setDelta(null), 1300);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(to); setShown(gc); };
  }, [gc]);
  return (
    <div className={`gc ${delta ? (delta.v > 0 ? "up" : "down") : ""}`} aria-label={`${gc} GymCoins`}>
      <span className="coin" key={delta && delta.v > 0 ? `c${delta.k}` : "c"} />{shown} GC
      {delta && <span key={`d${delta.k}`} className={`gcdelta ${delta.v > 0 ? "pos" : "neg"}`} aria-hidden>{delta.v > 0 ? "+" : "−"}{Math.abs(delta.v)}</span>}
    </div>
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
        <div className="odds-row g4 head"><span>Rareté</span><span>Booster</span><span>Séance</span><span>Défausse</span></div>
        {RARITIES.map((r) => (
          <div className="odds-row g4" key={r}>
            <span style={{ color: RARITY_COLOR[r], fontWeight: 800 }}>{r}</span>
            <span>{pctFmt(NORMAL_WEIGHTS[r])}</span>
            <span>{pctFmt(SESSION_WEIGHTS[r])}</span>
            <span>{DISCARD_GC[r]} GC · {SHARDS_DISCARD[r]} ✦</span>
          </div>
        ))}
      </div>
      <p className="fine">Probabilités par carte, avant garanties. « Séance » : booster gagné en validant ta séance ; « Booster » : tous les
        autres (connexion, boutique, passe). ATQ et DEF sont tirées au hasard dans la fourchette de la rareté
        ({RARITIES.map((r) => `${r} ${STAT_RANGE[r].min}–${STAT_RANGE[r].max}`).join(" · ")}).</p>
      <ul className="rules">
        <li><b>5 cartes</b> par booster.</li>
        <li><b>Au moins une R :</b> si les 5 cartes sont des C, l’une d’elles devient R.</li>
        <li><b>Garantie UR :</b> après {PITY_THRESHOLD - 1} boosters sans UR ni LR, le {PITY_THRESHOLD}e en contient forcément une UR.</li>
        <li>Une UR ou une LR remet ce compteur à zéro.</li>
        <li><b>Garantie LR :</b> après {LR_PITY_THRESHOLD - 1} boosters sans LR, le {LR_PITY_THRESHOLD}e en contient forcément une.</li>
        <li><b>Booster de série :</b> tous les {STREAK_BOOSTER_EVERY} jours de série, un booster bonus aux taux améliorés
          ({RARITIES.map((r) => `${r} ${pctFmt(WELCOME2_WEIGHTS[r])}`).join(" · ")}).</li>
        <li><b>Forge :</b> chaque carte défaussée donne des éclats ✦ ; avec assez d’éclats, fabrique la carte de ton choix.</li>
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
        <i key={i} className={i < done ? "on" : ""}>{i === total - 1 ? <IconGift /> : null}</i>
      ))}
    </div>
  );
}
