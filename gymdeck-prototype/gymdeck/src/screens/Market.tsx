"use client";

import { useMemo, useState } from "react";
import { Card, Medal, passiveLabel } from "@/components/Card";
import { IconClock } from "@/components/Icons";
import { GcPill, Wordmark, formatDuration, useNow } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { Sheet } from "@/components/Sheet";
import { GRADE_LABEL, RARITIES, RARITY_COLOR, RARITY_RANK, exerciseBySlug, gradeColor, type Rarity } from "@/lib/config";
import { atWorkshop } from "@/lib/game";
import {
  FAIR_VALUE, MARKET, ME, bidStep, fairValue, minNextBid, priceShown, suggestedStart,
  type Auction, type MarketEntry,
} from "@/lib/market";
import type { OwnedCard } from "@/lib/game";
import { sfx } from "@/lib/sound";

type Tab = "browse" | "mine" | "sell";
type Sort = "ending" | "cheap" | "rarity";

const cardOf = (a: Auction) => ({ ...a.card });
const Coin = ({ s = 16 }: { s?: number }) => <span className="coin" style={{ width: s, height: s, display: "inline-block", verticalAlign: "-3px", marginRight: 4 }} />;
const left = (a: Auction, now: number) => formatDuration(a.endsAt - now);

export function Market() {
  const g = useGame();
  useNow(15000); // rafraîchit les comptes à rebours
  const now = g.marketClock();
  const [tab, setTab] = useState<Tab>("browse");
  const [rarity, setRarity] = useState<Rarity | null>(null);
  const [sort, setSort] = useState<Sort>("ending");
  const [open, setOpen] = useState<string | null>(null);
  const [selling, setSelling] = useState<string | null>(null);

  const all = g.market.auctions;
  const browse = useMemo(() => {
    const l = all.filter((a) => a.seller !== ME && (!rarity || a.card.rarity === rarity));
    if (sort === "ending") l.sort((a, b) => a.endsAt - b.endsAt);
    else if (sort === "cheap") l.sort((a, b) => priceShown(a) - priceShown(b));
    else l.sort((a, b) => RARITY_RANK[b.card.rarity] - RARITY_RANK[a.card.rarity] || b.card.atq + b.card.def - (a.card.atq + a.card.def));
    return l;
  }, [all, rarity, sort]);
  const myBids = all.filter((a) => a.bidder === ME && a.seller !== ME);
  const mySales = all.filter((a) => a.seller === ME);
  const openAuction = all.find((a) => a.id === open) ?? null;
  const sellable = g.player.cards.filter((c) => !g.player.deck.includes(c.id) && !atWorkshop(g.player, c.id));
  const sellCard = g.player.cards.find((c) => c.id === selling) ?? null;

  return (
    <div className="screen">
      <div className="topbar">
        <Wordmark />
        <GcPill gc={g.player.gc} />
      </div>
      <h1 className="title" style={{ marginTop: 14, marginBottom: 4 }}>Marché</h1>
      <div style={{ color: "#cfd6e8", fontSize: 15, marginBottom: 10 }}>Enchères entre joueurs · aucune commission</div>

      <div className="seg three">
        <button className={tab === "browse" ? "on" : ""} onClick={() => setTab("browse")}>Enchères</button>
        <button className={tab === "mine" ? "on" : ""} onClick={() => setTab("mine")}>
          Mes enchères{myBids.length + mySales.length > 0 ? ` (${myBids.length + mySales.length})` : ""}
        </button>
        <button className={tab === "sell" ? "on" : ""} onClick={() => setTab("sell")}>Vendre</button>
      </div>

      {tab === "browse" && (
        <>
          <div className="chips">
            <button className={`chip ${rarity === null ? "on" : ""}`} onClick={() => setRarity(null)}>Toutes</button>
            {RARITIES.map((r) => (
              <button key={r} className={`chip ${rarity === r ? "on" : ""}`} style={{ ["--c" as string]: RARITY_COLOR[r] }} onClick={() => setRarity(rarity === r ? null : r)}>{r}</button>
            ))}
          </div>
          <div className="sortrow" style={{ marginTop: 8 }} role="group" aria-label="Trier">
            <button className={sort === "ending" ? "on" : ""} onClick={() => setSort("ending")}>Fin proche</button>
            <button className={sort === "cheap" ? "on" : ""} onClick={() => setSort("cheap")}>Prix croissant</button>
            <button className={sort === "rarity" ? "on" : ""} onClick={() => setSort("rarity")}>Rareté</button>
          </div>
          {browse.length === 0 ? <div className="empty">Aucune enchère pour ce filtre.</div> : (
            <div className="agrid">
              {browse.map((a) => (
                <button className={`acell ${a.bidder === ME ? "lead" : ""}`} key={a.id} onClick={() => setOpen(a.id)} aria-label={`${exerciseBySlug(a.card.exerciseSlug).name} ${a.card.rarity}, ${a.bidder ? "offre actuelle" : "mise de départ"} ${priceShown(a)} GC, fin dans ${left(a, now)}`}>
                  {a.bidder === ME && <span className="atag lead">EN TÊTE</span>}
                  <div className="acard"><Card card={cardOf(a)} /></div>
                  <div className="afoot">
                    <span className="aby">{a.bidder ? "Offre actuelle" : "Mise de départ"}</span>
                    <span className="price"><Coin />{priceShown(a)}</span>
                    <span className="time"><IconClock />{left(a, now)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "mine" && (
        <>
          <h2 className="section" style={{ fontSize: 24, margin: "6px 0 8px" }}>Mes offres</h2>
          {myBids.length === 0 ? <div className="empty small">Tu n’as aucune offre en cours.</div> : myBids.map((a) => <Row key={a.id} a={a} now={now} onOpen={() => setOpen(a.id)} status="Tu es en tête" />)}
          <h2 className="section" style={{ fontSize: 24, margin: "16px 0 8px" }}>Mes ventes</h2>
          {mySales.length === 0 ? <div className="empty small">Tu ne vends rien pour l’instant.</div> : mySales.map((a) => (
            <Row key={a.id} a={a} now={now} onOpen={() => setOpen(a.id)} status={a.bidder ? `${a.currentBid} GC par ${a.bidder}` : "Aucune offre"} />
          ))}
          <h2 className="section" style={{ fontSize: 24, margin: "16px 0 8px" }}>Historique</h2>
          {g.market.history.length === 0 ? <div className="empty small">Rien pour l’instant.</div> : g.market.history.slice(0, 12).map((h) => <HistoryRow key={h.id} h={h} />)}
        </>
      )}

      {tab === "sell" && (
        <>
          <p className="fine" style={{ margin: "4px 0 10px" }}>
            Choisis une carte à vendre. Elle quitte ta collection jusqu’à la fin de l’enchère, et te revient si personne n’enchérit. Les cartes de ton deck et celles chez Basile ne peuvent pas être vendues.
          </p>
          {sellable.length === 0 ? <div className="empty">Aucune carte à vendre pour l’instant.</div> : (
            <div className="cgrid">
              {[...sellable].sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || b.atq + b.def - (a.atq + a.def)).map((c) => (
                <button className="ccell" key={c.id} onClick={() => setSelling(c.id)}><Card card={c} /></button>
              ))}
            </div>
          )}
        </>
      )}
      <p className="warn">Prototype : les autres joueurs sont simulés. Les GC n’ont aucune valeur en argent.</p>

      {openAuction && <AuctionSheet a={openAuction} now={now} onClose={() => setOpen(null)} />}
      {sellCard && <SellSheet card={sellCard} onClose={() => setSelling(null)} onDone={() => { setSelling(null); setTab("mine"); }} />}
    </div>
  );
}

function Row({ a, now, onOpen, status }: { a: Auction; now: number; onOpen: () => void; status: string }) {
  return (
    <button className="arow" onClick={onOpen}>
      <div className="thumb"><Card card={cardOf(a)} /></div>
      <div className="info">
        <b>{exerciseBySlug(a.card.exerciseSlug).name} <span style={{ color: RARITY_COLOR[a.card.rarity] }}>{a.card.rarity}</span></b>
        <span>{status}</span>
        <span>Fin dans {left(a, now)}</span>
      </div>
      <div className="p"><Coin s={18} />{priceShown(a)}</div>
    </button>
  );
}

const KIND: Record<MarketEntry["kind"], string> = { won: "Gagnée", sold: "Vendue", unsold: "Invendue", outbid: "Surenchérie", cancelled: "Annulée" };
function HistoryRow({ h }: { h: MarketEntry }) {
  return (
    <div className="arow static">
      <div className="thumb"><Card card={h.card} /></div>
      <div className="info">
        <b>{exerciseBySlug(h.card.exerciseSlug).name} <span style={{ color: RARITY_COLOR[h.card.rarity] }}>{h.card.rarity}</span></b>
        <span>{KIND[h.kind]}</span>
      </div>
      {h.price > 0 && <div className="p"><Coin s={18} />{h.price}</div>}
    </div>
  );
}

function AuctionSheet({ a, now, onClose }: { a: Auction; now: number; onClose: () => void }) {
  const g = useGame();
  const min = minNextBid(a);
  const [amount, setAmount] = useState(min);
  const mineSale = a.seller === ME;
  const leading = a.bidder === ME;
  const amt = Math.max(min, amount);
  const step = bidStep(a);

  return (
    <Sheet onClose={onClose} variant="center" label="Enchère">
      <div className="cardwrap" style={{ width: "min(54vw, 230px)" }}><Card card={cardOf(a)} /></div>
      <div style={{ textAlign: "center", fontSize: 15, color: "#cfd6e8" }}>
        {exerciseBySlug(a.card.exerciseSlug).name} · <b style={{ color: RARITY_COLOR[a.card.rarity] }}>{a.card.rarity}</b>
        {a.card.passive && <div style={{ color: "var(--lime)", marginTop: 3 }}>Passif : {passiveLabel(a.card.passive)}</div>}
        {a.card.grade ? <div style={{ marginTop: 3 }}><Medal grade={a.card.grade} className="sm" />Note de Basile : <b style={{ color: gradeColor(a.card.grade) }}>{a.card.grade}/10 · {GRADE_LABEL[a.card.grade]}</b></div> : null}
      </div>
      <div className="panel" style={{ width: "100%", padding: "4px 14px" }}>
        <div className="kv"><span>Vendeur</span><b>{mineSale ? "Toi" : a.seller}</b></div>
        <div className="kv"><span>{a.bidder ? "Offre actuelle" : "Mise de départ"}</span><b><Coin />{priceShown(a)} GC</b></div>
        {a.bidder && <div className="kv"><span>En tête</span><b>{a.bidder === ME ? "Toi" : a.bidder}</b></div>}
        <div className="kv" style={{ borderBottom: 0 }}><span>Fin dans</span><b>{left(a, now)}</b></div>
      </div>

      {mineSale ? (
        a.bidder ? <p className="fine" style={{ textAlign: "center" }}>Quelqu’un a enchéri : la vente ne peut plus être annulée.</p> : (
          <button className="btn ghost small" onClick={() => { const e = g.cancelAuction(a.id); g.say(e ?? "Vente annulée, la carte est de retour"); if (!e) onClose(); }}>Annuler la vente</button>
        )
      ) : leading ? (
        <div className="hint" style={{ margin: 0, color: "var(--lime)" }}>Tu es en tête avec {a.currentBid} GC.</div>
      ) : (
        <>
          <div className="stepper">
            <button aria-label="Moins" onClick={() => setAmount(Math.max(min, amt - step))}>−</button>
            <input inputMode="numeric" aria-label="Ta mise en GC" value={amt} onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "")) || 0)} />
            <button aria-label="Plus" onClick={() => setAmount(amt + step)}>+</button>
          </div>
          <div className="fine" style={{ textAlign: "center" }}>Minimum {min} GC · tu as {g.player.gc} GC. Tes GC sont bloqués jusqu’à la fin, ou rendus si on te surenchérit.</div>
          <button
            className="btn primary small"
            disabled={amt > g.player.gc}
            onClick={() => { const e = g.bid(a.id, amt); if (e) sfx.error(); else sfx.coin(); g.say(e ?? `Tu es en tête avec ${amt} GC`); if (!e) onClose(); }}
          >{amt > g.player.gc ? `Il manque ${amt - g.player.gc} GC` : `Enchérir · ${amt} GC`}</button>
        </>
      )}
      <button className="btn ghost small" onClick={onClose}>Fermer</button>
    </Sheet>
  );
}

function SellSheet({ card, onClose, onDone }: { card: OwnedCard; onClose: () => void; onDone: () => void }) {
  const g = useGame();
  const [price, setPrice] = useState(suggestedStart(card));
  const [hours, setHours] = useState<number>(24);
  const fair = fairValue(card);
  return (
    <Sheet onClose={onClose} variant="center" label="Mettre aux enchères">
      <div className="cardwrap" style={{ width: "min(46vw, 190px)" }}><Card card={card} /></div>
      <div style={{ textAlign: "center", fontSize: 15, color: "#cfd6e8" }}>
        {exerciseBySlug(card.exerciseSlug).name} · <b style={{ color: RARITY_COLOR[card.rarity] }}>{card.rarity}</b>
        {card.grade ? <div style={{ marginTop: 3 }}><Medal grade={card.grade} className="sm" />Note de Basile : <b style={{ color: gradeColor(card.grade) }}>{card.grade}/10</b> · elle s’affiche dans l’annonce</div> : null}
        <div className="fine" style={{ marginTop: 3 }}>Valeur indicative d’une {card.rarity} : ~{FAIR_VALUE[card.rarity]} GC</div>
      </div>
      <div style={{ width: "100%" }}>
        <div className="fine" style={{ marginBottom: 6 }}>Mise de départ (GC)</div>
        <div className="stepper">
          <button aria-label="Moins" onClick={() => setPrice(Math.max(1, price - Math.max(1, Math.round(fair * 0.1))))}>−</button>
          <input inputMode="numeric" aria-label="Mise de départ" value={price} onChange={(e) => setPrice(Math.min(MARKET.maxPrice, Number(e.target.value.replace(/\D/g, "")) || 0))} />
          <button aria-label="Plus" onClick={() => setPrice(Math.min(MARKET.maxPrice, price + Math.max(1, Math.round(fair * 0.1))))}>+</button>
        </div>
      </div>
      <div className="chips" style={{ margin: 0, padding: 0, justifyContent: "center" }}>
        {MARKET.durationsH.map((h) => <button key={h} className={`chip ${hours === h ? "on" : ""}`} onClick={() => setHours(h)}>{h} h</button>)}
      </div>
      <p className="fine" style={{ textAlign: "center" }}>Tu reçois 100 % de la mise finale. Si personne n’enchérit, la carte te revient.</p>
      <button
        className="btn primary small"
        disabled={price < 1}
        onClick={() => { const e = g.listCard(card.id, price, hours); g.say(e ?? "Carte mise aux enchères"); if (!e) onDone(); }}
      >Mettre aux enchères · {price} GC</button>
      <button className="btn ghost small" onClick={onClose}>Annuler</button>
    </Sheet>
  );
}
