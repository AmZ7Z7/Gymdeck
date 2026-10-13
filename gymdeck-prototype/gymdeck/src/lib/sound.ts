/**
 * Sons du jeu, fabriqués en direct avec la Web Audio API : aucun fichier audio à charger.
 * Tout reste discret (volumes bas). Le son se coupe dans Profil ; le réglage est gardé sur l'appareil.
 */
import type { Rarity } from "./config";

const KEY = "gymdeck:sound";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let noiseBuf: AudioBuffer | null = null;
const listeners = new Set<() => void>();

try { muted = localStorage.getItem(KEY) === "off"; } catch { /* ignoré */ }

function ensure(): AudioContext | null {
  if (muted || typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}

/** À appeler au premier toucher : les navigateurs n'autorisent le son qu'après un geste. */
export function unlockAudio() { ensure(); }

export const isMuted = () => muted;
export const subscribeSound = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem(KEY, m ? "off" : "on"); } catch { /* ignoré */ }
  if (!m) { ensure(); sfx.coin(); }
  listeners.forEach((f) => f());
}

interface NoiseOpts { type?: BiquadFilterType; f0: number; f1?: number; q?: number; dur: number; gain: number; at?: number; attack?: number }
function noise(o: NoiseOpts) {
  const c = ensure(); if (!c || !master || !noiseBuf) return;
  const t = c.currentTime + (o.at ?? 0);
  const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = o.type ?? "bandpass"; f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.f0, t);
  if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain, t + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random()); src.stop(t + o.dur + 0.05);
}

interface ToneOpts { f0: number; f1?: number; type?: OscillatorType; dur: number; gain: number; at?: number; attack?: number }
function tone(o: ToneOpts) {
  const c = ensure(); if (!c || !master) return;
  const t = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator(); osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.f0, t);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain, t + (o.attack ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g).connect(master);
  osc.start(t); osc.stop(t + o.dur + 0.05);
}

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12); // numéro MIDI → Hz

/** Petites notes brillantes qui montent, pour les cartes rares. */
function arpeggio(notes: number[], gap: number, gain: number, type: OscillatorType = "triangle", at = 0) {
  notes.forEach((n, i) => {
    tone({ f0: NOTE(n), type, dur: 0.5, gain, at: at + i * gap, attack: 0.012 });
    tone({ f0: NOTE(n + 12), type: "sine", dur: 0.35, gain: gain * 0.35, at: at + i * gap });
  });
}

export const sfx = {
  /** Toucher un bouton. */
  tap() { tone({ f0: 720, f1: 380, type: "triangle", dur: 0.05, gain: 0.07 }); },
  /** Carte qui se retourne (« frrt »). */
  flip() {
    noise({ f0: 1400, f1: 6000, q: 0.8, dur: 0.16, gain: 0.22, attack: 0.02 });
    tone({ f0: 170, f1: 90, type: "sine", dur: 0.09, gain: 0.12 });
  },
  /** Passer à la carte suivante (glissement). */
  slide() { noise({ f0: 900, f1: 2600, q: 0.7, dur: 0.12, gain: 0.12, attack: 0.03 }); },
  /** Le paquet se charge : grondement qui monte pendant `dur` secondes. */
  charge(dur = 1.1) {
    noise({ type: "lowpass", f0: 150, f1: 1800, q: 1, dur, gain: 0.2, attack: dur * 0.6 });
    tone({ f0: 90, f1: 520, type: "sawtooth", dur, gain: 0.05, attack: dur * 0.7 });
    tone({ f0: 180, f1: 1040, type: "sine", dur, gain: 0.05, attack: dur * 0.7 });
    for (let i = 0; i < 9; i++) tone({ f0: 300 + i * 40, f1: 220, type: "square", dur: 0.03, gain: 0.018, at: (i / 9) * dur * 0.9 });
  },
  /** Déchirure de l'emballage. */
  tear() {
    noise({ type: "highpass", f0: 2500, f1: 7000, q: 0.5, dur: 0.32, gain: 0.3, attack: 0.02 });
    for (let i = 0; i < 12; i++) noise({ f0: 3000 + Math.random() * 3000, q: 4, dur: 0.02, gain: 0.12, at: i * 0.022 });
  },
  /** Explosion de lumière quand le paquet s'ouvre. */
  burst() {
    noise({ type: "lowpass", f0: 300, f1: 9000, q: 0.6, dur: 0.6, gain: 0.3, attack: 0.05 });
    tone({ f0: 110, f1: 40, type: "sine", dur: 0.5, gain: 0.35 });
  },
  /** Cartes qui tombent sur la table, l'une après l'autre. */
  deal(n = 5) {
    for (let i = 0; i < n; i++) {
      noise({ f0: 1200, f1: 3500, q: 0.8, dur: 0.09, gain: 0.14, at: 0.12 + i * 0.1, attack: 0.015 });
      tone({ f0: 140, f1: 80, dur: 0.06, gain: 0.1, at: 0.12 + i * 0.1 });
    }
  },
  /** Petit son selon la rareté de la carte révélée. */
  reveal(r: Rarity) {
    switch (r) {
      case "C": tone({ f0: NOTE(72), type: "triangle", dur: 0.22, gain: 0.1 }); break;
      case "R": arpeggio([72, 76], 0.07, 0.11); break;
      case "SR": arpeggio([72, 76, 79], 0.07, 0.13); break;
      case "SSR":
        arpeggio([72, 76, 79, 84], 0.08, 0.15);
        noise({ type: "highpass", f0: 6000, q: 0.5, dur: 0.5, gain: 0.05, at: 0.1, attack: 0.15 });
        break;
      case "UR":
        arpeggio([67, 72, 76, 79, 84], 0.07, 0.17, "triangle");
        [60, 64, 67, 72].forEach((n) => tone({ f0: NOTE(n), type: "sawtooth", dur: 1.4, gain: 0.04, at: 0.3, attack: 0.1 }));
        noise({ type: "highpass", f0: 5000, q: 0.5, dur: 1, gain: 0.07, at: 0.15, attack: 0.3 });
        tone({ f0: 70, f1: 35, dur: 0.6, gain: 0.3 });
        break;
      case "LR":
        tone({ f0: 60, f1: 28, dur: 0.9, gain: 0.4 });
        arpeggio([60, 64, 67, 72, 76, 79, 84, 88], 0.075, 0.18, "triangle");
        [48, 55, 60, 64, 67, 72].forEach((n) => tone({ f0: NOTE(n), type: "sawtooth", dur: 2, gain: 0.04, at: 0.45, attack: 0.15 }));
        noise({ type: "highpass", f0: 4000, f1: 9000, q: 0.5, dur: 1.6, gain: 0.09, at: 0.1, attack: 0.5 });
        break;
    }
  },
  /** Suspense avant une UR / LR : battements de cœur qui s'accélèrent. */
  heartbeat() {
    [0, 0.34, 0.62, 0.84, 1.0].forEach((t, i) => {
      tone({ f0: 80 + i * 6, f1: 45, dur: 0.14, gain: 0.3, at: t });
    });
  },
  /** Pièce (GC gagnés, enchère posée). */
  coin() {
    tone({ f0: 988, type: "square", dur: 0.08, gain: 0.05 });
    tone({ f0: 1319, type: "square", dur: 0.22, gain: 0.05, at: 0.07 });
  },
  good() { arpeggio([72, 76, 79], 0.06, 0.1); },
  error() { tone({ f0: 200, f1: 120, type: "square", dur: 0.16, gain: 0.07 }); },
};
