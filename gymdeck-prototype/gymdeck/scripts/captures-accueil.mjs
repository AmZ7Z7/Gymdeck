// Fabrique les 4 aperçus de l'accueil (public/assets/landing) à partir de la démo.
// Usage : node scripts/captures-accueil.mjs [adresse du site, par défaut http://localhost:3000]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = "public/assets/landing";
mkdirSync(out, { recursive: true });
// sans le bandeau « Mode démo » sur les images
const HIDE = ".demobar { display: none !important; } .app.demo { --demo-h: 0px !important; } nextjs-portal { display: none !important; }";

const browser = await chromium.launch({ channel: "msedge" });
const ctx = await browser.newContext({ viewport: { width: 375, height: 650 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const shot = async (name) => { await page.addStyleTag({ content: HIDE }); await page.waitForTimeout(400); await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 78 }); };
const go = async (hash) => { await page.goto(`${base}/demo${hash}`, { waitUntil: "networkidle" }); await page.waitForTimeout(1500); };

// collection
await go("#collection");
await page.evaluate(() => document.querySelector(".screen")?.scrollTo(0, 560));
await shot("collection");
// carte holographique : fiche détaillée d'une UR ou LR
const top = await page.$(".ccell:has(.fxl-LR), .ccell:has(.fxl-UR)");
if (top) { await top.scrollIntoViewIfNeeded(); await top.click({ force: true }); await page.waitForTimeout(1500); await shot("holo"); }
// Marché
await go("#market");
await shot("marche");
// ouverture du booster à légendaire garantie
await go("");
await page.click(".hero .pack", { force: true });
await page.waitForTimeout(1200);
await page.click(".stage .pack", { force: true });
await page.waitForTimeout(3300);
for (let k = 0; k < 6; k++) {
  const txt = (await page.textContent(".rarityline").catch(() => "")) ?? "";
  if (/LÉGENDAIRE/.test(txt)) break;
  await page.click(".deal", { force: true });
  await page.waitForTimeout(1600);
}
await page.waitForTimeout(4200);
await shot("ouverture");
await browser.close();
console.log(`Aperçus enregistrés dans ${out}`);
