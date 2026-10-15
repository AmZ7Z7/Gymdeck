"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Card, Medal, CardBack, Tilt, passiveLabel } from "@/components/Card";
import { Extensions } from "@/screens/Missions";
import { shareCards } from "@/lib/share";
import { GcPill, Wordmark } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { IconBack, IconNext, IconSearch } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import { CombatInfo } from "@/components/CombatBits";
import { sfx } from "@/lib/sound";
import { DISCARD_GC, EXERCISES, GRADE_LABEL, GRADE_PRICE, RARITIES, RARITY_COLOR, RARITY_RANK, exerciseBySlug, gradeColor, type Rarity } from "@/lib/config";
import { atWorkshop } from "@/lib/game";
import type { OpenPage } from "@/app/page";
import { formatDuration } from "@/components/Bits";
import { completion, duplicateIds, type OwnedCard } from "@/lib/game";

type Sort = "recent" | "rarity" | "atq" | "def";
/** Minuscules sans accents : « developpe » trouve « Développé ». */
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const SORTS: { id: Sort; label: string }[] = [
  { id: "recent", label: "Récentes" },
  { id: "rarity", label: "Rareté" },
  { id: "atq", label: "ATQ" },
  { id: "def", label: "DEF" },
];

const bestFirst = (a: OwnedCard, b: OwnedCard) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || b.atq + b.def - (a.atq + a.def);

export function Collection({ openPage }: { openPage: OpenPage }) {
  const g = useGame();
  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState<Rarity | null>(null);
  const [view, setView] = useState<"exercise" | "all" | "ext">("exercise");
  const [sort, setSort] = useState<Sort>("recent");
  const [detail, setDetail] = useState<{ slug: string; id: string } | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const { player } = g;
  const cards = player.cards;
  const comp = completion(player);
  const dups = useMemo(() => duplicateIds(player), [player]);
  const dupGain = dups.reduce((s, id) => s + DISCARD_GC[cards.find((c) => c.id === id)!.rarity], 0);

  const needle = norm(q);
  const filtered = useMemo(
    () => cards.filter((c) => (!rarity || c.rarity === rarity) && (!needle || norm(exerciseBySlug(c.exerciseSlug).name).includes(needle))),
    [cards, rarity, needle],
  );

  const allSorted = useMemo(() => {
    const l = [...filtered];
    if (sort === "recent") l.sort((a, b) => b.obtainedSeq - a.obtainedSeq);
    else if (sort === "rarity") l.sort(bestFirst);
    else if (sort === "atq") l.sort((a, b) => b.atq - a.atq);
    else l.sort((a, b) => b.def - a.def);
    return l;
  }, [filtered, sort]);

  // Une case par exercice : la meilleure carte (de la rareté choisie le cas échéant), ou une case « à découvrir ».
  const slots = useMemo(() => {
    return EXERCISES
      .filter((e) => !needle || norm(e.name).includes(needle))
      .map((e) => {
        const list = filtered.filter((c) => c.exerciseSlug === e.slug).sort(bestFirst);
        return { slug: e.slug, name: e.name, best: list[0] ?? null, count: list.length };
      });
  }, [filtered, needle]);

  const inDeck = (id: string) => player.deck.includes(id);
  const rarityOwned = rarity ? slots.filter((s) => s.best).length : null;

  return (
    <div className="screen">
      <div className="topbar"><Wordmark /><GcPill gc={player.gc} /></div>
      <h1 className="title" style={{ marginTop: 14, marginBottom: 8 }}>Ma collection</h1>
      <div className="statsline">
        <span><b>{comp.owned} / {comp.total}</b> cartes uniques · {cards.length} au total</span>
      </div>
      <div className="progress" style={{ marginBottom: 12 }}><i style={{ width: `${(comp.owned / comp.total) * 100}%` }} /></div>

      {view !== "ext" && (<>
      <label className="search">
        <IconSearch />
        <input placeholder="Rechercher un exercice…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un exercice" />
      </label>
      <div className="chips">
        <button className={`chip ${rarity === null ? "on" : ""}`} onClick={() => setRarity(null)}>Toutes</button>
        {RARITIES.map((r) => (
          <button key={r} className={`chip ${rarity === r ? "on" : ""}`} style={{ ["--c" as string]: RARITY_COLOR[r] }} onClick={() => setRarity(rarity === r ? null : r)}>{r}</button>
        ))}
      </div>

      </>)}

      <div className="seg three">
        <button className={view === "exercise" ? "on" : ""} onClick={() => setView("exercise")}>Par exercice</button>
        <button className={view === "all" ? "on" : ""} onClick={() => setView("all")}>Toutes</button>
        <button className={view === "ext" ? "on" : ""} onClick={() => setView("ext")}>Extensions</button>
      </div>

      {view === "all" && (
        <div className="sortrow" role="group" aria-label="Trier">
          {SORTS.map((s) => <button key={s.id} className={sort === s.id ? "on" : ""} onClick={() => setSort(s.id)}>{s.label}</button>)}
        </div>
      )}
      {view === "exercise" && rarity && (
        <div className="statsline"><span>Rareté <b style={{ color: RARITY_COLOR[rarity] }}>{rarity}</b> : <b>{rarityOwned} / {slots.length}</b> exercices</span></div>
      )}

      {view === "ext" ? (
        <Extensions />
      ) : cards.length === 0 ? (
        <div className="empty">Ta collection est vide. Ouvre un booster depuis l’accueil !</div>
      ) : view === "exercise" && slots.length === 0 ? (
        <div className="empty">Aucun exercice ne correspond à « {q.trim()} ».</div>
      ) : view === "exercise" ? (
        <div className="cgrid">
          {slots.map((s) => s.best ? (
            <button className="ccell" key={s.slug} onClick={() => setDetail({ slug: s.slug, id: s.best!.id })}>
              <Card card={s.best} count={s.count} />
              {inDeck(s.best.id) && <span className="deckbadge">DECK</span>}
              {atWorkshop(player, s.best.id) && <span className="deckbadge lab">CHEZ BASILE</span>}
            </button>
          ) : (
            <div className="ccell ghost" key={s.slug} aria-label={`${s.name} : pas encore obtenu`}>
              <div className="card"><CardBack /></div>
              <span className="ghostlab">?</span>
              <div className="nm">{s.name}</div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">Aucune carte ne correspond.</div>
      ) : (
        <div className="cgrid">
          {allSorted.map((c) => (
            <button className="ccell" key={c.id} onClick={() => setDetail({ slug: c.exerciseSlug, id: c.id })}>
              <Card card={c} />
              {inDeck(c.id) && <span className="deckbadge">DECK</span>}
              {atWorkshop(player, c.id) && <span className="deckbadge lab">CHEZ BASILE</span>}
            </button>
          ))}
        </div>
      )}

      {dups.length > 0 && (
        <button className="btn ghost small" style={{ marginTop: 18 }} onClick={() => setCleaning(true)}>
          Nettoyer les doublons ({dups.length}) · +{dupGain} GC
        </button>
      )}

      {detail && <Detail slug={detail.slug} startId={detail.id} onClose={() => setDetail(null)} onGrade={(id) => { setDetail(null); openPage("atelier", id); }} />}

      {cleaning && (
        <Sheet onClose={() => setCleaning(false)} label="Nettoyer les doublons">
          <div className="sheet-title">Nettoyer les doublons</div>
          <p>Pour chaque exercice et chaque rareté, on garde ta <b>meilleure carte</b>. {dups.length > 1 ? `Les ${dups.length} cartes en trop sont défaussées` : "La carte en trop est défaussée"} pour <b style={{ color: "var(--lime)" }}>+{dupGain} GC</b>. Les cartes de ton deck ne sont jamais touchées.</p>
          <p className="fine">Action définitive.</p>
          <button
            className="btn primary"
            onClick={() => {
              const r = g.discardMany(dups);
              setCleaning(false);
              g.say("gained" in r ? `${r.count} doublons défaussés · +${r.gained} GC` : r.error);
            }}
          >Défausser · +{dupGain} GC</button>
          <button className="btn ghost small" onClick={() => setCleaning(false)}>Annuler</button>
        </Sheet>
      )}
    </div>
  );
}

/** Détail : navigation entre les exemplaires d'un même exercice, deck et défausse. */
function Detail({ slug, startId, onClose, onGrade }: { slug: string; startId: string; onClose: () => void; onGrade: (cardId: string) => void }) {
  const g = useGame();
  const copies = useMemo(
    () => g.player.cards.filter((c) => c.exerciseSlug === slug).sort(bestFirst),
    [g.player.cards, slug],
  );
  const [i, setI] = useState(Math.max(0, copies.findIndex((c) => c.id === startId)));
  const [confirm, setConfirm] = useState(false);
  const card = copies[Math.min(i, copies.length - 1)];

  useEffect(() => { if (!card) onClose(); }, [card, onClose]);
  if (!card) return null;
  const inDeck = g.player.deck.includes(card.id);
  const swapWith = !inDeck ? g.deckCards.find((c) => c.exerciseSlug === slug) : undefined;
  const deckFull = g.player.deck.length >= 5;
  const job = g.grading.find((j) => j.cardId === card.id);
  const lab = !!job;

  return (
    <Sheet onClose={onClose} variant="center" label={exerciseBySlug(slug).name}>
      <motion.div key={card.id} className="cardwrap" initial={{ rotateY: -28, scale: 0.9, opacity: 0 }} animate={{ rotateY: 0, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} style={{ transformPerspective: 900 }}>
        <Tilt><Card card={card} /></Tilt>
      </motion.div>
      <div style={{ textAlign: "center", fontSize: 15, color: "#cfd6e8" }}>
        {exerciseBySlug(card.exerciseSlug).name} · <b style={{ color: RARITY_COLOR[card.rarity] }}>{card.rarity}</b>
        {card.passive && <div style={{ color: "var(--lime)", marginTop: 4 }}>Passif : {passiveLabel(card.passive)}</div>}
        {card.grade ? <div style={{ marginTop: 4 }}><Medal grade={card.grade} className="sm" />Note de Basile : <b style={{ color: gradeColor(card.grade) }}>{card.grade}/10 · {GRADE_LABEL[card.grade]}</b></div> : null}
        {job && <div style={{ marginTop: 4, color: "#ffd27a" }}>Chez Basile : {g.gameNow() >= job.readyAt ? "note prête !" : `note dans ${formatDuration(job.readyAt - g.gameNow())}`}</div>}
      </div>
      <CombatInfo card={card} />
      <div className="acts">
        {copies.length > 1 && (
          <div className="navrow">
            <button aria-label="Exemplaire précédent" onClick={() => { setConfirm(false); setI((i - 1 + copies.length) % copies.length); }}><IconBack width={24} height={24} /></button>
            <span>Exemplaire {Math.min(i, copies.length - 1) + 1} / {copies.length}</span>
            <button aria-label="Exemplaire suivant" onClick={() => { setConfirm(false); setI((i + 1) % copies.length); }}><IconNext width={24} height={24} /></button>
          </div>
        )}
        <button
          className={`btn small ${inDeck ? "ghost" : "primary"}`}
          disabled={!inDeck && !swapWith && deckFull}
          onClick={() => { const r = g.toggleDeck(card.id); g.say(r.msg); }}
        >
          {inDeck ? "Retirer de mon deck" : swapWith ? "Remplacer dans mon deck" : deckFull ? "Deck complet" : "Mettre dans mon deck"}
        </button>
        {!card.grade && (
          <button className="btn ghost small" onClick={() => onGrade(card.id)}>{lab ? "Voir à l’atelier" : `Faire expertiser · ${GRADE_PRICE[card.rarity]} GC`}</button>
        )}
        {lab ? (
          <div className="hint" style={{ margin: 0 }}>Pendant l’expertise, la carte ne peut pas être défaussée.</div>
        ) : inDeck ? (
          <div className="hint" style={{ margin: 0 }}>Retire cette carte du deck pour pouvoir la défausser.</div>
        ) : confirm ? (
          <button className="btn primary small" onClick={() => {
            const r = g.discard(card.id);
            setConfirm(false);
            if ("gained" in r) { sfx.coin(); g.say(`+${r.gained} GC`); }
            else g.say(r.error);
          }}>Confirmer · +{DISCARD_GC[card.rarity]} GC</button>
        ) : (
          <button className="btn ghost small" onClick={() => setConfirm(true)}>Défausser · +{DISCARD_GC[card.rarity]} GC</button>
        )}
        <div className="two">
          <button className="btn ghost small" onClick={async () => g.say(await shareCards([card], g.player.name ?? "Joueur"))}>Partager</button>
          <button className="btn ghost small" onClick={() => { const r = g.toggleShowcase(card.id); g.say(r ?? (g.extra.showcase.includes(card.id) ? "Retirée de ta vitrine" : "Ajoutée à ta vitrine")); }}>
            {g.extra.showcase.includes(card.id) ? "Hors vitrine" : "En vitrine"}
          </button>
        </div>
        <button className="btn ghost small" onClick={onClose}>Fermer</button>
      </div>
    </Sheet>
  );
}
