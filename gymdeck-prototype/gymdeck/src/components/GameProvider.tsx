"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  autoDeck as autoDeckFn, buyBooster, craftCard as craftCardFn, newId, claimLogin, createAccount, discardCard, discardMany as discardManyFn,
  openPendingBooster, parisDay, setDeck as setDeckFn, setName as setNameFn, validateSession,
  type OwnedCard, type PendingBooster, type PlayerState,
} from "@/lib/game";
import { cancelAuction as cancelAuctionFn, emptyMarket, listCard as listCardFn, marketNow, placeBid, syncMarket, HOUR, type MarketState } from "@/lib/market";
import { secureRng } from "@/lib/rng";
import {
  claimAchievement as claimAchFn, claimMission as claimMissionFn, claimSeason as claimSeasonFn, claimSet as claimSetFn,
  claimStreak as claimStreakFn, claimPass as claimPassFn, claimChallenge as claimChallengeFn, addPassXp, seasonOf, toggleDeclaredDay, track, type EventKind, type Extra,
} from "@/lib/progress";
import {
  addFriend as addFriendFn, finalRank, normalizeState, proposeTrade, removeFriend as removeFriendFn, toggleShowcase as toggleShowcaseFn, botById, botDeck,
} from "@/lib/social";
import { deckPower, makeCard, revealOrder, type CardData } from "@/lib/engine";
import { finishAll, gradedStats, revealGrading as revealGradingFn, submitGrading as submitGradingFn, submitUpgrade as submitUpgradeFn, type GradeReveal, type GradingJob } from "@/lib/grading";
import {
  beginDuel as beginDuelFn, duelsLeft as duelsLeftFn, equalize, findMatch, finishDuel, runDefenses,
  type Consigne, type DuelRecord, type Fight, type Opponent,
} from "@/lib/duel";
import {
  cloudDeleteAccount, cloudEnabled, cloudLoad, cloudResetPassword, cloudSave, cloudSession, cloudSignIn, cloudSignOut, cloudSignUp, cloudStamp,
} from "@/lib/cloud";
import { changedElsewhere, startupChoice, type SyncInfo } from "@/lib/sync";
import type { MuscleGroup, Rarity } from "@/lib/config";
import { sfx } from "@/lib/sound";
import { DECK_SIZE, type BoosterKind } from "@/lib/config";

const STORAGE_KEY = "gymdeck:proto:v1";
const ACCOUNT_KEY = "gymdeck:account:v1";
const SYNC_KEY = "gymdeck:sync:v1";
const OTHER_DEVICE_MSG = "Ta partie a été mise à jour depuis un autre appareil.";

/** Compte connecté : « local » = mode test sans serveur ; « cloud » = Supabase. */
export interface Account { email: string; cloud: boolean; userId?: string }

/** Session d'ouverture : survit à la fermeture / au rechargement de la page. */
export interface OpeningSession {
  boosterId: string;
  kind: BoosterKind;
  phase: "closed" | "cards" | "summary";
  cardIds: string[];
  revealed: boolean[];
  index: number;
  /** Carte jamais possédée (exercice + rareté) avant ce booster. Absent sur les anciennes sauvegardes. */
  isNew?: boolean[];
  /** Garantie UR déclenchée par ce booster. */
  pityTriggered?: boolean;
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
  revealAll: () => void;
  finishOpening: () => void;
  setIndex: (i: number) => void;
  closeOpening: () => void;
  validate: () => string | null;
  claim: () => string | null;
  buy: () => { error: string } | { boosterId: string };
  discard: (cardId: string) => { gained: number; shards: number } | { error: string };
  discardMany: (ids: string[]) => { gained: number; shards: number; count: number } | { error: string };
  /** Forge : fabrique une carte choisie avec des éclats. */
  craft: (exerciseSlug: string, rarity: Rarity) => { card: OwnedCard } | { error: string };
  setName: (name: string) => string | null;
  setDeck: (ids: string[]) => string | null;
  autoDeck: () => string | null;
  /** Ajoute / retire / remplace une carte du deck. */
  toggleDeck: (cardId: string) => { ok: boolean; msg: string };
  deckCards: OwnedCard[];
  market: MarketState;
  /** Heure du marché (heure réelle + décalage de test). */
  marketClock: () => number;
  bid: (auctionId: string, amount: number) => string | null;
  listCard: (cardId: string, price: number, hours: number) => string | null;
  cancelAuction: (auctionId: string) => string | null;
  say: (msg: string) => void;
  /** Mode du serveur : false tant que Supabase n'est pas branché. */
  cloudEnabled: boolean;
  account: Account | null;
  extra: Extra;
  /** Jour de Paris courant (horloge du jeu). */
  day: string;
  /** Création / connexion : renvoie un message d'erreur, "confirm" (e-mail à confirmer) ou null. */
  signUp: (email: string, password: string, name: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  localStart: (email: string, name: string) => string | null;
  signOut: () => Promise<void>;
  /** Supprime définitivement le compte (en ligne) ou la partie (mode test). Renvoie un message d'erreur ou null. */
  deleteAccount: () => Promise<string | null>;
  claimMission: (scope: "daily" | "weekly", id: string) => number | string;
  claimStreak: (days: number) => number | string;
  claimSet: (group: MuscleGroup, tier: string) => number | string;
  claimAchievement: (id: string) => number | string;
  claimSeason: () => number | string;
  addFriend: (code: string) => string | null;
  removeFriend: (botId: string) => void;
  toggleShowcase: (cardId: string) => string | null;
  trade: (botId: string, myCardId: string, offerIndex: number) => { error: string } | { gaveId: string; gotId: string };
  /** Lance l'ouverture du premier booster en stock (après la création du compte). */
  openFirstBooster: () => void;
  finishTutorial: () => void;
  setReminder: (r: Extra["reminder"]) => void;
  /** Coche / décoche un jour passé au calendrier. Renvoie un message d'erreur ou null. */
  toggleTrainingDay: (day: string) => string | null;
  /** Heure du jeu en ms (heure réelle + jours ajoutés par les outils de test). */
  gameNow: () => number;
  /** Cartes chez Basile. */
  grading: GradingJob[];
  /** Confier une carte à Basile : renvoie un message d'erreur ou null. */
  submitGrading: (cardId: string) => string | null;
  /** Faire repasser une carte notée chez Basile (tenter +1 point) : message d'erreur ou null. */
  submitUpgrade: (cardId: string) => string | null;
  /** Révéler une expertise terminée (la note est appliquée à la carte). */
  revealGrading: (cardId: string) => GradeReveal | { error: string };
  /** Duels restants aujourd'hui. */
  duelsLeft: number;
  findOpponent: (avoid?: string[]) => Opponent | { error: string };
  /** Duel amical contre un ami : son deck est ramené à la puissance du mien. */
  friendOpponent: (botId: string) => Opponent | { error: string };
  /** Décompte un duel au lancement du combat (message d'erreur ou null). */
  beginDuel: () => string | null;
  /** Fin du combat : récompenses et historique. */
  endDuel: (f: Fight, opp: Opponent) => DuelRecord;
  setConsigne: (c: Consigne) => void;
  finishCombatTuto: () => void;
  resetCombatTuto: () => void;
  /** Passe de saison : récupère un palier (ou tous). */
  claimPass: (tier?: number) => { gc: number; boosters: number } | { error: string };
  claimChallenge: () => { gc: number; xp: number } | { error: string };
  tools: {
    nextDay: () => void; addGc: (n: number) => void; reset: () => void; advanceHours: (h: number) => void; giveCard: (r: Rarity, grade?: number) => void;
    openTestBooster: (r: Rarity) => void; advanceDays: (n: number) => void; resetTutorial: () => void; finishGradings: (grade?: number) => void; addDuels: (n: number) => void;
    addPassXp: (n: number) => void;
  };
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
function loadSync(): SyncInfo | null {
  try { const raw = localStorage.getItem(SYNC_KEY); return raw ? (JSON.parse(raw) as SyncInfo) : null; } catch { return null; }
}
function saveSync(s: SyncInfo | null) {
  try { if (s) localStorage.setItem(SYNC_KEY, JSON.stringify(s)); else localStorage.removeItem(SYNC_KEY); } catch { /* ignoré */ }
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [player, setPlayer] = useState<PlayerState>(() => createAccount());
  const [opening, setOpening] = useState<OpeningSession | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const accountRef = useRef<Account | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Copie synchrone pour que chaque action lise le dernier état, même enchaînée dans le même tick.
  const live = useRef<Persisted>({ player, opening });
  // Sauvegarde en ligne (compte connecté seulement) : voir src/lib/sync.ts.
  const sync = useRef<SyncInfo | null>(null);
  const rev = useRef(0); // compte les changements, pour savoir si d'autres ont eu lieu pendant un envoi
  const pushing = useRef(false);
  const pushAgain = useRef(false);
  const pushRef = useRef<() => Promise<void>>(async () => {});
  const setSync = (s: SyncInfo | null) => { sync.current = s; saveSync(s); };

  const commit = useCallback((next: Persisted) => {
    live.current = next;
    save(next); // écrit AVANT toute animation : le tirage ne peut pas être relancé
    setPlayer(next.player);
    setOpening(next.opening);
    // sauvegarde en ligne (au plus une fois toutes les 2 s)
    const s = sync.current;
    if (s) {
      rev.current++;
      setSync({ ...s, dirty: true, savedAt: Date.now() });
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => { void pushRef.current(); }, 2000);
    }
  }, []);

  /** Remplace la partie du téléphone par la copie en ligne (enregistrée depuis un autre appareil). */
  const adopt = useCallback((state: PlayerState, updatedAt: string, userId: string) => {
    const next: Persisted = { player: normalizeState(state, secureRng, parisDay(new Date())), opening: null };
    live.current = next;
    save(next);
    setPlayer(next.player);
    setOpening(null);
    setSync({ userId, base: updatedAt, dirty: false, savedAt: Date.now() });
  }, []);

  const saveAccount = useCallback((a: Account | null) => {
    accountRef.current = a;
    setAccount(a);
    try { if (a) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a)); else localStorage.removeItem(ACCOUNT_KEY); } catch { /* ignoré */ }
  }, []);

  /** Applique une action et enregistre l'événement pour les missions, la série et la saison. */
  /** Horloge du jeu : l'heure réelle + un décalage de jours (outil de test). */
  const clock = () => new Date(Date.now() + (live.current.player.extra?.dayShift ?? 0) * 86_400_000);
  const trk = (p: PlayerState, kind: EventKind, n = 1) => track(p, kind, secureRng, parisDay(clock()), finalRank, n);

  useEffect(() => {
    const saved = load();
    const initial0 = saved ?? { player: createAccount(), opening: null };
    const now0 = Date.now() + (initial0.player.extra?.dayShift ?? 0) * 86_400_000;
    const norm = normalizeState(initial0.player, secureRng, parisDay(new Date(now0)));
    const def = runDefenses(norm, secureRng, parisDay(new Date(now0)), now0);
    const initial = { ...initial0, player: def.state };
    if (def.total > 0) setTimeout(() => say(def.won > 0 ? `Ton deck a repoussé ${def.won} attaque${def.won > 1 ? "s" : ""} sur ${def.total} : +${def.gc} GC` : `Ton deck a subi ${def.total} attaque${def.total > 1 ? "s" : ""} sans les repousser`), 1500);
    live.current = initial;
    save(initial);
    setPlayer(initial.player);
    setOpening(initial.opening);
    // compte : sauvegarde ancienne (prototype) avec pseudo → compte local automatique
    let acc: Account | null = null;
    try { const raw = localStorage.getItem(ACCOUNT_KEY); acc = raw ? (JSON.parse(raw) as Account) : null; } catch { /* ignoré */ }
    if (!acc && initial.player.name) acc = { email: "", cloud: false };
    sync.current = acc?.cloud ? loadSync() : null;
    if (acc?.cloud) {
      void cloudSession().then((u) => {
        if (!u) { saveAccount(null); return; }
        saveAccount({ email: u.email, cloud: true, userId: u.id });
        void reconcile(u.id);
      });
    }
    accountRef.current = acc;
    setAccount(acc);
    setReady(true);
  }, [saveAccount]); // eslint-disable-line react-hooks/exhaustive-deps

  // passage à minuit (jour de Paris) pendant que l'appli est ouverte : missions et saison se remettent à jour
  useEffect(() => {
    if (!ready) return;
    const t = setInterval(() => {
      const p = live.current.player;
      const n0 = normalizeState(p, secureRng, parisDay(clock()));
      const n = runDefenses(n0, secureRng, parisDay(clock()), clock().getTime()).state;
      if (n !== p) commit({ ...live.current, player: n });
    }, 60000);
    return () => clearInterval(t);
  }, [ready, commit]);

  /** Fait avancer le marché (acheteurs simulés, fins d'enchères) et annonce ce qui s'est passé. */
  const runSync = useCallback(() => {
    const p = live.current.player;
    const r = syncMarket(p, secureRng, marketNow(p.market, Date.now()));
    if (!r.changed) return;
    let st = r.state;
    for (const ev of r.events) if (ev.kind === "won" || ev.kind === "sold") st = trk(st, ev.kind);
    commit({ ...live.current, player: st });
    if (r.events.some((e) => e.kind === "sold")) sfx.coin();
    else if (r.events.some((e) => e.kind === "won")) sfx.good();
    if (r.events.length === 1) say(r.events[0]!.message);
    else if (r.events.length > 1) say(`${r.events.length} nouveautés sur le Marché`);
  }, [commit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return;
    runSync();
    const t = setInterval(runSync, 20000);
    return () => clearInterval(t);
  }, [ready, runSync]);

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  /** Envoie la partie en ligne, sans jamais écraser ce qu'un autre appareil a enregistré entre-temps. */
  const push = useCallback(async () => {
    const s = sync.current;
    if (!s || !s.dirty) return;
    if (pushing.current) { pushAgain.current = true; return; }
    pushing.current = true;
    try {
      const startRev = rev.current;
      const r = await cloudSave(s.userId, live.current.player, s.base);
      const cur = sync.current;
      if (!cur || cur.userId !== s.userId) return; // déconnecté entre-temps
      if (r.ok) setSync({ ...cur, base: r.updatedAt, dirty: rev.current !== startRev });
      else if (r.conflict) {
        // un autre appareil a enregistré : on reprend sa copie au lieu de l'écraser
        const remote = await cloudLoad(s.userId);
        if (remote && sync.current?.userId === s.userId) { adopt(remote.state, remote.updatedAt, s.userId); say(OTHER_DEVICE_MSG); }
      }
      // échec réseau : la partie reste à envoyer, on réessaiera
    } finally {
      pushing.current = false;
      if (pushAgain.current) { pushAgain.current = false; void pushRef.current(); }
    }
  }, [adopt, say]);
  pushRef.current = push;

  /** Vérifie si un autre appareil a enregistré la partie, et la récupère le cas échéant. */
  const pull = useCallback(async () => {
    const s = sync.current;
    if (!s || pushing.current) return;
    if (s.dirty) { await push(); return; } // l'envoi détecte lui-même un enregistrement venu d'ailleurs
    const stamp = await cloudStamp(s.userId);
    if (!changedElsewhere(s, stamp)) return;
    const remote = await cloudLoad(s.userId);
    const cur = sync.current;
    // si le joueur a joué pendant la vérification, c'est le prochain envoi qui tranchera
    if (remote && cur && cur.userId === s.userId && !cur.dirty) { adopt(remote.state, remote.updatedAt, s.userId); say(OTHER_DEVICE_MSG); }
  }, [adopt, push, say]);

  /** Au démarrage (ou à la reconnexion) : garde la copie la plus récente entre le téléphone et le compte en ligne. */
  const reconcile = useCallback(async (userId: string) => {
    const stamp = await cloudStamp(userId);
    const prev = sync.current?.userId === userId ? sync.current : null;
    if (stamp === undefined) {
      // serveur injoignable : on garde la copie du téléphone et on vérifiera plus tard
      if (!prev) setSync({ userId, base: null, dirty: false, savedAt: Date.now() });
      return;
    }
    if (startupChoice(prev, userId, stamp) === "cloud") {
      const remote = await cloudLoad(userId);
      if (remote) { adopt(remote.state, remote.updatedAt, userId); if (prev) say(OTHER_DEVICE_MSG); }
      return;
    }
    // la copie du téléphone est la plus récente : elle remplacera celle en ligne
    setSync({ userId, base: stamp, dirty: prev ? prev.dirty || prev.base !== stamp : true, savedAt: prev?.savedAt ?? Date.now() });
    await push();
  }, [adopt, push, say]);

  // compte en ligne : vérification toutes les 20 s et à chaque retour sur l'appli
  useEffect(() => {
    if (!ready || !account?.cloud) return;
    const onShow = () => { if (document.visibilityState === "visible") void pull(); };
    const t = setInterval(() => void pull(), 20000);
    document.addEventListener("visibilitychange", onShow);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onShow); };
  }, [ready, account?.cloud, pull]);

  const today = parisDay(new Date(Date.now() + (player.extra?.dayShift ?? 0) * 86_400_000));

  const tools_advanceDays = (n: number) => {
    const p = live.current.player;
    const e = p.extra;
    if (!e) return;
    const shifted: PlayerState = { ...p, extra: { ...e, dayShift: (e.dayShift ?? 0) + n } };
    const day = parisDay(new Date(Date.now() + (shifted.extra!.dayShift ?? 0) * 86_400_000));
    commit({ ...live.current, player: normalizeState(shifted, secureRng, day) });
  };

  const game = useMemo<Game>(() => ({
    ready,
    player,
    opening,
    sessionDoneToday: player.lastSessionDay === today,
    loginDoneToday: player.lastLoginDay === today,
    toast,
    say,
    market: player.market ?? emptyMarket(),
    marketClock: () => marketNow(live.current.player.market, Date.now()),
    deckCards: player.deck.map((id) => player.cards.find((c) => c.id === id)).filter((c): c is OwnedCard => !!c),

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
      // la plus rare en dernier (affichage seulement)
      const shown = revealOrder(r.cards).map((i) => r.cards[i]!);
      const known = new Set(p.cards.map((c) => `${c.exerciseSlug}|${c.rarity}`));
      const fresh = shown.map((c: OwnedCard) => { const k = `${c.exerciseSlug}|${c.rarity}`; const n = !known.has(k); known.add(k); return n; });
      commit({
        player: trk(r.state, "open"),
        opening: {
          ...o, phase: "cards", cardIds: shown.map((c) => c.id), revealed: r.cards.map(() => false), index: 0,
          isNew: fresh,
          pityTriggered: r.pityTriggered,
        },
      });
    },

    revealAll: () => {
      const { player: p, opening: o } = live.current;
      if (!o) return;
      commit({ player: p, opening: { ...o, revealed: o.revealed.map(() => true) } });
    },

    finishOpening: () => {
      const { player: p, opening: o } = live.current;
      if (!o || o.phase !== "cards") return;
      commit({ player: p, opening: { ...o, phase: "summary", revealed: o.revealed.map(() => true) } });
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
      const r = validateSession(live.current.player, clock());
      if (!r.ok) return r.error;
      // Le booster de séance vient d'être ajouté en dernier : on enchaîne directement sur son ouverture.
      const b = r.state.boosters[r.state.boosters.length - 1]!;
      commit({ player: trk(r.state, "session"), opening: { boosterId: b.id, kind: b.kind, phase: "closed", cardIds: [], revealed: [], index: 0 } });
      return null;
    },

    claim: () => {
      const r = claimLogin(live.current.player, clock());
      if (!r.ok) return r.error;
      commit({ ...live.current, player: trk(r.state, "login") });
      return r.bonusBooster ? "bonus" : null;
    },

    buy: () => {
      const r = buyBooster(live.current.player);
      if (!r.ok) return { error: r.error };
      commit({ ...live.current, player: trk(r.state, "buy") });
      return { boosterId: r.state.boosters[r.state.boosters.length - 1]!.id };
    },

    discard: (cardId) => {
      const r = discardCard(live.current.player, cardId);
      if (!r.ok) return { error: r.error };
      commit({ ...live.current, player: trk(r.state, "discard") });
      return { gained: r.gained, shards: r.shards };
    },

    discardMany: (ids) => {
      const r = discardManyFn(live.current.player, ids);
      if (!r.ok) return { error: r.error };
      commit({ ...live.current, player: trk(r.state, "discard") });
      return { gained: r.gained, shards: r.shards, count: r.count };
    },

    craft: (exerciseSlug, rarity) => {
      const r = craftCardFn(live.current.player, exerciseSlug, rarity, secureRng);
      if (!r.ok) return { error: r.error };
      commit({ ...live.current, player: trk(r.state, "craft") });
      return { card: r.card };
    },

    setName: (name) => {
      const r = setNameFn(live.current.player, name);
      if (!r.ok) return r.error;
      commit({ ...live.current, player: r.state });
      return null;
    },

    setDeck: (ids) => {
      const r = setDeckFn(live.current.player, ids);
      if (!r.ok) return r.error;
      commit({ ...live.current, player: trk(r.state, "deck") });
      return null;
    },

    autoDeck: () => {
      const r = autoDeckFn(live.current.player);
      if (!r.ok) return r.error;
      commit({ ...live.current, player: trk(r.state, "deck") });
      return null;
    },

    toggleDeck: (cardId) => {
      const p = live.current.player;
      const card = p.cards.find((c) => c.id === cardId);
      if (!card) return { ok: false, msg: "Carte introuvable." };
      let next: string[];
      let msg: string;
      if (p.deck.includes(cardId)) {
        next = p.deck.filter((id) => id !== cardId);
        msg = "Carte retirée de ton deck.";
      } else {
        const same = p.deck.find((id) => p.cards.find((c) => c.id === id)?.exerciseSlug === card.exerciseSlug);
        if (same) { next = p.deck.map((id) => (id === same ? cardId : id)); msg = "Carte remplacée dans ton deck."; }
        else if (p.deck.length >= DECK_SIZE) return { ok: false, msg: "Deck complet : retire d’abord une carte." };
        else { next = [...p.deck, cardId]; msg = "Carte ajoutée à ton deck."; }
      }
      const r = setDeckFn(p, next);
      if (!r.ok) return { ok: false, msg: r.error };
      commit({ ...live.current, player: trk(r.state, "deck") });
      return { ok: true, msg };
    },

    bid: (auctionId, amount) => {
      const p = live.current.player;
      const r = placeBid(p, auctionId, amount, marketNow(p.market, Date.now()));
      if (!r.ok) return r.error;
      commit({ ...live.current, player: trk(r.state, "bid") });
      return null;
    },

    listCard: (cardId, price, hours) => {
      const p = live.current.player;
      const r = listCardFn(p, secureRng, cardId, price, hours, marketNow(p.market, Date.now()));
      if (!r.ok) return r.error;
      commit({ ...live.current, player: trk(r.state, "list") });
      return null;
    },

    cancelAuction: (auctionId) => {
      const r = cancelAuctionFn(live.current.player, auctionId);
      if (!r.ok) return r.error;
      commit({ ...live.current, player: r.state });
      return null;
    },

    cloudEnabled,
    account,
    extra: player.extra ?? ({} as Extra),
    day: today,

    gameNow: () => clock().getTime(),
    grading: player.grading ?? [],
    submitGrading: (cardId) => {
      const r = submitGradingFn(live.current.player, cardId, secureRng, clock().getTime());
      if (!r.ok) return r.error;
      commit({ ...live.current, player: trk(r.state, "grade") });
      return null;
    },
    submitUpgrade: (cardId) => {
      const r = submitUpgradeFn(live.current.player, cardId, secureRng, clock().getTime());
      if (!r.ok) return r.error;
      commit({ ...live.current, player: trk(r.state, "grade") });
      return null;
    },
    revealGrading: (cardId) => {
      const r = revealGradingFn(live.current.player, cardId, clock().getTime());
      if (!r.ok) return { error: r.error };
      commit({ ...live.current, player: r.state });
      return { card: r.card, grade: r.grade, pct: r.pct, before: r.before, from: r.from };
    },
    duelsLeft: duelsLeftFn(player, today),
    findOpponent: (avoid) => {
      const p = live.current.player;
      const deck = p.deck.map((id) => p.cards.find((c) => c.id === id)).filter((c): c is OwnedCard => !!c);
      if (deck.length < DECK_SIZE) return { error: "Il te faut un deck de 5 cartes pour combattre." };
      return findMatch(secureRng, deck, avoid);
    },
    friendOpponent: (botId) => {
      const p = live.current.player;
      const deck = p.deck.map((id) => p.cards.find((c) => c.id === id)).filter((c): c is OwnedCard => !!c);
      if (deck.length < DECK_SIZE) return { error: "Il te faut un deck de 5 cartes pour combattre." };
      const bot = botById(botId);
      if (!bot) return { error: "Ami introuvable." };
      const cards = equalize(botDeck(bot), deckPower(deck));
      const cons: Consigne[] = ["agressif", "equilibre", "prudent"];
      return { key: `ami-${bot.id}-${Date.now()}`, name: bot.name, cards, power: deckPower(cards), consigne: cons[secureRng.int(0, 2)]!, friendly: true };
    },
    beginDuel: () => {
      const r = beginDuelFn(live.current.player, parisDay(clock()));
      if (!r.ok) return r.error;
      commit({ ...live.current, player: r.state });
      return null;
    },
    endDuel: (f, opp) => {
      const day = parisDay(clock());
      const r = finishDuel(live.current.player, f, opp, day, clock().getTime());
      let st = r.state;
      if (!opp.friendly) { st = trk(st, "duel"); if (r.record.outcome === "win") st = trk(st, "duelWin"); }
      const e = st.extra;
      if (e && !e.combatTutoDone) st = { ...st, extra: { ...e, combatTutoDone: true } };
      commit({ ...live.current, player: st });
      return r.record;
    },
    setConsigne: (c) => {
      const p = live.current.player;
      if (p.extra) commit({ ...live.current, player: { ...p, extra: { ...p.extra, consigne: c } } });
    },
    finishCombatTuto: () => {
      const p = live.current.player;
      if (p.extra && !p.extra.combatTutoDone) commit({ ...live.current, player: { ...p, extra: { ...p.extra, combatTutoDone: true } } });
    },
    resetCombatTuto: () => {
      const p = live.current.player;
      if (p.extra) commit({ ...live.current, player: { ...p, extra: { ...p.extra, combatTutoDone: false } } });
    },
    claimPass: (tier) => {
      const r = claimPassFn(live.current.player, parisDay(clock()), tier);
      if (!r.ok) return { error: r.error };
      commit({ ...live.current, player: r.state });
      return { gc: r.gc, boosters: r.boosters };
    },
    claimChallenge: () => {
      const r = claimChallengeFn(live.current.player, parisDay(clock()), clock().getTime());
      if (!r.ok) return { error: r.error };
      commit({ ...live.current, player: r.state });
      return { gc: r.gc, xp: r.xp };
    },

    signUp: async (email, password, name) => {
      const nm = setNameFn(live.current.player, name);
      if (!nm.ok) return nm.error;
      const r = await cloudSignUp(email.trim(), password, name.trim());
      if (!r.ok) return r.error;
      if (r.needsConfirm || !r.user) return "confirm";
      saveAccount({ email: r.user.email, cloud: true, userId: r.user.id });
      const fresh = normalizeState({ ...createAccount(), name: nm.state.name }, secureRng, parisDay(new Date()));
      setSync({ userId: r.user.id, base: null, dirty: false, savedAt: Date.now() });
      commit({ player: fresh, opening: null });
      void push();
      return null;
    },

    signIn: async (email, password) => {
      const r = await cloudSignIn(email.trim(), password);
      if (!r.ok || !r.user) return r.ok ? "Connexion impossible." : r.error;
      const uid = r.user.id;
      saveAccount({ email: r.user.email, cloud: true, userId: uid });
      // même compte que la partie du téléphone (session expirée, par exemple) : on garde la copie la plus récente
      if (sync.current?.userId === uid) { await reconcile(uid); return null; }
      const saved = await cloudLoad(uid);
      if (saved) adopt(saved.state, saved.updatedAt, uid);
      else {
        const base = normalizeState({ ...createAccount(), name: r.user.name ?? email.split("@")[0] }, secureRng, parisDay(new Date()));
        setSync({ userId: uid, base: null, dirty: false, savedAt: Date.now() });
        commit({ player: base, opening: null });
        void push();
      }
      return null;
    },

    resetPassword: (email) => cloudResetPassword(email.trim()),

    localStart: (email, name) => {
      const r = setNameFn(live.current.player, name);
      if (!r.ok) return r.error;
      saveAccount({ email: email.trim(), cloud: false });
      commit({ ...live.current, player: r.state });
      return null;
    },

    signOut: async () => {
      const acc = accountRef.current;
      if (acc?.cloud) { await push(); await cloudSignOut(); }
      setSync(null);
      saveAccount(null);
      commit({ player: normalizeState(createAccount(), secureRng, parisDay(new Date())), opening: null });
    },

    deleteAccount: async () => {
      const acc = accountRef.current;
      // plus aucun envoi en ligne : la sauvegarde ne doit pas être recréée juste après la suppression
      if (syncTimer.current) clearTimeout(syncTimer.current);
      const s = sync.current;
      setSync(null);
      if (acc?.cloud) {
        const err = await cloudDeleteAccount();
        if (err) { setSync(s); return err; }
      }
      saveAccount(null);
      commit({ player: normalizeState(createAccount(), secureRng, parisDay(new Date())), opening: null });
      return null;
    },

    claimMission: (scope, id) => {
      const r = claimMissionFn(live.current.player, scope, id, parisDay(clock()));
      if (!r.ok) return r.error;
      commit({ ...live.current, player: r.state });
      return r.reward;
    },
    claimStreak: (days) => {
      const r = claimStreakFn(live.current.player, days, parisDay(clock()));
      if (!r.ok) return r.error;
      commit({ ...live.current, player: r.state });
      return r.reward;
    },
    claimSet: (group, tier) => {
      const r = claimSetFn(live.current.player, group, tier);
      if (!r.ok) return r.error;
      commit({ ...live.current, player: r.state });
      return r.reward;
    },
    claimAchievement: (id) => {
      const r = claimAchFn(live.current.player, id);
      if (!r.ok) return r.error;
      commit({ ...live.current, player: r.state });
      return r.reward;
    },
    claimSeason: () => {
      const r = claimSeasonFn(live.current.player);
      if (!r.ok) return r.error;
      commit({ ...live.current, player: r.state });
      return r.reward;
    },

    addFriend: (code) => {
      const r = addFriendFn(live.current.player, code);
      if (!r.ok) return r.error;
      commit({ ...live.current, player: r.state });
      return null;
    },
    removeFriend: (botId) => commit({ ...live.current, player: removeFriendFn(live.current.player, botId) }),
    toggleShowcase: (cardId) => {
      const r = toggleShowcaseFn(live.current.player, cardId);
      if (!r.ok) return r.error;
      commit({ ...live.current, player: r.state });
      return null;
    },
    trade: (botId, myCardId, offerIndex) => {
      const p = live.current.player;
      const daily = p.extra?.daily.trade ?? 0;
      const r = proposeTrade(p, botId, myCardId, offerIndex, daily);
      if (!r.ok) return { error: r.error };
      commit({ ...live.current, player: trk(r.state, "trade") });
      return { gaveId: r.gave.id, gotId: r.got.id };
    },
    openFirstBooster: () => {
      const { player: p } = live.current;
      const b = p.boosters[0];
      if (b) commit({ player: p, opening: { boosterId: b.id, kind: b.kind, phase: "closed", cardIds: [], revealed: [], index: 0 } });
    },
    finishTutorial: () => {
      const p = live.current.player;
      if (p.extra && !p.extra.tutorialDone) commit({ ...live.current, player: { ...p, extra: { ...p.extra, tutorialDone: true } } });
    },
    setReminder: (rem) => {
      const p = live.current.player;
      if (p.extra) commit({ ...live.current, player: { ...p, extra: { ...p.extra, reminder: rem } } });
    },

    toggleTrainingDay: (day) => {
      const r = toggleDeclaredDay(live.current.player, day, parisDay(clock()));
      if (!r.ok) return r.error;
      commit({ ...live.current, player: r.state });
      return null;
    },

    tools: {
      advanceHours: (h) => {
        const p = live.current.player;
        const m = p.market ?? emptyMarket();
        commit({ ...live.current, player: { ...p, market: { ...m, offsetMs: m.offsetMs + h * HOUR } } });
        runSync();
      },
      nextDay: () => tools_advanceDays(1),
      advanceDays: (n) => tools_advanceDays(n),
      giveCard: (rarity, grade) => {
        const p = live.current.player;
        const base = makeCard(secureRng, rarity);
        const c: OwnedCard = {
          ...base, id: newId(), obtainedSeq: p.seq + 1,
          ...(grade ? { atq: gradedStats(base.atq, base.def, grade).atq, def: gradedStats(base.atq, base.def, grade).def, grade, raw: { atq: base.atq, def: base.def } } : {}),
        };
        commit({ ...live.current, player: { ...p, seq: p.seq + 1, cards: [...p.cards, c] } });
      },
      openTestBooster: (rarity) => {
        const p = live.current.player;
        const id = newId();
        const b: PendingBooster = { id, kind: "shop", force: rarity };
        commit({ player: { ...p, boosters: [...p.boosters, b] }, opening: { boosterId: id, kind: "shop", phase: "closed", cardIds: [], revealed: [], index: 0 } });
      },
      resetTutorial: () => { const p = live.current.player; if (p.extra) commit({ ...live.current, player: { ...p, extra: { ...p.extra, tutorialDone: false } } }); },
      finishGradings: (grade) => {
        const p = live.current.player;
        // option de test : forcer la note des expertises en cours (pour voir les médailles 9 et 10)
        const q = grade ? { ...p, grading: (p.grading ?? []).map((j) => ({ ...j, grade })) } : p;
        commit({ ...live.current, player: finishAll(q, clock().getTime()) });
      },
      addDuels: (n) => {
        const p = live.current.player;
        const e = p.extra;
        if (!e) return;
        const day = parisDay(clock());
        const d = e.duel?.day === day ? e.duel : { day, used: 0, bonus: 0 };
        commit({ ...live.current, player: { ...p, extra: { ...e, duel: { ...d, bonus: d.bonus + n } } } });
      },
      addPassXp: (n) => {
        const p = live.current.player;
        if (p.extra) commit({ ...live.current, player: { ...p, extra: addPassXp(p.extra, n, parisDay(clock())) } });
      },
      addGc: (n) => commit({ ...live.current, player: { ...live.current.player, gc: live.current.player.gc + n } }),
      reset: () => commit({ player: normalizeState({ ...createAccount(), name: live.current.player.name }, secureRng, parisDay(new Date())), opening: null }),
    },
  }), [ready, player, opening, toast, today, account, say, commit, runSync, saveAccount, adopt, push, reconcile]);

  return <Ctx.Provider value={game}>{children}</Ctx.Provider>;
}
