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
await shot("01-onboarding");
await page.fill("#pseudo", "Adrien");
await page.click("text=C’est parti");
await page.waitForSelector(".packstage");
await wait(600);
await shot("02-pack");
await page.click(".packstage .pack", { force: true });
await wait(500);
await shot("03-charge");
await wait(1100);
await shot("04-deal-flash");
await wait(1500);
await shot("05-cards-hidden");

// Tap le centre → révèle
const center = page.locator(".dealcard[data-i='0']");
const cb = await center.boundingBox();
const tapAt = async (box) => page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
await tapAt(cb);
await wait(1400);
await shot("06-revealed-0");
// Tap à droite (carte 1) → doit aller dessus
const nb = await page.locator(".dealcard[data-i='1']").boundingBox();
await page.touchscreen.tap(380, nb.y + nb.height / 2); // partie visible de la carte de droite
await wait(700);
await shot("07-focus-1");
const idxText = await page.locator(".counter").innerText();
console.log("counter after tap right:", idxText.replace(/\s+/g, ""));
// Tap sur carte revealed-0? d'abord révéler 1 puis retap -> passe à 2
const c1 = await page.locator(".dealcard[data-i='1']").boundingBox();
await tapAt(c1); await wait(1500);
await tapAt(c1); await wait(900);
console.log("counter after reveal+tap:", (await page.locator(".counter").innerText()).replace(/\s+/g, ""));
// Swipe gauche
const c2 = await page.locator(".dealcard[data-i='2']").boundingBox();
const cx = 195, cy = c2.y + c2.height / 2;
await page.mouse.move(cx, cy);
await page.mouse.down();
for (let i = 1; i <= 8; i++) { await page.mouse.move(cx - i * 20, cy); await wait(16); }
await page.mouse.up(); await wait(600);
console.log("counter after swipe:", (await page.locator(".counter").innerText()).replace(/\s+/g, ""));
await shot("08-after-swipe");
// Tout révéler puis butin
await page.click("text=Tout révéler"); await wait(1200);
await shot("09-all-revealed");
await page.click("text=Voir mon butin"); await wait(1500);
await shot("10-summary");
await page.click("text=Booster suivant"); await wait(600);
await page.click(".packstage .pack", { force: true }); await wait(3200);
await page.click("text=Tout révéler"); await wait(900);
await page.click("text=Voir mon butin"); await wait(1300);
await shot("11-summary2");
await page.click("text=Compose ton deck").catch(() => page.click("text=Améliorer mon deck"));
await wait(600);
await shot("12-gymdeck-empty");
await page.click("text=Modifier mon deck"); await wait(600);
await shot("13-picker");
await page.click("text=Auto"); await wait(300);
await shot("14-picker-auto");
await page.click("text=Valider"); await wait(700);
await shot("15-gymdeck-filled");
await page.click(".tab:has-text('Accueil')"); await wait(500);
await shot("16-home");
await page.click(".tab:has-text('Collection')"); await wait(500);
await shot("17-collection");
await page.click(".tab:has-text('Boutique')"); await wait(500);
await shot("18-shop");
await page.click("text=Voir les taux de drop"); await wait(500);
await shot("19-odds");
await page.keyboard.press("Escape"); await wait(300);
await page.click(".tab:has-text('Profil')"); await wait(500);
await shot("20-profile");
console.log("errors:", errors);
await browser.close();
