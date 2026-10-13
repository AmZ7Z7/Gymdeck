import { chromium } from "playwright";
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:3100/"); await page.waitForSelector(".onboard");
await page.fill("#pseudo", "Adrien"); await page.fill("#email", "adrien@test.fr"); await page.fill("#pw", "motdepasse1");
await page.click("button[type=submit]"); await page.waitForTimeout(1500);
await page.evaluate(() => {
  const mk = (i, slug, rarity, atq, def, passive) => ({ id: "t" + i, obtainedSeq: i, exerciseSlug: slug, rarity, atq, def, passive });
  const cards = [
    mk(1, "extension-triceps-overhead", "LR", 1500, 1400, { type: "BOTH", atqTenths: 30, defTenths: 28 }),
    mk(2, "presse-a-cuisses", "UR", 1100, 960, { type: "ATQ", atqTenths: 35, defTenths: 0 }),
    mk(3, "gainage", "LR", 1450, 1380, { type: "DEF", atqTenths: 0, defTenths: 61 }),
    mk(4, "crunch-poulie", "UR", 905, 1010, { type: "BOTH", atqTenths: 15, defTenths: 12 }),
    mk(5, "developpe-poitrine-machine", "SSR", 700, 650, null),
  ];
  const s = JSON.parse(localStorage.getItem("gymdeck:proto:v1"));
  s.player.cards = cards; s.player.boosters = []; s.player.deck = []; s.opening = null; s.player.extra.tutorialDone = true;
  localStorage.setItem("gymdeck:proto:v1", JSON.stringify(s));
});
await page.reload(); await page.waitForSelector(".hero");
await page.click(".tab:has-text('Collection')"); await page.waitForTimeout(400);
await page.click(".seg button:has-text('Toutes')"); await page.waitForTimeout(500);
for (let i = 0; i < 4; i++) {
  await page.locator(".ccell").nth(i).click({ force: true }); await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/d${i}.png` });
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
}
console.log("errors", errors); await browser.close();
