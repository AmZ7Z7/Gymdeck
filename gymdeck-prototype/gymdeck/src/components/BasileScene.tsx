"use client";

import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Card, Medal } from "./Card";
import { GRADE_LABEL, gradeColor, gradeMedal } from "@/lib/config";
import type { CardData } from "@/lib/engine";

/**
 * Atelier de Basile : une image fixe tant qu'il attend, puis de courtes vidéos (30 images/s, images intermédiaires
 * calculées entre les poses dessinées, décor intégré) quand on lui confie une carte et pendant l'expertise.
 * Chaque vidéo commence et finit exactement sur l'image fixe : aucun saut. Fabriquées par tools/basile_video.py.
 */

const STILL = "/assets/atelier/basile-repos.webp";
const VIDEO = {
  evaluate: { src: "/assets/atelier/basile-expertise", cues: { inspect: 1.3, stamp: 4.32 } },
  nod: { src: "/assets/atelier/basile-signe", cues: {} as Record<string, number> },
} as const;
type Clip = keyof typeof VIDEO;

export type Cue = "inspect" | "stamp" | "end";
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
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  /** Vidéo affichée par-dessus l'image fixe (elle reste visible sur sa dernière image, identique à l'image fixe). */
  const [shown, setShown] = useState<Clip | null>(null);
  const [inspect, setInspect] = useState(false);
  const quake = useAnimationControls();
  const vids = useRef<Record<Clip, HTMLVideoElement | null>>({ evaluate: null, nod: null });
  const raf = useRef(0);
  const cueRef = useRef(onCue);
  cueRef.current = onCue;
  const reduced = useRef(false);
  const token = useRef(0);

  useEffect(() => {
    reduced.current = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const im = new Image();
    im.onload = () => setStatus("ready");
    im.onerror = () => setStatus("error");
    im.src = STILL;
    return () => cancelAnimationFrame(raf.current);
  }, []);

  /** Lance une vidéo depuis le début ; les repères (loupe, tampon) suivent le temps réel de la vidéo. */
  const play = async (clip: Clip, onEnd: () => void): Promise<boolean> => {
    const v = vids.current[clip];
    if (!v) return false;
    cancelAnimationFrame(raf.current);
    const me = ++token.current;
    try {
      v.currentTime = 0;
      await v.play();
    } catch {
      return false;
    }
    if (me !== token.current) { v.pause(); return false; } // abandonnée entre-temps (trop lente à charger)
    setShown(clip);
    const cues = Object.entries(VIDEO[clip].cues) as [Cue, number][];
    const fired = new Set<string>();
    const tick = () => {
      for (const [cue, at] of cues) {
        if (fired.has(cue) || v.currentTime < at) continue;
        fired.add(cue);
        if (cue === "inspect") { setInspect(true); window.setTimeout(() => setInspect(false), 1700); }
        if (cue === "stamp") { void quake.start({ x: [0, -3, 3, -2, 2, 0], y: [0, 2, -1, 1, 0], transition: { duration: 0.32 } }); cueRef.current?.("stamp"); }
      }
      if (v.ended) {
        // repères pas encore donnés (onglet en arrière-plan…) : on les donne quand même
        if (!fired.has("stamp") && cues.some(([c]) => c === "stamp")) cueRef.current?.("stamp");
        onEnd();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return true;
  };

  // lancement d'une séquence demandée par la page
  useEffect(() => {
    if (!run) return;
    let cancelled = false;
    const finish = () => { if (!cancelled) cueRef.current?.("end"); };
    if (run.kind === "nod") {
      if (!reduced.current && status !== "error") void play("nod", () => undefined);
      return () => { cancelled = true; };
    }
    // expertise : sans animation (mouvement réduit, vidéo indisponible) → résultat direct
    const instant = () => { window.setTimeout(() => { if (cancelled) return; cueRef.current?.("stamp"); window.setTimeout(finish, 400); }, 250); };
    if (reduced.current || status === "error") { instant(); return () => { cancelled = true; }; }
    const late = new Promise<false>((ok) => window.setTimeout(() => ok(false), 6000));
    void Promise.race([play("evaluate", finish), late]).then((ok) => { if (!cancelled && !ok) { token.current++; vids.current.evaluate?.pause(); setShown(null); instant(); } });
    return () => { cancelled = true; };
  }, [run?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div className="scene" animate={quake}>
      <img className="scene-still" src={STILL} alt="Basile, le golem expert, derrière son bureau" draggable={false} />
      {(Object.keys(VIDEO) as Clip[]).map((c) => (
        <video
          key={c}
          ref={(el) => { vids.current[c] = el; if (el) el.muted = true; }}
          className="scene-video"
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden
          style={{ opacity: shown === c ? 1 : 0 }}
        >
          <source src={`${VIDEO[c].src}.mp4`} type="video/mp4" />
          <source src={`${VIDEO[c].src}.webm`} type="video/webm" />
        </video>
      ))}
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
