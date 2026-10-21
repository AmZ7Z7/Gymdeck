/**
 * GymDeck : envoi des notifications (Supabase Edge Function « send-notifications »).
 * Appelée toutes les 15 minutes par une tâche planifiée (voir supabase/schema.sql).
 * Trois notifications, chacune activable par le joueur :
 *  - rappel de séance : aux jours et à l'heure choisis dans « Rappel de séance », si la séance n'est pas encore validée ;
 *  - expertise de Basile prête : quand une note est prête à être révélée ;
 *  - série en danger : à partir de 18 h, le dernier jour pour garder sa série.
 * Les règles sont des fonctions pures (testées dans tests/notifications.test.ts) ; l'envoi est en bas du fichier.
 */

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Response | Promise<Response>): void } | undefined;

export interface Prefs { session: boolean; grading: boolean; streak: boolean }
export interface Sent {
  /** Jour (AAAA-MM-JJ) du dernier rappel de séance envoyé. */
  session?: string;
  /** Jour du dernier avertissement « série en danger ». */
  streak?: string;
  /** Expertises déjà annoncées (cardId:readyAt). */
  grading?: string[];
}
export interface Note { kind: keyof Prefs; title: string; body: string; url: string; tag: string }

/** Ce dont les règles ont besoin dans la sauvegarde du joueur (player_saves.state). */
export interface SaveState {
  lastSessionDay?: string | null;
  grading?: { cardId: string; readyAt: number }[];
  extra?: {
    reminder?: { days: number[]; time: string } | null;
    streak?: { current: number; lastDay: string | null };
  };
}

const DAY = 86_400_000;
/** Un rappel envoyé avec plus de 2 h de retard ne sert plus à rien (ex. abonnement fait le soir). */
const LATE_MAX_MIN = 120;
/** Heure (Paris) à partir de laquelle on prévient d'une série en danger. */
const STREAK_HOUR = 18;

/** Jour, jour de la semaine (0 = lundi) et minutes écoulées depuis minuit, à l'heure de Paris. */
export function parisParts(now: Date): { day: string; weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
  }).formatToParts(now);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(v("weekday"));
  return { day: `${v("year")}-${v("month")}-${v("day")}`, weekday, minutes: Number(v("hour")) * 60 + Number(v("minute")) };
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

/** Notifications à envoyer maintenant pour un joueur, et la mémoire « déjà envoyé » mise à jour. */
export function dueNotifications(state: SaveState, prefs: Prefs, sent: Sent, now: Date): { notes: Note[]; sent: Sent } {
  const { day, weekday, minutes } = parisParts(now);
  const notes: Note[] = [];
  const next: Sent = { ...sent };
  const sessionDone = state.lastSessionDay === day;

  // 1) rappel de séance
  const rem = state.extra?.reminder;
  if (prefs.session && rem && !sessionDone && sent.session !== day && rem.days.includes(weekday)) {
    const [h, m] = rem.time.split(":").map(Number) as [number, number];
    const late = minutes - (h * 60 + m);
    if (late >= 0 && late <= LATE_MAX_MIN) {
      notes.push({ kind: "session", title: "C’est l’heure de ta séance 💪", body: "Va t’entraîner, puis valide ta séance pour ouvrir ton booster.", url: "/", tag: "gymdeck-seance" });
      next.session = day;
    }
  }

  // 2) expertise de Basile prête (seulement les notes prêtes depuis moins d'un jour)
  if (prefs.grading) {
    const done = new Set(sent.grading ?? []);
    const ready = (state.grading ?? []).filter((j) => j.readyAt <= now.getTime() && now.getTime() - j.readyAt < DAY && !done.has(`${j.cardId}:${j.readyAt}`));
    if (ready.length > 0) {
      notes.push({
        kind: "grading",
        title: "Basile a terminé 🔍",
        body: ready.length > 1 ? `${ready.length} cartes ont leur note. Viens les découvrir !` : "Ta carte a reçu sa note. Viens la découvrir !",
        url: "/#atelier",
        tag: "gymdeck-basile",
      });
      next.grading = [...ready.map((j) => `${j.cardId}:${j.readyAt}`), ...(sent.grading ?? [])].slice(0, 30);
    }
  }

  // 3) série en danger : la série tolère un jour de repos ; deux jours après la dernière séance, c'est le dernier jour pour la garder
  const st = state.extra?.streak;
  if (prefs.streak && st && st.current >= 2 && st.lastDay && !sessionDone && sent.streak !== day
    && daysBetween(st.lastDay, day) === 2 && minutes >= STREAK_HOUR * 60) {
    notes.push({ kind: "streak", title: `🔥 Ta série de ${st.current} jours est en danger`, body: "Valide ta séance aujourd’hui, sinon elle repart à zéro à minuit.", url: "/", tag: "gymdeck-serie" });
    next.streak = day;
  }

  return { notes, sent: next };
}

/* ───────────────────────── Envoi (exécuté seulement dans Supabase) ───────────────────────── */

interface SubRow { endpoint: string; user_id: string; p256dh: string; auth: string; prefs: Prefs; sent: Sent | null }

async function handler(req: Request): Promise<Response> {
  const env = (k: string) => Deno?.env.get(k) ?? "";
  if (!env("CRON_SECRET") || req.headers.get("x-cron-secret") !== env("CRON_SECRET")) return new Response("Accès refusé", { status: 401 });

  const supabaseLib = "npm:@supabase/supabase-js@2";
  const webpushLib = "npm:web-push@3.6.7";
  const { createClient } = await import(supabaseLib);
  const webpush = (await import(webpushLib)).default;
  webpush.setVapidDetails(env("VAPID_SUBJECT") || "mailto:contact@gymdeck.fr", env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

  const { data: subs, error } = await db.from("push_subscriptions").select("endpoint, user_id, p256dh, auth, prefs, sent");
  if (error) return new Response(error.message, { status: 500 });
  const rows = (subs ?? []) as SubRow[];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const states = new Map<string, SaveState>();
  if (ids.length > 0) {
    const { data: saves } = await db.from("player_saves").select("user_id, state").in("user_id", ids);
    for (const s of (saves ?? []) as { user_id: string; state: SaveState }[]) states.set(s.user_id, s.state);
  }

  const now = new Date();
  let sentCount = 0, removed = 0;
  for (const row of rows) {
    const state = states.get(row.user_id);
    if (!state) continue;
    const r = dueNotifications(state, row.prefs, row.sent ?? {}, now);
    if (r.notes.length === 0) continue;
    let gone = false;
    for (const note of r.notes) {
      try {
        await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify(note), { TTL: 3600 });
        sentCount++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { gone = true; break; } // abonnement expiré (appli désinstallée…)
      }
    }
    if (gone) { await db.from("push_subscriptions").delete().eq("endpoint", row.endpoint); removed++; }
    else await db.from("push_subscriptions").update({ sent: r.sent }).eq("endpoint", row.endpoint);
  }
  return new Response(JSON.stringify({ abonnements: rows.length, envoyees: sentCount, supprimes: removed }), { headers: { "Content-Type": "application/json" } });
}

if (typeof Deno !== "undefined") Deno.serve(handler);
