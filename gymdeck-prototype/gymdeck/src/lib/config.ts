/**
 * Règles GymDeck — source unique de vérité.
 * Tout vient de la fiche récapitulative validée par Adrien (5 oct. 2026).
 * Les probabilités sont exprimées en « points de base » sur 10 000 (1 % = 100)
 * pour éviter toute erreur d'arrondi flottant.
 */

export const RARITIES = ["C", "R", "SR", "SSR", "UR", "LR"] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_RANK: Record<Rarity, number> = { C: 0, R: 1, SR: 2, SSR: 3, UR: 4, LR: 5 };

/** Fourchettes ATQ / DEF (bornes incluses, chaque entier équiprobable). */
export const STAT_RANGE: Record<Rarity, { min: number; max: number }> = {
  C: { min: 100, max: 180 },
  R: { min: 220, max: 320 },
  SR: { min: 380, max: 520 },
  SSR: { min: 600, max: 800 },
  UR: { min: 900, max: 1150 },
  LR: { min: 1300, max: 1700 },
};

/** Poids sur 10 000. Chaque table doit sommer à 10 000. */
export const NORMAL_WEIGHTS: Record<Rarity, number> = {
  C: 6200, // 62 %
  R: 2400, // 24 %
  SR: 870, // 8,7 %
  SSR: 400, // 4 %
  UR: 100, // 1 %
  LR: 30, // 0,3 %
};

/** Deuxième booster de bienvenue. */
export const WELCOME2_WEIGHTS: Record<Rarity, number> = {
  C: 4500, // 45 %
  R: 3300, // 33 %
  SR: 1450, // 14,5 %
  SSR: 595, // 5,95 %
  UR: 125, // 1,25 %
  LR: 30, // 0,3 %
};

export const DISCARD_GC: Record<Rarity, number> = { C: 1, R: 2, SR: 4, SSR: 6, UR: 12, LR: 25 };

export const CARDS_PER_BOOSTER = 5;
export const PITY_THRESHOLD = 12; // le 12e booster garantit une UR après 11 sans UR/LR
export const BOOSTER_PRICE_GC = 75;
export const DAILY_LOGIN_GC = 5;
export const LOGIN_CYCLE = 7;
export const DECK_SIZE = 5;
export const PARIS_TZ = "Europe/Paris";

/**
 * Passifs UR / LR, en dixièmes de pour cent (pas de 0,1 %).
 * « single » = ATQ seule ou DEF seule ; « both » = valeur pour chacune des deux stats.
 */
export const PASSIVE_TENTHS = {
  UR: { single: { min: 20, max: 40 }, both: { min: 10, max: 20 } },
  LR: { single: { min: 50, max: 70 }, both: { min: 25, max: 35 } },
} as const;

export type BoosterKind = "welcome1" | "welcome2" | "session" | "login" | "shop";

export type MuscleGroup = "pecs" | "epaules" | "dos" | "bras" | "jambes" | "abdos" | "cardio";

/** Extensions (séries) : une par groupe musculaire. Les nouveaux exercices s'y ajoutent via le champ `group`. */
export const GROUPS: { id: MuscleGroup; name: string; short: string; emoji: string }[] = [
  { id: "pecs", name: "Pectoraux", short: "Pecs", emoji: "🔥" },
  { id: "epaules", name: "Épaules", short: "Épaules", emoji: "⚡" },
  { id: "dos", name: "Dos", short: "Dos", emoji: "🦅" },
  { id: "bras", name: "Bras", short: "Bras", emoji: "💪" },
  { id: "jambes", name: "Jambes & fessiers", short: "Jambes", emoji: "🦵" },
  { id: "abdos", name: "Abdos & gainage", short: "Abdos", emoji: "🎯" },
  { id: "cardio", name: "Cardio", short: "Cardio", emoji: "❤️‍🔥" },
];
export const groupInfo = (g: MuscleGroup) => GROUPS.find((x) => x.id === g)!;

/**
 * Cadrage de l'illustration dans la zone d'art de la carte (toujours en « contain », jamais recadrée) :
 * `s` = échelle (1 = la zone entière), `x` / `y` = décalage en % de la zone (y > 0 descend l'image).
 */
export interface ArtFit { s?: number; x?: number; y?: number }

export interface Exercise {
  slug: string;
  name: string;
  image: string;
  group: MuscleGroup;
  fit?: ArtFit;
}

/** Catalogue (32 exercices illustrés). */
export const EXERCISES: Exercise[] = [
  { slug: "developpe-couche", name: "Développé couché haltères", image: "/assets/exercises/developpe-couche.webp", group: "pecs" },
  { slug: "developpe-incline", name: "Développé incliné haltères", image: "/assets/exercises/developpe-incline.webp", group: "pecs" },
  { slug: "developpe-militaire", name: "Développé militaire", image: "/assets/exercises/developpe-militaire.webp", group: "epaules" },
  { slug: "tirage-vertical", name: "Tirage vertical", image: "/assets/exercises/tirage-vertical.webp", group: "dos" },
  { slug: "rowing-barre", name: "Rowing barre", image: "/assets/exercises/rowing-barre.webp", group: "dos" },
  { slug: "souleve-de-terre", name: "Soulevé de terre", image: "/assets/exercises/souleve-de-terre.webp", group: "jambes" },
  { slug: "hip-thrust", name: "Hip thrust", image: "/assets/exercises/hip-thrust.webp", group: "jambes" },
  { slug: "curl-biceps", name: "Curl biceps haltères", image: "/assets/exercises/curl-biceps.webp", group: "bras" },
  { slug: "elevations-laterales", name: "Élévations latérales", image: "/assets/exercises/elevations-laterales.webp", group: "epaules" },
  { slug: "squat", name: "Squat barre", image: "/assets/exercises/squat.webp", group: "jambes" },
  { slug: "presse-a-cuisses", name: "Presse à cuisses", image: "/assets/exercises/presse-a-cuisses.webp", group: "jambes", fit: { y: -10 } },
  { slug: "crunch-poulie", name: "Crunch poulie", image: "/assets/exercises/crunch-poulie.webp", group: "abdos" },
  { slug: "leg-curl-assis", name: "Leg curl assis", image: "/assets/exercises/leg-curl-assis.webp", group: "jambes" },
  { slug: "extension-triceps-corde", name: "Extension triceps corde", image: "/assets/exercises/extension-triceps-corde.webp", group: "bras" },
  { slug: "developpe-poitrine-machine", name: "Développé poitrine machine", image: "/assets/exercises/developpe-poitrine-machine.webp", group: "pecs" },
  { slug: "rowing-poulie-basse", name: "Rowing poulie basse", image: "/assets/exercises/rowing-poulie-basse.webp", group: "dos" },
  { slug: "leg-extension", name: "Leg extension", image: "/assets/exercises/leg-extension.webp", group: "jambes" },
  { slug: "gainage", name: "Gainage", image: "/assets/exercises/gainage.webp", group: "abdos", fit: { s: 0.93, y: -32 } },
  { slug: "tractions-assistees", name: "Tractions assistées", image: "/assets/exercises/tractions-assistees.webp", group: "dos" },
  { slug: "curl-marteau", name: "Curl marteau", image: "/assets/exercises/curl-marteau.webp", group: "bras" },
  { slug: "extension-triceps-overhead", name: "Extension triceps au-dessus de la tête", image: "/assets/exercises/extension-triceps-overhead.webp", group: "bras" },
  { slug: "velo-de-salle", name: "Vélo de salle", image: "/assets/exercises/velo-de-salle.webp", group: "cardio" },
  { slug: "developpe-couche-barre", name: "Développé couché barre", image: "/assets/exercises/developpe-couche-barre.webp", group: "pecs" },
  { slug: "developpe-militaire-halteres", name: "Développé militaire haltères", image: "/assets/exercises/developpe-militaire-halteres.webp", group: "epaules" },
  { slug: "ecarte-poulie", name: "Écarté à la poulie", image: "/assets/exercises/ecarte-poulie.webp", group: "pecs" },
  { slug: "rameur", name: "Rameur", image: "/assets/exercises/rameur.webp", group: "cardio" },
  { slug: "fentes-halteres", name: "Fentes haltères", image: "/assets/exercises/fentes-halteres.webp", group: "jambes" },
  { slug: "mollets-debout", name: "Mollets debout machine", image: "/assets/exercises/mollets-debout.webp", group: "jambes" },
  { slug: "extension-lombaire", name: "Extension lombaire", image: "/assets/exercises/extension-lombaire.webp", group: "dos" },
  { slug: "hack-squat", name: "Hack squat", image: "/assets/exercises/hack-squat.webp", group: "jambes" },
  { slug: "face-pull", name: "Face pull", image: "/assets/exercises/face-pull.webp", group: "epaules" },
  { slug: "course-tapis", name: "Course sur tapis", image: "/assets/exercises/course-tapis.webp", group: "cardio" },
];

// Garde-fou : une table de probabilités incorrecte doit empêcher le démarrage.
for (const [name, table] of [["NORMAL", NORMAL_WEIGHTS], ["WELCOME2", WELCOME2_WEIGHTS]] as const) {
  const sum = Object.values(table).reduce((a, b) => a + b, 0);
  if (sum !== 10000) throw new Error(`Table ${name} : somme ${sum} ≠ 10000`);
}

/** Position (en fraction de la hauteur de la carte) des bandeaux de chaque cadre, mesurée sur les images. */
export const FRAME_LAYOUT: Record<Rarity, { nameTop: number; statsTop: number; statsBottom: number }> = {
  C: { nameTop: 0.731, statsTop: 0.827, statsBottom: 0.949 },
  R: { nameTop: 0.724, statsTop: 0.817, statsBottom: 0.956 },
  SR: { nameTop: 0.743, statsTop: 0.834, statsBottom: 0.961 },
  SSR: { nameTop: 0.686, statsTop: 0.788, statsBottom: 0.953 },
  UR: { nameTop: 0.735, statsTop: 0.812, statsBottom: 0.931 },
  LR: { nameTop: 0.678, statsTop: 0.771, statsBottom: 0.937 },
};

export const RARITY_COLOR: Record<Rarity, string> = {
  C: "#aab2bd",
  R: "#2dff8a",
  SR: "#3cc4ff",
  SSR: "#d946ef",
  UR: "#ffb020",
  LR: "#ff4fa3",
};

export const exerciseBySlug = (slug: string): Exercise =>
  EXERCISES.find((e) => e.slug === slug) ?? EXERCISES[0]!;

export const groupOfSlug = (slug: string): MuscleGroup => exerciseBySlug(slug).group;

// ───────────── Expertise des cartes (atelier de Basile) ─────────────

/** Probabilités des notes, sur 10 000 (validées par Adrien le 14 oct. 2026). */
export const GRADE_WEIGHTS: Record<number, number> = {
  10: 150, // 1,5 %
  9: 600, // 6 %
  8: 1500, // 15 %
  7: 3000, // 30 %
  6: 2200, // 22 %
  5: 1400, // 14 %
  4: 600, // 6 %
  3: 300, // 3 %   } ≤ 3 : 5,5 % au total
  2: 150, // 1,5 % }
  1: 100, // 1 %   }
};
export const GRADES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

/** Effet de la note sur ATQ et DEF (en %). */
export const gradeStatPct = (grade: number): number => (grade >= 10 ? 4 : grade === 9 ? 2 : grade === 8 ? 1 : grade >= 5 ? 0 : -1);

/** Prix d'une expertise selon la rareté (GC). */
export const GRADE_PRICE: Record<Rarity, number> = { C: 5, R: 10, SR: 20, SSR: 35, UR: 60, LR: 100 };
export const GRADE_HOURS = 24;
/** Nombre de cartes que Basile peut avoir sur son établi en même temps. */
export const GRADE_SLOTS = 3;

export const GRADE_LABEL: Record<number, string> = {
  10: "Parfaite", 9: "Exceptionnelle", 8: "Excellente", 7: "Très belle", 6: "Belle",
  5: "Correcte", 4: "Moyenne", 3: "Usée", 2: "Très usée", 1: "Abîmée",
};

/** Couleur du tampon selon la note. */
export const gradeColor = (grade: number): string =>
  grade >= 10 ? "#ffd23b" : grade === 9 ? "#c8f31d" : grade === 8 ? "#2dff8a" : grade >= 5 ? "#9fb6ff" : "#ff8a6b";

// ───────────── Combats (règles validées le 14 oct. 2026) ─────────────

export const DUEL = {
  /** Duels offerts chaque jour. */
  daily: 3,
  /** Duels en plus le jour où la séance est validée dans l'app. */
  perSession: 2,
  winGc: 5,
  /** Points de saison : victoire / égalité / défaite. */
  winPts: 3,
  drawPts: 1,
  lossPts: 1,
  /** Écart maximum compté sur une manche. */
  cap: 350,
  /** Hasard sur l'ATQ de chaque frappe : ± 10 %. */
  noisePct: 10,
  /** Bonus de la carte en avantage dans le triangle des groupes. */
  trianglePct: 20,
  /** Synergies : nombre de cartes du même groupe → bonus % (ATQ et DEF de ces cartes). */
  synergyPct: { 2: 3, 3: 8, 4: 14, 5: 20 } as Record<number, number>,
  /** Cinq groupes différents : bonus pour tout le deck. */
  allGroupsPct: 6,
  /** Adversaire de puissance proche : ± 25 %. */
  matchBand: 0.25,
} as const;

/** Triangle des groupes : chaque groupe bat le suivant. Les bras sont neutres. */
export const BEATS: Partial<Record<MuscleGroup, MuscleGroup>> = {
  pecs: "epaules", epaules: "dos", dos: "pecs",
  jambes: "abdos", abdos: "cardio", cardio: "jambes",
};

{
  const sum = Object.values(GRADE_WEIGHTS).reduce((a, b) => a + b, 0);
  if (sum !== 10000) throw new Error(`Table des notes : somme ${sum} ≠ 10000`);
}
