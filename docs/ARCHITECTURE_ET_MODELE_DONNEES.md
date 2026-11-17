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
- `user_devices` : appareils enregistrés, type, jeton push protégé, dernière activité, révocation.
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

Cette barrière après restauration évite de resservir des coordonnées expirées, mais ne supprime pas à elle seule les copies encore présentes dans l'historique Time Travel. En conséquence, **la suppression irréversible de toutes les copies à J+30 n'est pas encore démontrée avec un stockage GPS en clair dans D1**. Avant la première migration, il faut valider une stratégie de protection cryptographique avec destruction de clé indépendante de l'historique D1, ou choisir un stockage de positions dont le TTL et la suppression des sauvegardes sont démontrables. Aucun export ou backup externe contenant des coordonnées GPS en clair ne doit être activé entre-temps.

Les journaux d'audit conservent uniquement les métadonnées nécessaires à la preuve de purge (identifiant technique non parlant, échéance, résultat et horodatage), jamais les coordonnées ni les clés. Les tests doivent couvrir la purge normale, la lecture après échéance, la restauration d'un point antérieur à la purge et la purge de rattrapage avant réouverture.

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
