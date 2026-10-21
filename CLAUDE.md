# GymDeck

## Le concept
Site mobile de cartes à collectionner autour de la musculation : boosters, collection, boutique, monnaie virtuelle (GC), Marché, combats. Le créateur (Adrien) ne code pas : expliquer simplement, sans jargon.

## Règles de travail
- Toujours demander mon accord avant une grosse modification ou une suppression.
- Un commit par étape, avec un message clair en français.
- Avant une étape risquée, proposer de créer une version repère (tag) pour pouvoir revenir en arrière.
- Après chaque modification, me dire concrètement quoi vérifier sur le site.
- Ne jamais supprimer de fichiers de visuels sans me demander.

## Règles du jeu (déjà décidées, ne pas changer sans me demander)
- Chaque carte existe dans TOUTES les raretés (on n'attribue pas une rareté fixe à une carte).
- Les cartes les plus rares sont holographiques ou animées.
- Le jeu est 100 % gratuit : pas de vente de boosters ni de GC au lancement (des dons sont possibles).
- On ne retire JAMAIS une carte que des joueurs ont déjà collectionnée.
- Marché : système d'enchères entre joueurs.
- Grading des cartes : attente de 24 h, avec les prix déjà validés dans le code.
- Combats : les règles actuelles sont validées mais trop rapides, sans stratégie et trop courtes. Ils seront revus plus tard, ne pas les refaire sans demande.

## Types de cartes
- Exercices : 32 aujourd'hui, objectif d'une centaine. Les machines sont couvertes par les cartes exercices.
- Personnages façon « le mec du coin de la salle » (ex. « Le Petit Curl »).
- Athlètes et influenceurs muscu réels, prévus plus tard.
- Culture muscu : plats (riz poulet), compléments (whey), compétitions, bronzant de compétition, équipement débutant maison (élastiques). Des objets représentables visuellement, sans humour.
- Les visuels sont fournis par Adrien (générés par IA) : ne pas en inventer, prévoir des emplacements.

## Fonctionnalités validées (à construire si elles n'existent pas)
Missions du jour, séries de jours d'affilée, extensions par groupe musculaire, profil / amis / vitrine, échanges de cartes, image de partage TikTok, rappels de séance, tutoriel, saisons de classement.

## Plus tard
- Base de données Supabase (comptes, sauvegarde des collections, échanges), pas encore branchée.
- Partenariat possible avec EXO (appli de salle) : scanner un QR code en salle donnerait un booster. Garder le code compatible avec cette idée.
- Anti-triche : éviter que des joueurs valident des séances sans être allés à la salle.
