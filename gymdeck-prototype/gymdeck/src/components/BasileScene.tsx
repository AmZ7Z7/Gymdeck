"use client";

import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Card, Medal } from "./Card";
import { GRADE_LABEL, gradeColor, gradeMedal } from "@/lib/config";
import type { CardData } from "@/lib/engine";

/**
 * Atelier de Basile : décor fixe, un seul personnage complet affiché à la fois, poses recalées dans un repère commun
 * (tools/basile_frames.py), carte réelle couchée sur le tapis. Lecture image par image (~12 images/s), sans fondu :
 * chaque pose remplace la précédente, comme un dessin animé.
 *
 * Séquence : repos (clignement toutes les 3 à 6 s) → la loupe monte à l'œil → il se penche → inspection → il se
 * redresse → signe de tête et médaille de la note → repos.
 */

interface Atlas { src: string; cols: number; rows: number; names: string[] }
const IDLE: Atlas = { src: "/assets/atelier/basile-repos.webp", cols: 3, rows: 2, names: ["A0", "A1", "A2", "J1", "J2", "J3"] };
const EVAL: Atlas = {
  src: "/assets/atelier/basile-expertise.webp", cols: 6, rows: 4,
  names: ["B0", "B1", "B2", "B3", "C0", "C1", "C2", "C3", "D0", "D1", "D2", "D3", "E0", "E1", "E2", "E3", "G1", "G2", "G3", "H1", "H2", "H3", "I1", "I2"],
};
const DECOR = "/assets/atelier/atelier-decor.webp";

interface Frame { a: Atlas; i: number }
export type Cue = "inspect" | "stamp" | "end";
interface Step { f: Frame; ms: number; cue?: Cue }
const FRAME: Record<string, Frame> = {};
for (const a of [IDLE, EVAL]) a.names.forEach((n, i) => { FRAME[n] = { a, i }; });
/** Écrit une suite de poses : "B0:90 B1 B2 …" (durée en ms, 85 par défaut) ; "!inspect" / "!stamp" posent un repère. */
const seq = (txt: string): Step[] => txt.trim().split(/\s+/).map((tok) => {
  const [body = "", cue] = tok.split("!");
  const [n = "", ms] = body.split(":");
  const f = FRAME[n];
  if (!f) throw new Error(`pose inconnue : ${n}`);
  return { f, ms: ms ? Number(ms) : 85, ...(cue ? { cue: cue as Cue } : {}) };
});

const REST = FRAME.A0 as Frame;
/** Clignement (jamais en boucle continue). */
const BLINK = seq("A1:55 A2:80 A1:55");
/** Expertise complète (≈ 4,2 s). */
const EVALUATE = seq(`
  B0:95 B1 B2 B3 C0 C1 C2 C3:95 D0 D1 D2 D3:95!inspect
  E0:115 E1:110 E2:120 E3:170 E2:105 E1:105 E0:130 E1:100 E2:110 E3:180 E2:100 E1:100 E0:130
  G1:90 G2:90 G3:100 H1:90 H2 I1 H3 I2:95 A0:170
  J1:80 J2:80 J3:300!stamp J2:90 J1:90
`);
/** Petit signe de tête (carte confiée). */
const NOD = seq("J1:80 J2:80 J3:260 J2:90 J1:90");

const bgPos = (f: Frame) => {
  const c = f.i % f.a.cols, r = Math.floor(f.i / f.a.cols);
  return `${f.a.cols > 1 ? (c / (f.a.cols - 1)) * 100 : 0}% ${f.a.rows > 1 ? (r / (f.a.rows - 1)) * 100 : 0}%`;
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
  const [status, setStatus] = useState<"loading" | "idle" | "full" | "error">("loading");
  const [inspect, setInspect] = useState(false);
  const quake = useAnimationControls();
  const raf = useRef(0);
  const timers = useRef<number[]>([]);
  const busy = useRef(false);
  const fullReady = useRef<Promise<void> | null>(null);
  const cueRef = useRef(onCue);
  cueRef.current = onCue;
  const reduced = useRef(false);

  const clear = () => { cancelAnimationFrame(raf.current); timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  const show = (f: Frame) => setFrame((cur) => (cur === f ? cur : f));

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

  /** Joue une suite de poses à l'horloge de l'écran (requestAnimationFrame) : pas de dérive, pas d'à-coups. */
  const play = (steps: Step[], end: () => void, blink = false) => {
    clear();
    busy.current = !blink;
    const starts: number[] = [];
    let total = 0;
    for (const st of steps) { starts.push(total); total += st.ms; }
    let t0 = 0;
    let last = -1;
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const t = now - t0;
      if (t >= total) { show(REST); busy.current = false; end(); return; }
      const at = (j: number) => steps[j] as Step;
      let k = last < 0 ? 0 : last;
      while (k + 1 < steps.length && (starts[k + 1] ?? Infinity) <= t) k++;
      if (k !== last) {
        // repères de toutes les poses franchies (même si l'écran a sauté une image)
        for (let j = last + 1; j <= k; j++) {
          const cue = at(j).cue;
          if (cue === "inspect") { setInspect(true); timers.current.push(window.setTimeout(() => setInspect(false), 1700)); }
          if (cue === "stamp") { void quake.start({ x: [0, -3, 3, -2, 2, 0], y: [0, 2, -1, 1, 0], transition: { duration: 0.32 } }); cueRef.current?.("stamp"); }
        }
        last = k;
        show(at(k).f);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  // clignement toutes les 3 à 6 secondes, seulement au repos
  useEffect(() => {
    if (status === "loading" || status === "error" || reduced.current) return;
    let alive = true;
    let t: number;
    const schedule = () => {
      t = window.setTimeout(() => {
        if (!alive) return;
        if (!busy.current && document.visibilityState === "visible") play(BLINK, () => undefined, true);
        schedule();
      }, 3000 + Math.random() * 3000);
    };
    schedule();
    return () => { alive = false; window.clearTimeout(t); };
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <motion.div className="scene" animate={quake}>
      <img className="scene-decor" src={DECOR} alt="" draggable={false} />
      <div className="golem" role="img" aria-label="Basile, le golem expert, derrière son bureau">
        {/* deux calques (un par atlas), toujours peints : passer de l'un à l'autre ne fait jamais clignoter */}
        {[IDLE, EVAL].map((a) => (
          <div
            key={a.src}
            className="golem-frame"
            style={{
              backgroundImage: status === "loading" || (a === EVAL && status !== "full") ? undefined : `url(${a.src})`,
              backgroundSize: `${a.cols * 100}% ${a.rows * 100}%`,
              backgroundPosition: frame.a === a ? bgPos(frame) : "0% 0%",
              opacity: frame.a === a ? 1 : 0,
            }}
          />
        ))}
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
            className={`stamp m-${gradeMedal(stamp)}`}
            initial={{ scale: 2.4, rotate: -22, opacity: 0 }}
            animate={{ scale: 1, rotate: -6, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 520, damping: 17, mass: 0.9 }}
          >
            <motion.span className="stamp-dust" style={{ ["--gc" as string]: gradeColor(stamp) }} initial={{ scale: 0.6, opacity: 0.9 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 0.6, ease: "easeOut" }} />
            <Medal grade={stamp} className="stamp-medal" />
            <span className="stamp-label" style={{ ["--gc" as string]: gradeColor(stamp) }}>{GRADE_LABEL[stamp]}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {status === "loading" && <div className="scene-loading" aria-hidden><span /></div>}
      {status === "error" && <div className="scene-error">Basile n’a pas pu s’afficher. Tu peux quand même faire expertiser tes cartes.</div>}
    </motion.div>
  );
}
