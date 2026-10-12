"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardBack } from "@/components/Card";
import { Wordmark } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { IconBack } from "@/components/Icons";
import { RARITIES, RARITY_COLOR, type Rarity } from "@/lib/config";
import { bestDeckIds, deckPower, isTop } from "@/lib/engine";
import type { OwnedCard } from "@/lib/game";
import type { Tab } from "@/app/page";

/* ───────────────────────── Écran d'ouverture ───────────────────────── */

export function Opening({ go }: { go: (t: Tab) => void }) {
  const g = useGame();
  const o = g.opening!;
  // Le tirage est déjà enregistré quand la phase passe à « cards » : l'animation du paquet ne sert qu'à l'habillage.
  const [packDone, setPackDone] = useState(o.phase !== "closed");
  const [dealt] = useState(o.phase === "closed"); // true = on vient de déchirer le paquet → entrée animée des cartes
  const [flash, setFlash] = useState(0);

  const burst = useCallback(() => { setFlash((n) => n + 1); setPackDone(true); }, []);

  return (
    <>
      {o.phase === "summary" ? (
        <Summary go={go} />
      ) : !packDone ? (
        <PackStage go={go} onBurst={burst} />
      ) : (
        <Cards go={go} dealt={dealt} />
      )}
      {flash > 0 && (
        <motion.div
          key={flash}
          className="whiteflash"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      )}
    </>
  );
}

/* ───────────────────────── Le paquet ───────────────────────── */

function PackStage({ go, onBurst }: { go: (t: Tab) => void; onBurst: () => void }) {
  const g = useGame();
  const o = g.opening!;
  const [step, setStep] = useState<"idle" | "charge">("idle");

  const open = () => {
    if (step !== "idle") return;
    setStep("charge");
    g.openNow(); // tirage généré et sauvegardé immédiatement, avant l'animation
    try { navigator.vibrate?.(30); } catch { /* ignoré */ }
    window.setTimeout(onBurst, 1050);
  };

  const charging = step === "charge";

  return (
    <div className="stage">
      <div className="head">
        <button className="backbtn" aria-label="Retour" onClick={() => { g.closeOpening(); go("home"); }}><IconBack width={22} height={22} /></button>
        <Wordmark />
        <span />
      </div>
      <div className="center-copy">
        <h1>Ton booster</h1>
        <p>{charging ? "Ça vient…" : "Touche le booster pour l’ouvrir."}</p>
        {o.kind === "welcome2" && <p className="tagline">✦ Booster de bienvenue amélioré</p>}
        {o.kind === "welcome1" && <p className="tagline">✦ Booster de bienvenue</p>}
      </div>

      <div className="packstage">
        <motion.div
          className="packaura"
          animate={charging ? { opacity: [0.4, 1], scale: [1, 2.1] } : { opacity: [0.35, 0.6, 0.35], scale: [1, 1.08, 1] }}
          transition={charging ? { duration: 1.05, ease: "easeIn" } : { duration: 3, repeat: Infinity }}
        />
        {charging && (
          <motion.div
            className="packrays"
            initial={{ opacity: 0, rotate: 0 }}
            animate={{ opacity: [0, 0.9], rotate: 90 }}
            transition={{ duration: 1.05, ease: "easeIn" }}
          />
        )}
        <motion.button
          className="pack"
          aria-label="Ouvrir le booster"
          disabled={charging}
          onClick={open}
          animate={
            charging
              ? { rotate: [0, -3, 3, -5, 5, -7, 7, -9, 9, 0], scale: [1, 1.03, 1.06, 1.09, 1.12, 1.15, 1.2, 1.26, 1.34, 1.5], y: 0 }
              : { y: [0, -9, 0], rotate: 0, scale: 1 }
          }
          transition={charging ? { duration: 1.05, ease: "easeIn" } : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          whileTap={{ scale: 0.96 }}
        >
          <img src="/assets/ui/booster.webp" alt="Booster" draggable={false} />
        </motion.button>
      </div>
      <div className="count-label">5 cartes à découvrir.</div>
    </div>
  );
}

/* ───────────────────────── Les cartes ───────────────────────── */

const PARTICLES: Record<Rarity, number> = { C: 0, R: 7, SR: 12, SSR: 18, UR: 30, LR: 46 };

function Burst({ rarity, size }: { rarity: Rarity; size: number }) {
  const color = RARITY_COLOR[rarity];
  const top = isTop(rarity);
  const parts = useMemo(
    () => Array.from({ length: PARTICLES[rarity] }, (_, k) => {
      const a = (k / PARTICLES[rarity]) * Math.PI * 2 + Math.random() * 0.4;
      const d = size * (0.7 + Math.random() * (top ? 1.0 : 0.6));
      return { x: Math.cos(a) * d, y: Math.sin(a) * d, s: 5 + Math.random() * (top ? 9 : 6), t: 0.7 + Math.random() * 0.6, white: k % 3 === 0 };
    }),
    [rarity, size, top],
  );
  return (
    <div className="burst" aria-hidden>
      <motion.i
        className="ring"
        style={{ borderColor: color, boxShadow: `0 0 24px ${color}` }}
        initial={{ scale: 0.3, opacity: 0.95 }}
        animate={{ scale: top ? 2.7 : 1.7, opacity: 0 }}
        transition={{ duration: top ? 0.95 : 0.65, ease: "easeOut" }}
      />
      {top && (
        <motion.i
          className="ring"
          style={{ borderColor: "#fff" }}
          initial={{ scale: 0.2, opacity: 0.9 }}
          animate={{ scale: 2.1, opacity: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
        />
      )}
      {parts.map((p, k) => (
        <motion.i
          key={k}
          className="spark"
          style={{ width: p.s, height: p.s, background: p.white ? "#fff" : color, boxShadow: `0 0 10px ${color}` }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.2 }}
          transition={{ duration: p.t, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box] as const;
}

function Cards({ go, dealt }: { go: (t: Tab) => void; dealt: boolean }) {
  const g = useGame();
  const o = g.opening!;
  const cards = useMemo(
    () => o.cardIds.map((id) => g.player.cards.find((c) => c.id === id)).filter((c): c is OwnedCard => !!c),
    [o.cardIds, g.player.cards],
  );
  const n = cards.length;
  const [idx, setIdx] = useState(Math.min(o.index, Math.max(0, n - 1)));
  const [shown, setShown] = useState<boolean[]>(o.revealed);
  const [charging, setCharging] = useState<number | null>(null);
  const [fx, setFx] = useState<{ i: number; key: number } | null>(null);
  const [intro, setIntro] = useState(dealt);
  const [dragX, setDragX] = useState(0);
  const [area, box] = useBox<HTMLDivElement>();

  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(() => setIntro(false), 1500);
    return () => clearTimeout(t);
  }, [intro]);

  // Taille des cartes : on remplit la zone sans jamais dépasser 60 % de la largeur ni sa hauteur.
  const cardW = Math.max(120, Math.min(box.w * 0.6, ((box.h - 16) / 1.44)));
  const cardH = cardW * 1.44;
  const step = cardW * 1.0;

  const goTo = useCallback((i: number) => {
    const next = Math.max(0, Math.min(n - 1, i));
    setIdx(next);
    g.setIndex(next);
  }, [n, g]);

  const flipNow = (i: number) => {
    setShown((s) => s.map((v, k) => (k === i ? true : v)));
    setFx({ i, key: Date.now() });
    if (isTop(cards[i]!.rarity)) { try { navigator.vibrate?.([40, 40, 80]); } catch { /* ignoré */ } }
  };

  const doReveal = (i: number) => {
    if (charging !== null || shown[i]) return;
    g.reveal(i); // enregistré tout de suite : si on quitte, la carte reste révélée
    if (isTop(cards[i]!.rarity)) {
      setCharging(i);
      window.setTimeout(() => { setCharging(null); flipNow(i); }, 1000);
    } else {
      flipNow(i);
    }
  };

  /** Un seul geste : révéler la carte, puis passer à la suivante (la dernière mène au butin). */
  const tap = (i: number) => {
    if (charging !== null) return;
    if (i !== idx) return goTo(i);
    if (!shown[i]) return doReveal(i);
    if (i < n - 1) return goTo(i + 1);
    g.finishOpening();
  };

  const revealAll = () => {
    if (charging !== null) return;
    g.revealAll();
    setShown(cards.map(() => true));
  };

  // Clavier (ordinateur) : flèches pour naviguer, Entrée / espace pour toucher la carte.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goTo(idx + 1);
      else if (e.key === "ArrowLeft") goTo(idx - 1);
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(idx); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* Gestes : toucher = tap ; glisser = changer de carte. Géré à la main pour que les deux ne se gênent jamais. */
  const press = useRef<{ x: number; t: number; i: number | null; moved: boolean } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
    press.current = { x: e.clientX, t: Date.now(), i: el ? Number(el.dataset.i) : null, moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignoré */ }
  };
  const onMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (!p || charging !== null) return;
    const dx = e.clientX - p.x;
    if (Math.abs(dx) > 10) p.moved = true;
    if (p.moved) setDragX(Math.max(-step, Math.min(step, dx)));
  };
  const onUp = (e: React.PointerEvent) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    const dx = e.clientX - p.x;
    setDragX(0);
    if (p.moved) {
      const v = dx / Math.max(1, Date.now() - p.t); // px/ms
      if (charging === null && (Math.abs(dx) > step * 0.22 || Math.abs(v) > 0.45)) goTo(idx + (dx < 0 ? 1 : -1));
    } else {
      tap(p.i ?? idx); // un appui à côté d'une carte compte comme un appui sur la carte du milieu
    }
  };
  const onCancel = () => { press.current = null; setDragX(0); };

  const allShown = shown.length > 0 && shown.every(Boolean);
  const cur = cards[idx];
  const curShown = !!shown[idx];
  const curTop = !!cur && isTop(cur.rarity);

  const hint = charging !== null
    ? "Attention…"
    : !curShown
      ? "Touche la carte pour la révéler"
      : idx < n - 1
        ? "Touche pour passer à la suivante"
        : "Touche pour voir ton butin";

  return (
    <div className="stage">
      <div className="head">
        <button className="backbtn" aria-label="Retour" onClick={() => { g.closeOpening(); go("home"); }}><IconBack width={22} height={22} /></button>
        <Wordmark />
        <div className="counter">{idx + 1}<small>/{n}</small></div>
      </div>

      <div className="hintline" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.div
            key={hint}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
          >
            {hint}
          </motion.div>
        </AnimatePresence>
      </div>

      <div
        className="deal"
        ref={area}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
      >
        {cardW > 0 && cards.map((c, i) => {
          const d = i - idx;
          const isCur = d === 0;
          const color = RARITY_COLOR[c.rarity];
          const top = isTop(c.rarity);
          const isShown = !!shown[i];
          return (
            <motion.div
              key={c.id}
              data-i={i}
              className="dealcard"
              role="button"
              aria-label={`Carte ${i + 1} sur ${n}${isShown ? "" : ", face cachée"}`}
              style={{
                width: cardW, height: cardH, marginLeft: -cardW / 2, marginTop: -cardH / 2,
                zIndex: 20 - Math.abs(d), pointerEvents: Math.abs(d) > 1 ? "none" : "auto",
              }}
              initial={dealt ? { x: 0, y: cardH * 0.45, scale: 0.35, opacity: 0, rotate: (i - 2) * 9 } : false}
              animate={{
                x: d * step + dragX, y: 0, rotate: 0,
                scale: isCur ? 1 : 0.8,
                opacity: Math.abs(d) > 1 ? 0 : isCur ? 1 : 0.7,
              }}
              transition={
                dragX !== 0 && !intro
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 240, damping: 26, delay: intro ? 0.15 + i * 0.1 : 0 }
              }
            >
              {/* halo de rareté */}
              <motion.span
                className="aura"
                style={{ background: color }}
                animate={{
                  opacity: charging === i ? [0.2, 0.95, 0.4, 1] : isShown ? (top ? [0.45, 0.85, 0.45] : 0.35) : 0,
                  scale: charging === i ? [1, 1.25, 1.1, 1.35] : 1,
                }}
                transition={
                  charging === i ? { duration: 1, ease: "easeIn" }
                    : isShown && top ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.5 }
                }
              />
              {isCur && isShown && top && (
                <motion.span
                  className="rays"
                  style={{ ["--rc" as string]: color }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.55, rotate: 360 }}
                  transition={{ opacity: { duration: 0.8 }, rotate: { duration: 16, repeat: Infinity, ease: "linear" } }}
                />
              )}

              <motion.div
                className="shake"
                animate={charging === i ? { x: [0, -5, 5, -7, 7, -9, 9, -5, 5, 0], y: -8, scale: 1.07 } : { x: 0, y: 0, scale: 1 }}
                transition={charging === i ? { duration: 1, ease: "easeIn" } : { duration: 0.25 }}
              >
                <motion.div
                  className="flipper"
                  animate={{ rotateY: isShown ? 180 : 0 }}
                  initial={false}
                  transition={{ duration: top ? 0.95 : 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <div className="face back"><CardBack /></div>
                  <div className="face front"><Card card={c} /></div>
                </motion.div>
              </motion.div>

              {fx?.i === i && <Burst key={fx.key} rarity={c.rarity} size={cardW * 0.8} />}

              {isCur && isShown && o.isNew?.[i] !== undefined && (
                <motion.span
                  className={`newtag ${o.isNew[i] ? "yes" : ""}`}
                  initial={{ scale: 0, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18, delay: fx?.i === i ? (top ? 0.9 : 0.5) : 0 }}
                >
                  {o.isNew[i] ? "NOUVEAU !" : "DOUBLON"}
                </motion.span>
              )}
            </motion.div>
          );
        })}

        {/* flash de couleur plein écran pour les UR / LR */}
        {fx && isTop(cards[fx.i]!.rarity) && (
          <motion.div
            key={fx.key}
            className="colorflash"
            style={{ background: `radial-gradient(circle at 50% 50%, ${RARITY_COLOR[cards[fx.i]!.rarity]}, transparent 70%)` }}
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
          />
        )}
      </div>

      <div className="rarityline">
        {curShown && cur && (
          <motion.span key={cur.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ color: RARITY_COLOR[cur.rarity] }}>
            {curTop ? `✦ Carte ${cur.rarity} · passif débloqué ✦` : `Carte ${cur.rarity}`}
          </motion.span>
        )}
      </div>

      <div className="dots">
        {cards.map((c, i) => (
          <button
            key={c.id}
            aria-label={`Aller à la carte ${i + 1}`}
            className={i === idx ? "on" : ""}
            style={shown[i] ? { background: RARITY_COLOR[c.rarity], borderColor: RARITY_COLOR[c.rarity] } : undefined}
            onClick={() => charging === null && goTo(i)}
          />
        ))}
      </div>

      {allShown ? (
        <button className="btn primary" onClick={() => g.finishOpening()}>Voir mon butin</button>
      ) : (
        <button className="btn ghost small" onClick={revealAll} disabled={charging !== null}>Tout révéler</button>
      )}
    </div>
  );
}

/* ───────────────────────── Le butin ───────────────────────── */

function Summary({ go }: { go: (t: Tab) => void }) {
  const g = useGame();
  const o = g.opening!;
  const cards = o.cardIds.map((id) => g.player.cards.find((c) => c.id === id)).filter((c): c is OwnedCard => !!c);
  const newCount = (o.isNew ?? []).filter(Boolean).length;
  const counts = RARITIES.map((r) => ({ r, n: cards.filter((c) => c.rarity === r).length })).filter((x) => x.n > 0).reverse();
  const nextBooster = g.player.boosters[0];

  const deckFull = g.player.deck.length >= 5;
  const gain = useMemo(() => {
    const best = bestDeckIds(g.player.cards);
    const bestCards = best.map((id) => g.player.cards.find((c) => c.id === id)!);
    return deckPower(bestCards) - deckPower(g.deckCards);
  }, [g.player.cards, g.deckCards]);
  const deckNudge = !deckFull ? "Compose ton deck" : gain > 0 ? `Améliorer mon deck (+${gain})` : null;

  return (
    <div className="stage scroll">
      <div className="head">
        <span />
        <Wordmark />
        <span />
      </div>
      <div className="center-copy">
        <h1>Ton butin</h1>
        <p>
          {newCount > 0 ? <><b style={{ color: "var(--lime)" }}>{newCount} nouvelle{newCount > 1 ? "s" : ""} carte{newCount > 1 ? "s" : ""}</b> pour ta collection</> : "Que des doublons cette fois"}
        </p>
        {o.pityTriggered && <p className="tagline">✦ Garantie UR déclenchée</p>}
      </div>

      <div className="loot">
        {cards.map((c, i) => (
          <motion.div
            key={c.id}
            className="lootcell"
            style={{ ["--lc" as string]: RARITY_COLOR[c.rarity] }}
            initial={{ opacity: 0, y: 28, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.08 * i }}
          >
            <div className={`lootcard ${isTop(c.rarity) ? "top" : ""}`}><Card card={c} /></div>
            {o.isNew && <span className={`lt ${o.isNew[i] ? "yes" : ""}`}>{o.isNew[i] ? "NOUVEAU" : "DOUBLON"}</span>}
          </motion.div>
        ))}
      </div>

      <div className="rarsum">
        {counts.map(({ r, n }) => (
          <span key={r} style={{ color: RARITY_COLOR[r] }}>{n} × {r}</span>
        ))}
      </div>

      <div className="acts-col">
        {nextBooster && (
          <button className="btn primary" onClick={() => g.startOpening(nextBooster.id)}>
            Booster suivant ({g.player.boosters.length})
          </button>
        )}
        {deckNudge && (
          <button className={`btn ${nextBooster ? "ghost" : "primary"} small`} onClick={() => { g.closeOpening(); go("gymdeck"); }}>{deckNudge}</button>
        )}
        <button className="btn ghost small" onClick={() => { g.closeOpening(); go("collection"); }}>Voir ma collection</button>
        <button className="link center" onClick={() => { g.closeOpening(); go("home"); }}>Retour à l’accueil</button>
      </div>
    </div>
  );
}
