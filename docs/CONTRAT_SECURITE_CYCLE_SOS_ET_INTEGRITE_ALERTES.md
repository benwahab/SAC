# SAC — Contrat de sécurité du cycle SOS et de l'intégrité des alertes

**Date :** 18 novembre 2026  
**Statut :** consolidation des invariants validés et exigences de sécurité ; les mécanismes nouveaux sont des propositions à arbitrer.  
**Portée :** déclenchement, destinataires, accès, réponses, notifications, chronologie, clôture et traitement des incidents SOS.  
**Nature :** documentation uniquement. Aucun contrôle décrit ici n'est réputé opérationnel.

## 1. Documents à lire ensemble

Ce contrat complète, sans les remplacer :
- PARCOURS_DECLENCHEMENT_SOS_V1.md ;
- MACHINES_ETATS_ET_CONSERVATION.md ;
- MATRICE_AUTORISATION_ROLES.md ;
- CONTRATS_OPERATIONS_ATOMIQUES_D1.md ;
- CONTRAT_CONSERVATION_ALERTES_ET_PURGE.md ;
- CONTRAT_PROTECTION_DONNEES_ACCES_INTERNES_ET_AUDIT.md ;
- PROPOSITIONS_ARBITRAGE_SOS_PROGRAMME_ET_DISCRET.md ;
- PROPOSITIONS_ARBITRAGE_TRAJETS_ET_ALERTES_ORPHELINES.md.

En cas de conflit, les décisions produit validées et les contrats spécialisés prévalent. Ce document ne transforme aucune proposition antérieure en décision approuvée.

## 2. Invariants SOS déjà validés

1. SAC est un service privé destiné à prévenir les proches choisis par le titulaire ; ce n'est ni un service public de secours ni une garantie d'intervention institutionnelle.
2. Une alerte est créée pour un compte authentifié et actif, depuis une session autorisée et un appareil actif.
3. Les destinataires sont sélectionnés parmi les relations de confiance actives et éligibles ; leur instantané est figé atomiquement au déclenchement.
4. Aucun contact, membre de groupe, opérateur ou administrateur ne peut s'ajouter à l'instantané après création.
5. L'absence de GPS ne bloque jamais la création d'une alerte. Le GPS réel reste NO-GO tant que la destruction irréversible et la non-résurrection ne sont pas prouvées.
6. La notification initiale et les rappels sont des opérations distinctes. Le push initial ne compte pas comme rappel.
7. Le lanceur choisit 1 à 5 rappels push espacés de cinq minutes ; le choix par défaut est 2. Le SMS de secours est une escalade distincte, conditionnée par les règles validées et l'existence d'un fournisseur effectivement intégré.
8. Les rappels continuent toutes les cinq minutes jusqu'à la clôture par l'auteur, même après une prise en charge.
9. La règle générale est la clôture par l'auteur. Une exception administrative étroite est déjà validée uniquement lorsque le compte de l'auteur est suspendu et que le cas correspond au scénario spécifique de suspicion d'abus ou de perte/compromission du téléphone : le Super Admin, ou un Administrateur sécurité auquel le Super Admin a attribué la permission nominative dédiée, peut alors clôturer après les vérifications prévues et leur consignation. Le titulaire suspendu peut seulement demander cette clôture ; les proches, destinataires, responsables principaux, support, auditeurs, workers et administrateurs sans cette permission ne peuvent pas la décider. Le silence ne vaut jamais preuve de sécurité. Les conditions détaillées et les contrôles figurent dans `CONTRAT_CLOTURE_EXCEPTIONNELLE_ADMINISTRATIVE_SOS.md`.
10. Accusé de réception, candidature volontaire et attribution du responsable principal sont trois faits différents.
11. Une notification acceptée par un fournisseur ne prouve ni livraison sur l'appareil ni lecture humaine.
12. La chronologie métier est ordonnée par horodatage serveur et conserve les transitions sans réécriture.
13. À la clôture effective, toutes les positions GPS précises liées à l'alerte sont supprimées immédiatement ; seule la catégorie/nature reste pendant 30 jours ; l'entrée et sa catégorie sont ensuite purgées définitivement à J+30, sans résurrection par restauration.

## 3. Menaces couvertes

Le modèle de menace doit au minimum considérer :
- un tiers qui connaît ou devine un identifiant d'alerte ;
- un compte ou appareil compromis ;
- un destinataire qui tente d'élargir ses droits ou de clôturer l'alerte ;
- un acteur qui falsifie le statut d'une notification ou une prise en charge ;
- une requête rejouée après perte de réseau ;
- deux requêtes concurrentes de déclenchement, candidature, attribution ou clôture ;
- un worker malveillant ou compromis qui tente de lire trop de données ;
- un administrateur/délégataire qui tente une consultation hors mission ;
- un attaquant qui spamme des SOS ou cherche à provoquer un déni de service ;
- un fournisseur de notification indisponible, lent ou renvoyant un résultat ambigu ;
- une restauration ancienne qui réintroduit une alerte, un destinataire, une session ou une position supprimée.

## 4. Authenticité et autorisation du déclenchement

Toute commande de déclenchement doit être autorisée côté serveur à partir de la session authentifiée, du compte, de l'appareil, de son état de révocation et de l'état courant du compte. Le serveur ne fait jamais confiance à un author_id, un rôle, un état ou une liste de destinataires fournis par le client.

Le serveur doit revalider au moment de la transaction :
- compte actif et session valide ;
- appareil actif et certificat/identité d'appareil valide selon le protocole approuvé ;
- catégorie et niveau appartenant aux valeurs autorisées ;
- destinataires toujours éligibles au moment du déclenchement ;
- absence de doublon logique de commande ;
- règles d'offre et limites applicables ;
- choix du seuil de rappels dans l'ensemble autorisé.

La transaction de création doit produire un identifiant opaque imprévisible, l'alerte, son instantané de destinataires, l'événement initial et les tâches d'outbox correspondantes de façon cohérente. Aucun succès n'est affiché avant confirmation serveur.

**À arbitrer :** format de la preuve de commande, protection CSRF selon le transport de session retenu, durée de validité d'une intention pré-déclenchement et éventuelle réauthentification pour certains raccourcis. Aucun mécanisme cryptographique spécifique n'est adopté ici.

## 5. Idempotence, rejeu et concurrence

Chaque action susceptible d'être répétée par le réseau doit avoir une clé d'idempotence à usage limité, liée au compte, à l'action et à son contexte. La clé ne remplace jamais l'autorisation serveur.

Exigences :
1. Une répétition du même déclenchement retourne le résultat de l'opération initiale ; elle ne crée pas une deuxième alerte.
2. Une clé réutilisée pour un autre contenu ou une autre action est refusée.
3. Les clés ont une durée de validité bornée et un stockage protégé ; leurs valeurs brutes ne sont pas journalisées.
4. Deux déclenchements concurrents identiques ne créent qu'une alerte.
5. Deux candidatures ou prises en charge concurrentes ne produisent jamais deux responsables principaux simultanés.
6. Une clôture et un rappel concurrent doivent avoir un ordre serveur cohérent : aucun nouveau rappel ne doit être créé après le point de clôture effectif.
7. Une réponse reçue après clôture est refusée pour les actions métier ; un événement déjà confirmé n'est pas réécrit.
8. Les workers utilisent des baux, une déduplication déterministe et une reprise sûre après expiration de bail.

Le système ne doit jamais interpréter une réponse réseau perdue comme une preuve d'échec métier et relancer aveuglément une création. Le client interroge l'état par un identifiant de commande ou rejoue la même clé idempotente.

## 6. Instantané des destinataires et confidentialité

L'instantané est créé côté serveur et immuable. Il contient uniquement les identifiants nécessaires, l'heure de sélection et les métadonnées minimales de preuve d'éligibilité. Il ne copie pas le profil complet du proche.

À chaque lecture, le serveur vérifie que le compte demandeur appartient à l'instantané et que le droit précis demandé est encore valide. Connaître l'identifiant de l'alerte, être membre d'un groupe, partager un appareil ou être un proche d'un destinataire ne suffit pas.

Les vues auteur, destinataire, responsable principal, opérateur technique et administrateur sont distinctes. Un destinataire ne voit que les informations nécessaires à son intervention et explicitement partagées. Les contacts non sélectionnés ne reçoivent ni notification, ni aperçu, ni résultat de recherche révélant l'alerte.

Le contenu des notifications doit être minimal : ne pas placer dans un écran verrouillé, un titre push, un SMS ou un journal technique des détails médicaux, une description libre, une adresse ou une coordonnée GPS. La notification invite à ouvrir SAC pour consulter les éléments autorisés. La formulation exacte et les exceptions restent à valider.

La révocation d'une relation de confiance ne réécrit pas l'instantané ni n'annule les rappels déjà prévus. Les droits de lecture du détail, de nouvelles positions, de réponse et de coordination après révocation doivent suivre la politique dédiée ; ils ne sont jamais déduits du seul instantané. Les propositions de traitement des alertes actives après révocation restent à arbitrer.

## 7. Réponses humaines et responsabilité

Les actions sont distinctes :
- accusé de réception : le destinataire confirme avoir vu l'alerte ;
- candidature : le destinataire propose son aide ;
- attribution : le serveur confirme qu'il devient responsable principal ;
- retrait : le responsable renonce à cette responsabilité ;
- clôture : action réservée à l'auteur.

Le client ne peut pas s'attribuer le rôle de responsable en envoyant un champ de statut. Le serveur choisit le premier candidat éligible selon un ordre atomique déterministe. Un retrait libère le rôle et permet une nouvelle attribution sans supprimer l'historique.

L'attribution, le retrait et le transfert doivent être transactionnels, idempotents et produire des événements distincts. Aucun responsable principal ne peut modifier les destinataires, le niveau, la catégorie ou clôturer l'alerte.

## 8. Chronologie et preuve des événements

La chronologie doit séparer :
- événements métier : création, accusé, candidature, attribution, retrait, clôture ;
- événements de transport : planification, tentative, acceptation fournisseur, livraison confirmée si disponible, échec ou résultat ambigu ;
- événements de sécurité : refus d'accès, révocation, anomalie et réponse à incident.

Pour chaque événement, le serveur produit un horodatage UTC, un identifiant unique, un type/version, l'acteur authentifié si applicable, l'alerte concernée, le résultat et une référence de corrélation. L'heure déclarée par le téléphone peut être conservée séparément comme information non autoritative, jamais comme ordre de chronologie.

Les événements métier ne sont ni modifiés ni supprimés pour corriger une erreur : une correction est un nouvel événement explicatif. Les événements ne contiennent jamais de coordonnées, de contenu GPS, de secrets, de jetons, de codes OTP ou le corps complet d'une notification.

L'append-only applicatif seul n'est pas une preuve contre un administrateur de base. L'intégrité et le scellement indépendant doivent suivre le contrat d'audit interne.

## 9. Notifications, rappels et escalade

L'outbox est la source de travail durable, pas la preuve de livraison. Chaque occurrence est identifiée de façon déterministe par alerte, destinataire, canal et numéro de rappel.

Le worker :
1. acquiert atomiquement un bail ;
2. relit l'état de l'alerte, le destinataire et les autorisations nécessaires ;
3. vérifie que l'occurrence est encore due et non annulée ;
4. transmet uniquement le contenu minimal ;
5. enregistre le résultat fournisseur sans le transformer en preuve de lecture ;
6. libère ou laisse expirer le bail selon le résultat ;
7. reprend sans doublon après panne.

À la clôture, les tâches non transmises sont annulées. Un message déjà accepté par le fournisseur peut encore arriver : l'interface doit expliquer cette limite. Une erreur de notification ne modifie pas l'état métier et ne clôture pas l'alerte.

Le SMS n'est jamais annoncé comme opérationnel tant que le fournisseur, le routage, les coûts, les accusés et les essais réels ne sont pas validés. Une tâche SMS créée ou acceptée n'est pas un SMS reçu.

## 10. Fausses alertes, abus et disponibilité

La protection anti-abus doit limiter les créations automatisées et les attaques sans empêcher une personne en danger d'utiliser rapidement le SOS.

Exigences de conception :
- limites de débit côté serveur, graduées et tenant compte des comptes/appareils ;
- détection des répétitions anormales et des comportements automatisés ;
- protections contre l'énumération des comptes et des alertes ;
- contrôles anti-bot proportionnés, sans CAPTCHA obligatoire dans le parcours critique par défaut ;
- messages d'erreur qui ne révèlent pas l'existence d'un compte ou d'une alerte ;
- mécanisme de signalement d'un abus sans donner à un tiers le pouvoir de supprimer une alerte ;
- conservation des preuves minimales d'abus selon une politique de rétention approuvée.

**Interdictions de conception :**
- ne jamais bloquer automatiquement un SOS uniquement parce que l'utilisateur a déjà déclenché plusieurs alertes ;
- ne jamais imposer un délai de réflexion, un paiement ou une confirmation supplémentaire générique au SOS critique immédiat ;
- ne jamais sanctionner automatiquement un compte sur la seule base d'un score opaque ;
- ne jamais faire dépendre la création de l'alerte de la disponibilité du push, du SMS, du GPS ou d'un fournisseur tiers.

**À arbitrer :** seuils, fenêtres, escalade des limitations, éventuelle revue humaine et gestion des abus répétés. Aucun seuil numérique nouveau n'est approuvé.

## 11. Réseau faible, hors-ligne et résultat ambigu

Une PWA ne peut pas garantir l'envoi d'un SOS lorsque le téléphone n'a aucune connectivité et que le serveur n'a pas reçu la commande. L'interface doit distinguer explicitement :
- commande non envoyée ;
- envoi en cours ;
- résultat serveur confirmé ;
- résultat ambigu nécessitant vérification ;
- échec confirmé.

Une file locale ne doit jamais afficher « alerte envoyée » avant confirmation serveur. Une reprise réseau doit réutiliser la même clé idempotente. Aucun SMS direct, relais Bluetooth, réseau maillé ou promesse hors-ligne n'est inclus sans conception et validation spécifiques.

L'utilisateur doit recevoir des consignes compréhensibles si SAC ne peut confirmer la création, sans faire croire que les proches ont été prévenus.

## 12. Incidents et compromission

En cas de compte/appareil compromis :
- révoquer les sessions et appareils selon le processus autorisé ;
- empêcher les nouvelles commandes issues de l'identité révoquée ;
- préserver la chronologie et les preuves minimales ;
- ne pas effacer ni réécrire une alerte déjà créée ;
- ne pas permettre à un administrateur de clôturer une alerte au nom de l'auteur ;
- appliquer les règles de continuité des rappels et les règles d'accès après révocation, une fois celles-ci arbitrées ;
- examiner les alertes, commandes et exports affectés sans exposer le contenu à des rôles non autorisés.

Une alerte suspectée d'être fausse ne peut être annulée que par son auteur selon le cycle normal, sauf procédure distincte explicitement validée. Aucun opérateur ne doit supprimer une alerte pour faire disparaître une anomalie.

## 13. Conservation, clôture et restauration

Le contrat spécialisé CONTRAT_CONSERVATION_ALERTES_ET_PURGE.md prévaut :
- GPS précis supprimé dès la clôture effective ;
- seule la nature/catégorie reste pendant 30 jours ;
- alerte et catégorie supprimées à J+30 ;
- sauvegardes, snapshots, exports et Time Travel ne peuvent ressusciter les données supprimées.

Les événements de sécurité ou de transport ne peuvent pas conserver indirectement une description, un itinéraire, une position ou un identifiant permettant de reconstituer une alerte purgée. Les durées générales non approuvées ne sont pas fixées ici.

## 14. Tests de sécurité et d'acceptation

Avant activation réelle, tests d'intégration et adversariaux obligatoires :

1. utilisateur non authentifié : déclenchement refusé ;
2. compte suspendu, supprimé ou en attente de vérification : déclenchement refusé ;
3. appareil ou session révoqué : déclenchement et renouvellement refusés ;
4. author_id falsifié dans le client : ignoré/refusé ;
5. destinataire non éligible ou révoqué avant déclenchement : exclu ;
6. destinataire non sélectionné connaissant l'identifiant : aucune lecture ni réponse ;
7. membre d'un groupe commun : aucun accès implicite ;
8. répétition de la même commande : une seule alerte ;
9. même clé d'idempotence avec contenu différent : refus ;
10. deux déclenchements concurrents : aucune duplication ;
11. deux prises en charge simultanées : un seul responsable principal ;
12. destinataire tentant de clôturer : refus ;
13. responsable principal tentant de changer les destinataires : refus ;
14. horodatage client falsifié : chronologie serveur inchangée ;
15. répétition d'un accusé ou d'une candidature : événement métier unique ;
16. clôture concurrente avec rappel : aucun nouveau rappel après le point de clôture ;
17. worker redémarré avec bail expiré : reprise sans double envoi ;
18. notification acceptée : jamais affichée comme lue ;
19. SMS non configuré : aucune promesse d'envoi ;
20. push/SMS indisponible : création métier de l'alerte non annulée ;
21. perte réseau après commit : récupération de l'état initial par idempotence ;
22. file locale non confirmée : jamais affichée comme alerte transmise ;
23. contenu privé absent des aperçus écran verrouillé et logs ;
24. aucun GPS réel ni dérivé collecté avant levée formelle du NO-GO ;
25. clôture : GPS supprimé immédiatement dans tous les systèmes contrôlés ;
26. J+30 : catégorie et entrée supprimées, y compris après restauration ancienne ;
27. aucun rôle administratif ne peut modifier l'instantané ou effacer l'historique ;
28. restauration ne réactive ni alerte, ni destinataire, ni appareil révoqué.

## 15. Points encore ouverts — aucune décision présumée

- preuve exacte de commande et réauthentification éventuelle ;
- format et durée des clés d'idempotence ;
- contenu minimal des push/SMS et aperçu sur écran verrouillé ;
- droits détaillés après révocation d'un proche pendant une alerte active ;
- seuils anti-abus et procédure de revue ;
- limites de répétition, faux positifs et contestation ;
- comportement précis de l'alerte en cas de compromission du compte auteur ;
- politique de correction d'une erreur métier sans réécriture ;
- fournisseur SMS/push et garanties de livraison ;
- mode hors-ligne éventuel ;
- durée des métadonnées de transport et d'abus ;
- scellement externe de la chronologie et vérification indépendante.

## 16. Conditions de passage à l'implémentation

Aucun développement ou déploiement avant :
1. arbitrage des décisions produit ouvertes qui affectent le parcours ;
2. cohérence du modèle relationnel et des machines à états ;
3. opérations D1 atomiques pour création, réponses, responsabilité, clôture et outbox ;
4. tests de concurrence, idempotence, révocation, restauration et absence de fuite ;
5. revue indépendante sécurité/confidentialité ;
6. levée distincte des blocages GPS si une localisation réelle est envisagée ;
7. autorisation explicite de l'utilisateur pour toute modification de code, test, migration, ressource Cloudflare, fournisseur ou déploiement.

**Conclusion :** l'alerte doit rester une commande privée, authentifiée, atomique et traçable. Ni un identifiant connu, ni une notification acceptée, ni une candidature, ni un rôle administratif ne peuvent se substituer aux autorisations et aux faits confirmés par le serveur.


## Référence complémentaire — prévention des abus et disponibilité

Lire `CONTRAT_PREVENTION_ABUS_USURPATION_ET_SATURATION.md` pour le modèle de menaces étendu, les limites anti-automatisation, les plaintes, la saturation et la protection du chemin critique. Préserver l'interdiction de bloquer automatiquement un SOS uniquement en raison d'alertes répétées. Les seuils et mesures proposées ne sont pas approuvés et ne modifient pas le cycle SOS.


## Référence complémentaire — continuité et reprise

Lire `CONTRAT_RESILIENCE_CONTINUITE_ET_REPRISE_INCIDENT.md` pour les états réseau, la reprise outbox, les pannes fournisseurs, la restauration et les tests de continuité. La création SOS n'est confirmée qu'après commit serveur ; une perte de réponse est résolue par idempotence ; une panne de notification n'annule pas l'alerte. Les RTO/RPO et procédures d'exploitation restent à arbitrer.
