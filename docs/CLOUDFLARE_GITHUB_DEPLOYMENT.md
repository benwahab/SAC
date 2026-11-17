# SAC — Connexion GitHub et préparation Cloudflare

**État vérifié le 17 novembre 2026.**  
**Statut :** cible d'architecture corrigée ; environnement Cloudflare à remettre en place avant le premier déploiement.  
**Périmètre :** documentation et audit uniquement. Aucun code applicatif ni service Cloudflare n'est créé dans cette étape.

## 1. Source officielle

- Dépôt : `benwahab/SAC`
- Branche unique : `main`
- Tout le travail est effectué directement sur GitHub.
- Aucun dépôt Lovable, dépôt miroir ou branche secondaire.

## 2. Architecture Cloudflare demandée pour SAC

La cible demandée dans le cahier des charges est :

- **Cloudflare Pages** pour héberger la PWA React/Vite ;
- **Cloudflare Pages Functions** pour l'API REST en TypeScript, dans `functions/api/` ;
- **Cloudflare D1** comme base relationnelle ;
- **Cloudflare R2** pour le stockage privé des fichiers si le service est activé et autorisé sur le compte ;
- les migrations D1, les contrats API et les configurations nécessaires doivent être versionnés dans le dépôt.

Le backend ne doit pas être remplacé par un Worker autonome déployé séparément sans validation explicite. Les tâches planifiées, rappels et notifications doivent être implémentés avec des mécanismes compatibles avec la cible Cloudflare et testés avant toute mise en production.

## 3. État réellement constaté lors de l'audit

- Aucun projet Cloudflare Pages n'est actuellement présent dans le compte au moment de la vérification.
- La base D1 officielle `sac-db` a été créée le 17 novembre 2026 (UUID `892ce876-f279-409c-8f9e-06b1dca66e9d`, région de création WEUR, réplication désactivée, aucune table encore).
- Le projet Pages nommé `sac-citoyen` et la base D1 `sac-citoyen-db` qui avaient été créés dans le contexte de l'application erronée de signalement ont été supprimés. Le projet Pages erroné a été supprimé. La base D1 erronée a été supprimée, puis une base propre `sac-db` a été créée pour le vrai projet SAC.
- R2 n'est pas activé : l'API retourne l'erreur Cloudflare 10042 « Please enable R2 through the Cloudflare Dashboard ». Aucun bucket n'a été créé.
- Le Worker `sac` a été audité : son unique source était le modèle Cloudflare `Hello world`, sans binding, sous-domaine désactivé et sans zone DNS associée. Il a été supprimé après vérification, car il ne contenait aucune logique SAC ni ressource liée.

**Conséquence :** la configuration Cloudflare actuelle n'est pas prête pour déployer la véritable application SAC. Le projet Pages n'a pas encore été créé : le dépôt ne contient pas encore `package.json` ni le socle frontend à compiler. Aucun build ni déploiement de l'application n'a été confirmé.

## 4. Règles de reconstruction de l'environnement

Quand le développement et la configuration seront autorisés :

1. Auditer le Worker `sac` existant (code, routes, variables, secrets et bindings) avant toute modification ou suppression.
2. Créer/configurer le projet Cloudflare Pages connecté au dépôt `benwahab/SAC`, branche `main`, avec le répertoire de build et les commandes correspondant aux fichiers réels du projet.
3. Ajouter les Pages Functions dans `functions/api/`, sans second backend.
4. Créer la base D1 officielle SAC et versionner les migrations SQL dans GitHub.
5. Vérifier l'activation de R2 ; s'il est autorisé, créer le bucket privé et ses bindings. Sinon, garder le stockage désactivé et documenter la configuration attendue sans simuler son fonctionnement.
6. Définir les variables d'environnement et secrets uniquement dans Cloudflare, jamais dans Git.
7. Configurer les tâches planifiées et mécanismes de notification nécessaires, avec idempotence et journalisation.
8. Exécuter `npm run build` après création du véritable projet, puis tester les Pages Functions, D1, R2 (si activé), les permissions et les scénarios d'alerte.
9. Vérifier le déploiement et son URL réelle avant de déclarer SAC publié.

Ne jamais inventer une commande, un binding, une base, un bucket ou une réussite de déploiement.

## 5. Principes de sécurité

- Les données D1 ne sont accessibles qu'au travers des contrôles d'autorisation côté serveur.
- Les objets R2, si utilisés, doivent être privés par défaut ; aucun lien public permanent pour les données sensibles.
- Aucun secret Cloudflare ou fournisseur ne doit être committé.
- Les positions et événements d'alerte sont des données particulièrement sensibles.
- Les migrations doivent être versionnées, relues et testées avant production.
- Un environnement Preview ne doit pas recevoir de vraies données personnelles ou de véritables alertes.

## 6. Source de vérité et collaboration

GitHub `benwahab/SAC`, branche `main`, reste la source de vérité. Claude et Qwen peuvent contribuer au même dépôt, après lecture de `AGENTS.md` et des documents de référence. Ils ne peuvent modifier le langage, la stack, l'architecture ou les règles métier sans validation explicite.

