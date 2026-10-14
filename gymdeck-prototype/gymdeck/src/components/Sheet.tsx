"use client";

import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Fenêtre par-dessus toute l'application (barre d'onglets comprise), rendue dans le cadre « téléphone ».
 * - center : au milieu (détail d'une carte)
 * - bottom : panneau qui monte du bas (confirmations, infos)
 * - full   : plein écran (choix du deck)
 */
export function Sheet({
  onClose, children, variant = "bottom", label,
}: { onClose: () => void; children: React.ReactNode; variant?: "center" | "bottom" | "full"; label: string }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const dlg = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRoot(document.getElementById("app-root"));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Place le focus dans la fenêtre (lecteurs d'écran / clavier), sans voler le focus d'un champ déjà actif.
  useEffect(() => {
    if (root && dlg.current && !dlg.current.contains(document.activeElement)) dlg.current.focus({ preventScroll: true });
  }, [root]);

  // Fermeture en douceur : au démontage, une copie figée de la fenêtre s'efface (aucun changement chez les appelants).
  useLayoutEffect(() => () => {
    const el = dlg.current;
    const host = document.getElementById("app-root");
    if (!el || !host || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || typeof el.animate !== "function") return;
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.setAttribute("aria-hidden", "true");
    ghost.removeAttribute("role");
    ghost.style.pointerEvents = "none";
    host.appendChild(ghost);
    const body = ghost.querySelector<HTMLElement>(".sheet-body");
    body?.animate(
      variant === "bottom" ? [{ transform: "translateY(0)" }, { transform: "translateY(48px)" }] : [{ transform: "scale(1)" }, { transform: "scale(.97)" }],
      { duration: 190, easing: "ease-in", fill: "forwards" },
    );
    const a = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 190, easing: "ease-in", fill: "forwards" });
    a.onfinish = () => ghost.remove();
    window.setTimeout(() => ghost.remove(), 400);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!root) return null;
  return createPortal(
    <motion.div
      className={`sheet ${variant}`}
      ref={dlg}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onClick={variant === "full" ? undefined : onClose}
    >
      <motion.div
        className="sheet-body"
        initial={{ y: variant === "bottom" ? 60 : 16, opacity: 0.6, scale: variant === "center" ? 0.96 : 1 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>,
    root,
  );
}
