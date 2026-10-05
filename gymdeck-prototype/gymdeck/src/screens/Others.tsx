"use client";

import { DEMO_NAME, GcPill, Wordmark } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { IconBack, IconCart } from "@/components/Icons";
import { LOGIN_CYCLE } from "@/lib/config";

export function GymDeckTab() {
  const g = useGame();
  return (
    <div className="screen">
      <div className="topbar"><Wordmark /><GcPill gc={g.player.gc} /></div>
      <h1 className="title" style={{ marginTop: 14 }}>Mon GymDeck</h1>
      <div className="soon-screen"><div>Le choix des 5 cartes de ton deck arrive à la prochaine étape.</div></div>
    </div>
  );
}

export function Market({ back }: { back: () => void }) {
  return (
    <div className="screen">
      <div className="topbar"><Wordmark /></div>
      <h1 className="title" style={{ marginTop: 14 }}>Marché</h1>
      <div className="soon-screen" style={{ height: "45%" }}>
        <div>
          <IconCart width={150} height={150} style={{ color: "#6e788f" }} />
          <div className="soon" style={{ display: "inline-block", marginTop: 20, fontSize: 20 }}>Bientôt disponible</div>
          <p style={{ color: "#e4e9f8", fontSize: 20, marginTop: 18 }}>Achète, vends et échange tes cartes avec les autres joueurs.</p>
        </div>
      </div>
      <button className="btn ghost" onClick={back}><IconBack width={22} height={22} /> Retour à la boutique</button>
    </div>
  );
}

export function Profile() {
  const g = useGame();
  const p = g.player;
  const cycle = p.loginCount % LOGIN_CYCLE;
  return (
    <div className="screen">
      <div className="topbar"><Wordmark /></div>
      <h1 className="title" style={{ marginTop: 14 }}>Mon profil</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div className="avatar" style={{ width: 84, height: 84, fontSize: 44, borderWidth: 5 }}>{DEMO_NAME[0]}</div>
        <div className="display" style={{ fontSize: 40 }}>{DEMO_NAME}</div>
      </div>
      <div className="panel">
        <div className="kv"><span>Séances validées</span><b>{p.sessionsValidated}</b></div>
        <div className="kv"><span>Cartes possédées</span><b>{p.cards.length}</b></div>
        <div className="kv"><span>Connexions (cycle de {LOGIN_CYCLE})</span><b>{cycle} / {LOGIN_CYCLE}</b></div>
        <div className="kv" style={{ borderBottom: 0 }}><span>Boosters depuis la dernière UR/LR</span><b>{p.pityCounter} / 11</b></div>
      </div>

      <div className="row-head"><h2 className="section" style={{ fontSize: 24, color: "var(--muted)" }}>Outils de test</h2></div>
      <div className="panel" style={{ display: "grid", gap: 10 }}>
        <button className="btn ghost small" onClick={() => { g.tools.nextDay(); g.say("Nouveau jour simulé"); }}>Simuler le jour suivant</button>
        <button className="btn ghost small" onClick={() => { g.tools.addGc(75); g.say("+75 GC"); }}>+75 GC</button>
        <button className="btn ghost small" onClick={() => { g.tools.reset(); g.say("Prototype réinitialisé"); }}>Tout réinitialiser</button>
      </div>
      <p className="warn">Ces outils n’existent que dans le prototype : les sauvegardes sont locales à ce téléphone et disparaîtront à la mise en ligne du vrai compte.</p>
    </div>
  );
}
