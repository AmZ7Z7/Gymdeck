import type { Rarity } from "./config";
import { makeCard } from "./engine";
import { autoDeck, claimLogin, createAccount, newId, openPendingBooster, validateSession, type OwnedCard, type PlayerState } from "./game";
import { track } from "./progress";
import type { Rng } from "./rng";
import { finalRank, normalizeState } from "./social";

/**
 * Mode démo : une partie déjà bien avancée, qui tourne uniquement dans le navigateur du visiteur.
 * Rien n'est envoyé à Supabase (pas de compte, pas de mot de passe, aucune donnée de vrais joueurs) ;
 * le Marché, les amis, les échanges et les combats sont déjà simulés dans le jeu.
 * La démo s'ouvre sur l'adresse /demo (visible dans les statistiques Vercel).
 */
export const DEMO_PATH = "/demo";
export const DEMO_STORAGE_KEY = "gymdeck:demo:v1";
/** Une démo plus vieille que ça repart de zéro à la visite suivante. */
export const DEMO_MAX_AGE_MS = 12 * 3_600_000;

export const isDemoPath = (pathname: string) => pathname === DEMO_PATH || pathname.startsWith(`${DEMO_PATH}/`);

const DAY = 86_400_000;
const dayStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Partie de démonstration. On rejoue 21 jours de jeu avec les vraies règles (séances, connexions, boosters),
 * pour que série, historique, missions et succès soient cohérents ; puis on complète la collection pour montrer
 * toutes les raretés, et on laisse des boosters à ouvrir (dont un avec une légendaire garantie).
 * `today` : jour de Paris (« AAAA-MM-JJ »).
 */
export function demoState(today: string, rng: Rng): PlayerState {
  const t0 = Date.parse(`${today}T12:00:00Z`);
  let s: PlayerState = { ...createAccount(), name: "Démo" };
  // 21 jours d'entraînement : une séance presque tous les jours, et les 7 derniers jours d'affilée (série en cours)
  for (let k = 21; k >= 1; k--) {
    if (k > 7 && k % 4 === 0) continue; // quelques jours de repos au début
    const now = new Date(t0 - k * DAY);
    const day = dayStr(now.getTime());
    s = normalizeState(s, rng, day);
    const login = claimLogin(s, now);
    if (login.ok) s = track(login.state, "login", rng, day, finalRank);
    const v = validateSession(s, now);
    if (v.ok) s = track(v.state, "session", rng, day, finalRank);
    while (s.boosters.length) {
      const r = openPendingBooster(s, s.boosters[0]!.id, rng);
      if (!r.ok) break;
      s = track(r.state, "open", rng, day, finalRank);
    }
  }
  // collection avancée : au moins quelques cartes de chaque rareté, jusqu'à la légendaire
  const extra: [Rarity, number][] = [["SR", 4], ["SSR", 3], ["UR", 2], ["LR", 1]];
  let seq = s.seq;
  const added: OwnedCard[] = extra.flatMap(([r, n]) => Array.from({ length: n }, () => ({ ...makeCard(rng, r), id: newId(), obtainedSeq: ++seq })));
  s = { ...s, seq, cards: [...s.cards, ...added] };
  const deck = autoDeck(s);
  if (deck.ok) s = deck.state;
  s = normalizeState(s, rng, today);
  const e = s.extra!;
  return {
    ...s,
    gc: 1450,
    shards: 120,
    // 3 boosters à ouvrir tout de suite, dont un avec une légendaire garantie (pour voir l'ouverture spéciale)
    boosters: [{ id: newId(), kind: "shop", force: "LR" }, { id: newId(), kind: "shop" }, { id: newId(), kind: "login" }],
    extra: { ...e, tutorialDone: true },
  };
}
