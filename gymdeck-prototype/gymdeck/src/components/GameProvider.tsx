"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  buyBooster, claimLogin, createAccount, discardCard, openPendingBooster, parisDay, validateSession,
  type OwnedCard, type PlayerState,
} from "@/lib/game";
import { secureRng } from "@/lib/rng";
import type { BoosterKind } from "@/lib/config";

const STORAGE_KEY = "gymdeck:proto:v1";

/** Session d'ouverture : survit à la fermeture / au rechargement de la page. */
export interface OpeningSession {
  boosterId: string;
  kind: BoosterKind;
  phase: "closed" | "cards";
  cardIds: string[];
  revealed: boolean[];
  index: number;
}

interface Persisted { player: PlayerState; opening: OpeningSession | null }

interface Game {
  ready: boolean;
  player: PlayerState;
  opening: OpeningSession | null;
  sessionDoneToday: boolean;
  loginDoneToday: boolean;
  toast: string | null;
  startOpening: (boosterId: string) => void;
  openNow: () => void;
  reveal: (i: number) => void;
  setIndex: (i: number) => void;
  closeOpening: () => void;
  validate: () => string | null;
  claim: () => string | null;
  buy: () => string | null;
  discard: (cardId: string) => { gained: number } | { error: string };
  say: (msg: string) => void;
  tools: { nextDay: () => void; addGc: (n: number) => void; reset: () => void };
}

const Ctx = createContext<Game | null>(null);
export const useGame = () => {
  const g = useContext(Ctx);
  if (!g) throw new Error("useGame hors GameProvider");
  return g;
};

function load(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}
function save(p: Persisted) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* stockage indisponible */ }
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [player, setPlayer] = useState<PlayerState>(() => createAccount());
  const [opening, setOpening] = useState<OpeningSession | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Copie synchrone pour que chaque action lise le dernier état, même enchaînée dans le même tick.
  const live = useRef<Persisted>({ player, opening });

  const commit = useCallback((next: Persisted) => {
    live.current = next;
    save(next); // écrit AVANT toute animation : le tirage ne peut pas être relancé
    setPlayer(next.player);
    setOpening(next.opening);
  }, []);

  useEffect(() => {
    const saved = load();
    const initial = saved ?? { player: createAccount(), opening: null };
    live.current = initial;
    if (!saved) save(initial);
    setPlayer(initial.player);
    setOpening(initial.opening);
    setReady(true);
  }, []);

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const today = parisDay(new Date());

  const game = useMemo<Game>(() => ({
    ready,
    player,
    opening,
    sessionDoneToday: player.lastSessionDay === today,
    loginDoneToday: player.lastLoginDay === today,
    toast,
    say,

    startOpening: (boosterId) => {
      const { player: p } = live.current;
      const b = p.boosters.find((x) => x.id === boosterId);
      if (!b) return;
      commit({ player: p, opening: { boosterId, kind: b.kind, phase: "closed", cardIds: [], revealed: [], index: 0 } });
    },

    openNow: () => {
      const { player: p, opening: o } = live.current;
      if (!o || o.phase !== "closed") return;
      const r = openPendingBooster(p, o.boosterId, secureRng);
      if (!r.ok) return;
      commit({
        player: r.state,
        opening: { ...o, phase: "cards", cardIds: r.cards.map((c: OwnedCard) => c.id), revealed: r.cards.map(() => false), index: 0 },
      });
    },

    reveal: (i) => {
      const { player: p, opening: o } = live.current;
      if (!o || o.revealed[i]) return;
      const revealed = o.revealed.map((v, k) => (k === i ? true : v));
      commit({ player: p, opening: { ...o, revealed } });
    },

    setIndex: (i) => {
      const { player: p, opening: o } = live.current;
      if (!o || o.index === i) return;
      commit({ player: p, opening: { ...o, index: i } });
    },

    closeOpening: () => commit({ player: live.current.player, opening: null }),

    validate: () => {
      const r = validateSession(live.current.player, new Date());
      if (!r.ok) return r.error;
      // Le booster de séance vient d'être ajouté en dernier : on enchaîne directement sur son ouverture.
      const b = r.state.boosters[r.state.boosters.length - 1]!;
      commit({ player: r.state, opening: { boosterId: b.id, kind: b.kind, phase: "closed", cardIds: [], revealed: [], index: 0 } });
      return null;
    },

    claim: () => {
      const r = claimLogin(live.current.player, new Date());
      if (!r.ok) return r.error;
      commit({ ...live.current, player: r.state });
      return r.bonusBooster ? "bonus" : null;
    },

    buy: () => {
      const r = buyBooster(live.current.player);
      if (!r.ok) return r.error;
      commit({ ...live.current, player: r.state });
      return null;
    },

    discard: (cardId) => {
      const r = discardCard(live.current.player, cardId);
      if (!r.ok) return { error: r.error };
      commit({ ...live.current, player: r.state });
      return { gained: r.gained };
    },

    tools: {
      nextDay: () => commit({ ...live.current, player: { ...live.current.player, lastSessionDay: null, lastLoginDay: null } }),
      addGc: (n) => commit({ ...live.current, player: { ...live.current.player, gc: live.current.player.gc + n } }),
      reset: () => commit({ player: createAccount(), opening: null }),
    },
  }), [ready, player, opening, toast, today, say, commit]);

  return <Ctx.Provider value={game}>{children}</Ctx.Provider>;
}
