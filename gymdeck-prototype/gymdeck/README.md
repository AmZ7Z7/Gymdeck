# GymDeck — prototype

Ta séance, ton booster.

## Ce qui est en place
- Moteur de tirage (`src/lib/engine.ts`) et règles de compte (`src/lib/game.ts`) conformes à la fiche, couverts par 25 tests (`npm test`).
- Simulation des taux : `npm run simulate` (voir `RAPPORT_SIMULATION.txt`).
- Écrans : Accueil, ouverture de booster, Collection (recherche, filtres, détail, défausse), Boutique (achat, connexion quotidienne, Marché « Bientôt disponible »), Profil (avec outils de test).
- À venir : onglet GymDeck (deck), comptes et sauvegarde serveur.

## Lancer en local
```
npm install
npm run dev      # http://localhost:3000
```

## Mise en ligne (Vercel)
Importer le dépôt GitHub dans Vercel : aucun réglage à changer (framework détecté : Next.js).

## Limite du prototype
Les tirages sont faits dans le navigateur et la sauvegarde est locale à l'appareil (localStorage).
Pour la vraie version (comptes, GC, tirages inviolables), les mêmes règles passeront côté serveur (Supabase).
