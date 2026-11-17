# SAC — Plateforme citoyenne de signalement

Le périmètre officiel est désormais une plateforme publique de signalement citoyen, de suivi par code unique et de traitement par les autorités/modérateurs. Il remplace l'ancien concept d'alertes privées entre proches.

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
D1 `sac-citoyen-db` est créé. Appliquer `migrations/0001_initial.sql`. R2 doit être activé dans le dashboard avant de créer le bucket privé `sac-report-media`. Ajouter le secret `SAC_ADMIN_TOKEN` avec Wrangler. Configurer Pages : dépôt GitHub, branche main, build `npm run build`, sortie `dist`.

Le code initial n'est pas encore une application prête pour des urgences réelles. Authentification nominative des agents, rôles fins, politique de conservation, procédures de modération et notifications doivent être renforcés avant production.

Voir `ARCHITECTURE.md` et `TODO_SUPERVISION.md`.