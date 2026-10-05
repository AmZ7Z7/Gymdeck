/** Générateur aléatoire injectable : sécurisé en production, déterministe en test. */
export interface Rng {
  /** Entier uniforme dans [min, max], bornes incluses. */
  int(min: number, max: number): number;
}

/** Tirage non biaisé (rejet) basé sur crypto.getRandomValues. */
export const secureRng: Rng = {
  int(min, max) {
    const range = max - min + 1;
    const limit = Math.floor(0x100000000 / range) * range;
    const buf = new Uint32Array(1);
    let x: number;
    do {
      globalThis.crypto.getRandomValues(buf);
      x = buf[0] as number;
    } while (x >= limit);
    return min + (x % range);
  },
};

/** Mulberry32 : graine fixe → simulations reproductibles. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { int: (min, max) => min + Math.floor(next() * (max - min + 1)) };
}
