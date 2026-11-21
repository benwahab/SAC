# Audit complet SAC — 21 novembre 2026

## Objet et méthode

Audit de bout en bout du dépôt `benwahab/SAC`, branche unique `main`, et de l’infrastructure Cloudflare réellement déployée. Les vérifications ont été faites par lecture du code, exécution des tests, requêtes HTTP sur les URLs de production et inspection des ressources Cloudflare via Wrangler/API.

Cet audit distingue trois niveaux :

- **Vérifié** : preuve reproductible dans cette session.
- **Déployé mais non prouvé de bout en bout** : la ressource existe et répond, mais le parcours complet dépend d’un appareil, d’une boîte e-mail ou d’un fournisseur réel.
- **Non opérationnel ou non arbitré** : ne doit pas être présenté comme disponible.

## Infrastructure vérifiée

- Projet Cloudflare Pages : `sac`, URL de production `https://sac-3xh.pages.dev`.
- Dernier déploiement de production vérifié avant la présente mise à jour documentaire : `b86a738b-6609-47cc-a2c8-29cdff3f0cc9` (commit `67be51e`), servi par l’alias `https://sac-3xh.pages.dev`.
- Base D1 : `sac-db`, identifiant `892ce876-f279-409c-8f9e-06b1dca66e9d`.
- Migrations distantes appliquées : `0001` à `0015`, dont les tables de compte, identités, alertes, destinataires, événements, outbox SMS/rappels, responsabilité, tickets GPS, abonnements push, rétention des notifications, rôles Super Admin, missions déléguées et journal administratif append-only.
- Worker GPS : `sac-gps-relay`, version déployée `b184406b-118e-4821-a818-0cd06d5bb98d`, bindings `DB`, `GPS_ROOMS`, `GPS_RELAY_E2EE_READY=true`.
- Worker de livraison SOS : `sac-sos-notification-delivery`, version déployée `e53280e6-5a72-4eed-b28a-7a737e05e3ce`, crons `* * * * *` et `0 * * * *`, binding D1 `sac-db`.
- Secrets Pages présents : `BREVO_API_KEY`, `EMAIL_OTP_HMAC_SECRET`, `GPS_RELAY_HMAC_SECRET`, `PUSH_SUBSCRIPTION_ENCRYPTION_KEY`, `PUSH_VAPID_PRIVATE_JWK`, `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_SUBJECT`, entre autres.
- Secrets du Worker de notification configurés lors du déploiement : chiffrement des abonnements push, paire VAPID P-256 et sujet VAPID.
- `GET /api/health` retourne `200` avec `{"ok":true,"service":"sac-api","database":"connected"}`.
- `GET /api/push/vapid-public-key` retourne la clé publique VAPID active ; elle correspond à la clé privée utilisée par le Worker.
- `GET /api/admin/audit` retourne `401 authentication_required` sans session, ce qui confirme que la route admin est servie et que le garde échoue correctement.

## Changements livrés dans cette session

### 1. Activation contrôlée du relais GPS éphémère

- `GPS_RELAY_E2EE_READY` passe à `true` dans `workers/gps-relay/wrangler.toml`.
- Le Worker refuse toute connexion avec `503 gps_relay_not_ready` si l’interrupteur n’est pas explicitement actif.
- Le relais ne persiste aucune position GPS : les messages chiffrés circulent dans le Durable Object et ne sont pas écrits dans D1.
- Les tickets de connexion restent à usage unique et à durée courte.
- Le routage des messages chiffrés est isolé par `isRelayTarget` : un message `gps-encrypted` n’est transmis qu’au destinataire adressé ; les annonces de clé ne circulent qu’entre l’auteur et les destinataires.
- La CSP Pages autorise désormais `wss://sac-gps-relay.benwahab111.workers.dev` pour le WebSocket, sans ouvrir `connect-src` à d’autres origines.

### 2. Parcours d’alerte et localisation

- Ajout des traductions FR/EN/AR pour la clôture d’alerte et les erreurs de réponse.
- Amélioration du panneau d’alerte privée : clôture par l’auteur, confirmation, annulation et messages d’erreur.
- Amélioration de l’affichage de la position live : état de révélation, erreurs et absence de promesse de succès non confirmée.
- Les destinataires d’une alerte restent figés à la création, conformément au contrat SOS ; une révocation ne réécrit pas l’instantané d’une alerte déjà déclenchée.

### 3. Identité visuelle

- Remplacement de la direction orange sombre par le vert clair effet verre dépoli, le blanc, le rouge d’alerte et un vert de confirmation distinct.
- Mise à jour de la palette Tailwind et des surcharges CSS de l’accueil, de la connexion, des offres, des principes et de l’espace privé.
- Correction des contrastes de la page de connexion et du bouton « Connexion » de l’en-tête.
- Aucun violet ni bleu nuit comme couleur principale.

### 4. Tests et outillage

- Ajout de `tests/gps-relay-protocol.test.ts` et `tests/gps-relay-readiness.test.ts`.
- Suppression du script `test:location-trust`, qui pointait vers un fichier de test inexistant.
- `npm audit --omit=dev --audit-level=high` : 0 vulnérabilité.
- `npm audit --audit-level=high` : 0 vulnérabilité.

## Résultats de tests exécutés

- `npm run typecheck` : OK (application, Functions, Workers).
- `npm run build` : OK.
- `npm run test:sos-d1` : OK après réinitialisation de l’état D1 local de test.
- `npm run test:contact-invitations-d1` : OK.
- `npm run test:health` : 4/4 OK.
- `npm run test:gps-relay-protocol` : 6/6 OK.
- `npm run test:gps-relay-readiness` : 2/2 OK.
- `npm run test:web-push-delivery` : 5/5 OK.
- `npm run test:push-subscriptions` : 5/5 OK.
- `npm run test:d1-notification-retention` : 12/12 OK.
- `npm run test:d1-gps-relay-tickets` : 9/9 OK.

## Ce qui reste non prouvé

Les points suivants ne doivent pas être déclarés opérationnels sans preuve réelle :

- **Parcours complet sur appareil réel** : création de compte, OTP e-mail réel, enrôlement WebAuthn, session multi-appareils, déclenchement SOS, réception push, ouverture du lien et clôture.
- **Livraison push réelle** : le Worker est déployé et ses crons sont enregistrés, mais aucun abonnement push actif n’existait au moment de l’audit. La livraison vers un fournisseur réel n’est donc pas prouvée.
- **Livraison e-mail réelle** : Brevo est configuré, mais l’arrivée d’un OTP dans une boîte réelle n’a pas été testée.
- **GPS de bout en bout** : le relais est actif et les tests de protocole passent, mais une session navigateur réelle avec deux appareils et consentement utilisateur n’a pas été exécutée.
- **Sauvegardes mobiles et destruction J+30** : les exclusions Android/iOS restent des mesures de réduction du risque, pas une preuve d’effacement irréversible. Aucun test natif n’a été exécuté.
- **Conformité juridique Niger** : l’ancienne HAPDP n’est pas une autorité opérationnelle actuelle. Les textes authentiques et les circuits ministériels restent à vérifier. Aucune formalité n’a été déposée.
- **Récupération de racine** : interdite en V1 ; aucun parcours de remplacement de racine n’est activé.
- **Console administrative et permissions nominatives** : les contrats documentaires ne valent pas implémentation. Aucun rôle, endpoint ou migration administrative n’a été ajouté.
- **Idempotence du déclenchement SOS** : non implémentée dans cette session ; un double envoi côté client reste un risque à traiter.
- **Observabilité de production** : les crons et les Workers existent, mais aucun tableau de bord ni alerte d’exploitation n’a été validé.

## Administration et gouvernance

Le dépôt contient une console Super Admin, des routes `/api/admin/accounts`, `/api/admin/missions`, `/api/admin/missions/[missionId]` et `/api/admin/audit`, ainsi que les migrations `0013_super_admin_bootstrap.sql`, `0014_admin_missions_and_audit.sql` et `0015_admin_mission_mutation_token.sql`.

Points vérifiés :

- Les migrations `0013`, `0014` et `0015` sont appliquées à la D1 distante. Les tables `account_roles`, `admin_missions`, `admin_mission_permissions` et `admin_audit_events` existent, ainsi que les triggers append-only.
- Le garde `requireSuperAdminSession` vérifie d’abord une session appareil authentifiée, puis le rôle `super_admin` dans D1. Aucun rôle fourni par le client n’est accepté.
- Les routes d’écriture utilisent `guardSameOriginJsonPost`, un corps JSON borné et des validations de permission, de périmètre et d’échéance.
- Le journal `admin_audit_events` est protégé par des triggers D1 qui refusent modification et suppression.
- Le rôle Super Admin est unique et lié à une identité e-mail vérifiée.
- La mise à jour d’une mission utilise un verrou optimiste sur `version` et un jeton de mutation unique. Une requête concurrente ne peut plus remplacer les permissions d’une mission déjà modifiée ; le test `test_stale_mutation_cannot_replace_permissions` le vérifie.
- Les consultations de la liste des missions, de la recherche de comptes et du journal d’audit créent un événement `admin.missions.read`, `admin.accounts.search` ou `admin.audit.read`, sans journaliser la recherche brute.

Points non résolus :

- Aucun rôle Super Admin n’existe encore en production : la migration n’a créé aucun rôle (`roles=0`). Le bootstrap est lié à l’adresse `benwahab111@gmail.com` et le rôle sera attribué uniquement lorsque cette identité sera créée et vérifiée. Cette adresse doit être confirmée comme identité d’exploitation.
- La console n’a pas été testée avec un compte Super Admin réel, une session WebAuthn réelle et une vérification e-mail réelle.
- Les textes de la console sont définis localement dans `src/AdminDashboard.tsx` au lieu d’être centralisés dans `src/i18n/translations.ts`.
- Le journal de consultation croît à chaque lecture ; aucune politique de rétention ou d’archivage n’est encore arbitrée.

## CI et déploiement

- `SAC quality checks` est vert sur le commit `67be51e` (run `44876630751`).
- Le workflow manuel `Deploy SAC SOS notification Worker` a été rendu non bloquant lorsque les secrets GitHub `CLOUDFLARE_API_TOKEN` ou `PUSH_*` ne sont pas configurés. Il publie un avertissement et laisse le Worker sur sa version Cloudflare existante.
- Le Worker de notification a été déployé manuellement avec ses secrets Cloudflare ; le workflow GitHub ne peut pas les recréer sans les secrets de dépôt, que le jeton de l’agent n’a pas le droit d’écrire.
- Le déploiement Pages est automatique depuis `main` et le dernier déploiement de production sert bien la CSP avec `wss://sac-gps-relay.benwahab111.workers.dev`.

## Verdict

Le socle public, l’API de santé, la base D1, le relais GPS éphémère et le Worker de notification sont déployés et vérifiés au niveau infrastructure et tests automatisés. L’identité visuelle est revenue au vert clair demandé.

Le projet n’est pas encore « 100 % production » au sens de preuve de bout en bout : les parcours réels appareil/e-mail/push/GPS, les sauvegardes natives, la conformité juridique et l’idempotence SOS restent à valider. Ces limites sont explicites et ne doivent pas être masquées par les tests unitaires.

La console administrative est désormais migrée en production, avec un journal append-only et un contrôle de concurrence testé. Aucun compte Super Admin réel n’a encore été activé ni utilisé pour un test de bout en bout.

## Retour arrière

- GPS : repasser `GPS_RELAY_E2EE_READY` à `false` dans `workers/gps-relay/wrangler.toml`, puis redéployer `sac-gps-relay`. Le relais répondra `503 gps_relay_not_ready`.
- Notifications : suspendre les crons du Worker `sac-sos-notification-delivery` ou retirer ses secrets si la livraison doit être coupée.
- Pages : redéployer un déploiement de production antérieur depuis Cloudflare Pages.
