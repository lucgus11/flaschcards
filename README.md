# Flashcards (PWA)

Application de flashcards façon Quizlet, **100 % fonctionnelle hors ligne**.
TypeScript + Vite + `vite-plugin-pwa`, données stockées dans IndexedDB sur l'appareil.

## Fonctionnalités

- Création de listes de mots, ajout / modification / suppression de cartes
- Import en masse (un terme par ligne : `terme ; définition`, tabulation, `=` ou `-` — compatible avec l'export Quizlet)
- Révision en flashcards (retournement animé), sens terme→définition, définition→terme ou mélangé
- Répétition espacée (boîtes de Leitner) : l'app propose les cartes « à réviser »
- Lecture audio (synthèse vocale de l'appareil) selon la langue choisie pour la liste
- Export / import JSON pour sauvegarder ou transférer ses données
- Installable (iOS, Android, desktop), mode sombre, raccourcis clavier (Espace, ← →)

## Développement

```bash
npm install
npm run dev        # serveur de dev
npm run build      # typecheck + build de production (dist/)
npm run preview    # test local du build (le service worker n'est actif qu'ici ou en prod)
npm run icons      # régénère les icônes PNG depuis public/icon.svg
```

## Déploiement : GitHub + Vercel

```bash
git init && git add . && git commit -m "Flashcards PWA"
git branch -M main
git remote add origin https://github.com/<ton-user>/<ton-repo>.git
git push -u origin main
```

Puis sur [vercel.com/new](https://vercel.com/new) : importer le dépôt. Vercel détecte Vite
(build : `npm run build`, sortie : `dist`). Chaque `git push` redéploie automatiquement.

## Tester le mode hors ligne

`npm run build && npm run preview`, ouvrir l'app, attendre « Prête à fonctionner hors ligne ✓ »,
puis couper le réseau (DevTools → Network → Offline) et recharger.
