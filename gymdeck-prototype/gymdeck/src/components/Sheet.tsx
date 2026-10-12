"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    setRoot(document.getElementById("app-root"));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!root) return null;
  return createPortal(
    <motion.div
      className={`sheet ${variant}`}
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
