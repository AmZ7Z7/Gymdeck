"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Card, passiveLabel } from "@/components/Card";
import { GcPill, Wordmark } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { IconBack, Shield, Swords } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import { DECK_SIZE, EXERCISES, RARITY_COLOR, RARITY_RANK, exerciseBySlug } from "@/lib/config";
import { bestDeckIds, deckPower, deckTotals } from "@/lib/engine";
import type { OwnedCard } from "@/lib/game";
import type { Tab } from "@/app/page";
import { BonusLine, GroupTag } from "@/components/CombatBits";
import { CONSIGNES, teamHp } from "@/lib/duel";
import { DUEL } from "@/lib/config";
import { sfx } from "@/lib/sound";

const fmtPct = (v: number) => `${v.toFixed(1).replace(".", ",")} %`;
const fmt = (n: number) => n.toLocaleString("fr-FR");

export function GymDeckTab({ go }: { go: (t: Tab) => void }) {
  const g = useGame();
  const { player } = g;
  const [picker, setPicker] = useState(false);
  const [help, setHelp] = useState(false);
  const deck = g.deckCards;
  const t = deckTotals(deck);

  const optimalIds = useMemo(() => bestDeckIds(player.cards), [player.cards]);
  const isOptimal = useMemo(() => {
    if (player.cards.length === 0) return true;
    const best = optimalIds.map((id) => player.cards.find((c) => c.id === id)!);
    return deckPower(deck) >= deckPower(best) && deck.length >= best.length;
  }, [player.cards, optimalIds, deck]);

  const carriers = deck.filter((c) => c.passive);

  return (
    <div className="screen">
      <div className="topbar"><Wordmark /><GcPill gc={player.gc} /></div>
      <div className="titlerow">
        <h1 className="title">Mon GymDeck</h1>
        <button className="helpbtn" aria-label="Comment ça marche ?" onClick={() => setHelp(true)}>?</button>
      </div>

      <div className="powerbar">
        <div className="pbox">
          <div className="lab"><Swords /> ATQ</div>
          <div className="val">{fmt(t.totalAtq)}</div>
          <div className="sub">{t.bonusAtqPct > 0 ? <>base {fmt(t.baseAtq)} · <b>+{fmtPct(t.bonusAtqPct)}</b></> : <>base {fmt(t.baseAtq)}</>}</div>
        </div>
        <div className="pbox">
          <div className="lab"><Shield /> DEF</div>
          <div className="val">{fmt(t.totalDef)}</div>
          <div className="sub">{t.bonusDefPct > 0 ? <>base {fmt(t.baseDef)} · <b>+{fmtPct(t.bonusDefPct)}</b></> : <>base {fmt(t.baseDef)}</>}</div>
        </div>
      </div>

      <div className="slots">
        {Array.from({ length: DECK_SIZE }, (_, i) => {
          const c = deck[i];
          return c ? (
            <motion.button key={c.id} layout initial={{ opacity: 0, scale: 0.85, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="slot" aria-label={`Changer ${exerciseBySlug(c.exerciseSlug).name}`} onClick={() => setPicker(true)}>
              <Card card={c} />
              <GroupTag card={c} />
            </motion.button>
          ) : (
            <button key={`e${i}`} className="slot empty" aria-label="Ajouter une carte" onClick={() => setPicker(true)}>
              <div><span>+</span><small>Ajouter</small></div>
            </button>
          );
        })}
      </div>
      <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>Un exemplaire par exercice.</p>

      <button className="btn primary" onClick={() => setPicker(true)} disabled={player.cards.length === 0}>Modifier mon deck</button>
      {player.cards.length === 0 && <p className="hint">Ouvre un booster pour avoir des cartes à placer.</p>}
      {player.cards.length > 0 && (
        <button
          className="btn ghost small"
          style={{ marginTop: 10 }}
          disabled={isOptimal}
          onClick={() => {
            const e = g.autoDeck();
            g.say(e ?? "Deck optimisé avec tes meilleures cartes");
          }}
        >{isOptimal ? "Deck optimal ✓" : "Optimiser mon deck"}</button>
      )}

      <div className="row-head"><h2 className="section" style={{ fontSize: 26 }}>Passifs du deck</h2></div>
      <div className="panel">
        {carriers.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.4 }}>
            Aucun passif pour l’instant. Les cartes <b style={{ color: RARITY_COLOR.UR }}>UR</b> et <b style={{ color: RARITY_COLOR.LR }}>LR</b> donnent un bonus à tout ton deck.
          </div>
        ) : (
          <>
            {carriers.map((c) => (
              <div className="passrow" key={c.id}>
                <span>{exerciseBySlug(c.exerciseSlug).name} <b style={{ color: RARITY_COLOR[c.rarity] }}>{c.rarity}</b></span>
                <b>{passiveLabel(c.passive!).replace(" du deck", "")}</b>
              </div>
            ))}
            <div className="passrow" style={{ fontWeight: 700 }}>
              <span>Total</span>
              <b>{t.bonusAtqPct > 0 ? `+${fmtPct(t.bonusAtqPct)} ATQ` : ""}{t.bonusAtqPct > 0 && t.bonusDefPct > 0 ? " · " : ""}{t.bonusDefPct > 0 ? `+${fmtPct(t.bonusDefPct)} DEF` : ""}</b>
            </div>
          </>
        )}
      </div>

      <div className="row-head"><h2 className="section" style={{ fontSize: 26 }}>Bonus de combat</h2></div>
      <div className="panel">
        {deck.length >= 5 ? (
          <>
            <BonusLine cards={deck} />
            <div className="passrow" style={{ borderBottom: 0, marginTop: 6 }}><span>PV de l’équipe en combat</span><b>{fmt(teamHp(deck))}</b></div>
          </>
        ) : (
          <div style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.4 }}>En combat, deux cartes du même groupe se renforcent (+{DUEL.synergyPct[2]} % à +{DUEL.synergyPct[5]} %), et cinq groupes différents donnent +{DUEL.allGroupsPct} % à tout le deck.</div>
        )}
      </div>

      <div className="row-head"><h2 className="section" style={{ fontSize: 26 }}>Consigne de défense</h2></div>
      <div className="panel consignes">
        <p className="fine" style={{ margin: "0 0 10px" }}>Quand d’autres joueurs attaquent ton deck, il se défend seul avec cette consigne. +{DUEL.defenseGc} GC par attaque repoussée.</p>
        <div className="cons-row" role="radiogroup" aria-label="Consigne de défense">
          {CONSIGNES.map((c) => {
            const on = (g.extra.consigne ?? "equilibre") === c.id;
            return (
              <button key={c.id} role="radio" aria-checked={on} className={`cons ${on ? "on" : ""}`} onClick={() => { g.setConsigne(c.id); }}>
                <b>{c.name}</b><small>{c.desc}</small>
              </button>
            );
          })}
        </div>
      </div>

      <button className="panel combats" style={{ width: "100%", textAlign: "left" }} onClick={() => go("combats")} aria-label="Ouvrir Combats et classement">
        <Swords />
        <div className="t">Combats et classement<span>{deck.length >= 5 ? `${g.duelsLeft} duel${g.duelsLeft > 1 ? "s" : ""} disponible${g.duelsLeft > 1 ? "s" : ""} aujourd’hui.` : "Complète ton deck pour affronter les autres joueurs."}</span></div>
        <span className={`soon ${deck.length >= 5 && g.duelsLeft > 0 ? "live" : ""}`}>Jouer ›</span>
      </button>

      {picker && <DeckPicker onClose={() => setPicker(false)} />}
      {help && (
        <Sheet onClose={() => setHelp(false)} label="Comment fonctionne le deck">
          <div className="sheet-title">Ton GymDeck</div>
          <ul className="rules">
            <li>Ton deck contient <b>5 cartes</b>, avec <b>un seul exemplaire par exercice</b> (toutes raretés confondues).</li>
            <li>Son ATQ et sa DEF sont la somme des 5 cartes.</li>
            <li>Les <b>UR</b> et <b>LR</b> ont un passif : un bonus en % appliqué à <b>tout le deck</b>, carte porteuse comprise.</li>
            <li>Les bonus s’additionnent sur les stats de base.</li>
            <li>Une carte placée dans ton deck ne peut pas être défaussée.</li>
            <li>En combat, ton deck gagne des <b>synergies</b> : 2 cartes du même groupe +{DUEL.synergyPct[2]} %, 3 → +{DUEL.synergyPct[3]} %, 4 → +{DUEL.synergyPct[4]} %, 5 → +{DUEL.synergyPct[5]} % ; cinq groupes différents +{DUEL.allGroupsPct} %.</li>
          </ul>
          <button className="btn ghost small" onClick={() => setHelp(false)}>Compris</button>
        </Sheet>
      )}
    </div>
  );
}

/** Choix des 5 cartes : brouillon modifiable, totaux en direct, validation à la fin. */
function DeckPicker({ onClose }: { onClose: () => void }) {
  const g = useGame();
  const { player } = g;
  const [draft, setDraft] = useState<string[]>(player.deck);
  const byId = useMemo(() => new Map(player.cards.map((c) => [c.id, c])), [player.cards]);
  const draftCards = draft.map((id) => byId.get(id)).filter((c): c is OwnedCard => !!c);
  const t = deckTotals(draftCards);
  const before = deckPower(g.deckCards);
  const diff = deckPower(draftCards) - before;

  const groups = useMemo(() => {
    return EXERCISES.map((e) => ({
      ex: e,
      cards: player.cards
        .filter((c) => c.exerciseSlug === e.slug)
        .sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || b.atq + b.def - (a.atq + a.def)),
    })).filter((x) => x.cards.length > 0);
  }, [player.cards]);

  const toggle = (c: OwnedCard) => {
    if (draft.includes(c.id)) { setDraft(draft.filter((id) => id !== c.id)); return; }
    const same = draftCards.find((d) => d.exerciseSlug === c.exerciseSlug);
    if (same) { setDraft(draft.map((id) => (id === same.id ? c.id : id))); return; }
    if (draft.length >= DECK_SIZE) { g.say("Deck complet : retire d’abord une carte."); return; }
    sfx.place();
    setDraft([...draft, c.id]);
  };

  const save = () => {
    const e = g.setDeck(draft);
    if (e) { g.say(e); return; }
    g.say(draft.length === DECK_SIZE ? "Deck enregistré !" : `Deck enregistré (${draft.length}/${DECK_SIZE})`);
    onClose();
  };

  return (
    <Sheet onClose={onClose} variant="full" label="Choisir mes cartes">
      <div className="pickhead">
        <div className="top">
          <button className="backbtn" aria-label="Annuler" onClick={onClose}><IconBack width={22} height={22} /></button>
          <div className="sheet-title">Tes 5 cartes</div>
          <div className="cnt">{draft.length}/{DECK_SIZE}</div>
        </div>
        <div className="pickdraft">
          {Array.from({ length: DECK_SIZE }, (_, i) => {
            const c = draftCards[i];
            return c ? (
              <button key={c.id} aria-label={`Retirer ${exerciseBySlug(c.exerciseSlug).name}`} onClick={() => toggle(c)}><Card card={c} /></button>
            ) : <div key={i} className="e" />;
          })}
        </div>
        <div className="picktot">
          <span>ATQ {fmt(t.totalAtq)}</span>
          <span>DEF {fmt(t.totalDef)}</span>
          {diff !== 0 && <small style={{ color: diff > 0 ? "var(--lime)" : "#ff8a8a" }}>{diff > 0 ? "+" : ""}{fmt(diff)} de puissance</small>}
        </div>
      </div>

      <div className="picklist">
        {groups.length === 0 && <div className="empty">Tu n’as encore aucune carte.</div>}
        {groups.map(({ ex, cards }) => {
          const taken = draftCards.some((d) => d.exerciseSlug === ex.slug);
          return (
            <div className={`pickgroup ${taken ? "taken" : ""}`} key={ex.slug}>
              <h3>{ex.name}<small>{taken ? "dans ton deck" : `${cards.length} carte${cards.length > 1 ? "s" : ""}`}</small></h3>
              <div className="pickrow">
                {cards.map((c) => {
                  const sel = draft.includes(c.id);
                  return (
                    <button key={c.id} className={`pickcell ${sel ? "sel" : ""}`} aria-pressed={sel} onClick={() => toggle(c)}>
                      <Card card={c} />
                      {sel && <span className="ck">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pickfoot">
        <button className="btn ghost small" onClick={() => setDraft(bestDeckIds(player.cards))} disabled={player.cards.length === 0}>Auto</button>
        <button className="btn primary small" onClick={save}>Valider</button>
      </div>
    </Sheet>
  );
}
