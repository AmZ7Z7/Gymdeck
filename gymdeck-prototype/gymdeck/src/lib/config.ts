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
  C: 4200, // 42 %
  R: 3000, // 30 %
  SR: 1700, // 17 %
  SSR: 970, // 9,7 %
  UR: 100, // 1 %
  LR: 30, // 0,3 %
};

/** Deuxième booster de bienvenue. */
export const WELCOME2_WEIGHTS: Record<Rarity, number> = {
  C: 2840, // 28,4 %
  R: 3000, // 30 %
  SR: 2550, // 25,5 %
  SSR: 1455, // 14,55 %
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

export interface Exercise {
  slug: string;
  name: string;
  image: string;
}

/** Catalogue de lancement (10 exercices). */
export const EXERCISES: Exercise[] = [
  { slug: "developpe-couche", name: "Développé couché haltères", image: "/assets/exercises/developpe-couche.webp" },
  { slug: "developpe-incline", name: "Développé incliné haltères", image: "/assets/exercises/developpe-incline.webp" },
  { slug: "developpe-militaire", name: "Développé militaire", image: "/assets/exercises/developpe-militaire.webp" },
  { slug: "tirage-vertical", name: "Tirage vertical", image: "/assets/exercises/tirage-vertical.webp" },
  { slug: "rowing-barre", name: "Rowing barre", image: "/assets/exercises/rowing-barre.webp" },
  { slug: "souleve-de-terre", name: "Soulevé de terre", image: "/assets/exercises/souleve-de-terre.webp" },
  { slug: "hip-thrust", name: "Hip thrust", image: "/assets/exercises/hip-thrust.webp" },
  { slug: "curl-biceps", name: "Curl biceps haltères", image: "/assets/exercises/curl-biceps.webp" },
  { slug: "elevations-laterales", name: "Élévations latérales", image: "/assets/exercises/elevations-laterales.webp" },
  { slug: "squat", name: "Squat barre", image: "/assets/exercises/squat.webp" },
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
