import { chromium } from "playwright";
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });

await page.goto("http://localhost:3100/");
await page.waitForSelector(".app .screen");
await page.waitForTimeout(500);
await shot("01-home-welcome");

await page.getByText("Ouvrir mes boosters de bienvenue").click({ force: true });
await page.waitForTimeout(400);
await shot("02-opening-closed");

await page.getByLabel("Ouvrir le booster").click({ force: true });
await page.waitForTimeout(450);
await shot("03-shake");
await page.waitForTimeout(1200);
await shot("04-cards-back");

await page.locator(".slide").nth(0).click();
await page.waitForTimeout(1000);
await shot("05-first-revealed");

const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("gymdeck:proto:v1")));
console.log("cartes sauvegardées avant rechargement:", stored.player.cards.length, "booster restants:", stored.player.boosters.length, "revealed:", JSON.stringify(stored.opening.revealed));

// rechargement en plein milieu : l'état doit être identique
await page.reload();
await page.waitForSelector(".slide");
await page.waitForTimeout(800);
await shot("06-after-reload");
const after = await page.evaluate(() => JSON.parse(localStorage.getItem("gymdeck:proto:v1")));
console.log("après rechargement: mêmes cartes?", JSON.stringify(after.player.cards.map(c=>c.id)) === JSON.stringify(stored.player.cards.map(c=>c.id)), "revealed:", JSON.stringify(after.opening.revealed));

await page.getByLabel("Carte suivante").click();
await page.waitForTimeout(700);
await page.locator(".slide").nth(1).click();
await page.waitForTimeout(900);
await shot("07-second-revealed");
for (let i = 2; i < 5; i++) {
  await page.getByLabel("Carte suivante").click();
  await page.waitForTimeout(600);
  await page.locator(".slide").nth(i).click();
  await page.waitForTimeout(500);
}
await page.waitForTimeout(600);
await shot("08-all-revealed");

await page.getByText("Booster suivant").click();
await page.waitForTimeout(500);
await shot("09-second-welcome-booster");
console.log("errors:", JSON.stringify(errors));
await browser.close();
