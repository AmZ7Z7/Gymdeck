"use client";

import { useMemo, useState } from "react";
import { GcPill, Wordmark } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { IconBack, IconChevron } from "@/components/Icons";
import { CALENDAR_MAX_PAST_DAYS, daysBetween, monthStats, trainingDays } from "@/lib/progress";

const WEEK = ["L", "M", "M", "J", "V", "S", "D"];
const pad = (n: number) => String(n).padStart(2, "0");
const monthLabel = (m: string) => {
  const s = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const shiftMonth = (m: string, d: number) => {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  const dt = new Date(Date.UTC(y, mo - 1 + d, 1));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}`;
};

/** Calendrier de suivi : les jours où tu es allé à la salle. */
export function Calendar({ back }: { back: () => void }) {
  const g = useGame();
  const today = g.day;
  const e = g.extra;
  const [month, setMonth] = useState(today.slice(0, 7));
  const validated = useMemo(() => new Set(e.history ?? []), [e.history]);
  const declared = useMemo(() => new Set(e.declared ?? []), [e.declared]);
  const stats = monthStats(e, month);
  const total = trainingDays(e).length;

  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number) as [number, number];
    const first = new Date(Date.UTC(y, m - 1, 1));
    const lead = (first.getUTCDay() + 6) % 7; // lundi = 0
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return [...Array.from({ length: lead }, () => null), ...Array.from({ length: dim }, (_, i) => `${month}-${pad(i + 1)}`)];
  }, [month]);

  const canPrev = daysBetween(`${shiftMonth(month, -1)}-28`, today) <= CALENDAR_MAX_PAST_DAYS;
  const canNext = month < today.slice(0, 7);

  const tap = (d: string) => {
    if (validated.has(d)) { g.say("Séance validée dans l’app ✓"); return; }
    const err = g.toggleTrainingDay(d);
    if (err) g.say(err);
    else g.say(declared.has(d) ? "Jour retiré" : "Jour ajouté au calendrier");
  };

  return (
    <div className="screen">
      <div className="topbar">
        <button className="backbtn" aria-label="Retour" onClick={back}><IconBack width={22} height={22} /></button>
        <Wordmark />
        <GcPill gc={g.player.gc} />
      </div>
      <h1 className="title" style={{ marginTop: 14, marginBottom: 4 }}>Calendrier</h1>
      <div style={{ color: "#cfd6e8", fontSize: 15, marginBottom: 12 }}>Suis les jours où tu es allé à la salle</div>

      <div className="calstats">
        <div><b>{stats.count}</b><span>ce mois</span></div>
        <div><b>{stats.best}</b><span>jours d’affilée</span></div>
        <div><b>{e.streak.current}</b><span>série en cours</span></div>
        <div><b>{total}</b><span>au total</span></div>
      </div>

      <div className="panel calpanel">
        <div className="calhead">
          <button className="calnav" aria-label="Mois précédent" disabled={!canPrev} onClick={() => setMonth(shiftMonth(month, -1))}><IconBack width={20} height={20} /></button>
          <div className="calmonth">{monthLabel(month)}</div>
          <button className="calnav" aria-label="Mois suivant" disabled={!canNext} onClick={() => setMonth(shiftMonth(month, 1))}><IconChevron width={20} height={20} /></button>
        </div>
        <div className="calgrid calweek">{WEEK.map((w, i) => <span key={i}>{w}</span>)}</div>
        <div className="calgrid">
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const future = d > today;
            const v = validated.has(d), m = declared.has(d);
            return (
              <button
                key={d}
                className={`calday ${v ? "done" : m ? "manual" : ""} ${d === today ? "today" : ""}`}
                disabled={future}
                onClick={() => tap(d)}
                aria-label={`${Number(d.slice(8))} ${monthLabel(month)}${v ? ", séance validée" : m ? ", ajouté à la main" : ""}`}
                aria-pressed={v || m}
              >
                <span>{Number(d.slice(8))}</span>
                {(v || m) && <svg viewBox="0 0 24 24" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="callegend">
        <span><i className="lg done" />Séance validée dans l’app</span>
        <span><i className="lg manual" />Ajouté à la main</span>
      </div>
      <p className="warn">Touche un jour passé pour le cocher ou le décocher. Seules les séances validées dans l’app donnent un booster, comptent pour la série et les missions : les jours ajoutés à la main servent uniquement à ton suivi.</p>
    </div>
  );
}
