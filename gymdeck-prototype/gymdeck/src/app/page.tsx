"use client";

import { MotionConfig } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { GameProvider, useGame } from "@/components/GameProvider";
import { IconCards, IconCart, IconDumbbell, IconHome, IconUser } from "@/components/Icons";
import { Collection } from "@/screens/Collection";
import { GymDeckTab } from "@/screens/GymDeck";
import { Home } from "@/screens/Home";
import { Onboarding } from "@/screens/Onboarding";
import { Opening } from "@/screens/Opening";
import { Market, Profile } from "@/screens/Others";
import { Shop } from "@/screens/Shop";

export type Tab = "home" | "collection" | "gymdeck" | "shop" | "profile";

const TABS: { id: Tab; label: string; Icon: typeof IconHome }[] = [
  { id: "home", label: "Accueil", Icon: IconHome },
  { id: "collection", label: "Collection", Icon: IconCards },
  { id: "gymdeck", label: "GymDeck", Icon: IconDumbbell },
  { id: "shop", label: "Boutique", Icon: IconCart },
  { id: "profile", label: "Profil", Icon: IconUser },
];
const isTab = (v: string): v is Tab => TABS.some((t) => t.id === v);

function Shell() {
  const g = useGame();
  const [tab, setTab] = useState<Tab>("home");
  const [market, setMarket] = useState(false);

  // L'onglet est gardé dans l'adresse (#collection…) : un rechargement ou le bouton retour ne renvoie plus à l'accueil.
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace("#", "");
      setTab(isTab(h) ? h : "home");
      setMarket(h === "marche");
      if (h === "marche") setTab("shop");
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const go = useCallback((t: Tab) => {
    setMarket(false);
    setTab(t);
    try { window.history.replaceState(null, "", t === "home" ? window.location.pathname : `#${t}`); } catch { /* ignoré */ }
  }, []);

  const openMarket = () => {
    setMarket(true);
    try { window.history.replaceState(null, "", "#marche"); } catch { /* ignoré */ }
  };

  if (!g.ready) return <div className="app" id="app-root" />;

  const needsName = !g.player.name;
  const stock = g.player.boosters.length;

  return (
    <div className="app" id="app-root">
      {needsName ? (
        <Onboarding />
      ) : g.opening ? (
        <Opening key={g.opening.boosterId} go={go} />
      ) : (
        <>
          {tab === "home" && <Home go={go} />}
          {tab === "collection" && <Collection />}
          {tab === "gymdeck" && <GymDeckTab />}
          {tab === "shop" && (market ? <Market back={() => go("shop")} /> : <Shop onMarket={openMarket} />)}
          {tab === "profile" && <Profile />}
          <nav className="tabbar" aria-label="Navigation">
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} className={`tab ${tab === id ? "active" : ""}`} aria-current={tab === id ? "page" : undefined} onClick={() => go(id)}>
                <Icon /> {label}
                {id === "home" && stock > 0 && <span className="tabbadge">{stock}</span>}
              </button>
            ))}
          </nav>
        </>
      )}
      {g.toast && <div className="toast" role="status">{g.toast}</div>}
    </div>
  );
}

export default function Page() {
  return (
    <MotionConfig reducedMotion="user">
      <GameProvider><Shell /></GameProvider>
    </MotionConfig>
  );
}
