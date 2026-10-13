import { chromium } from "playwright";
const OUT = process.argv[2]; const W = Number(process.argv[3] || 390); const H = Number(process.argv[4] || 844);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: W < 600 ? 2 : 1, isMobile: W < 600, hasTouch: W < 600 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
const shot = (n) => page.screenshot({ path: `${OUT}/${W}-${n}.png` });
const wait = (ms) => page.waitForTimeout(ms);
await page.goto("http://localhost:3100/"); await page.waitForSelector(".onboard");
await page.fill("#pseudo", "Adrien"); await page.fill("#email", "adrien@test.fr"); await page.fill("#pw", "motdepasse1");
await page.click("button[type=submit]"); await wait(1500);
await page.evaluate(() => {
  const mk = (i, slug, rarity, atq, def, passive) => ({ id: "t" + i, obtainedSeq: i, exerciseSlug: slug, rarity, atq, def, passive });
  const cards = [
    mk(1, "rowing-barre", "C", 142, 118, null), mk(2, "presse-a-cuisses", "R", 240, 220, null),
    mk(3, "tirage-vertical", "SR", 455, 512, null), mk(4, "gainage", "SSR", 720, 655, null),
    mk(5, "developpe-incline", "UR", 1100, 960, { type: "ATQ", atqTenths: 35, defTenths: 0 }),
    mk(6, "leg-extension", "LR", 1500, 1400, { type: "BOTH", atqTenths: 30, defTenths: 28 }),
    mk(7, "curl-marteau", "UR", 905, 1010, { type: "DEF", atqTenths: 0, defTenths: 30 }),
    mk(9, "rowing-poulie-basse", "SR", 400, 390, null), mk(10, "curl-biceps", "R", 300, 250, null),
    mk(11, "hip-thrust", "C", 120, 130, null), mk(12, "elevations-laterales", "R", 250, 260, null),
    mk(13, "extension-triceps-overhead", "SSR", 700, 650, null),
  ];
  const s = JSON.parse(localStorage.getItem("gymdeck:proto:v1"));
  s.player.cards = cards; s.player.boosters = []; s.player.gc = 300; s.player.seq = 40;
  s.player.deck = ["t5", "t6", "t3", "t4", "t7"];
  s.opening = null;
  const e = s.player.extra; e.tutorialDone = true;
  const d = new Date(); const iso = (n) => new Date(d.getTime() - n * 86400000).toISOString().slice(0, 10);
  e.history = [iso(1), iso(2), iso(3), iso(5), iso(9)]; e.declared = [iso(7), iso(8), iso(14)];
  localStorage.setItem("gymdeck:proto:v1", JSON.stringify(s));
});
await page.reload(); await page.waitForSelector(".hero"); await wait(800);
await shot("1-home");
await page.evaluate(() => document.querySelector(".screen").scrollTo(0, 700)); await wait(300); await shot("1b-home-scroll");
const tabs = ["Collection", "Deck", "Boutique", "Marché", "Combats", "Profil"];
for (const [i, t] of tabs.entries()) { await page.click(`.tab:has-text('${t}')`); await wait(700); await shot(`2-${i}-${t}`); }
// carte : tailles
await page.click(".tab:has-text('Collection')"); await wait(500);
await page.click(".seg button:has-text('Toutes')"); await wait(500);
const sizes = await page.evaluate(() => [...document.querySelectorAll(".ccell .card")].slice(0, 12).map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; }));
console.log("all-view sizes", JSON.stringify([...new Set(sizes.map(String))]));
await page.click(".seg button:has-text('Par exercice')"); await wait(500); await shot("3-exo");
const s2 = await page.evaluate(() => [...document.querySelectorAll(".ccell .card")].map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; }));
console.log("exo-view sizes", JSON.stringify([...new Set(s2.map(String))]), "ghosts", await page.locator(".ccell.ghost").count());
await page.click(".tab:has-text('Profil')"); await wait(400);
await page.click(".linkrow:has-text('Calendrier')"); await wait(600); await shot("4-calendar");
await page.locator(".calday:not(.done):not(.manual):not([disabled])").first().click(); await wait(400); await shot("4b-calendar-tap");
console.log("errors", errors);
await browser.close();
