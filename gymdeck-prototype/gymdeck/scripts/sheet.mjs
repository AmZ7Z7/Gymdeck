// Planche-contact : toutes les cartes (21 exercices) pour une rareté donnée, à largeur mobile ou PC.
import { chromium } from "playwright";
const OUT = process.argv[2]; const RAR = (process.argv[3] || "C,UR").split(",");
const W = Number(process.argv[4] || 390);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: W, height: Number(process.argv[5] || 844) }, deviceScaleFactor: Number(process.env.DSF || 1), isMobile: W < 600, hasTouch: W < 600 });
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:3100/"); await page.waitForSelector(".onboard");
await page.fill("#pseudo", "Adrien"); await page.fill("#email", "adrien@test.fr"); await page.fill("#pw", "motdepasse1");
await page.click("button[type=submit]"); await page.waitForTimeout(1200);
const slugs = await page.evaluate(async () => { return null; });
await page.evaluate((RAR) => {
  const SL = ["developpe-couche","developpe-incline","developpe-militaire","tirage-vertical","rowing-barre","souleve-de-terre","hip-thrust","curl-biceps","elevations-laterales","squat","presse-a-cuisses","crunch-poulie","leg-curl-assis","extension-triceps-corde","developpe-poitrine-machine","rowing-poulie-basse","leg-extension","gainage","tractions-assistees","curl-marteau","extension-triceps-overhead"];
  const st = { C: [150,140,null], R: [280,260,null], SR: [450,430,null], SSR: [700,650,null], UR: [1000,950,{type:"BOTH",atqTenths:15,defTenths:12}], LR: [1500,1450,{type:"ATQ",atqTenths:60,defTenths:0}] };
  let i = 1; const cards = [];
  for (const r of RAR) for (const sl of SL) { const [a,d,p] = st[r]; cards.push({ id: "t"+i, obtainedSeq: i, exerciseSlug: sl, rarity: r, atq: a, def: d, passive: p }); i++; }
  const s = JSON.parse(localStorage.getItem("gymdeck:proto:v1"));
  s.player.cards = cards; s.player.boosters = []; s.player.gc = 300; s.player.seq = 400; s.player.deck = []; s.opening = null;
  const e = s.player.extra; if (e) e.tutorialDone = true;
  localStorage.setItem("gymdeck:proto:v1", JSON.stringify(s));
}, RAR);
await page.reload(); await page.waitForSelector(".hero"); await page.waitForTimeout(600);
await page.click(".tab:has-text('Collection')"); await page.waitForTimeout(400);
await page.click(".seg button:has-text('Toutes')"); await page.waitForTimeout(800);
// plein écran de la grille : captures par bandes
const h = await page.evaluate(() => { const sc = document.querySelector(".scroll, main") ; return sc ? sc.scrollHeight : document.body.scrollHeight; });
await page.screenshot({ path: `${OUT}/sheet-full.png`, fullPage: true });
console.log("errors", errors, "h", h);
await browser.close();
