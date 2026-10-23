/**
 * Petites phrases d'humour sur la validation « sur l'honneur » : elles changent chaque jour.
 * Toujours honnêtes : personne ne vérifie vraiment, on ne prétend jamais le contraire.
 * Liste validée par Adrien le 23 oct. 2026. Les thèmes sont mélangés pour varier d'un jour à l'autre.
 */
export const HONOR_LINES: string[] = [
  "Personne ne vérifie. Mais monter les escaliers, ce n’est pas le leg day.",
  "On te croit sur parole. Penser très fort à ton développé couché ne compte pas.",
  "Aucun contrôle ici. Le canapé, lui, ne compte toujours pas comme une salle.",
  "Sur l’honneur. Mettre ta tenue de sport et rester chez toi, ça ne compte pas.",
  "Zéro preuve demandée. Regarder un tuto de squat, ce n’est pas faire un squat.",
  "Ici, c’est sur l’honneur. Porter les courses, ce n’est pas une série de farmer walk.",
  "Zéro contrôle. La sieste post-repas n’est pas une séance de récup active.",
  "Aucun inspecteur des séances. Scroller des vidéos muscu ne fait pas pousser les biceps.",
  "Aucun contrôle. Déplacer ton canapé chez un pote, c’est presque un deadlift… presque.",
  "On ne viendra pas vérifier. « J’y pensais très fort » ne compte pas comme une séance.",
  "Sur l’honneur, comme toujours. Courir après le bus, ce n’est pas ton cardio du jour.",
  "Pas de preuve à fournir. Liker la séance d’un influenceur, ce n’est pas la faire.",
  "On te fait confiance. Le rest day, ça ne dure pas toute la semaine.",
  "Personne ne vérifie. Se lever pour chercher la télécommande ne compte pas comme une série.",
  "On ne contrôle rien. Préparer sa playlist de salle, ce n’est pas encore y être.",
];

/** Emplacements où une phrase s'affiche : chacun a la sienne, jamais la même le même jour. */
export type HonorSlot = 0 | 1 | 2; // 0 : accueil du jeu · 1 : fenêtre « Séance terminée ? » · 2 : inscription (étape 1)

/** Pas d'un jour à l'autre : premier nombre sans diviseur commun avec la taille de la liste, pour que toutes les phrases passent. */
const STEP = [7, 5, 3, 1].find((s) => gcd(s, HONOR_LINES.length) === 1)!;
function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a; }

/** Phrase du jour pour un emplacement. `day` : jour de Paris (« AAAA-MM-JJ »). */
export function honorLine(day: string, slot: HonorSlot = 0): string {
  const n = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86_400_000);
  const len = HONOR_LINES.length;
  const i = (((n * STEP + slot * Math.floor(len / 3)) % len) + len) % len;
  return HONOR_LINES[i]!;
}
