-- GymDeck : schéma Supabase (à coller dans « SQL Editor » puis « Run »).
-- Étape 1 (prototype) : chaque joueur a une sauvegarde de sa partie, lisible et modifiable uniquement par lui.
-- Étape suivante (version finale) : les tirages, enchères et échanges passeront par des fonctions serveur
-- pour empêcher toute triche ; ce fichier sera complété à ce moment-là.

create table if not exists public.player_saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text,
  state      jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;

drop policy if exists "lecture de sa propre sauvegarde" on public.player_saves;
create policy "lecture de sa propre sauvegarde" on public.player_saves
  for select using (auth.uid() = user_id);

drop policy if exists "création de sa propre sauvegarde" on public.player_saves;
create policy "création de sa propre sauvegarde" on public.player_saves
  for insert with check (auth.uid() = user_id);

drop policy if exists "mise à jour de sa propre sauvegarde" on public.player_saves;
create policy "mise à jour de sa propre sauvegarde" on public.player_saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────── Suppression de compte (bouton « Supprimer mon compte » du profil) ─────────
-- Le joueur connecté supprime son propre compte ; sa sauvegarde part avec (on delete cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Non connecté';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ───────── Suppression automatique après 3 ans d'inactivité (politique de confidentialité) ─────────
-- Chaque lundi à 4 h (UTC) : les comptes sans aucune sauvegarde depuis 3 ans sont supprimés.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'gymdeck-comptes-inactifs',
  '0 4 * * 1',
  $job$
    delete from auth.users u
    where coalesce(
      (select s.updated_at from public.player_saves s where s.user_id = u.id),
      u.last_sign_in_at,
      u.created_at
    ) < now() - interval '3 years';
  $job$
);

-- ───────── Notifications ─────────
-- Un abonnement par téléphone / navigateur, avec les notifications choisies par le joueur.
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  prefs      jsonb not null default '{"session": true, "grading": true, "streak": true}',
  sent       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

drop policy if exists "lecture de ses abonnements" on public.push_subscriptions;
create policy "lecture de ses abonnements" on public.push_subscriptions
  for select using (auth.uid() = user_id);
drop policy if exists "création de ses abonnements" on public.push_subscriptions;
create policy "création de ses abonnements" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
drop policy if exists "mise à jour de ses abonnements" on public.push_subscriptions;
create policy "mise à jour de ses abonnements" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "suppression de ses abonnements" on public.push_subscriptions;
create policy "suppression de ses abonnements" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- Toutes les 15 minutes, Supabase appelle la fonction « send-notifications ».
-- Ce bloc contient un code secret : il n'est PAS lancé avec le reste du fichier. La version complète, avec le code,
-- est dans le guide d'installation des notifications (fichier local, jamais envoyé sur GitHub).
-- create extension if not exists pg_net with schema extensions;
-- select cron.schedule(
--   'gymdeck-notifications',
--   '*/15 * * * *',
--   $job$
--     select net.http_post(
--       url := 'https://kanlcoioqhesebtoimrq.supabase.co/functions/v1/send-notifications',
--       headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
--       body := '{}'::jsonb
--     );
--   $job$
-- );
