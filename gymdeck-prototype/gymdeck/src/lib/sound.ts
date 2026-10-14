/**
 * Sons du jeu, fabriqués en direct avec la Web Audio API : aucun fichier audio à charger.
 * Version « douce » : uniquement des sinus / triangles, des cloches courtes, un filtre qui coupe les aigus
 * et un peu d'écho. Aucun son au simple toucher d'un bouton.
 * Le volume se règle dans Profil (Coupé / Doux / Normal) et reste gardé sur l'appareil.
 */
import type { Rarity } from "./config";

export type SoundLevel = "off" | "low" | "on";
const KEY = "gymdeck:sound";
const LEVEL_GAIN: Record<SoundLevel, number> = { off: 0, low: 0.38, on: 0.7 };

let ctx: AudioContext | null = null;
let bus: GainNode | null = null; // entrée de tous les sons
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let level: SoundLevel = "low";
const listeners = new Set<() => void>();

try {
  const v = localStorage.getItem(KEY);
  if (v === "off" || v === "low" || v === "on") level = v;
} catch { /* ignoré */ }

function ensure(): AudioContext | null {
  if (level === "off" || typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = LEVEL_GAIN[level];
      // Chaîne : bus → filtre passe-bas (coupe tout ce qui pique) → compresseur doux → sortie, + un petit écho en parallèle.
      bus = ctx.createGain();
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5200; lp.Q.value = 0.5;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 24; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
      bus.connect(lp); lp.connect(comp); comp.connect(master); master.connect(ctx.destination);
      for (const [dt, fb, g] of [[0.13, 0.32, 0.22], [0.21, 0.28, 0.16]] as const) {
        const d = ctx.createDelay(1); d.delayTime.value = dt;
        const f = ctx.createGain(); f.gain.value = fb;
        const damp = ctx.createBiquadFilter(); damp.type = "lowpass"; damp.frequency.value = 2400;
        const wet = ctx.createGain(); wet.gain.value = g;
        lp.connect(d); d.connect(damp); damp.connect(f); f.connect(d); damp.connect(wet); wet.connect(comp);
      }
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (master) master.gain.value = LEVEL_GAIN[level];
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}

/** À appeler au premier toucher : les navigateurs n'autorisent le son qu'après un geste. */
export function unlockAudio() { ensure(); }

export const getLevel = () => level;
export const isMuted = () => level === "off";
export const subscribeSound = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export function setLevel(l: SoundLevel) {
  level = l;
  try { localStorage.setItem(KEY, l); } catch { /* ignoré */ }
  if (master) master.gain.value = LEVEL_GAIN[l];
  if (l !== "off") { ensure(); sfx.coin(); }
  listeners.forEach((f) => f());
}
export const setMuted = (m: boolean) => setLevel(m ? "off" : "low");

/** Petite vibration (Android) pour les grands moments ; rien si les sons sont coupés. */
export function haptic(pattern: number | number[]) {
  if (level === "off") return;
  try { navigator.vibrate?.(pattern); } catch { /* ignoré */ }
}

interface NoiseOpts { type?: BiquadFilterType; f0: number; f1?: number; q?: number; dur: number; gain: number; at?: number; attack?: number }
function noise(o: NoiseOpts) {
  const c = ensure(); if (!c || !bus || !noiseBuf) return;
  const t = c.currentTime + (o.at ?? 0);
  const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = o.type ?? "bandpass"; f.Q.value = o.q ?? 0.7;
  f.frequency.setValueAtTime(o.f0, t);
  if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
  const g = c.createGain();
  const a = o.attack ?? 0.02;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f).connect(g).connect(bus);
  src.start(t, Math.random()); src.stop(t + o.dur + 0.05);
}

interface ToneOpts { f0: number; f1?: number; type?: OscillatorType; dur: number; gain: number; at?: number; attack?: number }
function tone(o: ToneOpts) {
  const c = ensure(); if (!c || !bus) return;
  const t = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator(); osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.f0, t);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain, t + (o.attack ?? 0.012));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g).connect(bus);
  osc.start(t); osc.stop(t + o.dur + 0.05);
}

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12); // numéro MIDI → Hz

/** Note de cloche : un sinus + deux harmoniques qui s'éteignent plus vite. Chaud, jamais strident. */
function bell(n: number, at: number, gain: number, dur = 0.9) {
  const f = NOTE(n);
  tone({ f0: f, dur, gain, at, attack: 0.008 });
  tone({ f0: f * 2.01, dur: dur * 0.55, gain: gain * 0.28, at, attack: 0.006 });
  tone({ f0: f * 3.0, dur: dur * 0.3, gain: gain * 0.1, at, attack: 0.004 });
}

/** Coussin d'harmonie : plusieurs sinus qui montent doucement puis s'éteignent. */
function pad(notes: number[], at: number, dur: number, gain: number) {
  notes.forEach((n) => {
    tone({ f0: NOTE(n), dur, gain, at, attack: dur * 0.35 });
    tone({ f0: NOTE(n) * 1.004, type: "triangle", dur, gain: gain * 0.5, at, attack: dur * 0.35 });
  });
}

/** Petites cloches qui montent (gamme pentatonique, toujours consonante). */
function arpeggio(notes: number[], gap: number, gain: number, at = 0, dur = 0.9) {
  notes.forEach((n, i) => bell(n, at + i * gap, gain, dur));
}

export const sfx = {
  /** Carte qui se retourne : léger souffle d'air. */
  flip() {
    noise({ f0: 900, f1: 2200, q: 0.6, dur: 0.18, gain: 0.07, attack: 0.04 });
    tone({ f0: 140, f1: 90, dur: 0.1, gain: 0.07 });
  },
  /** Passer à la carte suivante : glissement très discret. */
  slide() { noise({ f0: 700, f1: 1600, q: 0.5, dur: 0.14, gain: 0.04, attack: 0.05 }); },
  /** Le paquet se charge : une harmonie chaude qui monte tout doucement. */
  charge(dur = 1.1) {
    pad([48, 55, 60], 0, dur + 0.25, 0.05);
    pad([64, 67], dur * 0.35, dur, 0.035);
    tone({ f0: 220, f1: 660, dur, gain: 0.03, attack: dur * 0.8 });
  },
  /** Déchirure de l'emballage : papier qui se froisse, sans sifflement. */
  tear() {
    noise({ f0: 1700, f1: 3000, q: 0.9, dur: 0.3, gain: 0.1, attack: 0.03 });
    for (let i = 0; i < 9; i++) noise({ f0: 1500 + Math.random() * 1500, q: 2, dur: 0.035, gain: 0.04, at: i * 0.03, attack: 0.008 });
    tone({ f0: 110, f1: 70, dur: 0.12, gain: 0.08, at: 0.02 });
  },
  /** Le paquet s'ouvre : un « poum » rond puis un accord de cloches. */
  burst() {
    tone({ f0: 120, f1: 48, dur: 0.5, gain: 0.22, attack: 0.01 });
    noise({ type: "lowpass", f0: 500, f1: 3200, q: 0.5, dur: 0.5, gain: 0.07, attack: 0.05 });
    [72, 76, 79].forEach((n, i) => bell(n, 0.04 + i * 0.045, 0.06, 1.3));
  },
  /** Cartes qui tombent sur la table, l'une après l'autre. */
  deal(n = 5) {
    for (let i = 0; i < n; i++) {
      noise({ f0: 900, f1: 2000, q: 0.6, dur: 0.09, gain: 0.05, at: 0.12 + i * 0.1, attack: 0.02 });
      tone({ f0: 120, f1: 80, dur: 0.07, gain: 0.07, at: 0.12 + i * 0.1 });
    }
  },
  /** Petite mélodie selon la rareté de la carte révélée. */
  reveal(r: Rarity) {
    switch (r) {
      case "C": bell(72, 0, 0.07, 0.6); break;
      case "R": arpeggio([72, 76], 0.08, 0.08, 0, 0.7); break;
      case "SR": arpeggio([72, 76, 79], 0.08, 0.09, 0, 0.8); break;
      case "SSR":
        arpeggio([72, 76, 79, 84], 0.085, 0.1, 0, 1);
        pad([60, 67], 0.1, 1.1, 0.025);
        break;
      case "UR":
        tone({ f0: 80, f1: 45, dur: 0.5, gain: 0.2 });
        arpeggio([67, 72, 76, 79, 84], 0.08, 0.11, 0.05, 1.3);
        pad([55, 60, 64, 67], 0.2, 1.8, 0.03);
        break;
      case "LR":
        tone({ f0: 70, f1: 38, dur: 0.8, gain: 0.26 });
        arpeggio([60, 64, 67, 72, 76, 79, 84, 88], 0.08, 0.11, 0.05, 1.6);
        pad([48, 55, 60, 64, 67], 0.3, 2.4, 0.03);
        arpeggio([91, 96], 0.12, 0.05, 0.85, 1.4);
        break;
    }
  },
  /** Suspense avant une UR / LR : battements de cœur profonds qui s'accélèrent. */
  heartbeat() {
    [0, 0.34, 0.62, 0.84, 1.0].forEach((t, i) => {
      tone({ f0: 70 + i * 5, f1: 45, dur: 0.16, gain: 0.2, at: t, attack: 0.02 });
    });
  },
  /** Suspense avant une LÉGENDAIRE (~1,9 s) : grondement grave qui monte, cœur qui s'emballe, cloches de plus en plus haut. */
  legendCharge() {
    tone({ f0: 52, f1: 90, dur: 1.9, gain: 0.16, attack: 1.5 });
    tone({ f0: 104, f1: 180, type: "triangle", dur: 1.9, gain: 0.05, attack: 1.6 });
    pad([48, 55, 60], 0, 2.1, 0.05);
    pad([64, 67, 71], 0.5, 1.6, 0.035);
    [0, 0.4, 0.75, 1.05, 1.3, 1.5, 1.68, 1.82].forEach((t, i) => {
      tone({ f0: 74 + i * 4, f1: 45, dur: 0.16, gain: 0.14 + i * 0.012, at: t, attack: 0.02 });
    });
    [79, 81, 84, 86, 88, 91, 93, 96].forEach((n, i) => bell(n, 0.55 + i * 0.17, 0.02 + i * 0.006, 0.7));
    noise({ type: "lowpass", f0: 200, f1: 3000, q: 0.6, dur: 1.9, gain: 0.05, attack: 1.7 });
  },
  /** Explosion légendaire : chute de basse, souffle, cascade de cloches sur deux octaves, puis accord final tenu. */
  legendary() {
    tone({ f0: 100, f1: 30, dur: 1.4, gain: 0.3, attack: 0.01 });
    tone({ f0: 200, f1: 60, type: "triangle", dur: 0.7, gain: 0.08, attack: 0.01 });
    noise({ type: "lowpass", f0: 400, f1: 4200, q: 0.5, dur: 1.2, gain: 0.1, attack: 0.04 });
    arpeggio([60, 64, 67, 72, 76, 79, 84, 88, 91, 96], 0.065, 0.09, 0.08, 1.8);
    pad([48, 55, 60, 64, 67, 72], 0.15, 3.4, 0.035);
    [84, 88, 91, 96].forEach((n, i) => bell(n, 0.85 + i * 0.03, 0.065, 2.4));
    arpeggio([72, 76, 79, 84], 0.2, 0.04, 1.5, 1.6);
  },
  /** Basile pose sa loupe : petit cliquetis de verre, très discret. */
  loupe() { bell(96, 0, 0.018, 0.25); bell(100, 0.06, 0.012, 0.22); },
  /** Coup de tampon : « poum » sourd + papier, puis une note selon la qualité. */
  stamp(grade: number) {
    tone({ f0: 150, f1: 55, dur: 0.22, gain: 0.26, attack: 0.004 });
    noise({ type: "lowpass", f0: 900, f1: 300, q: 0.7, dur: 0.16, gain: 0.12, attack: 0.004 });
    if (grade >= 10) { arpeggio([72, 76, 79, 84, 88, 91], 0.07, 0.08, 0.12, 1.4); pad([60, 64, 67, 72], 0.2, 2.2, 0.03); }
    else if (grade >= 8) arpeggio([72, 76, 79, 84], 0.08, 0.07, 0.12, 1);
    else if (grade >= 5) arpeggio([72, 77], 0.09, 0.06, 0.12, 0.8);
    else { tone({ f0: 330, dur: 0.22, gain: 0.05, at: 0.14 }); tone({ f0: 262, dur: 0.3, gain: 0.05, at: 0.26 }); }
  },
  /** Une carte se pose (deck, ordre de combat). */
  place() { noise({ f0: 1200, f1: 2400, q: 0.7, dur: 0.07, gain: 0.035, attack: 0.01 }); tone({ f0: 180, f1: 120, dur: 0.06, gain: 0.05 }); },
  /** Duel : l'adversaire apparaît. */
  versus() {
    tone({ f0: 90, f1: 60, dur: 0.5, gain: 0.16 });
    noise({ type: "lowpass", f0: 300, f1: 2400, q: 0.5, dur: 0.45, gain: 0.06, attack: 0.25 });
    bell(67, 0.32, 0.05, 0.6); bell(74, 0.38, 0.04, 0.7);
  },
  /** Duel : deux cartes s'entrechoquent. */
  hit(strong = false) {
    tone({ f0: strong ? 130 : 160, f1: 50, dur: 0.2, gain: strong ? 0.24 : 0.18, attack: 0.003 });
    noise({ type: "bandpass", f0: 1400, f1: 500, q: 0.8, dur: 0.12, gain: strong ? 0.1 : 0.07, attack: 0.003 });
  },
  /** Manche gagnée / perdue. */
  roundWin() { arpeggio([76, 83], 0.07, 0.06, 0, 0.6); },
  roundLose() { tone({ f0: 247, dur: 0.16, gain: 0.05 }); tone({ f0: 196, dur: 0.24, gain: 0.05, at: 0.09 }); },
  /** Fin de duel. */
  victory() {
    tone({ f0: 98, f1: 49, dur: 0.6, gain: 0.18 });
    arpeggio([67, 72, 76, 79, 84], 0.085, 0.09, 0.05, 1.3);
    pad([55, 60, 64, 67], 0.25, 2, 0.032);
  },
  defeat() { pad([57, 60, 64], 0, 1.4, 0.03); tone({ f0: 220, f1: 165, dur: 0.7, gain: 0.05, at: 0.1 }); },
  /** Pièce (GC gagnés, enchère posée) : un « ting » clair et court. */
  coin() { bell(86, 0, 0.05, 0.35); bell(91, 0.07, 0.05, 0.5); },
  good() { arpeggio([72, 79], 0.08, 0.07, 0, 0.6); },
  /** Refus : deux notes graves et rondes qui descendent. */
  error() { tone({ f0: 220, dur: 0.18, gain: 0.08 }); tone({ f0: 165, dur: 0.24, gain: 0.08, at: 0.1 }); },
};
