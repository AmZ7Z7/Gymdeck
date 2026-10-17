import { CardData, deckPower, makeCard, drawRarity, type Weights } from "./engine";
import { fairValue } from "./market";
import { atWorkshop, newId, type OwnedCard, type PlayerState, type Result } from "./game";
import { normalize, seasonOf } from "./progress";
import { migrateGrades } from "./grading";
import { seededRng, type Rng } from "./rng";

/**
 * Amis, échanges et classement (prototype).
 * Les autres joueurs sont SIMULÉS : leurs cartes et leur niveau sont générés à partir d'une graine fixe.
 * La vraie version lira de vrais profils sur le serveur ; les règles ci-dessous (valeur équivalente pour un
 * échange, rang par puissance de deck) seront rejouées côté serveur.
 */

const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

const LEVELS: Weights[] = [
  { C: 5200, R: 3000, SR: 1400, SSR: 330, UR: 60, LR: 10 },
  { C: 3200, R: 3200, SR: 2200, SSR: 1100, UR: 250, LR: 50 },
  { C: 1500, R: 2600, SR: 3000, SSR: 2200, UR: 570, LR: 130 },
  { C: 600, R: 1600, SR: 2800, SSR: 3300, UR: 1300, LR: 400 },
];

const NAMES = [
  "Léa_Fit", "Karim92", "BigSquat", "Camille.R", "IronMaxime", "Nora.Lifts", "TomPush", "Sarah_Gym", "Yanis75", "LiftOrDie",
  "Mathis.B", "Jade_Pull", "Hugo.Deadlift", "Inès_Move", "Théo.Bench", "Manon.Fit", "Rayan_Iron", "Clara.Squat", "Lucas93", "Anaïs_Gains",
  "PumpKing", "Zoé.Strong", "Enzo_Rows", "Lola.Lifts", "Adam_Curl", "Eva.Trainer", "Noah.Press", "Maëlle_Fit", "Nils.Gym", "Sofia_Power",
  "Axel.Quad", "Romane_Fit", "Ilyes.Heavy", "Chloé_Glutes", "Baptiste.R", "Lina.Barbell", "Gabin_Lift", "Océane.Fit", "Samir.Iron", "Margaux_Gym",
];

export interface Bot { id: string; name: string; code: string; level: number }

const codeFor = (id: string) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let h = hash("code:" + id), s = "GD-";
  for (let i = 0; i < 6; i++) { s += chars[h % chars.length]; h = Math.imul(h ^ (h >>> 7), 2246822519) >>> 0; }
  return s;
};

export const BOTS: Bot[] = NAMES.map((name, i) => ({ id: `bot${i}`, name, code: codeFor(`bot${i}`), level: hash(`lv${i}`) % LEVELS.length }));
export const FRIEND_SUGGESTIONS = BOTS.slice(0, 6);
export const botById = (id: string) => BOTS.find((b) => b.id === id);
export const botByCode = (code: string) => BOTS.find((b) => b.code === code.trim().toUpperCase());

function drawBotCard(rng: Rng, level: number): CardData {
  return makeCard(rng, drawRarity(rng, LEVELS[level]!));
}

/** Deck simulé d'un joueur fictif : 5 exercices différents. */
export function botDeck(bot: Bot): CardData[] {
  const rng = seededRng(hash("deck" + bot.id));
  const used = new Set<string>();
  const out: CardData[] = [];
  let guard = 0;
  while (out.length < 5 && guard++ < 400) {
    const c = drawBotCard(rng, bot.level);
    if (used.has(c.exerciseSlug)) continue;
    used.add(c.exerciseSlug);
    out.push(c);
  }
  return out;
}

export const botPower = (bot: Bot) => deckPower(botDeck(bot));

/** Les 3 cartes qu'un ami met en vitrine. */
export function botShowcase(bot: Bot): CardData[] {
  const best = [...botDeck(bot)].sort((a, b) => b.atq + b.def - (a.atq + a.def));
  return best.slice(0, 3);
}

/** Cartes qu'un ami propose à l'échange (se renouvellent après chaque échange). */
export function botOffers(bot: Bot, nonce: number): CardData[] {
  const rng = seededRng(hash(`offers${bot.id}:${nonce}`));
  return Array.from({ length: 4 }, () => drawBotCard(rng, bot.level));
}

// ───────────── Amis ─────────────

export function addFriend(s: PlayerState, code: string): Result<{ state: PlayerState; bot: Bot }> {
  const e = s.extra;
  if (!e) return { ok: false, error: "Indisponible." };
  const clean = code.trim().toUpperCase();
  if (clean === e.friendCode) return { ok: false, error: "C'est ton propre code." };
  const bot = botByCode(clean);
  if (!bot) return { ok: false, error: "Code inconnu. (Prototype : seuls des joueurs fictifs existent pour l'instant.)" };
  if (e.friends.includes(bot.id)) return { ok: false, error: "Il est déjà dans tes amis." };
  return { ok: true, bot, state: { ...s, extra: { ...e, friends: [...e.friends, bot.id] } } };
}

export function removeFriend(s: PlayerState, botId: string): PlayerState {
  const e = s.extra;
  return e ? { ...s, extra: { ...e, friends: e.friends.filter((f) => f !== botId) } } : s;
}

// ───────────── Vitrine ─────────────

export function toggleShowcase(s: PlayerState, cardId: string): Result<{ state: PlayerState; on: boolean }> {
  const e = s.extra;
  if (!e) return { ok: false, error: "Indisponible." };
  if (!s.cards.some((c) => c.id === cardId)) return { ok: false, error: "Carte introuvable." };
  if (e.showcase.includes(cardId)) return { ok: true, on: false, state: { ...s, extra: { ...e, showcase: e.showcase.filter((x) => x !== cardId) } } };
  if (e.showcase.length >= 3) return { ok: false, error: "Ta vitrine est pleine (3 cartes). Retire-en une d'abord." };
  return { ok: true, on: true, state: { ...s, extra: { ...e, showcase: [...e.showcase, cardId] } } };
}

// ───────────── Échanges ─────────────

export const TRADE_DAILY_MAX = 5;

/**
 * L'ami accepte si ce que tu donnes vaut au moins autant que ce que tu demandes (valeur marché estimée).
 * Ta carte ne doit pas être dans ton deck.
 */
export function proposeTrade(
  s: PlayerState, botId: string, myCardId: string, offerIndex: number, dayTrades: number,
): Result<{ state: PlayerState; got: OwnedCard; gave: OwnedCard }> {
  const e = s.extra;
  const bot = botById(botId);
  if (!e || !bot || !e.friends.includes(botId)) return { ok: false, error: "Ami introuvable." };
  if (dayTrades >= TRADE_DAILY_MAX) return { ok: false, error: `Maximum ${TRADE_DAILY_MAX} échanges par jour.` };
  const mine = s.cards.find((c) => c.id === myCardId);
  if (!mine) return { ok: false, error: "Carte introuvable." };
  if (s.deck.includes(myCardId)) return { ok: false, error: "Retire d'abord cette carte de ton deck." };
  if (atWorkshop(s, myCardId)) return { ok: false, error: "Cette carte est chez Basile : attends la fin de l’expertise." };
  const nonce = e.tradeNonce[botId] ?? 0;
  const theirs = botOffers(bot, nonce)[offerIndex];
  if (!theirs) return { ok: false, error: "Carte introuvable." };
  if (fairValue(mine) < fairValue(theirs)) return { ok: false, error: `${bot.name} refuse : ta carte vaut moins que la sienne.` };
  const got: OwnedCard = { ...theirs, id: newId(), obtainedSeq: s.seq + 1 };
  return {
    ok: true, got, gave: mine,
    state: {
      ...s, seq: s.seq + 1,
      cards: [...s.cards.filter((c) => c.id !== myCardId), got],
      extra: { ...e, showcase: e.showcase.filter((x) => x !== myCardId), tradeNonce: { ...e.tradeNonce, [botId]: nonce + 1 } },
    },
  };
}

// ───────────── Classement de saison (points de duel) ─────────────

export interface Standing { name: string; points: number; me: boolean; rank: number }

const daysInMonth = (seasonId: string) => {
  const [y, m] = seasonId.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/**
 * Points d'un joueur fictif : il combat tous les jours, à un rythme qui dépend de son niveau (≈ 2 à 10 points par jour).
 * Un joueur qui valide ses séances (5 duels par jour) et gagne souvent peut viser le haut du classement.
 */
export const botSeasonPoints = (bot: Bot, seasonId: string, dayOfMonth: number) => {
  const rate = 2 + bot.level * 1.6 + (hash(bot.id + seasonId) % 32) / 10;
  return Math.round(rate * Math.max(0, dayOfMonth));
};

export function leaderboard(s: PlayerState, day: string): Standing[] {
  const sid = seasonOf(day);
  const dom = Number(day.slice(8, 10));
  const rows: Omit<Standing, "rank">[] = BOTS.map((b) => ({ name: b.name, points: botSeasonPoints(b, sid, dom), me: false }));
  const myPts = s.extra?.season.id === sid ? s.extra.season.points ?? 0 : 0;
  if (myPts > 0) rows.push({ name: s.name ?? "Moi", points: myPts, me: true });
  // à égalité de points, le joueur passe devant (il a combattu pour de vrai)
  rows.sort((a, b) => b.points - a.points || Number(b.me) - Number(a.me));
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Rang final d'une saison terminée (les joueurs fictifs ont joué tout le mois). */
export function finalRank(seasonId: string, points: number): { rank: number; total: number } {
  const last = daysInMonth(seasonId);
  const bots = BOTS.map((b) => botSeasonPoints(b, seasonId, last));
  return { rank: 1 + bots.filter((p) => p > points).length, total: bots.length + 1 };
}

/** Raccourci : normalise l'état avec le calcul de classement de ce module. */
export const normalizeState = (s: PlayerState, rng: Rng, day: string) => {
  const cards = migrateGrades(s.cards);
  return normalize(cards === s.cards ? s : { ...s, cards }, rng, day, finalRank);
};
