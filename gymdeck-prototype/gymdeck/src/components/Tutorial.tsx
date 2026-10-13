"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Sheet } from "./Sheet";

const STEPS: { emoji: string; title: string; text: string; img?: string }[] = [
  { emoji: "💪", title: "Fais ta séance", text: "Entraîne-toi, puis valide ta séance sur l’accueil. Tu gagnes 1 booster par jour.", img: "/assets/ui/booster.webp" },
  { emoji: "🃏", title: "Ouvre ton booster", text: "5 cartes à découvrir. Touche une carte pour la retourner, ou la carte d’à côté pour avancer. Un appui long sur une carte cachée fait briller sa couleur de rareté.", img: "/assets/ui/dos-carte.webp" },
  { emoji: "📚", title: "Complète ta collection", text: "Chaque exercice existe en 6 raretés : C, R, SR, SSR, UR et LR. Les extensions par muscle te récompensent quand tu les complètes." },
  { emoji: "🛡️", title: "Compose ton GymDeck", text: "Un deck de 5 cartes, une par exercice. Les cartes UR et LR ont un passif qui booste tout ton deck." },
  { emoji: "🪙", title: "Dépense tes GC", text: "Les GymCoins servent à acheter des boosters ou à enchérir sur le Marché. Les doublons se défaussent contre des GC." },
  { emoji: "🔥", title: "Missions et séries", text: "Chaque jour : des missions et une série de séances. Plus tu es régulier, plus tu gagnes de GC." },
];

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;
  const s = STEPS[i]!;
  return (
    <Sheet onClose={onClose} variant="center" label="Tutoriel">
      <div className="tuto">
        <AnimatePresence mode="wait">
          <motion.div key={i} className="tutostep" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}>
            {s.img ? <img className="tutoimg" src={s.img} alt="" draggable={false} /> : <div className="tutoemo" aria-hidden>{s.emoji}</div>}
            <div className="sheet-title" style={{ textAlign: "center" }}>{s.title}</div>
            <p style={{ textAlign: "center" }}>{s.text}</p>
          </motion.div>
        </AnimatePresence>
        <div className="dots" aria-hidden>{STEPS.map((_, k) => <i key={k} className={k === i ? "on" : ""} />)}</div>
        <div className="acts" style={{ width: "100%" }}>
          <button className="btn primary" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? "C’est parti !" : "Suivant"}</button>
          {!last && <button className="btn ghost small" onClick={onClose}>Passer</button>}
        </div>
      </div>
    </Sheet>
  );
}
