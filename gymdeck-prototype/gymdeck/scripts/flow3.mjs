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
await page.fill("#pseudo", "Adrien"); await page.fill("#email", "a@test.fr"); await page.fill("#pw", "motdepasse1"); await page.click("button[type=submit]"); await wait(1200);
await page.evaluate(() => {
  const mk = (i, slug, rarity, atq, def, passive) => ({ id: "t" + i, obtainedSeq: i, exerciseSlug: slug, rarity, atq, def, passive });
  const cards = [
    mk(1, "rowing-barre", "C", 142, 118, null), mk(2, "developpe-militaire", "R", 240, 220, null),
    mk(3, "tirage-vertical", "SR", 455, 512, null), mk(4, "developpe-couche", "SSR", 720, 655, null),
    mk(5, "developpe-incline", "UR", 1100, 960, { type: "ATQ", atqTenths: 35, defTenths: 0 }),
    mk(9, "rowing-barre", "SR", 400, 390, null), mk(10, "rowing-barre", "R", 300, 250, null),
  ];
  const s = JSON.parse(localStorage.getItem("gymdeck:proto:v1"));
  s.player.name = "Adrien"; s.player.cards = cards; s.player.boosters = []; s.player.gc = 300; s.player.seq = 20;
  s.player.deck = ["t5"]; s.opening = null;
  localStorage.setItem("gymdeck:proto:v1", JSON.stringify(s));
});
await page.goto("http://localhost:3100/#marche"); await page.reload(); await wait(1500); await shot("m0"); await page.waitForSelector(".agrid"); await wait(600);
await shot("m1-browse");
await page.locator(".acell").first().click(); await wait(500);
await shot("m2-sheet");
await page.click("text=Enchérir ·"); await wait(600);
await shot("m3-after-bid");
await page.click("text=Mes enchères"); await wait(500);
await shot("m4-mine");
await page.click("text=Vendre", { force: true }); await wait(500);
await page.locator(".ccell").nth(1).click(); await wait(500);
await shot("m5-sell");
await page.click("text=Mettre aux enchères ·"); await wait(700);
await shot("m6-mine-after-list");
await page.evaluate(() => {}); 
// avance le temps via outils de test
await page.click(".tab:has-text('Profil')").catch(()=>{});
console.log("errors:", errors);
await browser.close();
