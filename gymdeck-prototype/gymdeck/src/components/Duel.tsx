"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardBack } from "./Card";
import { useGame } from "./GameProvider";
import { IconBack } from "./Icons";
import { Sheet } from "./Sheet";
import { DUEL, RARITY_COLOR, exerciseBySlug } from "@/lib/config";
import { combatPower, deckBonus, groupOf, groupShort, type DuelRecord, type DuelResult, type Opponent, type RoundResult } from "@/lib/duel";
import type { CardData } from "@/lib/engine";
import { haptic, sfx } from "@/lib/sound";

const fmt = (n: number) => n.toLocaleString("fr-FR");
const Coin = ({ s = 16 }: { s?: number }) => <span className="coin" style={{ width: s, height: s, display: "inline-block", verticalAlign: "-3px", marginRight: 4 }} />;

/** Petite étiquette de groupe musculaire sous une carte. */
export function GroupTag({ card }: { card: CardData }) {
  const g = groupOf(card);
  return <span className={`gtag g-${g}`}>{groupShort(g)}</span>;
}

/** Résumé des bonus de combat d'un deck (synergies + passifs). */
export function BonusLine({ cards }: { cards: CardData[] }) {
  const b = deckBonus(cards);
  const parts: string[] = [];
  for (const s of b.groups) parts.push(`${groupShort(s.group)} ×${s.count} +${s.pct} %`);
  if (b.allDistinct) parts.push(`5 groupes +${DUEL.allGroupsPct} %`);
  if (b.passiveAtq > 0) parts.push(`Passifs +${b.passiveAtq.toFixed(1).replace(".", ",")} % ATQ`);
  if (b.passiveDef > 0) parts.push(`Passifs +${b.passiveDef.toFixed(1).replace(".", ",")} % DEF`);
  if (parts.length === 0) return <div className="bonusline none">Aucune synergie : regroupe 2 cartes du même groupe, ou prends 5 groupes différents.</div>;
  return <div className="bonusline">{parts.map((p) => <span key={p}>{p}</span>)}</div>;
}

type Step = "match" | "fight" | "result";
interface Fight { opp: Opponent; result: DuelResult; theirOrder: CardData[]; mine: CardData[]; record: DuelRecord }

/** Parcours complet d'un duel : adversaire + ordre caché → combat animé → résultat. */
export function DuelFlow({ onClose }: { onClose: () => void }) {
  const g = useGame();
  const [step, setStep] = useState<Step>("match");
  const [opp, setOpp] = useState<Opponent | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>(() => [...g.player.deck]);
  const [pick, setPick] = useState<number | null>(null);
  const [fight, setFight] = useState<Fight | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const find = () => {
    const r = g.findOpponent(seen.slice(-6));
    if ("error" in r) { setErr(r.error); return; }
    setOpp(r); setSeen((s) => [...s, r.name]); setErr(null);
    sfx.versus();
  };
  useEffect(() => { find(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = order.map((id) => g.player.cards.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c);
  const myPower = combatPower(mine);

  const tapSlot = (i: number) => {
    if (pick === null) { setPick(i); return; }
    if (pick !== i) { const o = [...order]; [o[pick], o[i]] = [o[i]!, o[pick]!]; setOrder(o); sfx.place(); }
    setPick(null);
  };

  const start = () => {
    if (!opp) return;
    const r = g.fight(order, opp);
    if ("error" in r) { setErr(r.error); sfx.error(); return; }
    setFight({ opp, result: r.result, theirOrder: r.theirOrder, mine, record: r.record });
    setStep("fight");
  };

  return (
    <Sheet onClose={() => { if (step !== "fight") onClose(); }} variant="full" label="Duel">
      {step === "match" && (
        <div className="fsheet duel-match">
          <div className="duel-top">
            <button className="backbtn" aria-label="Fermer" onClick={onClose}><IconBack width={22} height={22} /></button>
            <div className="sheet-title">Duel</div>
            <span className="duel-left">{g.duelsLeft} restant{g.duelsLeft > 1 ? "s" : ""}</span>
          </div>

          {opp ? (
            <motion.div key={opp.key} className="panel opp" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="opp-head">
                <span className="avatar">{opp.name[0]}</span>
                <div className="opp-name">{opp.name}<small>Puissance de combat {fmt(combatPower(opp.cards))}</small></div>
                <button className="btn ghost chipbtn" onClick={find}>Autre</button>
              </div>
              <div className="duel-cap">Son deck · ordre caché</div>
              <div className="duel-row">
                {[...opp.cards].sort((a, b) => b.atq + b.def - (a.atq + a.def)).map((c, i) => (
                  <div key={i} className="duel-cell"><Card card={c} holo={false} /><GroupTag card={c} /></div>
                ))}
              </div>
              <BonusLine cards={opp.cards} />
            </motion.div>
          ) : (
            <div className="panel opp"><div className="empty small">{err ?? "Recherche d’un adversaire…"}</div></div>
          )}

          <div className="vs-mid"><span>VS</span></div>

          <div className="panel mine">
            <div className="duel-cap">Ton ordre de combat · touche deux cartes pour les échanger</div>
            <div className="duel-row order">
              {mine.map((c, i) => (
                <button key={c.id} className={`duel-cell ${pick === i ? "picked" : ""}`} onClick={() => tapSlot(i)} aria-label={`Position ${i + 1} : ${exerciseBySlug(c.exerciseSlug).name}`}>
                  <span className="pos">{i + 1}</span>
                  <Card card={c} holo={false} />
                  <GroupTag card={c} />
                </button>
              ))}
            </div>
            <BonusLine cards={mine} />
            <div className="duel-power"><span>Ta puissance de combat</span><b>{fmt(myPower)}</b></div>
          </div>

          <p className="fine tri">Triangle : Pecs › Épaules › Dos › Pecs · Jambes › Abdos › Cardio › Jambes (+{DUEL.trianglePct} % sur la manche). Bras neutres.</p>
          {err && opp && <div className="autherr" role="alert">{err}</div>}
          <button className="btn primary" disabled={!opp || g.duelsLeft <= 0} onClick={start}>
            {g.duelsLeft <= 0 ? "Plus de duel aujourd’hui" : "Combattre !"}
          </button>
        </div>
      )}

      {step === "fight" && fight && <FightStage fight={fight} onEnd={() => setStep("result")} />}

      {step === "result" && fight && (
        <ResultStep
          fight={fight}
          left={g.duelsLeft}
          again={() => { setFight(null); setStep("match"); setPick(null); find(); }}
          close={onClose}
        />
      )}
    </Sheet>
  );
}

/* ───────────────────────── Combat animé ───────────────────────── */

type Phase = "reveal" | "clash" | "score";

function FightStage({ fight, onEnd }: { fight: Fight; onEnd: () => void }) {
  const { result, theirOrder, mine, opp } = fight;
  const g = useGame();
  const [r, setR] = useState(0);
  const [phase, setPhase] = useState<Phase>("reveal");
  const [shownTheirs, setShownTheirs] = useState<boolean[]>(theirOrder.map(() => false));
  const timers = useRef<number[]>([]);
  const ended = useRef(false);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const finish = () => { if (ended.current) return; ended.current = true; timers.current.forEach((t) => window.clearTimeout(t)); onEnd(); };

  useEffect(() => {
    const T = reduced ? 0.35 : 1;
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms * T));
    let t = 350;
    result.rounds.forEach((round, i) => {
      at(t, () => { setR(i); setPhase("reveal"); setShownTheirs((s) => s.map((v, k) => (k === i ? true : v))); sfx.flip(); });
      at(t + 520, () => { setPhase("clash"); sfx.hit(Math.abs(round.margin) >= DUEL.cap); haptic(18); });
      at(t + 760, () => { setPhase("score"); if (round.winner === "me") sfx.roundWin(); else if (round.winner === "them") sfx.roundLose(); });
      t += 1750;
    });
    at(t + 150, finish);
    return () => timers.current.forEach((x) => window.clearTimeout(x));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const done = result.rounds.slice(0, phase === "score" ? r + 1 : r);
  const myScore = done.filter((x) => x.winner === "me").length;
  const theirScore = done.filter((x) => x.winner === "them").length;
  const cur: RoundResult = result.rounds[r]!;

  return (
    <div className="fight">
      <div className="fight-head">
        <span className="fh-name them"><span className="avatar sm">{opp.name[0]}</span>{opp.name}</span>
        <span className="fh-score"><b className="them">{theirScore}</b> – <b className="me">{myScore}</b></span>
        <button className="link" onClick={finish}>Passer ›</button>
      </div>

      <div className="lineup them">
        {theirOrder.map((c, i) => (
          <div key={i} className={`lu ${i === r ? "cur" : ""} ${i < done.length ? (result.rounds[i]!.winner === "them" ? "won" : "lost") : ""}`}>
            {shownTheirs[i] ? <Card card={c} holo={false} /> : <div className="lu-back"><CardBack /></div>}
          </div>
        ))}
      </div>

      <div className="arena-mid">
        <div className="round-label">Manche {r + 1} / {result.rounds.length}</div>
        <Duelist card={cur.theirs} side="them" round={cur} phase={phase} shown={shownTheirs[r] ?? false} />
        <AnimatePresence>
          {phase !== "reveal" && (
            <motion.div key={`impact${r}`} className="impact" initial={{ scale: 0.3, opacity: 1 }} animate={{ scale: 2.4, opacity: 0 }} transition={{ duration: 0.55, ease: "easeOut" }} />
          )}
        </AnimatePresence>
        <Duelist card={cur.mine} side="me" round={cur} phase={phase} shown />
      </div>

      <div className="lineup me">
        {mine.map((c, i) => (
          <div key={i} className={`lu ${i === r ? "cur" : ""} ${i < done.length ? (result.rounds[i]!.winner === "me" ? "won" : "lost") : ""}`}>
            <Card card={c} holo={false} />
          </div>
        ))}
      </div>
      <div className="fight-foot"><span className="fh-name me">{g.player.name ?? "Toi"}</span><span className="fine">Les cartes frappent : ATQ (± {DUEL.noisePct} %) − DEF adverse</span></div>
    </div>
  );
}

function Duelist({ card, side, round, phase, shown }: { card: CardData; side: "me" | "them"; round: RoundResult; phase: Phase; shown: boolean }) {
  const mine = side === "me";
  const hit = mine ? round.myHit : round.theirHit;
  const adv = round.adv === side;
  const won = round.winner === side;
  const lost = round.winner !== "draw" && !won;
  const dir = mine ? -1 : 1;
  return (
    <motion.div
      key={`${side}-${round.i}`}
      className={`duelist ${side} ${phase === "score" ? (won ? "won" : lost ? "lost" : "") : ""}`}
      initial={{ y: mine ? 60 : -60, opacity: 0, scale: 0.9 }}
      animate={phase === "clash"
        ? { y: dir * -16, opacity: 1, scale: 1.04 }
        : phase === "score"
          ? { y: 0, opacity: lost ? 0.5 : 1, scale: won ? 1.06 : lost ? 0.92 : 1, rotate: lost ? (mine ? -4 : 4) : 0 }
          : { y: 0, opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 340, damping: 22 }}
    >
      <div className="dcard">
        <motion.div className="flipper" initial={{ rotateY: mine ? 180 : 0 }} animate={{ rotateY: shown ? 180 : 0 }} transition={{ duration: mine ? 0 : 0.45, delay: mine ? 0 : 0.08 }}>
          <div className="face back"><CardBack /></div>
          <div className="face front"><Card card={card} holo={false} /></div>
        </motion.div>
        {adv && phase !== "reveal" && (
          <motion.span className="advtag" initial={{ scale: 0 }} animate={{ scale: 1 }}>▲ +{DUEL.trianglePct} % · {groupShort(groupOf(card))}</motion.span>
        )}
      </div>
      <AnimatePresence>
        {phase === "score" && (
          <motion.div
            className={`hitnum ${hit > 0 ? "pos" : "neg"} ${won ? "win" : ""}`}
            initial={{ opacity: 0, y: mine ? 10 : -10, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            {hit > 0 ? `Frappe ${fmt(hit)}` : "Bloqué"}
            {won && <span className="crown">✓</span>}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="dname" style={{ color: RARITY_COLOR[card.rarity], visibility: mine || phase !== "reveal" ? "visible" : "hidden" }}>{card.rarity} <span>{exerciseBySlug(card.exerciseSlug).name}</span></div>
    </motion.div>
  );
}

/* ───────────────────────── Résultat ───────────────────────── */

function ResultStep({ fight, left, again, close }: { fight: Fight; left: number; again: () => void; close: () => void }) {
  const { result, record } = fight;
  const win = result.outcome === "win";
  const draw = result.outcome === "draw";
  useEffect(() => {
    if (win) { sfx.victory(); haptic([40, 40, 90]); } else sfx.defeat();
  }, [win]);
  const sparks = useMemo(() => Array.from({ length: win ? 26 : 0 }, (_, k) => ({ x: (Math.random() - 0.5) * 320, y: -60 - Math.random() * 220, d: 0.8 + Math.random() * 0.8, c: k % 3 === 0 ? "#fff" : k % 3 === 1 ? "#c8f31d" : "#8b5cf6" })), [win]);
  return (
    <div className="fsheet duel-result">
      <div className={`res-title ${win ? "win" : draw ? "draw" : "loss"}`}>
        {sparks.map((p, i) => (
          <motion.i key={i} className="res-spark" style={{ background: p.c }} initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: p.x, y: p.y, opacity: 0 }} transition={{ duration: p.d, ease: "easeOut" }} />
        ))}
        <motion.h2 initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}>
          {win ? "Victoire !" : draw ? "Égalité" : "Défaite"}
        </motion.h2>
        <div className="res-score">{result.myWins} – {result.theirWins}<small>contre {fight.opp.name}</small></div>
      </div>

      <div className="res-rewards">
        {record.gc > 0 && <span><Coin s={20} />+{record.gc} GC</span>}
        <span>+{record.pts} point{record.pts > 1 ? "s" : ""} de saison</span>
      </div>

      <div className="panel res-rounds">
        {result.rounds.map((rd) => (
          <div key={rd.i} className={`rr ${rd.winner}`}>
            <span className="rr-n">{rd.i + 1}</span>
            <span className="rr-c">{exerciseBySlug(rd.mine.exerciseSlug).name} <b style={{ color: RARITY_COLOR[rd.mine.rarity] }}>{rd.mine.rarity}</b></span>
            <span className="rr-v">{rd.winner === "me" ? "✓" : rd.winner === "them" ? "✗" : "="}</span>
            <span className="rr-c them">{exerciseBySlug(rd.theirs.exerciseSlug).name} <b style={{ color: RARITY_COLOR[rd.theirs.rarity] }}>{rd.theirs.rarity}</b></span>
          </div>
        ))}
      </div>
      {!win && <p className="fine" style={{ textAlign: "center" }}>Astuce : change l’ordre de tes cartes, et vise les avantages du triangle des groupes.</p>}
      <div className="acts-col">
        <button className="btn primary" disabled={left <= 0} onClick={again}>{left > 0 ? `Nouveau duel (${left} restant${left > 1 ? "s" : ""})` : "Plus de duel aujourd’hui"}</button>
        <button className="btn ghost small" onClick={close}>Retour</button>
      </div>
    </div>
  );
}
