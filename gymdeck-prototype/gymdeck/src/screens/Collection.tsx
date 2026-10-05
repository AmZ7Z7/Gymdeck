"use client";

import { useMemo, useState } from "react";
import { Card, passiveLabel } from "@/components/Card";
import { GcPill, Wordmark } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { IconBack, IconNext, IconSearch } from "@/components/Icons";
import { DISCARD_GC, RARITIES, RARITY_COLOR, RARITY_RANK, exerciseBySlug, type Rarity } from "@/lib/config";
import type { OwnedCard } from "@/lib/game";

export function Collection() {
  const g = useGame();
  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState<Rarity | null>(null);
  const [showAll, setShowAll] = useState<"recent" | "exercise" | null>(null);
  const [detail, setDetail] = useState<{ slug: string; id: string } | null>(null);

  const cards = g.player.cards;
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cards.filter((c) =>
      (!rarity || c.rarity === rarity) &&
      (!needle || exerciseBySlug(c.exerciseSlug).name.toLowerCase().includes(needle)));
  }, [cards, q, rarity]);

  const recent = useMemo(() => [...filtered].sort((a, b) => b.obtainedSeq - a.obtainedSeq), [filtered]);
  const byExercise = useMemo(() => {
    const m = new Map<string, OwnedCard[]>();
    for (const c of filtered) m.set(c.exerciseSlug, [...(m.get(c.exerciseSlug) ?? []), c]);
    return [...m.entries()].map(([slug, list]) => {
      const sorted = [...list].sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || b.atq + b.def - (a.atq + a.def));
      return { slug, best: sorted[0]!, count: list.length };
    });
  }, [filtered]);

  const grid = (list: { card: OwnedCard; count?: number }[]) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
      {list.map(({ card, count }) => (
        <button className="cell" key={card.id} onClick={() => setDetail({ slug: card.exerciseSlug, id: card.id })}><Card card={card} count={count} /></button>
      ))}
    </div>
  );
  const strip = (list: { card: OwnedCard; count?: number }[]) => (
    <div className="strip">
      {list.map(({ card, count }) => (
        <button className="cell" key={card.id} onClick={() => setDetail({ slug: card.exerciseSlug, id: card.id })}><Card card={card} count={count} /></button>
      ))}
    </div>
  );

  const recentItems = recent.map((card) => ({ card }));
  const exerciseItems = byExercise.map(({ best, count }) => ({ card: best, count }));

  return (
    <div className="screen">
      <div className="topbar"><Wordmark /><GcPill gc={g.player.gc} /></div>
      <h1 className="title" style={{ marginTop: 14 }}>Ma collection</h1>

      <label className="search">
        <IconSearch />
        <input placeholder="Rechercher un exercice…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="chips">
        <button className={`chip ${rarity === null ? "on" : ""}`} onClick={() => setRarity(null)}>Toutes</button>
        {RARITIES.map((r) => (
          <button key={r} className={`chip ${rarity === r ? "on" : ""}`} style={{ ["--c" as string]: RARITY_COLOR[r] }} onClick={() => setRarity(rarity === r ? null : r)}>{r}</button>
        ))}
      </div>

      {cards.length === 0 ? (
        <div className="empty">Ta collection est vide. Ouvre un booster depuis l’accueil !</div>
      ) : filtered.length === 0 ? (
        <div className="empty">Aucune carte ne correspond.</div>
      ) : (
        <>
          <div className="row-head">
            <h2 className="section">Récentes</h2>
            <button className="link" onClick={() => setShowAll(showAll === "recent" ? null : "recent")}>{showAll === "recent" ? "Réduire" : "Voir toutes"} ›</button>
          </div>
          {showAll === "recent" ? grid(recentItems) : strip(recentItems.slice(0, 10))}

          <div className="row-head">
            <h2 className="section">Par exercice</h2>
            <button className="link" onClick={() => setShowAll(showAll === "exercise" ? null : "exercise")}>{showAll === "exercise" ? "Réduire" : "Voir toutes"} ›</button>
          </div>
          {showAll === "exercise" ? grid(exerciseItems) : strip(exerciseItems)}
        </>
      )}

      {detail && <Detail slug={detail.slug} startId={detail.id} onClose={() => setDetail(null)} />}
    </div>
  );
}

/** Fenêtre de détail : navigation entre les exemplaires d'un même exercice, défausse avec confirmation. */
function Detail({ slug, startId, onClose }: { slug: string; startId: string; onClose: () => void }) {
  const g = useGame();
  const copies = useMemo(
    () => g.player.cards.filter((c) => c.exerciseSlug === slug)
      .sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || b.atq + b.def - (a.atq + a.def)),
    [g.player.cards, slug],
  );
  const [i, setI] = useState(Math.max(0, copies.findIndex((c) => c.id === startId)));
  const [confirm, setConfirm] = useState(false);
  const card = copies[Math.min(i, copies.length - 1)];

  if (!card) { onClose(); return null; }
  const inDeck = g.player.deck.includes(card.id);

  return (
    <div className="sheet" onClick={onClose}>
      <div className="cardwrap" onClick={(e) => e.stopPropagation()}><Card card={card} /></div>
      <div style={{ textAlign: "center", fontSize: 15, color: "#cfd6e8" }} onClick={(e) => e.stopPropagation()}>
        {exerciseBySlug(card.exerciseSlug).name} · <b style={{ color: RARITY_COLOR[card.rarity] }}>{card.rarity}</b>
        {card.passive && <div style={{ color: "var(--lime)", marginTop: 4 }}>Passif : {passiveLabel(card.passive)}</div>}
      </div>
      <div className="acts" onClick={(e) => e.stopPropagation()}>
        {copies.length > 1 && (
          <div className="navrow" style={{ margin: 0, gridTemplateColumns: "56px 1fr 56px" }}>
            <button aria-label="Exemplaire précédent" onClick={() => { setConfirm(false); setI((i - 1 + copies.length) % copies.length); }}><IconBack width={24} height={24} /></button>
            <span>Exemplaire {Math.min(i, copies.length - 1) + 1} / {copies.length}</span>
            <button aria-label="Exemplaire suivant" onClick={() => { setConfirm(false); setI((i + 1) % copies.length); }}><IconNext width={24} height={24} /></button>
          </div>
        )}
        {inDeck ? (
          <div className="hint">Cette carte est dans ton deck : retire-la d’abord pour pouvoir la défausser.</div>
        ) : confirm ? (
          <button className="btn primary small" onClick={() => {
            const r = g.discard(card.id);
            setConfirm(false);
            if ("gained" in r) g.say(`+${r.gained} GC`);
            else g.say(r.error);
          }}>Confirmer · +{DISCARD_GC[card.rarity]} GC</button>
        ) : (
          <button className="btn ghost small" onClick={() => setConfirm(true)}>Défausser · +{DISCARD_GC[card.rarity]} GC</button>
        )}
        <button className="btn ghost small" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}
