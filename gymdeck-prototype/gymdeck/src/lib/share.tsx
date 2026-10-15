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

async function render(view: React.ReactNode): Promise<Blob> {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-20000px;top:0;width:1080px;height:1920px;pointer-events:none;";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    root.render(view);
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
async function shareImage(view: React.ReactNode, file: string, text: string): Promise<string> {
  try {
    const blob = await render(view);
    const f = new File([blob], file, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [f] })) {
      try {
        await nav.share({ files: [f], title: "GymDeck", text });
        return "Partagé !";
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return "Partage annulé.";
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = file;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return "Image enregistrée : prête pour ta story !";
  } catch {
    return "Impossible de créer l'image.";
  }
}

export async function shareCards(cards: CardData[], name: string): Promise<string> {
  if (cards.length === 0) return "Rien à partager.";
  return shareImage(<ShareView cards={cards} name={name} />, "gymdeck-tirage.png", "Mon tirage GymDeck");
}

// ───────────── Visuels de story : victoire, série ─────────────

const frame: React.CSSProperties = { width: 1080, height: 1920, position: "relative", overflow: "hidden", color: "#fff", fontFamily: "'Barlow Condensed', sans-serif" };
const center = (top: number, size: number, extra: React.CSSProperties = {}): React.CSSProperties => ({ position: "absolute", top, width: "100%", textAlign: "center", fontSize: size, fontWeight: 800, fontStyle: "italic", textTransform: "uppercase", ...extra });

function Brand() {
  return <img src="/assets/ui/logo.webp" alt="" style={{ position: "absolute", top: 70, left: 290, width: 500, mixBlendMode: "screen" }} />;
}

function VictoryView({ cards, name, opp, myHp, ko }: { cards: CardData[]; name: string; opp: string; myHp: number; ko: boolean }) {
  return (
    <div style={{ ...frame, background: "radial-gradient(ellipse 85% 40% at 50% 46%, rgba(200,243,29,.35), transparent 70%), radial-gradient(circle at 10% 10%, #4c1d95cc, transparent 45%), #070a12" }}>
      <Brand />
      <div style={center(420, 210, { color: "#c8f31d", textShadow: "0 0 60px rgba(200,243,29,.8)", letterSpacing: 4 })}>Victoire</div>
      <div style={center(660, 64, { color: "#e4e9f8", fontStyle: "normal" })}>{ko ? "par KO" : `${myHp} % de PV restants`} contre <b style={{ color: "#fff" }}>{opp}</b></div>
      <div style={{ position: "absolute", top: 820, left: 40, right: 40, display: "flex", gap: 18, justifyContent: "center" }}>
        {cards.map((c, i) => <div key={i} style={{ width: 186, transform: `translateY(${Math.abs(i - 2) * 26}px) rotate(${(i - 2) * 5}deg)` }}><Card card={c} holo={false} /></div>)}
      </div>
      <div style={center(1420, 60, { fontStyle: "normal", textTransform: "none", fontWeight: 700, color: "#e4e9f8" })}>Le deck de <b style={{ color: "#c8f31d" }}>{name}</b></div>
      <div style={center(1760, 44, { color: "#9aa3b8", fontStyle: "normal", fontWeight: 600, letterSpacing: 2 })}>Ta séance, ton booster.</div>
    </div>
  );
}

function StreakView({ days, sessions, name }: { days: number; sessions: number; name: string }) {
  return (
    <div style={{ ...frame, background: "radial-gradient(ellipse 80% 40% at 50% 45%, rgba(255,138,42,.45), transparent 70%), radial-gradient(circle at 90% 90%, #4c1d95aa, transparent 45%), #070a12" }}>
      <Brand />
      <div style={center(480, 420, { color: "#ffb020", textShadow: "0 0 80px rgba(255,138,42,.9)", lineHeight: 1 })}>{days}</div>
      <div style={center(920, 110, { letterSpacing: 3 })}>séance{days > 1 ? "s" : ""} d’affilée</div>
      <div style={center(1090, 60, { fontStyle: "normal", textTransform: "none", fontWeight: 700, color: "#e4e9f8" })}>{sessions} séance{sessions > 1 ? "s" : ""} validée{sessions > 1 ? "s" : ""} au total</div>
      <div style={center(1420, 60, { fontStyle: "normal", textTransform: "none", fontWeight: 700, color: "#e4e9f8" })}>par <b style={{ color: "#c8f31d" }}>{name}</b></div>
      <div style={center(1760, 44, { color: "#9aa3b8", fontStyle: "normal", fontWeight: 600, letterSpacing: 2 })}>Ta séance, ton booster.</div>
    </div>
  );
}

export const shareVictory = (p: { cards: CardData[]; name: string; opp: string; myHp: number; ko: boolean }) =>
  shareImage(<VictoryView {...p} />, "gymdeck-victoire.png", "Victoire sur GymDeck");

export const shareStreak = (p: { days: number; sessions: number; name: string }) =>
  shareImage(<StreakView {...p} />, "gymdeck-serie.png", "Ma série GymDeck");
