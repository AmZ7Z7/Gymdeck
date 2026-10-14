# GymDeck — prototype

Ta séance, ton booster.

## Ce qui est en place
- Boosters (taux affichés, garanties R+ et UR), collection de 32 exercices × 6 raretés, deck de 5 cartes avec passifs UR/LR.
- Missions, séries de séances, succès, extensions par groupe musculaire (récompense par exercice), calendrier, rappels.
- Marché aux enchères (joueurs simulés), amis, vitrine, échanges, image de partage.
- Combats : duels asynchrones (ordre caché, synergies de groupe, triangle, ± 10 % de hasard, écart plafonné à 350), 3 duels par jour + 2 avec la séance, classement mensuel aux points.
- Atelier de Basile : expertise des cartes (note de 1 à 10, prix selon la rareté, 24 h, effet −1 % à +4 % sur ATQ/DEF).
- Toutes les règles et tous les chiffres sont dans `src/lib/config.ts` ; la logique est pure et testée (`npm test`).
- Atelier de Basile : animation image par image (~12 images/s, sans fondu) à partir des 11 planches de `assets-src/golem2`, recalées par `tools/basile_frames.py` (non livrés dans les zips). Notes affichées avec 5 médailles (`public/assets/medals`).
- Ouverture : la carte la plus rare du booster est toujours révélée en dernier (affichage seulement, probabilités inchangées).

## Lancer en local
```
npm install
npm run dev      # http://localhost:3000
```

## Mise en ligne (Vercel)
Importer le dépôt GitHub dans Vercel (dossier racine : `gymdeck-prototype/gymdeck`).
Pour cacher le petit bouton fiole des outils de test : variable d'environnement `NEXT_PUBLIC_HIDE_TEST_TOOLS=1`.

## Limite du prototype
Les tirages, notes et duels sont calculés dans le navigateur et la sauvegarde est locale à l'appareil (localStorage).
Pour la vraie version (comptes, GC, tirages inviolables), les mêmes règles passeront côté serveur (Supabase).
