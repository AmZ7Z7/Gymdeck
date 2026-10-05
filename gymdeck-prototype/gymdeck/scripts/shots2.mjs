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
// État de test : une carte de chaque rareté (UR/LR avec passifs de chaque type) + doublons
await page.evaluate(() => {
  const mk = (i, slug, rarity, atq, def, passive) => ({ id: "t" + i, obtainedSeq: i, exerciseSlug: slug, rarity, atq, def, passive });
  const cards = [
    mk(1, "rowing-barre", "C", 142, 118, null),
    mk(2, "developpe-militaire", "R", 240, 220, null),
    mk(3, "tirage-vertical", "SR", 455, 512, null),
    mk(4, "developpe-couche", "SSR", 720, 655, null),
    mk(5, "developpe-incline", "UR", 1100, 960, { type: "ATQ", atqTenths: 35, defTenths: 0 }),
    mk(6, "souleve-de-terre", "LR", 1623, 1342, { type: "BOTH", atqTenths: 31, defTenths: 27 }),
    mk(7, "squat", "LR", 1500, 1500, { type: "DEF", atqTenths: 0, defTenths: 62 }),
    mk(8, "hip-thrust", "UR", 905, 1010, { type: "BOTH", atqTenths: 15, defTenths: 12 }),
    mk(9, "rowing-barre", "SR", 400, 390, null),
    mk(10, "rowing-barre", "R", 300, 250, null),
    mk(11, "curl-biceps", "C", 100, 180, null),
    mk(12, "elevations-laterales", "SSR", 799, 601, null),
  ];
  const s = JSON.parse(localStorage.getItem("gymdeck:proto:v1"));
  s.player = { ...s.player, gc: 130, cards, boosters: [{ id: "b1", kind: "session" }, { id: "b2", kind: "login" }, { id: "b3", kind: "shop" }], seq: 12, sessionsValidated: 4, loginCount: 3, pityCounter: 4 };
  s.opening = null;
  localStorage.setItem("gymdeck:proto:v1", JSON.stringify(s));
});
await page.reload();
await page.waitForSelector(".app .screen");
await page.waitForTimeout(500);
await shot("11-home-with-cards");

await page.getByRole("button", { name: "Collection" }).click();
await page.waitForTimeout(400);
await shot("12-collection");
await page.getByText("Voir toutes ›").first().click();
await page.waitForTimeout(400);
await shot("13-collection-all");
await page.getByText("Réduire ›").first().click();

await page.getByRole("button", { name: "LR", exact: true }).click();
await page.waitForTimeout(300);
await shot("14-filter-lr");
await page.locator(".strip .cell").first().click();
await page.waitForTimeout(400);
await shot("15-detail-lr");
await page.getByText(/^Défausser/).click();
await page.waitForTimeout(200);
await shot("16-discard-confirm");
await page.getByText(/^Confirmer/).click();
await page.waitForTimeout(500);
await shot("17-after-discard");
await page.getByText("Fermer").click().catch(() => {});

await page.getByRole("button", { name: "Boutique" }).click();
await page.waitForTimeout(400);
await shot("18-shop");
await page.getByText("Récupérer").click();
await page.waitForTimeout(300);
await shot("19-claimed");
await page.getByText("Marché").first().click();
await page.waitForTimeout(300);
await shot("20-market");
await page.getByText("Retour à la boutique").click();
await page.getByRole("button", { name: "Profil" }).click();
await page.waitForTimeout(300);
await shot("21-profile");
console.log("errors:", JSON.stringify(errors));
await browser.close();
