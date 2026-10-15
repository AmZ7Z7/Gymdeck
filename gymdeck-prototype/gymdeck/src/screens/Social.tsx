"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { GcPill, Wordmark } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { IconBack } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import { RARITY_RANK } from "@/lib/config";
import { deckPower } from "@/lib/engine";
import { fairValue } from "@/lib/market";
import { SEASON_TIERS, seasonEndsIn, seasonOf } from "@/lib/progress";
import { FRIEND_SUGGESTIONS, botById, botOffers, botPower, botShowcase, leaderboard, type Bot } from "@/lib/social";
import { TRADE_DAILY_MAX } from "@/lib/social";
import { recordShort } from "@/lib/duel";
import { sfx } from "@/lib/sound";

const Coin = ({ s = 16 }: { s?: number }) => <span className="coin" style={{ width: s, height: s, display: "inline-block", verticalAlign: "-3px", marginRight: 4 }} />;
const Head = ({ back, title, sub }: { back: () => void; title: string; sub?: string }) => {
  const g = useGame();
  return (
    <>
      <div className="topbar">
        <button className="backbtn" aria-label="Retour" onClick={back}><IconBack width={22} height={22} /></button>
        <Wordmark />
        <GcPill gc={g.player.gc} />
      </div>
      <h1 className="title" style={{ marginTop: 14, marginBottom: sub ? 4 : 12 }}>{title}</h1>
      {sub && <div style={{ color: "#cfd6e8", fontSize: 15, marginBottom: 12 }}>{sub}</div>}
    </>
  );
};

// ───────────────────────── Amis ─────────────────────────

export function Friends({ back }: { back: () => void }) {
  const g = useGame();
  const e = g.extra;
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const friends = e.friends.map(botById).filter((b): b is Bot => !!b);
  const sugg = FRIEND_SUGGESTIONS.filter((b) => !e.friends.includes(b.id));

  const add = (c: string) => {
    const r = g.addFriend(c);
    if (r) { setErr(r); return; }
    setErr(null); setCode(""); sfx.good(); g.say("Ami ajouté !");
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(e.friendCode); g.say("Code copié"); } catch { g.say(e.friendCode); }
  };
  const shareCode = async () => {
    const text = `Ajoute-moi sur GymDeck ! Mon code ami : ${e.friendCode}`;
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch { /* annulé */ }
    await copy();
  };

  return (
    <div className="screen">
      <Head back={back} title="Amis" sub="Échange des cartes et compare tes decks" />
      <div className="panel mycode">
        <div className="lab">Mon code ami</div>
        <div className="code">{e.friendCode}</div>
        <div className="two">
          <button className="btn ghost small" onClick={copy}>Copier</button>
          <button className="btn primary small" onClick={shareCode}>Partager</button>
        </div>
      </div>

      <h2 className="section" style={{ fontSize: 24, margin: "16px 0 8px" }}>Ajouter un ami</h2>
      <div className="addrow">
        <input value={code} placeholder="GD-XXXXXX" maxLength={9} autoCapitalize="characters" aria-label="Code ami"
          onChange={(x) => { setCode(x.target.value.toUpperCase()); setErr(null); }} onKeyDown={(x) => { if (x.key === "Enter") add(code); }} />
        <button className="btn primary chipbtn" onClick={() => add(code)}>Ajouter</button>
      </div>
      {err && <div style={{ color: "#ff8a8a", fontSize: 14, marginTop: 6 }}>{err}</div>}

      <h2 className="section" style={{ fontSize: 24, margin: "16px 0 8px" }}>Mes amis ({friends.length})</h2>
      {friends.length === 0 && <div className="empty" style={{ padding: "14px 6px" }}>Pas encore d’ami. Ajoute un code ci-dessus ou choisis un joueur de test.</div>}
      {friends.map((b) => (
        <button className="frow" key={b.id} onClick={() => setOpen(b.id)}>
          <span className="avatar">{b.name[0]}</span>
          <span className="fn">{b.name}<small>Puissance {botPower(b)}</small></span>
          <span className="link">Voir ›</span>
        </button>
      ))}

      {sugg.length > 0 && (
        <>
          <h2 className="section" style={{ fontSize: 24, margin: "16px 0 8px" }}>Joueurs de test</h2>
          {sugg.map((b) => (
            <div className="frow" key={b.id}>
              <span className="avatar">{b.name[0]}</span>
              <span className="fn">{b.name}<small>Code {b.code}</small></span>
              <button className="btn ghost chipbtn" onClick={() => add(b.code)}>Ajouter</button>
            </div>
          ))}
        </>
      )}
      <p className="warn">Prototype : les amis sont des joueurs fictifs. Avec les vrais comptes, tu ajouteras de vraies personnes avec leur code.</p>
      {open && <FriendSheet botId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function FriendSheet({ botId, onClose }: { botId: string; onClose: () => void }) {
  const g = useGame();
  const bot = botById(botId)!;
  const [trading, setTrading] = useState(false);
  const show = useMemo(() => botShowcase(bot), [bot]);
  const mine = deckPower(g.deckCards);
  const theirs = botPower(bot);
  if (trading) return <TradeSheet bot={bot} onClose={() => setTrading(false)} />;
  return (
    <Sheet onClose={onClose} variant="full" label={bot.name}>
      <div className="fsheet">
        <div className="namerow" style={{ marginTop: 6 }}>
          <div className="avatar" style={{ width: 64, height: 64, fontSize: 32 }}>{bot.name[0]}</div>
          <div className="nm">{bot.name}</div>
        </div>
        <div className="panel">
          <div className="kv"><span>Puissance de son deck</span><b>{theirs}</b></div>
          <div className="kv" style={{ borderBottom: 0 }}><span>Ton deck</span><b>{mine || "—"}</b></div>
        </div>
        <h2 className="section" style={{ fontSize: 22, margin: "14px 0 8px" }}>Sa vitrine</h2>
        <div className="show3">{show.map((c, i) => <div key={i}><Card card={c} /></div>)}</div>
        <div className="acts" style={{ maxWidth: "none", marginTop: 16 }}>
          <button className="btn primary" onClick={() => setTrading(true)}>Proposer un échange</button>
          <button className="btn ghost small" onClick={() => { g.removeFriend(bot.id); onClose(); g.say("Ami retiré"); }}>Retirer de mes amis</button>
          <button className="btn ghost small" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </Sheet>
  );
}

function TradeSheet({ bot, onClose }: { bot: Bot; onClose: () => void }) {
  const g = useGame();
  const nonce = g.extra.tradeNonce[bot.id] ?? 0;
  const offers = useMemo(() => botOffers(bot, nonce), [bot, nonce]);
  const [want, setWant] = useState<number | null>(null);
  const [give, setGive] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const mineAll = [...g.player.cards].filter((c) => !g.player.deck.includes(c.id) && !g.grading.some((j) => j.cardId === c.id)).sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || b.atq + b.def - (a.atq + a.def));
  const giveCard = mineAll.find((c) => c.id === give) ?? null;
  const wantCard = want !== null ? offers[want] : null;
  const left = TRADE_DAILY_MAX - (g.extra.daily.trade ?? 0);

  const go = () => {
    if (want === null || !give) return;
    const r = g.trade(bot.id, give, want);
    if ("error" in r) { setMsg({ ok: false, text: r.error }); sfx.error(); return; }
    sfx.good();
    setMsg({ ok: true, text: "Échange réussi ! La carte est dans ta collection." });
    setWant(null); setGive(null);
  };

  return (
    <Sheet onClose={onClose} variant="full" label="Échange">
      <div className="fsheet">
        <div className="sheet-title" style={{ fontSize: 28 }}>Échange avec {bot.name}</div>
        <p className="fine" style={{ margin: "4px 0 10px" }}>{bot.name} accepte si ta carte vaut au moins autant que la sienne. Valeur estimée au prix du Marché. Il te reste {left} échange{left > 1 ? "s" : ""} aujourd’hui.</p>
        <h2 className="section" style={{ fontSize: 20, margin: "6px 0 8px" }}>1 · Je veux…</h2>
        <div className="cgrid four">
          {offers.map((c, i) => (
            <button key={i} className={`ccell pick ${want === i ? "sel" : ""}`} onClick={() => { setWant(i); setMsg(null); }}>
              <Card card={c} holo={false} /><span className="val"><Coin s={12} />{fairValue(c)}</span>
            </button>
          ))}
        </div>
        <h2 className="section" style={{ fontSize: 20, margin: "14px 0 8px" }}>2 · Je donne…</h2>
        {mineAll.length === 0 ? <div className="empty" style={{ padding: 12 }}>Aucune carte disponible (les cartes du deck et celles chez Basile ne s’échangent pas).</div> : (
          <div className="cgrid four">
            {mineAll.map((c) => (
              <button key={c.id} className={`ccell pick ${give === c.id ? "sel" : ""}`} onClick={() => { setGive(c.id); setMsg(null); }}>
                <Card card={c} holo={false} /><span className="val"><Coin s={12} />{fairValue(c)}</span>
              </button>
            ))}
          </div>
        )}
        {msg && <div className={`tradeMsg ${msg.ok ? "ok" : "ko"}`}>{msg.text}</div>}
        <div className="acts" style={{ maxWidth: "none", marginTop: 14 }}>
          <button className="btn primary" disabled={want === null || !give || left <= 0} onClick={go}>
            {giveCard && wantCard ? `Proposer · ${fairValue(giveCard)} contre ${fairValue(wantCard)} GC` : "Choisis deux cartes"}
          </button>
          <button className="btn ghost small" onClick={onClose}>Retour</button>
        </div>
      </div>
    </Sheet>
  );
}

// ───────────────────────── Classement ─────────────────────────

export const monthName = (id: string) => {
  const s = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${id}-01T00:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function RankingBody() {
  const g = useGame();
  const e = g.extra;
  const rows = useMemo(() => leaderboard(g.player, g.day), [g.player, g.day]);
  const me = rows.find((r) => r.me);
  const top = rows.slice(0, 15);
  const pend = e.pendingSeason;
  const se = e.season;

  return (
    <>
      {pend && (
        <div className="panel seasonwin">
          <div className="t">Saison {monthName(pend.id)} terminée</div>
          <div>Tu finis <b>{pend.rank}ᵉ</b> sur {pend.total} !</div>
          <button className="btn primary small" style={{ marginTop: 10 }} onClick={() => { const r = g.claimSeason(); if (typeof r === "number") { sfx.coin(); g.say(`+${r} GC de récompense de saison`); } else g.say(r); }}>
            <Coin s={18} />Récupérer +{pend.reward} GC
          </button>
        </div>
      )}

      {me ? (
        <div className="panel myrank">
          <div className="r">#{me.rank}</div>
          <div className="d">Tes points de classement<b>{me.points}</b></div>
          <div className="d rec">{recordShort(se)}<small>victoires · défaites</small></div>
        </div>
      ) : (
        <div className="panel"><p style={{ margin: 0 }}>Fais ton <b>premier combat</b> pour entrer au classement de la saison.</p></div>
      )}

      <div className="board">
        {top.map((r) => (
          <div className={`brow ${r.me ? "me" : ""}`} key={r.name + r.rank}>
            <span className="rk">{r.rank}</span><span className="bn">{r.me ? `${r.name} (toi)` : r.name}</span><span className="bp">{r.points} pts</span>
          </div>
        ))}
        {me && me.rank > 15 && (
          <>
            <div className="brow dots">…</div>
            <div className="brow me"><span className="rk">{me.rank}</span><span className="bn">{me.name} (toi)</span><span className="bp">{me.points} pts</span></div>
          </>
        )}
      </div>

      <h2 className="section" style={{ fontSize: 22, margin: "16px 0 8px" }}>Récompenses de fin de saison</h2>
      <div className="panel">
        {SEASON_TIERS.map((t, i) => <div className="kv" key={t.label} style={i === SEASON_TIERS.length - 1 ? { borderBottom: 0 } : undefined}><span>{t.label}</span><b><Coin s={16} />{t.reward} GC</b></div>)}
      </div>
      <p className="warn">Points de classement : victoire +3, égalité ou défaite +1 (à ne pas confondre avec les points du passe de saison). Le classement repart à zéro chaque mois. Les autres joueurs sont fictifs pendant le prototype.</p>
    </>
  );
}
