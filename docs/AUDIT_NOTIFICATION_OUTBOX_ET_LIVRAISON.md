# SAC — Audit de l'outbox et de la livraison des alertes

**Date :** 18 novembre 2026  
**Branche examinée :** `main`  
**Commit de base :** `e2e238c1b345063e927bf288b38e221441aa444b`  
**Statut :** audit de préparation ; aucun worker, fournisseur ou mécanisme de notification n'est créé ici.

## 1. Périmètre vérifié

Fichiers relus :
- `docs/CONTRATS_OPERATIONS_ATOMIQUES_D1.md`, notamment la section 9 sur l'outbox et les rappels ;
- `docs/MACHINES_ETATS_ET_CONSERVATION.md`, notamment les états d'outbox, les rappels et les abonnements push ;
- `docs/MATRICE_TRACABILITE_SCHEMA_D1.md`, lignes conceptuelles `notification_outbox`, `notification_attempts` et `push_subscriptions` ;
- `package.json` ;
- `wrangler.toml` ;
- `functions/api/health.ts`.

Chemins recherchés mais absents sur `main` :
- `src/domain/notification-outbox.ts`
- `src/domain/notification-lifecycle.ts`
- `tests/notification-outbox.test.ts`
- `docs/CONTRAT_OPERATIONS_NOTIFICATIONS.md`

Cette recherche ciblée ne prétend pas inventorier chaque fichier du dépôt. Elle suffit néanmoins à constater que les contrats examinés décrivent un mécanisme futur, sans module ou suite de tests d'outbox trouvés aux emplacements attendus.

## 2. Conclusion

**NO-GO pour toute promesse de notification fiable ou de SOS livré.**

Le contrat de conception est bien orienté : tâche persistée, bail, appel fournisseur hors transaction, résultat ambigu distinct, reprise et déduplication. Mais aucune preuve d'implémentation d'un worker, d'une planification périodique, d'un fournisseur ou d'une reprise n'a été trouvée dans le périmètre vérifié.

Le fichier `functions/api/health.ts` vérifie uniquement que D1 répond à `SELECT 1`. Ce contrôle ne prouve ni qu'une tâche peut être planifiée, ni qu'un worker la traite, ni qu'un push ou SMS est transmis.

Le `wrangler.toml` examiné déclare le binding D1 et la sortie Pages. Il ne documente aucun déclencheur planifié de notification. Le `package.json` ne déclare aucune commande de test dédiée à l'outbox ou à l'intégration d'un fournisseur.

## 3. Constats

### N-01 — Pas de preuve d'un worker de notification

**Niveau : BLOQUANT**

Les contrats spécifient des états `pending`, `processing`, `sent`, `retry_wait`, `failed_terminal` et `cancelled`, mais aucun worker ni code d'acquisition de tâche n'a été identifié dans le périmètre vérifié.

**À exiger avant implémentation :**
- acquisition conditionnelle et atomique d'une tâche ;
- bail unique avec identifiant de propriétaire et échéance serveur ;
- récupération contrôlée des baux expirés ;
- revalidation de l'alerte et du destinataire avant tout appel externe ;
- finalisation conditionnelle réservée au détenteur du bail ;
- aucune transaction D1 ouverte pendant l'appel réseau.

### N-02 — Aucun planificateur vérifié pour les rappels de cinq minutes

**Niveau : BLOQUANT**

La fréquence produit de cinq minutes est documentée. Aucun mécanisme planifié réel, aucune règle de rattrapage et aucun test d'horloge/scheduler n'ont été vérifiés.

**À exiger avant implémentation :**
- une occurrence déterministe par alerte, destinataire, canal et numéro de séquence ;
- calcul des prochaines échéances côté serveur, jamais depuis l'horloge du téléphone ;
- planification atomique avec l'état actif de l'alerte ;
- clôture qui empêche toute occurrence future, même si elle concurrence le scheduler ;
- rattrapage défini après indisponibilité du scheduler sans créer de rafale non maîtrisée ;
- limites d'envoi et budget de tentatives documentés.

L'intervalle de cinq minutes est une règle métier de planification, pas une garantie de livraison toutes les cinq minutes. Les limites des plateformes mobiles et des fournisseurs doivent être communiquées honnêtement.

### N-03 — Le résultat ambigu du fournisseur est le risque principal de doublon

**Niveau : BLOQUANT**

Le contrat identifie déjà le cas critique : le fournisseur peut avoir accepté un message alors que le worker perd la réponse. Un simple retry peut alors envoyer un doublon.

**À exiger avant implémentation :**
- transmettre une clé d'idempotence stable au fournisseur lorsqu'il le permet ;
- conserver un identifiant fournisseur non secret et un état de réconciliation ;
- distinguer `accepted`, `delivered`, `read`, `temporary_failure`, `permanent_failure` et `unknown` ;
- ne jamais reclasser automatiquement un résultat ambigu en échec certain ;
- définir une procédure de réconciliation avant retry ;
- documenter le cas où le fournisseur ne permet ni idempotence ni interrogation d'état.

Ne pas promettre « exactement une fois ». Selon les capacités du fournisseur, la garantie réaliste peut être au mieux une livraison au moins une fois avec déduplication, ou une livraison incertaine explicitement signalée.

### N-04 — L'état « sent » ne doit pas signifier « proche prévenu »

**Niveau : ÉLEVÉ**

Les documents distinguent correctement l'acceptation par le fournisseur de la lecture par le proche. L'interface ne doit pas effacer cette distinction.

**À exiger avant implémentation :**
- « demande reçue par SAC » uniquement après persistance confirmée ;
- « notification acceptée par le fournisseur » uniquement après réponse positive du fournisseur ;
- « livrée » seulement si un accusé de livraison fiable existe ;
- « vue/confirmée par le proche » uniquement après une action authentifiée du proche ;
- afficher séparément les erreurs et les destinataires non confirmés.

Un accusé de réception dans SAC est une déclaration du contact, pas une preuve que le téléphone a affiché une notification système.

### N-05 — Les rappels doivent rester indépendants des accusés et de la prise en charge

**Niveau : BLOQUANT MÉTIER**

Règle produit existante : les rappels initiaux continuent vers tous les destinataires figés toutes les cinq minutes jusqu'à clôture par l'auteur. Un accusé, une candidature volontaire ou une responsabilité principale ne les arrête pas.

**À exiger avant implémentation :**
- le scheduler ne consulte pas un simple booléen « quelqu'un a répondu » pour arrêter les rappels ;
- chaque occurrence vise uniquement l'instantané initial ;
- aucun nouveau contact n'est ajouté à une alerte active ;
- les tâches en attente sont annulées à la clôture ;
- les tâches déjà acceptées par un fournisseur sont signalées comme potentiellement encore livrables ;
- une révocation de contact ne supprime pas implicitement un rappel initial déjà prévu.

### N-06 — Révocation appareil, abonnement push et droits du contact doivent être revalidés

**Niveau : ÉLEVÉ**

La matrice prévoit un abonnement push lié à un appareil et révoqué avec celui-ci. Les droits détaillés d'un contact révoqué pendant une alerte restent néanmoins à arbitrer.

**À exiger avant implémentation :**
- vérifier le statut de l'appareil et de l'abonnement juste avant l'envoi ;
- invalider les abonnements d'un appareil révoqué ;
- ne pas utiliser un endpoint push comme preuve d'identité ou de réception ;
- séparer les tâches de rappel SOS des tâches de partage GPS ;
- appliquer la politique décidée pour le contact révoqué sans réécrire l'instantané ;
- exclure tout GPS précis et tout secret du payload outbox.

### N-07 — La rétention et la protection des données des tentatives sont incomplètes

**Niveau : BLOQUANT AVANT DONNÉES RÉELLES**

La matrice identifie les durées de conservation des tâches et tentatives comme non décidées. Une erreur fournisseur peut contenir des données sensibles si elle est enregistrée sans filtre.

**À exiger avant implémentation :**
- définir une durée distincte pour tâche, tentative, identifiant fournisseur et code d'erreur ;
- journaliser des codes d'erreur normalisés et bornés, pas des corps de requête/réponse bruts ;
- exclure numéro de téléphone, e-mail, token, endpoint push, contenu libre, coordonnées GPS et clés ;
- borner la taille des messages d'erreur et filtrer les exceptions ;
- définir purge et restauration sans contourner les exigences de conservation ;
- vérifier les logs de workers, observabilité et analytics.

### N-08 — Aucun test outbox/D1 ou fournisseur n'est actuellement démontré

**Niveau : BLOQUANT**

Le `package.json` examiné ne déclare pas de script `test:notifications` ou de test d'intégration outbox. Les suites de tests pures existantes ne prouvent pas la concurrence entre workers, la reprise, la livraison ou le rollback D1.

**Tests obligatoires avant activation :**
1. deux workers tentent d'acquérir la même tâche ;
2. bail expiré repris une seule fois ;
3. clôture simultanée au scheduler ;
4. révocation appareil simultanée à l'envoi ;
5. réponse fournisseur perdue après acceptation ;
6. erreur temporaire, permanente et limite de tentatives ;
7. doublon d'occurrence et réutilisation d'une clé d'idempotence ;
8. échec après écriture intermédiaire et vérification du rollback ;
9. rappel continu après accusé et prise en charge ;
10. arrêt des rappels futurs après clôture ;
11. absence de GPS, secrets et données personnelles dans payloads/logs ;
12. isolation vérifiée de la base Preview.

Les tests doivent être exécutés sur D1 local, puis sur Preview isolé par identifiant de base. Aucun test destructif ne cible Production.

## 4. Architecture minimale à spécifier avant le code

1. **Écriture métier :** création atomique de l'alerte, de l'instantané, de l'événement et des tâches initiales.
2. **Scheduler :** crée les occurrences périodiques de manière déterministe et idempotente.
3. **Worker :** acquiert un bail, revalide l'autorisation et l'état, appelle le fournisseur hors transaction, puis finalise conditionnellement.
4. **Réconciliation :** traite les réponses ambiguës avant une nouvelle tentative.
5. **Clôture :** bloque atomiquement la planification et annule les tâches non encore envoyées.
6. **Observabilité :** conserve uniquement les métadonnées minimales, sans GPS ni secrets.
7. **Interface :** exprime exactement le niveau de preuve disponible et ne prétend jamais qu'un message a été lu sans confirmation.

Le fournisseur push/SMS, les garanties de délai, les budgets de retry, les durées de conservation et le mécanisme de planification restent à choisir et valider séparément. Aucun fournisseur n'est supposé.

## 5. Décision finale

**NO-GO — aucune notification d'urgence ne doit être annoncée comme opérationnelle.**

Les documents de conception fournissent une bonne base, mais le worker, le scheduler, l'idempotence fournisseur, la réconciliation et les tests D1 ne sont pas démontrés dans le périmètre vérifié. La priorité est de spécifier et tester ces mécanismes avant toute interface qui pourrait laisser croire à un envoi réel.

Aucun worker, route, migration, fournisseur, secret, ressource Cloudflare, donnée GPS ou notification réelle n'a été créé par cet audit.


## 5. Mise à jour d'implémentation — 19 novembre 2026

Les constats précédents décrivent l'état avant la tranche SOS ajoutée sur `main`. Le code couvre désormais une partie du contrat, sans lever le NO-GO sur les notifications réelles.

### 5.1 Réalisé dans le dépôt

- `migrations/0003_alerts_sos.sql` : outbox push D1 avec une notification initiale (séquence 0), puis des rappels numérotés.
- Le lanceur choisit un seuil de **1 à 5 rappels** avant l'évaluation de l'escalade SMS. La valeur ne limite plus la durée totale des rappels push.
- À chaque rappel réclamé, le service programme le rappel suivant à au moins cinq minutes, tant que l'alerte reste active.
- `migrations/0004_sos_reminder_leases.sql` : baux, reprise des tâches expirées, limite de cinq tentatives et état terminal.
- `functions/lib/alerts/sos-service.ts` : acquisition, finalisation, orchestration via adaptateur injecté et distinction entre acceptation fournisseur, retry et échec terminal.
- `migrations/0005_sos_sms_escalation.sql` : évaluation unique du seuil et création d'une tâche SMS par destinataire de l'instantané initial.
- L'évaluation SMS attend que le rappel correspondant au seuil soit terminé pour **tous** les destinataires : accepté par le fournisseur push ou arrivé à l'échec terminal après les tentatives prévues.
- Si un responsable principal a été attribué avant l'évaluation, même s'il s'est ensuite retiré, l'escalade est marquée `suppressed`. Sinon, les tâches SMS sont mises en attente.
- La clôture par l'auteur annule les rappels push et tâches SMS encore en attente/en cours.
- Les tests couvrent l'idempotence de l'évaluation concurrente, le seuil avant/après, les échecs push et reprises, la poursuite des rappels après le seuil, la suppression après prise en charge et l'annulation à la clôture.

### 5.2 État de référence antérieur

Les constats de cette section ont été dépassés par les tranches 5.3 à 5.6 ci-dessous. À la date de la présente mise à jour, un abonnement PWA et un transport Web Push sont présents dans le dépôt, mais le Worker planifié n'est pas déployé et aucune notification réelle n'est envoyée. Le SMS reste sans fournisseur ni adaptateur réel.


### 5.3 Abonnements Web Push — première tranche serveur

Commits ajoutés sur `main` après la mise à jour précédente :

- `4dbaa64e707f4fb901ccc77da16ade0047ebd37f` — migration `0008_push_subscriptions.sql` : table liée au compte et à l'appareil, empreinte HMAC unique, ciphertext, IV et version de clé.
- `a138bda086e0a4bd87bbf98835dcd7b43881b9db` — chiffrement/déchiffrement AES-256-GCM avec clés dérivées HKDF et empreinte endpoint HMAC.
- `8171f2b53a2fff0b711da3d7d738e5252c7ec80c` — endpoint `POST /api/push/subscriptions`, protégé par session d'appareil authentifiée et contrôle same-origin ; enregistrement ou suppression limitée à l'appareil courant.
- `7eb91dcc37f19e8c676b3d0323a75c155f88ec8c` — tests unitaires de chiffrement, IV, isolation par clé et intégrité.
- `efe0979d8a834cd63d28b3df85fbff08caa1d640` — commande `test:push-subscriptions`.
- `ad26adf18d51606ca5900b4c0c33c41ee46db315` — health check exige la nouvelle table dans le schéma complet.
- `ab5bd782a481b1b33065713885b65b3a14266167` — tests SQLite de contraintes, unicité et purge à la révocation de l'appareil.
- `9dce3b7f5ce8c1188d3a1a0beb05c02c7ab856e1` — ajout des deux suites aux étapes CI.
- `1ae14c40538d252ec599dcd2fcf4c7535ff7531a` — documentation migration et configuration du secret.

**Configuration effectuée le 19 novembre 2026 :** le secret Cloudflare `PUSH_SUBSCRIPTION_ENCRYPTION_KEY` (32 octets base64url) a été généré et configuré comme secret du projet Pages `sac` pour l'environnement Production. Sa valeur reste masquée et n'est pas conservée dans Git ou D1. Les migrations D1 `0001` à `0008` ont été appliquées à `sac-db` après autorisation explicite ; leurs huit noms sont inscrits dans `d1_migrations`. Le schéma a été relu et `PRAGMA foreign_key_check` n'a retourné aucune anomalie. La configuration du secret n'active pas à elle seule les envois.

**Limites à cette étape :** le client PWA, le Service Worker et le transport VAPID ont depuis été ajoutés (section 5.6). Le stockage chiffré et son endpoint ne signifient toujours pas que les notifications fonctionnent tant que les clés VAPID et les secrets propres au Worker ne sont pas configurés, puis que le Worker n'est pas déployé.


### 5.4 Intégrité des abonnements et limites de livraison

- `8894be834efc1e8419bd423d72a9dfebc81b1450` — le ciphertext AES-GCM est désormais lié en AAD à l'empreinte HMAC de l'endpoint ; le déchiffrement recalcule aussi cette empreinte.
- `6e3098d4ebfe56a1f64a6d81adf5402e631f39ee` — test de modification/substitution de l'empreinte.
- `424a22a8ff1f5a55fe5995cf80a1a812c5af8d31` — contrainte D1 : une seule souscription active par appareil.
- `e5c6afbc2de1b887efce4029894487df2780d4cc` — remplacement de la souscription par batch D1 transactionnel.
- `48ab344613ff802a6b5a2ec3613eabaab08637ad` — test de la limite par appareil.
- `5505b3c00eaca1f9e82ada81cbccc63a749354ac` et `5ec34a1a65c7cddb72e26f669b711b4d2e9e4d89` — contrats et procédure de migration actualisés.
- `23040fc631e74c667362e511e9c868fc6ff0f364` — exigence anti-SSRF avant tout appel vers un endpoint push enregistré.

La réception d'un endpoint depuis un navigateur n'autorise jamais le Worker à lui faire confiance. Avant toute livraison, il faudra restreindre les destinations aux fournisseurs Web Push explicitement autorisés et bloquer les destinations locales/privées ainsi que les redirections non validées. Aucun appel réseau vers les endpoints n'existe dans cette tranche.


### 5.5 Configuration distante D1 et secret — 19 novembre 2026

Après autorisation explicite du propriétaire :
- les migrations `0001` à `0008` ont été appliquées dans l'ordre à la base Cloudflare D1 `sac-db` liée au projet Pages `sac` ;
- la table `d1_migrations` contient les huit noms de fichiers et leurs dates d'application ;
- les tables, index et triggers attendus, dont `push_subscriptions`, sont présents ;
- `PRAGMA foreign_key_check` ne retourne aucune ligne ;
- le secret `PUSH_SUBSCRIPTION_ENCRYPTION_KEY` a été généré avec 32 octets aléatoires et ajouté comme variable `secret_text` dans la configuration Production du projet Pages. Cloudflare masque sa valeur lors de la relecture.

**Ce qui reste désactivé/non configuré :** l'enrôlement WebAuthn reste fermé (`WEBAUTHN_ROOT_ENROLLMENT_ENABLED=false`) ; les déploiements Production restent désactivés ; aucun VAPID, abonnement PWA, scheduler ni adaptateur de livraison n'est activé. Aucun push ou SMS réel n'a été envoyé. L'ajout du secret à la configuration ne signifie pas que la version actuellement servie a été redéployée ou utilise déjà ce secret.


### 5.6 Abonnement PWA et transport Web Push — 19 novembre 2026

Code ajouté directement sur `main` :

- `src/services/notifications/push-subscription.ts` : demande d'autorisation uniquement après action explicite, création/récupération PushManager, sérialisation de l'abonnement et synchronisation authentifiée avec l'API SAC ; désactivation serveur avant désabonnement local.
- `src/components/PushNotificationSettings.tsx` : panneau de gestion dans l'espace privé, avec états pris en charge / bloqué / non configuré / enregistré.
- `src/PrivateSpacePage.tsx` : intégration du panneau dans l'espace privé.
- `public/sw.js` : réception Push et notification système au contenu générique ; le clic ouvre SAC sans transporter de jeton ni de détail d'alerte.
- `functions/api/push/vapid-public-key.ts` : exposition publique et sans cache de la seule clé VAPID publique, avec validation stricte de sa forme ; réponse 503 tant que la clé n'est pas configurée.
- `functions/lib/notifications/web-push-delivery.ts` : construction VAPID ES256, chiffrement de contenu Web Push `aes128gcm`, refus des endpoints hors liste d'hôtes autorisés, HTTPS obligatoire et redirections non suivies ; réponses 404/410 classées comme abonnements expirés.
- `workers/sos-notification-delivery/index.ts` et `workers/sos-notification-delivery/wrangler.toml` : Worker planifié distinct, conçu pour appeler le dispatcher SOS chaque minute sur l'outbox D1.
- `tests/web-push-delivery.test.ts`, `tsconfig.workers.json`, scripts package et CI : tests cryptographiques/anti-SSRF et vérification TypeScript du Worker ajoutés.

**Configuration manquante avant activation :**
- aucune paire VAPID n'a été générée ou configurée ;
- `PUSH_VAPID_PUBLIC_KEY` n'est pas encore renseignée dans Pages ;
- `PUSH_VAPID_PRIVATE_JWK`, `PUSH_SUBSCRIPTION_ENCRYPTION_KEY` et `PUSH_VAPID_SUBJECT` ne sont pas configurés dans le nouvel environnement du Worker ;
- le Worker Cron n'a pas été créé/déployé sur Cloudflare ;
- le déploiement de Production Pages reste désactivé ; aucun déploiement n'a été déclenché.

Le Worker traite une tâche de rappel par destinataire et envoie un push générique à chaque abonnement actif de ses appareils enrôlés. Si un destinataire possède plusieurs appareils et qu'un fournisseur accepte certains envois mais qu'un autre échoue temporairement, une reprise peut répéter un envoi déjà accepté : Web Push ne fournit pas ici de garantie exactly-once. Cette limite est explicitement conservée ; elle ne doit pas être présentée comme une livraison garantie sans doublon.

**État final de cette tranche :** fondation PWA et transport serveur écrits dans le dépôt ; aucune livraison active. Les tests ajoutés n'ont pas encore de résultat CI vérifié. Les envois réels, la planification Cloudflare et les clés VAPID restent NO-GO jusqu'à configuration, déploiement autorisé et validation.


### 5.7 Cohérence de la limite de destinataires — 19 novembre 2026

L'audit du contrat entre le service SOS et l'interface a révélé que le service classait un dépassement du nombre autorisé de destinataires comme une entrée génériquement invalide, alors que l'API et l'interface prévoyaient une erreur métier dédiée. Le service renvoie désormais `recipient_limit_exceeded` avant toute lecture ou écriture D1 ; la route traduit cette erreur en HTTP 409 et l'interface peut afficher son message explicite. La limite actuelle reste inchangée : 2 proches pour l'offre gratuite ; le plafond Premium de 10 nécessite toujours une décision d'abonnement côté serveur et n'est pas activé par cette correction.

Un test D1 local dédié à cette réponse a été ajouté à la suite SOS existante. Aucun compte, destinataire ou alerte réelle n'a été créé ; aucun envoi n'a été effectué.


### 5.8 Validation des abonnements avant stockage — 19 novembre 2026

La validation des abonnements est maintenant centralisée dans `functions/lib/notifications/push-endpoint-policy.ts`. La route d'enregistrement refuse les endpoints hors liste des fournisseurs Web Push autorisés, les ports non standards et les URLs non HTTPS. Elle importe aussi la clé publique du navigateur comme vraie clé ECDH P-256 avant chiffrement et stockage ; une chaîne de 65 octets mal formée n'est plus acceptée comme abonnement valide. Le transport de livraison réutilise exactement la même politique, ce qui évite une divergence entre les destinations acceptées à l'inscription et celles contactables par le Worker.

La suite `test:web-push-delivery` couvre les hôtes, ports et clés valides/invalides. Cette correction n'active pas les abonnements ni le transport réel et ne déclenche aucun appel réseau vers un endpoint de proche.


### 5.9 Audit ciblé — reprise Push multi-appareils après acceptation partielle — 19 novembre 2026

**Périmètre relu :** `functions/lib/notifications/web-push-delivery.ts`, contrat de notifications, contrat de résilience, matrice de traçabilité D1, machines à états et décision validée sur les connexions simultanées multi-appareils.

**Constat confirmé dans le code :**

- `createSosWebPushSender()` charge les abonnements actifs du destinataire et parcourt chaque appareil.
- Chaque résultat `accepted` augmente un compteur local uniquement ; aucun résultat par abonnement n'est persisté par cette fonction.
- Si un abonnement est accepté mais qu'un autre retourne `retry`, `blocked`, ou une erreur de déchiffrement, le résultat agrégé reste `false`.
- L'appelant peut donc considérer la tâche destinataire comme non résolue et la reprendre, ce qui peut renvoyer le push aux appareils déjà acceptés.
- Les abonnements expirés (`gone`) sont supprimés, mais cette suppression ne fournit pas une trace durable de la tentative.
- Une réponse fournisseur perdue après acceptation reste indiscernable d'un échec temporaire au niveau de cette fonction.

**Conclusion :** le risque de doublon multi-appareils n'est pas seulement théorique ou documentaire ; le transport actuel ne conserve pas de progression durable par abonnement. La règle produit multi-appareils est validée, mais la reprise sans répétition évitable n'est pas encore implémentée.

**Conception cible à instruire avant toute modification D1 :**

1. Identifier durablement une unité de livraison par tâche d'outbox et abonnement d'appareil, sans enregistrer endpoint, clé de souscription, payload sensible ou GPS dans les tentatives.
2. Distinguer au minimum les états `pending`, `accepted`, `permanent_failure` et `unknown`. `accepted` signifie uniquement accepté par le fournisseur ; il ne signifie ni livré ni lu.
3. Réserver atomiquement chaque unité de livraison avant l'appel réseau, avec un bail qui empêche deux workers de l'envoyer simultanément.
4. Persister chaque résultat séparément. Une reprise ignore les unités déjà `accepted`, et ne traite pas automatiquement `unknown` comme un échec certain.
5. Revalider l'état courant du compte, de l'appareil, de l'abonnement, de l'alerte et du destinataire juste avant l'envoi.
6. Pour une réponse fournisseur perdue, conserver l'incertitude. N'effectuer une nouvelle tentative qu'avec une règle de réconciliation/idempotence supportée et documentée par le fournisseur ; sinon, exposer explicitement le compromis opérationnel.
7. Conserver la tâche métier de rappel indépendante des résultats par appareil : l'acceptation sur un appareil ne doit ni arrêter les rappels futurs ni modifier l'état SOS.
8. Garder les événements de transport séparés de la chronologie humaine de l'alerte.

**Points bloquants non résolus :**

- La matrice D1 marque encore la structure et la rétention de `notification_attempts` comme à définir.
- Les contrats n'ont pas fixé la durée de conservation des tentatives, les délais de retry, le nombre maximal de tentatives ni le traitement final des états ambigus.
- Le schéma relationnel global reste NON PRÊT POUR MIGRATION.
- Il faut vérifier les garanties exactes du fournisseur Web Push retenu avant de choisir une stratégie de réconciliation.

**Garde-fous :** cette mise à jour est un audit du code et une conception cible. Elle ne crée aucune table, migration, endpoint, Worker, ressource Cloudflare ou fournisseur ; elle ne déclenche aucun push ni SMS. Aucun déploiement n'est effectué. Les choix non approuvés restent ouverts.

