import { GRADE_HOURS, GRADE_PRICE, GRADE_SLOTS, GRADE_WEIGHTS, GRADES, UPGRADE_CHANCE, gradeStatPct, gradeStatPctV1 } from "./config";
import type { OwnedCard, PlayerState, Result } from "./game";
import type { Rng } from "./rng";

/**
 * Expertise des cartes à l'atelier de Basile.
 * - Prix selon la rareté, résultat au bout de 24 h, une seule expertise par carte.
 * - La note est tirée dès le dépôt (et enregistrée) : recharger la page ne permet pas de la relancer.
 * - Pendant l'expertise, la carte reste dans le deck mais ne peut être ni vendue, ni échangée, ni défaussée.
 * - Effet sur ATQ et DEF : de −2 % (note 1) à +6 % (note 10), voir GRADE_STAT_PCT.
 * - Une carte notée peut repasser chez Basile pour tenter de gagner +1 point (jamais de baisse).
 */

export interface GradingJob {
  cardId: string;
  startedAt: number;
  readyAt: number;
  /** Note déjà tirée, révélée à la fin de l'expertise. */
  grade: number;
  price: number;
  /** Réexamen d'une carte déjà notée (pour monter la note) : note de départ. */
  from?: number;
}

export interface GradeReveal {
  card: OwnedCard;
  grade: number;
  pct: number;
  before: { atq: number; def: number };
  /** Réexamen : note avant (la note a monté si grade > from). */
  from?: number;
}

const HOUR = 3_600_000;

export const jobsOf = (s: PlayerState): GradingJob[] => s.grading ?? [];
export const isAtWorkshop = (s: PlayerState, cardId: string) => jobsOf(s).some((j) => j.cardId === cardId);
export const isReady = (j: GradingJob, now: number) => now >= j.readyAt;
export const readyCount = (s: PlayerState, now: number) => jobsOf(s).filter((j) => isReady(j, now)).length;

/** Tire une note selon la table officielle (affichée dans l'appli). */
export function drawGrade(rng: Rng): number {
  let roll = rng.int(0, 9999);
  for (const g of GRADES) {
    if (roll < GRADE_WEIGHTS[g]!) return g;
    roll -= GRADE_WEIGHTS[g]!;
  }
  return 7;
}

/** Applique l'effet d'une note aux stats. */
export function gradedStats(atq: number, def: number, grade: number) {
  const pct = gradeStatPct(grade);
  return { atq: Math.round((atq * (100 + pct)) / 100), def: Math.round((def * (100 + pct)) / 100), pct };
}

/** Stats de la carte sans l'effet de sa note. */
export const rawStats = (c: { atq: number; def: number; raw?: { atq: number; def: number } }) => c.raw ?? { atq: c.atq, def: c.def };

/** Ce que la note ajoute (ou retire) à la carte. */
export function gradeBonus(c: { atq: number; def: number; grade?: number; raw?: { atq: number; def: number } }) {
  const r = rawStats(c);
  return { pct: c.grade ? gradeStatPct(c.grade) : 0, atq: c.atq - r.atq, def: c.def - r.def };
}

/** Met à jour les cartes notées avant la v12 (barème changé) : stats de base retrouvées, nouvel effet appliqué. */
export function migrateGrades<T extends { atq: number; def: number; grade?: number; raw?: { atq: number; def: number } }>(cards: T[]): T[] {
  if (!cards.some((c) => c.grade && !c.raw)) return cards;
  return cards.map((c) => {
    if (!c.grade || c.raw) return c;
    const old = gradeStatPctV1(c.grade);
    const raw = { atq: Math.round((c.atq * 100) / (100 + old)), def: Math.round((c.def * 100) / (100 + old)) };
    const g = gradedStats(raw.atq, raw.def, c.grade);
    return { ...c, raw, atq: g.atq, def: g.def };
  });
}

/** Chance (0 à 1) que le réexamen fasse gagner un point. */
export const upgradeChance = (grade: number) => (grade >= 10 ? 0 : (UPGRADE_CHANCE[grade + 1] ?? 0) / 10000);

/** Raison pour laquelle une carte notée ne peut pas repasser chez Basile (ou null). */
export function upgradeBlocker(s: PlayerState, cardId: string): string | null {
  const c = s.cards.find((x) => x.id === cardId);
  if (!c) return "Carte introuvable.";
  if (!c.grade) return "Cette carte n’a pas encore de note.";
  if (c.grade >= 10) return "Note maximale : 10 sur 10.";
  if (isAtWorkshop(s, cardId)) return "Basile examine déjà cette carte.";
  if (jobsOf(s).length >= GRADE_SLOTS) return `L’établi de Basile est plein (${GRADE_SLOTS} cartes).`;
  const price = GRADE_PRICE[c.rarity];
  if (s.gc < price) return `Il manque ${price - s.gc} GC.`;
  return null;
}

/** Réexamen : paiement immédiat, résultat (+1 ou note inchangée) tiré et gardé secret jusqu'à la fin. */
export function submitUpgrade(s: PlayerState, cardId: string, rng: Rng, now: number): Result<{ state: PlayerState; job: GradingJob }> {
  const err = upgradeBlocker(s, cardId);
  if (err) return { ok: false, error: err };
  const c = s.cards.find((x) => x.id === cardId)!;
  const from = c.grade!;
  const up = rng.int(0, 9999) < (UPGRADE_CHANCE[from + 1] ?? 0);
  const price = GRADE_PRICE[c.rarity];
  const job: GradingJob = { cardId, startedAt: now, readyAt: now + GRADE_HOURS * HOUR, grade: up ? from + 1 : from, price, from };
  return { ok: true, job, state: { ...s, gc: s.gc - price, grading: [...jobsOf(s), job] } };
}

/** Raison pour laquelle une carte ne peut pas être confiée à Basile (ou null). */
export function gradeBlocker(s: PlayerState, cardId: string): string | null {
  const c = s.cards.find((x) => x.id === cardId);
  if (!c) return "Carte introuvable.";
  if (c.grade) return "Cette carte a déjà été expertisée.";
  if (isAtWorkshop(s, cardId)) return "Basile examine déjà cette carte.";
  if (jobsOf(s).length >= GRADE_SLOTS) return `L’établi de Basile est plein (${GRADE_SLOTS} cartes).`;
  const price = GRADE_PRICE[c.rarity];
  if (s.gc < price) return `Il manque ${price - s.gc} GC.`;
  return null;
}

/** Confier une carte : paiement immédiat, note tirée et gardée secrète jusqu'à la fin. */
export function submitGrading(s: PlayerState, cardId: string, rng: Rng, now: number): Result<{ state: PlayerState; job: GradingJob }> {
  const err = gradeBlocker(s, cardId);
  if (err) return { ok: false, error: err };
  const c = s.cards.find((x) => x.id === cardId)!;
  const price = GRADE_PRICE[c.rarity];
  const job: GradingJob = { cardId, startedAt: now, readyAt: now + GRADE_HOURS * HOUR, grade: drawGrade(rng), price };
  return { ok: true, job, state: { ...s, gc: s.gc - price, grading: [...jobsOf(s), job] } };
}

/** Révéler le résultat (expertise terminée) : la note et son effet sont appliqués à la carte. */
export function revealGrading(s: PlayerState, cardId: string, now: number): Result<{ state: PlayerState } & GradeReveal> {
  const job = jobsOf(s).find((j) => j.cardId === cardId);
  if (!job) return { ok: false, error: "Aucune expertise pour cette carte." };
  if (!isReady(job, now)) return { ok: false, error: "Basile n’a pas encore terminé." };
  const card = s.cards.find((c) => c.id === cardId);
  const rest = jobsOf(s).filter((j) => j.cardId !== cardId);
  if (!card) return { ok: false, error: "Carte introuvable." };
  const raw = rawStats(card);
  const g = gradedStats(raw.atq, raw.def, job.grade);
  const next: OwnedCard = { ...card, raw, atq: g.atq, def: g.def, grade: job.grade };
  return {
    ok: true, card: next, grade: job.grade, pct: g.pct, before: { atq: card.atq, def: card.def }, ...(job.from ? { from: job.from } : {}),
    state: { ...s, grading: rest, cards: s.cards.map((c) => (c.id === cardId ? next : c)) },
  };
}

/** Outil de test : toutes les expertises sont terminées. */
export const finishAll = (s: PlayerState, now: number): PlayerState =>
  ({ ...s, grading: jobsOf(s).map((j) => ({ ...j, readyAt: Math.min(j.readyAt, now) })) });
