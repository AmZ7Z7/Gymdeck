"use client";

import { useState } from "react";
import { GcPill, LoginDots, OddsSheet, Wordmark } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { IconCart, IconChevron } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import { BOOSTER_PRICE_GC, DAILY_LOGIN_GC, LOGIN_CYCLE, PITY_THRESHOLD, type BoosterKind } from "@/lib/config";

const KIND_LABEL: Record<BoosterKind, string> = {
  welcome1: "Bienvenue", welcome2: "Bienvenue ✦", session: "Séance", login: "Connexion", shop: "Boutique",
};

export function Shop({ onMarket }: { onMarket: () => void }) {
  const g = useGame();
  const { player } = g;
  const [odds, setOdds] = useState(false);
  const [bought, setBought] = useState<string | null>(null);
  const cycle = player.loginCount % LOGIN_CYCLE;
  const untilBonus = LOGIN_CYCLE - cycle;
  const missing = BOOSTER_PRICE_GC - player.gc;
  const pity = Math.min(player.pityCounter, PITY_THRESHOLD - 1);

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
            disabled={missing > 0}
            onClick={() => {
              const r = g.buy();
              if ("error" in r) { g.say(r.error); return; }
              setBought(r.boosterId);
            }}
          >{missing > 0 ? `Il manque ${missing} GC` : `Acheter — ${BOOSTER_PRICE_GC} GC`}</button>
        </div>
      </div>
      {missing > 0 && <p className="hint">Récupère ta récompense du jour ou défausse des doublons pour gagner des GC.</p>}

      <div className="pityrow">
        <div className="l"><span>Garantie UR</span><span>{pity >= PITY_THRESHOLD - 1 ? <b>au prochain booster !</b> : <>dans <b>{PITY_THRESHOLD - pity}</b> booster{PITY_THRESHOLD - pity > 1 ? "s" : ""} au plus</>}</span></div>
        <div className="progress"><i style={{ width: `${(pity / (PITY_THRESHOLD - 1)) * 100}%` }} /></div>
        <button className="link" style={{ justifySelf: "start", marginTop: 2 }} onClick={() => setOdds(true)}>Voir les taux de drop ›</button>
      </div>

      <div className="panel reward" style={{ flexWrap: "wrap" }}>
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
        <div style={{ width: "100%" }}><LoginDots done={g.loginDoneToday && cycle === 0 ? LOGIN_CYCLE : cycle} total={LOGIN_CYCLE} /></div>
      </div>

      <div className="row-head">
        <h2 className="section">Mes boosters</h2>
        <span className="link" style={{ color: "var(--muted)" }}>{player.boosters.length}</span>
      </div>
      {player.boosters.length === 0 ? (
        <div className="empty">Aucun booster en stock. Valide ta séance sur l’accueil !</div>
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

      {odds && <OddsSheet onClose={() => setOdds(false)} />}
      {bought && (
        <Sheet onClose={() => setBought(null)} label="Booster acheté">
          <div className="sheet-title">Booster acheté !</div>
          <p>Il est dans tes boosters. Tu l’ouvres maintenant ?</p>
          <button className="btn primary" onClick={() => { const id = bought; setBought(null); g.startOpening(id); }}>Ouvrir maintenant</button>
          <button className="btn ghost small" onClick={() => setBought(null)}>Plus tard</button>
        </Sheet>
      )}
    </div>
  );
}
