# indice-de-recherche

Vos stats GitHub transformées en avis de recherche : un niveau de 1 à 6 étoiles, une prime, un portrait redessiné en illustration et vos gros coups de l'année, sur une carte 1080 × 1350 à partager.

En ligne : https://indice-de-recherche.vercel.app

Projet de fan, non affilié à un éditeur de jeux : aucun logo, visuel ou personnage d'un jeu existant n'est utilisé.

```bash
npm install
npm run dev
```

## Fonctionnement

- **Stats** : API publique GitHub (profil, dépôts publics, commits par dépôt) et calendrier de contributions du profil, lu via un relais (`vite.config.js` en local, `api/contrib.js` sur Vercel).
- **Niveau** : score = contributions + 2 × étoiles + 3 × pull requests + followers + 2 × dépôts publics, comparé aux seuils de `src/level.js`.
- **Carte** : dessinée en Canvas 2D (`src/card.js`), portrait stylisé par un filtre de Kuwahara (`src/toon.js`).

## Quota GitHub

Sans authentification, GitHub accorde 60 requêtes par heure et par adresse IP, soit cinq ou six cartes. En local, le serveur de développement utilise la session `gh` si elle existe, sinon `GITHUB_TOKEN` dans `.env.local` (voir `.env.example`). Aucun jeton n'est déployé.

## Police

Le titre utilise Pricedown (Typodermic), absente du dépôt : sa licence gratuite ne couvre pas la redistribution du fichier. Placez-la dans `public/fonts/pricedown-bl.otf` ; sans elle, le site utilise Anton.

Vite · Canvas 2D · Vercel
