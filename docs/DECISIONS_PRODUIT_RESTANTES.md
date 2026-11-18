# SAC — Registre des décisions produit encore ouvertes

**Statut :** dossier d'arbitrage et recommandations, pas une validation utilisateur.  
**Référence :** cahier des charges v1.6, machines à états, contrats atomiques D1.  
**Règle :** aucune proposition ci-dessous ne doit être présentée comme une fonctionnalité déjà décidée ou implémentée.

Ce registre transforme les zones floues en décisions précises à valider. Il conserve les règles déjà approuvées et propose des choix par défaut prudents.

## 1. Révocation d'un contact pendant une alerte déjà active

### Règles déjà établies
- La révocation empêche les nouvelles alertes et les nouveaux partages fondés sur cette relation.
- La liste des destinataires d'une alerte déclenchée est figée.
- Les rappels SOS continuent toutes les cinq minutes vers les destinataires initiaux jusqu'à la clôture explicite par l'auteur.
- Un accusé de réception ou une prise en charge n'arrête pas les rappels.
- Les événements passés ne sont pas supprimés par la révocation.

### Point non défini
La révocation intervient-elle immédiatement sur les droits de lecture d'une alerte déjà active et sur l'accès aux mises à jour de localisation ?

### Recommandation de sécurité
Séparer les droits au lieu d'utiliser un unique statut « destinataire » :
1. **Rappels et fil de l'alerte active :** conserver le destinataire initial jusqu'à la clôture, afin de respecter la liste figée et les rappels décidés.
2. **Nouvelle localisation et suivi en direct :** arrêter immédiatement les nouvelles transmissions à ce contact dès révocation. Ne pas supprimer rétroactivement les paquets déjà reçus.
3. **Après clôture :** retirer au contact révoqué l'accès au détail et à l'historique de l'alerte ; l'auteur conserve son historique.
4. **Nouvelles alertes et nouveaux trajets :** aucun accès, aucune notification, aucun partage via cette relation.

Cette séparation permet de continuer les rappels déjà décidés sans maintenir un droit de suivi GPS après retrait de confiance. Elle nécessite des autorisations distinctes dans le backend et l'interface.

### Tests indispensables
- révocation pendant alerte active ;
- rappel dû juste avant/après révocation ;
- paquet de position en transit au moment de la révocation ;
- contact révoqué tentant d'ouvrir le détail ;
- clôture puis tentative d'accès à l'historique ;
- révocation et prise en charge concurrentes.

## 2. Suppression du compte avec alertes ou trajets en cours

### Risque à éviter
Une suppression immédiate pourrait rendre impossible la clôture d'une alerte alors que les rappels doivent continuer jusqu'à l'action de son auteur. À l'inverse, laisser le compte entièrement actif pendant la suppression serait excessif.

### Recommandation
Adopter une suppression en deux phases :
1. **Demande de suppression :** authentification renforcée, désactivation de la création de nouvelles alertes, invitations, trajets et partages.
2. **Période de clôture :** accès limité permettant uniquement de terminer ou clôturer les alertes et trajets déjà actifs, annuler les SOS programmés et récupérer/exporter les données prévues.
3. **Finalisation :** seulement après qu'il ne reste plus d'alerte active ni de trajet actif ; suppression ou anonymisation selon la matrice de conservation validée.
4. **Données à conserver :** uniquement les éléments strictement nécessaires à la sécurité, à la preuve des opérations, au support ou aux obligations légales, avec accès restreint et durée définie.

Si l'utilisateur ne revient pas terminer une alerte active, un processus de secours est nécessaire. Il ne faut pas inventer une clôture automatique qui contredirait la règle « seul l'auteur clôture ». Une politique dédiée doit être validée : maintien des rappels, contact de support, ou procédure exceptionnelle clairement annoncée. Aucun administrateur ne doit pouvoir clore arbitrairement une alerte en production.

### Tests indispensables
- demande de suppression sans alerte active ;
- demande pendant alerte active ;
- demande pendant trajet actif ;
- accès limité à la clôture après demande ;
- session révoquée sur les autres appareils ;
- impossibilité de créer une nouvelle alerte après demande ;
- suppression finale et vérification des dépendances/anonymisations.

## 3. Conservation des données non GPS

### Règle ferme
La règle GPS J+30 est distincte : les coordonnées précises et leurs clés doivent devenir irrécupérables après l'échéance, même après restauration. Aucun stockage GPS D1 n'est autorisé avant preuve.

### Données non GPS à inventorier
- compte, identités vérifiées et préférences ;
- invitations et relations de confiance ;
- appareils, certificats publics, sessions et événements de sécurité ;
- alertes, catégories, niveaux, descriptions et destinataires ;
- réponses, prises en charge et transferts de responsabilité ;
- trajets, destinations textuelles et confirmations d'arrivée ;
- tâches de notification, tentatives et identifiants fournisseurs ;
- demandes de suppression, exports et tickets de support ;
- journaux techniques.

### Politique recommandée
- **Données de compte actives :** conservées tant que le compte est actif, avec minimisation.
- **Défis OTP, invitations expirées et jetons temporaires :** purge rapide après expiration/consommation ; ne conserver que les métadonnées anti-abus strictement nécessaires.
- **Sessions et secrets temporaires :** suppression ou anonymisation après révocation/expiration, sous réserve de traces de sécurité minimales.
- **Alertes et chronologie :** conserver pendant une durée à fixer ; à la suppression du compte, pseudonymiser les éléments nécessaires plutôt que conserver automatiquement l'identité complète.
- **Notifications :** purger rapidement les payloads et détails fournisseur non nécessaires ; conserver uniquement les résultats agrégés ou identifiants minimaux requis pour le diagnostic.
- **Journaux :** durée courte, accès restreint, aucune coordonnée, aucun OTP, jeton brut, clé, secret ou corps libre.

Aucune durée chiffrée hors GPS n'est fixée ici. Elles doivent être arrêtées après analyse des obligations applicables au Niger et des pays de déploiement, des besoins de sécurité et des finalités réellement nécessaires. Il serait trompeur d'inventer des durées légales.

### Livrable avant migration
Une matrice finale par table avec finalité, base de conservation, propriétaire, rôles d'accès, date de départ du délai, durée, suppression/anonymisation, dépendances, sauvegardes et procédure de restauration.

## 4. Protection des trajets — comportement détaillé proposé

Les trois modes sont trois expériences distinctes. Ils ne doivent pas être réduits à un unique partage GPS avec trois étiquettes.

### Mode 1 — Vérification d'arrivée

**Déroulement proposé :**
1. l'auteur indique destination/libellé, heure estimée et contacts ;
2. SAC programme une demande de confirmation à l'heure prévue ;
3. l'auteur confirme son arrivée ;
4. si aucune confirmation n'est reçue après un délai de grâce, les contacts sont avertis avec le texte exact « arrivée non confirmée » ;
5. l'auteur peut confirmer tardivement ; les contacts reçoivent une mise à jour ;
6. l'auteur termine ou annule le trajet.

**À décider :**
- délai de grâce après l'heure estimée ;
- nombre et cadence des rappels à l'auteur ;
- nombre et cadence des notifications aux contacts ;
- comportement en cas de changement d'heure/destination ;
- comportement si le téléphone est hors ligne ;
- confirmation tardive après notification.

**Recommandation :** permettre à l'auteur de choisir le délai de grâce dans une plage simple, avec une valeur par défaut visible. Ne pas déclencher une alerte SOS automatiquement sur la seule absence de confirmation.

### Mode 2 — Accompagnement

**Déroulement proposé :**
1. l'auteur sélectionne un ou plusieurs contacts ;
2. choisit la durée de partage (ponctuelle, 15 min, 30 min, 1 h ou jusqu'à fin du trajet) ;
3. chaque contact voit uniquement la position autorisée, son horodatage et son état de fraîcheur ;
4. si la position n'arrive plus, l'interface affiche « dernière position reçue » et l'heure ; elle ne fabrique pas une position en direct ;
5. le partage s'arrête à l'échéance ou à la clôture par l'auteur.

**À décider :**
- fréquence cible d'envoi ;
- politique réseau faible et reprise ;
- délai avant de marquer la position comme ancienne ;
- comportement après révocation d'un contact ;
- possibilité pour l'auteur de mettre en pause puis reprendre.

**Recommandation :** ne pas transformer automatiquement une perte de connexion en urgence. Afficher clairement le dernier horodatage et un état de connexion.

### Mode 3 — Protection complète

**Déroulement proposé :**
- inclut l'accompagnement ;
- inclut l'heure estimée et la confirmation d'arrivée ;
- déclenche les contrôles de retard définis par l'auteur ;
- en absence de confirmation, avertit les contacts avec le statut « arrivée non confirmée » ;
- laisse à l'auteur le contrôle de la fin du trajet ;
- n'ouvre pas automatiquement un SOS critique.

**À décider :**
- délai de grâce ;
- rappels à l'auteur ;
- notifications et relances aux contacts ;
- comportement si l'auteur change de destination ;
- arrêt, pause et reprise ;
- traitement d'une position absente ou ancienne.

**Recommandation :** utiliser les mêmes réglages de délai et de fraîcheur que le mode 1 et le mode 2 pour éviter des règles incohérentes. Les rappels de trajet restent distincts des rappels SOS toutes les cinq minutes.

## 5. Annulation, clôture et SOS programmé

Pour éviter toute ambiguïté :
- avant déclenchement, annuler un SOS programmé empêche la création de l'alerte ;
- après déclenchement, « Annuler l'alerte » est une clôture explicite par l'auteur avec motif « annulée » ;
- la clôture, quelle que soit sa raison, arrête la création de nouveaux rappels et annule les tâches non envoyées ;
- les messages déjà acceptés par un fournisseur peuvent encore être livrés ;
- l'événement d'annulation reste dans la chronologie.

Cette distinction est maintenant appliquée dans les documents de machines à états, contrats D1 et proposition de schéma.

## 6. Décisions à obtenir avant les API métier

Aucune réponse n'est présumée. Les sujets qui nécessitent une validation produit sont :
1. confirmer ou modifier la recommandation sur les droits d'un contact révoqué pendant une alerte active ;
2. confirmer la suppression de compte en deux phases et la règle de secours si l'auteur ne clôture pas son alerte ;
3. fixer les durées de conservation non GPS après analyse juridique ;
4. définir les délais et relances de chacun des trois modes de Protection des trajets ;
5. confirmer la fréquence de position et les états « ancienne / indisponible » ;
6. fixer les droits d'accès après clôture d'une alerte.

**Tant que ces décisions ne sont pas validées, le schéma et les contrats restent des propositions de conception. Aucun endpoint ne doit supposer un choix implicite.**


## 7. Contrat technique initial de Protection des trajets — 18 novembre 2026

Le module expérimental `src/domain/trip-protection.ts` et ses tests définissent une séparation explicite des trois modes :

- `arrival_check` : heure estimée et délai de grâce configurés, sans partage de position requis ;
- `accompaniment` : partage de position autorisé et durée choisie, sans état de confirmation d'arrivée ;
- `full_protection` : partage de position autorisé, heure estimée et confirmation d'arrivée.

Le contrat exige que le délai de grâce soit fourni explicitement pour chaque trajet concerné. Il ne fixe aucune valeur par défaut, cadence de rappel ou fréquence GPS.

Une absence de confirmation après l'heure estimée et le délai configuré produit uniquement l'état « arrivée non confirmée » ; le trajet reste actif. L'auteur peut confirmer tardivement, événement conservé dans la chronologie. Seul l'auteur clôture le trajet.

**Limites :** ce module ne déclenche aucun rappel, n'envoie aucune notification, ne lit ni n'enregistre de coordonnées GPS et ne constitue pas une API ou une migration D1. La fréquence de position, le délai de grâce par défaut, les rappels à l'auteur et aux contacts, la pause/reprise, la fraîcheur des positions et le comportement hors ligne restent à valider.

Les règles techniques ne remplacent donc pas les arbitrages produit de la section 6.


## 8. Contrat technique de suppression de compte — 18 novembre 2026

Le prototype `src/domain/account-lifecycle.ts` formalise les états `active`, `deletion_pending` et `deleted` :

- la demande authentifiée du propriétaire passe le compte à `deletion_pending` ;
- pendant cette phase, les nouvelles alertes, invitations, trajets et nouveaux partages doivent être bloqués ;
- l'auteur doit pouvoir terminer ou clôturer les alertes et trajets déjà actifs ;
- la finalisation logique est refusée tant qu'une alerte ou un trajet reste actif ;
- le propriétaire peut annuler la demande avant finalisation ;
- `deleted` est terminal dans ce contrat.

**Limites et conditions impératives :**
- les compteurs d'activités fournis au module ne sont pas une preuve d'absence d'activité : le backend devra relire les alertes et trajets actifs dans D1 et vérifier la condition dans l'écriture transactionnelle finale ;
- ce contrat ne supprime, n'anonymise ni ne conserve effectivement aucune donnée ;
- il ne définit aucune période de grâce, aucun délai de finalisation et aucun accès support exceptionnel ;
- si l'auteur ne revient jamais clôturer une alerte, aucune clôture automatique n'est inventée : le cas reste ouvert à arbitrage produit ;
- les durées hors GPS et les éventuelles conservations légales doivent être validées avant d'implémenter l'effacement physique.

Le contrat est un prototype de domaine, pas une fonctionnalité de suppression disponible dans l'application.

## 9. Révocation d'un contact pendant une alerte — séparation à préserver

La règle ferme existante reste : l'instantané initial ne change pas et les rappels SOS continuent toutes les cinq minutes jusqu'à la clôture par l'auteur.

La proposition de séparation des autorisations reste à valider :
- rappel SOS vers le destinataire initial : maintenu jusqu'à clôture ;
- nouvelles transmissions GPS : arrêt immédiat à la révocation ;
- accès au détail pendant l'alerte : proposition de maintien jusqu'à clôture, à valider ;
- accès après clôture : proposition de retrait pour le contact révoqué, à valider ;
- accusé de réception, candidature volontaire et retrait de responsabilité après révocation : règle à définir explicitement.

Le backend devra distinguer au minimum l'éligibilité au rappel, l'accès au détail, l'autorisation de recevoir de nouvelles positions et l'autorisation de répondre/agir. Une seule colonne `is_recipient` ne suffit pas.

**Aucune révocation ne doit effacer rétroactivement les paquets GPS déjà reçus par un contact.** La révocation doit toutefois empêcher toute nouvelle transmission autorisée par SAC. La gestion des paquets en transit et l'ordre atomique entre révocation et émission restent à spécifier.


## 10. Arbitrages détaillés — contact révoqué et alerte orpheline

Le dossier `docs/ARBITRAGES_CONTACT_REVOQUE_ET_ALERTE_ORPHELINE.md` détaille les options d'accès à l'alerte orpheline et le document `docs/PROPOSITIONS_ARBITRAGE_INVITATIONS_ET_REVOCATION.md` propose un paquet de règles pour les invitations et la révocation. Ces propositions ne sont pas approuvées sans confirmation explicite.

Deux décisions restent particulièrement importantes :
- après révocation, le contact continue de recevoir les rappels initiaux (règle établie), mais doit-il recevoir un détail minimal de l'alerte active ou uniquement des rappels opaques sans accès au dossier ?
- si l'auteur ne revient jamais, maintient-on strictement les rappels toutes les cinq minutes jusqu'à sa clôture, ou accepte-t-on une suspension après échéance tout en laissant l'alerte ouverte ?

La note recommande aussi de séparer la durée de partage de position de la durée de vie de l'alerte : une position peut cesser d'être transmise sans que l'alerte soit déclarée résolue. Aucune durée maximale n'est fixée ici.

Ces décisions sont bloquantes avant l'API de révocation, la suppression finale et la planification durable des rappels.

## 11. Historique GPS, accès hors ligne et suppression stricte J+30

**Décision produit non validée — bloquante avant toute conservation d'historique GPS.**

L'exigence de sécurité est que les positions GPS précises ne puissent plus être rendues lisibles après 30 jours, y compris après restauration d'une sauvegarde, retour à un ancien état logiciel, réinstallation, migration d'appareil ou accès administrateur.

Les recherches et documentations officielles disponibles ne démontrent actuellement aucune solution locale PWA/Android/iOS qui garantisse à la fois :
- la consultation hors ligne de l'historique GPS pendant toute la période de 30 jours ;
- l'impossibilité irréversible de restaurer ou réutiliser une copie locale après l'échéance exacte, même si l'appareil est éteint ou hors ligne à cet instant.

**Recommandation technique provisoire :** ne pas conserver d'historique GPS précis dans la première version tant que la garantie n'est pas démontrée. Distinguer la position ponctuelle actuelle et le partage temporaire d'une position pendant une alerte/trajet de l'historique consultable après coup. Une position ancienne ou non actualisée doit toujours être affichée avec son horodatage et son état réel ; elle ne doit jamais être présentée comme une position en direct.

Trois orientations restent à arbitrer :
1. **Priorité à la destruction stricte :** aucun historique GPS hors ligne ; toute consultation d'un historique éventuel dépendrait d'un service externe validé, sans cache récupérable.
2. **Priorité à l'accès hors ligne :** conserver l'historique local, mais ne pas annoncer la garantie J+30 irréversible tant qu'un mécanisme matériel par appareil n'a pas été prouvé ; cette option ne respecte donc pas encore l'exigence de sécurité.
3. **Compromis pour la première version :** pas d'historique GPS après la session de partage ; uniquement la position ponctuelle ou le flux temporaire strictement nécessaire à l'alerte/trajet, selon des règles de conservation encore à spécifier.

Aucune option n'est réputée approuvée par cette note. L'historique GPS reste NO-GO. Aucun GPS réel, stockage d'historique, service de clés ou ressource cloud ne doit être activé avant arbitrage produit, tests complets et revue cryptographique indépendante.

Références de travail : docs/PLAN_VALIDATION_DESTRUCTION_GPS_J30.md, docs/SECURITE_GPS_DESTRUCTION_CRYPTO.md et docs/RECHERCHE_COMPLEMENTAIRE_GPS_J30_ET_TEXTES_NIGER.md.


## 12. Seuil de rappels push avant escalade SMS

**Décision déjà validée :** le lanceur choisit pour chaque alerte le nombre de rappels push avant SMS. Le push initial ne compte pas ; les rappels sont espacés de cinq minutes ; l'escalade est bloquée dès qu'un responsable principal est attribué. Un accusé de réception seul ne bloque pas l'escalade. Voir `docs/DECISION_NOTIFICATIONS_PUSH_ET_ESCALADE_SMS.md`.

**Décision UX validée le 18 novembre 2026 :** choix explicite de 1 à 5 rappels push (soit 5, 10, 15, 20 ou 25 minutes avant l'escalade), avec **2 rappels / 10 minutes présélectionnés**. Utiliser cinq boutons de choix accessibles plutôt qu'un curseur et afficher systématiquement le délai correspondant. Le seuil est choisi pour chaque alerte. Cette décision fixe la plage et la valeur par défaut attendues, mais ne signifie pas que l'interface, le schéma ou la validation serveur sont déjà implémentés.


## 13. Lacunes du modèle global — 18 novembre 2026

Le référentiel `MODELE_GLOBAL_DONNEES_SAC.md` rassemble les domaines et signale les décisions qui restent ouvertes. Il ne transforme pas ces propositions en décisions validées. Les sujets à arbitrer comprennent notamment : preuve du moyen de contact d'un proche, droits après révocation, alerte orpheline hors exception administrative, règles des groupes, programmation SOS, anti-abus du SOS discret, cycle financier Premium et conservation hors GPS. Les incohérences entre états produit et contrats TypeScript doivent être corrigées avant SQL.


## 14. Cycle de compte et preuve des proches — clarification du 18 novembre 2026

Le document `ARBITRAGE_P0_CYCLE_COMPTE_ET_PREUVE_PROCHES.md` distingue les règles validées des détails encore ouverts. Conséquence de la condition obligatoire d'activation : tout proche qui devient un contact SAC actif doit disposer d'un compte SAC actif, donc d'une adresse e-mail vérifiée par OTP. Aucun parcours téléphone seul ou SMS OTP ne peut créer/activer ce compte ou la relation. Les détails de remise de l'invitation, de correspondance de la destination et de consentement sont consolidés dans `docs/CONTRAT_CYCLE_VIE_PROCHES_ET_INVITATIONS.md` ; les valeurs par défaut proposées restent à confirmer dans `docs/PROPOSITIONS_ARBITRAGE_INVITATIONS_ET_REVOCATION.md`. Le téléphone déclaré ne prouve ni la propriété du numéro ni le consentement du proche.

## Décision confirmée — adresse e-mail obligatoire pour activer un compte SAC — 18 novembre 2026

- Toute personne doit fournir une adresse e-mail dès l'inscription.
- La vérification de cette adresse par OTP e-mail est une condition sine qua non de l'activation du compte.
- Sans adresse e-mail, aucune inscription SAC ne peut être finalisée ; aucun compte ne peut être créé ou activé par téléphone seul.
- Tant que l'OTP e-mail n'a pas été validé côté serveur, le compte reste `pending_verification`, sans accès privé ni session.
- Le numéro de téléphone reste obligatoire comme coordonnée déclarée, mais ne remplace jamais l'adresse e-mail et ne peut pas servir de voie de contournement.
- Aucun SMS OTP de compte n'est autorisé. Cette décision ne modifie pas les usages SMS propres au cycle SOS.
- Cette règle est une décision produit validée ; elle ne signifie pas que l'authentification ou l'envoi OTP sont déjà implémentés.


## 15. Arbitrages détaillés — trajets et alertes orphelines — 18 novembre 2026

Le document `docs/PROPOSITIONS_ARBITRAGE_TRAJETS_ET_ALERTES_ORPHELINES.md` rassemble les recommandations à examiner pour les trois modes de Protection des trajets, les retards, le partage de position, la suppression pendant une activité et l'absence prolongée de l'auteur.

Les propositions chiffrées (délai de grâce de 10 minutes, choix 5/10/15/30 minutes, durées d'accompagnement 15/30/60 minutes, plafond de partage de deux heures) ne sont pas approuvées. Elles ne doivent pas être codées comme valeurs par défaut sans validation.

Les invariants déjà établis restent inchangés : pas de SOS automatique sur simple retard ou perte de réseau ; pas de clôture automatique par silence ; pas de clôture ordinaire par un proche ; rappels SOS initiaux toutes les cinq minutes jusqu'à la clôture explicite par l'auteur ; destruction GPS J+30 irréversible obligatoire avant activation de la collecte persistante.

La durée de vie d'une alerte, la durée d'un partage de position et la durée de conservation des preuves doivent rester trois notions séparées. L'expiration d'un partage ne clôture jamais l'alerte.

## 16. Décision confirmée — conservation des alertes et suppression GPS — 18 novembre 2026

La règle produit confirmée remplace les anciennes formulations de conservation GPS J+30 :

- À la clôture effective d'une alerte, toutes les positions GPS qui lui sont associées sont supprimées immédiatement des systèmes contrôlés par SAC.
- Pendant les 30 jours suivant la clôture, seule la nature/catégorie de l'alerte reste dans l'historique.
- À l'expiration des 30 jours, l'entrée d'historique et sa catégorie sont supprimées définitivement.
- Une sauvegarde, un snapshot, une réplication, D1 Time Travel, un export ou une restauration ne doit jamais faire réapparaître une position supprimée à la clôture ni une alerte/catégorie supprimée à J+30.

La durée de 30 jours est donc une durée de conservation de l'alerte clôturée, et non une période de conservation GPS. Le délai part de la clôture de l'alerte. Voir docs/CONTRAT_CONSERVATION_ALERTES_ET_PURGE.md.

Les anciennes options de conservation d'un historique GPS précis pendant 30 jours sont supersédées. Cela ne lève pas le NO-GO technique : la collecte GPS réelle reste bloquée jusqu'à démonstration des purges, des sauvegardes/restaurations et des tests de non-résurrection.
