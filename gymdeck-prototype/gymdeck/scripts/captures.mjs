// Captures d'écran de l'accueil (téléphone 375 px et ordinateur), pour comparer avant / après.
// Usage : node scripts/captures.mjs <dossier> [adresse]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "captures";
const url = process.argv[3] ?? "http://localhost:3000/";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: "msedge" });
const shots = [
  { name: "telephone", viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: "ordinateur", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
];
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: s.viewport, isMobile: s.isMobile, hasTouch: s.hasTouch, deviceScaleFactor: s.deviceScaleFactor });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500); // laisse les animations d'arrivée se terminer
  await page.screenshot({ path: `${out}/${s.name}-haut.png` });
  // l'accueil défile dans son propre cadre : on descend d'un écran pour voir la suite
  const more = await page.evaluate(() => {
    const el = document.querySelector(".onboard");
    if (!el || el.scrollHeight <= el.clientHeight + 4) return false;
    el.scrollTo(0, el.scrollHeight);
    return true;
  });
  if (more) { await page.waitForTimeout(400); await page.screenshot({ path: `${out}/${s.name}-bas.png` }); }
  await ctx.close();
}
await browser.close();
console.log(`Captures enregistrées dans ${out}`);
