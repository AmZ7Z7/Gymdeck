"use client";

import { Card } from "@/components/Card";
import { DEMO_NAME, GcPill, Wordmark } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { IconChevron } from "@/components/Icons";
import type { Tab } from "@/app/page";

export function Home({ go }: { go: (t: Tab) => void }) {
  const g = useGame();
  const { player } = g;
  const stock = player.boosters.length;
  const hasWelcome = player.boosters.some((b) => b.kind === "welcome1" || b.kind === "welcome2");
  const recent = [...player.cards].sort((a, b) => b.obtainedSeq - a.obtainedSeq).slice(0, 8);

  return (
    <div className="screen">
      <div className="topbar">
        <Wordmark />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <GcPill gc={player.gc} />
          <div className="avatar">{DEMO_NAME[0]}</div>
        </div>
      </div>

      <h1 className="title" style={{ fontSize: 46, marginTop: 20, marginBottom: 2 }}>
        Bonjour <span style={{ color: "var(--lime)" }}>{DEMO_NAME} !</span>
      </h1>
      <div style={{ fontSize: 22, color: "#d5dbee" }}>Ta séance, ton booster.</div>

      <button
        className="pack pulse"
        style={{ height: "min(38dvh, 340px)", marginTop: 8 }}
        aria-label="Ouvrir un booster"
        onClick={() => stock > 0 && g.startOpening(player.boosters[0]!.id)}
      >
        <img src="/assets/ui/booster.webp" alt="Booster GymDeck" draggable={false} />
        {stock > 0 && (
          <span style={{ position: "absolute", right: "18%", top: "8%", minWidth: 34, height: 34, borderRadius: 17, background: "var(--lime)", color: "#0a0d14", display: "grid", placeItems: "center", fontFamily: "var(--display)", fontWeight: 800, fontSize: 22, padding: "0 8px" }}>
            {stock}
          </span>
        )}
      </button>

      {!g.sessionDoneToday ? (
        <button
          className="btn primary"
          onClick={() => {
            const err = g.validate();
            if (err) g.say(err);
          }}
        >
          Valider ma séance <IconChevron width={22} height={22} />
        </button>
      ) : (
        <button className="btn ghost" disabled>Séance du jour validée ✓</button>
      )}
      {stock > 0 && (
        <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => g.startOpening(player.boosters[0]!.id)}>
          {hasWelcome ? "Ouvrir mes boosters de bienvenue" : `Ouvrir un booster (${stock})`}
        </button>
      )}
      <p className="hint">{g.sessionDoneToday ? "Reviens demain pour un nouveau booster de séance." : "1 booster de séance par jour"}</p>

      <div className="row-head">
        <h2 className="section">Mes cartes</h2>
        <button className="link" onClick={() => go("collection")}>Voir toutes ›</button>
      </div>
      {recent.length === 0 ? (
        <div className="empty">Ouvre ton premier booster pour commencer ta collection.</div>
      ) : (
        <div className="strip">
          {recent.map((c) => (
            <div className="cell" key={c.id}><Card card={c} /></div>
          ))}
        </div>
      )}
    </div>
  );
}
