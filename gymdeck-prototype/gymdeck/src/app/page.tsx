"use client";

import { MotionConfig } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { GameProvider, useGame } from "@/components/GameProvider";
import { IconCards, IconCart, IconCombat, IconDumbbell, IconHome, IconMarket, IconUser } from "@/components/Icons";
import { Collection } from "@/screens/Collection";
import { GymDeckTab } from "@/screens/GymDeck";
import { Home } from "@/screens/Home";
import { Onboarding } from "@/screens/Onboarding";
import { Opening } from "@/screens/Opening";
import { Market } from "@/screens/Market";
import { Missions } from "@/screens/Missions";
import { Friends } from "@/screens/Social";
import { Calendar } from "@/screens/Calendar";
import { Combats } from "@/screens/Combats";
import { claimableCount } from "@/lib/progress";
import { Profile } from "@/screens/Others";
import { Shop } from "@/screens/Shop";
import { unlockAudio } from "@/lib/sound";

/** Pages ouvertes depuis un onglet (avec un bouton retour). */
export type Page = "missions" | "friends" | "calendar";
const PAGES: Page[] = ["missions", "friends", "calendar"];
const PAGE_HASH: Record<Page, string> = { missions: "missions", friends: "amis", calendar: "calendrier" };

export type Tab = "home" | "collection" | "gymdeck" | "shop" | "market" | "combats" | "profile";

const TABS: { id: Tab; label: string; Icon: typeof IconHome }[] = [
  { id: "home", label: "Accueil", Icon: IconHome },
  { id: "collection", label: "Collection", Icon: IconCards },
  { id: "gymdeck", label: "Deck", Icon: IconDumbbell },
  { id: "shop", label: "Boutique", Icon: IconCart },
  { id: "market", label: "Marché", Icon: IconMarket },
  { id: "combats", label: "Combats", Icon: IconCombat },
  { id: "profile", label: "Profil", Icon: IconUser },
];
/** Anciennes adresses : on les redirige vers le bon onglet. */
const LEGACY: Record<string, Tab> = { marche: "market", classement: "combats" };
const isTab = (v: string): v is Tab => TABS.some((t) => t.id === v);

function Shell() {
  const g = useGame();
  const [tab, setTab] = useState<Tab>("home");
  const [page, setPage] = useState<Page | null>(null);

  // L'onglet est gardé dans l'adresse (#collection…) : un rechargement ou le bouton retour ne renvoie plus à l'accueil.
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace("#", "");
      const pg = PAGES.find((x) => PAGE_HASH[x] === h) ?? null;
      setPage(pg);
      if (!pg) setTab(isTab(h) ? h : LEGACY[h] ?? "home");
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const go = useCallback((t: Tab) => {
    setPage(null);
    setTab(t);
    try { window.history.replaceState(null, "", t === "home" ? window.location.pathname : `#${t}`); } catch { /* ignoré */ }
  }, []);

  const openPage = (p: Page) => {
    setPage(p);
    try { window.history.replaceState(null, "", `#${PAGE_HASH[p]}`); } catch { /* ignoré */ }
  };
  const closePage = () => go(tab);

  if (!g.ready) return <div className="app" id="app-root" />;

  const needsName = !g.account || !g.player.name;
  const ready = claimableCount(g.player, g.day);
  const stock = g.player.boosters.length;

  return (
    <div
      className="app"
      id="app-root"
      onPointerDownCapture={unlockAudio}
    >
      {needsName ? (
        <Onboarding />
      ) : g.opening ? (
        <Opening key={g.opening.boosterId} go={go} />
      ) : (
        <>
          {page === "missions" ? <Missions back={closePage} />
            : page === "friends" ? <Friends back={closePage} />
              : page === "calendar" ? <Calendar back={closePage} />
                : (
                  <>
                    {tab === "home" && <Home go={go} openPage={openPage} />}
                    {tab === "collection" && <Collection />}
                    {tab === "gymdeck" && <GymDeckTab go={go} />}
                    {tab === "shop" && <Shop onMarket={() => go("market")} />}
                    {tab === "market" && <Market />}
                    {tab === "combats" && <Combats />}
                    {tab === "profile" && <Profile openPage={openPage} go={go} />}
                  </>
                )}
          <nav className="tabbar" aria-label="Navigation">
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} className={`tab ${tab === id ? "active" : ""}`} aria-current={tab === id ? "page" : undefined} onClick={() => go(id)}>
                <Icon /> {label}
                {id === "home" && stock > 0 && <span className="tabbadge">{stock}</span>}
                {id === "profile" && ready > 0 && <span className="tabbadge">{ready}</span>}
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
