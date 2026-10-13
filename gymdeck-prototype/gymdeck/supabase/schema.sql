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
