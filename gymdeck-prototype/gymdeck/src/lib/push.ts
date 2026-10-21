import { cloudDeletePush, cloudLoadPushPrefs, cloudSavePush, cloudUpdatePushPrefs, type PushPrefs } from "./cloud";

/**
 * Notifications sur le téléphone (même appli fermée).
 * La clé publique NEXT_PUBLIC_VAPID_PUBLIC_KEY (Vercel) identifie GymDeck auprès du téléphone ;
 * l'envoi se fait depuis Supabase (supabase/functions/send-notifications).
 */

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
export const pushConfigured = KEY.length > 0;
export const DEFAULT_PREFS: PushPrefs = { session: true, grading: true, streak: true };

/** « ok » : possible ici ; « install » : iPhone, il faut d'abord installer GymDeck sur l'écran d'accueil ; « unsupported » : impossible. */
export function pushSupport(): "ok" | "install" | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  const apis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (ios && !standalone) return "install";
  return apis ? "ok" : "unsupported";
}

const keyBytes = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (ch) => ch.charCodeAt(0));
};

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "ok") return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Notifications choisies sur ce téléphone (null : pas abonné). */
export async function loadPrefs(): Promise<PushPrefs | null> {
  const sub = await currentSubscription();
  if (!sub) return null;
  return (await cloudLoadPushPrefs(sub.endpoint)) ?? DEFAULT_PREFS;
}

/** Demande l'autorisation, abonne ce téléphone et l'enregistre pour le joueur connecté. Renvoie un message d'erreur ou null. */
export async function enablePush(prefs: PushPrefs = DEFAULT_PREFS): Promise<string | null> {
  if (!pushConfigured) return "Les notifications ne sont pas encore activées sur ce site.";
  if (pushSupport() !== "ok") return "Ce téléphone ne permet pas les notifications ici.";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "Notifications refusées. Tu peux les autoriser dans les réglages de ton téléphone.";
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }));
    const j = sub.toJSON();
    if (!j.endpoint || !j.keys?.p256dh || !j.keys.auth) return "Abonnement impossible sur ce téléphone.";
    return await cloudSavePush({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, prefs);
  } catch (e) { return e instanceof Error ? e.message : "Abonnement impossible."; }
}

export async function savePrefs(prefs: PushPrefs): Promise<string | null> {
  const sub = await currentSubscription();
  return sub ? cloudUpdatePushPrefs(sub.endpoint, prefs) : "Active d’abord les notifications.";
}

/** Désabonne ce téléphone (aussi appelé à la déconnexion : un autre joueur ne recevra pas tes notifications). */
export async function disablePush() {
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    await cloudDeletePush(sub.endpoint);
    await sub.unsubscribe();
  } catch { /* ignoré */ }
}
