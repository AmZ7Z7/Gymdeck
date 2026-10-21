import type { PlayerState } from "./game";

/**
 * Comptes et sauvegarde en ligne (Supabase).
 * Tant que NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY ne sont pas renseignées dans Vercel,
 * `cloudEnabled` vaut false : l'appli tourne en « mode test » sur l'appareil, sans serveur.
 * La clé « anon » est publique par conception ; la sécurité vient des règles RLS (supabase/schema.sql).
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const cloudEnabled = Boolean(URL && KEY);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clientPromise: Promise<any> | null = null;
function client() {
  if (!cloudEnabled) throw new Error("Supabase non configuré");
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true } }));
  return clientPromise;
}

export interface CloudUser { id: string; email: string; name?: string }
const toUser = (u: { id: string; email?: string | null; user_metadata?: { name?: string } } | null | undefined): CloudUser | null =>
  u ? { id: u.id, email: u.email ?? "", name: u.user_metadata?.name } : null;

const frenchError = (m: string) => {
  const l = m.toLowerCase();
  if (l.includes("invalid login")) return "E-mail ou mot de passe incorrect.";
  if (l.includes("already registered") || l.includes("already been registered")) return "Un compte existe déjà avec cet e-mail.";
  if (l.includes("password") && l.includes("least")) return "Mot de passe trop court (8 caractères minimum).";
  if (l.includes("email not confirmed")) return "Confirme d'abord ton e-mail (clique sur le lien reçu).";
  if (l.includes("failed to fetch") || l.includes("networkerror")) return "Connexion au serveur impossible. Vérifie ta connexion.";
  if (l.includes("rate limit")) return "Trop d'essais, réessaie dans quelques minutes.";
  if (l.includes("invalid") && l.includes("email")) return "Adresse e-mail invalide.";
  return m;
};

export type AuthResult = { ok: true; user: CloudUser | null; needsConfirm?: boolean } | { ok: false; error: string };

export async function cloudSignUp(email: string, password: string, name: string): Promise<AuthResult> {
  try {
    const c = await client();
    const { data, error } = await c.auth.signUp({ email, password, options: { data: { name } } });
    if (error) return { ok: false, error: frenchError(error.message) };
    return { ok: true, user: toUser(data.user), needsConfirm: !data.session };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau." }; }
}

export async function cloudSignIn(email: string, password: string): Promise<AuthResult> {
  try {
    const c = await client();
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: frenchError(error.message) };
    return { ok: true, user: toUser(data.user) };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau." }; }
}

/* ───────── Notifications : un abonnement par téléphone (table push_subscriptions) ───────── */

export interface PushPrefs { session: boolean; grading: boolean; streak: boolean }
export interface PushSub { endpoint: string; p256dh: string; auth: string }

/** Enregistre (ou met à jour) l'abonnement de ce téléphone pour le joueur connecté. */
export async function cloudSavePush(sub: PushSub, prefs: PushPrefs): Promise<string | null> {
  try {
    const c = await client();
    const { data } = await c.auth.getUser();
    if (!data.user) return "Connecte-toi d’abord.";
    const { error } = await c.from("push_subscriptions").upsert(
      { ...sub, user_id: data.user.id, prefs, updated_at: new Date().toISOString() },
      { onConflict: "endpoint" },
    );
    return error ? frenchError(error.message) : null;
  } catch (e) { return e instanceof Error ? e.message : "Erreur réseau."; }
}

export async function cloudLoadPushPrefs(endpoint: string): Promise<PushPrefs | null> {
  try {
    const { data } = await (await client()).from("push_subscriptions").select("prefs").eq("endpoint", endpoint).maybeSingle();
    return data ? (data.prefs as PushPrefs) : null;
  } catch { return null; }
}

export async function cloudUpdatePushPrefs(endpoint: string, prefs: PushPrefs): Promise<string | null> {
  try {
    const { error } = await (await client()).from("push_subscriptions").update({ prefs, updated_at: new Date().toISOString() }).eq("endpoint", endpoint);
    return error ? frenchError(error.message) : null;
  } catch (e) { return e instanceof Error ? e.message : "Erreur réseau."; }
}

export async function cloudDeletePush(endpoint: string) {
  try { await (await client()).from("push_subscriptions").delete().eq("endpoint", endpoint); } catch { /* ignoré */ }
}

/** Supprime définitivement le compte connecté et sa sauvegarde (fonction delete_my_account de supabase/schema.sql). */
export async function cloudDeleteAccount(): Promise<string | null> {
  try {
    const c = await client();
    const { error } = await c.rpc("delete_my_account");
    if (error) return frenchError(error.message);
    await c.auth.signOut();
    return null;
  } catch (e) { return e instanceof Error ? e.message : "Erreur réseau."; }
}

export async function cloudSignOut() { try { await (await client()).auth.signOut(); } catch { /* ignoré */ } }

export async function cloudResetPassword(email: string): Promise<string | null> {
  try {
    const { error } = await (await client()).auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    return error ? frenchError(error.message) : null;
  } catch (e) { return e instanceof Error ? e.message : "Erreur réseau."; }
}

export async function cloudSession(): Promise<CloudUser | null> {
  if (!cloudEnabled) return null;
  try { return toUser((await (await client()).auth.getUser()).data.user); } catch { return null; }
}

export async function cloudLoad(userId: string): Promise<{ state: PlayerState; updatedAt: string } | null> {
  try {
    const { data, error } = await (await client()).from("player_saves").select("state, updated_at").eq("user_id", userId).maybeSingle();
    if (error || !data) return null;
    return { state: data.state as PlayerState, updatedAt: data.updated_at as string };
  } catch { return null; }
}

/** Date de la copie en ligne (null : aucune copie ; undefined : serveur injoignable). */
export async function cloudStamp(userId: string): Promise<string | null | undefined> {
  try {
    const { data, error } = await (await client()).from("player_saves").select("updated_at").eq("user_id", userId).maybeSingle();
    if (error) return undefined;
    return data ? (data.updated_at as string) : null;
  } catch { return undefined; }
}

/** `conflict` : un autre appareil a enregistré entre-temps, rien n'a été écrasé. */
export type SaveResult = { ok: true; updatedAt: string } | { ok: false; conflict: boolean };

/**
 * Enregistre la partie en ligne SEULEMENT si la copie en ligne est toujours celle vue en dernier (`base`).
 * `base` null : première sauvegarde du compte (refusée si une copie existe déjà).
 */
export async function cloudSave(userId: string, state: PlayerState, base: string | null): Promise<SaveResult> {
  try {
    const c = await client();
    const row = { user_id: userId, name: state.name ?? null, state, updated_at: new Date().toISOString() };
    if (base === null) {
      const { data, error } = await c.from("player_saves").insert(row).select("updated_at").single();
      if (error) return { ok: false, conflict: error.code === "23505" }; // 23505 : la ligne existe déjà
      return { ok: true, updatedAt: data.updated_at as string };
    }
    const { data, error } = await c.from("player_saves").update(row).eq("user_id", userId).eq("updated_at", base).select("updated_at");
    if (error) return { ok: false, conflict: false };
    if (!data?.length) return { ok: false, conflict: true };
    return { ok: true, updatedAt: data[0].updated_at as string };
  } catch { return { ok: false, conflict: false }; }
}
