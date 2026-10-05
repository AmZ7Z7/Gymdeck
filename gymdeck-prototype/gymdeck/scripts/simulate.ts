/**
 * Simulation des tirages : npx tsx scripts/simulate.ts [nbBoosters]
 * Vérifie que les taux observés correspondent à la fiche, et mesure l'effet des garanties.
 */
import { NORMAL_WEIGHTS, RARITIES, STAT_RANGE, WELCOME2_WEIGHTS, type Rarity } from "../src/lib/config";
import { drawRarity, isTop, makeCard, openBooster } from "../src/lib/engine";
import { seededRng } from "../src/lib/rng";

const N = Number(process.argv[2] ?? 1_000_000);
const rng = seededRng(20261005);
const pct = (x: number, d = 3) => (x * 100).toFixed(d).padStart(7) + " %";
const zero = () => Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;

function chi2(obs: Record<Rarity, number>, w: Record<Rarity, number>, total: number) {
  return RARITIES.reduce((s, r) => {
    const e = (total * w[r]) / 10000;
    return s + (obs[r] - e) ** 2 / e;
  }, 0);
}

// ── 1. Tables brutes (avant garanties) ──
for (const [name, w] of [["normale", NORMAL_WEIGHTS], ["2e bienvenue", WELCOME2_WEIGHTS]] as const) {
  const obs = zero();
  const total = N * 5;
  for (let i = 0; i < total; i++) obs[drawRarity(rng, w)]++;
  console.log(`\n=== 1. Table ${name} — ${total.toLocaleString("fr-FR")} cartes, sans garanties ===`);
  console.log("rareté   attendu    observé");
  for (const r of RARITIES) console.log(`${r.padEnd(5)} ${pct(w[r] / 10000)} ${pct(obs[r] / total)}`);
  console.log(`χ² = ${chi2(obs, w, total).toFixed(2)} (seuil 5 % à 5 ddl : 11,07)`);
}

// ── 2. Boosters complets, avec R+ et pity ──
{
  const obs = zero();
  let pityHits = 0, rPlusHits = 0, withTop = 0, tops = 0, boostersSinceTop = 0, maxGap = 0;
  const gaps: number[] = [];
  let pity = 0;
  for (let i = 0; i < N; i++) {
    const r = openBooster(rng, "shop", pity);
    pity = r.pityAfter;
    if (r.pityTriggered) pityHits++;
    if (r.rPlusTriggered) rPlusHits++;
    let top = false;
    for (const c of r.cards) { obs[c.rarity]++; if (isTop(c.rarity)) { top = true; tops++; } }
    boostersSinceTop++;
    if (top) { withTop++; gaps.push(boostersSinceTop); maxGap = Math.max(maxGap, boostersSinceTop); boostersSinceTop = 0; }
  }
  const total = N * 5;
  console.log(`\n=== 2. ${N.toLocaleString("fr-FR")} boosters normaux AVEC garanties (R+ et pity à 12) ===`);
  console.log("rareté   table      observé    écart");
  for (const r of RARITIES) {
    const exp = NORMAL_WEIGHTS[r] / 10000, o = obs[r] / total;
    console.log(`${r.padEnd(5)} ${pct(exp)} ${pct(o)} ${((o - exp) * 100 >= 0 ? "+" : "") + ((o - exp) * 100).toFixed(3)} pt`);
  }
  const q = Math.pow(1 - (NORMAL_WEIGHTS.UR + NORMAL_WEIGHTS.LR) / 10000, 5); // P(aucune UR/LR dans un booster)
  const meanNoPity = 1 / (1 - q);
  const meanPity = (1 - Math.pow(q, 12)) / (1 - q);
  const meanObs = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  console.log(`\nBoosters contenant ≥ 1 UR/LR : ${pct(withTop / N, 2)} (théorie sans pity : ${pct(1 - q, 2)})`);
  console.log(`Nb moyen de boosters entre deux UR/LR : ${meanObs.toFixed(2)} (théorie avec pity ${meanPity.toFixed(2)} ; sans pity ${meanNoPity.toFixed(2)})`);
  console.log(`Écart maximal observé : ${maxGap} boosters (plafond attendu : 12)`);
  console.log(`Pity déclenché sur ${pct(pityHits / N, 2)} des boosters, soit ${pct(pityHits / gaps.length, 1)} des séquences UR/LR`);
  console.log(`Garantie R+ déclenchée sur ${pct(rPlusHits / N, 2)} des boosters (théorie : ${pct(Math.pow(NORMAL_WEIGHTS.C / 10000, 5), 2)})`);
  console.log(`Théorie : P(11 boosters sans UR/LR) = ${pct(Math.pow(q, 11), 1)} ; P(12 sans) = ${pct(Math.pow(q, 12), 1)}`);
  const lrPerBooster = obs.LR / N;
  console.log(`LR : 1 tous les ${(1 / lrPerBooster).toFixed(0)} boosters ; UR : 1 tous les ${(1 / (obs.UR / N)).toFixed(1)} boosters`);
  console.log(`Total UR+LR : ${(tops / N).toFixed(4)} par booster`);
}

// ── 3. Stats et passifs ──
{
  console.log(`\n=== 3. Stats et passifs (200 000 cartes par rareté) ===`);
  const M = 200_000;
  for (const r of RARITIES) {
    const { min, max } = STAT_RANGE[r];
    let s = 0, lo = Infinity, hi = -Infinity, corrNum = 0, sa = 0, sd = 0, saa = 0, sdd = 0;
    const types: Record<string, number> = { ATQ: 0, DEF: 0, BOTH: 0 };
    let pSum = 0, pMin = Infinity, pMax = -Infinity, pN = 0;
    for (let i = 0; i < M; i++) {
      const c = makeCard(rng, r);
      s += c.atq; lo = Math.min(lo, c.atq, c.def); hi = Math.max(hi, c.atq, c.def);
      sa += c.atq; sd += c.def; saa += c.atq ** 2; sdd += c.def ** 2; corrNum += c.atq * c.def;
      if (c.passive) {
        types[c.passive.type]!++;
        for (const v of c.passive.type === "BOTH" ? [c.passive.atqTenths, c.passive.defTenths] : [c.passive.atqTenths + c.passive.defTenths]) {
          pSum += v; pMin = Math.min(pMin, v); pMax = Math.max(pMax, v); pN++;
        }
      }
    }
    const cov = corrNum / M - (sa / M) * (sd / M);
    const corr = cov / Math.sqrt((saa / M - (sa / M) ** 2) * (sdd / M - (sd / M) ** 2));
    let line = `${r.padEnd(4)} ATQ/DEF min ${lo} max ${hi} (fourchette ${min}–${max}) · moyenne ATQ ${(s / M).toFixed(1)} (milieu ${(min + max) / 2}) · corrélation ATQ/DEF ${corr.toFixed(4)}`;
    if (pN) line += `\n     passifs : ATQ ${pct(types.ATQ! / M, 1)} · DEF ${pct(types.DEF! / M, 1)} · ATQ+DEF ${pct(types.BOTH! / M, 1)} · valeur ${(pMin / 10).toFixed(1)}–${(pMax / 10).toFixed(1)} % (moy. ${(pSum / pN / 10).toFixed(2)} %)`;
    console.log(line);
  }
}
