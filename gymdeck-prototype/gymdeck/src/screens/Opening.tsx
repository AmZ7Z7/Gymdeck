"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardBack } from "@/components/Card";
import { Wordmark } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { IconBack, IconNext } from "@/components/Icons";
import { RARITY_COLOR } from "@/lib/config";
import type { Tab } from "@/app/page";

export function Opening({ go }: { go: (t: Tab) => void }) {
  const g = useGame();
  const o = g.opening!;
  // Pendant la secousse du paquet, on garde l'écran « paquet » même si le tirage est déjà enregistré.
  const [shaking, setShaking] = useState(false);

  if (o.phase === "closed" || shaking) {
    return (
      <div className="stage">
        <div className="head">
          <button className="backbtn" aria-label="Retour" onClick={g.closeOpening}><IconBack width={22} height={22} /></button>
          <Wordmark />
          <span />
        </div>
        <div className="center-copy">
          <h1>Ton booster</h1>
          <p>Appuie sur le booster pour l’ouvrir.</p>
          {o.kind === "welcome2" && <p style={{ color: "var(--lime)", fontWeight: 600, marginTop: 4 }}>✦ Booster de bienvenue amélioré</p>}
        </div>
        <button
          className={`pack ${shaking ? "pack-shake" : "pulse"}`}
          style={{ flex: 1, minHeight: 0, margin: "10px 0" }}
          aria-label="Ouvrir le booster"
          disabled={shaking}
          onClick={() => {
            setShaking(true);
            g.openNow(); // tirage généré et sauvegardé immédiatement, avant l'animation
            window.setTimeout(() => setShaking(false), 950);
          }}
        >
          <img src="/assets/ui/booster.webp" alt="Booster" draggable={false} />
        </button>
        {shaking && <div className="flash" />}
        <div className="count-label">🂠 5 cartes à découvrir.</div>
      </div>
    );
  }

  return <Cards go={go} />;
}

function Cards({ go }: { go: (t: Tab) => void }) {
  const g = useGame();
  const o = g.opening!;
  const cards = o.cardIds.map((id) => g.player.cards.find((c) => c.id === id)!).filter(Boolean);
  const scroller = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(o.index);

  const slideStep = () => {
    const el = scroller.current;
    const first = el?.querySelector<HTMLElement>(".slide");
    return first ? first.offsetWidth + 14 : 0;
  };

  const scrollTo = (i: number, smooth = true) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: i * slideStep(), behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => { scrollTo(o.index, false); /* reprise après rechargement */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const i = Math.max(0, Math.min(cards.length - 1, Math.round(el.scrollLeft / (slideStep() || 1))));
    if (i !== idx) { setIdx(i); g.setIndex(i); }
  };

  const allRevealed = o.revealed.length > 0 && o.revealed.every(Boolean);
  const nextBooster = g.player.boosters[0];

  return (
    <div className="stage">
      <div className="head">
        <button className="backbtn" aria-label="Retour" onClick={() => { g.closeOpening(); go("home"); }}><IconBack width={22} height={22} /></button>
        <Wordmark />
        <span />
      </div>
      <div className="center-copy">
        <h1>À toi de jouer</h1>
        <p>Appuie sur une carte pour la révéler.</p>
      </div>

      <div className="carousel">
        <div className="slides" ref={scroller} onScroll={onScroll}>
          {cards.map((c, i) => (
            <div
              className={`slide ${i === idx ? "" : "off"}`}
              key={c.id}
              onClick={() => (i === idx ? g.reveal(i) : scrollTo(i))}
            >
              <div className={`flip ${o.revealed[i] ? "shown" : ""}`}>
                <span className="glow" style={{ ["--g" as string]: RARITY_COLOR[c.rarity] }} />
                <div className="face back"><CardBack /></div>
                <div className="face front"><Card card={c} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="count-label">Carte {idx + 1} sur {cards.length}</div>
      <div className="dots" style={{ marginTop: 10 }}>
        {cards.map((c, i) => <i key={c.id} className={i === idx ? "on" : ""} />)}
      </div>
      <div className="navrow">
        <button aria-label="Carte précédente" disabled={idx === 0} style={{ opacity: idx === 0 ? .4 : 1 }} onClick={() => scrollTo(idx - 1)}><IconBack width={26} height={26} /></button>
        <span>Glisse pour changer de carte.</span>
        <button aria-label="Carte suivante" disabled={idx === cards.length - 1} style={{ opacity: idx === cards.length - 1 ? .4 : 1 }} onClick={() => scrollTo(idx + 1)}><IconNext width={26} height={26} /></button>
      </div>

      {allRevealed && nextBooster ? (
        <>
          <button className="btn primary" onClick={() => g.startOpening(nextBooster.id)}>Booster suivant ({g.player.boosters.length})</button>
          <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => { g.closeOpening(); go("collection"); }}>Voir ma collection</button>
        </>
      ) : (
        <button className="btn primary" onClick={() => { g.closeOpening(); go("collection"); }}>Voir ma collection</button>
      )}
    </div>
  );
}
