"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Card } from "@/components/Card";
import { GcPill, LoginDots, Wordmark, formatDuration, useNow } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { IconChevron } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import { DAILY_LOGIN_GC, DECK_SIZE, LOGIN_CYCLE } from "@/lib/config";
import { deckTotals } from "@/lib/engine";
import { completion, msUntilParisMidnight } from "@/lib/game";
import type { Tab } from "@/app/page";

export function Home({ go }: { go: (t: Tab) => void }) {
  const g = useGame();
  const { player } = g;
  const now = useNow();
  const [confirm, setConfirm] = useState(false);
  const stock = player.boosters.length;
  const hasWelcome = player.boosters.some((b) => b.kind === "welcome1" || b.kind === "welcome2");
  const recent = [...player.cards].sort((a, b) => b.obtainedSeq - a.obtainedSeq).slice(0, 8);
  const comp = completion(player);
  const t = deckTotals(g.deckCards);
  const cycle = player.loginCount % LOGIN_CYCLE;
  const untilBonus = LOGIN_CYCLE - cycle;
  const countdown = formatDuration(msUntilParisMidnight(now));

  const openFirst = () => stock > 0 && g.startOpening(player.boosters[0]!.id);

  return (
    <div className="screen">
      <div className="topbar">
        <Wordmark />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <GcPill gc={player.gc} />
          <button className="avatar" aria-label="Mon profil" onClick={() => go("profile")}>{(player.name ?? "?")[0]!.toUpperCase()}</button>
        </div>
      </div>

      <h1 className="title" style={{ fontSize: 44, marginTop: 16, marginBottom: 2 }}>
        Bonjour <span style={{ color: "var(--lime)" }}>{player.name} !</span>
      </h1>
      <div style={{ fontSize: 20, color: "#d5dbee" }}>
        {stock > 0 ? (hasWelcome ? "Tes boosters de bienvenue t’attendent." : "Un booster t’attend.") : g.sessionDoneToday ? "Séance validée. Bien joué." : "Ta séance, ton booster."}
      </div>

      <div className="hero">
        <span className="halo" />
        <motion.button
          className="pack"
          aria-label={stock > 0 ? "Ouvrir un booster" : "Booster GymDeck"}
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          whileTap={{ scale: 0.96 }}
          onClick={openFirst}
        >
          <img src="/assets/ui/booster.webp" alt="" draggable={false} />
        </motion.button>
        {stock > 0 && <span className="stockbadge">{stock}</span>}
      </div>

      {!g.sessionDoneToday ? (
        <>
          <button className="btn primary" onClick={() => setConfirm(true)}>
            Valider ma séance <IconChevron width={22} height={22} />
          </button>
          {stock > 0 && (
            <button className="btn ghost small" style={{ marginTop: 10 }} onClick={openFirst}>
              {hasWelcome ? "Ouvrir mes boosters de bienvenue" : `Ouvrir un booster (${stock})`}
            </button>
          )}
          <p className="hint">1 booster de séance par jour</p>
        </>
      ) : stock > 0 ? (
        <>
          <button className="btn primary" onClick={openFirst}>{hasWelcome ? "Ouvrir mes boosters" : `Ouvrir un booster (${stock})`}</button>
          <p className="hint">Prochain booster de séance dans {countdown}</p>
        </>
      ) : (
        <>
          <button className="btn ghost" disabled>Séance du jour validée ✓</button>
          <p className="hint">Prochain booster de séance dans {countdown}</p>
        </>
      )}

      {!g.loginDoneToday ? (
        <div className="panel dailybanner">
          <div className="top">
            <span className="coin" />
            <div className="t">Récompense du jour<span>+{DAILY_LOGIN_GC} GC{untilBonus === 1 ? " + un booster offert !" : ` · booster dans ${untilBonus} connexion${untilBonus > 1 ? "s" : ""}`}</span></div>
            <button
              className="btn primary chipbtn"
              onClick={() => {
                const r = g.claim();
                g.say(r === "bonus" ? `+${DAILY_LOGIN_GC} GC et un booster offert !` : r ?? `+${DAILY_LOGIN_GC} GC récupérés`);
              }}
            >Récupérer</button>
          </div>
          <LoginDots done={cycle} total={LOGIN_CYCLE} />
        </div>
      ) : (
        <div className="dailydone">
          <LoginDots done={cycle === 0 ? LOGIN_CYCLE : cycle} total={LOGIN_CYCLE} />
          <span>{cycle === 0 ? "Cycle terminé, booster reçu · un nouveau cycle commence à ta prochaine connexion." : `Connexion du jour récupérée · booster offert dans ${untilBonus} connexion${untilBonus > 1 ? "s" : ""}`}</span>
        </div>
      )}

      <button className="panel minideck" onClick={() => go("gymdeck")}>
        <div className="row-head" style={{ margin: 0 }}>
          <h2 className="section" style={{ fontSize: 26 }}>Mon GymDeck</h2>
          <span className="link">{g.deckCards.length}/{DECK_SIZE} ›</span>
        </div>
        <div className="row">
          {Array.from({ length: DECK_SIZE }, (_, i) => {
            const c = g.deckCards[i];
            return c ? <div key={c.id}><Card card={c} /></div> : <div key={i} className="slotmini">+</div>;
          })}
        </div>
        {g.deckCards.length > 0 ? (
          <div className="tot"><span>ATQ {t.totalAtq}</span><span>DEF {t.totalDef}</span></div>
        ) : (
          <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 15 }}>
            {player.cards.length > 0 ? "Compose ton deck de 5 exercices." : "Ouvre un booster, puis compose ton deck."}
          </div>
        )}
      </button>

      <div className="row-head">
        <h2 className="section">Mes cartes</h2>
        <button className="link" onClick={() => go("collection")}>Voir toutes ›</button>
      </div>
      <div className="statsline"><span>Collection : <b>{comp.owned} / {comp.total}</b> cartes uniques</span></div>
      <div className="progress" style={{ marginBottom: 12 }}><i style={{ width: `${(comp.owned / comp.total) * 100}%` }} /></div>
      {recent.length === 0 ? (
        <div className="empty">Ouvre ton premier booster pour commencer ta collection.</div>
      ) : (
        <div className="strip">
          {recent.map((c) => (
            <button className="cell" key={c.id} aria-label="Voir ma collection" onClick={() => go("collection")}><Card card={c} /></button>
          ))}
        </div>
      )}

      {confirm && (
        <Sheet onClose={() => setConfirm(false)} label="Valider ma séance">
          <div className="sheet-title">Séance terminée ?</div>
          <p>Tu as fait ta séance aujourd’hui ? GymDeck te fait confiance : pas de preuve à fournir. Tu reçois un booster de séance.</p>
          <button
            className="btn primary"
            onClick={() => {
              setConfirm(false);
              const err = g.validate();
              if (err) g.say(err);
            }}
          >Oui, je valide</button>
          <button className="btn ghost small" onClick={() => setConfirm(false)}>Pas encore</button>
        </Sheet>
      )}
    </div>
  );
}
