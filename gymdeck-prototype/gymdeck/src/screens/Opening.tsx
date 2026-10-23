"use client";

import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardBack } from "@/components/Card";
import { Wordmark } from "@/components/Bits";
import { shareCards } from "@/lib/share";
import { useGame } from "@/components/GameProvider";
import { IconBack } from "@/components/Icons";
import { RARITIES, RARITY_COLOR, RARITY_RANK, type Rarity } from "@/lib/config";
import { sfx, unlockAudio } from "@/lib/sound";
import { LegendaryFX, LegendSparkles } from "@/components/LegendaryFX";
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
  const [flash, setFlash] = useState<{ n: number; color: string }>({ n: 0, color: "#fff" });

  const burst = useCallback((color: string) => { setFlash((f) => ({ n: f.n + 1, color })); setPackDone(true); }, []);

  return (
    <>
      {o.phase === "summary" ? (
        <Summary go={go} />
      ) : !packDone ? (
        <PackStage go={go} onBurst={burst} />
      ) : (
        <Cards go={go} dealt={dealt} />
      )}
      {flash.n > 0 && (
        <motion.div
          key={flash.n}
          className="whiteflash"
          style={{ background: `radial-gradient(circle at 50% 50%, #fff 0%, ${flash.color} 70%)` }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      )}
    </>
  );
}

/* ───────────────────────── Le paquet ───────────────────────── */

/** Lumière qui sort du paquet : toujours la même, pour ne rien dévoiler du tirage. */
const lightFor = (_best: Rarity) => "#f4ffc4";

function PackStage({ go, onBurst }: { go: (t: Tab) => void; onBurst: (color: string) => void }) {
  const g = useGame();
  const o = g.opening!;
  const [step, setStep] = useState<"idle" | "charge" | "tear">("idle");

  // Meilleure rareté du tirage (déjà enregistré dès le toucher) : sert à teinter la lumière.
  const bestRef = useRef<Rarity>("C");
  const drawn = o.cardIds.map((id) => g.player.cards.find((c) => c.id === id)).filter((c): c is OwnedCard => !!c);
  if (drawn.length) bestRef.current = drawn.reduce((b, c) => (RARITY_RANK[c.rarity] > RARITY_RANK[b] ? c.rarity : b), "C" as Rarity);

  const open = () => {
    if (step !== "idle") return;
    unlockAudio();
    setStep("charge");
    g.openNow(); // tirage généré et sauvegardé immédiatement, avant l'animation
    sfx.charge(0.95);
    try { navigator.vibrate?.([20, 40, 30, 40, 40]); } catch { /* ignoré */ }
    window.setTimeout(() => { setStep("tear"); sfx.tear(); try { navigator.vibrate?.(60); } catch { /* ignoré */ } }, 950);
    window.setTimeout(() => sfx.burst(), 1230);
    window.setTimeout(() => onBurst(lightFor(bestRef.current)), 1380);
  };

  const charging = step === "charge";
  const tearing = step === "tear";
  const light = lightFor(bestRef.current);
  const rainbow = false;

  return (
    <div className="stage">
      <div className="head">
        <button className="backbtn" aria-label="Retour" onClick={() => { g.closeOpening(); go("home"); }}><IconBack width={22} height={22} /></button>
        <Wordmark />
        <span />
      </div>
      <div className="center-copy">
        <h1>Ton booster</h1>
        <p>{step === "idle" ? "Touche le booster pour l’ouvrir." : charging ? "Ça vibre…" : "Il s’ouvre !"}</p>
        {o.kind === "welcome2" && <p className="tagline">✦ Booster de bienvenue amélioré</p>}
        {o.kind === "welcome1" && <p className="tagline">✦ Booster de bienvenue</p>}
        {o.kind === "streak" && <p className="tagline">✦ Booster de série amélioré</p>}
      </div>

      <div className="packstage">
        <motion.div
          className="packaura"
          animate={
            tearing ? { opacity: 1, scale: 2.6 }
              : charging ? { opacity: [0.4, 1], scale: [1, 2.1] }
                : { opacity: [0.35, 0.6, 0.35], scale: [1, 1.08, 1] }
          }
          transition={tearing ? { duration: 0.4 } : charging ? { duration: 0.95, ease: "easeIn" } : { duration: 3, repeat: Infinity }}
        />
        {(charging || tearing) && (
          <motion.div
            className={`packrays ${tearing && rainbow ? "rainbow" : ""}`}
            style={tearing && !rainbow ? { background: `repeating-conic-gradient(from 0deg, ${light} 0 4deg, transparent 4deg 14deg)` } : undefined}
            initial={{ opacity: 0, rotate: 0, scale: 0.8 }}
            animate={tearing ? { opacity: 1, rotate: 140, scale: 1.25 } : { opacity: [0, 0.8], rotate: 70, scale: 1 }}
            transition={{ duration: tearing ? 0.55 : 0.95, ease: "easeIn" }}
          />
        )}

        <motion.button
          className="pack"
          aria-label="Ouvrir le booster"
          disabled={step !== "idle"}
          onClick={open}
          animate={
            charging
              ? { rotate: [0, -3, 3, -5, 5, -7, 7, -9, 9, 0], scale: [1, 1.03, 1.06, 1.09, 1.12, 1.15, 1.2, 1.26, 1.3, 1.34], y: 0 }
              : tearing
                ? { rotate: 0, scale: 1.38, y: 26, opacity: [1, 1, 0] }
                : { y: [0, -9, 0], rotate: 0, scale: 1 }
          }
          transition={
            charging ? { duration: 0.95, ease: "easeIn" }
              : tearing ? { duration: 0.5, ease: "easeIn" }
                : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
          }
          whileTap={{ scale: 0.96 }}
        >
          <div className="tearwrap">
            {/* corps du paquet */}
            <img className="tbody" src="/assets/ui/booster.webp" alt="Booster" draggable={false} />
            {/* haut du paquet : il s'arrache et s'envole */}
            <motion.img
              className="tflap"
              src="/assets/ui/booster.webp"
              alt=""
              draggable={false}
              animate={tearing ? { y: -170, x: 40, rotate: 28, opacity: 0 } : { y: 0, x: 0, rotate: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
            {/* lumière qui jaillit de la déchirure */}
            {tearing && (
              <motion.span
                className="tbeam"
                style={{ background: `radial-gradient(ellipse 50% 100% at 50% 100%, #fff 0, ${light} 38%, transparent 72%)` }}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 4, opacity: [0, 1, 0.55] }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              />
            )}
          </div>
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
  const [legend, setLegend] = useState<"charge" | "boom" | null>(null); // cinématique d'une carte LR
  const [fx, setFx] = useState<{ i: number; key: number } | null>(null);
  const [intro, setIntro] = useState(dealt);
  const [dragX, setDragX] = useState(0);
  // Cartes déjà passées : elles sont parties à gauche (-1) ou à droite (1) de la pile.
  const [flyDir, setFlyDir] = useState<number[]>(() => o.cardIds.map(() => -1));
  const [holding, setHolding] = useState<number | null>(null); // doigt posé longtemps sur une carte : on voit sa couleur
  const [tilt, setTilt] = useState({ x: 0, y: 0 }); // inclinaison de la carte sous le doigt, entre -1 et 1
  const holdTimer = useRef<number | null>(null);
  const shakeCtl = useAnimationControls();
  const [area, box] = useBox<HTMLDivElement>();

  useEffect(() => { if (dealt) sfx.deal(5); }, [dealt]);

  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(() => setIntro(false), 1500);
    return () => clearTimeout(t);
  }, [intro]);

  // Taille des cartes : on remplit la zone sans jamais dépasser 72 % de la largeur ni sa hauteur (avec la place de la pile).
  const cardW = Math.max(120, Math.min(box.w * 0.72, ((box.h - 40) / 1.44)));
  const cardH = cardW * 1.44;
  const step = cardW * 1.0;

  const goTo = useCallback((i: number) => {
    const next = Math.max(0, Math.min(n - 1, i));
    if (next !== idx) sfx.slide();
    setIdx(next);
    g.setIndex(next);
  }, [n, g, idx]);

  const flipNow = (i: number) => {
    setShown((s) => s.map((v, k) => (k === i ? true : v)));
    setFx({ i, key: Date.now() });
    const r = cards[i]!.rarity;
    sfx.flip();
    if (r === "LR") {
      sfx.legendary();
      setLegend("boom");
      window.setTimeout(() => setLegend(null), 3000);
    } else {
      window.setTimeout(() => sfx.reveal(r), isTop(r) ? 260 : 130);
    }
    if (isTop(r)) {
      try { navigator.vibrate?.([40, 40, 80]); } catch { /* ignoré */ }
      const big = r === "LR";
      void shakeCtl.start({ x: big ? [0, -16, 16, -13, 13, -9, 9, -5, 5, 0] : [0, -9, 9, -7, 7, -4, 4, 0], y: big ? [0, 7, -7, 5, -5, 2, 0] : 0, transition: { duration: big ? 0.8 : 0.5 } }); // l'écran tremble
    }
  };

  /** Aucun indice avant de retourner la carte : la cinématique LR se joue une fois la carte visible. */
  const doReveal = (i: number) => {
    if (charging !== null || shown[i]) return;
    g.reveal(i); // enregistré tout de suite : si on quitte, la carte reste révélée
    if (cards[i]!.rarity === "LR") {
      setShown((s) => s.map((v, k) => (k === i ? true : v)));
      sfx.flip();
      setCharging(i);
      setLegend("charge"); sfx.legendCharge();
      try { navigator.vibrate?.([30, 60, 30, 60, 30, 60, 40, 40, 40, 40, 80]); } catch { /* ignoré */ }
      window.setTimeout(() => { setCharging(null); flipNow(i); }, 1900);
    } else {
      flipNow(i);
    }
  };

  // Comme dans Pokémon : la carte qui arrive sur le dessus de la pile se retourne toute seule (un seul geste par carte).
  const revealRef = useRef(doReveal);
  revealRef.current = doReveal;
  useEffect(() => {
    if (intro || charging !== null || shown[idx]) return;
    const t = window.setTimeout(() => revealRef.current(idx), 320);
    return () => window.clearTimeout(t);
  }, [idx, intro, charging, shown]);

  /** La carte du dessus quitte la pile (vers la gauche ou la droite) : la suivante, derrière, passe devant. */
  const advance = (dir: number) => {
    if (idx < n - 1) {
      setFlyDir((f) => f.map((v, k) => (k === idx ? dir : v)));
      goTo(idx + 1);
      return;
    }
    sfx.good();
    g.finishOpening();
  };

  /** Toucher ou glisser la carte du dessus : la révéler si elle est cachée, sinon passer à celle de derrière. */
  const act = (dir: number) => {
    if (charging !== null) return;
    if (!shown[idx]) return doReveal(idx);
    advance(dir);
  };
  const tap = () => act(-1);

  const revealAll = () => {
    if (charging !== null) return;
    g.revealAll();
    sfx.flip();
    setShown(cards.map(() => true));
  };

  // Clavier (ordinateur) : flèches pour naviguer, Entrée / espace pour toucher la carte.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") act(1);
      else if (e.key === "ArrowLeft") act(-1);
      else if (e.key === "Backspace") goTo(idx - 1);
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(); }
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
    unlockAudio();
    const target = el ? Number(el.dataset.i) : idx;
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    if (target === idx && charging === null) {
      // appui long sur une carte face cachée : sa couleur de rareté se met à briller autour du dos
      holdTimer.current = window.setTimeout(() => {
        if (press.current && !press.current.moved) {
          setHolding(idx);
          try { navigator.vibrate?.(14); } catch { /* ignoré */ }
        }
      }, 230);
    }
    tiltFrom(e);
  };
  const tiltFrom = (e: React.PointerEvent) => {
    const r = area.current?.getBoundingClientRect();
    if (!r || press.current?.moved) return;
    const tx = (e.clientX - r.left - r.width / 2) / (cardW / 2);
    const ty = (e.clientY - r.top - r.height / 2) / (cardH / 2);
    setTilt({ x: Math.max(-1, Math.min(1, tx)), y: Math.max(-1, Math.min(1, ty)) });
  };
  const endPress = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    setHolding(null);
    setTilt({ x: 0, y: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    const p = press.current;
    if (!p || charging !== null) return;
    const dx = e.clientX - p.x;
    if (Math.abs(dx) > 10) { p.moved = true; endPress(); }
    if (p.moved) setDragX(Math.max(-step, Math.min(step, dx)));
    else tiltFrom(e);
  };
  const onUp = (e: React.PointerEvent) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    const dx = e.clientX - p.x;
    setDragX(0);
    endPress();
    if (p.moved) {
      const v = dx / Math.max(1, Date.now() - p.t); // px/ms
      // glisser vers la gauche ou la droite : la carte part de ce côté
      if (Math.abs(dx) > step * 0.22 || Math.abs(v) > 0.45) act(dx < 0 ? -1 : 1);
    } else {
      tap(); // un appui n'importe où sur la pile compte comme un appui sur la carte du dessus
    }
  };
  const onCancel = () => { press.current = null; setDragX(0); endPress(); };

  const allShown = shown.length > 0 && shown.every(Boolean);
  const cur = cards[idx];
  const curShown = !!shown[idx];
  const curTop = !!cur && isTop(cur.rarity);

  const hint = charging !== null
    ? "Attention…"
    : !curShown
      ? "La carte se retourne…"
      : idx < n - 1
        ? "Touche ou glisse pour la suivante"
        : "Touche ou glisse pour voir ton butin";

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

      <motion.div
        className="deal"
        animate={shakeCtl}
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
                // pile : la carte du dessus devant, les suivantes derrière ; les cartes passées s'envolent par-dessus
                zIndex: d < 0 ? 40 : 30 - d * 2, pointerEvents: isCur ? "auto" : "none",
              }}
              initial={dealt ? { x: 0, y: cardH * 0.45, scale: 0.35, opacity: 0, rotate: (i - 2) * 9 } : false}
              animate={
                d < 0
                  ? { x: flyDir[i]! * (box.w / 2 + cardW), y: -cardH * 0.08, rotate: flyDir[i]! * 24, scale: 0.95, opacity: 0 }
                  : {
                    x: isCur ? dragX : 0,
                    y: -d * cardH * 0.05, // les cartes de derrière dépassent au-dessus
                    rotate: isCur ? dragX * 0.06 : 0,
                    scale: 1 - d * 0.05,
                    opacity: d > 3 ? 0 : 1,
                  }
              }
              transition={
                dragX !== 0 && !intro
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 240, damping: 26, delay: intro ? 0.15 + i * 0.1 : 0 }
              }
            >
              {/* halo de rareté */}
              <motion.span
                className={`aura ${c.rarity === "LR" ? "rainbow" : ""}`}
                style={{ background: color }}
                animate={{
                  opacity: charging === i ? [0.2, 0.95, 0.4, 1]
                    : isShown ? (top ? [0.45, 0.85, 0.45] : 0.35) : 0,
                  scale: charging === i ? [1, 1.25, 1.1, 1.35] : 1,
                }}
                transition={
                  charging === i ? { duration: c.rarity === "LR" ? 1.9 : 1, ease: "easeIn" }
                    : isShown && top ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.5 }
                }
              />
              {isCur && isShown && top && (
                <motion.span
                  className={`rays ${c.rarity === "LR" ? "rainbow" : ""}`}
                  style={{ ["--rc" as string]: color }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.55, rotate: 360 }}
                  transition={{ opacity: { duration: 0.8 }, rotate: { duration: 16, repeat: Infinity, ease: "linear" } }}
                />
              )}

              <motion.div
                className="shake"
                style={{ transformPerspective: 900 }}
                animate={
                  charging === i ? (c.rarity === "LR"
                    ? { x: 0, y: [0, -6, -16, -26], scale: [1, 1.04, 1.1, 1.2], rotate: [0, -3, 2.5, -1.5, 0], rotateY: [0, 10, -8, 0], rotateX: 0 }
                    : { x: [0, -5, 5, -7, 7, -9, 9, -5, 5, 0], y: -8, scale: 1.1, rotate: 0, rotateX: 0, rotateY: 0 })
                    : { x: 0, y: 0, rotate: 0, scale: isCur && holding !== null ? 1.04 : 1, rotateY: isCur ? tilt.x * 14 : 0, rotateX: isCur ? -tilt.y * 14 : 0 }
                }
                transition={charging === i ? { duration: c.rarity === "LR" ? 1.9 : 1.05, ease: "easeIn" } : { type: "spring", stiffness: 260, damping: 20 }}
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
              {isCur && isShown && c.rarity === "LR" && <LegendSparkles cardW={cardW} />}

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

        {/* l'écran s'assombrit pendant le suspense d'une UR / LR */}
        <motion.div className="dimmer" initial={false} animate={{ opacity: charging !== null ? 1 : 0 }} transition={{ duration: 0.4 }} />

        {/* cinématique de la carte légendaire */}
        <LegendaryFX phase={legend} cardW={cardW} />

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
      </motion.div>

      <div className="rarityline">
        {curShown && cur && (
          <motion.span key={cur.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ color: RARITY_COLOR[cur.rarity] }}>
            {cur.rarity === "LR" ? <span className="rbw">✦ LÉGENDAIRE · passif débloqué ✦</span> : curTop ? `✦ Carte ${cur.rarity} · passif débloqué ✦` : `Carte ${cur.rarity}`}
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

      {o.guest ? (
        <div className="acts-col">
          <p className="guestcta">Crée ton compte pour garder ces cartes et ouvrir 2 boosters de plus</p>
          <button className="btn primary" onClick={() => g.closeOpening()}>Créer mon compte</button>
        </div>
      ) : (
      <div className="acts-col">
        {nextBooster && (
          <button className="btn primary" onClick={() => g.startOpening(nextBooster.id)}>
            Booster suivant ({g.player.boosters.length})
          </button>
        )}
        {deckNudge && (
          <button className={`btn ${nextBooster ? "ghost" : "primary"} small`} onClick={() => { g.closeOpening(); go("gymdeck"); }}>{deckNudge}</button>
        )}
        <button className="btn ghost small" onClick={async () => g.say(await shareCards(cards, g.player.name ?? "Joueur"))}>Partager mon tirage</button>
        <button className="btn ghost small" onClick={() => { g.closeOpening(); go("collection"); }}>Voir ma collection</button>
        <button className="link center" onClick={() => { g.closeOpening(); go("home"); }}>Retour à l’accueil</button>
      </div>
      )}
    </div>
  );
}
