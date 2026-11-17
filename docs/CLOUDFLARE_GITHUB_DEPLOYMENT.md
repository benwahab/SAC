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
- Le projet Pages nommé `sac-citoyen` et la base D1 `sac-citoyen-db` qui avaient été créés dans le contexte de l'application erronée de signalement ont été supprimés. Cette suppression a aussi laissé l'environnement sans projet Pages ni base D1 ; il ne faut pas prétendre que ces services sont actuellement opérationnels.
- Le compte ne permettait pas de confirmer la disponibilité de R2 : l'accès à la liste R2 a retourné une erreur indiquant que R2 doit être activé depuis le tableau de bord.
- Un Worker nommé `sac` existe. Son code, ses bindings et son rôle exact n'ont pas encore été audités. Il est conservé sans être considéré comme le backend officiel de SAC.

**Conséquence :** la configuration Cloudflare actuelle n'est pas prête pour déployer la véritable application SAC. Aucun build ni déploiement de l'application n'a été confirmé.

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

