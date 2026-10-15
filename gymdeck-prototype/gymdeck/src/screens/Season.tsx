"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/Card";
import { GcPill, Wordmark } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { IconBack, IconCheck, IconClock, IconDumbbell, IconLock, IconNext, IconUsers, IconCombat } from "@/components/Icons";
import { PASS, PASS_REWARDS, type PassReward } from "@/lib/config";
import { challengeState, dailyMissions, missionProgress, passClaimable, passLevel, passOf, seasonEndsIn, seasonOf, type MissionDef } from "@/lib/progress";
import { sfx } from "@/lib/sound";
import { Row } from "./Missions";

/** Numéro de saison : octobre 2026 = saison 01 (une saison par mois). */
export function seasonNumber(day: string): string {
  const [y, m] = seasonOf(day).split("-").map(Number) as [number, number];
  const n = Math.max(1, (y - 2026) * 12 + (m - 10) + 1);
  return String(n).padStart(2, "0");
}

const fmt = (n: number) => n.toLocaleString("fr-FR");

function RewardArt({ r }: { r: PassReward }) {
  if (r.boosters >= 2) return <div className="rart two"><img src="/assets/ui/booster.webp" alt="" /><img src="/assets/ui/booster.webp" alt="" /></div>;
  if (r.boosters === 1) return <div className="rart one"><img src="/assets/ui/booster.webp" alt="" /></div>;
  return <div className="rart coins"><i /><i /><i /><i /><i /></div>;
}
const rewardLabel = (r: PassReward) => (r.boosters ? `${r.boosters} booster${r.boosters > 1 ? "s" : ""}` : `${r.gc} GC`);

type PTab = "rewards" | "missions";

export function Season({ back, openMissions }: { back: () => void; openMissions: () => void }) {
  const g = useGame();
  const [tab, setTab] = useState<PTab>("rewards");
  const e = g.extra;
  const p = passOf(e, g.day);
  const { level, inTier, max } = passLevel(p.xp);
  const avail = passClaimable(e, g.day);
  const days = seasonEndsIn(g.day);
  const track = useRef<HTMLDivElement>(null);

  // le parcours s'ouvre sur le palier en cours
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const target = Math.max(0, Math.min(PASS.tiers - 1, (avail[0] ?? level + 1) - 1) - 1);
    el.scrollLeft = target * 112;
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const claim = (tier?: number) => {
    const r = g.claimPass(tier);
    if ("error" in r) { g.say(r.error); return; }
    sfx.coin();
    const parts = [r.gc ? `+${r.gc} GC` : "", r.boosters ? `${r.boosters} booster${r.boosters > 1 ? "s" : ""} (à ouvrir depuis l’accueil)` : ""].filter(Boolean);
    g.say(parts.join(" et "));
  };

  const ring = 2 * Math.PI * 34;
  const frac = max ? 1 : inTier / PASS.perTier;
  const sessionDone = g.sessionDoneToday;

  return (
    <div className="screen season">
      <div className="topbar">
        <button className="backbtn" aria-label="Retour" onClick={back}><IconBack width={22} height={22} /></button>
        <Wordmark />
        <GcPill gc={g.player.gc} />
      </div>

      <div className="pbanner">
        <div className="pb-txt">
          <span className="pb-tag">Saison {seasonNumber(g.day)}</span>
          <h1>Passe de <em>saison</em></h1>
          <p>Chaque séance te fait avancer.</p>
          <span className="pb-days"><IconClock width={16} height={16} /> {days} jour{days > 1 ? "s" : ""} restant{days > 1 ? "s" : ""}</span>
        </div>
        <div className="pb-art" aria-hidden>
          <div className="pb-card"><Card card={{ exerciseSlug: "developpe-militaire-halteres", rarity: "SSR", atq: 742, def: 701, passive: null }} holo={false} cap={false} /></div>
          <img className="pb-booster" src="/assets/ui/booster.webp" alt="" />
          <span className="pb-coin" />
        </div>
      </div>

      <div className="ptabs" role="tablist">
        <button role="tab" aria-selected={tab === "rewards"} className={tab === "rewards" ? "on" : ""} onClick={() => setTab("rewards")}>Récompenses{avail.length > 0 && <i>{avail.length}</i>}</button>
        <button role="tab" aria-selected={tab === "missions"} className={tab === "missions" ? "on" : ""} onClick={() => setTab("missions")}>Missions</button>
      </div>

      <div className="panel plevel">
        <svg className="pring" viewBox="0 0 80 80" aria-hidden>
          <circle cx="40" cy="40" r="34" className="bg" />
          <circle cx="40" cy="40" r="34" className="fg" strokeDasharray={ring} strokeDashoffset={ring * (1 - frac)} />
          <text x="40" y="48" textAnchor="middle">{level}</text>
        </svg>
        <div className="pl-mid">
          <div className="pl-top"><b>Niveau {level}</b><span>{max ? "Passe terminé !" : <>{inTier} / {PASS.perTier} <small>pts</small></>}</span></div>
          <div className="pl-bar"><motion.i initial={{ width: 0 }} animate={{ width: `${frac * 100}%` }} transition={{ duration: 0.8, ease: "easeOut" }} /></div>
          <small>{max ? `${fmt(p.xp)} points cette saison` : `Prochain palier : niveau ${level + 1}`}</small>
        </div>
      </div>

      {tab === "rewards" ? (
        <>
          <div className="panel ptrackp">
            <div className="pt-head"><h2>Parcours de récompenses</h2><span>{PASS.tiers} paliers</span></div>
            <div className="ptrack" ref={track}>
              {PASS_REWARDS.map((r) => {
                const claimed = p.claimed.includes(r.tier);
                const ok = r.tier <= level;
                const state = claimed ? "claimed" : ok ? "avail" : "locked";
                return (
                  <div key={r.tier} className={`ptier ${state} ${r.tier === level + 1 ? "next" : ""} ${r.boosters ? "bst" : ""}`}>
                    <span className={`pt-line l ${r.tier <= level ? "on" : ""}`} /><span className={`pt-line r ${r.tier < level ? "on" : ""}`} />
                    <span className="pt-num">{r.tier}</span>
                    <RewardArt r={r} />
                    <div className="pt-lab">{rewardLabel(r)}</div>
                    <div className="pt-foot">
                      {state === "claimed" && <span className="got"><IconCheck width={18} height={18} /> Récupéré</span>}
                      {state === "avail" && <button className="pt-avail" onClick={() => claim(r.tier)}>Disponible</button>}
                      {state === "locked" && <IconLock width={18} height={18} />}
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="pt-arrow" aria-label="Paliers suivants" onClick={() => track.current?.scrollBy({ left: 336, behavior: "smooth" })}><IconNext width={20} height={20} /></button>
            <button className="btn primary pclaim" disabled={!avail.length} onClick={() => claim()}>
              {avail.length ? `Récupérer${avail.length > 1 ? ` (${avail.length})` : ""}` : "Rien à récupérer"}
            </button>
          </div>

          <div className="pfinal">
            <div>
              <span className="pf-tag">Récompense finale · niveau 30</span>
              <b>2 boosters</b>
              <small>Pour celles et ceux qui ne lâchent rien.</small>
            </div>
            <div className="rart two big"><img src="/assets/ui/booster.webp" alt="" /><img src="/assets/ui/booster.webp" alt="" /></div>
          </div>

          <button className="panel pday" onClick={() => setTab("missions")}>
            <span className="pd-cap">Mission du jour</span>
            <span className="pd-ico"><IconDumbbell /></span>
            <span className="pd-t"><b>Valider une séance</b><em>+{PASS.session} pts</em></span>
            <span className="pd-p"><small>{sessionDone ? 1 : 0} / 1</small><span className="progress thin"><i style={{ width: sessionDone ? "100%" : "0%" }} /></span></span>
            <IconNext width={20} height={20} />
          </button>
        </>
      ) : (
        <PassMissions openMissions={openMissions} />
      )}
      <p className="warn">Le passe change chaque mois. Les paliers non récupérés à la fin du mois sont perdus. Les GC et les cartes ne s’échangent jamais contre de l’argent.</p>
    </div>
  );
}

function PassMissions({ openMissions }: { openMissions: () => void }) {
  const g = useGame();
  const e = g.extra;
  const ch = challengeState(e, g.day, g.gameNow());
  const daily = dailyMissions(g.day);
  const claim = (m: MissionDef) => {
    const r = g.claimMission("daily", m.id);
    if (typeof r === "number") { sfx.coin(); g.say(`+${r} GC et +${PASS.dailyMission} pts de passe`); } else g.say(r);
  };
  const SOURCES: { ico: React.ReactNode; t: string; v: number }[] = [
    { ico: <IconDumbbell />, t: "Séance validée", v: PASS.session },
    { ico: <IconCheck />, t: "Mission du jour récupérée", v: PASS.dailyMission },
    { ico: <IconCombat />, t: "Combat gagné", v: PASS.duelWin },
    { ico: <IconCombat />, t: "Combat perdu", v: PASS.duelLoss },
    { ico: <IconUsers />, t: "Défi de la semaine réussi", v: PASS.weeklyChallenge },
  ];
  return (
    <>
      <div className="panel pchal">
        <div className="pc-head"><IconUsers /><div><span>Défi de la semaine · tous ensemble</span><b>{ch.challenge.label}</b></div></div>
        <div className="pc-bar"><motion.i initial={{ width: 0 }} animate={{ width: `${(ch.value / ch.challenge.target) * 100}%` }} transition={{ duration: 0.9 }} /></div>
        <div className="pc-nums"><b>{fmt(ch.value)}</b> / {fmt(ch.challenge.target)} {ch.challenge.unit}</div>
        <div className="pc-me">{ch.mine > 0 ? <>Ta participation : <b>{ch.mine}</b></> : ch.challenge.mine}</div>
        <div className="pc-foot">
          <span>Récompense pour chaque participant : <b>+{ch.reward.xp} pts</b> et <b>+{ch.reward.gc} GC</b></span>
          {ch.claimed ? <span className="mdone"><IconCheck width={18} height={18} /></span> : (
            <button className={`btn chipbtn ${ch.claimable ? "primary" : "ghost"}`} disabled={!ch.claimable} onClick={() => {
              const r = g.claimChallenge();
              if ("error" in r) g.say(r.error); else { sfx.coin(); g.say(`+${r.gc} GC et +${r.xp} pts de passe`); }
            }}>{ch.done ? "Récupérer" : "En cours"}</button>
          )}
        </div>
      </div>

      <h2 className="section" style={{ fontSize: 24, margin: "16px 0 8px" }}>Missions du jour</h2>
      {daily.map((m) => {
        const pr = missionProgress(e, "daily", m);
        return <Row key={m.id} label={m.label} sub={`+${PASS.dailyMission} pts de passe`} value={pr.value} target={m.target} reward={m.reward} done={pr.done} claimed={pr.claimed} onClaim={() => claim(m)} />;
      })}
      <button className="link" style={{ display: "block", margin: "4px auto 0" }} onClick={openMissions}>Toutes les missions, la série et les succès ›</button>

      <h2 className="section" style={{ fontSize: 24, margin: "16px 0 8px" }}>Gagner des points</h2>
      <div className="panel psources">
        {SOURCES.map((s) => <div key={s.t}><span className="ps-i">{s.ico}</span><span>{s.t}</span><b>+{s.v}</b></div>)}
        <small>{PASS.perTier} points par palier. Avec une séance par jour, on finit le passe en un mois.</small>
      </div>
    </>
  );
}

