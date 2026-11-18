# SAC — Proposition de schéma relationnel D1

**Statut :** proposition de conception, non validée et non exécutable.  
**Objectif :** préparer le schéma métier sans engager une migration prématurée.  
**Base concernée :** D1 `sac-db`, actuellement vide selon le dernier audit connu.  
**Règle absolue :** aucune table de coordonnées GPS précises n'est proposée tant que la destruction cryptographique irréversible à J+30 n'est pas démontrée.

La revue critique ouverte de cette proposition est consignée dans `docs/REVUE_SCHEMA_RELATIONNEL_D1.md`. Les points de cette revue doivent être traités avant toute conversion en SQL.

Ce document complète :
- `ARCHITECTURE_ET_MODELE_DONNEES.md` ;
- `PROTOCOLE_MULTI_APPAREILS.md` ;
- `CONTRAT_SECURITE_D1.md`.

Il ne choisit aucun fournisseur OTP, push, SMS ou paiement.

## 1. Principes du modèle

1. Un compte SAC peut posséder plusieurs appareils.
2. Une session est toujours liée à un compte et à un appareil précis.
3. Un contact de confiance est une relation entre deux comptes après invitation acceptée et vérification du moyen de contact.
4. Une invitation en attente n'accorde aucun accès.
5. Les destinataires d'une alerte sont figés au déclenchement.
6. Les événements importants sont conservés comme historique append-only ; les vues d'état courant ne remplacent pas cet historique.
7. Les coordonnées GPS, clés privées, jetons bruts, OTP en clair et secrets de cérémonie sont exclus de D1.
8. Les données métier sont supprimées selon une politique de conservation à définir ; la suppression d'un compte ne doit pas détruire silencieusement les preuves nécessaires à une alerte en cours.
9. Les identifiants sont opaques, générés côté serveur avec une source aléatoire cryptographiquement sûre.
10. Les dates sont enregistrées en UTC sous un format uniforme validé par le backend.

## 2. Périmètre de la première base métier

### 2.1 Comptes et coordonnées vérifiées

**`accounts`**
- `id` (clé primaire opaque)
- `status` : active, suspended, deletion_pending
- `preferred_language`
- `created_at`, `updated_at`

**`account_identities`**
- `id`
- `account_id`
- `channel` : phone ou email
- `normalized_value`
- `verified_at`
- `is_primary`
- `created_at`

Contraintes proposées :
- unicité globale de `(channel, normalized_value)` ;
- un moyen de contact ne peut être déclaré vérifié que par le backend après validation OTP ;
- les valeurs normalisées ne sont jamais acceptées comme preuve de vérification depuis le client ;
- un compte peut posséder plusieurs coordonnées vérifiées, sous réserve des règles de récupération à définir.

Le format de normalisation téléphone/e-mail doit être spécifié avant migration. Il ne faut pas supposer qu'un numéro brut saisi est déjà normalisé.

### 2.2 Défis d'authentification

**`auth_challenges`** (structure indépendante du fournisseur)
- `id`
- `account_id` nullable uniquement pour un parcours de première inscription strictement contrôlé
- `identity_id`
- `purpose` : signup, login, identity_change, recovery
- `challenge_hash`
- `attempt_count`, `max_attempts`
- `expires_at`, `consumed_at`
- `created_at`

Le fournisseur OTP, le canal réel, le format du code, le débit d'envoi et les règles anti-abus restent à sélectionner. Aucun code OTP en clair ne doit être stocké. L'utilisation d'un hash simple d'un code court est insuffisante contre une attaque hors ligne ; la méthode de protection du secret doit être décidée avec le mécanisme OTP.

### 2.3 Appareils, certificats et sessions

**`user_devices`**
- `id`, `account_id`
- `platform` : web, android, ios
- `label`
- `status` : pending_verification, active, revoked
- `is_root`
- `auth_version` (entier monotone)
- `created_at`, `last_seen_at`, `revoked_at`

Contraintes proposées :
- unicité de `(account_id, id)` ;
- au plus un appareil racine actif par compte ;
- appareil secondaire actif uniquement après validation du certificat et de la cérémonie d'approbation ;
- les transitions d'état sont contrôlées côté serveur.

**`device_certificates`**
- `id`, `account_id`, `device_id`
- `protocol_version`, `ceremony_id`
- `root_fingerprint`
- `identity_public_key`, `exchange_public_key`
- `certificate_signature`
- `status` : active, revoked, superseded
- `issued_at`, `revoked_at`

Seules les clés publiques et les signatures nécessaires à la vérification sont conservées. Aucune clé privée n'est acceptée dans cette table. Le format exact des JWK, leur canonicalisation, les tailles maximales et la liaison au transcript restent à fixer avant migration.

**`device_pairing_challenges`**
- `id`, `account_id`
- `root_device_id`, `pending_device_id`
- `challenge_hash` ou nonce public selon le protocole retenu
- `status` : pending, consumed, expired, rejected
- `expires_at`, `consumed_at`, `created_at`

Les secrets de cérémonie ne sont jamais enregistrés. Le choix entre stockage d'un hash, d'un nonce public ou d'un engagement cryptographique doit correspondre au transcript signé final.

**`device_sessions`**
- `id`, `account_id`, `device_id`
- `token_hash` unique
- `status` : active, revoked
- `auth_version`
- `created_at`, `expires_at`, `revoked_at`

La session référence exactement l'appareil qui l'a créée. Le jeton brut n'est jamais persisté. Le mode de transport (cookie sécurisé ou autre) reste ouvert.

### 2.4 Contacts de confiance

**`trusted_contacts`**
- `id`, `owner_account_id`, `contact_account_id`
- `status` : active, revoked
- `created_at`, `accepted_at`, `revoked_at`

Contraintes proposées :
- unicité de `(owner_account_id, contact_account_id)` ;
- interdiction d'une relation vers soi-même ;
- la relation est directionnelle : A peut choisir B sans que B donne automatiquement à A les mêmes droits ;
- révocation de la relation bloque les nouveaux partages et nouvelles alertes ; les alertes déjà déclenchées conservent leur instantané de destinataires.

**`contact_invitations`**
- `id`, `owner_account_id`
- `channel`, `normalized_destination`
- `invitation_token_hash`
- `status` : pending, accepted, revoked, expired
- `expires_at`, `accepted_by_account_id`, `accepted_at`, `created_at`

Une invitation ne crée pas de relation active à elle seule. L'acceptation exige la vérification du moyen de contact et l'association à un compte. Le jeton d'invitation brut n'est jamais stocké.

**`contact_alert_preferences`**
- `trusted_contact_id`
- `alert_category`
- `enabled`
- `updated_at`

Une ligne par relation et catégorie ; l'instantané de sélection est calculé côté serveur au déclenchement de l'alerte. Les catégories et niveaux restent validés contre les constantes du domaine SAC.

### 2.5 Alertes, destinataires et historique

**`alerts`**
- `id`, `author_account_id`
- `category`, `urgency`
- `description` (taille limitée, validation serveur)
- `status` : active, closed
- `closure_reason` : completed, cancelled (motif de clôture, non un état distinct)
- `triggered_at`, `cancelled_at`, `closed_at`

Les états doivent être affinés avec la machine à états métier avant migration. Une annulation ne supprime jamais l'alerte ni son historique.

**`alert_recipients`**
- `alert_id`, `contact_account_id`
- `trusted_contact_id` pour tracer la relation ayant autorisé l'envoi au moment du déclenchement
- `delivery_state` distinct de l'état de lecture ou de prise en charge
- `created_at`

Clé unique proposée : `(alert_id, contact_account_id)`. Les destinataires sont une copie figée ; une modification ultérieure des contacts ou préférences ne réécrit pas cette liste.

**`alert_events`**
- `id`, `alert_id`
- `event_type`, `actor_account_id` nullable selon le type d'événement
- `actor_device_id` nullable
- `metadata_json` strictement limitée à des métadonnées non sensibles
- `created_at`

Historique append-only côté application : pas de modification ni suppression d'événement par les routes ordinaires. Aucun jeton, secret, adresse GPS, payload GPS ou donnée de clé n'est permis dans `metadata_json`.

**`alert_responses`**
- `id`, `alert_id`, `contact_account_id`
- `response_type` : acknowledged, volunteered, withdrawn
- `created_at`

Les changements successifs doivent rester dans l'historique des événements. L'état courant du répondant principal est dérivé ou maintenu par une table dédiée avec une transition atomique ; il ne doit jamais être attribué par un simple tri côté client.

**`alert_responsibility_history`**
- `id`, `alert_id`, `contact_account_id`
- `started_at`, `ended_at`, `end_reason`

Cette table conserve les prises en charge successives. Une contrainte/transition atomique garantit un seul répondant principal courant par alerte.

### 2.6 Notifications et rappels

**`notification_outbox`**
- `id`, `alert_id`, `recipient_account_id`
- `channel`, `notification_type`
- `deduplication_key` unique
- `status` : pending, processing, sent, failed, cancelled
- `scheduled_at`, `created_at`, `sent_at`

**`notification_attempts`**
- `id`, `outbox_id`
- `provider_message_id` nullable
- `status`, `error_code` borné et non sensible
- `attempted_at`

L'acceptation d'une demande par un fournisseur ne prouve pas que le destinataire a lu la notification. Les rappels suivent la règle produit : toutes les cinq minutes vers les destinataires initiaux jusqu'à la clôture par l'auteur. Une expiration technique ou un échec d'envoi ne clôture jamais l'alerte.

Le mécanisme de planification et le fournisseur push restent à choisir. Le modèle outbox doit être conçu avec les garanties de reprise et d'idempotence du service retenu.

### 2.7 Protection des trajets, sans coordonnées

**`trips`**
- `id`, `author_account_id`
- `mode` : arrival_check, accompaniment, full_protection
- `destination_label` et/ou description non géographique selon le parcours validé
- `expected_arrival_at`
- `status`, `created_at`, `ended_at`

**`trip_participants`**
- `trip_id`, `contact_account_id`
- `created_at`

**`arrival_checks`**
- `id`, `trip_id`
- `status` : pending, confirmed, not_confirmed
- `due_at`, `confirmed_at`, `created_at`

L'absence de confirmation produit un événement « arrivée non confirmée » ; elle ne doit jamais être transformée automatiquement en constat d'accident ou de danger.

Aucune table `trip_locations` ni `alert_locations` n'est créée dans cette proposition.

### 2.8 Abonnements et paiements

Les tables `subscriptions` et `payments` sont reportées à une proposition ultérieure, après sélection du prestataire et définition des règles de renouvellement, remboursement, idempotence et rapprochement. Le statut Premium ne sera jamais modifiable depuis le client.

## 3. Index et contraintes transverses à prévoir

La migration devra examiner au minimum :
- unicité des coordonnées vérifiées par canal ;
- unicité des jetons hashés de session et d'invitation ;
- unicité des destinataires par alerte ;
- unicité des clés de déduplication outbox ;
- index des sessions actives par compte/appareil ;
- index des appareils actifs par compte ;
- index des invitations en attente par propriétaire et expiration ;
- index des alertes actives par auteur et date ;
- index des alertes reçues par destinataire et date ;
- index des événements par alerte et horodatage ;
- index des notifications en attente par statut et date de planification ;
- index des trajets actifs par auteur et échéance.

Les index finaux doivent être validés avec les requêtes réelles et leurs plans d'exécution. Les contraintes de clés étrangères et les comportements `ON DELETE` doivent être explicitement testés sur D1.

## 4. Machine à états à formaliser avant SQL

Les états indiqués ci-dessus sont des étiquettes de travail. Avant migration, formaliser et tester les transitions autorisées pour :
- compte et suppression de compte ;
- identité de contact et vérification ;
- appareil et certificat ;
- défi de jumelage ;
- session ;
- invitation et relation de confiance ;
- alerte, annulation et clôture ;
- réponse et prise en charge principale ;
- notification, nouvelle tentative et rappel ;
- trajet et confirmation d'arrivée.

Toute transition sensible doit être appliquée par une fonction métier serveur et une écriture SQL conditionnelle, pas par une mise à jour libre d'un champ envoyé par le client.

## 5. Exclusions non négociables

Le schéma ne doit pas contenir :
- coordonnées GPS précises, géohash ou historique de position ;
- clé GPS, clé privée, secret de déchiffrement ou matériel cryptographique restaurable ;
- jeton de session ou d'invitation en clair ;
- OTP en clair ;
- payload de notification contenant un secret ou des coordonnées ;
- copie de données GPS dans des métadonnées JSON ou des journaux.

L'exigence J+30 demeure : après expiration, aucune restauration D1, sauvegarde, export, réplication ou restauration administrative ne doit rendre les positions expirées lisibles. Ce document ne résout pas cette exigence.

## 6. Décisions et preuves requises avant migration

1. Revue du schéma par rapport au cahier des charges et à toutes les règles produit.
2. Définition de la suppression et conservation des comptes, invitations, alertes et journaux.
3. Validation des règles de vérification et de récupération d'identité.
4. Validation du format et du cycle de vie des certificats et défis de jumelage.
5. Validation des états et transitions de chaque domaine.
6. Revue des contraintes, clés étrangères, index et requêtes sensibles.
7. Tests D1 des accès croisés, concurrence, révocation, anti-rejeu, rollback et suppression.
8. Validation de l'isolation Preview/Production et des procédures de migration/retour arrière.
9. Revue séparée de la solution GPS J+30 ; aucune table GPS avant preuve.

**Aucune migration ne doit être générée ou appliquée sur la base de cette proposition seule.**


## 7. Amendments identifiés par la revue critique

Cette section complète la proposition initiale. Elle reste conceptuelle et ne constitue pas du SQL exécutable.

### 7.1 Liens composites obligatoires

Le modèle final devra garantir par clés étrangères composites que :
- `device_sessions(account_id, device_id)` référence un appareil du même compte ;
- `device_certificates(account_id, device_id)` référence le même compte et appareil ;
- `device_pairing_challenges(account_id, root_device_id)` et `(account_id, pending_device_id)` référencent deux appareils du même compte ;
- les réponses et événements d'une alerte sont liés à des acteurs autorisés par l'instantané des destinataires ;
- le destinataire d'une alerte ne peut pas être l'auteur.

Les contraintes de compte ne remplacent pas les contrôles d'autorisation applicatifs. Les comportements `ON DELETE` seront définis table par table, sans cascade aveugle sur les alertes et événements.

### 7.2 Abonnements push

**`push_subscriptions`** (nouvelle table à concevoir)
- `id`, `account_id`, `device_id`
- `endpoint_ciphertext` ou représentation protégée adaptée au fournisseur
- `endpoint_fingerprint` unique pour déduplication sans exposer le secret
- clés publiques et paramètres requis par le protocole push, si applicables
- `status` : active, revoked, expired
- `created_at`, `last_used_at`, `revoked_at`

Le format de protection du endpoint, le fournisseur et la rotation restent à choisir. L'abonnement doit être lié à un seul appareil. La révocation de l'appareil invalide ses abonnements dans la même opération atomique. Le worker d'envoi revalide l'état courant juste avant l'appel fournisseur.

### 7.3 Outbox et rappels récupérables

La table `notification_outbox` devra au minimum étudier :
- `attempt_count`, `next_attempt_at` ;
- `lease_owner`, `lease_until` pour les traitements temporaires ;
- `deduplication_key` déterministe par alerte, destinataire, canal et occurrence ;
- `reminder_sequence` ou identifiant d'occurrence ;
- `cancelled_at`, `last_error_code`.

Une ligne `processing` dont le bail a expiré doit pouvoir être reprise sans double envoi. Les workers concurrents doivent acquérir un bail par transition conditionnelle. La planification des rappels toutes les cinq minutes doit être idempotente et rester attachée aux destinataires figés de l'alerte. La clôture par l'auteur bloque les nouvelles occurrences et annule les lignes non envoyées ; la livraison tardive d'un message déjà accepté par un fournisseur reste une limite à expliquer.

### 7.4 Responsable principal courant

Le modèle final doit distinguer :
- l'accusé de réception d'une alerte ;
- la volonté de prendre la responsabilité ;
- la responsabilité principale effectivement attribuée ;
- le retrait de cette responsabilité.

`alert_responsibility_history` conserve les périodes. Une seule responsabilité non terminée est autorisée par alerte, avec une contrainte d'unicité adaptée. L'attribution au premier volontaire est réalisée par une transition SQL atomique. Un contact ne peut jamais clôturer l'alerte de l'auteur.

### 7.5 Immutabilité de l'historique

Les événements restent append-only par les routes applicatives. Des triggers de refus UPDATE/DELETE pourront être étudiés pour réduire les erreurs accidentelles, mais ne sont pas une protection contre un administrateur ou une restauration. Les métadonnées doivent être validées champ par champ ; aucun JSON arbitraire ni donnée GPS/secret n'est accepté.

### 7.6 Limitation des champs libres

`alerts.description` et les libellés de destination ne doivent pas recevoir automatiquement une adresse, une coordonnée ou un payload de localisation. Si l'utilisateur saisit volontairement des coordonnées dans un texte libre, ce contenu doit être traité comme une donnée de localisation et ne peut pas bénéficier d'une conservation ordinaire dans D1. Les corps de requête et descriptions sont exclus des logs par défaut.

### 7.7 Machine à états et conservation

Avant migration, chaque table doit disposer d'une matrice : états autorisés, transitions, acteur autorisé, durée de conservation, règle de suppression/anonymisation, dépendances et effets sur les alertes en cours. Les états proposés dans les sections précédentes sont indicatifs jusqu'à validation de cette matrice.



## 8. Amendement conceptuel — droits d'un destinataire après révocation

La relation `trusted_contacts` ne suffit pas à déterminer les droits sur une alerte déjà déclenchée. Le destinataire de l'instantané initial peut avoir une relation désormais révoquée ; cette révocation ne doit ni réécrire l'instantané ni supprimer mécaniquement les rappels déjà prévus.

Avant migration, le modèle doit séparer :
- **instantané de destinataire** : preuve que le compte était sélectionné au déclenchement ;
- **éligibilité aux rappels initiaux** : dérivée de l'alerte active et de l'instantané, conformément à la règle produit déjà établie ;
- **accès au détail de l'alerte** : politique distincte, encore à arbitrer ;
- **autorisation de recevoir de nouvelles positions** : révocable immédiatement, indépendante des rappels ;
- **autorisation de répondre / se porter volontaire / exercer la responsabilité** : politique distincte, encore à arbitrer.

Une éventuelle table `alert_recipient_permissions` pourrait porter les autorisations par alerte et destinataire, avec une clé primaire composite `(alert_id, recipient_account_id)`, des clés étrangères composites et des dates de changement. Elle ne doit pas contenir de coordonnées ni de payload GPS.

Ne pas ajouter de colonne `is_recipient` ou réutiliser `trusted_contacts.status` pour représenter tous ces droits. Ne pas figer les valeurs d'énumération tant que les arbitrages du document `ARBITRAGES_CONTACT_REVOQUE_ET_ALERTE_ORPHELINE.md` ne sont pas validés.

Les rappels initiaux doivent rester indépendants de la révocation de la relation ; une tâche de rappel ne doit pas être annulée comme effet secondaire de la révocation. En revanche, chaque émission de position doit vérifier l'autorisation de partage au dernier point d'envoi.

## 9. Amendement conceptuel — suppression de compte et alertes orphelines

Le statut de compte doit représenter explicitement l'état terminal logique `deleted`, en plus de `active`, `suspended` et `deletion_pending`. Le schéma devra inclure les horodatages de demande et de finalisation, sans supposer une durée de grâce non validée.

La finalisation ne peut pas se baser sur des compteurs envoyés par le client. Elle doit vérifier dans la transaction D1 finale qu'il ne reste aucune alerte ni aucun trajet actif, et que les opérations de révocation des sessions, appareils, abonnements push, invitations, outbox et accès fichiers sont cohérentes.

Une alerte orpheline reste un objet métier distinct du compte qui l'a créée. Tant que la politique de secours n'est pas validée :
- aucune clôture automatique ;
- aucun pouvoir de clôture donné aux contacts ;
- aucune suppression en cascade de l'alerte ou de ses événements ;
- aucune prolongation arbitraire des données GPS ;
- aucune confusion entre expiration du partage de position et clôture de l'alerte.

La matrice finale devra prévoir la minimisation ou pseudonymisation des données d'auteur et de destinataires, sous réserve des obligations légales et des preuves strictement nécessaires.


## 10. Matrice de traçabilité

La matrice détaillée table par table est désormais consignée dans `docs/MATRICE_TRACABILITE_SCHEMA_D1.md`. Elle relie les 21 tables conceptuelles aux invariants, contraintes/index, tests D1 et questions de conservation.

La matrice conclut explicitement que le schéma n'est **pas prêt pour migration**. Elle ne constitue ni une validation du modèle ni une autorisation d'écrire du SQL.
