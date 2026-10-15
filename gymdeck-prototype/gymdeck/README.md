# GymDeck — prototype

Ta séance, ton booster.

## Ce qui est en place
- Boosters (taux affichés, garanties R+ et UR), collection de 32 exercices × 6 raretés, deck de 5 cartes avec passifs UR/LR.
- Missions, séries de séances, succès, extensions par groupe musculaire (récompense par exercice), calendrier, rappels.
- Marché aux enchères (joueurs simulés), amis, vitrine, échanges, image de partage.
- Combats (v11) : PV d'équipe, 5 manches (une carte + une posture Force / Technique / Garde), coups plafonnés à 35 % des PV, jauge et une capacité par combat (7 capacités SSR / UR / LR + Second souffle), IA adverse selon sa consigne, adversaire choisi par chance de victoire simulée (~50 %), premier combat guidé. 5 duels par jour + 2 avec la séance, +10 GC par victoire, défense automatique (+2 GC par attaque repoussée), duel amical entre amis (decks égalisés), classement mensuel.
- Passe de saison mensuel : 30 paliers de 130 points (séance +100, mission du jour +20, combat +15 / +5, défi de la semaine +150), récompenses en GC et boosters (2 boosters au palier 30). Défi communautaire de la semaine (joueurs simulés).
- Profil : statistiques (séances par semaine, régularité, combats), réglages (son, volume, thème clair), partage en story (tirage, victoire, série).
- Navigation en 6 onglets : Accueil, Collection, Deck, Combats, Boutique (Boosters + Marché), Profil.
- Équilibrage des combats vérifié par simulation sur le vrai code (`tests/duel.test.ts`). Dos de carte avec le logo complet (`tools/card_back.py`).
- Atelier de Basile : expertise des cartes (note de 1 à 10, prix selon la rareté, 24 h, effet −1 % à +4 % sur ATQ/DEF).
- Toutes les règles et tous les chiffres sont dans `src/lib/config.ts` ; la logique est pure et testée (`npm test`).
- Atelier de Basile : image fixe au repos, puis deux courtes vidéos (signe, expertise) tirées d'une vidéo faite par IA (`assets-src/video-ia`, mise en forme par `tools/basile_ai.py`, non livrés dans les zips). Notes affichées avec 5 médailles (`public/assets/medals`).
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
