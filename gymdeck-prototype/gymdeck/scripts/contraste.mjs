// Vérifie le contraste (WCAG AA) de chaque texte visible de l'accueil, téléphone et ordinateur.
// Le fond est mesuré sur une capture où les textes sont rendus invisibles : dégradés et images compris.
// Usage : node scripts/contraste.mjs [adresse]
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000/";
const browser = await chromium.launch({ channel: "msedge" });
let fails = 0;
for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
  const page = await browser.newPage({ viewport });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; }" });
  await page.waitForTimeout(3000);
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1) {
      const more = await page.evaluate(() => { const el = document.querySelector(".onboard"); if (!el) return false; el.scrollTo(0, el.scrollHeight); return true; });
      if (!more) break;
      await page.waitForTimeout(300);
    }
    // 1. les textes à mesurer, avec leur couleur réelle
    const items = await page.evaluate(() => {
      const res = [];
      const vis = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      const all = document.querySelectorAll("body *:not(script):not(style)");
      for (const el of all) {
        const s = getComputedStyle(el);
        // le décor (aria-hidden, comme les cartes de la vitrine) n'est pas du texte à lire
        if (s.visibility === "hidden" || s.display === "none" || el.closest("[aria-hidden=true]")) continue;
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        const isInput = el.tagName === "INPUT" && el.placeholder && !el.value;
        if (!own && !isInput) continue;
        // zone du texte lui-même (pas tout l'élément : un bouton peut contenir un badge d'une autre couleur)
        let r = el.getBoundingClientRect();
        if (!isInput) {
          const range = document.createRange();
          const n = [...el.childNodes].find((x) => x.nodeType === 3 && x.textContent.trim());
          range.selectNodeContents(n);
          r = range.getBoundingClientRect();
        }
        if (!vis(r)) continue;
        // texte coupé par le bord du cadre « téléphone » : il sera mesuré une fois la page défilée
        const app = el.closest(".app")?.getBoundingClientRect();
        if (app && (r.bottom > app.bottom || r.top < app.top)) continue;
        let op = 1;
        for (let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
        if (op < 0.05) continue;
        const color = isInput ? getComputedStyle(el, "::placeholder").color : s.color;
        const size = parseFloat(s.fontSize), bold = parseInt(s.fontWeight) >= 700;
        const text = (isInput ? `[${el.placeholder}]` : el.textContent.trim()).slice(0, 40);
        res.push({ text, color, op, large: size >= 24 || (bold && size >= 18.66), r: { x: r.left, y: r.top, w: r.width, h: r.height } });
      }
      return res;
    });
    // 2. le fond sans les textes
    const hide = await page.addStyleTag({ content: "* { color: transparent !important; text-shadow: none !important; -webkit-text-stroke: 0 !important; caret-color: transparent !important; } *::placeholder { color: transparent !important; }" });
    const png = await page.screenshot();
    await hide.evaluate((n) => n.remove());
    const report = await page.evaluate(async ({ b64, items }) => {
      const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0);
      const k = img.width / innerWidth;
      const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const out = [];
      for (const it of items) {
        const m = it.color.match(/[\d.]+/g).map(Number);
        const alpha = (m[3] ?? 1) * it.op;
        const x0 = Math.max(0, Math.floor(it.r.x * k)), y0 = Math.max(0, Math.floor(it.r.y * k));
        const w = Math.max(1, Math.min(c.width - x0, Math.floor(it.r.w * k))), h = Math.max(1, Math.min(c.height - y0, Math.floor(it.r.h * k)));
        const d = ctx.getImageData(x0, y0, w, h).data;
        const ratios = [];
        const step = Math.max(1, Math.floor((w * h) / 400));
        for (let i = 0; i < w * h; i += step) {
          const bg = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
          const fg = [0, 1, 2].map((j) => m[j] * alpha + bg[j] * (1 - alpha));
          ratios.push(ratio(fg, bg));
        }
        // le fond le moins favorable, sans compter les bords et liserés (10 % des points)
        ratios.sort((p, q) => p - q);
        const worst = ratios[Math.floor(ratios.length * 0.1)] ?? 21;
        out.push({ text: it.text, ratio: Math.round(worst * 100) / 100, need: it.large ? 3 : 4.5 });
      }
      return out;
    }, { b64: png.toString("base64"), items });
    for (const r of report) {
      if (r.ratio < r.need) { fails++; console.log(`✗ ${viewport.width}px  ${r.ratio} (min ${r.need})  ${r.text}`); }
    }
  }
  await page.close();
}
await browser.close();
console.log(fails ? `${fails} texte(s) sous le seuil AA` : "Tous les textes visibles respectent le contraste AA");
process.exit(fails ? 1 : 0);
