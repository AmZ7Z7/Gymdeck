"use client";

import { useState } from "react";
import { GcPill, Wordmark } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { GroupIcon, IconBack, IconFlame } from "@/components/Icons";
import { GROUPS, RARITIES, RARITY_COLOR } from "@/lib/config";
import {
  ACHIEVEMENTS, SET_TIERS, STREAK_MILESTONES, WEEKLY, dailyMissions, groupCompletion, groupExercises, missionProgress, setProgress, setReward, streakNow,
  type MissionDef,
} from "@/lib/progress";
import { sfx } from "@/lib/sound";

type Tab = "missions" | "streak" | "ach";

const Coin = ({ s = 16 }: { s?: number }) => <span className="coin" style={{ width: s, height: s, display: "inline-block", verticalAlign: "-3px", marginRight: 4 }} />;

export function Row({ label, sub, value, target, reward, done, claimed, onClaim }: {
  label: string; sub?: string; value: number; target: number; reward: number; done: boolean; claimed: boolean; onClaim: () => void;
}) {
  return (
    <div className={`mrow ${claimed ? "claimed" : ""}`}>
      <div className="mt">
        <div className="ml">{label}</div>
        {sub && <div className="ms">{sub}</div>}
        <div className="progress thin"><i style={{ width: `${Math.min(100, (value / target) * 100)}%` }} /></div>
        <div className="mc">{value} / {target}</div>
      </div>
      {claimed ? <span className="mdone">✓</span> : (
        <button className={`btn chipbtn ${done ? "primary" : "ghost"}`} disabled={!done} onClick={onClaim}><Coin s={18} />+{reward}</button>
      )}
    </div>
  );
}

export function Missions({ back }: { back: () => void }) {
  const g = useGame();
  const [tab, setTab] = useState<Tab>("missions");
  const e = g.extra;
  const daily = dailyMissions(g.day);
  const streak = streakNow(e, g.day);

  const claim = (r: number | string) => {
    if (typeof r === "number") { sfx.coin(); g.say(`+${r} GC`); } else g.say(r);
  };
  const mRow = (scope: "daily" | "weekly", m: MissionDef) => {
    const p = missionProgress(e, scope, m);
    return <Row key={m.id} label={m.label} value={p.value} target={m.target} reward={m.reward} done={p.done} claimed={p.claimed} onClaim={() => claim(g.claimMission(scope, m.id))} />;
  };

  return (
    <div className="screen">
      <div className="topbar">
        <button className="backbtn" aria-label="Retour" onClick={back}><IconBack width={22} height={22} /></button>
        <Wordmark />
        <GcPill gc={g.player.gc} />
      </div>
      <h1 className="title" style={{ marginTop: 14, marginBottom: 10 }}>Objectifs</h1>
      <div className="seg three">
        <button className={tab === "missions" ? "on" : ""} onClick={() => setTab("missions")}>Missions</button>
        <button className={tab === "streak" ? "on" : ""} onClick={() => setTab("streak")}>Série</button>
        <button className={tab === "ach" ? "on" : ""} onClick={() => setTab("ach")}>Succès</button>
      </div>

      {tab === "missions" && (
        <>
          <h2 className="section" style={{ fontSize: 24, margin: "6px 0 8px" }}>Aujourd’hui</h2>
          {daily.map((m) => mRow("daily", m))}
          <h2 className="section" style={{ fontSize: 24, margin: "16px 0 8px" }}>Cette semaine</h2>
          {WEEKLY.map((m) => mRow("weekly", m))}
          <p className="warn">Les missions du jour changent à minuit (heure de Paris), celles de la semaine le lundi.</p>
        </>
      )}

      {tab === "streak" && (
        <>
          <div className="panel streakhero">
            <div className="flame" aria-hidden><IconFlame /></div>
            <div className="big">{streak}</div>
            <div className="lab">{streak > 1 ? "séances d’affilée" : "séance d’affilée"}</div>
            <div className="sub">Record : {e.streak.best} · 1 jour de repos autorisé entre deux séances</div>
          </div>
          <h2 className="section" style={{ fontSize: 24, margin: "16px 0 8px" }}>Paliers</h2>
          {STREAK_MILESTONES.map((m) => (
            <Row key={m.days} label={`${m.days} séances d’affilée`} value={Math.min(streak, m.days)} target={m.days} reward={m.reward}
              done={streak >= m.days} claimed={e.streak.claimed.includes(m.days)} onClaim={() => claim(g.claimStreak(m.days))} />
          ))}
          <p className="warn">Si tu laisses passer plus d’un jour de repos, la série repart de zéro et les paliers se renouvellent.</p>
        </>
      )}

      {tab === "ach" && (
        <>
          {ACHIEVEMENTS.map((a) => {
            const v = Math.min(a.target, a.value(g.player));
            return <Row key={a.id} label={a.name} sub={a.desc} value={v} target={a.target} reward={a.reward} done={v >= a.target}
              claimed={e.achClaimed.includes(a.id)} onClaim={() => claim(g.claimAchievement(a.id))} />;
          })}
        </>
      )}
    </div>
  );
}

/** Extensions : une série par groupe musculaire, avec paliers de récompense. */
export function Extensions() {
  const g = useGame();
  const e = g.extra;
  const [open, setOpen] = useState<string | null>(GROUPS[0]!.id);
  return (
    <div style={{ marginTop: 6 }}>
      {GROUPS.map((gr) => {
        const comp = groupCompletion(g.player, gr.id);
        const ex = groupExercises(gr.id);
        const isOpen = open === gr.id;
        const ready = SET_TIERS.filter((t) => !e.setsClaimed.includes(`${gr.id}:${t.id}`) && setProgress(g.player, gr.id, t.minRarity).done).length;
        return (
          <div className="panel ext" key={gr.id}>
            <button className="exthead" onClick={() => setOpen(isOpen ? null : gr.id)} aria-expanded={isOpen}>
              <span className="emo" aria-hidden><GroupIcon id={gr.id} /></span>
              <span className="en">{gr.name}<small>{ex.length} exercice{ex.length > 1 ? "s" : ""} · {comp.owned} / {comp.total} cartes</small></span>
              {ready > 0 && <span className="tabbadge" style={{ position: "static" }}>{ready}</span>}
              <span className="chev">{isOpen ? "▾" : "▸"}</span>
            </button>
            <div className="progress thin"><i style={{ width: `${(comp.owned / comp.total) * 100}%` }} /></div>
            {isOpen && (
              <>
                {ex.map((x) => {
                  const mine = g.player.cards.filter((c) => c.exerciseSlug === x.slug);
                  return (
                    <div className="exrow" key={x.slug}>
                      <span className="exn">{x.name}</span>
                      <span className="exr">
                        {RARITIES.map((r) => (
                          <i key={r} className={mine.some((c) => c.rarity === r) ? "on" : ""} style={{ ["--c" as string]: RARITY_COLOR[r] }}>{r}</i>
                        ))}
                      </span>
                    </div>
                  );
                })}
                {SET_TIERS.map((t) => {
                  const p = setProgress(g.player, gr.id, t.minRarity);
                  const claimed = e.setsClaimed.includes(`${gr.id}:${t.id}`);
                  return (
                    <Row key={t.id} label={t.label} sub={`${t.perExercise} GC × ${ex.length} exercice${ex.length > 1 ? "s" : ""}`} value={p.have} target={p.total} reward={setReward(gr.id, t)} done={p.done} claimed={claimed}
                      onClaim={() => { const r = g.claimSet(gr.id, t.id); if (typeof r === "number") { sfx.coin(); g.say(`Extension ${gr.name} : +${r} GC`); } else g.say(r); }} />
                  );
                })}
              </>
            )}
          </div>
        );
      })}
      <p className="warn">Chaque exercice du groupe rapporte des GC.</p>
    </div>
  );
}

