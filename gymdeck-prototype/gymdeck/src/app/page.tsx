"use client";

import { LayoutGroup, MotionConfig, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameProvider, useGame } from "@/components/GameProvider";
import { IconCards, IconCart, IconCombat, IconDumbbell, IconHome, IconUser } from "@/components/Icons";
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
import { Atelier } from "@/screens/Atelier";
import { claimableCount } from "@/lib/progress";
import { readyCount } from "@/lib/grading";
import { Profile } from "@/screens/Others";
import { Shop } from "@/screens/Shop";
import { Season } from "@/screens/Season";
import { applyTheme } from "@/lib/theme";
import { unlockAudio } from "@/lib/sound";
import { TestPanel } from "@/components/TestPanel";
import { Card } from "@/components/Card";
import type { CardData } from "@/lib/engine";

/** Pages ouvertes depuis un onglet (avec un bouton retour). */
export type Page = "missions" | "friends" | "calendar" | "atelier" | "season";
const PAGES: Page[] = ["missions", "friends", "calendar", "atelier", "season"];
const PAGE_HASH: Record<Page, string> = { missions: "missions", friends: "amis", calendar: "calendrier", atelier: "atelier", season: "saison" };

export type Tab = "home" | "collection" | "gymdeck" | "shop" | "market" | "combats" | "profile";
/** Ouvre une page ; pour l'atelier, on peut préciser la carte à confier à Basile. */
export type OpenPage = (p: Page, cardId?: string) => void;

/** 6 onglets au maximum : le Marché est dans la Boutique (« market » = Boutique, partie Marché). */
const TABS: { id: Tab; label: string; Icon: typeof IconHome }[] = [
  { id: "home", label: "Accueil", Icon: IconHome },
  { id: "collection", label: "Collection", Icon: IconCards },
  { id: "gymdeck", label: "Deck", Icon: IconDumbbell },
  { id: "combats", label: "Combats", Icon: IconCombat },
  { id: "shop", label: "Boutique", Icon: IconCart },
  { id: "profile", label: "Profil", Icon: IconUser },
];
/** Anciennes adresses : on les redirige vers le bon onglet. */
const LEGACY: Record<string, Tab> = { marche: "market", classement: "combats" };
const isTab = (v: string): v is Tab => v === "market" || TABS.some((t) => t.id === v);
const barOf = (t: Tab): Tab => (t === "market" ? "shop" : t);
const tabIndex = (t: Tab) => TABS.findIndex((x) => x.id === barOf(t));

function Shell() {
  const g = useGame();
  const [tab, setTab] = useState<Tab>("home");
  const [page, setPage] = useState<Page | null>(null);
  const [pageArg, setPageArg] = useState<string | null>(null);
  // sens de l'animation d'arrivée d'un écran (glisse depuis la gauche ou la droite)
  const [dir, setDir] = useState(0);
  const [noAnim, setNoAnim] = useState(false);
  const tabRef = useRef<Tab>("home");
  useEffect(() => { applyTheme(); }, []);

  // L'onglet est gardé dans l'adresse (#collection…) : un rechargement ou le bouton retour ne renvoie plus à l'accueil.
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace("#", "");
      const pg = PAGES.find((x) => PAGE_HASH[x] === h) ?? null;
      setPage(pg);
      if (!pg) { const t = isTab(h) ? h : LEGACY[h] ?? "home"; tabRef.current = t; setTab(t); }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const go = useCallback((t: Tab) => {
    // Boosters ↔ Marché : même onglet, on change de partie sans animation d'arrivée
    setNoAnim(barOf(t) === barOf(tabRef.current) && t !== tabRef.current);
    setDir(Math.sign(tabIndex(t) - tabIndex(tabRef.current)));
    tabRef.current = t;
    setPage(null);
    setTab(t);
    try { window.history.replaceState(null, "", t === "home" ? window.location.pathname : `#${t}`); } catch { /* ignoré */ }
  }, []);

  const openPage: OpenPage = (p, cardId) => {
    setNoAnim(false);
    setDir(1);
    setPageArg(cardId ?? null);
    setPage(p);
    try { window.history.replaceState(null, "", `#${PAGE_HASH[p]}`); } catch { /* ignoré */ }
  };
  const closePage = () => { go(tab); setDir(-1); };

  if (!g.ready) return <div className="app" id="app-root"><div className="boot"><img className="wm" src="/assets/ui/wordmark.webp" alt="GymDeck" /></div></div>;

  const needsName = !g.account || !g.player.name;
  const ready = claimableCount(g.player, g.day) + readyCount(g.player, g.gameNow());
  const stock = g.player.boosters.length;
  const canDuel = g.deckCards.length >= 5 && g.duelsLeft > 0;
  const fullPage = page === "atelier";
  const shopSeg = (
    <div className="seg shopseg" role="tablist">
      <button role="tab" aria-selected={tab === "shop"} className={tab === "shop" ? "on" : ""} onClick={() => go("shop")}>Boosters</button>
      <button role="tab" aria-selected={tab === "market"} className={tab === "market" ? "on" : ""} onClick={() => go("market")}>Marché</button>
    </div>
  );

  return (
    <div className="app" id="app-root" onPointerDownCapture={unlockAudio}>
      {needsName ? (
        <Onboarding />
      ) : g.opening ? (
        <Opening key={g.opening.boosterId} go={go} />
      ) : (
        <>
          <div className={`view ${noAnim && !page ? "noanim" : ""}`} key={page ?? barOf(tab)} style={{ ["--sx" as string]: `${dir * 28}px` }}>
            {page === "missions" ? <Missions back={closePage} />
              : page === "friends" ? <Friends back={closePage} />
                : page === "calendar" ? <Calendar back={closePage} />
                  : page === "atelier" ? <Atelier back={closePage} initialCardId={pageArg} />
                  : page === "season" ? <Season back={closePage} openMissions={() => openPage("missions")} />
                    : (
                      <>
                        {tab === "home" && <Home go={go} openPage={openPage} />}
                        {tab === "collection" && <Collection openPage={openPage} />}
                        {tab === "gymdeck" && <GymDeckTab go={go} />}
                        {tab === "shop" && <Shop openPage={openPage} seg={shopSeg} />}
                        {tab === "market" && <Market seg={shopSeg} />}
                        {tab === "combats" && <Combats go={go} openPage={openPage} />}
                        {tab === "profile" && <Profile openPage={openPage} go={go} />}
                      </>
                    )}
          </div>
          {!fullPage && (
            <nav className="tabbar" aria-label="Navigation">
              <LayoutGroup id="tabs">
                {TABS.map(({ id, label, Icon }) => (
                  <button key={id} className={`tab ${barOf(tab) === id && !page ? "active" : ""}`} aria-current={barOf(tab) === id ? "page" : undefined} onClick={() => go(id)}>
                    <Icon /> {label}
                    {barOf(tab) === id && <motion.span className="tabind" layoutId="tabind" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                    {id === "home" && stock > 0 && <span className="tabbadge">{stock}</span>}
                    {id === "combats" && canDuel && <span className="tabdot" aria-label="Duels disponibles" />}
                    {id === "profile" && ready > 0 && <span className="tabbadge">{ready}</span>}
                  </button>
                ))}
              </LayoutGroup>
            </nav>
          )}
          <TestPanel />
        </>
      )}
      {g.toast && <div className="toast" role="status" key={g.toast}>{g.toast}</div>}
    </div>
  );
}

/** Sur ordinateur : un mot d'accueil à côté du téléphone. */
function DesktopAside() {
  return (
    <aside className="desk-aside" aria-hidden>
      <img src="/assets/ui/wordmark.webp" alt="" />
      <p className="da-tag">Ta séance, ton booster.</p>
      <ul>
        <li><b>1</b>Valide ta séance, ouvre un booster</li>
        <li><b>2</b>Collectionne 32 exercices en 6 raretés</li>
        <li><b>3</b>Compose ton deck et affronte les autres</li>
      </ul>
      <p className="da-fine">Pensé pour le téléphone : ouvre GymDeck sur ton mobile et ajoute-le à ton écran d’accueil.</p>
    </aside>
  );
}

/** Sur grand écran : trois cartes en éventail (décor). */
const FAN: CardData[] = [
  { exerciseSlug: "gainage", rarity: "SSR", atq: 742, def: 688, passive: null },
  { exerciseSlug: "leg-extension", rarity: "LR", atq: 1560, def: 1490, passive: { type: "BOTH", atqTenths: 31, defTenths: 29 }, grade: 9 },
  { exerciseSlug: "developpe-incline", rarity: "UR", atq: 1104, def: 966, passive: { type: "ATQ", atqTenths: 36, defTenths: 0 } },
];
function DesktopFan() {
  return <div className="desk-fan" aria-hidden>{FAN.map((c, i) => <div className="df" key={i}><Card card={c} /></div>)}</div>;
}

export default function Page() {
  return (
    <MotionConfig reducedMotion="user">
      <DesktopAside />
      <DesktopFan />
      <GameProvider><Shell /></GameProvider>
    </MotionConfig>
  );
}
