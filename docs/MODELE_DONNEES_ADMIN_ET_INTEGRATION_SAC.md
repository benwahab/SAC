# SAC — Modèle de données administratif et intégration au modèle général

Date : 18 novembre 2026  
Statut : modèle logique de conception ; non implémenté et non validé comme schéma SQL.  
Périmètre : comptes administratifs, rôles, permissions, missions, sessions, appareils, accès aux ressources, audit, dossiers de vérification, clôtures administratives et exports.

## 1. Règle de lecture

Ce document organise les entités et relations nécessaires à la future administration SAC. Il ne crée ni table, ni migration, ni endpoint, ni permission active. Les noms sont conceptuels et devront être alignés sur les contrats D1, les décisions validées et les contraintes réelles de Cloudflare D1.

Trois niveaux doivent rester distincts :
- **Décision validée** : règle déjà approuvée par l'utilisateur.
- **Modèle proposé** : structure recommandée pour représenter cette règle.
- **À arbitrer** : détail qui ne doit pas être figé sans validation.

## 2. Principes structurants

1. Un compte utilisateur est une identité ; un rôle administratif est une fonction ; une permission est une action atomique ; une mission est une délégation limitée par un périmètre et une durée.
2. Aucun privilège ne découle implicitement d'un intitulé de rôle.
3. Le Super Admin est l'unique autorité de gestion des missions et délégations.
4. Un délégataire ne peut ni créer un autre administrateur, ni déléguer, ni étendre ses propres droits.
5. Les droits sont vérifiés côté serveur à chaque lecture et écriture sensible.
6. L'historique des actions et décisions est append-only.
7. Les données d'audit ne doivent pas recopier les secrets ni le contenu privé des alertes.
8. Une suspension de compte ne clôture pas une alerte déjà transmise.
9. Les données administratives ne doivent pas être confondues avec les données métier de l'utilisateur.
10. Le modèle relationnel ne doit pas créer un second compte pour la même personne uniquement parce qu'elle reçoit une fonction administrative.

## 3. Entités conceptuelles

### 3.1 Identité et authentification

| Entité logique | Rôle | Relations principales |
|---|---|---|
| `users` | Identité SAC, coordonnées, état du compte | 1:N sessions, appareils, missions reçues, événements |
| `user_sessions` | Sessions, dates d'émission/expiration, révocation, version | N:1 utilisateur, éventuellement appareil |
| `user_devices` | Appareils connus, clés publiques, état et révocation | N:1 utilisateur |
| `email_verification_challenges` | Défis OTP e-mail, finalité, expiration, consommation et compteur d'essais | N:1 utilisateur ou adresse en cours de vérification |
| `security_events` | Événements techniques de sécurité non secrets | N:1 acteur ou compte concerné, si connu |

Le compte conserve les états validés : `pending_verification`, `active`, `suspended`, `deletion_pending`, `deleted`. La vérification e-mail est un fait distinct de l'état du compte. Le numéro de téléphone est obligatoire à la création et stocké avec indicatif international, mais sa possession n'est pas indépendamment vérifiée ; il ne faut pas le marquer comme vérifié par simple déclaration.

La politique de session utilisateur approuvée reste : déconnexion après 30 jours consécutifs d'inactivité et réauthentification obligatoire au plus tard à 90 jours, même en cas d'activité régulière.

### 3.2 Identité administrative et attribution des rôles

| Entité logique | Rôle | Relations principales |
|---|---|---|
| `admin_role_catalog` | Catalogue fermé des fonctions administratives | 1:N affectations |
| `admin_role_assignments` | Affectation d'une fonction à un compte, dates et état | N:1 utilisateur, N:1 rôle |
| `admin_permissions_catalog` | Catalogue contrôlé des permissions atomiques | 1:N associations aux missions |
| `admin_missions` | Mission attribuée par le Super Admin | N:1 bénéficiaire, N:1 créateur |
| `admin_mission_permissions` | Permissions explicites, portée et exclusions d'une mission | N:1 mission, N:1 permission |
| `admin_mission_events` | Transitions de cycle de vie et historique de mission | N:1 mission, acteur |

Les rôles envisagés sont Super Admin, Administrateur sécurité, Support et Auditeur. Le Super Admin est une autorité spéciale et ne doit pas être représenté comme une délégation ordinaire révocable par un autre compte. Les règles d'attribution exacte et le modèle de bootstrap du premier Super Admin restent à formaliser.

Le catalogue des permissions est global et contrôlé ; les droits effectifs d'un délégataire proviennent uniquement de ses missions actives. Une mission référence des permissions atomiques et un périmètre explicite. Il n'existe pas de permission implicite issue du rôle.

### 3.3 Ressources, périmètres et dossiers

Les permissions peuvent viser une ressource globale, un service, un dossier, une alerte unique ou une mission déterminée. Le périmètre doit être représenté explicitement et vérifié côté serveur ; ne pas stocker une liste libre de ressources dans un champ texte non contrôlé.

Modèle recommandé :
- une mission possède une portée typée et normalisée ;
- une permission de mission décrit l'action, la ressource, la portée et les exclusions ;
- une opération sensible référence la mission précise qui l'autorise ;
- une requête qui ne peut pas être associée sans ambiguïté à une mission est refusée.

La structure physique du périmètre (colonnes typées, table de liaison ou autre) reste à définir après inventaire des ressources réelles.

### 3.4 Dossiers de clôture administrative

| Entité logique | Rôle | Relations principales |
|---|---|---|
| `admin_alert_reviews` | Dossier de vérification administrative relatif à une alerte | N:1 alerte, N:1 acteur initiateur |
| `admin_alert_review_checks` | Tentatives de contact, sources consultées, résultats et limites | N:1 dossier |
| `admin_alert_closure_decisions` | Décision et motif de clôture ou maintien actif | N:1 dossier, N:1 alerte, N:1 décideur |
| `admin_alert_closure_notifications` | Résultat de notification de chaque destinataire initial | N:1 décision, N:1 destinataire |

Ces noms sont conceptuels. Les vérifications ne doivent pas stocker le corps de conversations privées si un résumé factuel et une référence d'événement suffisent. Les appels doivent distinguer réponse humaine, messagerie envoyée, accusé technique, messagerie vocale, absence de réponse et impossibilité de contact.

La règle spéciale déjà validée :
- elle s'applique au scénario du titulaire suspendu et d'une suspicion d'abus/perte de téléphone ;
- seul le Super Admin ou un Administrateur sécurité avec permission spéciale nominative peut clôturer ;
- un contact peut signaler la fin du danger et demander une clôture, mais ne peut pas la réaliser ;
- le titulaire suspendu ne peut pas clôturer seul cette alerte ;
- un seul administrateur autorisé suffit ;
- l'absence de réponse ne prouve jamais la sécurité ;
- après décision, chaque destinataire initial reçoit une notification minimale ; les échecs sont tracés et ne rouvrent pas automatiquement l'alerte.

### 3.5 Accès sensibles, exports et audit

| Entité logique | Rôle | Relations principales |
|---|---|---|
| `admin_access_cases` | Motif et périmètre d'un accès exceptionnel | N:1 acteur, ressource ciblée, mission |
| `admin_access_events` | Consultation, résultat et champs exposés sous forme minimisée | N:1 dossier d'accès, acteur |
| `admin_export_requests` | Demande d'export, motif, champs, filtres, état, expiration | N:1 acteur, mission |
| `admin_audit_events` | Journal métier/sécurité append-only des opérations administratives | Acteur, mission, ressource, corrélation |
| `admin_audit_integrity_checkpoints` | Scellement ou contrôle d'intégrité périodique | Référence de séquence/empreinte |

Un export exige une permission distincte de la lecture. Le téléchargement réévalue l'identité, la mission, la portée, l'expiration et le bénéficiaire. Le journal d'audit ne contient jamais de mots de passe, OTP, jetons bruts, clés privées, secrets de récupération, GPS précis ou corps complets de messages privés.

Le stockage, scellement, réplication, durée de conservation et purge de l'audit restent à arbitrer. Le modèle logique ne prétend pas fournir à lui seul l'immutabilité.

### 3.6 Notifications et tâches différées

Les notifications de clôture administrative et les tâches d'administration doivent utiliser l'outbox commune si elle est retenue pour le reste de SAC. Les tâches portent une clé d'idempotence, une finalité, un destinataire, une référence métier et un état de livraison. Elles ne contiennent pas de données privées inutiles.

Un worker doit revalider la permission et la mission avant toute étape sensible. Les tâches déjà acceptées par un fournisseur conservent leur résultat réel ; elles ne sont pas recréées aveuglément.

## 4. Relations cardinales de référence

- Un utilisateur peut avoir plusieurs sessions et appareils.
- Un utilisateur peut recevoir plusieurs missions au fil du temps, mais seules les missions actives dans leur période et leur périmètre peuvent accorder des droits.
- Une mission appartient à un bénéficiaire et est créée par le Super Admin.
- Une mission peut comporter plusieurs permissions atomiques, chacune avec portée explicite.
- Une permission du catalogue peut être référencée par plusieurs missions.
- Une mission possède un historique d'événements ; les événements ne sont pas modifiés lors d'une transition ultérieure.
- Une alerte peut faire l'objet de plusieurs examens administratifs, mais une seule décision finale de clôture effective.
- Une décision de clôture génère une notification par destinataire initial ; la notification et son résultat sont conservés séparément.
- Un export est rattaché à un demandeur, une mission, une portée, une expiration et une politique de purge.
- Une consultation sensible est reliée à une finalité/dossier et à l'acteur ; les données consultées ne sont pas copiées dans l'audit.

## 5. Contraintes d'intégrité à traduire en SQL

1. Identifiants uniques et références étrangères pour les liens structurants.
2. États limités à des valeurs contrôlées.
3. Début de mission strictement antérieur à sa fin.
4. Une permission de mission ne peut pas exister sans mission et entrée de catalogue valide.
5. Un délégataire ne peut être auteur d'une création ou modification de mission.
6. Une mission terminale ne peut pas être réactivée par une simple mise à jour.
7. Une transition exige l'état et la version attendus.
8. Une seule clôture administrative effective par alerte.
9. Les clés d'idempotence sont uniques dans leur domaine de portée.
10. Les références aux destinataires de clôture doivent correspondre à l'instantané initial de l'alerte.
11. Un téléchargement ne peut être autorisé sur la seule existence d'un fichier exporté.
12. Les événements d'audit ne sont ni mis à jour ni supprimés par les rôles applicatifs.
13. Les suppressions en cascade ne doivent jamais effacer l'historique légal/sécurité requis.
14. Toute relation entre tables doit être conçue en tenant compte des limites transactionnelles et des contrôles de lignes affectées de D1.

Les contraintes SQL exactes et leur compatibilité D1 doivent être démontrées par migrations de test et tests d'intégration, après autorisation.

## 6. Incohérences détectées à résoudre avant le schéma final

### 6.1 Clôture auteur et clôture administrative

Le modèle général indique que seul l'auteur clôture une alerte. Les contrats SOS prévoient cette règle générale, tandis que les décisions ultérieures autorisent une exception administrative étroite dans le scénario du titulaire suspendu.

**Règle de consolidation recommandée :**
- clôture ordinaire : auteur uniquement ;
- exception administrative : seulement dans le scénario spécifique du titulaire suspendu déjà validé, par Super Admin ou Administrateur sécurité avec permission dédiée ;
- ne pas accorder de droit général de clôture aux administrateurs ni aux contacts.

Le modèle de données doit représenter le type et l'autorité de clôture, sans rendre l'exception disponible sur toutes les alertes.

### 6.2 États du compte

Le contrat de domaine historique ne reconnaît que trois états, alors que la décision produit validée en reconnaît cinq. Le schéma et les validateurs doivent adopter les cinq états approuvés, mais uniquement après réconciliation et tests du domaine TypeScript.

### 6.3 Vérification du numéro de téléphone

Toute personne qui devient un contact SAC actif doit disposer d'un compte SAC actif. Chaque compte exige une adresse e-mail obligatoire, vérifiée par OTP avant activation ; le téléphone obligatoire reste déclaré et non vérifié. Une invitation ou une réponse SMS ne peut remplacer ni le compte actif, ni l'e-mail vérifié, ni le consentement explicite. Les anciennes mentions de vérification du téléphone ou d'inscription par téléphone seul sont obsolètes. Les détails de remise et de correspondance de l'invitation restent à spécifier ; aucune vérification SMS ne doit être ajoutée par analogie.

### 6.4 Rôle administratif versus mission

La matrice des rôles ne doit pas être implémentée comme une simple colonne `role` dans `users` qui donnerait directement tous les droits. Il faut séparer le rôle de fonction, la mission, les permissions atomiques et la portée. Le Super Admin constitue une autorité spéciale.

### 6.5 Audit et conservation

Les documents exigent un journal append-only, mais le mécanisme technique, la durée, les sauvegardes et les obligations légales ne sont pas encore arbitrés. Aucune promesse d'immutabilité absolue ne doit être faite avant preuve technique indépendante.

### 6.6 Sessions administratives

Les durées et contrôles renforcés des sessions administratives ne sont pas encore validés. La règle utilisateur 30 jours d'inactivité / 90 jours maximum est approuvée, mais ne doit pas être automatiquement copiée aux comptes administratifs sans décision.

## 7. Modèle d'autorisation à évaluer à chaque requête

L'autorisation effective doit résulter de la conjonction suivante :

`Compte actif` ET `session valide` ET `rôle reconnu` ET `mission active (si délégation)` ET `permission atomique explicite` ET `périmètre correspondant` ET `ressource dans l'état attendu` ET `contexte/finalité autorisés`.

Pour le Super Admin, l'autorité spéciale est vérifiée par un mécanisme serveur distinct et audité. Pour un Administrateur sécurité, le rôle seul ne donne jamais la clôture administrative : la permission nominative spéciale doit être présente et active. Toute condition absente, ambiguë ou obsolète produit un refus.

## 8. Séparation des données et minimisation

- Les données d'identité ne sont pas dupliquées dans chaque événement d'audit ; utiliser des références stables et des instantanés minimaux lorsque nécessaires.
- Les notes internes d'examen sont isolées des messages destinés aux contacts.
- Les événements d'alerte sont distincts des événements d'audit administratif.
- Les notifications sont distinctes des décisions qui les déclenchent.
- Les exports sont des artefacts temporaires contrôlés, non une source de vérité.
- Les coordonnées GPS précises restent hors du modèle administratif et NO-GO tant que leur suppression irréversible après 30 jours n'est pas démontrée.
- La suppression d'un compte ne doit pas effacer silencieusement les éléments d'audit qui doivent légalement être conservés ; une politique de pseudonymisation/conservation reste à arbitrer.

## 9. Tests de cohérence du modèle

- impossible de créer une mission sans Super Admin ;
- impossible de créer une permission sans mission et portée ;
- révocation de mission immédiatement visible dans les décisions serveur ;
- aucune permission obtenue par simple rôle ;
- clôture ordinaire par contact ou administrateur refusée ;
- exception de clôture administrative impossible hors scénario autorisé ;
- Administrateur sécurité sans permission spéciale refusé ;
- Super Admin autorisé selon les conditions de l'alerte et de la procédure ;
- notification de clôture envoyée seulement aux destinataires initiaux ;
- impossibilité d'effacer l'historique en supprimant un compte ou une mission ;
- accès et export refusés après révocation ;
- aucune donnée secrète ou GPS précis dans l'audit ;
- transitions concurrentes de mission et clôture sans double effet ;
- cohérence entre cinq états de compte du domaine et valeurs SQL.

## 10. Points ouverts avant le schéma SQL

- Bootstrap sécurisé du premier Super Admin et récupération de son compte.
- Unicité et historique des affectations de rôles administratifs.
- Structure de portée normalisée et règles de requête.
- Modèle exact de dossier et de notes de vérification.
- Conservation/pseudonymisation des événements après suppression de compte.
- Stockage et scellement du journal d'audit.
- Expiration, chiffrement et purge des exports.
- Authentification renforcée et durée des sessions administratives.
- Acceptation et vérification des contacts de confiance.
- Revue juridique et sécurité indépendante.

## 11. Conditions de passage au schéma D1

Aucune migration ne doit être créée avant :
1. revue de cohérence de ce modèle avec tous les contrats métier ;
2. arbitrage des points ouverts ;
3. alignement des états TypeScript sur les décisions validées ;
4. définition des clés, contraintes, index et stratégies de suppression ;
5. tests de concurrence et d'autorisation préparés ;
6. revue indépendante sécurité ;
7. autorisation explicite distincte de créer les migrations.

Ce document est une consolidation de conception, pas une implémentation ni une autorisation de modifier la base.


## 12. Convention d'identité canonique — complément du 18 novembre 2026

Le référentiel global `MODELE_GLOBAL_DONNEES_SAC.md` fixe `accounts` comme nom conceptuel canonique du compte SAC. Dans ce document administratif, les occurrences conceptuelles de `users` doivent donc être comprises comme des références à `accounts` ; elles ne justifient pas une table d'identité distincte. Les affectations de rôles, missions et sessions professionnelles sont liées au même identifiant de compte, tout en conservant leurs contrôles d'accès spécifiques. Cette convention ne constitue pas une migration.
