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

/** Booster de séance : un peu meilleur que les autres pour récompenser le vrai entraînement (SR et SSR en hausse, UR / LR inchangées). */
export const SESSION_WEIGHTS: Record<Rarity, number> = {
  C: 5870, // 58,7 %
  R: 2400, // 24 %
  SR: 1100, // 11 %
  SSR: 500, // 5 %
  UR: 100, // 1 %
  LR: 30, // 0,3 %
};

export const DISCARD_GC: Record<Rarity, number> = { C: 1, R: 2, SR: 4, SSR: 6, UR: 12, LR: 25 };

export const CARDS_PER_BOOSTER = 5;
export const PITY_THRESHOLD = 12; // le 12e booster garantit une UR après 11 sans UR/LR
/** Filet de sécurité LR : le 150e booster d'affilée sans LR en contient forcément une. */
export const LR_PITY_THRESHOLD = 150;
/** Booster bonus de série : offert tous les 7 jours de série (avec les taux du booster de bienvenue amélioré). */
export const STREAK_BOOSTER_EVERY = 7;

/** Forge : éclats gagnés en défaussant une carte, et prix pour fabriquer la carte de son choix. */
export const SHARDS_DISCARD: Record<Rarity, number> = { C: 1, R: 3, SR: 10, SSR: 30, UR: 100, LR: 300 };
export const SHARDS_CRAFT: Record<Rarity, number> = { C: 10, R: 30, SR: 100, SSR: 300, UR: 1000, LR: 3000 };
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

export type BoosterKind = "welcome1" | "welcome2" | "session" | "login" | "shop" | "pass" | "streak";

export type MuscleGroup = "pecs" | "epaules" | "dos" | "bras" | "jambes" | "abdos" | "cardio";

/** Extensions (séries) : une par groupe musculaire. Les nouveaux exercices s'y ajoutent via le champ `group`. */
export const GROUPS: { id: MuscleGroup; name: string; short: string }[] = [
  { id: "pecs", name: "Pectoraux", short: "Pecs" },
  { id: "epaules", name: "Épaules", short: "Épaules" },
  { id: "dos", name: "Dos", short: "Dos" },
  { id: "bras", name: "Bras", short: "Bras" },
  { id: "jambes", name: "Jambes & fessiers", short: "Jambes" },
  { id: "abdos", name: "Abdos & gainage", short: "Abdos" },
  { id: "cardio", name: "Cardio", short: "Cardio" },
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
  /** Lien vers une vidéo du mouvement (vide : le bouton « Voir le mouvement » ouvre une recherche YouTube). */
  lienMouvement: string;
  fit?: ArtFit;
}

/** Catalogue (32 exercices illustrés). */
export const EXERCISES: Exercise[] = [
  { slug: "developpe-couche", name: "Développé couché haltères", image: "/assets/exercises/developpe-couche.webp", group: "pecs", lienMouvement: "" },
  { slug: "developpe-incline", name: "Développé incliné haltères", image: "/assets/exercises/developpe-incline.webp", group: "pecs", lienMouvement: "" },
  { slug: "developpe-militaire", name: "Développé militaire", image: "/assets/exercises/developpe-militaire.webp", group: "epaules", lienMouvement: "" },
  { slug: "tirage-vertical", name: "Tirage vertical", image: "/assets/exercises/tirage-vertical.webp", group: "dos", lienMouvement: "" },
  { slug: "rowing-barre", name: "Rowing barre", image: "/assets/exercises/rowing-barre.webp", group: "dos", lienMouvement: "" },
  { slug: "souleve-de-terre", name: "Soulevé de terre", image: "/assets/exercises/souleve-de-terre.webp", group: "jambes", lienMouvement: "" },
  { slug: "hip-thrust", name: "Hip thrust", image: "/assets/exercises/hip-thrust.webp", group: "jambes", lienMouvement: "" },
  { slug: "curl-biceps", name: "Curl biceps haltères", image: "/assets/exercises/curl-biceps.webp", group: "bras", lienMouvement: "" },
  { slug: "elevations-laterales", name: "Élévations latérales", image: "/assets/exercises/elevations-laterales.webp", group: "epaules", lienMouvement: "" },
  { slug: "squat", name: "Squat barre", image: "/assets/exercises/squat.webp", group: "jambes", lienMouvement: "" },
  { slug: "presse-a-cuisses", name: "Presse à cuisses", image: "/assets/exercises/presse-a-cuisses.webp", group: "jambes", fit: { y: -10 }, lienMouvement: "" },
  { slug: "crunch-poulie", name: "Crunch poulie", image: "/assets/exercises/crunch-poulie.webp", group: "abdos", lienMouvement: "" },
  { slug: "leg-curl-assis", name: "Leg curl assis", image: "/assets/exercises/leg-curl-assis.webp", group: "jambes", lienMouvement: "" },
  { slug: "extension-triceps-corde", name: "Extension triceps corde", image: "/assets/exercises/extension-triceps-corde.webp", group: "bras", lienMouvement: "" },
  { slug: "developpe-poitrine-machine", name: "Développé poitrine machine", image: "/assets/exercises/developpe-poitrine-machine.webp", group: "pecs", lienMouvement: "" },
  { slug: "rowing-poulie-basse", name: "Rowing poulie basse", image: "/assets/exercises/rowing-poulie-basse.webp", group: "dos", lienMouvement: "" },
  { slug: "leg-extension", name: "Leg extension", image: "/assets/exercises/leg-extension.webp", group: "jambes", lienMouvement: "" },
  { slug: "gainage", name: "Gainage", image: "/assets/exercises/gainage.webp", group: "abdos", fit: { s: 0.93, y: -32 }, lienMouvement: "" },
  { slug: "tractions-assistees", name: "Tractions assistées", image: "/assets/exercises/tractions-assistees.webp", group: "dos", lienMouvement: "" },
  { slug: "curl-marteau", name: "Curl marteau", image: "/assets/exercises/curl-marteau.webp", group: "bras", lienMouvement: "" },
  { slug: "extension-triceps-overhead", name: "Extension triceps au-dessus de la tête", image: "/assets/exercises/extension-triceps-overhead.webp", group: "bras", lienMouvement: "" },
  { slug: "velo-de-salle", name: "Vélo de salle", image: "/assets/exercises/velo-de-salle.webp", group: "cardio", lienMouvement: "" },
  { slug: "developpe-couche-barre", name: "Développé couché barre", image: "/assets/exercises/developpe-couche-barre.webp", group: "pecs", lienMouvement: "" },
  { slug: "developpe-militaire-halteres", name: "Développé militaire haltères", image: "/assets/exercises/developpe-militaire-halteres.webp", group: "epaules", lienMouvement: "" },
  { slug: "ecarte-poulie", name: "Écarté à la poulie", image: "/assets/exercises/ecarte-poulie.webp", group: "pecs", lienMouvement: "" },
  { slug: "rameur", name: "Rameur", image: "/assets/exercises/rameur.webp", group: "cardio", lienMouvement: "" },
  { slug: "fentes-halteres", name: "Fentes haltères", image: "/assets/exercises/fentes-halteres.webp", group: "jambes", lienMouvement: "" },
  { slug: "mollets-debout", name: "Mollets debout machine", image: "/assets/exercises/mollets-debout.webp", group: "jambes", lienMouvement: "" },
  { slug: "extension-lombaire", name: "Extension lombaire", image: "/assets/exercises/extension-lombaire.webp", group: "dos", lienMouvement: "" },
  { slug: "hack-squat", name: "Hack squat", image: "/assets/exercises/hack-squat.webp", group: "jambes", lienMouvement: "" },
  { slug: "face-pull", name: "Face pull", image: "/assets/exercises/face-pull.webp", group: "epaules", lienMouvement: "" },
  { slug: "course-tapis", name: "Course sur tapis", image: "/assets/exercises/course-tapis.webp", group: "cardio", lienMouvement: "" },
];

// Garde-fou : une table de probabilités incorrecte doit empêcher le démarrage.
for (const [name, table] of [["NORMAL", NORMAL_WEIGHTS], ["WELCOME2", WELCOME2_WEIGHTS], ["SESSION", SESSION_WEIGHTS]] as const) {
  const sum = Object.values(table).reduce((a, b) => a + b, 0);
  if (sum !== 10000) throw new Error(`Table ${name} : somme ${sum} ≠ 10000`);
}

/**
 * Position des bandeaux de chaque cadre, mesurée sur les images (nameTop / statsTop / statsBottom : fraction de la hauteur).
 * gradeX / gradeTop : centre horizontal et haut (fractions de la largeur et de la hauteur) du patch de note, posé sur les traits
 * décoratifs de l'en-tête.
 */
export const FRAME_LAYOUT: Record<Rarity, { nameTop: number; statsTop: number; statsBottom: number; gradeX: number; gradeTop: number }> = {
  C: { nameTop: 0.731, statsTop: 0.827, statsBottom: 0.949, gradeX: 0.589, gradeTop: 0.035 },
  R: { nameTop: 0.724, statsTop: 0.817, statsBottom: 0.956, gradeX: 0.554, gradeTop: 0.036 },
  SR: { nameTop: 0.743, statsTop: 0.834, statsBottom: 0.961, gradeX: 0.507, gradeTop: 0.036 },
  SSR: { nameTop: 0.686, statsTop: 0.788, statsBottom: 0.953, gradeX: 0.554, gradeTop: 0.038 },
  UR: { nameTop: 0.735, statsTop: 0.812, statsBottom: 0.931, gradeX: 0.468, gradeTop: 0.037 },
  LR: { nameTop: 0.678, statsTop: 0.771, statsBottom: 0.937, gradeX: 0.49, gradeTop: 0.048 },
};

type Box = { x: number; y: number; w: number; h: number };
/**
 * Cadres v2 (kit « GymDeck_Integration_Complete », 24 oct. 2026) : zones de la carte en fraction du canevas 1024 × 1536 (ratio 2:3),
 * reprises telles quelles de placement.json. `clip` = fenêtre de l'illustration (le personnage ne déborde jamais).
 */
export const CARD_LAYOUT: Record<Rarity, { clip: string; art: Box; rarity: Box; title: Box; stats: Box; ability: Box; right: Box }> = {
  C: {
    clip: "polygon(9.7969% 17.68%, 17.5469% 10.404%, 59.6875% 10.404%, 59.6875% 19.9538%, 90.6875% 19.9538%, 90.6875% 71.3408%, 9.7969% 71.3408%)",
    art: { x: 0.1513, y: 0.1813, w: 0.6975, h: 0.5184 }, rarity: { x: 0.69, y: 0.066, w: 0.245, h: 0.088 }, title: { x: 0.1706, y: 0.728, w: 0.6588, h: 0.0664 },
    stats: { x: 0.1319, y: 0.8198, w: 0.2228, h: 0.0955 }, ability: { x: 0.4419, y: 0.8271, w: 0.1162, h: 0.0728 }, right: { x: 0.6356, y: 0.8198, w: 0.2325, h: 0.0955 },
  },
  R: {
    clip: "polygon(9.7969% 16.8112%, 17.5469% 9.332%, 59.6875% 9.332%, 59.6875% 19.1484%, 90.6875% 19.1484%, 90.6875% 71.9701%, 9.7969% 71.9701%)",
    art: { x: 0.1513, y: 0.1728, w: 0.6975, h: 0.5329 }, rarity: { x: 0.68, y: 0.064, w: 0.235, h: 0.088 }, title: { x: 0.1706, y: 0.7347, w: 0.6588, h: 0.0682 },
    stats: { x: 0.1319, y: 0.8291, w: 0.2228, h: 0.0982 }, ability: { x: 0.4419, y: 0.8366, w: 0.1162, h: 0.0748 }, right: { x: 0.6356, y: 0.8291, w: 0.2325, h: 0.0982 },
  },
  SR: {
    clip: "polygon(9.7969% 17.8187%, 17.5469% 10.5739%, 59.6875% 10.5739%, 59.6875% 20.0827%, 90.6875% 20.0827%, 90.6875% 71.249%, 9.7969% 71.249%)",
    art: { x: 0.1513, y: 0.1827, w: 0.6975, h: 0.5162 }, rarity: { x: 0.68, y: 0.08, w: 0.24, h: 0.093 }, title: { x: 0.1706, y: 0.727, w: 0.6588, h: 0.0661 },
    stats: { x: 0.1319, y: 0.8184, w: 0.2228, h: 0.0951 }, ability: { x: 0.4419, y: 0.8257, w: 0.1162, h: 0.0724 }, right: { x: 0.6356, y: 0.8184, w: 0.2325, h: 0.0951 },
  },
  SSR: {
    clip: "polygon(9.7969% 17.4489%, 17.5469% 10.1208%, 59.6875% 10.1208%, 59.6875% 19.7389%, 90.6875% 19.7389%, 90.6875% 70.4862%, 9.7969% 70.4862%)",
    art: { x: 0.1513, y: 0.1791, w: 0.6975, h: 0.5121 }, rarity: { x: 0.69, y: 0.082, w: 0.23, h: 0.093 }, title: { x: 0.1706, y: 0.7186, w: 0.6588, h: 0.0595 },
    stats: { x: 0.1319, y: 0.8093, w: 0.2228, h: 0.1035 }, ability: { x: 0.4419, y: 0.8166, w: 0.1162, h: 0.0733 }, right: { x: 0.6356, y: 0.8093, w: 0.2325, h: 0.1035 },
  },
  UR: {
    clip: "polygon(9.7969% 17.6432%, 17.5469% 10.3516%, 59.6875% 10.3516%, 59.6875% 19.9219%, 90.6875% 19.9219%, 90.6875% 70.4167%, 9.7969% 70.4167%)",
    art: { x: 0.1513, y: 0.181, w: 0.6975, h: 0.5095 }, rarity: { x: 0.675, y: 0.082, w: 0.245, h: 0.09 }, title: { x: 0.1706, y: 0.7178, w: 0.6588, h: 0.0592 },
    stats: { x: 0.1319, y: 0.8081, w: 0.2228, h: 0.103 }, ability: { x: 0.4419, y: 0.8154, w: 0.1162, h: 0.0729 }, right: { x: 0.6356, y: 0.8081, w: 0.2325, h: 0.103 },
  },
  LR: {
    clip: "polygon(9.7969% 15.6094%, 17.5469% 7.8594%, 59.6875% 7.8594%, 59.6875% 18.0312%, 90.6875% 18.0312%, 90.6875% 71.2156%, 9.7969% 71.2156%)",
    art: { x: 0.1513, y: 0.1609, w: 0.6975, h: 0.5367 }, rarity: { x: 0.7, y: 0.068, w: 0.2, h: 0.078 }, title: { x: 0.1706, y: 0.7315, w: 0.6588, h: 0.0533 },
    stats: { x: 0.1319, y: 0.8119, w: 0.2228, h: 0.0891 }, ability: { x: 0.4419, y: 0.8197, w: 0.1162, h: 0.0736 }, right: { x: 0.6356, y: 0.8119, w: 0.2325, h: 0.0891 },
  },
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

/** Vidéo du mouvement : le lien de l'exercice, sinon une recherche YouTube « [nom] exécution ». */
export const movementUrl = (e: Exercise) =>
  e.lienMouvement || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.name} exécution`)}`;

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

/** Effet de la note sur ATQ et DEF (en %), barème v12 : chaque point au-dessus de 5 compte. */
export const GRADE_STAT_PCT: Record<number, number> = { 10: 6, 9: 4, 8: 3, 7: 2, 6: 1, 5: 0, 4: -1, 3: -1, 2: -2, 1: -2 };
export const gradeStatPct = (grade: number): number => GRADE_STAT_PCT[grade] ?? 0;
/** Ancien barème (jusqu'à la v11) : sert seulement à recalculer les cartes déjà notées. */
export const gradeStatPctV1 = (grade: number): number => (grade >= 10 ? 4 : grade === 9 ? 2 : grade === 8 ? 1 : grade >= 5 ? 0 : -1);

/**
 * Faire monter la note : Basile réexamine une carte déjà notée (même prix, 24 h).
 * Chance (sur 10 000) de gagner +1 point, selon la note visée. En cas d'échec, la note ne baisse jamais.
 */
export const UPGRADE_CHANCE: Record<number, number> = { 2: 7000, 3: 7000, 4: 7000, 5: 6500, 6: 6000, 7: 5500, 8: 4000, 9: 2500, 10: 1200 };

/** Prix d'une expertise selon la rareté (GC). */
export const GRADE_PRICE: Record<Rarity, number> = { C: 5, R: 10, SR: 20, SSR: 35, UR: 60, LR: 100 };
export const GRADE_HOURS = 24;
/** Nombre de cartes que Basile peut avoir sur son établi en même temps. */
export const GRADE_SLOTS = 3;

export const GRADE_LABEL: Record<number, string> = {
  10: "Parfaite", 9: "Exceptionnelle", 8: "Excellente", 7: "Très belle", 6: "Belle",
  5: "Correcte", 4: "Moyenne", 3: "Usée", 2: "Très usée", 1: "Abîmée",
};

/** Médaille de la note : bronze (1-4), argent (5-7), or (8), or étincelant (9), platine noir (10). */
export type GradeMedal = "bronze" | "silver" | "gold" | "gold2" | "platinum";
export const gradeMedal = (grade: number): GradeMedal =>
  grade >= 10 ? "platinum" : grade === 9 ? "gold2" : grade === 8 ? "gold" : grade >= 5 ? "silver" : "bronze";
export const medalSrc = (grade: number) => `/assets/medals/${gradeMedal(grade)}.webp`;

/** Couleur du texte de la note (accordée à la médaille). */
export const gradeColor = (grade: number): string =>
  ({ bronze: "#e8a06a", silver: "#d3dae8", gold: "#ffcf3f", gold2: "#ffe07a", platinum: "#f1d28a" })[gradeMedal(grade)];

// ───────────── Combats (règles validées le 15 oct. 2026) ─────────────

export type Posture = "force" | "garde" | "technique";
export const POSTURES: Posture[] = ["force", "technique", "garde"];

export const DUEL = {
  /** Duels offerts chaque jour. */
  daily: 5,
  /** Duels en plus le jour où la séance est validée dans l'app. */
  perSession: 2,
  /** GC par victoire. */
  winGc: 10,
  /** GC par attaque repoussée par ton deck en défense (3 attaques simulées par jour au maximum). */
  defenseGc: 2,
  defenseMaxPerDay: 3,
  /** Points de classement : victoire / égalité / défaite. */
  winPts: 3,
  drawPts: 1,
  lossPts: 1,
  /** Points du passe de saison : victoire / défaite (ou égalité). */
  passWin: 15,
  passLoss: 5,
  rounds: 5,
  /** Dégâts = max(ATQ − 50 % de la DEF adverse, 15 % de l'ATQ), plafonnés à 35 % des PV max adverses. */
  defFactor: 0.5,
  minHitPct: 15,
  hitCapPct: 35,
  /** Hasard sur l'ATQ de chaque frappe : ± 5 %. */
  noisePct: 5,
  /** Bonus d'attaque de la carte en avantage dans le triangle des groupes. */
  trianglePct: 20,
  /** Postures : Force (ATQ ×1,3, DEF ×0,7), Garde (ATQ ×0,6, DEF ×1,5), Technique (×1,4 contre Force, ×0,7 contre Garde). */
  posture: {
    force: { atq: 1.3, def: 0.7 },
    garde: { atq: 0.6, def: 1.5 },
    technique: { atq: 1, def: 1 },
  } as Record<Posture, { atq: number; def: number }>,
  techVsForce: 1.4,
  techVsGarde: 0.7,
  /** Jauge de capacité : +22 % par manche, + 90 % des dégâts reçus (en part des PV max) ; ×1,3 avec une LR dans le deck. */
  gaugeBase: 0.22,
  gaugeDamage: 0.9,
  gaugeLr: 1.3,
  /** Second souffle (cartes C, R, SR) : dégâts ×1,25. */
  secondWind: 1.25,
  /** Synergies : nombre de cartes du même groupe → bonus % (ATQ et DEF de ces cartes). */
  synergyPct: { 2: 3, 3: 8, 4: 14, 5: 20 } as Record<number, number>,
  /** Cinq groupes différents : bonus pour tout le deck. */
  allGroupsPct: 6,
  /** Adversaire choisi pour une chance de victoire simulée proche de 50 % (45 à 58 %) (combats simulés). */
  matchLo: 0.45,
  matchHi: 0.58,
  matchSims: 50,
  matchTries: 12,
  /** Part de choix au hasard de l'IA adverse. */
  aiRandomPct: 25,
} as const;

export type CapKind = "power" | "counter" | "feint" | "combo" | "wall" | "heal" | "replay" | "second";

export interface CapacityDef { kind: CapKind; name: string; color: string; values: { SSR: number; UR: number; LR: number } }

/** Capacités des cartes SSR, UR et LR (une par groupe). Les valeurs affichées sont les valeurs réelles. */
export const CAPACITIES: Record<MuscleGroup, CapacityDef> = {
  pecs: { kind: "power", name: "Coup puissant", color: "#ff4d5e", values: { SSR: 1.4, UR: 1.7, LR: 2 } },
  dos: { kind: "counter", name: "Contre-attaque", color: "#a66bff", values: { SSR: 0.3, UR: 0.45, LR: 0.6 } },
  epaules: { kind: "feint", name: "Feinte", color: "#ffd23f", values: { SSR: 0, UR: 0.15, LR: 0.25 } },
  bras: { kind: "combo", name: "Enchaînement", color: "#ff8a2a", values: { SSR: 0.65, UR: 0.75, LR: 0.85 } },
  jambes: { kind: "wall", name: "Mur", color: "#3c9dff", values: { SSR: 0.4, UR: 0.6, LR: 0.75 } },
  abdos: { kind: "heal", name: "Récupération", color: "#2ee87a", values: { SSR: 0.1, UR: 0.15, LR: 0.2 } },
  cardio: { kind: "replay", name: "Endurance", color: "#27e1ff", values: { SSR: 0.7, UR: 0.85, LR: 1 } },
};
/** Capacité commune des cartes C, R et SR. */
export const SECOND_WIND = { kind: "second" as CapKind, name: "Second souffle", color: "#c9d1de" };

/** Icône de chaque capacité (public/assets/capacities, version optimisée ; originaux dans assets-src/capacites). */
export const CAP_ICON: Record<CapKind, string> = {
  power: "coup-puissant", counter: "contre-attaque", feint: "feinte", combo: "enchainement",
  wall: "mur", heal: "recuperation", replay: "endurance", second: "second-souffle",
};
export const capIconSrc = (k: CapKind) => `/assets/capacities/${CAP_ICON[k]}.png`;

/** Triangle des groupes : chaque groupe bat le suivant. Les bras sont neutres. */
export const BEATS: Partial<Record<MuscleGroup, MuscleGroup>> = {
  pecs: "epaules", epaules: "dos", dos: "pecs",
  jambes: "abdos", abdos: "cardio", cardio: "jambes",
};

{
  const sum = Object.values(GRADE_WEIGHTS).reduce((a, b) => a + b, 0);
  if (sum !== 10000) throw new Error(`Table des notes : somme ${sum} ≠ 10000`);
}

// ───────────── Passe de saison (mensuel, validé le 15 oct. 2026) ─────────────

export const PASS = {
  tiers: 30,
  /** Points par palier. */
  perTier: 130,
  /** Points gagnés. */
  session: 100,
  dailyMission: 20,
  duelWin: 15,
  duelLoss: 5,
  weeklyChallenge: 150,
} as const;

export interface PassReward { tier: number; gc: number; boosters: number }
/** Récompenses : des GC à chaque palier, un booster tous les 5 paliers, 2 boosters au palier 30. */
export const PASS_REWARDS: PassReward[] = Array.from({ length: PASS.tiers }, (_, i) => {
  const tier = i + 1;
  if (tier === 30) return { tier, gc: 0, boosters: 2 };
  if (tier % 5 === 0) return { tier, gc: 0, boosters: 1 };
  return { tier, gc: tier < 10 ? 10 : tier < 20 ? 15 : 20, boosters: 0 };
});

/** Défi communautaire de la semaine : un objectif pour tous les joueurs, une récompense pour chaque participant. */
export const COMMUNITY_GC = 20;
