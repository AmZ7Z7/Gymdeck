"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Card, Tilt } from "@/components/Card";
import { GcPill, Wordmark } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { IconBack } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import { sfx } from "@/lib/sound";
import {
  EXERCISES, GROUPS, RARITIES, RARITY_COLOR, SHARDS_CRAFT, SHARDS_DISCARD, STAT_RANGE, exerciseBySlug, type MuscleGroup, type Rarity,
} from "@/lib/config";
import type { CardData } from "@/lib/engine";
import type { OwnedCard } from "@/lib/game";

/** La Forge : les éclats gagnés en défaussant des cartes permettent de fabriquer la carte de son choix. */
export function Forge({ back, initialSlug }: { back: () => void; initialSlug?: string | null }) {
  const g = useGame();
  const shards = g.player.shards ?? 0;
  const [rarity, setRarity] = useState<Rarity>("C");
  const [slug, setSlug] = useState<string>(initialSlug && EXERCISES.some((e) => e.slug === initialSlug) ? initialSlug : EXERCISES[0]!.slug);
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [made, setMade] = useState<OwnedCard | null>(null);

  const cost = SHARDS_CRAFT[rarity];
  const missing = cost - shards;
  const owned = useMemo(() => new Set(g.player.cards.map((c) => `${c.exerciseSlug}|${c.rarity}`)), [g.player.cards]);
  const preview = (s: string): CardData => ({ exerciseSlug: s, rarity, atq: 0, def: 0, passive: null });
  const list = EXERCISES.filter((e) => !group || e.group === group);
  const range = STAT_RANGE[rarity];

  const craft = () => {
    setConfirm(false);
    const r = g.craft(slug, rarity);
    if ("error" in r) { g.say(r.error); return; }
    sfx.good();
    setMade(r.card);
  };

  return (
    <div className="screen">
      <div className="topbar">
        <button className="backbtn" aria-label="Retour" onClick={back}><IconBack width={22} height={22} /></button>
        <Wordmark />
        <GcPill gc={g.player.gc} />
      </div>
      <h1 className="title" style={{ marginTop: 14, marginBottom: 4 }}>La Forge</h1>
      <div style={{ color: "#cfd6e8", fontSize: 15, marginBottom: 12 }}>Choisis un exercice et une rareté : la carte est à toi.</div>

      <div className="panel forgebal">
        <span className="fb-ico" aria-hidden>✦</span>
        <span className="t">{shards}<small> éclats</small></span>
      </div>

      <div className="chips" role="tablist" aria-label="Rareté">
        {RARITIES.map((r) => (
          <button key={r} role="tab" aria-selected={rarity === r} className={`chip ${rarity === r ? "on" : ""}`} style={{ ["--c" as string]: RARITY_COLOR[r] }} onClick={() => setRarity(r)}>{r}</button>
        ))}
      </div>

      <div className="panel forgepick">
        <div className="fp-card"><Card card={preview(slug)} hideStats cap={false} /></div>
        <div className="fp-info">
          <div className="fp-name">{exerciseBySlug(slug).name}</div>
          <div style={{ color: RARITY_COLOR[rarity], fontWeight: 800 }}>Carte {rarity}{owned.has(`${slug}|${rarity}`) ? " · déjà dans ta collection" : ""}</div>
          <div className="fine">ATQ et DEF tirées au hasard entre {range.min} et {range.max}{rarity === "UR" || rarity === "LR" ? ", avec un passif" : ""}, comme dans un booster.</div>
          <button className="btn primary small" disabled={missing > 0} onClick={() => setConfirm(true)}>
            {missing > 0 ? `Il manque ${missing} ✦` : `Fabriquer · ${cost} ✦`}
          </button>
        </div>
      </div>

      <div className="selrow">
        <label><span>Groupe</span>
          <select value={group ?? ""} onChange={(e) => setGroup((e.target.value || null) as MuscleGroup | null)} aria-label="Filtrer par groupe">
            <option value="">Tous</option>
            {GROUPS.map((x) => <option key={x.id} value={x.id}>{x.short}</option>)}
          </select>
        </label>
      </div>
      <div className="cgrid">
        {list.map((e) => (
          <button key={e.slug} className={`ccell pick ${slug === e.slug ? "sel" : ""} ${owned.has(`${e.slug}|${rarity}`) ? "" : "ghost"}`} onClick={() => setSlug(e.slug)} aria-label={`${e.name} ${rarity}`}>
            <Card card={preview(e.slug)} hideStats holo={false} cap={false} />
            {owned.has(`${e.slug}|${rarity}`) && <span className="deckbadge">✓</span>}
          </button>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="row-head" style={{ marginTop: 0 }}><h2 className="section">Gagner des éclats</h2></div>
        <p className="fine" style={{ marginTop: 0 }}>Chaque carte défaussée (dans ta collection, ou avec « Nettoyer les doublons ») rapporte des GC et des éclats :</p>
        <div className="odds">
          <div className="odds-row g4 head"><span>Rareté</span><span>Défausse</span><span>Fabrication</span><span /></div>
          {RARITIES.map((r) => (
            <div className="odds-row g4" key={r}>
              <span style={{ color: RARITY_COLOR[r], fontWeight: 800 }}>{r}</span>
              <span>+{SHARDS_DISCARD[r]} ✦</span>
              <span>{SHARDS_CRAFT[r]} ✦</span>
              <span />
            </div>
          ))}
        </div>
      </div>

      {confirm && (
        <Sheet onClose={() => setConfirm(false)} label="Confirmer la fabrication">
          <div className="sheet-title">Fabriquer ?</div>
          <p><b>{exerciseBySlug(slug).name}</b> en <b style={{ color: RARITY_COLOR[rarity] }}>{rarity}</b> pour <b>{cost} éclats</b>. Il t’en restera {shards - cost}.</p>
          <button className="btn primary" onClick={craft}>Oui, fabriquer · {cost} ✦</button>
          <button className="btn ghost small" onClick={() => setConfirm(false)}>Annuler</button>
        </Sheet>
      )}
      {made && (
        <Sheet onClose={() => setMade(null)} variant="center" label="Carte fabriquée">
          <motion.div className="cardwrap" initial={{ rotateY: 180, scale: 0.7, opacity: 0 }} animate={{ rotateY: 0, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} style={{ transformPerspective: 900 }}>
            <Tilt><Card card={made} /></Tilt>
          </motion.div>
          <div className="sheet-title" style={{ textAlign: "center" }}>Carte forgée !</div>
          <p style={{ textAlign: "center" }}>Elle est dans ta collection.</p>
          <button className="btn primary" onClick={() => setMade(null)}>Super</button>
        </Sheet>
      )}
    </div>
  );
}
