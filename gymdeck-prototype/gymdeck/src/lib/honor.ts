/**
 * Petites phrases d'humour sur la validation « sur l'honneur » : elles changent chaque jour.
 * Toujours honnêtes : personne ne vérifie vraiment, on ne prétend jamais le contraire.
 * L'accueil (avant le compte) garde sa phrase fixe : « On ne viendra pas vérifier… ».
 */
export const HONOR_LINES: string[] = [
  "Personne ne vérifie. Mais monter les escaliers, ce n’est pas le leg day.",
  "Aucun contrôle ici. Le canapé, lui, ne compte toujours pas comme une salle.",
  "On te fait confiance. Ton miroir, un peu moins.",
  "Zéro preuve demandée. Regarder un tuto de squat, ce n’est pas faire un squat.",
  "Pas de vigile à l’entrée. Juste tes courbatures de demain pour témoigner.",
  "Ici, c’est sur l’honneur. Porter les courses, ce n’est pas une série de farmer walk.",
  "Personne ne te demande de preuve. Le mec du coin de la salle, lui, sait si t’es venu.",
  "Aucun inspecteur des séances. Scroller des vidéos muscu ne fait pas pousser les biceps.",
  "On te croit sur parole. Penser très fort à ton développé couché ne compte pas.",
  "Pas de badge à scanner. Ton reflet, lui, voit la différence.",
  "Zéro contrôle. La sieste post-repas n’est pas une séance de récup active.",
  "Sur l’honneur, comme toujours. Courir après le bus, ce n’est pas ton cardio du jour.",
];

/**
 * Phrase du jour pour un emplacement donné. `day` : jour de Paris (« AAAA-MM-JJ »).
 * Chaque emplacement est décalé : deux endroits ne montrent jamais la même phrase le même jour.
 */
export function honorLine(day: string, slot = 0): string {
  const n = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86_400_000);
  const i = (((n * 5 + slot * 7) % HONOR_LINES.length) + HONOR_LINES.length) % HONOR_LINES.length;
  return HONOR_LINES[i]!;
}
