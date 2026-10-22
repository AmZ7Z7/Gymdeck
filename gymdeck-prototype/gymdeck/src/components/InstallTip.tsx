"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "./Sheet";

/**
 * Petit tuto « Ajouter GymDeck à l'écran d'accueil », sur téléphone, quelques secondes après l'arrivée dans le jeu.
 * Pas affiché si le site est déjà installé. « Plus tard » : il revient dans 3 jours ; « C'est fait » : plus jamais.
 * Sur Android, si le téléphone le permet, un bouton installe directement l'appli.
 */

const KEY = "gymdeck:install-tip";
const DELAY_MS = 6000;
const LATER_MS = 3 * 86_400_000;

type Os = "ios" | "android" | "other";
interface InstallPrompt extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const osOf = (): Os => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1)) return "ios";
  return /Android/.test(ua) ? "android" : "other";
};
const installed = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
const isPhone = () => window.matchMedia("(pointer: coarse)").matches && Math.min(window.screen.width, window.screen.height) < 820;

function readState(): { done?: boolean; later?: number } {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}
function writeState(s: { done?: boolean; later?: number }) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignoré */ }
}

/** Icône « Partager » d'iPhone (carré et flèche vers le haut). */
const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3v12M8 7l4-4 4 4" /><path d="M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" />
  </svg>
);
/** Icône « Sur l'écran d'accueil » (carré avec un +). */
const AddIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" />
  </svg>
);
/** Icône « menu » de Chrome (trois points verticaux). */
const DotsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
);

/** Les étapes, selon le téléphone. */
function Steps({ os }: { os: Os }) {
  if (os === "ios") {
    return (
      <ol className="it-steps">
        <li><span className="it-ico"><ShareIcon /></span><span>Touche le bouton <b>Partager</b> de Safari (en bas de l’écran, ou après <b>•••</b>).</span></li>
        <li><span className="it-ico"><AddIcon /></span><span>Fais défiler et choisis <b>Sur l’écran d’accueil</b>.</span></li>
        <li><span className="it-ico it-txt">Ajouter</span><span>Touche <b>Ajouter</b> en haut à droite. C’est tout !</span></li>
      </ol>
    );
  }
  return (
    <ol className="it-steps">
      <li><span className="it-ico"><DotsIcon /></span><span>Touche le menu <b>⋮</b> en haut à droite du navigateur.</span></li>
      <li><span className="it-ico"><AddIcon /></span><span>Choisis <b>Ajouter à l’écran d’accueil</b> (ou <b>Installer l’application</b>).</span></li>
      <li><span className="it-ico it-txt">OK</span><span>Confirme. L’icône GymDeck apparaît avec tes applis.</span></li>
    </ol>
  );
}

/** Le tuto, ouvert automatiquement (`auto`) ou à la demande depuis le profil. */
export function InstallTip({ auto = true, onClose }: { auto?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(!auto);
  const [os, setOs] = useState<Os>("other");
  const prompt = useRef<InstallPrompt | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    setOs(osOf());
    const onPrompt = (e: Event) => { e.preventDefault(); prompt.current = e as InstallPrompt; setCanPrompt(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    let t: number | undefined;
    if (auto) {
      const s = readState();
      const due = !s.done && (!s.later || Date.now() - s.later > LATER_MS);
      if (due && !installed() && isPhone()) t = window.setTimeout(() => setOpen(true), DELAY_MS);
    }
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); if (t) window.clearTimeout(t); };
  }, [auto]);

  const close = (state?: { done?: boolean; later?: number }) => {
    if (state) writeState(state);
    setOpen(false);
    onClose?.();
  };
  const installNow = async () => {
    const p = prompt.current;
    if (!p) return;
    await p.prompt();
    const r = await p.userChoice;
    if (r.outcome === "accepted") close({ done: true });
  };

  if (!open) return null;
  return (
    <Sheet onClose={() => close(auto ? { later: Date.now() } : undefined)} label="Installer GymDeck">
      <div className="installtip">
        <img className="it-icon" src="/apple-touch-icon.png?v=2" alt="" />
        <div className="sheet-title">Mets GymDeck sur ton écran d’accueil</div>
        <p>Comme une vraie appli : en plein écran, à côté de tes autres applis, et prête pour les notifications.</p>
        {os === "android" && canPrompt ? (
          <button className="btn primary" onClick={() => void installNow()}>Installer GymDeck</button>
        ) : (
          <Steps os={os} />
        )}
        {os === "ios" && <div className="it-arrow" aria-hidden>↓</div>}
        <button className="btn ghost small" onClick={() => close({ done: true })}>C’est fait</button>
        <button className="textbtn" onClick={() => close(auto ? { later: Date.now() } : undefined)}>Plus tard</button>
      </div>
    </Sheet>
  );
}
