import { chromium } from "playwright";
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const wait = (ms) => page.waitForTimeout(ms);
await page.goto("http://localhost:3100/");
await page.waitForSelector(".onboard");
await page.evaluate(() => {
  const mk = (i, slug, rarity, atq, def, passive) => ({ id: "t" + i, obtainedSeq: i, exerciseSlug: slug, rarity, atq, def, passive });
  const cards = [
    mk(1, "rowing-barre", "C", 142, 118, null), mk(2, "developpe-militaire", "R", 240, 220, null),
    mk(3, "tirage-vertical", "SR", 455, 512, null), mk(4, "developpe-couche", "SSR", 720, 655, null),
    mk(5, "developpe-incline", "UR", 1100, 960, { type: "ATQ", atqTenths: 35, defTenths: 0 }),
    mk(6, "souleve-de-terre", "LR", 1623, 1342, { type: "BOTH", atqTenths: 31, defTenths: 27 }),
    mk(7, "squat", "LR", 1500, 1500, { type: "DEF", atqTenths: 0, defTenths: 62 }),
    mk(9, "rowing-barre", "SR", 400, 390, null), mk(10, "rowing-barre", "R", 300, 250, null), mk(11, "rowing-barre", "R", 280, 230, null),
  ];
  const s = JSON.parse(localStorage.getItem("gymdeck:proto:v1"));
  s.player.name = "Adrien"; s.player.cards = cards; s.player.boosters = []; s.player.gc = 120; s.player.seq = 20;
  s.player.deck = ["t5", "t6", "t7", "t4", "t3"];
  localStorage.setItem("gymdeck:proto:v1", JSON.stringify(s));
});
await page.reload(); await page.waitForSelector(".screen"); await wait(500);
await shot("h1-home");
await page.click("text=Valider ma séance"); await wait(500);
await shot("h2-confirm");
await page.click("text=Pas encore"); await wait(300);
await page.click(".tab:has-text('GymDeck')"); await wait(600);
await shot("h3-deck");
await page.click(".tab:has-text('Collection')"); await wait(600);
await shot("h4-collection");
await page.click("text=Toutes les cartes"); await wait(500);
await shot("h5-all");
await page.locator(".ccell").first().click(); await wait(500);
await shot("h6-detail");
await page.keyboard.press("Escape"); await wait(300);
await page.click("text=Nettoyer les doublons"); await wait(500);
await shot("h7-clean");
await page.click("text=Annuler"); await wait(300);
await page.click(".tab:has-text('Boutique')"); await wait(500);
await page.click("text=Acheter"); await wait(500);
await shot("h8-bought");
await page.click("text=Ouvrir maintenant"); await wait(600);
await shot("h9-pack");
console.log("errors:", errors);
await browser.close();
