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
import { Forge } from "@/screens/Forge";
import { claimableCount } from "@/lib/progress";
import { readyCount } from "@/lib/grading";
import { Profile } from "@/screens/Others";
import { Shop } from "@/screens/Shop";
import { Season } from "@/screens/Season";
import { applyTheme } from "@/lib/theme";
import { unlockAudio } from "@/lib/sound";
import { TestPanel } from "@/components/TestPanel";
import { InstallTip } from "@/components/InstallTip";
import { Card } from "@/components/Card";
import type { CardData } from "@/lib/engine";
import { EXERCISES, RARITIES } from "@/lib/config";

/** Pages ouvertes depuis un onglet (avec un bouton retour). */
export type Page = "missions" | "friends" | "calendar" | "atelier" | "season" | "forge";
const PAGES: Page[] = ["missions", "friends", "calendar", "atelier", "season", "forge"];
const PAGE_HASH: Record<Page, string> = { missions: "missions", friends: "amis", calendar: "calendrier", atelier: "atelier", season: "saison", forge: "forge" };

export type Tab = "home" | "collection" | "gymdeck" | "shop" | "market" | "combats" | "profile";
/** Ouvre une page ; pour l'atelier, on peut préciser la carte à confier à Basile ; pour la Forge, l'exercice choisi. */
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
  const pageRef = useRef<Page | null>(null);
  pageRef.current = page;
  useEffect(() => { applyTheme(); }, []);

  // L'onglet est gardé dans l'adresse (#collection…) : un rechargement ou le bouton retour ne renvoie plus à l'accueil.
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace("#", "");
      const pg = PAGES.find((x) => PAGE_HASH[x] === h) ?? null;
      // retour (geste ou bouton du téléphone) depuis une page : l'écran revient en glissant depuis la gauche
      if (pageRef.current && !pg) { setNoAnim(false); setDir(-1); }
      setPage(pg);
      if (!pg) { const t = isTab(h) ? h : LEGACY[h] ?? "home"; tabRef.current = t; setTab(t); }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const go = useCallback((t: Tab) => {
    // toucher l'onglet déjà ouvert : on remonte en haut de l'écran, comme dans la plupart des applis
    if (t === tabRef.current && !pageRef.current) {
      document.querySelector(".view .screen")?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
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
    // nouvelle entrée d'historique : le geste « retour » du téléphone ferme la page au lieu de quitter GymDeck
    try { window.history.pushState({ gdPage: true }, "", `#${PAGE_HASH[p]}`); } catch { /* ignoré */ }
  };
  const closePage = () => {
    if ((window.history.state as { gdPage?: boolean } | null)?.gdPage) { window.history.back(); return; }
    go(tab); setDir(-1);
  };

  if (!g.ready) return <div className="app" id="app-root"><div className="boot"><img className="wm" src="/assets/ui/wordmark.webp" alt="GymDeck" /></div></div>;

  const needsName = !g.account || !g.player.name;
  const ready = claimableCount(g.player, g.day, g.gameNow()) + readyCount(g.player, g.gameNow());
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
      {needsName && g.opening?.guest ? (
        <Opening key={g.opening.boosterId} go={() => g.closeOpening()} />
      ) : needsName ? (
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
                  : page === "forge" ? <Forge back={closePage} initialSlug={pageArg} />
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
          {g.extra.tutorialDone && <InstallTip />}
        </>
      )}
      {g.toast && <div className="toast" role="status" key={g.toast}>{g.toast}</div>}
    </div>
  );
}

/** Nombre de cartes à collectionner, arrondi à la cinquantaine en dessous (« plus de 150 »). */
const CARD_COUNT = Math.floor((EXERCISES.length * RARITIES.length) / 50) * 50;

/** Sur ordinateur : présentation du jeu à côté du téléphone. */
function DesktopAside() {
  return (
    <aside className="desk-aside" aria-hidden>
      <img src="/assets/ui/wordmark.webp" alt="" />
      <p className="da-tag">Ta séance, ton booster.</p>
      <div className="da-count">
        <b>{CARD_COUNT}+</b>
        <span>cartes à collectionner<small>et bien d’autres à venir très bientôt</small></span>
      </div>
      <ul>
        <li><b>1</b>Va à la salle, valide ta séance : un booster t’attend</li>
        <li><b>2</b>Ouvre-le et collectionne les cartes, de C à la légendaire LR</li>
        <li><b>3</b>Compose ton deck et affronte les autres joueurs</li>
      </ul>
      <div className="da-chips"><span>100 % gratuit</span></div>
      <p className="da-fine">Pensé pour le téléphone : ouvre GymDeck sur ton mobile et ajoute-le à ton écran d’accueil.</p>
    </aside>
  );
}

/** Sur grand écran : un booster d'où sortent des cartes, qui s'ouvrent en éventail (décor). */
const SHOWCASE: CardData[] = [
  { exerciseSlug: "squat", rarity: "SR", atq: 468, def: 431, passive: null },
  { exerciseSlug: "gainage", rarity: "SSR", atq: 742, def: 688, passive: null, grade: 8 },
  { exerciseSlug: "leg-extension", rarity: "LR", atq: 1560, def: 1490, passive: { type: "BOTH", atqTenths: 31, defTenths: 29 }, grade: 10 },
  { exerciseSlug: "developpe-incline", rarity: "UR", atq: 1104, def: 966, passive: { type: "ATQ", atqTenths: 36, defTenths: 0 } },
  { exerciseSlug: "rameur", rarity: "R", atq: 288, def: 301, passive: null },
];
function DesktopShowcase() {
  return (
    <div className="desk-show" aria-hidden>
      <span className="ds-glow" />
      <span className="ds-rays" />
      {SHOWCASE.map((c, i) => (
        <div className={`ds-card ds-c${i}`} key={i}><div className="ds-float"><Card card={c} /></div></div>
      ))}
      {/* le paquet se déchire : le haut s'arrache et s'envole, la lumière jaillit, puis les cartes sortent */}
      <div className="ds-pack">
        <img className="ds-body" src="/assets/ui/booster.webp" alt="" draggable={false} />
        <img className="ds-flap" src="/assets/ui/booster.webp" alt="" draggable={false} />
        <span className="ds-tear" />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <MotionConfig reducedMotion="user">
      <DesktopAside />
      <DesktopShowcase />
      <GameProvider><Shell /></GameProvider>
    </MotionConfig>
  );
}
