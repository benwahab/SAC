# Préparation de migration SAC Pages vers Workers

## État de départ confirmé

- Dépôt source : `benwahab/SAC`, branche `main`.
- Pages actuel : `sac` (`sac-3xh.pages.dev`), connecté au même dépôt.
- Base D1 existante : `sac-db`, ID `892ce876-f279-409c-8f9e-06b1dca66e9d`.
- Les paramètres Pages de production exposent une liaison D1 `DB` vers cette base.
- Le code source conserve 81 fichiers de routes API sous `functions/api/`.
- Le projet Pages ne déclare actuellement aucune liaison R2 dans ses paramètres de production.
- Les Workers auxiliaires SAC restent des ressources séparées.
- Les Workers UPK et leurs bases/buckets ne font pas partie de cette migration.

## Séparation des fichiers mise en place

- `workers/app/wrangler.toml` : configuration indépendante du Worker applicatif `sac-app`.
- `workers/app/README.md` : consignes d’exploitation et garde-fous.
- `vite.config.worker.ts` : sortie frontend dédiée dans `dist/client/`.
- `dist/worker/` : bundle des routes Pages Functions généré au build, non versionné.
- `package.json` : commandes `build:worker`, `dev:worker` et `deploy:worker`.
- CI : compilation Worker ajoutée comme contrôle, sans déploiement.

Le fichier racine `wrangler.toml` et la commande de build Pages existante sont conservés pour ne pas interrompre l’hébergement actuel.

## Ressources réutilisées

Le Worker cible réutilise la base D1 de production existante via la liaison `DB`. Aucun schéma, aucune donnée et aucune migration D1 ne sont modifiés par la configuration.

Les buckets R2 `sac-private-documents` et `sac-private-documents-preview` ne sont pas déclarés comme liaisons dans l’environnement Pages de production actuellement inspecté. Ils ne sont donc pas ajoutés arbitrairement au Worker. Leur usage doit être confirmé dans le code avant de les lier.

## Secrets

Les noms des variables secrètes de Pages ont été recensés, mais Cloudflare ne permet pas de lire leur valeur. Les valeurs ne sont ni exportées ni copiées dans GitHub. Elles devront être configurées de façon sécurisée pour `sac-app` avant son déploiement de production.

## Points à valider avant bascule

1. Exécuter `npm run build:worker` dans CI et confirmer la présence de `dist/worker/index.js` et des assets dans `dist/client/`.
2. Vérifier les routes API, l’authentification, les sessions, WebAuthn, l’envoi d’e-mails, les notifications et les réponses statiques SPA sur un déploiement de prévisualisation.
3. Configurer les secrets sur le Worker sans les exposer dans Git.
4. Confirmer l’usage effectif des deux buckets R2.
5. Mettre à jour l’URL d’appel du Worker de notifications ordinaires seulement après validation du nouveau Worker.
6. Préparer et tester le retour arrière.

## Interdictions pendant la préparation

- Ne pas supprimer ni désactiver le projet Pages `sac`.
- Ne pas modifier la base `sac-db`, ses migrations ou ses données.
- Ne pas modifier les ressources UPK.
- Ne pas modifier les domaines ou le routage de production.
- Ne pas déployer en production avant validation complète.

## Commandes

```sh
npm run build:worker
npm run dev:worker
```

La commande suivante est réservée à la bascule après validation :

```sh
npm run deploy:worker
```

## Référence Cloudflare

La méthode suit la documentation officielle Pages → Workers : compiler les Pages Functions avec `wrangler pages functions build`, puis configurer le script compilé et les assets statiques dans un Worker Static Assets.
