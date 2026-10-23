"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useGame } from "@/components/GameProvider";
import { LegalLinks } from "@/components/LegalPage";
import { CardFX } from "@/components/CardFX";
import type { CardData } from "@/lib/engine";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Éventail de l'accueil : une rare, une très rare et une légendaire (décor, ne donne aucune carte). */
const FAN: CardData[] = [
  { exerciseSlug: "squat", rarity: "SR", atq: 468, def: 431, passive: null },
  { exerciseSlug: "leg-extension", rarity: "LR", atq: 1560, def: 1490, passive: { type: "BOTH", atqTenths: 31, defTenths: 29 } },
  { exerciseSlug: "gainage", rarity: "SSR", atq: 742, def: 688, passive: null },
];

/** Première arrivée : création de compte (ou connexion), puis ouverture directe du premier booster. */
export function Onboarding() {
  const g = useGame();
  const cloud = g.cloudEnabled;
  const [mode, setMode] = useState<"create" | "login">("create");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const create = mode === "create";
  const ctaRef = useRef<HTMLParagraphElement>(null);
  // retour du booster invité : on descend directement au formulaire
  useEffect(() => { if (g.guestCards > 0) ctaRef.current?.scrollIntoView({ block: "start" }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setErr(null); setInfo(null);
    if (create && name.trim().length < 2) { setErr("Ton pseudo doit faire au moins 2 caractères."); return; }
    if (!EMAIL.test(email.trim())) { setErr("Adresse e-mail invalide."); return; }
    if (pw.length < 8) { setErr("Mot de passe : 8 caractères minimum."); return; }
    setBusy(true);
    try {
      if (!cloud) {
        // Mode test : rien ne quitte ton téléphone et le mot de passe n'est pas enregistré.
        const e = g.localStart(email, name);
        if (e) setErr(e); else g.openFirstBooster();
        return;
      }
      const e = create ? await g.signUp(email, pw, name) : await g.signIn(email, pw);
      if (e === "confirm") { setInfo("Compte créé ! Clique sur le lien reçu par e-mail, puis reviens te connecter."); setMode("login"); return; }
      if (e) { setErr(e); return; }
      // un joueur qui se reconnecte arrive sur l'accueil : on n'ouvre pas un de ses boosters à sa place
      if (create) g.openFirstBooster();
    } finally { setBusy(false); }
  };

  const forgot = async () => {
    if (!EMAIL.test(email.trim())) { setErr("Entre ton e-mail ci-dessus d’abord."); return; }
    const e = await g.resetPassword(email);
    if (e) setErr(e); else setInfo("E-mail envoyé : suis le lien pour choisir un nouveau mot de passe.");
  };

  return (
    <motion.div className="onboard" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <img className="logohero wm" src="/assets/ui/wordmark.webp" alt="GymDeck" draggable={false} />
      <h1>Ta séance,<br />ton booster.</h1>
      <p className="obsub">Le jeu de cartes à collectionner de la muscu.</p>
      {/* téléphone : un éventail de vraies cartes (sur grand écran, la vitrine à droite les montre déjà) */}
      <div className="obfan" aria-hidden>
        {FAN.map((c, i) => <div key={c.rarity} className={`obfan-c obfan-${i}`}><CardFX card={c} tilt={false} /></div>)}
      </div>
      <div className="steps3">
        <div><b>1</b><span>Valide ta séance du jour<small>On ne viendra pas vérifier. « J’y pensais très fort » ne compte pas comme une séance. 1 booster par jour.</small></span></div>
        <div><b>2</b> Ouvre ton booster de 5 cartes</div>
        <div><b>3</b> Compose ton deck de 5 exercices</div>
      </div>

      {create && !g.guestUsed && (
        <button className="btn guestbtn" onClick={g.openGuestBooster}>Ouvre ton premier booster gratuit</button>
      )}
      {create && g.guestCards > 0 && (
        <p className="guestcta" role="status" ref={ctaRef}>Crée ton compte pour garder ces cartes et ouvrir 2 boosters de plus</p>
      )}

      {cloud && (
        <div className="seg" style={{ marginBottom: 12 }}>
          <button className={create ? "on" : ""} onClick={() => { setMode("create"); setErr(null); }}>Créer un compte</button>
          <button className={!create ? "on" : ""} onClick={() => { setMode("login"); setErr(null); }}>Se connecter</button>
        </div>
      )}

      <form className="authform" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {create && (
          <div className="field">
            <label htmlFor="pseudo">Pseudo</label>
            <input id="pseudo" value={name} maxLength={20} autoComplete="nickname" placeholder="Ton pseudo" onChange={(e) => { setName(e.target.value); setErr(null); }} />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" inputMode="email" value={email} autoComplete="email" placeholder="toi@exemple.fr" onChange={(e) => { setEmail(e.target.value); setErr(null); }} />
        </div>
        <div className="field">
          <label htmlFor="pw">Mot de passe</label>
          <input id="pw" type="password" value={pw} autoComplete={create ? "new-password" : "current-password"} placeholder="8 caractères minimum" onChange={(e) => { setPw(e.target.value); setErr(null); }} />
        </div>
        {err && <span className="autherr" role="alert">{err}</span>}
        {info && <span className="authinfo" role="status">{info}</span>}
        <button className={`btn primary ${create ? "signupbtn" : ""}`} type="submit" disabled={busy}>
          {busy ? "…" : create ? <>Créer mon compte et ouvrir mes boosters<span className="giftbadge">2 boosters offerts</span></> : "Me connecter"}
        </button>
        {cloud && !create && <button type="button" className="textbtn" onClick={() => void forgot()}>Mot de passe oublié ?</button>}
      </form>

      <p className="fine obfine">
        Gratuit · les cartes et les GymCoins n’ont aucune valeur en argent · 15 ans et plus
        {!cloud && <><br />Mode test : ton compte reste sur ce téléphone et ton mot de passe n’est pas enregistré.</>}
      </p>
      <LegalLinks />
    </motion.div>
  );
}
