"use client";

import { useState, useSyncExternalStore } from "react";
import { Card } from "@/components/Card";
import { Tutorial } from "@/components/Tutorial";
import type { OpenPage, Tab } from "@/app/page";
import { DAY_LABELS, downloadIcs } from "@/lib/reminder";
import { claimableCount } from "@/lib/progress";
import { GcPill, OddsSheet, Wordmark } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { Sheet } from "@/components/Sheet";
import { IconBack, IconPencil } from "@/components/Icons";
import { LOGIN_CYCLE, PITY_THRESHOLD } from "@/lib/config";
import { completion } from "@/lib/game";
import { readyCount } from "@/lib/grading";
import { recordShort } from "@/lib/duel";
import { getVolume, isMuted, setMuted, setVolume, soundSnapshot, subscribeSound } from "@/lib/sound";
import { daysBetween, streakNow, trainingDays, weekOf } from "@/lib/progress";
import { shareStreak } from "@/lib/share";

export function Profile({ openPage, go }: { openPage: OpenPage; go: (t: Tab) => void }) {
  const g = useGame();
  const p = g.player;
  const comp = completion(p);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(p.name ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [odds, setOdds] = useState(false);
  const [picker, setPicker] = useState(false);
  const [rem, setRem] = useState(false);
  const [tuto, setTuto] = useState(false);
  const [out, setOut] = useState(false);
  const e = g.extra;
  const ready = claimableCount(p, g.day);
  const showcase = e.showcase.map((id) => p.cards.find((c) => c.id === id)).filter((c) => !!c);
  useSyncExternalStore(subscribeSound, soundSnapshot, () => "0:0.50");
  const muted = isMuted();
  const volume = getVolume();
  const cycle = p.loginCount % LOGIN_CYCLE;
  const tops = p.cards.filter((c) => c.rarity === "UR" || c.rarity === "LR").length;
  const graded = p.cards.filter((c) => c.grade).length;
  const gradeReady = readyCount(p, g.gameNow());
  const se = e.season;

  const saveName = () => {
    const e = g.setName(name);
    if (e) { setErr(e); return; }
    setEdit(false); setErr(null);
    g.say("Pseudo mis à jour");
  };

  return (
    <div className="screen">
      <div className="topbar"><Wordmark /><GcPill gc={p.gc} /></div>
      <h1 className="title" style={{ marginTop: 14 }}>Mon profil</h1>

      <div className="namerow">
        <div className="avatar" style={{ width: 84, height: 84, fontSize: 44, borderWidth: 5 }}>{(p.name ?? "?")[0]!.toUpperCase()}</div>
        <div className="nm">{p.name}</div>
        <button className="iconbtn" aria-label="Changer de pseudo" onClick={() => { setName(p.name ?? ""); setEdit(true); }}><IconPencil /></button>
      </div>

      <div className="panel">
        <div className="kv"><span>Séances validées</span><b>{p.sessionsValidated}</b></div>
        <div className="kv"><span>Cartes possédées</span><b>{p.cards.length}</b></div>
        <div className="kv"><span>Collection (uniques)</span><b>{comp.owned} / {comp.total}</b></div>
        <div className="kv"><span>Cartes UR / LR</span><b>{tops}</b></div>
        <div className="kv" style={{ borderBottom: 0 }}><span>Cartes expertisées</span><b>{graded}</b></div>
      </div>

      <Stats />

      <h2 className="section" style={{ fontSize: 24, margin: "16px 0 8px" }}>Ma vitrine</h2>
      <div className="show3">
        {[0, 1, 2].map((i) => showcase[i] ? (
          <button key={i} className="ccell" onClick={() => setPicker(true)} aria-label="Modifier ma vitrine"><Card card={showcase[i]!} /></button>
        ) : (
          <button key={i} className="slotmini bigslot" onClick={() => setPicker(true)} aria-label="Ajouter une carte à ma vitrine">+</button>
        ))}
      </div>
      <div className="code-line">Mon code ami : <b>{e.friendCode}</b></div>

      <div style={{ marginTop: 10 }}>
        <button className="linkrow" onClick={() => openPage("missions")}><span>Missions, série et succès</span><span>{ready > 0 ? <span className="tabbadge" style={{ position: "static", display: "inline-grid" }}>{ready}</span> : "›"}</span></button>
        <button className="linkrow" onClick={() => openPage("calendar")}><span>Calendrier des séances</span><span>›</span></button>
        <button className="linkrow" onClick={() => openPage("friends")}><span>Amis et échanges</span><span>{e.friends.length > 0 ? e.friends.length : "›"}</span></button>
        <button className="linkrow" onClick={() => openPage("atelier")}><span>Atelier de Basile (expertise)</span><span>{gradeReady > 0 ? <span className="tabbadge" style={{ position: "static", display: "inline-grid" }}>{gradeReady}</span> : g.grading.length > 0 ? `${g.grading.length} en cours` : "›"}</span></button>
        <button className="linkrow" onClick={() => setRem(true)}><span>Rappel de séance</span><span>{e.reminder ? `${e.reminder.time}` : "›"}</span></button>
        <button className="linkrow" onClick={() => setTuto(true)}><span>Revoir le tutoriel</span><span>›</span></button>
        <button className="linkrow" onClick={() => { g.resetCombatTuto(); g.say("Le guide reviendra à ton prochain combat"); }}><span>Revoir le guide des combats</span><span>›</span></button>
        <button className="linkrow" onClick={() => setOdds(true)}><span>Taux de drop et garanties</span><span>›</span></button>
      </div>
      <h2 className="section" style={{ fontSize: 24, margin: "16px 0 8px" }}>Réglages</h2>
      <div className="panel settings">
        <div className="set-row">
          <span>Sons du jeu</span>
          <button role="switch" aria-checked={!muted} className={`switch ${!muted ? "on" : ""}`} onClick={() => setMuted(!muted)}><i /></button>
        </div>
        <div className={`set-row ${muted ? "dim" : ""}`} style={{ borderBottom: 0 }}>
          <span>Volume</span>
          <input type="range" min={0} max={100} step={5} value={Math.round(volume * 100)} aria-label="Volume des sons"
            onChange={(ev) => setVolume(Number(ev.target.value) / 100)} onPointerUp={() => setVolume(volume, true)} onKeyUp={() => setVolume(volume, true)} />
          <b>{muted ? "—" : `${Math.round(volume * 100)} %`}</b>
        </div>
      </div>

      <h2 className="section" style={{ fontSize: 24, margin: "16px 0 8px" }}>Compte</h2>
      <div className="panel">
        <div className="kv"><span>{g.account?.email || "Compte test"}</span><b>{g.account?.cloud ? "En ligne" : "Sur cet appareil"}</b></div>
        <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => setOut(true)}>Se déconnecter</button>
      </div>
      <p className="warn">GymDeck est gratuit. Les cartes et les GymCoins n’ont aucune valeur en argent et ne peuvent pas être convertis. {g.account?.cloud ? "Tes progrès sont sauvegardés en ligne." : "Les progrès sont enregistrés sur cet appareil pendant le prototype."}</p>


      {edit && (
        <Sheet onClose={() => setEdit(false)} label="Changer de pseudo">
          <div className="sheet-title">Ton pseudo</div>
          <div className="field">
            <input value={name} maxLength={20} onChange={(e) => { setName(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") saveName(); }} aria-label="Pseudo" autoFocus />
            {err && <span style={{ color: "#ff8a8a", fontSize: 14 }}>{err}</span>}
          </div>
          <button className="btn primary" onClick={saveName}>Enregistrer</button>
          <button className="btn ghost small" onClick={() => setEdit(false)}>Annuler</button>
        </Sheet>
      )}
      {odds && <OddsSheet onClose={() => setOdds(false)} />}
      {tuto && <Tutorial onClose={() => setTuto(false)} />}
      {picker && (
        <Sheet onClose={() => setPicker(false)} variant="full" label="Ma vitrine">
          <div className="fsheet">
            <div className="duel-top">
              <button className="backbtn" aria-label="Retour" onClick={() => setPicker(false)}><IconBack width={22} height={22} /></button>
              <div className="sheet-title" style={{ fontSize: 28 }}>Ma vitrine</div>
              <span />
            </div>
            <p className="fine" style={{ margin: "4px 0 10px" }}>Choisis jusqu’à 3 cartes à montrer à tes amis ({showcase.length} / 3).</p>
            <div className="cgrid four">
              {[...p.cards].sort((a, b) => b.obtainedSeq - a.obtainedSeq).map((c) => (
                <button key={c.id} className={`ccell pick ${e.showcase.includes(c.id) ? "sel" : ""}`} onClick={() => { const r = g.toggleShowcase(c.id); if (r) g.say(r); }}>
                  <Card card={c} holo={false} />
                </button>
              ))}
            </div>
            <div className="stickybar"><button className="btn primary" onClick={() => setPicker(false)}>Terminé ({showcase.length} / 3)</button></div>
          </div>
        </Sheet>
      )}
      {rem && <ReminderSheet onClose={() => setRem(false)} />}
      {out && (
        <Sheet onClose={() => setOut(false)} label="Se déconnecter">
          <div className="sheet-title">Se déconnecter ?</div>
          <p>{g.account?.cloud ? "Ta partie est sauvegardée en ligne : tu la retrouveras en te reconnectant." : "Mode test : ta partie n’est pas sauvegardée en ligne, elle sera effacée de ce téléphone."}</p>
          <button className="btn primary" onClick={() => { void g.signOut(); setOut(false); }}>Oui, me déconnecter</button>
          <button className="btn ghost small" onClick={() => setOut(false)}>Annuler</button>
        </Sheet>
      )}
    </div>
  );
}

function ReminderSheet({ onClose }: { onClose: () => void }) {
  const g = useGame();
  const cur = g.extra.reminder;
  const [days, setDays] = useState<number[]>(cur?.days ?? [0, 2, 4]);
  const [time, setTime] = useState(cur?.time ?? "18:00");
  const toggle = (i: number) => setDays(days.includes(i) ? days.filter((d) => d !== i) : [...days, i].sort());
  return (
    <Sheet onClose={onClose} label="Rappel de séance">
      <div className="sheet-title">Rappel de séance</div>
      <p>Choisis tes jours et ton heure. Tu verras un rappel dans l’appli, et tu peux l’ajouter à ton agenda pour être prévenu même appli fermée.</p>
      <div className="daypick">
        {DAY_LABELS.map((l, i) => <button key={i} className={days.includes(i) ? "on" : ""} aria-pressed={days.includes(i)} onClick={() => toggle(i)}>{l}</button>)}
      </div>
      <div className="field"><label htmlFor="rt">Heure</label><input id="rt" type="time" value={time} onChange={(x) => setTime(x.target.value || "18:00")} /></div>
      <button className="btn primary" disabled={days.length === 0} onClick={() => { g.setReminder({ days, time }); g.say("Rappel enregistré"); onClose(); }}>Enregistrer</button>
      <button className="btn ghost small" disabled={days.length === 0} onClick={() => { downloadIcs(days, time); g.say("Rappel prêt : ouvre le fichier pour l’ajouter à ton agenda"); }}>Ajouter à mon agenda (.ics)</button>
      {cur && <button className="btn ghost small" onClick={() => { g.setReminder(null); g.say("Rappel supprimé"); onClose(); }}>Supprimer le rappel</button>}
    </Sheet>
  );
}


/** Statistiques personnelles : régularité, séries, combats (sans suivi détaillé des séances). */
function Stats() {
  const g = useGame();
  const e = g.extra;
  const p = g.player;
  const [busy, setBusy] = useState(false);
  const days = trainingDays(e);
  const set = new Set(days);
  const wk0 = weekOf(g.day);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(Date.parse(`${wk0}T00:00:00Z`) - (7 - i) * 7 * 86_400_000);
    let n = 0;
    for (let k = 0; k < 7; k++) if (set.has(new Date(start.getTime() + k * 86_400_000).toISOString().slice(0, 10))) n++;
    return { label: `${start.getUTCDate()}/${start.getUTCMonth() + 1}`, n };
  });
  const last30 = days.filter((d) => d <= g.day && daysBetween(d, g.day) < 30).length;
  const avg = weeks.slice(0, 7).reduce((a, w) => a + w.n, 0) / 7; // 7 semaines complètes
  const regular = weeks.slice(0, 7).filter((w) => w.n >= 2).length;
  const won = e.life?.duelWin ?? 0, fought = e.life?.duel ?? 0;
  const defWon = (e.defenses ?? []).filter((d) => d.won).length;
  const max = Math.max(3, ...weeks.map((w) => w.n));
  const streak = streakNow(e, g.day);
  return (
    <>
      <h2 className="section" style={{ fontSize: 24, margin: "16px 0 8px" }}>Mes statistiques</h2>
      <div className="panel stats">
        <div className="st-cap">Séances par semaine</div>
        <div className="st-bars" role="img" aria-label={`Séances des 8 dernières semaines : ${weeks.map((w) => w.n).join(", ")}`}>
          {weeks.map((w, i) => (
            <div key={i} className={i === 7 ? "cur" : ""}>
              <b>{w.n || ""}</b>
              <i style={{ height: `${(w.n / max) * 100}%` }} />
              <span>{i === 7 ? "Cette sem." : w.label}</span>
            </div>
          ))}
        </div>
        <div className="st-grid">
          <div><b>{avg.toFixed(1).replace(".", ",")}</b><span>séances / semaine en moyenne</span></div>
          <div><b>{regular} / 7</b><span>semaines avec 2 séances ou plus</span></div>
          <div><b>{last30}</b><span>séances sur les 30 derniers jours</span></div>
          <div><b>{e.streak?.best ?? 0}</b><span>meilleure série</span></div>
          <div><b>{fought ? Math.round((won / fought) * 100) : 0} %</b><span>combats gagnés ({won} / {fought})</span></div>
          <div><b>{defWon}</b><span>attaques repoussées</span></div>
        </div>
        <button className="btn ghost small" disabled={busy || streak < 1} onClick={async () => {
          setBusy(true);
          g.say(await shareStreak({ days: streak, sessions: p.sessionsValidated, name: p.name ?? "Joueur" }));
          setBusy(false);
        }}>{busy ? "Création de l’image…" : streak > 0 ? `Partager ma série (${streak})` : "Partager ma série (valide une séance)"}</button>
      </div>
    </>
  );
}
