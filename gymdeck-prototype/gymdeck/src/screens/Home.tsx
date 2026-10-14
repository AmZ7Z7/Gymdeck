"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { GcPill, LoginDots, Wordmark, formatDuration, useNow } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { IconChevron } from "@/components/Icons";
import { sfx } from "@/lib/sound";
import { Sheet } from "@/components/Sheet";
import { DAILY_LOGIN_GC, DECK_SIZE, DUEL, LOGIN_CYCLE } from "@/lib/config";
import { readyCount } from "@/lib/grading";
import { IconCombat } from "@/components/Icons";
import { deckTotals } from "@/lib/engine";
import { completion, msUntilParisMidnight } from "@/lib/game";
import type { OpenPage, Tab } from "@/app/page";
import { Tutorial } from "@/components/Tutorial";
import { claimableCount, dailyMissions, missionProgress, streakNow, trainingDays, weekOf } from "@/lib/progress";
import { reminderDue } from "@/lib/reminder";

export function Home({ go, openPage }: { go: (t: Tab) => void; openPage: OpenPage }) {
  const g = useGame();
  const { player } = g;
  const now = useNow();
  const [confirm, setConfirm] = useState(false);
  const [tuto, setTuto] = useState(false);
  const e = g.extra;
  useEffect(() => { if (g.ready && e.tutorialDone === false && !g.opening) setTuto(true); }, [g.ready, e.tutorialDone, g.opening]);
  const missions = dailyMissions(g.day);
  const mDone = missions.filter((m) => missionProgress(e, "daily", m).done).length;
  const ready = claimableCount(player, g.day);
  const streak = streakNow(e, g.day);
  const showReminder = !g.sessionDoneToday && reminderDue(e.reminder, now);
  const stock = player.boosters.length;
  const hasWelcome = player.boosters.some((b) => b.kind === "welcome1" || b.kind === "welcome2");
  const recent = [...player.cards].sort((a, b) => b.obtainedSeq - a.obtainedSeq).slice(0, 8);
  const comp = completion(player);
  const t = deckTotals(g.deckCards);
  const cycle = player.loginCount % LOGIN_CYCLE;
  const untilBonus = LOGIN_CYCLE - cycle;
  const countdown = formatDuration(msUntilParisMidnight(now));
  const graded = readyCount(player, g.gameNow());
  const deckReady = g.deckCards.length >= DECK_SIZE;

  const trainSet = new Set(trainingDays(e));
  const wk0 = weekOf(g.day);
  const weekDays = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${wk0}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));
  const weekCount = weekDays.filter((d) => trainSet.has(d)).length;

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
                sfx.coin();
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

      {showReminder && (
        <div className="panel remindbanner" role="status">⏰ C’est l’heure de ta séance ! Valide-la pour gagner ton booster.</div>
      )}

      <button className="panel missioncard" onClick={() => openPage("missions")}>
        <div className="mc-l">
          <div className="mc-t">Objectifs du jour</div>
          <div className="mc-s">{mDone} / {missions.length} missions{streak > 0 ? ` · 🔥 ${streak} séance${streak > 1 ? "s" : ""} d’affilée` : ""}</div>
        </div>
        {ready > 0 ? <span className="tabbadge" style={{ position: "static" }}>{ready}</span> : <span className="link">›</span>}
      </button>

      {graded > 0 && (
        <motion.button className="panel basilebanner" onClick={() => openPage("atelier")} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <span className="bb-ico" aria-hidden>🔍</span>
          <span className="bb-t">Basile a terminé !<span>{graded > 1 ? `${graded} notes t’attendent à l’atelier.` : "Une note t’attend à l’atelier."}</span></span>
          <span className="link">Voir ›</span>
        </motion.button>
      )}

      <button className="panel duelcard" onClick={() => go("combats")}>
        <IconCombat />
        <span className="dc-t">Combats<span>{!deckReady ? "Complète ton deck de 5 cartes pour combattre." : g.duelsLeft > 0 ? `${g.duelsLeft} duel${g.duelsLeft > 1 ? "s" : ""} disponible${g.duelsLeft > 1 ? "s" : ""} aujourd’hui` : g.sessionDoneToday ? "Plus de duel aujourd’hui. Reviens demain !" : `Valide ta séance : +${DUEL.perSession} duels`}</span></span>
        <span className={`soon ${deckReady && g.duelsLeft > 0 ? "live" : ""}`}>{deckReady && g.duelsLeft > 0 ? "Jouer ›" : "›"}</span>
      </button>

      <button className="panel weekcard" onClick={() => openPage("calendar")} aria-label="Ouvrir le calendrier des séances">
        <div className="wk-head">
          <div className="mc-t">Cette semaine</div>
          <span className="link">Calendrier ›</span>
        </div>
        <div className="wk-days">
          {weekDays.map((d, i) => (
            <div key={d} aria-label={`${["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"][i]}${trainSet.has(d) ? " : séance faite" : d > g.day ? "" : d === g.day ? " : aujourd’hui" : " : pas de séance"}`} className={`wk ${trainSet.has(d) ? "on" : ""} ${d === g.day ? "today" : ""} ${d > g.day ? "future" : ""}`}>
              <span>{["L", "M", "M", "J", "V", "S", "D"][i]}</span>
              <i>{trainSet.has(d) ? <svg viewBox="0 0 24 24" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg> : null}</i>
            </div>
          ))}
        </div>
        <div className="mc-s">{weekCount} séance{weekCount > 1 ? "s" : ""} cette semaine</div>
      </button>

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

      {tuto && <Tutorial onClose={() => { setTuto(false); g.finishTutorial(); }} />}

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
