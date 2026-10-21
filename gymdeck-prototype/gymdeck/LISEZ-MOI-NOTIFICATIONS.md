# Brancher les notifications — environ 15 minutes

Les codes à copier sont dans le fichier privé **`.env.notifications.local`**, à la racine du dossier `Projets\Gymdeck`
sur ton ordinateur (ouvre-le avec le Bloc-notes). Il n'est jamais envoyé sur GitHub : ne le partage avec personne.

## 1. Supabase : la table des abonnements
**SQL Editor** → **New query** → colle tout le contenu de `supabase/schema.sql` → **Run**.
(Il peut être relancé sans risque : il ajoute seulement ce qui manque.)

## 2. Supabase : le programme qui envoie les notifications
1. Menu de gauche → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nom de la fonction : `send-notifications` (exactement).
3. Efface le code d'exemple et colle tout le contenu de `supabase/functions/send-notifications/index.ts`.
4. **Deploy function**.
5. Dans la page de la fonction → **Details** (ou **Settings**) : **désactive « Enforce JWT verification »** (ou « Verify JWT ») → **Save**.
   C'est normal : la fonction est protégée par son propre code secret (CRON_SECRET).

## 3. Supabase : les codes secrets de la fonction
**Edge Functions** → **Secrets** → ajoute les 4 lignes de la partie **2)** du fichier privé
(`VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`) : le nom à gauche du `=`, la valeur à droite.

## 4. Supabase : l'envoi toutes les 15 minutes
**SQL Editor** → **New query** → colle le bloc de la partie **3)** du fichier privé (de `create extension` jusqu'au dernier `);`) → **Run**.

## 5. Vercel : la clé publique
**Environment Variables** → ajoute `NEXT_PUBLIC_VAPID_PUBLIC_KEY` avec la valeur de la partie **1)** du fichier privé (type **Config**)
→ **Deployments** → **Redeploy**.

## 6. Essayer
1. Sur iPhone : GymDeck doit être installé sur l'écran d'accueil (Safari → Partager → Sur l'écran d'accueil), puis ouvert depuis l'icône.
2. **Profil → Notifications → Activer les notifications** → accepte.
3. **Profil → Rappel de séance** : choisis aujourd'hui et une heure dans 5 minutes → **Enregistrer**.
4. Ferme l'appli et attends : la notification arrive au plus tard 15 minutes après l'heure choisie
   (si ta séance du jour n'est pas encore validée).

En cas de souci : Supabase → **Edge Functions** → `send-notifications` → **Logs**.
