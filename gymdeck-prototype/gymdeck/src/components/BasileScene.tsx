"use client";

import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Card } from "./Card";
import { GRADE_LABEL, gradeColor } from "@/lib/config";
import type { CardData } from "@/lib/engine";

/**
 * Atelier de Basile : décor fixe, un seul personnage complet affiché à la fois (aucun calque de bras),
 * poses recalées dans un repère commun (tools/basile_frames.py), carte réelle couchée sur le tapis.
 *
 * Séquence : repos (clignement toutes les 3 à 6 s) → descente → inspection à la loupe → retour,
 * signe de tête et tampon de la note → sourire → repos.
 */

interface Atlas { src: string; cols: number; rows: number }
const IDLE: Atlas = { src: "/assets/atelier/basile-repos.webp", cols: 4, rows: 2 };
const EVAL: Atlas = { src: "/assets/atelier/basile-expertise.webp", cols: 5, rows: 3 };
const DECOR = "/assets/atelier/atelier-decor.webp";

interface Frame { a: Atlas; i: number }
export type Cue = "inspect" | "stamp" | "end";
interface Step extends Frame { ms: number; fade?: number; cue?: Cue }
const F = (a: Atlas, i: number, ms: number, extra?: Partial<Step>): Step => ({ a, i, ms, ...extra });

const REST: Frame = { a: IDLE, i: 0 };
/** Clignement : joué vite, puis retour à la première case (jamais en boucle continue). */
const BLINK: Step[] = [F(IDLE, 1, 45), F(IDLE, 2, 45), F(IDLE, 3, 65), F(IDLE, 4, 45), F(IDLE, 5, 45), F(IDLE, 6, 45), F(IDLE, 7, 60)];
/** Expertise complète (≈ 3,7 s) : descente, inspection (petites variations de loupe), retour, signe de tête + tampon. */
const EVALUATE: Step[] = [
  F(EVAL, 0, 150, { fade: 120 }), F(EVAL, 1, 140), F(EVAL, 2, 150), F(EVAL, 3, 190, { cue: "inspect" }),
  F(EVAL, 4, 260), F(EVAL, 6, 220), F(EVAL, 5, 260), F(EVAL, 6, 200), F(EVAL, 4, 240), F(EVAL, 6, 320),
  F(EVAL, 7, 150), F(EVAL, 8, 140), F(EVAL, 9, 140), F(EVAL, 10, 150), F(EVAL, 11, 210),
  F(EVAL, 12, 240, { cue: "stamp" }), F(EVAL, 13, 320), F(EVAL, 14, 240),
];
/** Petit signe de tête (carte confiée). */
const NOD: Step[] = [F(EVAL, 11, 170, { fade: 110 }), F(EVAL, 12, 240), F(EVAL, 13, 300), F(EVAL, 14, 200)];

const bg = (f: Frame): React.CSSProperties => {
  const c = f.i % f.a.cols, r = Math.floor(f.i / f.a.cols);
  return {
    backgroundImage: `url(${f.a.src})`,
    backgroundSize: `${f.a.cols * 100}% ${f.a.rows * 100}%`,
    backgroundPosition: `${f.a.cols > 1 ? (c / (f.a.cols - 1)) * 100 : 0}% ${f.a.rows > 1 ? (r / (f.a.rows - 1)) * 100 : 0}%`,
  };
};

function load(src: string): Promise<void> {
  return new Promise((ok, ko) => {
    const im = new Image();
    im.onload = () => { void (im.decode ? im.decode().catch(() => undefined) : Promise.resolve()).then(() => ok()); };
    im.onerror = () => ko(new Error(src));
    im.src = src;
  });
}

export interface SceneRun { id: number; kind: "evaluate" | "nod" }

export function BasileScene({
  card, run, stamp, onCue,
}: {
  card: CardData | null;
  run: SceneRun | null;
  /** Note à afficher dans le tampon (indépendant du personnage). */
  stamp: number | null;
  onCue?: (cue: Cue) => void;
}) {
  const [frame, setFrame] = useState<Frame>(REST);
  const [ghost, setGhost] = useState<{ f: Frame; key: number; ms: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "full" | "error">("loading");
  const [inspect, setInspect] = useState(false);
  const quake = useAnimationControls();
  const frameRef = useRef<Frame>(REST);
  const timers = useRef<number[]>([]);
  const busy = useRef(false);
  const fullReady = useRef<Promise<void> | null>(null);
  const cueRef = useRef(onCue);
  cueRef.current = onCue;
  const reduced = useRef(false);

  const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  const show = (f: Frame, fade?: number) => {
    if (fade) setGhost({ f: frameRef.current, key: Date.now() + Math.random(), ms: fade });
    frameRef.current = f;
    setFrame(f);
  };

  // préchargement : décor + repos d'abord (affichage immédiat), puis les poses d'expertise en arrière-plan
  useEffect(() => {
    reduced.current = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let alive = true;
    Promise.all([load(DECOR), load(IDLE.src)])
      .then(() => { if (alive) setStatus("idle"); })
      .catch(() => { if (alive) setStatus("error"); });
    fullReady.current = load(EVAL.src).then(() => { if (alive) setStatus((s) => (s === "error" ? s : "full")); });
    fullReady.current.catch(() => undefined);
    return () => { alive = false; clear(); };
  }, []);

  /** Joue une suite de poses ; les repères (« cue ») préviennent la page (tampon, fin). */
  const play = (steps: Step[], end: () => void) => {
    clear();
    busy.current = true;
    let t = 0;
    steps.forEach((st) => {
      timers.current.push(window.setTimeout(() => {
        show(st, st.fade);
        if (st.cue === "inspect") { setInspect(true); timers.current.push(window.setTimeout(() => setInspect(false), 1700)); }
        if (st.cue === "stamp") { void quake.start({ x: [0, -3, 3, -2, 2, 0], y: [0, 2, -1, 1, 0], transition: { duration: 0.32 } }); cueRef.current?.("stamp"); }
      }, t));
      t += st.ms;
    });
    timers.current.push(window.setTimeout(() => { show(REST, 170); busy.current = false; end(); }, t));
  };

  // clignement toutes les 3 à 6 secondes, seulement au repos
  useEffect(() => {
    if (status === "loading" || status === "error" || reduced.current) return;
    let alive = true;
    let t: number;
    const schedule = () => {
      t = window.setTimeout(() => {
        if (!alive) return;
        if (!busy.current && document.visibilityState === "visible") {
          let k = 0;
          for (const st of BLINK) { window.setTimeout(() => { if (alive && !busy.current) show(st); }, k); k += st.ms; }
          window.setTimeout(() => { if (alive && !busy.current) show(REST); }, k);
        }
        schedule();
      }, 3000 + Math.random() * 3000);
    };
    schedule();
    return () => { alive = false; window.clearTimeout(t); };
  }, [status]);

  // lancement d'une séquence demandée par la page
  useEffect(() => {
    if (!run) return;
    let cancelled = false;
    const finish = () => { if (!cancelled) cueRef.current?.("end"); };
    if (run.kind === "nod") {
      if (reduced.current || status === "loading" || status === "error") return;
      void (fullReady.current ?? Promise.resolve()).then(() => { if (!cancelled) play(NOD, () => undefined); });
      return () => { cancelled = true; };
    }
    // expertise : sans animation (mouvement réduit ou images indisponibles) → résultat direct
    const instant = () => { window.setTimeout(() => { if (cancelled) return; cueRef.current?.("stamp"); window.setTimeout(finish, 400); }, 250); };
    if (reduced.current || status === "error") { instant(); return () => { cancelled = true; }; }
    const timeout = new Promise<"late">((ok) => window.setTimeout(() => ok("late"), 5000));
    void Promise.race([(fullReady.current ?? Promise.resolve()).then(() => "ok" as const), timeout])
      .then((r) => { if (cancelled) return; if (r === "late") instant(); else play(EVALUATE, finish); })
      .catch(() => { if (!cancelled) instant(); });
    return () => { cancelled = true; };
  }, [run?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const color = stamp ? gradeColor(stamp) : "#fff";

  return (
    <motion.div className="scene" animate={quake}>
      <img className="scene-decor" src={DECOR} alt="" draggable={false} />
      <div className="golem" role="img" aria-label="Basile, le golem expert, derrière son bureau">
        <div className="golem-frame" style={bg(frame)} />
        {ghost && <div key={ghost.key} className="golem-frame ghost" style={{ ...bg(ghost.f), animationDuration: `${ghost.ms}ms` }} onAnimationEnd={() => setGhost(null)} />}
      </div>
      <span className="desk-shadow" aria-hidden />
      <AnimatePresence>
        {card && (
          <motion.div
            key={`${card.exerciseSlug}-${card.rarity}-${card.atq}`}
            className={`matcard ${inspect ? "inspect" : ""}`}
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            <div className="matcard-in"><Card card={card} holo={false} /></div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {stamp && (
          <motion.div
            key={`stamp-${stamp}`}
            className={`stamp ${stamp >= 10 ? "perfect" : ""}`}
            style={{ ["--gc" as string]: color }}
            initial={{ scale: 2.6, rotate: -26, opacity: 0 }}
            animate={{ scale: 1, rotate: -9, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 520, damping: 17, mass: 0.9 }}
          >
            <motion.span className="stamp-dust" initial={{ scale: 0.6, opacity: 0.9 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ duration: 0.6, ease: "easeOut" }} />
            <svg viewBox="0 0 120 120" aria-hidden>
              <defs>
                <path id="arcTop" d="M 18 60 A 42 42 0 0 1 102 60" />
                <radialGradient id="stampFill" cx="35%" cy="28%" r="80%">
                  <stop offset="0" stopColor="#fff" stopOpacity=".9" />
                  <stop offset=".42" style={{ stopColor: "var(--gc)" }} />
                  <stop offset="1" style={{ stopColor: "var(--gc)" }} stopOpacity=".75" />
                </radialGradient>
              </defs>
              <circle cx="60" cy="60" r="57" className="ring0" />
              <circle cx="60" cy="60" r="54" className="ring1" fill="url(#stampFill)" />
              <circle cx="60" cy="60" r="47" className="ring2" />
              <text className="arc"><textPath href="#arcTop" startOffset="50%" textAnchor="middle">NOTE DE BASILE</textPath></text>
              <text x="60" y="80" textAnchor="middle" className="num">{stamp}</text>
              <text x="60" y="97" textAnchor="middle" className="ten">/10</text>
            </svg>
            <span className="stamp-label">{GRADE_LABEL[stamp]}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {status === "loading" && <div className="scene-loading" aria-hidden><span /></div>}
      {status === "error" && <div className="scene-error">Basile n’a pas pu s’afficher. Tu peux quand même faire expertiser tes cartes.</div>}
    </motion.div>
  );
}
