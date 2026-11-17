# SAC — Architecture cible et modèle de données

**Statut :** conception uniquement. Ce document ne constitue pas une migration SQL exécutable.  
**Stack frontend confirmée :** React, Vite, TypeScript, Tailwind CSS et Lucide React. PWA mobile-first.  
**Base de données cible :** Cloudflare D1. **Stockage objet :** Cloudflare R2 sous réserve d'activation et d'autorisation du compte.

## 1. Architecture logique

### 1.1 Frontend

Application web mobile-first construite avec React, Vite et TypeScript, stylée avec Tailwind CSS et Lucide React, installable comme PWA. Le frontend gère l'affichage, les formulaires, les permissions du navigateur, les interactions et l'état local. Il ne constitue jamais l'autorité de sécurité.

Domaines d'interface :
- authentification et profil ;
- contacts et invitations ;
- préférences de destinataires ;
- alertes et SOS ;
- réponses et prise en charge ;
- Protection des trajets ;
- abonnements et paiements ;
- notifications et paramètres.

### 1.2 Backend

API sécurisée et logique métier côté serveur. Les responsabilités principales :
- authentifier l'utilisateur et vérifier ses droits ;
- valider les contacts et destinataires autorisés ;
- créer les alertes et figer leurs destinataires ;
- enregistrer les réponses et arbitrer les prises en charge concurrentes ;
- gérer les clôtures réservées à l'auteur ;
- planifier et exécuter rappels et alertes différées ;
- vérifier les événements de paiement ;
- envoyer les notifications et conserver leurs états ;
- produire les journaux d'audit.

### 1.3 Services externes envisagés

- fournisseur OTP téléphone/e-mail ;
- fournisseur Web Push et, plus tard, FCM/APNs selon les plateformes ;
- fournisseur SMS complémentaire ;
- fournisseur de paiement compatible avec le Niger ;
- service cartographique et géocodage, éventuellement OpenStreetMap ;
- Cloudflare D1 pour les données relationnelles ;
- Cloudflare R2 pour les fichiers privés si le service est activé et autorisé.

Aucun fournisseur n'est encore choisi. Les intégrations doivent être encapsulées derrière des interfaces pour éviter de lier la logique métier à un fournisseur unique.

### 1.4 Portabilité Android/iOS sans réécriture

La PWA constitue la première cible. Dès la conception, le code doit rester compatible avec une future enveloppe native Capacitor pour Android et iOS, sans réécrire les écrans ni la logique métier.

- Isoler les capacités du terminal dans `src/services/device/` : géolocalisation, notifications, stockage local sécurisé, partage et autres capacités effectivement nécessaires.
- Le frontend appelle ces interfaces abstraites ; il ne doit pas disperser des appels directs à des API navigateur ou à des plugins natifs dans les composants.
- Les implémentations Web sont utilisées pour la PWA. Des adaptateurs Capacitor pourront être ajoutés ultérieurement derrière les mêmes interfaces.
- Séparer strictement l'interface, les règles métier, les contrats API et les adaptateurs de plateforme.
- Ne jamais supposer qu'une capacité PWA (GPS en arrière-plan, SMS silencieux, notifications) se comporte comme son équivalent natif. Les limites doivent être documentées et testées sur appareils réels.
- Toute dépendance à Capacitor doit rester dans la couche d'adaptation ; aucun écran ne doit dépendre directement d'un plugin natif.

### 1.5 API et hébergement

Le frontend React/Vite/TypeScript communique avec une API REST Cloudflare Pages Functions en TypeScript, organisée sous `functions/api/`. Cloudflare D1 est la base relationnelle cible ; les migrations SQL doivent être versionnées dans le dépôt. Cloudflare R2 est prévu pour le stockage privé des fichiers si le service est activé et autorisé sur le compte. Les règles métier sensibles, l'authentification, les autorisations, les tâches planifiées et les notifications restent côté serveur. Les fournisseurs externes non encore choisis sont encapsulés derrière des adaptateurs.

## 2. Principes d'architecture

- Les décisions d'autorisation sont prises côté serveur.
- Toute action sensible est liée à un utilisateur authentifié.
- Les transitions d'état sont validées par le backend.
- Les opérations concurrentes utilisent des transactions et contraintes adaptées.
- Les rappels et tâches programmées sont idempotents.
- Les notifications sont asynchrones et disposent d'un suivi par canal.
- Les coordonnées sont privées et limitées au strict besoin fonctionnel.
- Les états serveur sont la source de vérité ; le client affiche les états connus et leurs horodatages.
- Les secrets et clés fournisseurs ne sont jamais livrés au navigateur.

## 3. Domaines de données

Le modèle relationnel devra au minimum couvrir les entités suivantes. Les noms sont indicatifs et pourront être ajustés au moment du schéma SQL détaillé.

### 3.1 Identité et appareils

- `users` : compte, coordonnées vérifiées, langue, état du compte, dates de création et mise à jour.
- `user_devices` : appareils enregistrés, type, jeton push protégé, dernière activité, révocation et compteur `auth_version` monotone pour invalider toutes les sessions de cet appareil.
- `user_sessions` : sessions et révocations si le fournisseur d'authentification ne couvre pas entièrement ce besoin.
- `user_settings` : préférences de notification, confidentialité et sécurité.

### 3.2 Contacts et groupes

- `trusted_contacts` : relation entre utilisateur propriétaire et contact invité, catégorie, statut et dates.
- `contact_invitations` : jeton d'invitation à usage limité, expiration, état, canal et destinataire. Une invitation en attente ne donne aucun accès aux alertes, au compte ou à la localisation ; le contact devient actif seulement après acceptation et vérification du téléphone ou de l'e-mail.
- `contact_alert_preferences` : autorisation par catégorie et éventuellement niveau.
- `groups` : groupes privés créés par un utilisateur.
- `group_members` : membres, rôles et états d'adhésion.

Une relation de contact n'accorde aucun accès général au compte, à l'historique ou à la localisation. Les permissions doivent être vérifiées pour chaque opération.

### 3.3 Abonnements et paiements

- `subscriptions` : formule, état, période, utilisateur et dates de validité.
- `payments` : montant, devise, prestataire, référence externe, état, dates et preuve de notification vérifiée.
- Les événements de paiement doivent être dédupliqués à partir d'un identifiant fournisseur ou d'une clé d'idempotence.
- Le serveur recalcule le droit Premium depuis les données fiables ; le client ne peut pas s'attribuer un abonnement.

### 3.4 Alertes et réponses

- `alerts` : auteur, catégorie, niveau, description, état, date de déclenchement et clôture.
- `alert_recipients` : instantané des destinataires autorisés au moment du déclenchement.
- `alert_events` : chronologie immuable des événements métier importants, y compris annulation avant ou après transmission, avec horodatage et auteur de l'action.
- `alert_responses` : accusés de réception, volontariat, retrait et réponses.
- `alert_takeovers` : historique des répondants principaux et changements de responsabilité.
- `alert_locations` : positions horodatées liées à l'alerte, précision et source.

Une alerte ne doit pas dépendre de la présence d'une position. Les coordonnées doivent être stockées avec leur heure de collecte et une précision si disponible.

### 3.5 Trajets

- `trips` : auteur, mode choisi, destination, heure estimée, état et échéance.
- `trip_participants` : contacts autorisés à accompagner ou recevoir les alertes.
- `trip_locations` : positions partagées, horodatage et précision.
- `arrival_checks` : confirmations d'arrivée, rappels et absence de confirmation.

Les droits d'accès aux positions d'un trajet sont limités aux participants explicitement autorisés et à la durée choisie. Les durées fonctionnelles prévues sont : position ponctuelle, 15 minutes, 30 minutes, 1 heure ou jusqu'à la clôture de l'alerte/du trajet selon le parcours. Chaque position conserve son horodatage et son niveau de précision ; une position ancienne n'est jamais présentée comme une position en direct. Décision validée : les positions GPS précises sont conservées 30 jours à compter de la fin du partage concerné, puis supprimées automatiquement et définitivement des données actives SAC. Pour un partage ponctuel, le délai part de la collecte. Les événements non géographiques peuvent être conservés dans l'historique sans coordonnées précises. Les coordonnées ne doivent pas être recopiées dans les journaux. La purge des sauvegardes doit respecter un cycle documenté garantissant leur disparition.

### 3.5.1 Purge, sauvegardes et restauration des positions GPS

La rétention fonctionnelle est de 30 jours après la fin du partage (position ponctuelle : à partir de la collecte). Chaque enregistrement de position doit porter une échéance calculée côté serveur. Après cette échéance, la lecture est interdite même si la tâche de purge physique n'a pas encore été exécutée ; une tâche récurrente supprime ensuite les lignes expirées et vérifie le résultat.

**Contrainte importante de Cloudflare D1 :** la base SAC a été vérifiée sur le stockage `production`, qui prend en charge Time Travel. Selon l'offre Cloudflare, l'historique restaurable est de 30 jours (Workers Paid) ou 7 jours (Workers Free). Cet historique peut contenir une version antérieure à la purge et une restauration peut donc réintroduire des positions expirées dans la base restaurée. Toute restauration doit se faire en maintenance, sans trafic utilisateur : réexécuter immédiatement la purge sur les échéances d'origine, vérifier l'absence de positions expirées, puis seulement rouvrir l'accès.

**Exigence utilisateur ferme : à l'expiration des 30 jours, aucune restauration ne doit pouvoir récupérer ni rendre lisibles les coordonnées GPS expirées.** Cela vaut pour D1 Time Travel, les sauvegardes, les exports, les réplications, les snapshots et toute restauration partielle ou complète. Une simple purge SQL ou une barrière applicative après restauration ne satisfait pas cette exigence.

La mise en œuvre doit garantir une destruction cryptographique irréversible à J+30 : les positions doivent être chiffrées avant toute persistance dans D1 ou dans une sauvegarde, avec une clé de déchiffrement isolée de D1 et de ses mécanismes de restauration. À l'échéance, la clé ou le matériel cryptographique permettant de déchiffrer les positions concernées doit être détruit de manière vérifiable et non restaurable depuis un backup. Une restauration D1 peut alors réintroduire des blocs chiffrés, mais ne doit jamais pouvoir rétablir leur lisibilité. La conception du gestionnaire de clés, sa disponibilité, ses garanties de suppression, ses sauvegardes et les scénarios de reprise doivent être audités avant toute migration GPS.

Aucun stockage GPS en clair dans D1, aucun export ni backup externe en clair ne sont autorisés. Tant que la destruction cryptographique indépendante n'est pas démontrée par des tests de restauration adverses, le stockage des positions GPS reste bloqué.

Les journaux d'audit conservent uniquement les métadonnées nécessaires à la preuve de purge (identifiant technique non parlant, échéance, résultat et horodatage), jamais les coordonnées ni les clés. Les tests doivent couvrir la purge normale, la lecture après échéance, la restauration d'un point antérieur à la purge et la purge de rattrapage avant réouverture.

### 3.5.2 Gestionnaire de clés GPS — exigence de séparation

La conception détaillée et l'étude comparative sont consignées dans [SECURITE_GPS_DESTRUCTION_CRYPTO.md](SECURITE_GPS_DESTRUCTION_CRYPTO.md). La piste étudiée est un chiffrement enveloppe : les positions sont chiffrées avant persistance ; les clés de données sont enveloppées par un KMS indépendant ; D1 ne conserve que les ciphertexts et les clés de données enveloppées.

**Cloudflare Durable Objects ne doit pas servir de coffre de clés GPS** : son stockage SQLite possède lui aussi une capacité de restauration temporelle pouvant restaurer les clés supprimées. La séparation logique entre deux services Cloudflare ne constitue donc pas, à elle seule, une séparation suffisante contre la restauration.

Google Cloud KMS et AWS KMS sont uniquement des candidats étudiés. Leurs périodes réversibles de destruction doivent être prises en compte : une clé programmée pour destruction n'est pas encore définitivement détruite. Aucun fournisseur n'est choisi et aucune intégration n'est autorisée par cette étude seule. Le fournisseur retenu devra prouver qu'aucune restauration administrative ou sauvegarde accessible au client ne peut réactiver une clé arrivée à échéance. Aucune clé importée ou copie externe réutilisable ne sera admise.

L'interface du KMS sera isolée derrière un contrat TypeScript côté serveur ; le frontend ne verra jamais de clé. En cas d'indisponibilité ou d'état inconnu du KMS, la lecture GPS échoue fermée. Aucun cache local ni mécanisme de secours ne doit contourner l'expiration.

### 3.6 Programmation et notifications

- `scheduled_alerts` : alerte différée, échéance, état, annulation et clé d'idempotence.
- `notification_jobs` : tâches à envoyer, canal, prochaine tentative, nombre de tentatives et état.
- `notification_deliveries` : résultats par destinataire et canal : accepté, livré si confirmé, échec, lu si disponible.
- Les rappels toutes les cinq minutes sont calculés côté serveur vers l'instantané initial des destinataires et continuent jusqu'à la clôture de l'alerte par son auteur.

### 3.7 Sécurité et audit

- `security_codes` : empreinte sécurisée des codes normalisés/de contrainte, paramètres anti-bruteforce et dates de rotation.
- `security_events` : événements de sécurité tels que tentatives invalides, changement de code ou révocation d'appareil.
- `audit_logs` : actions administratives et opérations sensibles, acteur, cible, motif si nécessaire et horodatage.

Ne jamais journaliser les codes, OTP, secrets, jetons d'accès ou coordonnées détaillées sans justification explicite.

## 4. Relations et contraintes essentielles

- Un utilisateur possède plusieurs contacts de confiance, dans la limite de son offre.
- Un contact ne devient actif qu'après acceptation et vérification du téléphone ou de l'e-mail ; une invitation en attente n'accorde aucun accès.
- Un utilisateur définit les catégories pour lesquelles chaque contact est destinataire.
- Une alerte appartient à un seul auteur.
- Une alerte possède un instantané de destinataires créé dans la même transaction que l'alerte.
- Une réponse à une alerte est unique par contact et par type d'action lorsque la règle métier l'exige.
- Un seul répondant principal actif peut exister pour une alerte à un instant donné.
- Seul l'auteur peut effectuer la transition vers l'état clôturé.
- Les tâches de rappel et d'alerte différée possèdent une clé d'idempotence unique.
- Une notification est reliée à un destinataire et à un canal précis.
- Un abonnement ne dépasse pas les limites de contacts de sa formule.
- Les positions doivent toujours avoir un horodatage et un propriétaire/droit d'accès vérifiable. Les fenêtres de partage autorisées sont ponctuelle, 15 minutes, 30 minutes, 1 heure ou jusqu'à clôture selon le parcours. La conservation des positions précises est limitée à 30 jours après la fin du partage, puis une purge automatique définitive des données actives est obligatoire.

## 5. États métier proposés

Les valeurs exactes seront définies dans les migrations et documentées dans les tests.

### Alerte
- `active`
- `closed_by_author`
- éventuellement `cancelled_before_dispatch` pour les parcours qui le permettent.

L'expiration des rappels n'est pas un état de clôture.

### Réponse contact
- `notified`
- `acknowledged`
- `volunteered`
- `withdrawn`
- `principal_responder` comme attribution calculée ou matérialisée avec historique.

### Notification
- `queued`
- `sending`
- `provider_accepted`
- `delivered` (uniquement si confirmé par le canal)
- `read` (uniquement si le canal le fournit)
- `failed`
- `cancelled`

### Abonnement
- `pending`
- `active`
- `past_due`
- `expired`
- `cancelled`
- `refunded` selon les capacités du prestataire.

## 6. Transactions critiques

### 6.1 Création d'alerte

Dans une transaction :
1. authentifier l'auteur ;
2. valider catégorie et niveau ;
3. lire les contacts acceptés et autorisés ;
4. créer l'alerte ;
5. créer l'instantané des destinataires ;
6. enregistrer les premiers événements ;
7. créer les tâches de notification avec des clés uniques ;
8. valider la transaction.

Les envois externes se font après validation, via une file ou un mécanisme fiable de type outbox. Une panne de notification ne doit pas effacer l'alerte enregistrée.

### 6.2 Attribution du répondant principal

La première prise en charge valide gagne. Le backend doit utiliser une transaction, verrouillage ou contrainte permettant d'empêcher deux principaux simultanés. L'ordre d'arrivée serveur fait foi. Le retrait du principal déclenche la promotion du prochain volontaire selon l'ordre horodaté.

### 6.3 Clôture

Seul l'auteur authentifié peut clôturer. La transition, l'événement de clôture et l'annulation des rappels futurs doivent être cohérents et atomiques. Les notifications de clôture sont ensuite planifiées.

### 6.4 Rappels

Le serveur planifie les rappels toutes les cinq minutes vers **tous les contacts de l'instantané initial**, jusqu'à la clôture de l'alerte par son auteur. Un accusé de réception ou une prise en charge est enregistré, mais ne retire pas le contact de la liste des rappels et ne clôture pas l'alerte. Le serveur vérifie à chaque exécution :
- l'alerte est encore active ;
- le destinataire appartient à l'instantané initial ;
- la tâche n'a pas déjà été traitée.

La clôture par l'auteur arrête immédiatement les rappels futurs. Aucun délai d'expiration autonome ne doit les arrêter avant cette clôture.

### 6.5 Alertes programmées

Une tâche serveur vérifie l'échéance et l'annulation. Une clé d'idempotence garantit qu'une même alerte différée ne crée pas plusieurs alertes. Le système conserve le résultat de la tentative.

## 7. Sécurité et contrôle d'accès

Matrice de principe :

| Ressource | Auteur | Contact autorisé | Autre utilisateur | Administrateur |
|---|---|---|---|---|
| Profil | lecture/modification | données strictement partagées | aucun accès | accès limité et justifié |
| Contacts | gestion complète | invitation et statut le concernant | aucun accès | support limité |
| Alerte | lecture, suivi, clôture | lecture de l'alerte qui lui est adressée, réponse/prise en charge | aucun accès | accès exceptionnel, audité |
| Localisation | selon ses réglages | seulement si partagée pour cette alerte/ce trajet | aucun accès | aucun accès libre |
| Paiement | lecture de son historique | aucun accès | aucun accès | support financier restreint |
| Journaux de sécurité | informations utiles à son compte | aucun accès | aucun accès | accès strictement contrôlé |

Les contrôles d'accès doivent être appliqués par les Pages Functions avant chaque lecture ou écriture D1. Aucune donnée personnelle ne doit être accessible sans vérification explicite de l'utilisateur, de la relation de contact et du contexte de l'alerte.

## 8. API — familles fonctionnelles

Les routes exactes et méthodes HTTP seront fixées lors du plan d'implémentation. Les familles attendues :

- Auth : inscription, OTP, vérification, récupération, révocation de session.
- Profil : lecture, modification, appareils et paramètres.
- Contacts : invitation, acceptation, révocation, préférences par catégorie.
- Groupes : création, invitation, adhésion, retrait et rôles.
- Alertes : création, consultation, clôture par auteur, chronologie.
- Réponses : accusé de réception, prise en charge, retrait, demande de renfort.
- Trajets : création, participation, position, confirmation d'arrivée, clôture.
- SOS discret : configuration et vérification sécurisée du code de contrainte.
- Programmation : création, modification, annulation d'une alerte différée.
- Abonnements : état, démarrage du paiement, webhook authentifié, annulation.
- Notifications : préférences et état des livraisons.
- Administration : opérations limitées, autorisées et auditées.

Chaque endpoint doit appliquer validation de schéma, authentification, autorisation, limitation de débit et journalisation adaptée.

## 9. Index et performance

À prévoir après validation du schéma :
- index sur les clés étrangères et colonnes de filtrage ;
- index sur `alerts(author_id, created_at)` ;
- index sur `alert_recipients(contact_user_id, alert_id)` ;
- index sur `notification_jobs(status, scheduled_at)` ;
- index sur `scheduled_alerts(status, scheduled_for)` ;
- index sur les événements et positions par alerte/trajet et date ;
- contraintes uniques sur invitations actives, clés d'idempotence et réponses uniques.

Les index définitifs doivent être justifiés par les requêtes réelles et mesurés.

## 10. Choix encore ouverts

- Fournisseur/mécanisme d'authentification et modalités exactes de configuration D1/R2.
- Mécanisme de file de tâches et planification.
- Fournisseur OTP, SMS, push et paiement.
- Fournisseur cartographique.
- Cycle de purge des sauvegardes et vérification de l'effacement des positions GPS après 30 jours.
- Politique de sauvegarde et de restauration.
- Déploiement, hébergement et monitoring.

## 11. Conditions avant toute migration

Aucune migration ne doit être créée avant :
1. validation du schéma relationnel détaillé ;
2. définition des rôles et politiques d'accès ;
3. validation des états et transitions ;
4. définition de la stratégie de sauvegarde et de suppression ;
5. définition des tests de sécurité ;
6. autorisation explicite de commencer le développement.

Ce document décrit une architecture cible, pas un système déjà construit.


## 12. Précision : aucun KMS validé pour J+30

L'étude complémentaire dans [SECURITE_GPS_DESTRUCTION_CRYPTO.md](SECURITE_GPS_DESTRUCTION_CRYPTO.md) conclut qu'aucun candidat examiné (Google Cloud KMS, AWS KMS, AWS CloudHSM, secrets Workers) ne démontre à ce stade la destruction irréversible de toutes copies de clés au plus tard à J+30. Les fenêtres réversibles et sauvegardes doivent être considérées dans la menace. Aucun de ces services ne doit être sélectionné par défaut. Le contrôle serveur doit refuser toute lecture GPS dès l'échéance, mais ce contrôle n'est pas assimilé à une destruction cryptographique.


## 1.6 Proposition de protection GPS sans persistance serveur — à prototyper

Pour les coordonnées GPS précises, l'étude propose de ne pas utiliser D1 ni R2 comme stockage historique. Le terminal chiffre les positions avant toute transmission ; les archives nécessaires à la conservation sont gardées localement sous chiffrement natif lié à l'appareil. Les contacts autorisés reçoivent les positions via un relais chiffré qui ne conserve aucun historique GPS persistant.

Cette proposition vise à empêcher qu'une restauration D1/R2 puisse réintroduire des coordonnées GPS. Elle ne remplace pas les alertes métier ni leur historique non géographique.

Le modèle de clés envisagé est une clé aléatoire indépendante par session de partage, stockée dans Android Keystore ou iOS Keychain selon les capacités vérifiées de l'appareil. Les fichiers GPS chiffrés doivent être exclus des sauvegardes applicatives lorsque la plateforme le permet.

**Limite non résolue :** les systèmes mobiles ne garantissent pas le réveil de l'application à une heure exacte. L'expiration doit bloquer le déchiffrement dès la première exécution après J+30 et déclencher la suppression de la clé ; la destruction matérielle à l'instant précis J+30 lorsque le téléphone est éteint n'est pas démontrée. Aucun code métier ni stockage GPS ne doit être implémenté avant validation du prototype, des scénarios de restauration et de la politique finale de rétention.


## 1.7 Transport candidat des positions en direct

Cloudflare Pages Functions prend en charge les bindings vers un Durable Object défini dans un Worker séparé. Cette possibilité est étudiée comme un relais WebSocket auxiliaire : Pages Functions conserve le contrôle de l'authentification et des autorisations ; le relais transmet uniquement des paquets GPS chiffrés aux destinataires connectés.

Le Durable Object ne doit jamais écrire de coordonnées ni de paquets GPS dans SQLite, KV, D1, R2, les attachments WebSocket, les logs ou les traces. Les attachments de connexion, qui peuvent survivre à l'hibernation, ne peuvent contenir que des identifiants opaques de routage. Si un destinataire est hors ligne, le relais ne met pas la position en attente : une notification générique peut l'inviter à ouvrir SAC, puis le partage en direct reprend si l'auteur est encore connecté et autorisé.

Cette extension nécessite un Worker auxiliaire qui héberge la classe Durable Object. Elle ne remplace pas Pages Functions comme API métier et ne doit pas être créée ou déployée avant validation explicite. Le fonctionnement hors ligne, la livraison en arrière-plan, les coûts et l'absence de persistance doivent être testés.


## 1.8 Prototype cryptographique isolé — AES-256-GCM

Un premier module expérimental a été ajouté dans `src/services/location/crypto.ts`. Il génère une clé AES-GCM 256 bits non exportable en mémoire, chiffre un contenu opaque avec un IV aléatoire de 96 bits et authentifie l'identifiant de session comme donnée associée (AAD). Le déchiffrement échoue si le paquet est altéré ou si l'identifiant de session ne correspond pas.

Ce module est volontairement isolé :
- il n'est pas appelé par l'interface ni par l'API ;
- il ne collecte aucune coordonnée et ne persiste aucune donnée ou clé ;
- il ne définit pas le stockage sécurisé natif Android/iOS ;
- il ne distribue pas la clé aux destinataires ;
- il ne gère pas la durée de conservation ni la destruction de clé J+30 ;
- il ne prouve pas une protection contre l'extraction mémoire ou les outils de débogage.

Il valide seulement une primitive de chiffrement authentifié pour préparer le futur protocole de transport. Il ne doit pas être présenté comme le système GPS sécurisé de production.

Des tests automatisés sont ajoutés via le script `npm run test:crypto` et exécutés dans la CI. Ils couvrent le caractère non exportable de la clé Web Crypto, le cycle chiffrer/déchiffrer, l'association à la session, l'altération du ciphertext et la génération d'IV distincts.


## 15. Gestion multi-appareils d'un même compte

**Décision produit :** un compte SAC peut être actif sur plusieurs appareils. Il s'agit d'un seul utilisateur, avec plusieurs installations/appareils enregistrés et contrôlés séparément. Cette section complète le modèle conceptuel ; elle n'est pas une migration SQL exécutable.

### 15.1 Entités à prévoir

Le modèle devra distinguer les appareils, les sessions et les clés publiques :

- `user_devices` : `id` opaque aléatoire, `user_id`, `display_name`, `platform` (`web`, `android`, `ios`), `status` (`pending_verification`, `active`, `revoked`), `created_at`, `verified_at`, `last_seen_at`, `revoked_at`, `revocation_reason` facultatif.
- `device_sessions` : sessions rattachées à un appareil précis, identifiant opaque, hash du jeton à haute entropie, `auth_version`, dates d'expiration et révocation, dernier usage et état. Le jeton brut n'est jamais stocké. Chaque requête protégée relit l'état courant de la session et de l'appareil ; le contrat pur expérimental est dans `src/domain/session-authorization.ts`.
- `device_public_keys` : appareil propriétaire, type de clé (signature ou échange), algorithme, version, clé publique, empreinte, dates d'activation/rotation/révocation et référence du certificat d'approbation.
- `device_push_subscriptions` : abonnement push propre à l'appareil, protégé et révocable indépendamment.

Les clés privées sont créées et conservées sur l'appareil. Elles ne sont jamais écrites dans D1/R2, transmises aux Pages Functions, ni copiées entre appareils. Le serveur ne conserve que les clés publiques, leurs certificats, les empreintes et l'état de confiance nécessaire à l'autorisation.

### 15.2 Ajout et approbation

1. L'utilisateur authentifie le nouvel appareil ; celui-ci reçoit un statut en attente et génère ses propres paires de clés localement.
2. Si un appareil déjà actif est disponible, l'utilisateur approuve explicitement l'ajout depuis cet appareil. Les deux appareils réalisent un jumelage cryptographique avec comparaison/vérification indépendante des identités ; le serveur ne peut pas se substituer à l'approbateur.
3. Le serveur vérifie l'autorisation et enregistre les clés publiques et le certificat signé. Le nouvel appareil devient actif seulement après validation complète.
4. Un code OTP peut prouver le contrôle d'un canal de récupération, mais ne suffit pas à approuver une nouvelle identité cryptographique ou à restaurer les clés GPS.
5. Si tous les appareils approuvés sont perdus, une procédure de récupération de compte peut rétablir l'accès au compte après authentification renforcée. Elle crée toutefois une nouvelle identité cryptographique et déclenche une nouvelle vérification indépendante par les contacts. Elle ne restaure pas les clés GPS locales de l'ancien appareil.

### 15.3 Identité racine et clés par appareil — conception à valider

La piste recommandée est une clé de signature racine du compte, distincte des clés opérationnelles générées par chaque appareil. La racine approuve les clés publiques des appareils ; un appareil actif peut signer le certificat d'un nouvel appareil après approbation explicite. Chaque appareil conserve localement sa clé privée de signature et sa clé privée ECDH.

La perte de la racine et de tous les appareils approuvés entraîne une nouvelle identité et une revérification des contacts. Il ne faut pas reconstruire la confiance à partir d'un SMS, d'un e-mail, d'une donnée serveur ou d'une simple restauration de sauvegarde.

Cette piste reste à spécifier et tester : format et canonicalisation des certificats, révocation, rotation, rejeu, concurrence entre approbations, appareils hors ligne, multi-installation PWA, récupération, compatibilité Web/Android/iOS et stockage matériel disponible. Le prototype ECDH/ECDSA existant ne suffit pas encore à fournir ce protocole.

### 15.4 Révocation et conséquences

La révocation est atomique côté serveur : invalider toutes les sessions de l'appareil, refuser ses futures requêtes, révoquer ses abonnements push et interdire les nouveaux partages fondés sur ses clés. Les actions antérieures restent attribuées à l'utilisateur et leurs métadonnées d'audit identifient l'appareil source.

Une révocation serveur ne peut pas effacer un appareil éteint, hors ligne ou désinstallé. Elle ne garantit pas l'effacement des clés ou des archives déjà présentes localement. L'interface doit expliquer cette limite et ne jamais annoncer un effacement à distance non exécuté. Les partages GPS actifs initiés par l'appareil révoqué doivent être invalidés côté serveur et côté relais dès que l'autorité serveur peut appliquer la révocation.

### 15.5 Autorisations et séparation des données

- Tous les appareils actifs d'un même compte peuvent accéder aux fonctions du compte selon les permissions utilisateur, mais chaque requête est authentifiée par sa propre session et liée à son appareil.
- Un appareil révoqué n'accède plus au compte via les API, même si son stockage local subsiste.
- Les archives GPS locales restent liées à l'appareil qui les a créées ; aucune synchronisation ou copie automatique vers un autre appareil.
- L'accès aux anciennes archives GPS sur un nouvel appareil est désactivé par défaut et nécessite un mécanisme séparé, compatible avec la destruction stricte à J+30, qui n'est pas encore défini.
- Les alertes SOS restent disponibles indépendamment de l'échange de clés GPS ; l'échec du jumelage ne bloque pas une alerte essentielle.
- Les événements d'audit distinguent l'utilisateur, l'appareil, la session et l'action sans enregistrer de coordonnées GPS, secrets ou jetons.

### 15.6 Familles d'API à prévoir

- `GET /api/devices` : lister uniquement les appareils du compte authentifié.
- `POST /api/devices/enroll` : enregistrer un appareil en attente et ses clés publiques.
- `POST /api/devices/{deviceId}/approve` : valider un certificat d'approbation signé et lier le nouvel appareil.
- `POST /api/devices/{deviceId}/revoke` : révoquer un appareil et ses sessions/abonnements.
- `PATCH /api/devices/{deviceId}` : modifier uniquement les métadonnées autorisées, par exemple le libellé.
- `POST /api/devices/recovery` : démarrer la récupération du compte sans restaurer silencieusement la confiance cryptographique.

Ces routes sont des contrats indicatifs, pas des endpoints existants. Chaque route doit vérifier côté serveur l'identité du compte, l'appartenance de l'appareil, le statut, les signatures, l'anti-rejeu, la limitation de débit et l'idempotence. Aucun endpoint ne reçoit une clé privée.

### 15.7 Critères de test avant production

- Un appareil A et un appareil B sont liés au même compte mais possèdent des clés privées distinctes.
- B ne devient pas actif avant approbation explicite et validation cryptographique.
- Un OTP seul ne permet pas de remplacer une clé d'identité déjà approuvée.
- La révocation de B invalide ses sessions, ses push et ses nouveaux accès API sans déconnecter A.
- Un appareil révoqué hors ligne ne reçoit pas de commande d'effacement ; l'interface n'affirme donc pas que ses données locales sont effacées.
- La récupération après perte de tous les appareils crée une nouvelle identité et exige la revérification des contacts.
- Aucun GPS, clé privée, jeton ou secret n'apparaît dans D1, R2, les logs, traces, push ou exports.
- Les alertes essentielles restent envoyables même si le protocole de clés GPS est indisponible.
- Les essais couvrent PWA, Android et iOS, ainsi que les conflits d'approbation, le rejeu et les changements d'horloge/réseau.

**Statut :** modèle conceptuel à implémenter après validation du protocole de confiance et des contrats API. Aucune migration D1 ni fonctionnalité multi-appareils n'est déclarée opérationnelle.


## 15.8 Référence du protocole multi-appareils

La proposition de hiérarchie de clés, de cérémonie d'enrôlement, de récupération, de révocation, de contrats API indicatifs et de tests adversariaux est détaillée dans [PROTOCOLE_MULTI_APPAREILS.md](PROTOCOLE_MULTI_APPAREILS.md). Le document est une proposition à valider ; il ne transforme pas les entités et routes conceptuelles en schéma ou API existants.

## 15.9 Contrat TypeScript isolé du cycle de vie appareil

Le module `src/domain/device-management.ts` définit les types `DeviceRecord`, `DevicePlatform`, `DeviceStatus`, les événements et les résultats de transition. La fonction pure `transitionDevice` couvre les transitions pending_verification vers active, pending_verification vers revoked et active vers revoked ; revoked est terminal. Elle vérifie l'appartenance du compte portée par l'événement, les horodatages UTC canoniques et plusieurs invariants de cohérence.

Les tests `tests/device-lifecycle.test.ts` sont exécutés par `npm run test:devices` et intégrés au workflow CI. Ils ne valident ni l'authentification, ni les signatures cryptographiques, ni la persistance, ni les sessions, ni les endpoints. Ce module n'est donc pas une implémentation serveur et ne peut pas être utilisé seul pour autoriser une action sensible.

**Vérification :** CI GitHub Actions run `44191818016`, commit `eab16e659bd6d8759747f466d4dab57962178005` — typecheck, 14 tests de cycle de vie, tests crypto existants, build et audit bloquant des dépendances de production réussis. L'audit complet de l'outillage de développement reste non bloquant selon la configuration existante.