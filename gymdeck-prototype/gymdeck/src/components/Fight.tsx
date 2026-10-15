"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardBack } from "./Card";
import { useGame } from "./GameProvider";
import { GroupIcon, IconBack, IconBolt } from "./Icons";
import { Sheet } from "./Sheet";
import { BonusLine, CapIcon, CombatInfo, RulesBody } from "./CombatBits";
import { DUEL, RARITY_COLOR, exerciseBySlug, type Posture } from "@/lib/config";
import {
  POSTURE_INFO, aiMove, capCheck, capacityOf, capacityText, groupOf, makeFighter, playRound, startFight, teamHp,
  type DuelRecord, type FCard, type Fight, type Move, type Opponent, type RoundLog, type SideRound,
} from "@/lib/duel";
import type { CardData } from "@/lib/engine";
import { secureRng } from "@/lib/rng";
import { shareVictory } from "@/lib/share";
import { haptic, sfx } from "@/lib/sound";

const fmt = (n: number) => Math.max(0, Math.round(n)).toLocaleString("fr-FR");
const Coin = ({ s = 16 }: { s?: number }) => <span className="coin" style={{ width: s, height: s, display: "inline-block", verticalAlign: "-3px", marginRight: 4 }} />;

type Step = "match" | "fight" | "result";

/** Parcours d'un combat : adversaire → combat manche par manche → résultat. `friend` = id d'un ami (duel amical). */
export function CombatFlow({ onClose, friend }: { onClose: () => void; friend?: string }) {
  const g = useGame();
  const [step, setStep] = useState<Step>("match");
  const [opp, setOpp] = useState<Opponent | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [searching, setSearching] = useState(true);
  const [start, setStart] = useState<Fight | null>(null);
  const [end, setEnd] = useState<{ fight: Fight; record: DuelRecord } | null>(null);
  const [quit, setQuit] = useState(false);
  const [rules, setRules] = useState(false);
  const live = useRef<Fight | null>(null);

  const find = () => {
    setSearching(true);
    setErr(null);
    // laisse s'afficher « Recherche… » : le choix simule des centaines de combats
    window.setTimeout(() => {
      const r = friend ? g.friendOpponent(friend) : g.findOpponent(seen.slice(-6));
      setSearching(false);
      if ("error" in r) { setErr(r.error); return; }
      setOpp(r); setSeen((s) => [...s, r.name]);
      sfx.versus();
    }, 60);
  };
  useEffect(() => { find(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const go = () => {
    if (!opp) return;
    if (!opp.friendly) { const e = g.beginDuel(); if (e) { setErr(e); sfx.error(); return; } }
    const f = startFight(makeFighter(g.player.name ?? "Toi", g.deckCards, g.extra.consigne ?? "equilibre"), makeFighter(opp.name, opp.cards, opp.consigne));
    live.current = f;
    setStart(f);
    setStep("fight");
  };
  const finish = (f: Fight) => {
    const record = g.endDuel(f, opp!);
    setEnd({ fight: f, record });
    setStep("result");
  };
  const abandon = () => {
    const f = live.current ?? start!;
    setQuit(false);
    finish({ ...f, over: true, outcome: "loss", ko: null });
  };
  const again = () => { setEnd(null); setStart(null); setOpp(null); setStep("match"); find(); };

  const mine = g.deckCards;
  const left = g.duelsLeft;

  return (
    <Sheet onClose={() => (step === "fight" ? setQuit(true) : onClose())} variant="full" label="Combat">
      {step === "match" && (
        <div className="fsheet cmatch">
          <div className="duel-top">
            <button className="backbtn" aria-label="Fermer" onClick={onClose}><IconBack width={22} height={22} /></button>
            <div className="sheet-title">{friend ? "Duel amical" : "Combat"}</div>
            {!friend ? <span className="duel-left">{left} restant{left > 1 ? "s" : ""}</span> : <span />}
          </div>

          {opp && !searching ? (
            <motion.div key={opp.key} className="panel opp" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="opp-head">
                <span className="avatar">{opp.name[0]}</span>
                <div className="opp-name">{opp.name}<small>{opp.friendly ? "Decks de même puissance · sans récompense" : "Combat équilibré · chances proches de 50 %"}</small></div>
                {!friend && <button className="btn ghost chipbtn" onClick={find}>Autre</button>}
              </div>
              <div className="duel-cap">Son équipe · cartes cachées, groupes visibles</div>
              <div className="backrow">
                {opp.cards.map((c, i) => (
                  <div key={i} className="minib"><CardBack /><span className={`gchip g-${groupOf(c)}`}><GroupIcon id={groupOf(c)} /></span></div>
                ))}
              </div>
              <div className="opp-hp"><span>PV de l’équipe</span><b>{fmt(teamHp(opp.cards))}</b></div>
            </motion.div>
          ) : (
            <div className="panel opp searching">
              {err ? <div className="empty small">{err}</div> : <><span className="spinner" /><div className="empty small">Recherche d’un adversaire à ta mesure…</div></>}
            </div>
          )}

          <div className="vs-mid"><span>VS</span></div>

          <div className="panel mine">
            <div className="duel-cap">Ton équipe</div>
            <div className="duel-row">{mine.map((c) => <div key={c.id} className="duel-cell"><Card card={c} holo={false} /></div>)}</div>
            <BonusLine cards={mine} />
            <div className="opp-hp"><span>PV de l’équipe</span><b>{fmt(teamHp(mine))}</b></div>
          </div>

          {err && opp && <div className="autherr" role="alert">{err}</div>}
          <button className="btn primary" disabled={!opp || searching || (!friend && left <= 0)} onClick={go}>
            {!friend && left <= 0 ? "Plus de duel aujourd’hui" : "Combattre !"}
          </button>
          <button className="link" style={{ justifySelf: "center" }} onClick={() => setRules(true)}>Règles des combats ›</button>
        </div>
      )}

      {step === "fight" && start && opp && (
        <FightScreen initial={start} opp={opp} onUpdate={(f) => { live.current = f; }} onDone={finish} onQuit={() => setQuit(true)} />
      )}

      {step === "result" && end && opp && (
        <ResultView fight={end.fight} record={end.record} opp={opp} left={g.duelsLeft} friendly={!!friend} again={again} close={onClose} />
      )}

      {quit && (
        <Sheet onClose={() => setQuit(false)} label="Abandonner ?">
          <div className="sheet-title">Abandonner le combat ?</div>
          <p style={{ color: "#cfd6e8", margin: "6px 0 14px" }}>{opp?.friendly ? "Le duel amical s’arrête là." : "Le combat compte comme une défaite (le duel est déjà utilisé)."}</p>
          <div className="acts-col">
            <button className="btn primary small" onClick={() => setQuit(false)}>Continuer le combat</button>
            <button className="btn ghost small" onClick={abandon}>Abandonner</button>
          </div>
        </Sheet>
      )}
      {rules && <RulesSheet onClose={() => setRules(false)} />}
    </Sheet>
  );
}

export function RulesSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet onClose={onClose} label="Règles des combats">
      <div className="sheet-title">Règles des combats</div>
      <RulesBody />
      <button className="btn primary small" style={{ marginTop: 14 }} onClick={onClose}>Compris</button>
    </Sheet>
  );
}

/* ───────────────────────── Barres de vie et jauge ───────────────────────── */

function HealthBar({ hp, max, side }: { hp: number; max: number; side: "me" | "them" }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  const [trail, setTrail] = useState(pct);
  const [hit, setHit] = useState(0);
  const prev = useRef(pct);
  useEffect(() => {
    if (pct < prev.current - 0.01) {
      setHit((h) => h + 1);
      const t = window.setTimeout(() => setTrail(pct), 450);
      prev.current = pct;
      return () => window.clearTimeout(t);
    }
    prev.current = pct;
    setTrail(pct);
  }, [pct]);
  const col = pct > 50 ? "ok" : pct > 25 ? "mid" : "low";
  return (
    <div key={hit} className={`hpbar ${side} ${col} ${hit ? "hpshake" : ""}`} role="meter" aria-label="Points de vie" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.max(0, Math.round(hp))}>
      <div className="hp-track">
        <i className="hp-trail" style={{ width: `${Math.max(trail, pct)}%` }} />
        <i className="hp-fill" style={{ width: `${pct}%` }} />
        <span className="hp-shine" />
      </div>
      <span className="hp-txt">{fmt(hp)} <small>/ {fmt(max)} PV</small></span>
    </div>
  );
}

function Gauge({ v, used }: { v: number; used: boolean }) {
  const full = v >= 1 && !used;
  return (
    <div className={`gauge ${full ? "full" : ""} ${used ? "used" : ""}`} aria-label={used ? "Capacité utilisée" : `Jauge ${Math.round(v * 100)} %`}>
      <IconBolt />
      <div className="g-track"><i style={{ width: `${used ? 0 : Math.round(Math.min(1, v) * 100)}%` }} /></div>
      <small>{used ? "utilisée" : full ? "PLEINE" : `${Math.round(v * 100)} %`}</small>
    </div>
  );
}

/** Éclairs qui courent sur le bouton de capacité quand la jauge est pleine. */
function Bolts() {
  return (
    <span className="bolts" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <svg key={i} viewBox="0 0 40 20" className={`bolt b${i}`}><path d="M1 10 9 4l3 7 8-9 2 8 8-6 3 9 6-5" /></svg>
      ))}
    </span>
  );
}

/* ───────────────────────── Combat ───────────────────────── */

type Phase = "choose" | "reveal" | "cap" | "clash" | "after";

const TUTO: { t: string; d: string }[] = [
  { t: "Ton premier combat", d: "Chaque équipe a des PV (la barre en haut et en bas). Le premier à 0 perd. Sinon, après 5 manches, celui qui a le plus de PV gagne." },
  { t: "1. Choisis une carte", d: "Touche une carte de ta main. Chaque carte ne sert qu’une fois. Touche-la encore pour voir sa capacité." },
  { t: "2. Choisis une posture", d: "Force frappe fort, Garde encaisse, Technique punit la Force. Ton adversaire choisit en même temps que toi." },
  { t: "3. Combats !", d: "Les deux cartes sont révélées en même temps. Regarde les dégâts et la barre de vie." },
  { t: "La jauge", d: "L’éclair se remplit à chaque manche, plus vite quand tu prends des coups. Pleine, elle lance la capacité de ta carte : une fois par combat." },
  { t: "Jauge pleine !", d: "Choisis ta carte, puis touche le bouton Capacité avant de combattre. Les cartes C, R et SR lancent Second souffle (×1,25)." },
];

function FightScreen({ initial, opp, onUpdate, onDone, onQuit }: {
  initial: Fight; opp: Opponent; onUpdate: (f: Fight) => void; onDone: (f: Fight) => void; onQuit: () => void;
}) {
  const g = useGame();
  const [f, setF] = useState(initial);
  const [shown, setShown] = useState(initial);
  const [sel, setSel] = useState<string | null>(null);
  const [posture, setPosture] = useState<Posture | null>(null);
  const [cap, setCap] = useState(false);
  const [phase, setPhase] = useState<Phase>("choose");
  const [log, setLog] = useState<RoundLog | null>(null);
  const [detail, setDetail] = useState<FCard | null>(null);
  const [tuto, setTuto] = useState(g.extra.combatTutoDone ? -1 : 0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // coup de l'IA de la manche : décidé au début de la manche, sans voir le choix du joueur
  const ai: Move = useMemo(() => aiMove(f, "them", secureRng), [f.round]); // eslint-disable-line react-hooks/exhaustive-deps

  const selCard = f.me.hand.find((x) => x.key === sel) ?? null;
  const check = sel ? capCheck(f, "me", sel) : { ok: false, reason: f.me.capUsed ? "Capacité déjà utilisée." : "Choisis une carte." };
  const capInfo = selCard ? capacityOf(selCard.card) : null;
  const feintOn = cap && capInfo?.kind === "feint";
  const gaugeFull = f.me.gauge >= 1 && !f.me.capUsed;

  // guide : avance tout seul quand le joueur fait l'action demandée
  useEffect(() => {
    if (tuto === 1 && sel) setTuto(posture ? 3 : 2);
    else if (tuto === 2 && posture) setTuto(3);
  }, [sel, posture, tuto]);
  useEffect(() => {
    if (phase !== "choose") return;
    if (tuto === 3 && f.round >= 1) setTuto(4);
    else if (tuto === 98 && gaugeFull) setTuto(5);
  }, [phase, f.round, gaugeFull, tuto]);
  const closeTuto = () => { setTuto(-1); g.finishCombatTuto(); };
  const nextTuto = () => {
    if (tuto === 0) setTuto(1);
    else if (tuto === 4) setTuto(gaugeFull ? 5 : 98);
    else if (tuto === 5) closeTuto();
  };

  const tap = (c: FCard) => {
    if (phase !== "choose") return;
    if (sel === c.key) { setDetail(c); return; }
    setSel(c.key); setCap(false); sfx.place();
  };

  const fightRound = () => {
    if (!sel || !posture || phase !== "choose") return;
    const next = playRound(f, { key: sel, posture, cap: cap && check.ok }, ai, secureRng);
    onUpdate(next);
    const lg = next.log[next.log.length - 1]!;
    setLog(lg);
    setPhase("reveal");
    sfx.flip();
    const T = reduced ? 0.4 : 1;
    let t = 700;
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms * T));
    if (lg.me.cap || lg.them.cap) {
      at(t, () => { setPhase("cap"); sfx.charge(0.6); haptic(25); });
      t += 950;
    }
    at(t, () => {
      setPhase("clash"); setShown(next);
      sfx.hit(lg.me.capped || lg.them.capped || lg.me.dealt > lg.them.dealt * 1.6);
      haptic(lg.them.dealt > 0.25 * f.me.maxHp ? [30, 30, 50] : 20);
    });
    at(t + 1300, () => setPhase("after"));
    if (next.over) at(t + 2300, () => onDone(next));
    else at(t + 2200, () => { setF(next); setShown(next); setLog(null); setSel(null); setCap(false); setPhase("choose"); });
  };

  const meLog = log?.me, themLog = log?.them;
  const revealed = phase !== "choose";
  const myCard = revealed ? meLog!.card : selCard;
  const theirCard = revealed ? themLog!.card : null;
  const round = Math.min(f.round + 1, DUEL.rounds);

  return (
    <div className="combat">
      {/* adversaire */}
      <div className="chud them">
        <div className="chud-top">
          <span className="avatar sm">{opp.name[0]}</span>
          <b className="chud-name">{opp.name}</b>
          <Gauge v={shown.them.gauge} used={shown.them.capUsed} />
        </div>
        <HealthBar hp={shown.them.hp} max={shown.them.maxHp} side="them" />
      </div>
      <div className="chand them">
        {f.them.hand.map((c) => (
          <div key={c.key} className={`minib ${revealed && themLog?.card.key === c.key ? "gone" : ""}`}>
            <CardBack />
            <span className={`gchip g-${groupOf(c.card)}`}><GroupIcon id={groupOf(c.card)} /></span>
            {c.replay && <span className="rp">{Math.round((c.atq / Math.max(1, c.card.atq)) * 100)} %</span>}
          </div>
        ))}
        {f.them.used.length > 0 && <Pile cards={f.them.used} />}
      </div>

      {/* tapis */}
      <div className={`mat ph-${phase}`}>
        <div className="mat-round">Manche {round} / {DUEL.rounds}<button className="link" onClick={onQuit}>Abandonner</button></div>
        <div className="mslots">
          <Slot side="me" card={myCard} log={meLog ?? null} foe={themLog ?? null} phase={phase} preview={!revealed} posture={revealed ? meLog!.posture : posture} cap={revealed ? meLog!.cap : cap && check.ok ? capInfo : null} maxFoe={f.them.maxHp} />
          <Slot side="them" card={theirCard} log={themLog ?? null} foe={meLog ?? null} phase={phase} preview={false} posture={revealed ? themLog!.posture : feintOn ? ai.posture : null} cap={revealed ? themLog!.cap : null} hint={feintOn && !revealed ? "Feinte : tu vois sa posture" : undefined} maxFoe={f.me.maxHp} />
        </div>
      </div>

      {/* moi */}
      <div className="chud me">
        <HealthBar hp={shown.me.hp} max={shown.me.maxHp} side="me" />
        <div className="chud-top">
          <span className="avatar sm">{(g.player.name ?? "?")[0]!.toUpperCase()}</span>
          <b className="chud-name">{g.player.name ?? "Toi"}</b>
          <Gauge v={shown.me.gauge} used={shown.me.capUsed} />
        </div>
      </div>

      <div className="postures" role="radiogroup" aria-label="Posture">
        {(["force", "technique", "garde"] as Posture[]).map((p) => (
          <button key={p} role="radio" aria-checked={posture === p} className={`pbtn p-${p} ${posture === p ? "on" : ""}`} disabled={phase !== "choose"} onClick={() => { setPosture(p); }}>
            <b>{POSTURE_INFO[p].name}</b><small>{POSTURE_INFO[p].short}</small>
          </button>
        ))}
      </div>

      <div className="chand me">
        {f.me.hand.map((c) => (
          <button key={c.key} className={`hc ${sel === c.key ? "sel" : ""} ${revealed && meLog?.card.key === c.key ? "gone" : ""}`} onClick={() => tap(c)} disabled={phase !== "choose"} aria-pressed={sel === c.key} aria-label={`${exerciseBySlug(c.card.exerciseSlug).name} ${c.card.rarity}`}>
            <Card card={c.replay ? { ...c.card, atq: c.atq, def: c.def } : c.card} holo={false} />
            {c.replay && <span className="rp">Rejouée</span>}
          </button>
        ))}
        {f.me.used.length > 0 && <Pile cards={f.me.used} />}
      </div>

      <div className="cacts">
        <button
          className={`capbtn ${gaugeFull ? "ready" : ""} ${cap ? "on" : ""}`}
          style={{ ["--cc" as string]: capInfo?.color ?? "#c8f31d" }}
          disabled={!check.ok || phase !== "choose"}
          aria-pressed={cap}
          onClick={() => { setCap((v) => !v); sfx.charge(0.35); haptic(12); }}
        >
          <span className="capfill" style={{ width: `${f.me.capUsed ? 0 : Math.round(Math.min(1, f.me.gauge) * 100)}%` }} />
          {capInfo ? <CapIcon kind={capInfo.kind} /> : <IconBolt />}
          <span className="capt">
            <b>{cap ? "Capacité activée" : capInfo && gaugeFull ? capInfo.name : gaugeFull ? "Capacité prête" : "Capacité"}</b>
            <small>{f.me.capUsed ? "Déjà utilisée" : !gaugeFull ? `Jauge ${Math.round(f.me.gauge * 100)} %` : check.ok ? capacityText(capInfo!.kind, capInfo!.value) : check.reason}</small>
          </span>
          {gaugeFull && phase === "choose" && <Bolts />}
        </button>
        <button className="btn primary fightbtn" disabled={!sel || !posture || phase !== "choose"} onClick={fightRound}>
          {!sel ? <small>Choisis une carte</small> : !posture ? <small>Choisis une posture</small> : "Combattre"}
        </button>
      </div>

      <AnimatePresence>
        {tuto >= 0 && tuto < TUTO.length && phase === "choose" && (
          <motion.div key={tuto} className={`coach c${tuto}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <b>{TUTO[tuto]!.t}</b>
            <span>{TUTO[tuto]!.d}</span>
            <div className="coach-acts">
              <button className="link" onClick={closeTuto}>Passer le guide</button>
              {(tuto === 0 || tuto === 4 || tuto === 5) && <button className="btn primary chipbtn" onClick={nextTuto}>{tuto === 5 ? "Compris" : "Suivant"}</button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {detail && (
        <Sheet onClose={() => setDetail(null)} variant="center" label={exerciseBySlug(detail.card.exerciseSlug).name}>
          <div className="cardwrap" style={{ width: "58%" }}><Card card={detail.replay ? { ...detail.card, atq: detail.atq, def: detail.def } : detail.card} /></div>
          <div className="combat-stats">ATQ de combat <b>{detail.atq}</b> · DEF de combat <b>{detail.def}</b><small>(passifs et synergies compris)</small></div>
          <CombatInfo card={detail.card} />
          <button className="btn primary small" onClick={() => setDetail(null)}>Fermer</button>
        </Sheet>
      )}
    </div>
  );
}

function Pile({ cards }: { cards: FCard[] }) {
  return (
    <div className="pile" aria-label={`${cards.length} carte${cards.length > 1 ? "s" : ""} jouée${cards.length > 1 ? "s" : ""}`}>
      {cards.slice(-3).map((c, i) => <div key={c.key} className="pc" style={{ transform: `translate(${i * 3}px, ${i * -3}px) rotate(${(i - 1) * 6}deg)` }}><Card card={c.card} holo={false} cap={false} /></div>)}
      <span>{cards.length}</span>
    </div>
  );
}

function Slot({ side, card, log, foe, phase, preview, posture, cap, hint, maxFoe }: {
  side: "me" | "them"; card: FCard | null; log: SideRound | null; foe: SideRound | null; phase: Phase; preview: boolean;
  posture: Posture | null; cap: ReturnType<typeof capacityOf> | null; hint?: string; maxFoe: number;
}) {
  const me = side === "me";
  const showFace = !!card && (me || phase !== "choose");
  const clash = phase === "clash" || phase === "after";
  const taken = foe && clash ? foe.dealt : 0; // dégâts reçus par ce côté
  return (
    <div className={`mslot ${side} ${preview ? "preview" : ""} ${clash && taken > 0 ? "hit" : ""}`}>
      <motion.div
        className="slot-card"
        key={card?.key ?? "empty"}
        initial={me ? { y: 30, opacity: 0 } : { y: -30, opacity: 0 }}
        animate={phase === "clash" ? { y: 0, x: me ? 14 : -14, opacity: 1, scale: 1.04 } : { y: 0, x: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 360, damping: 22 }}
      >
        {card ? (
          <div className="flip">
            <motion.div className="flipper" initial={false} animate={{ rotateY: showFace ? 180 : 0 }} transition={{ duration: me ? 0 : 0.45 }}>
              <div className="face back"><CardBack /></div>
              <div className="face front"><Card card={card.replay ? { ...card.card, atq: card.atq, def: card.def } : card.card} holo={false} /></div>
            </motion.div>
          </div>
        ) : (
          <div className="slot-empty">{me ? "Ta carte" : <><CardBack /><span>?</span></>}</div>
        )}
        {log?.adv && phase !== "reveal" && phase !== "choose" && <span className="advtag">+{DUEL.trianglePct} % · triangle</span>}
      </motion.div>
      <div className="slot-info">
        {posture ? <span className={`ptag p-${posture}`}>{POSTURE_INFO[posture].name}</span> : <span className="ptag none">{me ? "posture ?" : "posture cachée"}</span>}
        {cap && <span className="ctag" style={{ ["--cc" as string]: cap.color }}><CapIcon kind={cap.kind} />{cap.name}</span>}
        {hint && <span className="fine">{hint}</span>}
        {log && phase !== "choose" && phase !== "reveal" && log.tech !== 1 && <span className={`ttag ${log.tech > 1 ? "up" : "down"}`}>Technique ×{String(log.tech).replace(".", ",")}</span>}
      </div>

      {/* effet de capacité */}
      <AnimatePresence>
        {phase === "cap" && log?.cap && (
          <motion.div className={`capfx k-${log.cap.kind}`} style={{ ["--cc" as string]: log.cap.color }} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.4 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}>
            <span className="capfx-ring" />
            <CapIcon kind={log.cap.kind} />
            <b>{log.cap.name}</b>
          </motion.div>
        )}
      </AnimatePresence>

      {/* chiffres de dégâts reçus / soins */}
      <AnimatePresence>
        {clash && foe && (
          <motion.div className="dmgs" initial={{ opacity: 0, y: 10, scale: 0.6 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 420, damping: 18 }}>
            {foe.hits.length > 1
              ? foe.hits.map((h, i) => <span key={i} className="dmg">−{fmt(h)}</span>)
              : <span className={`dmg ${foe.capped ? "max" : ""}`}>−{fmt(foe.hits[0] ?? foe.dealt)}</span>}
            {foe.capped && <span className="maxtag">MAX</span>}
            {foe.reflect > 0 && <span className="dmg refl">−{fmt(foe.reflect)} renvoi</span>}
            {log && log.blocked > 0 && <span className="dmg block">{fmt(log.blocked)} bloqués</span>}
            {log && log.heal > 0 && <span className="dmg heal">+{fmt(log.heal)} PV</span>}
            {log?.replayed && <span className="dmg replay">{exerciseBySlug(log.replayed.card.exerciseSlug).name} revient</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────── Résultat ───────────────────────── */

function ResultView({ fight, record, opp, left, friendly, again, close }: {
  fight: Fight; record: DuelRecord; opp: Opponent; left: number; friendly: boolean; again: () => void; close: () => void;
}) {
  const g = useGame();
  const win = record.outcome === "win";
  const draw = record.outcome === "draw";
  useEffect(() => { if (win) { sfx.victory(); haptic([40, 40, 90]); } else sfx.defeat(); }, [win]);
  const sparks = useMemo(() => Array.from({ length: win ? 26 : 0 }, (_, k) => ({ x: (Math.random() - 0.5) * 320, y: -60 - Math.random() * 220, d: 0.8 + Math.random() * 0.8, c: k % 3 === 0 ? "#fff" : k % 3 === 1 ? "#c8f31d" : "#8b5cf6" })), [win]);
  const [busy, setBusy] = useState(false);
  return (
    <div className="fsheet duel-result">
      <div className={`res-title ${win ? "win" : draw ? "draw" : "loss"}`}>
        {sparks.map((p, i) => (
          <motion.i key={i} className="res-spark" style={{ background: p.c }} initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: p.x, y: p.y, opacity: 0 }} transition={{ duration: p.d, ease: "easeOut" }} />
        ))}
        <motion.h2 initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}>
          {win ? "Victoire !" : draw ? "Égalité" : "Défaite"}
        </motion.h2>
        <div className="res-score">
          {fight.ko ? (win ? "par KO" : fight.ko === "both" ? "double KO" : "KO") : `${record.myHp} % – ${record.theirHp} % de PV`}
          <small>contre {opp.name}{friendly ? " · duel amical" : ""}</small>
        </div>
      </div>

      <div className="res-bars">
        <div><span>Toi</span><div className="rb"><i style={{ width: `${record.myHp}%` }} /></div><b>{record.myHp} %</b></div>
        <div><span>{opp.name}</span><div className="rb them"><i style={{ width: `${record.theirHp}%` }} /></div><b>{record.theirHp} %</b></div>
      </div>

      {!friendly && (
        <div className="res-rewards">
          {record.gc > 0 && <span><Coin s={20} />+{record.gc} GC</span>}
          <span>+{record.pts} points de passe</span>
        </div>
      )}

      <div className="panel res-rounds">
        {fight.log.map((rd) => (
          <div key={rd.n} className={`rr ${rd.me.dealt > rd.them.dealt ? "me" : rd.me.dealt < rd.them.dealt ? "them" : "draw"}`}>
            <span className="rr-n">{rd.n}</span>
            <span className="rr-c">{exerciseBySlug(rd.me.card.card.exerciseSlug).name} <b style={{ color: RARITY_COLOR[rd.me.card.card.rarity] }}>{rd.me.card.card.rarity}</b><small>{POSTURE_INFO[rd.me.posture].name}{rd.me.cap ? ` · ${rd.me.cap.name}` : ""} · {fmt(rd.me.dealt)} dégâts</small></span>
            <span className="rr-c them">{exerciseBySlug(rd.them.card.card.exerciseSlug).name} <b style={{ color: RARITY_COLOR[rd.them.card.card.rarity] }}>{rd.them.card.card.rarity}</b><small>{POSTURE_INFO[rd.them.posture].name}{rd.them.cap ? ` · ${rd.them.cap.name}` : ""} · {fmt(rd.them.dealt)} dégâts</small></span>
          </div>
        ))}
        {fight.log.length === 0 && <div className="empty small">Combat abandonné.</div>}
      </div>
      {!win && fight.log.length > 0 && <p className="fine" style={{ textAlign: "center" }}>Astuce : Technique punit la Force, la Garde bloque la Technique. Garde ta capacité pour le bon moment.</p>}
      <div className="acts-col">
        {win && (
          <button className="btn ghost small" disabled={busy} onClick={async () => {
            setBusy(true);
            g.say(await shareVictory({ cards: g.deckCards, name: g.player.name ?? "Joueur", opp: opp.name, myHp: record.myHp, ko: !!fight.ko }));
            setBusy(false);
          }}>{busy ? "Création de l’image…" : "Partager ma victoire"}</button>
        )}
        {friendly
          ? <button className="btn primary" onClick={again}>Revanche</button>
          : <button className="btn primary" disabled={left <= 0} onClick={again}>{left > 0 ? `Nouveau combat (${left} restant${left > 1 ? "s" : ""})` : "Plus de duel aujourd’hui"}</button>}
        <button className="btn ghost small" onClick={close}>Retour</button>
      </div>
    </div>
  );
}

