"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { GcPill, Wordmark } from "@/components/Bits";
import { BonusLine } from "@/components/CombatBits";
import { CombatFlow, RulesSheet } from "@/components/Fight";
import { useGame } from "@/components/GameProvider";
import { IconCheck } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import { DUEL } from "@/lib/config";
import { CONSIGNES, teamHp } from "@/lib/duel";
import { seasonEndsIn, seasonOf } from "@/lib/progress";
import { botById } from "@/lib/social";
import type { OpenPage, Tab } from "@/app/page";
import { monthName, RankingBody } from "./Social";

const OUT: Record<string, string> = { win: "Victoire", loss: "Défaite", draw: "Égalité" };
const ago = (ms: number) => {
  const h = Math.max(0, Math.round(ms / 3_600_000));
  return h < 1 ? "à l’instant" : h < 24 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
};

export function Combats({ go, openPage }: { go: (t: Tab) => void; openPage?: OpenPage }) {
  const g = useGame();
  const [rules, setRules] = useState(false);
  const [duel, setDuel] = useState<{ friend?: string } | null>(null);
  const [pickFriend, setPickFriend] = useState(false);
  const deck = g.deckCards;
  const ready = deck.length >= 5;
  const days = seasonEndsIn(g.day);
  const left = g.duelsLeft;
  const total = DUEL.daily + (g.sessionDoneToday ? DUEL.perSession : 0);
  const history = g.extra.duels ?? [];
  const defenses = g.extra.defenses ?? [];
  const consigne = CONSIGNES.find((c) => c.id === (g.extra.consigne ?? "equilibre"))!;
  const friends = (g.extra.friends ?? []).map((id) => botById(id)).filter((b): b is NonNullable<typeof b> => !!b);
  const now = g.gameNow();

  return (
    <div className="screen">
      <div className="topbar"><Wordmark /><GcPill gc={g.player.gc} /></div>
      <h1 className="title" style={{ marginTop: 14, marginBottom: 4 }}>Combats</h1>
      <div style={{ color: "#cfd6e8", fontSize: 15, marginBottom: 12 }}>Saison {monthName(seasonOf(g.day))} · fin dans {days} jour{days > 1 ? "s" : ""}</div>

      <div className="panel arena">
        <div className="arena-top">
          <span className="arena-t">Arène</span>
          <span className="duelpips" aria-label={`${left} duel${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""} aujourd’hui`}>
            {Array.from({ length: Math.max(total, left) }, (_, i) => <i key={i} className={i < left ? "on" : ""} />)}
            <b>{left} duel{left > 1 ? "s" : ""}</b>
          </span>
        </div>
        {ready ? (
          <>
            <div className="arena-deck">{deck.map((c) => <div key={c.id}><Card card={c} holo={false} /></div>)}</div>
            <BonusLine cards={deck} />
            <div className="arena-power"><span>PV de ton équipe</span><b>{teamHp(deck).toLocaleString("fr-FR")}</b></div>
            <button className="btn primary" disabled={left <= 0} onClick={() => setDuel({})}>
              {left > 0 ? "Trouver un adversaire" : "Plus de duel aujourd’hui"}
            </button>
            {!g.sessionDoneToday && <p className="fine" style={{ textAlign: "center" }}>Valide ta séance du jour : +{DUEL.perSession} duels.</p>}
            <button className="btn ghost small" onClick={() => setPickFriend(true)}>Duel amical avec un ami</button>
          </>
        ) : (
          <>
            <div className="arena-empty">Il te faut un deck de 5 cartes pour combattre ({deck.length}/5).</div>
            <button className="btn primary small" onClick={() => go("gymdeck")}>Compléter mon deck</button>
          </>
        )}
        <button className="link" style={{ justifySelf: "center" }} onClick={() => setRules(true)}>Règles des combats ›</button>
      </div>

      <div className="panel defense">
        <div className="def-top">
          <div><b>Défense</b><small>+{DUEL.defenseGc} GC par attaque repoussée</small></div>
          <button className="btn ghost chipbtn" onClick={() => go("gymdeck")}>{consigne.name}</button>
        </div>
        {defenses.length > 0 ? (
          <div className="def-list">
            {defenses.slice(0, 3).map((d) => (
              <div key={d.at + d.opp} className={d.won ? "won" : "lost"}>
                <span>{d.won ? <IconCheck width={16} height={16} /> : "×"}</span>
                <b>{d.opp}</b>
                <small>{d.won ? "repoussé" : "a gagné"} · {ago(now - d.at)}</small>
                <em>{d.gc ? `+${d.gc} GC` : ""}</em>
              </div>
            ))}
          </div>
        ) : <div className="fine">Aucune attaque pour l’instant.</div>}
      </div>

      {history.length > 0 && (
        <>
          <h2 className="section" style={{ fontSize: 24, margin: "18px 0 8px" }}>Derniers combats</h2>
          <div className="board">
            {history.slice(0, 5).map((h) => (
              <div className={`brow hist ${h.outcome}`} key={h.at}>
                <span className="rk">{h.outcome === "win" ? "V" : h.outcome === "loss" ? "D" : "N"}</span>
                <span className="bn">{OUT[h.outcome]} contre {h.opp}<small>{h.friendly ? "duel amical · " : ""}{h.ko ? "KO · " : ""}{h.myHp ?? "?"} % – {h.theirHp ?? "?"} % de PV</small></span>
                <span className="bp">{h.friendly ? "" : `+${h.pts} pts`}{h.gc ? ` · +${h.gc} GC` : ""}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="section" style={{ margin: "18px 0 8px" }}>Classement de saison</h2>
      <RankingBody />

      {duel && <CombatFlow friend={duel.friend} onClose={() => setDuel(null)} />}
      {rules && <RulesSheet onClose={() => setRules(false)} />}
      {pickFriend && (
        <Sheet onClose={() => setPickFriend(false)} label="Duel amical">
          <div className="sheet-title">Duel amical</div>
          <p className="fine" style={{ margin: "0 0 10px" }}>Decks de même puissance, sans récompense.</p>
          {friends.length ? (
            <div className="board">
              {friends.map((b) => (
                <button key={b.id} className="brow" onClick={() => { setPickFriend(false); setDuel({ friend: b.id }); }}>
                  <span className="avatar sm">{b.name[0]}</span>
                  <span className="bn">{b.name}</span>
                  <span className="bp" style={{ color: "var(--lime)" }}>Défier ›</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty small">Ajoute d’abord un ami (Profil › Amis).</div>
          )}
        </Sheet>
      )}
    </div>
  );
}
