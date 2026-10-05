"use client";

import { useState } from "react";
import { GameProvider, useGame } from "@/components/GameProvider";
import { IconCards, IconCart, IconDumbbell, IconHome, IconUser } from "@/components/Icons";
import { Collection } from "@/screens/Collection";
import { Home } from "@/screens/Home";
import { Opening } from "@/screens/Opening";
import { GymDeckTab, Market, Profile } from "@/screens/Others";
import { Shop } from "@/screens/Shop";

export type Tab = "home" | "collection" | "gymdeck" | "shop" | "profile";

const TABS: { id: Tab; label: string; Icon: typeof IconHome }[] = [
  { id: "home", label: "Accueil", Icon: IconHome },
  { id: "collection", label: "Collection", Icon: IconCards },
  { id: "gymdeck", label: "GymDeck", Icon: IconDumbbell },
  { id: "shop", label: "Boutique", Icon: IconCart },
  { id: "profile", label: "Profil", Icon: IconUser },
];

function Shell() {
  const g = useGame();
  const [tab, setTab] = useState<Tab>("home");
  const [market, setMarket] = useState(false);

  if (!g.ready) return <div className="app" />;

  const go = (t: Tab) => { setMarket(false); setTab(t); };

  return (
    <div className="app">
      {g.opening ? (
        <Opening go={go} />
      ) : (
        <>
          {tab === "home" && <Home go={go} />}
          {tab === "collection" && <Collection />}
          {tab === "gymdeck" && <GymDeckTab />}
          {tab === "shop" && (market ? <Market back={() => setMarket(false)} /> : <Shop onMarket={() => setMarket(true)} />)}
          {tab === "profile" && <Profile />}
          <nav className="tabbar">
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} className={`tab ${tab === id ? "active" : ""}`} onClick={() => go(id)}>
                <Icon /> {label}
              </button>
            ))}
          </nav>
        </>
      )}
      {g.toast && <div className="toast">{g.toast}</div>}
    </div>
  );
}

export default function Page() {
  return <GameProvider><Shell /></GameProvider>;
}
