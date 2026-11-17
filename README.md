# SAC — Plateforme citoyenne de signalement

SAC est une plateforme publique de signalement citoyen, de suivi par code unique et de traitement par les autorités/modérateurs. Elle remplace l'ancien concept d'alertes privées entre proches.

## Règles
- Dépôt unique : benwahab/SAC ; branche unique : main.
- Travail directement sur GitHub ; aucun Lovable.
- SAC reste séparé de PCS et Coup Sûr.
- Aucun secret ni donnée personnelle réelle dans Git.

## Stack
React, Vite, TypeScript strict, Tailwind, Lucide React, Leaflet/OSM, Cloudflare Pages Functions, D1 et R2 privé. Adaptateurs device prévus pour Capacitor.

## Développement
```bash
npm install
npm run dev
npm run build
```

## Cloudflare
D1 `sac-citoyen-db` est créé et les tables initiales sont appliquées. Pages `sac-citoyen` est relié à GitHub `main`, build `npm run build`, sortie `dist`, binding D1 `DB`. R2 doit être activé dans le dashboard avant de créer le bucket privé `sac-report-media` et d'ajouter le binding `MEDIA`. La CI GitHub Actions a réussi le 17/11/2026.

L'application n'est pas encore prête pour des urgences réelles : authentification nominative des agents, rôles fins, accès aux médias privés, politique de conservation, modération et notifications doivent être finalisés.

Voir `ARCHITECTURE.md` et `TODO_SUPERVISION.md`.