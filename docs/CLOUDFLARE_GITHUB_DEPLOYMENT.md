# SAC — Connexion GitHub et préparation Cloudflare

**État vérifié le 17 novembre 2026.**  
**Statut :** cible d'architecture corrigée ; environnement Cloudflare à remettre en place avant le premier déploiement.  
**Périmètre :** le socle applicatif initial est versionné dans GitHub ; aucun projet Pages ni déploiement Cloudflare n'est encore créé.

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

**Conséquence :** le dépôt contient maintenant le socle React/Vite/TypeScript, une route Pages Functions `/api/health` qui interroge D1, un manifeste PWA et un service worker minimal. Le projet Pages n'a pas encore été créé et R2 reste inactif. Le build, le typage et l'audit bloquant des dépendances de production ont réussi dans GitHub Actions (run 44151374924, commit `6edbd77d41fe6c3baf2db9e6e76ef770df54d9ca`). Le déploiement Cloudflare Pages et les tests Preview/Production restent à effectuer.

## 4. Règles de reconstruction de l'environnement

Étapes restantes pour la configuration et le premier déploiement :

1. Le Worker modèle `sac` a déjà été audité puis supprimé ; ne pas le recréer comme backend autonome.
2. Créer/configurer le projet Cloudflare Pages connecté au dépôt `benwahab/SAC`, branche `main`, avec le répertoire de build et les commandes correspondant aux fichiers réels du projet.
3. Ajouter les Pages Functions dans `functions/api/`, sans second backend.
4. La base D1 officielle `sac-db` existe déjà. Configurer le binding `DB` dans Pages ; les migrations métier attendent la validation du schéma détaillé.
5. Vérifier l'activation de R2 ; s'il est autorisé, créer le bucket privé et ses bindings. Sinon, garder le stockage désactivé et documenter la configuration attendue sans simuler son fonctionnement.
6. Définir les variables d'environnement et secrets uniquement dans Cloudflare, jamais dans Git.
7. Configurer les tâches planifiées et mécanismes de notification nécessaires, avec idempotence et journalisation.
8. Exécuter `npm run build` après création du véritable projet, puis tester les Pages Functions, D1, R2 (si activé), les permissions et les scénarios d'alerte.
9. Vérifier le déploiement et son URL réelle avant de déclarer SAC publié.

Ne jamais inventer une commande, un binding, une base, un bucket ou une réussite de déploiement.

## 5. Rétention GPS et restauration D1

Vérification en lecture seule du 17 novembre 2026 : la base `sac-db` (UUID `892ce876-f279-409c-8f9e-06b1dca66e9d`) existe, utilise `version: production`, ne contient encore aucune table et a la réplication désactivée. Le stockage `production` prend en charge D1 Time Travel.

La documentation Cloudflare indique une fenêtre de restauration Time Travel de 30 jours sur Workers Paid et de 7 jours sur Workers Free. Cette fenêtre est indépendante de la durée de rétention produit SAC. Une restauration peut réintroduire une ancienne ligne GPS supprimée dans l'état courant.

Procédure obligatoire après toute restauration D1 :
1. maintenir SAC en mode maintenance et bloquer les lectures utilisateur ;
2. réexécuter la purge GPS à partir des dates de fin de partage et échéances conservées dans les données restaurées ;
3. vérifier automatiquement qu'aucune position arrivée à échéance n'est lisible ni présente dans les tables actives ;
4. consigner le résultat sans coordonnées ;
5. rouvrir le trafic seulement après réussite des contrôles.

**Exigence utilisateur ferme : après 30 jours, aucune restauration ne doit permettre de récupérer ou de rendre lisibles les coordonnées GPS expirées.** Cela inclut D1 Time Travel, les sauvegardes, snapshots, exports, réplications et restaurations partielles ou complètes.

Une simple suppression SQL suivie d'une purge de rattrapage ne suffit pas : elle peut empêcher l'accès dans la base restaurée, mais ne détruit pas les copies historiques. La cible obligatoire est un chiffrement des positions avant persistance, avec clés isolées de D1 et destruction cryptographique vérifiable à l'échéance. Les clés détruites ne doivent pas être restaurables depuis les sauvegardes. Une restauration peut éventuellement réintroduire des données chiffrées, mais celles-ci doivent rester définitivement indéchiffrables. Le gestionnaire de clés et son cycle de vie doivent être audités et testés avant toute migration GPS.

En attendant cette preuve, il est interdit de stocker des coordonnées GPS en clair dans D1, R2, un export ou une sauvegarde. Aucun stockage GPS ne doit être déclaré conforme tant que des tests de restauration d'une copie antérieure à J+30 ne démontrent pas l'impossibilité de récupérer les coordonnées.

## 6. Principes de sécurité

- Les données D1 ne sont accessibles qu'au travers des contrôles d'autorisation côté serveur.
- Les objets R2, si utilisés, doivent être privés par défaut ; aucun lien public permanent pour les données sensibles.
- Aucun secret Cloudflare ou fournisseur ne doit être committé.
- Les positions et événements d'alerte sont des données particulièrement sensibles.
- Les migrations doivent être versionnées, relues et testées avant production.
- Un environnement Preview ne doit pas recevoir de vraies données personnelles ou de véritables alertes.

## 6. Source de vérité et collaboration

GitHub `benwahab/SAC`, branche `main`, reste la source de vérité. Claude et Qwen peuvent contribuer au même dépôt, après lecture de `AGENTS.md` et des documents de référence. Ils ne peuvent modifier le langage, la stack, l'architecture ou les règles métier sans validation explicite.



## Mise à jour de l'environnement réel — 19 novembre 2026

Le projet Cloudflare Pages a maintenant été créé et relu dans le compte Cloudflare connecté. Les constats historiques de la section 3 décrivent l'état du 17 novembre et ne représentent plus l'état actuel.

- Projet Pages : `sac` ; sous-domaine réservé : `sac-3xh.pages.dev`.
- Source : dépôt GitHub `benwahab/SAC`, branche `main`.
- Build : `npm run build`, sortie `dist`, racine `/`.
- Binding D1 de production : `DB` vers `sac-db` (UUID `892ce876-f279-409c-8f9e-06b1dca66e9d`).
- Variables de production : `WEBAUTHN_RP_ID=sac-3xh.pages.dev`, `WEBAUTHN_RP_NAME=SAC`, `WEBAUTHN_ALLOWED_ORIGINS=["https://sac-3xh.pages.dev"]`, `WEBAUTHN_ROOT_ENROLLMENT_ENABLED=false`, `APP_BASE_URL=https://sac-3xh.pages.dev`.
- `EMAIL_OTP_HMAC_SECRET` a été envoyé avec succès à Cloudflare comme variable `secret_text`. Sa valeur est masquée par l'API et n'est pas présente dans GitHub.
- Les déploiements de production automatiques sont désactivés ; les déploiements Preview sont désactivés ; aucun déploiement n'a été lancé.

La base distante est toujours sans tables au dernier contrôle. Les migrations ne sont pas appliquées. Aucun secret Resend, expéditeur e-mail SAC, fournisseur push ou SMS n'est configuré. La durée de vie des invitations est encore en arbitrage produit ; aucune valeur n'a été inventée. Le projet Pages et ses bindings sont configurés, mais le service n'est pas publié ni prêt pour les utilisateurs.

La configuration de la variable secrète a reçu une réponse de succès Cloudflare, mais sa valeur n'est volontairement pas lisible après écriture. Pour confirmer le fonctionnement de bout en bout, il faudra effectuer un test contrôlé de l'API d'inscription après initialisation D1 et configuration Resend, sans jamais exposer le secret ni un OTP.


### Vérification R2 complémentaire (19 novembre 2026)

La liste des buckets a été interrogée directement sur l'API du compte connecté. Cloudflare a répondu HTTP 403, code 10042 : `Please enable R2 through the Cloudflare Dashboard.` R2 n'est donc pas activé pour ce compte. Aucun bucket ni binding R2 n'a été créé. Cette activation doit être effectuée dans le tableau de bord Cloudflare par le titulaire du compte ; la configuration SAC ne doit pas simuler un stockage objet disponible.


## Mise à jour du 21 novembre 2026 — migrations et déploiement

- Sauvegarde D1 distante effectuée avant migration.
- Migrations `0018` et `0019` appliquées à `sac-db` ; aucune migration en attente.
- Commits `62c983f` et `bfe1d54` poussés sur `main`.
- Déploiement Cloudflare Pages de production `e507dda3-2cc0-4aa0-a8fc-c63b275af5b8`, source `bfe1d54`.
- `https://sac-3xh.pages.dev/api/health` retourne HTTP 200 avec la base connectée.
- Le bouton de connexion biométrique est présent dans le bundle de production ; il n’apparaît qu’après mémorisation locale d’une credential.
- Les tests réels OTP/Brevo, Face ID/empreinte physique et parcours complet à deux comptes restent à exécuter.
