"use client";

import { useState } from "react";
import { GcPill, OddsSheet, Wordmark } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { IconBack, IconCart } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import { LOGIN_CYCLE, PITY_THRESHOLD } from "@/lib/config";
import { completion } from "@/lib/game";

export function Market({ back }: { back: () => void }) {
  return (
    <div className="screen">
      <div className="topbar"><Wordmark /></div>
      <h1 className="title" style={{ marginTop: 14 }}>Marché</h1>
      <div className="soon-screen" style={{ height: "45%" }}>
        <div>
          <IconCart width={150} height={150} style={{ color: "#6e788f" }} />
          <div className="soon" style={{ display: "inline-block", marginTop: 20, fontSize: 20 }}>Bientôt disponible</div>
          <p style={{ color: "#e4e9f8", fontSize: 20, marginTop: 18 }}>Échange tes cartes avec les autres joueurs.</p>
        </div>
      </div>
      <button className="btn ghost" onClick={back}><IconBack width={22} height={22} /> Retour à la boutique</button>
    </div>
  );
}

export function Profile() {
  const g = useGame();
  const p = g.player;
  const comp = completion(p);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(p.name ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [odds, setOdds] = useState(false);
  const [resetAsk, setResetAsk] = useState(false);
  const cycle = p.loginCount % LOGIN_CYCLE;
  const tops = p.cards.filter((c) => c.rarity === "UR" || c.rarity === "LR").length;

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
        <div className="kv"><span>Connexions (cycle de {LOGIN_CYCLE})</span><b>{cycle} / {LOGIN_CYCLE}</b></div>
        <div className="kv" style={{ borderBottom: 0 }}><span>Boosters depuis la dernière UR/LR</span><b>{p.pityCounter} / {PITY_THRESHOLD - 1}</b></div>
      </div>

      <div style={{ marginTop: 10 }}>
        <button className="linkrow" onClick={() => setOdds(true)}><span>Taux de drop et garanties</span><span>›</span></button>
      </div>
      <p className="warn">GymDeck est gratuit. Les cartes et les GymCoins n’ont aucune valeur en argent et ne peuvent pas être convertis. Les progrès sont enregistrés sur cet appareil pendant le prototype.</p>

      <details className="tools">
        <summary>Outils de test</summary>
        <div className="panel" style={{ display: "grid", gap: 10 }}>
          <button className="btn ghost small" onClick={() => { g.tools.nextDay(); g.say("Nouveau jour simulé"); }}>Simuler le jour suivant</button>
          <button className="btn ghost small" onClick={() => { g.tools.addGc(75); g.say("+75 GC"); }}>+75 GC</button>
          <button className="btn ghost small" onClick={() => setResetAsk(true)}>Tout réinitialiser</button>
        </div>
        <p className="warn">Ces outils n’existent que dans le prototype.</p>
      </details>

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
      {resetAsk && (
        <Sheet onClose={() => setResetAsk(false)} label="Tout réinitialiser">
          <div className="sheet-title">Tout effacer ?</div>
          <p>Cartes, GC, boosters et deck seront remis à zéro, avec les 2 boosters de bienvenue.</p>
          <button className="btn primary" onClick={() => { g.tools.reset(); setResetAsk(false); g.say("Prototype réinitialisé"); }}>Oui, tout effacer</button>
          <button className="btn ghost small" onClick={() => setResetAsk(false)}>Annuler</button>
        </Sheet>
      )}
    </div>
  );
}
