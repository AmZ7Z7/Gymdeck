"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { BasileScene, type Cue, type SceneRun } from "@/components/BasileScene";
import { Card, Medal } from "@/components/Card";
import { GcPill, formatDuration, useNow } from "@/components/Bits";
import { useGame } from "@/components/GameProvider";
import { IconBack, IconHourglass } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import {
  GRADES, GRADE_HOURS, GRADE_LABEL, GRADE_PRICE, GRADE_SLOTS, GRADE_WEIGHTS, RARITIES, RARITY_COLOR, RARITY_RANK,
  exerciseBySlug, gradeColor, gradeStatPct, type Rarity,
} from "@/lib/config";
import type { CardData } from "@/lib/engine";
import { gradeBlocker, type GradeReveal } from "@/lib/grading";
import { haptic, sfx } from "@/lib/sound";

const Coin = ({ s = 16 }: { s?: number }) => <span className="coin" style={{ width: s, height: s, display: "inline-block", verticalAlign: "-3px", marginRight: 4 }} />;
const pctTxt = (bp: number) => `${(bp / 100).toString().replace(".", ",")} %`;
const effectTxt = (g: number) => { const p = gradeStatPct(g); return p > 0 ? `+${p} % ATQ et DEF` : p < 0 ? `${p} % ATQ et DEF` : "stats inchangées"; };

/** Ce que dit Basile après avoir noté une carte. */
const VERDICT: Record<number, string> = {
  10: "Incroyable… Pas un défaut. Une carte parfaite !",
  9: "Magnifique. Presque parfaite, je n’ai rien à redire.",
  8: "Très belle carte, bien conservée. Bravo !",
  7: "Une belle carte, propre et nette.",
  6: "Une bonne carte, quelques petites traces.",
  5: "Correcte. Elle a déjà un peu vécu.",
  4: "Hmm… les coins sont fatigués.",
  3: "Aïe, elle a souffert, celle-là.",
  2: "Elle a beaucoup voyagé… mais elle reste à toi !",
  1: "Pauvre carte… Elle a tout vécu.",
};

export function Atelier({ back, initialCardId }: { back: () => void; initialCardId?: string | null }) {
  const g = useGame();
  useNow(1000);
  const now = g.gameNow();
  const jobs = g.grading;
  const [sel, setSel] = useState<string | null>(() => {
    if (initialCardId) return initialCardId;
    const readyJob = g.grading.find((j) => now >= j.readyAt);
    return readyJob?.cardId ?? g.grading[0]?.cardId ?? null;
  });
  const [run, setRun] = useState<SceneRun | null>(null);
  const [stamp, setStamp] = useState<number | null>(null);
  const [result, setResult] = useState<(GradeReveal & { done: boolean }) | null>(null);
  const resultRef = useRef(result);
  resultRef.current = result;
  const [matOverride, setMatOverride] = useState<CardData | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [rules, setRules] = useState(false);
  const [announce, setAnnounce] = useState("");
  const outRef = useRef<HTMLDivElement>(null);

  const selCard = sel ? g.player.cards.find((c) => c.id === sel) ?? null : null;
  const selJob = sel ? jobs.find((j) => j.cardId === sel) ?? null : null;
  const ready = !!selJob && now >= selJob.readyAt;
  const matCard: CardData | null = matOverride ?? selCard;
  const blocker = selCard && !selJob ? gradeBlocker(g.player, selCard.id) : null;
  const price = selCard ? GRADE_PRICE[selCard.rarity] : 0;

  // la carte choisie a disparu (vendue ailleurs, échangée…) : on la désélectionne
  useEffect(() => { if (sel && !selCard && !result) setSel(null); }, [sel, selCard, result]);

  const say = line ?? (
    result?.done ? VERDICT[result.grade]!
      : busy ? "Voyons voir…"
        : selJob && ready ? "J’ai terminé ! Tu veux connaître sa note ?"
          : selJob ? `Je l’examine encore… Reviens dans ${formatDuration(selJob.readyAt - now)}.`
            : selCard?.grade ? "Celle-ci a déjà sa note : je ne note jamais deux fois la même carte."
              : selCard ? `Une ${selCard.rarity} ? Pour ${price} GC, je te donne ma note dans ${GRADE_HOURS} h.`
                : jobs.length >= GRADE_SLOTS ? "Mon établi est plein ! Viens d’abord chercher une note."
                  : "Bonjour, je suis Basile ! Confie-moi une carte, je te dirai ce qu’elle vaut."
  );

  const select = (id: string | null) => { if (busy) return; setSel(id); setLine(null); setResult(null); setStamp(null); setMatOverride(null); };

  const submit = () => {
    if (!selCard || busy) return;
    const e = g.submitGrading(selCard.id);
    if (e) { sfx.error(); g.say(e); return; }
    sfx.coin();
    setLine("Parfait, je m’en occupe ! Reviens dans 24 h.");
    setAnnounce(`Carte confiée à Basile. Résultat dans ${GRADE_HOURS} heures.`);
    setRun({ id: Date.now(), kind: "nod" });
  };

  const evaluate = () => {
    if (!selJob || !ready || busy || !selCard) return;
    const before = selCard;
    const r = g.revealGrading(selJob.cardId); // la note est appliquée et enregistrée AVANT l'animation
    if ("error" in r) { g.say(r.error); return; }
    setBusy(true);
    setLine(null);
    setStamp(null);
    setMatOverride(before);
    setResult({ ...r, done: false });
    setAnnounce("Basile examine ta carte…");
    setRun({ id: Date.now(), kind: "evaluate" });
  };

  const onCue = (cue: Cue) => {
    const r = resultRef.current;
    if (cue === "inspect") sfx.loupe();
    if (cue === "stamp" && r) {
      setStamp(r.grade);
      setMatOverride(r.card);
      sfx.stamp(r.grade);
      haptic(r.grade >= 9 ? [30, 40, 70] : 35);
      setAnnounce(`Note de Basile : ${r.grade} sur 10, ${GRADE_LABEL[r.grade]}. ${effectTxt(r.grade)}.`);
    }
    if (cue === "end" && r) { setBusy(false); setResult({ ...r, done: true }); }
  };

  const next = () => {
    const readyJob = jobs.find((j) => now >= j.readyAt);
    select(readyJob?.cardId ?? null);
  };

  return (
    <div className="stage scroll atelier">
      <div className="head">
        <button className="backbtn" aria-label="Retour" onClick={back} disabled={busy}><IconBack width={22} height={22} /></button>
        <div className="atelier-title">Atelier de Basile</div>
        <GcPill gc={g.player.gc} />
      </div>

      <BasileScene card={matCard} run={run} stamp={stamp} onCue={onCue} />

      <div className="dialog" aria-live="polite">
        <span className="who">Basile</span>
        <AnimatePresence mode="wait">
          <motion.p key={say} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
            {say}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="sr-only" role="status" aria-live="assertive">{announce}</div>

      {/* Résultat de l'expertise */}
      {result && !result.done ? (
        <div className="panel gradeact">
          <button className="btn primary" disabled>Basile examine ta carte…</button>
          <p className="fine">Le résultat est déjà enregistré : tu peux quitter, la note restera sur ta carte.</p>
        </div>
      ) : result?.done ? (
        <motion.div className="panel gradeout" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} onAnimationStart={() => outRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })} ref={outRef}>
          <div className="go-card"><Card card={result.card} /></div>
          <div className="go-info">
            <div className="go-grade" style={{ color: gradeColor(result.grade) }}><Medal grade={result.grade} className="md" /><span>{result.grade}<small>/10</small> · {GRADE_LABEL[result.grade]}</span></div>
            <div className="go-name">{exerciseBySlug(result.card.exerciseSlug).name} <b style={{ color: RARITY_COLOR[result.card.rarity] }}>{result.card.rarity}</b></div>
            <div className="go-stats">
              <span>ATQ {result.before.atq} → <b>{result.card.atq}</b></span>
              <span>DEF {result.before.def} → <b>{result.card.def}</b></span>
            </div>
            <div className={`go-eff ${result.pct > 0 ? "up" : result.pct < 0 ? "down" : ""}`}>{effectTxt(result.grade)}</div>
          </div>
          <button className="btn primary small go-btn" onClick={next}>Continuer</button>
        </motion.div>
      ) : selJob ? (
        <div className="panel gradeact">
          {ready ? (
            <button className="btn primary" disabled={busy} onClick={evaluate}>{busy ? "Basile examine…" : "Évaluer ma carte"}</button>
          ) : (
            <div className="waitbox">
              <span>Résultat dans</span>
              <b>{formatDuration(selJob.readyAt - now)}</b>
              <div className="progress thin"><i style={{ width: `${Math.min(100, ((now - selJob.startedAt) / (selJob.readyAt - selJob.startedAt)) * 100)}%` }} /></div>
            </div>
          )}
          <p className="fine">La carte reste dans ton deck. Pendant l’expertise, elle ne peut être ni vendue, ni échangée, ni défaussée.</p>
        </div>
      ) : selCard ? (
        <div className="panel gradeact">
          <div className="pricebox">
            <span>Expertise d’une carte <b style={{ color: RARITY_COLOR[selCard.rarity] }}>{selCard.rarity}</b></span>
            <b className="pr"><Coin s={20} />{price} GC</b>
          </div>
          <button className="btn primary" disabled={!!blocker || busy} onClick={submit}>{blocker && !selCard.grade ? blocker : selCard.grade ? "Déjà expertisée" : `Confier à Basile · ${price} GC`}</button>
          <button className="btn ghost small" onClick={() => setPicker(true)} disabled={busy}>Changer de carte</button>
        </div>
      ) : (
        <div className="panel gradeact">
          <button className="btn primary" onClick={() => setPicker(true)} disabled={jobs.length >= GRADE_SLOTS}>Choisir une carte</button>
          <p className="fine">De {GRADE_PRICE.C} à {GRADE_PRICE.LR} GC selon la rareté · résultat en {GRADE_HOURS} h · une seule expertise par carte.</p>
        </div>
      )}

      {/* L'établi : cartes en cours */}
      <div className="row-head" style={{ margin: "16px 0 8px" }}>
        <h2 className="section" style={{ fontSize: 22 }}>Sur l’établi</h2>
        <span className="benchcount">{jobs.length} / {GRADE_SLOTS}</span>
      </div>
      <div className="bench">
        {Array.from({ length: GRADE_SLOTS }, (_, k) => {
          const j = jobs[k];
          const c = j ? g.player.cards.find((x) => x.id === j.cardId) : null;
          if (!j || !c) return (
            <button key={`free${k}`} className="benchrow free" onClick={() => { select(null); setPicker(true); }} disabled={busy}>
              <span className="bthumb e">+</span><span className="binfo">Place libre<small>Confie une carte à Basile</small></span>
            </button>
          );
          const r = now >= j.readyAt;
          return (
            <button key={j.cardId} className={`benchrow ${sel === j.cardId ? "sel" : ""}`} onClick={() => select(j.cardId)} disabled={busy}>
              <span className="bthumb"><Card card={c} holo={false} /></span>
              <span className="binfo">{exerciseBySlug(c.exerciseSlug).name} <b style={{ color: RARITY_COLOR[c.rarity] }}>{c.rarity}</b>
                <small className={r ? "ok" : ""}>{r ? "Note prête !" : `Prête dans ${formatDuration(j.readyAt - now)}`}</small>
              </span>
              <span className="bstate">{r ? "›" : <IconHourglass />}</span>
            </button>
          );
        })}
      </div>
      <button className="link center" style={{ marginTop: 8 }} onClick={() => setRules(true)}>Tarifs, notes et probabilités ›</button>

      {picker && <GradePicker onClose={() => setPicker(false)} onPick={(id) => { select(id); setPicker(false); }} />}
      {rules && <GradeRules onClose={() => setRules(false)} />}
    </div>
  );
}

/** Choix de la carte à confier : seules les cartes jamais expertisées et libres sont proposées. */
function GradePicker({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const g = useGame();
  const [rarity, setRarity] = useState<Rarity | null>(null);
  const list = useMemo(() => g.player.cards
    .filter((c) => !c.grade && !g.grading.some((j) => j.cardId === c.id) && (!rarity || c.rarity === rarity))
    .sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || b.atq + b.def - (a.atq + a.def)), [g.player.cards, g.grading, rarity]);
  return (
    <Sheet onClose={onClose} variant="full" label="Choisir une carte à expertiser">
      <div className="fsheet">
        <div className="pickhead" style={{ margin: "-14px -18px 10px", paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
          <div className="top">
            <button className="backbtn" aria-label="Fermer" onClick={onClose}><IconBack width={22} height={22} /></button>
            <div className="sheet-title">Quelle carte ?</div>
            <span style={{ width: 44 }} />
          </div>
        </div>
        <p className="fine" style={{ margin: "0 0 10px" }}>Chaque carte ne peut être expertisée qu’une fois. Le prix dépend de sa rareté.</p>
        <div className="chips" style={{ marginBottom: 10 }}>
          <button className={`chip ${rarity === null ? "on" : ""}`} onClick={() => setRarity(null)}>Toutes</button>
          {RARITIES.map((r) => (
            <button key={r} className={`chip ${rarity === r ? "on" : ""}`} style={{ ["--c" as string]: RARITY_COLOR[r] }} onClick={() => setRarity(rarity === r ? null : r)}>{r}</button>
          ))}
        </div>
        {list.length === 0 ? <div className="empty">Aucune carte à confier{rarity ? " dans cette rareté" : ""}.</div> : (
          <div className="cgrid">
            {list.map((c) => (
              <button key={c.id} className="ccell pick" onClick={() => onPick(c.id)} aria-label={`${exerciseBySlug(c.exerciseSlug).name} ${c.rarity}, ${GRADE_PRICE[c.rarity]} GC`}>
                <Card card={c} holo={false} />
                <span className="gprice"><Coin s={14} />{GRADE_PRICE[c.rarity]} GC</span>
                {g.player.deck.includes(c.id) && <span className="deckbadge">DECK</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** Transparence : prix, effets et probabilités des notes. */
export function GradeRules({ onClose }: { onClose: () => void }) {
  return (
    <Sheet onClose={onClose} label="Expertise : tarifs et probabilités">
      <div className="sheet-title">L’expertise</div>
      <ul className="rules">
        <li>Basile examine ta carte pendant <b>{GRADE_HOURS} h</b>, puis lui donne une <b>note de 1 à 10</b>.</li>
        <li><b>Une seule expertise par carte.</b> Jusqu’à {GRADE_SLOTS} cartes sur l’établi en même temps.</li>
        <li>La note reste sur la carte : elle se voit dans ta collection, au Marché et dans les échanges.</li>
        <li>Pendant l’expertise, la carte reste dans ton deck mais ne peut être ni vendue, ni échangée, ni défaussée.</li>
      </ul>
      <div className="odds">
        <div className="odds-row head g3"><span>Note</span><span>Chance</span><span>Effet</span></div>
        {GRADES.map((n) => (
          <div className="odds-row g3" key={n}>
            <span><Medal grade={n} className="sm" />{GRADE_LABEL[n]}</span>
            <span>{pctTxt(GRADE_WEIGHTS[n]!)}</span>
            <span>{gradeStatPct(n) > 0 ? `+${gradeStatPct(n)} %` : gradeStatPct(n) < 0 ? `${gradeStatPct(n)} %` : "—"}</span>
          </div>
        ))}
      </div>
      <p className="fine">L’effet s’applique à l’ATQ et à la DEF de la carte.</p>
      <div className="odds">
        <div className="odds-row head g2"><span>Rareté</span><span>Prix</span></div>
        {RARITIES.map((r) => (
          <div className="odds-row g2" key={r}><span style={{ color: RARITY_COLOR[r], fontWeight: 800 }}>{r}</span><span>{GRADE_PRICE[r]} GC</span></div>
        ))}
      </div>
      <button className="btn ghost small" onClick={onClose}>Fermer</button>
    </Sheet>
  );
}
