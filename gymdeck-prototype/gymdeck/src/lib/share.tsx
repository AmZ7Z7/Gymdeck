import { createRoot } from "react-dom/client";
import { toBlob } from "html-to-image";
import { Card } from "@/components/Card";
import { RARITY_COLOR, RARITY_RANK, exerciseBySlug, type Rarity } from "@/lib/config";
import type { CardData } from "@/lib/engine";

/**
 * Image de partage 9:16 (1080 × 1920) pour TikTok / Instagram / Stories.
 * La carte est dessinée avec le vrai composant Card puis transformée en PNG dans le navigateur.
 */

const TITLES: Record<Rarity, string> = {
  C: "Mon tirage du jour", R: "Belle carte !", SR: "Super tirage !", SSR: "Gros tirage !", UR: "J'ai tiré une UR !", LR: "J'AI TIRÉ UNE LR !!!",
};

function ShareView({ cards, name }: { cards: CardData[]; name: string }) {
  const sorted = [...cards].sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || b.atq + b.def - (a.atq + a.def));
  const best = sorted[0]!;
  const rest = sorted.slice(1, 5);
  const color = RARITY_COLOR[best.rarity];
  const single = cards.length === 1;
  const bigW = single ? 700 : 560;
  return (
    <div style={{
      width: 1080, height: 1920, position: "relative", overflow: "hidden", color: "#fff", fontFamily: "'Barlow Condensed', sans-serif",
      background: `radial-gradient(ellipse 80% 45% at 50% 42%, ${color}55, transparent 70%), radial-gradient(circle at 15% 8%, #4c1d95aa, transparent 45%), radial-gradient(circle at 90% 95%, #4d7c0f88, transparent 45%), #070a12`,
    }}>
      <div style={{ position: "absolute", top: 90, width: "100%", textAlign: "center", fontSize: 92, fontWeight: 800, fontStyle: "italic", letterSpacing: 2 }}>
        GYM<span style={{ color: "#c8f31d" }}>DECK</span>
      </div>
      <div style={{ position: "absolute", top: 230, width: "100%", textAlign: "center", fontSize: 98, fontWeight: 800, fontStyle: "italic", textTransform: "uppercase", color, textShadow: `0 0 40px ${color}` }}>
        {TITLES[best.rarity]}
      </div>
      <div style={{ position: "absolute", top: single ? 400 : 380, left: (1080 - bigW) / 2, width: bigW, filter: `drop-shadow(0 0 60px ${color})` }}>
        <Card card={best} holo={false} />
      </div>
      {rest.length > 0 && (
        <div style={{ position: "absolute", bottom: 330, left: 60, right: 60, display: "flex", gap: 22, justifyContent: "center" }}>
          {rest.map((c, i) => <div key={i} style={{ width: 215 }}><Card card={c} holo={false} /></div>)}
        </div>
      )}
      <div style={{ position: "absolute", bottom: 150, width: "100%", textAlign: "center", fontSize: 58, fontWeight: 700, color: "#e4e9f8" }}>
        {single ? exerciseBySlug(best.exerciseSlug).name : `${cards.length} cartes ouvertes`} · par <b style={{ color: "#c8f31d" }}>{name}</b>
      </div>
      <div style={{ position: "absolute", bottom: 70, width: "100%", textAlign: "center", fontSize: 44, color: "#9aa3b8", letterSpacing: 2, fontWeight: 600 }}>
        TA SÉANCE, TON BOOSTER.
      </div>
    </div>
  );
}

async function render(cards: CardData[], name: string): Promise<Blob> {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-20000px;top:0;width:1080px;height:1920px;pointer-events:none;";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    root.render(<ShareView cards={cards} name={name} />);
    await new Promise((r) => setTimeout(r, 60));
    const imgs = Array.from(host.querySelectorAll("img"));
    await Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.onload = i.onerror = () => r(null); }))));
    await (document.fonts?.ready ?? Promise.resolve());
    const opts = { width: 1080, height: 1920, pixelRatio: 1, cacheBust: false };
    const node = host.firstElementChild as HTMLElement;
    await toBlob(node, opts); // 1er passage : amorce le chargement des polices/images intégrées
    const blob = await toBlob(node, opts);
    if (!blob) throw new Error("Image vide");
    return blob;
  } finally {
    root.unmount();
    host.remove();
  }
}

/** Partage via la feuille de partage du téléphone, sinon télécharge l'image. Renvoie un message pour l'utilisateur. */
export async function shareCards(cards: CardData[], name: string): Promise<string> {
  if (cards.length === 0) return "Rien à partager.";
  try {
    const blob = await render(cards, name);
    const file = new File([blob], "gymdeck-tirage.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: "GymDeck", text: "Mon tirage GymDeck" });
        return "Partagé !";
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return "Partage annulé.";
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "gymdeck-tirage.png";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return "Image enregistrée : prête pour TikTok !";
  } catch {
    return "Impossible de créer l'image.";
  }
}
