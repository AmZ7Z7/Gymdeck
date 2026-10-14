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
import { LOGIN_CYCLE, PITY_THRESHOLD } from "@/lib/config";
import { completion } from "@/lib/game";
import { readyCount } from "@/lib/grading";
import { recordShort } from "@/lib/duel";
import { getLevel, setLevel, subscribeSound, type SoundLevel } from "@/lib/sound";

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
  const level = useSyncExternalStore(subscribeSound, getLevel, () => "low" as SoundLevel);
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
        <button className="iconbtn" aria-label="Changer de pseudo" onClick={() => { setName(p.name ?? ""); setEdit(true); }}>✎</button>
      </div>

      <div className="panel">
        <div className="kv"><span>Séances validées</span><b>{p.sessionsValidated}</b></div>
        <div className="kv"><span>Cartes possédées</span><b>{p.cards.length}</b></div>
        <div className="kv"><span>Collection (uniques)</span><b>{comp.owned} / {comp.total}</b></div>
        <div className="kv"><span>Cartes UR / LR</span><b>{tops}</b></div>
        <div className="kv"><span>Cartes expertisées</span><b>{graded}</b></div>
        <div className="kv"><span>Duels de la saison (victoires · défaites)</span><b>{recordShort(se)}</b></div>
        <div className="kv"><span>Connexions (cycle de {LOGIN_CYCLE})</span><b>{cycle} / {LOGIN_CYCLE}</b></div>
        <div className="kv" style={{ borderBottom: 0 }}><span>Boosters depuis la dernière UR/LR</span><b>{p.pityCounter} / {PITY_THRESHOLD - 1}</b></div>
      </div>

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
        <button className="linkrow" onClick={() => go("combats")}><span>Combats et classement de saison</span><span>›</span></button>
        <button className="linkrow" onClick={() => openPage("atelier")}><span>Atelier de Basile (expertise)</span><span>{gradeReady > 0 ? <span className="tabbadge" style={{ position: "static", display: "inline-grid" }}>{gradeReady}</span> : g.grading.length > 0 ? `${g.grading.length} en cours` : "›"}</span></button>
        <button className="linkrow" onClick={() => setRem(true)}><span>Rappel de séance</span><span>{e.reminder ? `${e.reminder.time}` : "›"}</span></button>
        <button className="linkrow" onClick={() => setTuto(true)}><span>Revoir le tutoriel</span><span>›</span></button>
        <button className="linkrow" onClick={() => setLevel(level === "off" ? "low" : level === "low" ? "on" : "off")}><span>Sons du jeu</span><span>{level === "off" ? "Coupés" : level === "low" ? "Doux" : "Normal"}</span></button>
        <button className="linkrow" onClick={() => setOdds(true)}><span>Taux de drop et garanties</span><span>›</span></button>
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
            <div className="sheet-title" style={{ fontSize: 28 }}>Ma vitrine</div>
            <p className="fine" style={{ margin: "4px 0 10px" }}>Choisis jusqu’à 3 cartes à montrer à tes amis ({showcase.length} / 3).</p>
            <div className="cgrid four">
              {[...p.cards].sort((a, b) => b.obtainedSeq - a.obtainedSeq).map((c) => (
                <button key={c.id} className={`ccell pick ${e.showcase.includes(c.id) ? "sel" : ""}`} onClick={() => { const r = g.toggleShowcase(c.id); if (r) g.say(r); }}>
                  <Card card={c} holo={false} />
                </button>
              ))}
            </div>
            <button className="btn primary" style={{ marginTop: 14 }} onClick={() => setPicker(false)}>Terminé</button>
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

