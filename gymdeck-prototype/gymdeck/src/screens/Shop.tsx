"use client";

import { GcPill, Wordmark } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { IconCart, IconChevron } from "@/components/Icons";
import { BOOSTER_PRICE_GC, DAILY_LOGIN_GC, LOGIN_CYCLE, type BoosterKind } from "@/lib/config";

const KIND_LABEL: Record<BoosterKind, string> = {
  welcome1: "Bienvenue", welcome2: "Bienvenue ✦", session: "Séance", login: "Connexion", shop: "Boutique",
};

export function Shop({ onMarket }: { onMarket: () => void }) {
  const g = useGame();
  const { player } = g;
  const untilBonus = LOGIN_CYCLE - (player.loginCount % LOGIN_CYCLE);

  return (
    <div className="screen">
      <div className="topbar"><Wordmark /><GcPill gc={player.gc} /></div>
      <h1 className="title" style={{ marginTop: 14 }}>Boutique</h1>

      <div className="panel shop-main">
        <div className="pack" style={{ height: 190 }}><img src="/assets/ui/booster.webp" alt="" draggable={false} /></div>
        <div>
          <div className="display" style={{ fontSize: 30, lineHeight: .95 }}>Booster<br />standard</div>
          <div style={{ margin: "6px 0 2px", color: "#d5dbee", fontSize: 15 }}>5 cartes • Au moins une R</div>
          <div className="price"><span className="coin" style={{ width: 32, height: 32 }} />{BOOSTER_PRICE_GC} <small>GC</small></div>
          <button
            className="btn primary small"
            style={{ marginTop: 8 }}
            disabled={player.gc < BOOSTER_PRICE_GC}
            onClick={() => { const e = g.buy(); g.say(e ?? "Booster ajouté à tes boosters"); }}
          >Acheter — {BOOSTER_PRICE_GC} GC</button>
        </div>
      </div>

      <div className="panel reward">
        <span className="coin" />
        <div className="t">Récompense quotidienne
          <span>{g.loginDoneToday ? "Déjà récupérée aujourd’hui." : `+${DAILY_LOGIN_GC} GC · booster dans ${untilBonus} connexion${untilBonus > 1 ? "s" : ""}`}</span>
        </div>
        <button
          className="btn primary chipbtn"
          disabled={g.loginDoneToday}
          onClick={() => {
            const r = g.claim();
            g.say(r === "bonus" ? `+${DAILY_LOGIN_GC} GC et un booster offert !` : r ?? `+${DAILY_LOGIN_GC} GC`);
          }}
        >Récupérer</button>
      </div>

      <div className="row-head">
        <h2 className="section">Mes boosters</h2>
        <span className="link" style={{ color: "var(--muted)" }}>{player.boosters.length}</span>
      </div>
      {player.boosters.length === 0 ? (
        <div className="empty">Aucun booster en stock.</div>
      ) : (
        <div className="panel mypacks">
          {player.boosters.map((b) => (
            <button key={b.id} onClick={() => g.startOpening(b.id)} aria-label={`Ouvrir un booster ${KIND_LABEL[b.kind]}`}>
              <div className="pack" style={{ height: 130 }}><img src="/assets/ui/booster.webp" alt="" draggable={false} /></div>
              <div className="tag">{KIND_LABEL[b.kind]}</div>
            </button>
          ))}
        </div>
      )}

      <button className="panel market" style={{ width: "100%", textAlign: "left" }} onClick={onMarket}>
        <IconCart />
        <span className="t">Marché</span>
        <span className="soon">Bientôt disponible <IconChevron width={14} height={14} style={{ verticalAlign: "-2px" }} /></span>
      </button>
    </div>
  );
}
