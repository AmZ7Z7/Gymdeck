# Brancher les comptes en ligne (Supabase) — 10 minutes

Tant que ce n'est pas fait, GymDeck tourne en « mode test » : le compte reste sur le téléphone.

1. Va sur https://supabase.com, crée un compte gratuit, puis « New project » (nom : gymdeck, région : Paris/Europe de l'Ouest, note bien le mot de passe de la base).
2. Menu de gauche → **SQL Editor** → « New query » → colle tout le contenu du fichier `supabase/schema.sql` → **Run**.
3. Menu **Project Settings → API** : copie
   - **Project URL**
   - la clé **anon / public** (jamais la clé « service_role »).
4. Dans **Vercel** → ton projet → **Settings → Environment Variables**, ajoute :
   - `NEXT_PUBLIC_SUPABASE_URL` = ton Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = ta clé anon
   puis **Deployments → Redeploy**.
5. (Conseillé) Supabase → **Authentication → URL Configuration** : mets l'adresse de ton site Vercel dans « Site URL ».

Après ça, l'écran d'accueil propose « Créer un compte / Se connecter » pour de vrai, et la partie est sauvegardée en ligne.

## Mise à jour : suppression de compte et comptes inactifs
Si tu as déjà fait l'étape 2 avant le 21 octobre 2026, recolle tout `supabase/schema.sql` dans **SQL Editor** → **Run**
(il peut être relancé sans risque). Cela ajoute :
- la fonction qui permet au bouton « Supprimer mon compte » du profil de fonctionner ;
- un nettoyage automatique chaque lundi : les comptes sans aucune activité depuis 3 ans sont supprimés (comme annoncé dans la politique de confidentialité).
