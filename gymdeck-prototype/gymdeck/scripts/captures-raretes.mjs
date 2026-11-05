// Capture la page /test-cartes à plusieurs moments de l'animation, pour juger les effets de rareté.
// Usage : node scripts/captures-raretes.mjs <dossier> [adresse, par défaut http://localhost:3000]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "captures";
const base = process.argv[3] ?? "http://localhost:3000";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: "msedge" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 520 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(`${base}/test-cartes`, { waitUntil: "networkidle" });
await page.addStyleTag({ content: ".fxgrid { grid-template-columns: repeat(6, 1fr) !important; gap: 22px !important; padding: 26px 22px 0; } nextjs-portal { display: none !important; }" });
await page.waitForTimeout(1500);
console.log("débordement horizontal :", await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
for (let i = 1; i <= 3; i++) {
  await page.locator(".fxgrid").first().screenshot({ path: `${out}/raretes-${i}.png` });
  await page.waitForTimeout(1100);
}
await browser.close();
