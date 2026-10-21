/**
 * Sauvegarde en ligne sur plusieurs appareils : quelle copie garder ?
 * Le téléphone garde sa propre copie de la partie (localStorage). La copie en ligne (Supabase) porte une date
 * `updated_at`, posée à chaque enregistrement. On retient la date en ligne vue en dernier (`base`) :
 * - si la date en ligne n'a pas bougé depuis, personne d'autre n'a joué : la copie du téléphone est la bonne ;
 * - si elle a bougé, un autre appareil a enregistré : on ne doit jamais l'écraser avec une copie plus ancienne.
 */

export interface SyncInfo {
  /** Compte auquel appartient la copie du téléphone. */
  userId: string;
  /** Date `updated_at` de la copie en ligne vue en dernier (null : rien d'enregistré en ligne). */
  base: string | null;
  /** Vrai si la copie du téléphone a des changements pas encore enregistrés en ligne. */
  dirty: boolean;
  /** Heure (ms) du dernier changement sur ce téléphone. */
  savedAt: number;
}

/**
 * Au démarrage : garder la copie du téléphone (« local ») ou reprendre celle en ligne (« cloud ») ?
 * `cloudUpdatedAt` est null quand le compte n'a encore rien enregistré en ligne.
 */
export function startupChoice(local: SyncInfo | null, userId: string, cloudUpdatedAt: string | null): "local" | "cloud" {
  if (!cloudUpdatedAt) return "local";
  // copie du téléphone inconnue ou d'un autre compte : la copie en ligne fait foi
  if (!local || local.userId !== userId) return "cloud";
  // personne n'a enregistré depuis notre dernier passage
  if (local.base === cloudUpdatedAt) return "local";
  // un autre appareil a enregistré et ce téléphone n'a rien de neuf
  if (!local.dirty) return "cloud";
  // les deux ont changé : la plus récente gagne
  return local.savedAt > Date.parse(cloudUpdatedAt) ? "local" : "cloud";
}

/** Vrai si un autre appareil a enregistré depuis notre dernier passage. */
export const changedElsewhere = (info: Pick<SyncInfo, "base">, cloudUpdatedAt: string | null | undefined) =>
  !!cloudUpdatedAt && cloudUpdatedAt !== info.base;
