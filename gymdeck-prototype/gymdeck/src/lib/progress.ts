import { DUEL, EXERCISES, GROUPS, RARITIES, RARITY_RANK, type MuscleGroup, type Rarity } from "./config";
import type { DuelDay, DuelRecord } from "./duel";
import { deckPower } from "./engine";
import { parisDay, type PlayerState, type Result } from "./game";
import type { Rng } from "./rng";

/**
 * Progression « méta » : missions, série de séances, succès, extensions, profil social, saison.
 * Tout est pur (pas d'horloge ni de hasard cachés) et sérialisé dans `PlayerState.extra`.
 * Les montants de récompense sont tous ici : un seul endroit à modifier pour équilibrer.
 */

export type EventKind = "session" | "open" | "bid" | "list" | "deck" | "buy" | "login" | "won" | "sold" | "trade" | "discard" | "duel" | "duelWin" | "grade";
export type Counters = Partial<Record<EventKind, number>>;

export interface SeasonResult { id: string; rank: number; total: number; reward: number }

export interface Extra {
  v: 1;
  friendCode: string;
  tutorialDone: boolean;
  day: string;
  daily: Counters;
  dailyClaimed: string[];
  week: string;
  weekly: Counters;
  weeklyClaimed: string[];
  life: Counters;
  streak: { current: number; best: number; lastDay: string | null; claimed: number[] };
  achClaimed: string[];
  setsClaimed: string[];
  showcase: string[];
  friends: string[];
  /** Nombre d'échanges déjà faits avec chaque ami (renouvelle ses cartes proposées). */
  tradeNonce: Record<string, number>;
  /** Saison mensuelle : points de duel (victoire 3, égalité 1, défaite 1) et bilan. */
  season: { id: string; bestPower: number; points?: number; wins?: number; losses?: number; draws?: number };
  pendingSeason: SeasonResult | null;
  reminder: { days: number[]; time: string } | null;
  /** Jours de séance validés dans l'app (calendrier). */
  history?: string[];
  /** Jours passés ajoutés à la main (calendrier uniquement : aucune récompense, aucun effet sur la série). */
  declared?: string[];
  /** Jours ajoutés à l'horloge (outil de test uniquement). */
  dayShift?: number;
  /** Duels du jour (3 + 2 si séance validée). */
  duel?: DuelDay;
  /** Derniers duels joués. */
  duels?: DuelRecord[];
}

// ───────────── Dates (jour de Paris) ─────────────

const DAY = 86_400_000;
const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const daysBetween = (a: string, b: string) => Math.round((dayMs(b) - dayMs(a)) / DAY);

/** Lundi de la semaine du jour donné. */
export function weekOf(day: string): string {
  const d = new Date(dayMs(day));
  const wd = (d.getUTCDay() + 6) % 7; // lundi = 0
  return new Date(d.getTime() - wd * DAY).toISOString().slice(0, 10);
}
export const seasonOf = (day: string) => day.slice(0, 7);
export function seasonProgress(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Math.min(1, d / dim);
}
export function seasonEndsIn(day: string): number {
  const [y, m] = day.split("-").map(Number) as [number, number];
  return daysBetween(day, new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10));
}

// ───────────── Création / normalisation ─────────────

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeFriendCode(rng: Rng): string {
  let s = "GD-";
  for (let i = 0; i < 6; i++) s += CODE_CHARS[rng.int(0, CODE_CHARS.length - 1)];
  return s;
}

export function newExtra(rng: Rng, day: string): Extra {
  return {
    v: 1, friendCode: makeFriendCode(rng), tutorialDone: false,
    day, daily: {}, dailyClaimed: [], week: weekOf(day), weekly: {}, weeklyClaimed: [], life: {},
    streak: { current: 0, best: 0, lastDay: null, claimed: [] },
    achClaimed: [], setsClaimed: [], showcase: [], friends: [], tradeNonce: {},
    season: { id: seasonOf(day), bestPower: 0, points: 0, wins: 0, losses: 0, draws: 0 }, pendingSeason: null, reminder: null, history: [], declared: [],
  };
}

/** Puissance du deck si les 5 cartes sont posées (sinon 0 : pas classé). */
export function rankedPower(s: PlayerState): number {
  const cards = s.deck.map((id) => s.cards.find((c) => c.id === id)).filter((c) => !!c);
  return cards.length >= 5 ? deckPower(cards) : 0;
}

/**
 * Remet l'état à jour pour le jour courant : crée `extra` si besoin, repart de zéro les compteurs du jour / de la
 * semaine, casse une série trop ancienne, clôture la saison précédente (calcul du classement final).
 * `ranker` calcule le rang final d'une saison terminée (injecté pour éviter une dépendance circulaire).
 */
export function normalize(s: PlayerState, rng: Rng, day: string, ranker: (seasonId: string, power: number) => { rank: number; total: number }): PlayerState {
  const e0 = s.extra ?? newExtra(rng, day);
  let e: Extra = { ...e0 };
  if (!e.history || !e.declared) e = { ...e, history: e.history ?? (s.lastSessionDay ? [s.lastSessionDay] : []), declared: e.declared ?? [] };
  if (e.day !== day) { e = { ...e, day, daily: {}, dailyClaimed: [] }; }
  if (!e.duel || e.duel.day !== day) e = { ...e, duel: { day, used: 0, bonus: s.lastSessionDay === day ? DUEL.perSession : 0 } };
  const wk = weekOf(day);
  if (e.week !== wk) e = { ...e, week: wk, weekly: {}, weeklyClaimed: [] };
  if (e.streak.lastDay && daysBetween(e.streak.lastDay, day) > 2 && e.streak.current > 0) {
    e = { ...e, streak: { ...e.streak, current: 0, claimed: [] } };
  }
  const sid = seasonOf(day);
  if (e.season.id !== sid) {
    // classement de fin de saison : aux points de duel (il faut avoir combattu au moins une fois)
    if ((e.season.points ?? 0) > 0 && !e.pendingSeason) {
      const { rank, total } = ranker(e.season.id, e.season.points ?? 0);
      e = { ...e, pendingSeason: { id: e.season.id, rank, total, reward: seasonReward(rank) } };
    }
    e = { ...e, season: { id: sid, bestPower: 0, points: 0, wins: 0, losses: 0, draws: 0 } };
  }
  const power = rankedPower({ ...s, extra: e });
  if (power > e.season.bestPower) e = { ...e, season: { ...e.season, bestPower: power } };
  return s.extra && JSON.stringify(e) === JSON.stringify(s.extra) ? s : { ...s, extra: e };
}

export function seasonReward(rank: number): number {
  if (rank <= 1) return 250;
  if (rank <= 3) return 150;
  if (rank <= 10) return 80;
  if (rank <= 20) return 40;
  return 15;
}
export const SEASON_TIERS: { label: string; reward: number }[] = [
  { label: "1er", reward: 250 }, { label: "Top 3", reward: 150 }, { label: "Top 10", reward: 80 },
  { label: "Top 20", reward: 40 }, { label: "Classé", reward: 15 },
];

export function claimSeason(s: PlayerState): Result<{ state: PlayerState; reward: number }> {
  const e = s.extra;
  if (!e?.pendingSeason) return { ok: false, error: "Aucune récompense de saison." };
  const reward = e.pendingSeason.reward;
  return { ok: true, reward, state: { ...s, gc: s.gc + reward, extra: { ...e, pendingSeason: null } } };
}

// ───────────── Suivi des actions ─────────────

const inc = (c: Counters, k: EventKind, n: number): Counters => ({ ...c, [k]: (c[k] ?? 0) + n });

/** Enregistre une action du joueur (missions, succès, série). */
export function track(s: PlayerState, kind: EventKind, rng: Rng, day: string, ranker: Parameters<typeof normalize>[3], n = 1): PlayerState {
  const base = normalize(s, rng, day, ranker);
  const e = base.extra!;
  let streak = e.streak;
  if (kind === "session") {
    const gap = streak.lastDay ? daysBetween(streak.lastDay, day) : null;
    if (gap === 0) { /* déjà compté aujourd'hui */ }
    else {
      const cur = gap !== null && gap <= 2 && streak.current > 0 ? streak.current + 1 : 1;
      streak = { current: cur, best: Math.max(streak.best, cur), lastDay: day, claimed: gap !== null && gap <= 2 && streak.current > 0 ? streak.claimed : [] };
    }
  }
  let history = e.history ?? [];
  if (kind === "session" && !history.includes(day)) history = [...history, day].sort().slice(-1500);
  // séance validée : 2 duels de plus aujourd'hui
  const duel = kind === "session" && e.duel?.day === day ? { ...e.duel, bonus: DUEL.perSession } : e.duel;
  const next: Extra = { ...e, daily: inc(e.daily, kind, n), weekly: inc(e.weekly, kind, n), life: inc(e.life, kind, n), streak, history, duel };
  const out = { ...base, extra: next };
  // la puissance du deck a pu changer
  const power = rankedPower(out);
  if (power > next.season.bestPower) return { ...out, extra: { ...next, season: { ...next.season, bestPower: power } } };
  return out;
}

// ───────────── Calendrier des séances ─────────────

export const CALENDAR_MAX_PAST_DAYS = 365;

/** Tous les jours d'entraînement connus (validés ou ajoutés à la main), triés. */
export function trainingDays(e: Extra | undefined): string[] {
  if (!e) return [];
  return [...new Set([...(e.history ?? []), ...(e.declared ?? [])])].sort();
}

/**
 * Ajoute (ou retire) un jour passé « où j'étais à la salle ». Pur confort de suivi : pas de booster, pas de GC,
 * pas d'effet sur la série. Les jours validés dans l'app ne se retirent pas.
 */
export function toggleDeclaredDay(s: PlayerState, day: string, today: string): Result<{ state: PlayerState; on: boolean }> {
  const e = s.extra;
  if (!e) return { ok: false, error: "Indisponible." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: "Date invalide." };
  if (day > today) return { ok: false, error: "Tu ne peux pas cocher un jour à venir." };
  if (daysBetween(day, today) > CALENDAR_MAX_PAST_DAYS) return { ok: false, error: "Ce jour est trop ancien." };
  if ((e.history ?? []).includes(day)) return { ok: false, error: "Séance déjà validée dans l’app : elle reste au calendrier." };
  const declared = e.declared ?? [];
  const on = !declared.includes(day);
  return { ok: true, on, state: { ...s, extra: { ...e, declared: on ? [...declared, day].sort() : declared.filter((d) => d !== day) } } };
}

/** Stats d'un mois (`YYYY-MM`) : jours d'entraînement, et plus longue suite de jours consécutifs. */
export function monthStats(e: Extra | undefined, month: string) {
  const days = trainingDays(e).filter((d) => d.startsWith(month));
  let best = 0, run = 0, prev: string | null = null;
  for (const d of days) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = d;
  }
  return { count: days.length, best };
}

// ───────────── Missions ─────────────

export interface MissionDef { id: string; label: string; kinds: EventKind[]; target: number; reward: number }

const DAILY_POOL: MissionDef[] = [
  { id: "d-open", label: "Ouvre un booster", kinds: ["open"], target: 1, reward: 4 },
  { id: "d-bid", label: "Fais une enchère sur le Marché", kinds: ["bid"], target: 1, reward: 4 },
  { id: "d-list", label: "Mets une carte aux enchères", kinds: ["list"], target: 1, reward: 4 },
  { id: "d-deck", label: "Modifie ou optimise ton deck", kinds: ["deck"], target: 1, reward: 4 },
  { id: "d-login", label: "Récupère ta récompense de connexion", kinds: ["login"], target: 1, reward: 3 },
  { id: "d-discard", label: "Défausse une carte en double", kinds: ["discard"], target: 1, reward: 3 },
  { id: "d-duel", label: "Fais un duel", kinds: ["duel"], target: 1, reward: 4 },
];
const DAILY_SESSION: MissionDef = { id: "d-session", label: "Valide ta séance du jour", kinds: ["session"], target: 1, reward: 6 };

const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** 3 missions par jour : la séance + 2 tirées selon la date (les mêmes pour tout le monde). */
export function dailyMissions(day: string): MissionDef[] {
  const pool = [...DAILY_POOL];
  const out: MissionDef[] = [DAILY_SESSION];
  let h = hash(day);
  for (let i = 0; i < 2; i++) {
    const k = h % pool.length;
    out.push(pool.splice(k, 1)[0]!);
    h = Math.imul(h, 2654435761) >>> 0;
  }
  return out;
}

export const WEEKLY: MissionDef[] = [
  { id: "w-sessions", label: "Valide 3 séances cette semaine", kinds: ["session"], target: 3, reward: 25 },
  { id: "w-open", label: "Ouvre 5 boosters", kinds: ["open"], target: 5, reward: 15 },
  { id: "w-market", label: "Fais 3 actions sur le Marché", kinds: ["bid", "list"], target: 3, reward: 15 },
  { id: "w-duels", label: "Gagne 5 duels", kinds: ["duelWin"], target: 5, reward: 20 },
];

export const countOf = (c: Counters, kinds: EventKind[]) => kinds.reduce((a, k) => a + (c[k] ?? 0), 0);

export function missionProgress(e: Extra, scope: "daily" | "weekly", m: MissionDef) {
  const c = scope === "daily" ? e.daily : e.weekly;
  const claimed = (scope === "daily" ? e.dailyClaimed : e.weeklyClaimed).includes(m.id);
  const value = Math.min(m.target, countOf(c, m.kinds));
  return { value, done: value >= m.target, claimed };
}

export function claimMission(s: PlayerState, scope: "daily" | "weekly", id: string, day: string): Result<{ state: PlayerState; reward: number }> {
  const e = s.extra;
  if (!e) return { ok: false, error: "Indisponible." };
  const m = (scope === "daily" ? dailyMissions(day) : WEEKLY).find((x) => x.id === id);
  if (!m) return { ok: false, error: "Mission introuvable." };
  const p = missionProgress(e, scope, m);
  if (p.claimed) return { ok: false, error: "Déjà récupérée." };
  if (!p.done) return { ok: false, error: "Mission pas encore terminée." };
  const next: Extra = scope === "daily" ? { ...e, dailyClaimed: [...e.dailyClaimed, id] } : { ...e, weeklyClaimed: [...e.weeklyClaimed, id] };
  return { ok: true, reward: m.reward, state: { ...s, gc: s.gc + m.reward, extra: next } };
}

// ───────────── Série de séances ─────────────

export const STREAK_MILESTONES: { days: number; reward: number }[] = [
  { days: 3, reward: 10 }, { days: 7, reward: 25 }, { days: 14, reward: 50 }, { days: 30, reward: 120 },
];

/** Série en cours (1 jour de repos toléré entre deux séances). */
export function streakNow(e: Extra, day: string): number {
  if (!e.streak.lastDay) return 0;
  return daysBetween(e.streak.lastDay, day) <= 2 ? e.streak.current : 0;
}

export function claimStreak(s: PlayerState, days: number, day: string): Result<{ state: PlayerState; reward: number }> {
  const e = s.extra;
  const ms = STREAK_MILESTONES.find((m) => m.days === days);
  if (!e || !ms) return { ok: false, error: "Palier introuvable." };
  if (streakNow(e, day) < days) return { ok: false, error: "Série trop courte." };
  if (e.streak.claimed.includes(days)) return { ok: false, error: "Déjà récupéré." };
  return { ok: true, reward: ms.reward, state: { ...s, gc: s.gc + ms.reward, extra: { ...e, streak: { ...e.streak, claimed: [...e.streak.claimed, days] } } } };
}

// ───────────── Extensions par groupe musculaire ─────────────

/** Paliers d'extension : la récompense est payée PAR EXERCICE du groupe (un grand groupe rapporte plus). */
export interface SetTier { id: string; label: string; minRarity: Rarity; perExercise: number }
export const SET_TIERS: SetTier[] = [
  { id: "t1", label: "Découverte : une carte de chaque exercice", minRarity: "C", perExercise: 3 },
  { id: "t2", label: "Maîtrise : chaque exercice en R ou mieux", minRarity: "R", perExercise: 8 },
  { id: "t3", label: "Élite : chaque exercice en SR ou mieux", minRarity: "SR", perExercise: 24 },
];

export function groupExercises(g: MuscleGroup) { return EXERCISES.filter((e) => e.group === g); }

/** Récompense d'un palier pour un groupe : GC par exercice × nombre d'exercices du groupe. */
export const setReward = (g: MuscleGroup, t: SetTier) => t.perExercise * groupExercises(g).length;

/** Combien d'exercices du groupe sont possédés au moins à la rareté demandée. */
export function setProgress(s: PlayerState, g: MuscleGroup, minRarity: Rarity) {
  const ex = groupExercises(g);
  const min = RARITY_RANK[minRarity];
  const have = ex.filter((x) => s.cards.some((c) => c.exerciseSlug === x.slug && RARITY_RANK[c.rarity] >= min)).length;
  return { have, total: ex.length, done: ex.length > 0 && have === ex.length };
}

/** Cartes uniques (exercice × rareté) possédées dans le groupe. */
export function groupCompletion(s: PlayerState, g: MuscleGroup) {
  const slugs = new Set(groupExercises(g).map((e) => e.slug));
  const owned = new Set(s.cards.filter((c) => slugs.has(c.exerciseSlug)).map((c) => `${c.exerciseSlug}|${c.rarity}`)).size;
  return { owned, total: slugs.size * RARITIES.length };
}

export function claimSet(s: PlayerState, g: MuscleGroup, tierId: string): Result<{ state: PlayerState; reward: number }> {
  const e = s.extra;
  const tier = SET_TIERS.find((t) => t.id === tierId);
  if (!e || !tier) return { ok: false, error: "Palier introuvable." };
  const key = `${g}:${tierId}`;
  if (e.setsClaimed.includes(key)) return { ok: false, error: "Déjà récupéré." };
  if (!setProgress(s, g, tier.minRarity).done) return { ok: false, error: "Extension incomplète." };
  const reward = setReward(g, tier);
  return { ok: true, reward, state: { ...s, gc: s.gc + reward, extra: { ...e, setsClaimed: [...e.setsClaimed, key] } } };
}

export const groupName = (g: MuscleGroup) => GROUPS.find((x) => x.id === g)!.name;

// ───────────── Succès ─────────────

export interface Achievement { id: string; name: string; desc: string; reward: number; target: number; value: (s: PlayerState) => number }

const hasRarity = (r: Rarity) => (s: PlayerState) => (s.cards.some((c) => c.rarity === r) ? 1 : 0);
const life = (k: EventKind) => (s: PlayerState) => s.extra?.life[k] ?? 0;
const uniq = (s: PlayerState) => new Set(s.cards.map((c) => `${c.exerciseSlug}|${c.rarity}`)).size;

export const ACHIEVEMENTS: Achievement[] = [
  { id: "a-sessions-1", name: "Premier pas", desc: "Valide ta première séance", reward: 5, target: 1, value: (s) => s.sessionsValidated },
  { id: "a-sessions-10", name: "Régulier", desc: "Valide 10 séances", reward: 20, target: 10, value: (s) => s.sessionsValidated },
  { id: "a-sessions-50", name: "Machine", desc: "Valide 50 séances", reward: 100, target: 50, value: (s) => s.sessionsValidated },
  { id: "a-streak-7", name: "En feu", desc: "Atteins une série de 7 séances", reward: 25, target: 7, value: (s) => s.extra?.streak.best ?? 0 },
  { id: "a-deck", name: "Deck prêt", desc: "Pose 5 cartes dans ton deck", reward: 10, target: 5, value: (s) => s.deck.length },
  { id: "a-sr", name: "Rare trouvaille", desc: "Obtiens une carte SR", reward: 10, target: 1, value: hasRarity("SR") },
  { id: "a-ssr", name: "Super rare", desc: "Obtiens une carte SSR", reward: 25, target: 1, value: hasRarity("SSR") },
  { id: "a-ur", name: "Ultra", desc: "Obtiens une carte UR", reward: 60, target: 1, value: hasRarity("UR") },
  { id: "a-lr", name: "Légende", desc: "Obtiens une carte LR", reward: 150, target: 1, value: hasRarity("LR") },
  { id: "a-col-15", name: "Collectionneur", desc: "Possède 15 cartes uniques", reward: 20, target: 15, value: uniq },
  { id: "a-col-30", name: "Grand collectionneur", desc: "Possède 30 cartes uniques", reward: 60, target: 30, value: uniq },
  { id: "a-won", name: "Bon enchérisseur", desc: "Remporte une enchère", reward: 10, target: 1, value: life("won") },
  { id: "a-sold", name: "Premier deal", desc: "Vends une carte aux enchères", reward: 10, target: 1, value: life("sold") },
  { id: "a-trade", name: "Échangiste", desc: "Fais un échange avec un ami", reward: 10, target: 1, value: life("trade") },
  { id: "a-friend", name: "Jamais seul", desc: "Ajoute un ami", reward: 5, target: 1, value: (s) => s.extra?.friends.length ?? 0 },
  { id: "a-duel-1", name: "Première victoire", desc: "Gagne ton premier duel", reward: 10, target: 1, value: life("duelWin") },
  { id: "a-duel-10", name: "Gladiateur", desc: "Gagne 10 duels", reward: 30, target: 10, value: life("duelWin") },
  { id: "a-grade-1", name: "Œil de pierre", desc: "Fais expertiser une carte par Basile", reward: 5, target: 1, value: life("grade") },
  { id: "a-grade-10", name: "Perfection", desc: "Obtiens la note 10 à une expertise", reward: 50, target: 1, value: (s) => (s.cards.some((c) => c.grade === 10) ? 1 : 0) },
];

export function claimAchievement(s: PlayerState, id: string): Result<{ state: PlayerState; reward: number }> {
  const e = s.extra;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!e || !a) return { ok: false, error: "Succès introuvable." };
  if (e.achClaimed.includes(id)) return { ok: false, error: "Déjà récupéré." };
  if (a.value(s) < a.target) return { ok: false, error: "Succès pas encore débloqué." };
  return { ok: true, reward: a.reward, state: { ...s, gc: s.gc + a.reward, extra: { ...e, achClaimed: [...e.achClaimed, id] } } };
}

/** Nombre de récompenses prêtes à récupérer (pastille sur l'accueil). */
export function claimableCount(s: PlayerState, day: string): number {
  const e = s.extra;
  if (!e) return 0;
  let n = 0;
  for (const m of dailyMissions(day)) { const p = missionProgress(e, "daily", m); if (p.done && !p.claimed) n++; }
  for (const m of WEEKLY) { const p = missionProgress(e, "weekly", m); if (p.done && !p.claimed) n++; }
  const st = streakNow(e, day);
  for (const m of STREAK_MILESTONES) if (st >= m.days && !e.streak.claimed.includes(m.days)) n++;
  for (const a of ACHIEVEMENTS) if (!e.achClaimed.includes(a.id) && a.value(s) >= a.target) n++;
  for (const g of GROUPS) for (const t of SET_TIERS) if (!e.setsClaimed.includes(`${g.id}:${t.id}`) && setProgress(s, g.id, t.minRarity).done) n++;
  if (e.pendingSeason) n++;
  return n;
}

export const today = (now = new Date()) => parisDay(now);
