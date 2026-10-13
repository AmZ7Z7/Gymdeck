import { chromium } from "playwright";
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const wait = (ms) => page.waitForTimeout(ms);
await page.goto("http://localhost:3100/");
await page.waitForSelector(".onboard");
await shot("a1-onboard");
await page.click("button[type=submit]"); await wait(200); await shot("a2-onboard-err");
await page.fill("#pseudo", "Adrien"); await page.fill("#email", "adrien@test.fr"); await page.fill("#pw", "motdepasse1");
await page.click("button[type=submit]"); await wait(1500);
await shot("a3-opening");
// état de test riche
await page.evaluate(() => {
  const mk = (i, slug, rarity, atq, def, passive) => ({ id: "t" + i, obtainedSeq: i, exerciseSlug: slug, rarity, atq, def, passive });
  const cards = [
    mk(1, "rowing-barre", "C", 142, 118, null), mk(2, "developpe-militaire", "R", 240, 220, null),
    mk(3, "tirage-vertical", "SR", 455, 512, null), mk(4, "developpe-couche", "SSR", 720, 655, null),
    mk(5, "developpe-incline", "UR", 1100, 960, { type: "ATQ", atqTenths: 35, defTenths: 0 }),
    mk(6, "squat", "LR", 1500, 1400, { type: "BOTH", atqTenths: 30, defTenths: 28 }),
    mk(9, "rowing-barre", "SR", 400, 390, null), mk(10, "curl-biceps", "R", 300, 250, null),
    mk(11, "hip-thrust", "C", 120, 130, null), mk(12, "elevations-laterales", "R", 250, 260, null),
  ];
  const s = JSON.parse(localStorage.getItem("gymdeck:proto:v1"));
  s.player.cards = cards; s.player.boosters = []; s.player.gc = 300; s.player.seq = 20;
  s.player.deck = ["t5", "t6", "t3", "t10", "t2"];
  s.opening = null;
  localStorage.setItem("gymdeck:proto:v1", JSON.stringify(s));
});
await page.goto("http://localhost:3100/"); await page.reload(); await page.waitForSelector(".hero"); await wait(800);
await shot("b1-home-tuto");
await page.click("text=Suivant"); await wait(300); await shot("b2-tuto2");
await page.click("text=Passer"); await wait(300);
await shot("b3-home");
await page.click("text=Valider ma séance"); await page.click("text=Oui, je valide"); await wait(800);
// on est dans l'ouverture : on sort
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("gymdeck:proto:v1")); s.opening = null; localStorage.setItem("gymdeck:proto:v1", JSON.stringify(s)); });
await page.reload(); await page.waitForSelector(".hero"); await wait(500);
await page.click(".missioncard"); await wait(600); await shot("c1-missions");
const claimBtn = page.locator(".mrow .btn.primary").first();
if (await claimBtn.count()) { await claimBtn.click(); await wait(400); }
await shot("c2-missions-claimed");
await page.click(".seg button:has-text('Série')"); await wait(300); await shot("c3-streak");
await page.click(".seg button:has-text('Succès')"); await wait(300); await shot("c4-ach");
await page.click(".backbtn"); await wait(400);
await page.click(".tab:has-text('Collection')"); await wait(500);
await page.click(".seg button:has-text('Extensions')"); await wait(400); await shot("d1-ext");
await page.click(".seg button:has-text('Toutes')"); await wait(500); await shot("d2-all-holo");
// détail LR
await page.locator(".ccell").first().click({ force: true }); await wait(600); await shot("d3-detail");
const dl = page.waitForEvent("download", { timeout: 15000 }).catch(() => null);
await page.click("text=Partager"); 
const d = await dl; if (d) { await d.saveAs(`${OUT}/share.png`); console.log("download ok"); } else console.log("pas de téléchargement"); 
await wait(800);
await page.keyboard.press("Escape"); await wait(300);
await page.click(".tab:has-text('Profil')"); await wait(500); await shot("e1-profile");
await page.locator(".show3 .bigslot").first().click(); await wait(400); await shot("e2-picker");
await page.locator(".ccell.pick").nth(0).click(); await page.locator(".ccell.pick").nth(1).click(); await wait(300);
await page.click("text=Terminé"); await wait(300); await shot("e3-profile-showcase");
await page.click("text=Amis et échanges"); await wait(500); await shot("f1-friends");
await page.locator(".frow button:has-text('Ajouter')").first().click(); await wait(400);
await page.locator(".frow:has-text('Voir')").first().click(); await wait(600); await shot("f2-friend");
await page.click("text=Proposer un échange"); await wait(500); await shot("f3-trade");
await page.locator(".ccell.pick").nth(0).click(); await page.locator(".ccell.pick").nth(5).click(); await wait(300); await shot("f4-trade-sel");
await page.locator("button.btn.primary:has-text('Proposer')").click(); await wait(500); await shot("f5-trade-res");
await page.reload(); await wait(500);
console.log("errors:", errors);
await browser.close();
