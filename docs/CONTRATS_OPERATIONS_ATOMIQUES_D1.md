# SAC — Contrats des opérations atomiques D1

**Statut :** conception des opérations serveur, non implémentée.  
**Prérequis :** lire `CONTRAT_SECURITE_D1.md` et `MACHINES_ETATS_ET_CONSERVATION.md`.  
**Interdiction :** ce document ne crée aucune migration, API, donnée GPS ni ressource Cloudflare.

## 1. Objectif

Transformer les machines à états en contrats vérifiables pour les futures opérations D1. Pour chaque commande, le backend devra définir :
- l'identité authentifiée de l'acteur ;
- les préconditions relues depuis D1 ;
- la transition attendue ;
- les écritures qui doivent réussir ensemble ;
- le comportement en concurrence et en répétition ;
- les résultats métier renvoyés au client ;
- les événements d'audit non sensibles ;
- les tests d'intégration qui prouvent l'absence d'effets partiels.

Une vérification préalable en TypeScript ne suffit jamais à autoriser une écriture sensible : les conditions déterminantes doivent être réévaluées dans l'écriture SQL finale ou dans une transaction D1 conçue pour fermer la course.

## 2. Règles d'implémentation D1

### 2.1 Batch transactionnel, pas de logique conditionnelle implicite

D1 `batch()` exécute les instructions séquentiellement dans une transaction. Une erreur SQL annule la transaction. En revanche, une instruction valide qui affecte zéro ligne n'est pas une erreur SQL.

Conséquences :
- chaque instruction qui écrit doit contenir ses propres prédicats d'autorisation ou dépendre d'une ligne de transition qui a effectivement été créée ;
- une instruction secondaire ne doit pas écrire simplement parce que le batch s'est poursuivi après une précondition qui n'a affecté aucune ligne ;
- le backend doit examiner les résultats de chaque instruction et les lignes affectées ;
- la résolution de la promesse batch n'est pas, à elle seule, un succès métier ;
- une séquence de requêtes D1 indépendantes ne doit pas être décrite comme atomique.

Si le métier exige qu'une absence de précondition provoque le rollback de toutes les écritures, le schéma SQL doit fournir un mécanisme d'échec transactionnel explicite (contrainte, trigger contrôlé ou forme SQL unique adaptée), puis le comportement doit être prouvé sur D1. Ne pas supposer qu'un `UPDATE` à zéro ligne provoque ce rollback.

### 2.2 Identité et autorisation

- Le compte et l'appareil de l'acteur viennent de la session authentifiée, jamais du corps JSON.
- Le statut actif, `auth_version`, la session et le certificat sont relus depuis D1.
- Un identifiant fourni par le client est un sélecteur de ressource, pas une preuve de droit.
- Les lectures d'une ressource doivent filtrer par propriétaire ou destinataire autorisé dans la requête SQL.
- Les écritures finales répètent les conditions de statut et de relation nécessaires.
- Pas de cache positif d'autorisation.
- Les valeurs sont liées via des requêtes préparées ; aucune concaténation de données externes dans SQL.

### 2.3 Idempotence

Chaque commande pouvant être répétée après une coupure réseau doit posséder une clé d'idempotence opaque, liée à l'acteur et au type de commande, avec une durée de conservation définie. La même clé avec un contenu différent est refusée. Une répétition identique retourne le résultat déjà enregistré sans répéter les effets externes.

Le format, la portée et la durée de conservation de ces clés restent à définir avant implémentation.

## 3. Contrat — création d'une alerte

**Acteur :** auteur authentifié sur un appareil actif.  
**Préconditions :**
- compte actif ;
- session valide pour le compte et l'appareil ;
- appareil actif et autorisé ;
- catégorie et urgence autorisées ;
- nombre de destinataires conforme à l'offre ;
- sélection finale explicitement confirmée par l'auteur ; chaque relation sélectionnée est active, invitation acceptée et moyen de contact vérifié au moment du déclenchement ;
- sélection initiale issue des préférences de catégorie ; dans le parcours guidé, toute dérogation ponctuelle est explicite et limitée à cette alerte ; dans le raccourci critique immédiat, la sélection correspond exactement à la liste préconfigurée ;
- nombre de destinataires conforme à l'offre ;
- aucune coordonnée GPS précise ne doit être écrite dans D1.

**Effets qui doivent être cohérents :**
1. créer une alerte active ;
2. vérifier chaque destinataire de la sélection finale fournie par l'auteur, sans ajout automatique ; 
3. figer cette liste finale des destinataires ;
4. créer l'événement initial ;
5. créer les tâches initiales de notification, une par destinataire/canal selon la politique retenue ;
6. enregistrer le résultat d'idempotence.

**Concurrence :**
- deux requêtes avec la même clé d'idempotence ne créent qu'une alerte ;
- une relation révoquée avant la transition finale ne peut pas être utilisée pour une nouvelle alerte ;
- une modification concurrente des préférences doit avoir une règle d'ordre déterministe : la sélection initiale est calculée à partir d'un état cohérent, puis l'ajustement ponctuel explicite de l'auteur est validé et figé au moment de la création ;
- une relation révoquée ou devenue non vérifiée avant la transition finale est refusée, même si elle figurait dans la sélection envoyée par le client ;
- les destinataires absents de la sélection finale ne reçoivent aucune tâche ; le serveur n'ajoute aucun contact automatiquement.

**Cas sans destinataire :** la règle produit doit être définie. Ne jamais annoncer « alerte envoyée » si aucun destinataire n'a été sélectionné. Le comportement de création locale d'une alerte sans destinataire doit être explicitement approuvé avant API.

**Tests :** création normale, aucun destinataire, contact révoqué en concurrence, double soumission, échec d'une écriture intermédiaire, absence de fuite GPS et absence de notification orpheline.

## 4. Contrat — accusé de réception et candidature volontaire

**Acteur :** compte présent dans l'instantané des destinataires de l'alerte.  
**Préconditions :** alerte active ; destinataire autorisé ; compte et session actifs.

L'accusé de réception et la candidature volontaire sont deux commandes distinctes et deux événements distincts.

**Accusé de réception :**
- enregistre la réception déclarée par le proche ;
- ne change pas l'état de l'alerte ;
- ne change pas la responsabilité principale ;
- ne supprime ni ne suspend les rappels.

**Candidature volontaire :**
- enregistre la volonté du proche ;
- n'accorde pas automatiquement la responsabilité principale ;
- si aucune personne n'est responsable, tente l'attribution atomique ;
- si une autre personne est déjà responsable, conserve la candidature selon la règle métier validée ;
- ne ferme jamais l'alerte.

**Tests :** non-destinataire refusé, alerte terminée refusée, accusé répété idempotent, deux volontaires simultanés, un seul responsable principal.

## 5. Contrat — attribution et transfert du responsable principal

**Acteur :** destinataire volontaire de l'alerte.  
**Préconditions :** alerte active, candidature valide, compte et session actifs.

L'attribution doit être une transition conditionnelle atomique :
- exactement une responsabilité courante par alerte ;
- le premier volontaire accepté par le serveur gagne ;
- le temps client ne décide jamais de la priorité ;
- la responsabilité historique précédente est clôturée avant ou dans la même opération que l'ouverture de la suivante ;
- une contrainte unique doit empêcher deux responsabilités courantes.

**Retrait du responsable :**
- seul le responsable courant peut se retirer ;
- son intervalle est terminé avec un motif non sensible ;
- une nouvelle attribution est possible aux autres volontaires selon une règle déterministe ;
- si personne ne reprend, l'alerte reste active sans responsable ;
- les rappels continuent vers les destinataires initiaux.

**Cas simultané :** deux demandes de retrait/reprise ne doivent jamais créer deux responsables ou perdre l'historique. La règle de priorité des volontaires déjà en attente doit être validée et testée.

### 5.1 Continuité du responsable et transfert — règles proposées à valider

Une absence de heartbeat, une session momentanément inaccessible, un appareil éteint ou une PWA suspendue ne constitue pas une commande de retrait. Le serveur ne doit jamais libérer automatiquement le rôle sur la seule base d'un délai ou d'une absence de réponse.

Lors d'un retrait explicite du responsable courant, l'opération atomique doit :
1. vérifier que l'alerte est encore active et que l'acteur est le responsable courant ;
2. terminer exactement une période de responsabilité avec motif et horodatage serveur ;
3. sélectionner le volontaire admissible le plus ancien selon l'ordre monotone serveur, avec identifiant stable comme départage déterministe ;
4. attribuer le rôle à ce volontaire dans la même opération, si un candidat existe ;
5. sinon laisser l'alerte active sans responsable principal ;
6. écrire les événements d'audit correspondants sans donnée sensible ;
7. garantir l'idempotence : le rejeu de la même commande ne termine pas une seconde période et ne promeut pas un second volontaire.

Deux retraits, candidatures ou transferts concurrents doivent être sérialisés. Une seule responsabilité courante peut exister. Si le principal se retire et qu'un volontaire est promu, le rôle est effectif uniquement après le commit serveur. Si aucun volontaire n'existe, les rappels continuent vers l'instantané initial et l'escalade SMS est réévaluée selon l'état métier courant et le seuil validé ; aucun statut de transfert réussi ne doit être affiché avant confirmation.

La reconnexion de l'ancien responsable ne restaure pas son rôle. Il ne peut redevenir responsable que par une nouvelle candidature suivie d'une attribution normale, si aucune autre personne n'est déjà responsable.

**Tests D1 à prévoir :** perte réseau sans retrait explicite ; principal silencieux sans transfert automatique ; retrait avec un volontaire en attente ; retrait avec plusieurs volontaires ordonnés ; retrait sans volontaire ; deux retraits concurrents ; candidature simultanée au retrait ; rejeu après perte de réponse ; reconnexion de l'ancien principal ; clôture concurrente avec transfert ; course entre retrait et seuil SMS.

**Statut :** règles techniques proposées, non encore validées par le propriétaire produit et non implémentées. Aucun SQL, endpoint, worker ou scheduler n'est créé par cette section.

## 6. Contrat — clôture de l'alerte par l'auteur

**Acteur :** auteur de l'alerte uniquement.  
**Préconditions :** alerte active et session de l'auteur valide.

**Effets cohérents :**
- transition conditionnelle de `active` vers `closed` ; une demande « Annuler l'alerte » après déclenchement est une clôture dont le motif est « annulée » ;
- événement final append-only ;
- fin de la responsabilité courante ;
- annulation des rappels et tâches non encore envoyées ;
- blocage de toute nouvelle planification ;
- enregistrement de l'idempotence.

Une notification déjà acceptée par un fournisseur peut arriver après la clôture ; le serveur ne peut pas garantir son rappel. Cette limite doit être visible dans la documentation produit.

**Tests :** destinataire tentant de clôturer, auteur clôturant, deux clôtures concurrentes, clôture et worker de rappel simultanés, répétition après réponse réseau perdue.

## 7. Contrat — révocation d'un appareil

**Acteur :** utilisateur authentifié et autorisé à gérer les appareils du compte. La règle root-only est appliquée à l'approbation des nouveaux appareils ; la révocation doit suivre la politique de gestion des appareils validée.

**Effets atomiques attendus :**
- appareil ciblé marqué révoqué ;
- `auth_version` incrémentée de façon monotone ;
- toutes les sessions de cet appareil invalidées ;
- certificats actifs de cet appareil révoqués ;
- abonnements push de cet appareil révoqués ;
- défis de jumelage impliquant cet appareil annulés ;
- nouvelles autorisations de partage initiées par cet appareil bloquées ;
- partage GPS en cours traité selon une règle explicite, sans écrire de coordonnées dans D1 ;
- événement d'audit sans secret.

**Révocation de soi-même :** l'autorisation de l'acteur doit être établie avant les effets, mais la transaction ne doit pas s'interrompre parce que la première écriture a invalidé la session qui a initié la demande. Le contrat doit garantir la fin de toutes les conséquences ou aucune.

**Tests :** révocation d'un autre appareil, révocation de l'appareil courant, double révocation, révocation concurrente à une mutation, appareil secondaire qui tente une approbation, sessions des autres appareils toujours valides.

## 8. Contrat — consommation d'un défi OTP ou de jumelage

**Acteur :** identité ou appareil lié au défi, après preuve appropriée.  
**Préconditions :** défi en attente, non expiré, non consommé, compte et contexte attendus.

**Effets :**
- consommation à usage unique ;
- création de l'effet métier (vérification d'identité ou activation de l'appareil) dans la même transaction ;
- compteur d'essais et limites anti-abus appliqués ;
- aucun secret brut conservé dans D1, logs ou audit.

Pour les OTP à faible entropie, un hash rapide seul est interdit. Le mécanisme de protection doit utiliser un secret serveur séparé et une stratégie résistante aux tests hors ligne, avec limites d'essais et expirations courtes. Le fournisseur n'est pas choisi.

**Tests :** défi expiré, contexte substitué, trop d'essais, double consommation concurrente, panne au milieu du processus, aucune activation si la preuve échoue.

## 9. Contrat — outbox et rappels

**Acquisition d'une tâche :**
- transition conditionnelle de `pending` ou `retry_wait` vers `processing` ;
- bail avec propriétaire et échéance ;
- un seul worker détient un bail actif ;
- bail expiré récupérable.

**Envoi externe :**
- l'appel fournisseur se fait hors transaction D1 ;
- ne pas garder une transaction ouverte pendant le réseau ;
- l'identifiant d'idempotence fournisseur est transmis si supporté ;
- résultat accepté, erreur temporaire, erreur permanente et résultat ambigu sont distingués.

**Finalisation :**
- mise à jour conditionnelle par le détenteur du bail ;
- tentative enregistrée sans secret ni payload sensible ;
- reprise ou échec terminal selon politique ;
- une tâche déjà acceptée ne doit pas être renvoyée simplement parce que le worker n'a pas reçu la réponse.

**Rappels :**
- séquence d'occurrence déterministe toutes les cinq minutes ;
- destinataires issus de l'instantané initial ;
- accusé de réception et responsabilité n'arrêtent pas les rappels ;
- clôture explicite par l'auteur (y compris avec motif « annulée ») empêche les occurrences futures et annule les tâches en attente ;
- la planification et l'annulation concurrentes doivent avoir une règle atomique.

**Limite :** l'envoi exactement une fois n'est pas garanti si le fournisseur n'offre pas d'idempotence ni de mécanisme de réconciliation. Il faut concevoir pour livraison au moins une fois avec déduplication, ou documenter précisément les limites du canal.

## 10. Contrat — accès à une alerte

Chaque lecture doit appliquer au minimum :
- auteur du compte concerné, ou
- destinataire présent dans l'instantané de l'alerte, sous réserve des règles d'accès après révocation qui restent à valider.

Un identifiant d'alerte connu ne donne aucun accès. Les listes, détails, événements, réponses et pièces jointes éventuelles doivent tous appliquer le même contrôle d'accès, pas uniquement la route détail.

La politique de lecture d'une alerte existante après révocation de la relation de confiance reste ouverte. Elle ne doit pas être décidée implicitement par le fait que le destinataire a été figé.

## 11. Contrat — Protection des trajets

Les transitions de création, confirmation, annulation, expiration et relance doivent être spécifiées séparément pour les trois modes. Le modèle D1 ne reçoit aucune position GPS précise tant que le mécanisme de destruction J+30 n'est pas prouvé.

Une échéance sans confirmation génère seulement « arrivée non confirmée ». Le serveur ne doit pas transformer automatiquement cette absence en accident, danger avéré ou alerte SOS.

Les fenêtres de rappel et les comportements après confirmation tardive restent à définir avant endpoints.

## 12. Preuves et tests D1 requis

Les tests doivent être exécutés contre le runtime D1 local, puis sur un environnement Preview réellement isolé. Les mocks et tests unitaires purs ne suffisent pas.

Pour chaque opération multi-table :
1. vérifier l'état initial ;
2. exécuter la commande ;
3. inspecter toutes les lignes touchées ;
4. provoquer un échec au milieu et vérifier le rollback ;
5. lancer des commandes concurrentes ;
6. vérifier qu'un seul résultat métier est accepté ;
7. rejouer la même clé d'idempotence ;
8. vérifier l'absence d'effets secondaires et de secrets dans les logs.

Aucun test Preview ne doit utiliser la base D1 de production. Le binding doit être vérifié par identifiant, pas seulement par nom.

## 13. Conditions de passage à l'implémentation

Avant la première migration :
- valider les règles produit ouvertes dans `MACHINES_ETATS_ET_CONSERVATION.md` ;
- figer le schéma relationnel et les contraintes composites ;
- choisir la stratégie de transport de session et l'OTP, ou maintenir des adaptateurs clairement isolés ;
- définir l'idempotence des commandes et les limites des fournisseurs ;
- démontrer les transactions de révocation, prise en charge, clôture et outbox sur D1 local ;
- valider l'isolation Preview/Production ;
- obtenir une revue de sécurité du backend ;
- garder toute donnée GPS précise hors D1 et du backend tant que J+30 n'est pas prouvé.

**Aucune migration ni route métier ne doit être créée sur la seule base de ce document.**


## 14. Contrat — Protection des trajets

Les trois modes ont des invariants distincts et doivent être stockés explicitement comme tels :

| Mode | Heure estimée + délai de grâce | Partage de position |
|---|---|---|
| `arrival_check` | Obligatoires | Non requis |
| `accompaniment` | Non applicables | Obligatoire et durée choisie |
| `full_protection` | Obligatoires | Obligatoire et durée choisie |

Le domaine TypeScript valide ces combinaisons et les transitions suivantes :
- confirmation d'arrivée par l'auteur, y compris après une notification « arrivée non confirmée » ;
- passage à « arrivée non confirmée » par un processus serveur uniquement après l'heure estimée + délai de grâce ;
- maintien du trajet en état actif après absence de confirmation ;
- clôture/annulation par l'auteur uniquement.

L'événement « arrivée non confirmée » ne crée jamais une alerte SOS et ne prétend jamais qu'un accident est survenu.

**Avant implémentation D1 :** définir le planificateur idempotent des échéances, le traitement des changements d'heure estimée, la concurrence entre confirmation et échéance, les notifications, la pause/reprise et les règles de suppression. Les paramètres de délai doivent provenir d'une politique explicitement validée ; aucune valeur par défaut n'est implicite.

Aucune coordonnée GPS précise ne doit être persistée dans D1. Le prototype de domaine n'est pas une implémentation serveur.


## 15. Contrat — demande et finalisation de suppression de compte

### Demande
- authentifier fortement le propriétaire depuis la session, jamais depuis un identifiant du corps ;
- créer une demande idempotente et passer le compte de `active` à `deletion_pending` ;
- empêcher atomiquement toute nouvelle alerte, invitation, relation, protection de trajet ou nouvelle autorisation de partage ;
- conserver les capacités minimales permettant à l'auteur de clôturer les alertes et trajets déjà actifs ;
- révoquer les sessions des autres appareils selon le contrat de session et ne laisser qu'un parcours restreint de finalisation.

### Finalisation
- vérifier depuis D1 qu'aucune alerte et aucun trajet ne sont actifs ;
- inclure cette condition dans la transition SQL finale pour fermer la course entre clôture et nouvelle activité ;
- appliquer la matrice de suppression/anonymisation validée, table par table ;
- invalider les sessions, abonnements push, invitations, jetons, accès aux fichiers et tâches en attente ;
- ne pas effacer les preuves minimales légalement nécessaires sans fondement, mais ne rien conserver par simple commodité ;
- enregistrer un reçu de finalisation non sensible et idempotent.

**Important :** le prototype TypeScript accepte des compteurs d'activités comme entrée de test ; le backend ne doit jamais faire confiance à des compteurs client ou à un résultat de lecture ancien. La condition doit être vérifiée à nouveau dans l'opération atomique D1.

Aucun délai de grâce, aucune durée hors GPS et aucune règle de clôture automatique ne sont fixés ici. Si un auteur abandonne une alerte active, le système ne peut pas contourner la règle « seul l'auteur clôture » sans décision produit et fondement approprié.

## 16. Contrat — révocation d'un contact pendant une alerte active

La révocation de la relation de confiance et l'instantané des destinataires de l'alerte sont deux objets distincts.

Invariants déjà établis :
- l'instantané initial de l'alerte n'est jamais réécrit ;
- les rappels planifiés vers les destinataires initiaux continuent jusqu'à clôture de l'alerte ;
- aucun nouveau contact n'est ajouté à une alerte existante.

Décisions de sécurité proposées, à valider :
- arrêter les nouvelles transmissions GPS vers le contact révoqué dès la transition effective ;
- maintenir le droit de recevoir les rappels initiaux jusqu'à clôture ;
- décider explicitement si le contact garde le détail de l'alerte active ;
- retirer, si validé, l'accès au détail et à l'historique après clôture ;
- définir si le contact révoqué peut encore accuser réception, se porter volontaire ou se retirer de sa responsabilité.

L'opération D1 de révocation devra ordonner atomiquement la relation de confiance, les autorisations de partage et les autorisations de réponse. Le worker de notifications devra distinguer une tâche de rappel SOS déjà due d'une tâche de partage GPS. La révocation ne doit jamais supprimer un rappel initial par simple effet de bord.

Tests d'intégration obligatoires :
- révocation avant la création d'une nouvelle alerte ;
- révocation concurrente avec une émission GPS ;
- révocation juste avant l'échéance d'un rappel ;
- révocation pendant une prise en charge ou un transfert ;
- clôture puis tentative de lecture par le contact révoqué ;
- réessai idempotent de la révocation et panne partielle.


## 13. Contrat — escalade SMS après rappels push, selon le seuil du lanceur

**Décision produit validée :** le lanceur choisit, pour chaque alerte, le nombre de rappels push avant l'envoi de SMS de secours. Le push reste le canal principal ; le SMS est une escalade et non le canal normal.

**Données à figer avec la création atomique de l'alerte :** seuil de rappels choisi par l'auteur ; compteur serveur des occurrences de rappels push déjà planifiées ; destinataires issus de l'instantané initial ; état d'escalade SMS normalisé (non dû, dû, en attente, accepté, livré si confirmé, échoué, ambigu ou annulé).

**Règles de séquencement :**
1. La notification push initiale n'entre pas dans le compteur des rappels.
2. Les rappels push suivants sont espacés de cinq minutes selon le scheduler serveur.
3. Chaque occurrence est créée une seule fois par alerte, destinataire, canal et numéro de séquence.
4. Lorsque le nombre de rappels choisi est atteint, le serveur vérifie dans l'état métier courant si un responsable principal est attribué.
5. Si aucun responsable principal n'existe, les tâches SMS de secours peuvent être créées pour les destinataires initiaux, de façon idempotente.
6. Si un responsable principal est attribué avant la création des tâches SMS, l'escalade est annulée. Si l'attribution concurrence le scheduler, l'opération atomique doit établir un ordre déterministe : aucune tâche SMS ne doit être créée après une prise en charge déjà validée.
7. Un accusé de réception ou une candidature volontaire seule ne bloque pas l'escalade.
8. Les rappels push continuent selon la règle existante jusqu'à clôture par l'auteur, même si un contact a accusé réception ou pris la responsabilité.
9. La clôture annule toutes les tâches push/SMS encore en attente ; un envoi déjà accepté par un fournisseur peut encore être livré.

**Destinataires :** uniquement l'instantané initial. Aucun ajout de contact au moment de l'escalade.

**Choix utilisateur :** le seuil est configuré par le lanceur pour chaque alerte. La plage minimale/maximale, la valeur par défaut et le traitement d'une valeur manquante doivent être arbitrés avant l'interface et l'API ; ne pas inventer une plage en backend.

**Tests D1 obligatoires :** notification initiale exclue du compteur ; seuil atteint exactement une fois malgré deux workers concurrents ; prise en charge avant le seuil, juste au seuil et en concurrence avec la création SMS ; accusé seul et candidature seule n'empêchent pas le SMS ; prise en charge annule les SMS non encore créés/en attente selon état ; clôture annule les tâches non envoyées ; tâche déjà acceptée reste marquée comme potentiellement livrable ; aucune tâche vers un contact absent de l'instantané ; retry/rejeu ne crée pas de doublon ni ne remet le compteur à zéro.

**Limite :** un rappel planifié n'est pas une garantie de livraison push. L'escalade est fondée sur le nombre d'occurrences push du calendrier serveur et l'absence de responsable principal, pas sur une prétendue preuve que le téléphone n'a pas reçu la notification.


## 17. Contrat proposé — coordination multi-contact et courses concurrentes (à valider)

Ce contrat complète les opérations de candidature, attribution, retrait et clôture. Il ne vaut pas autorisation de créer une migration ou une API avant validation du schéma et des décisions produit.

### 17.1 Commandes et autorisations

- `submit_volunteer(alert_id, idempotency_key)` : destinataire de l'instantané initial, relation et accès encore admissibles, alerte active.
- `report_arrival(alert_id, idempotency_key)` : destinataire autorisé ; enregistre une déclaration « arrivé sur place » sans modifier le responsable ni l'état de l'alerte.
- `report_resolution(alert_id, idempotency_key, note?)` : destinataire autorisé ; enregistre une déclaration de résolution sans clôturer.
- `withdraw_primary(alert_id, idempotency_key)` : responsable principal courant uniquement ; termine sa période et promeut le volontaire admissible suivant dans la même transaction, ou laisse l'alerte sans responsable.
- `close_alert(alert_id, idempotency_key, reason?)` : auteur de l'alerte uniquement ; transition conditionnelle active vers clôturée.

Le responsable principal peut envoyer un compte rendu informatif, mais aucun droit de clôture ne lui est accordé. Aucun contact ne peut clôturer, même s'il déclare avoir résolu le problème ou être arrivé sur place.

### 17.2 Séquence atomique d'attribution

Dans une transaction D1 :
1. vérifier l'existence de l'alerte, son état actif, l'appartenance du contact à l'instantané et ses droits courants ;
2. vérifier la clé d'idempotence et retourner le résultat déjà enregistré si elle a été utilisée ;
3. enregistrer la candidature avec une séquence monotone serveur ;
4. si l'alerte est `unassigned`, effectuer une mise à jour conditionnelle qui attribue le rôle et ouvre la période ; sinon conserver la candidature comme non retenue ;
5. enregistrer l'événement append-only et le résultat idempotent ;
6. créer dans l'outbox les notifications utiles uniquement après que le résultat d'attribution soit déterminé ;
7. commit.

La contrainte de données doit empêcher plus d'une période principale ouverte par alerte. Une contrainte applicative seule ne suffit pas. Deux transactions concurrentes ne peuvent jamais toutes deux réussir l'attribution.

### 17.3 Retrait et promotion

Le retrait du responsable courant, la fermeture de sa période, la sélection du prochain volontaire admissible et l'ouverture de sa période doivent être une seule transaction. Le prochain volontaire est le plus ancien selon la séquence d'acceptation serveur ; les candidatures retirées, révoquées ou devenues inadmissibles sont ignorées. En l'absence de volontaire, l'alerte reste active et `unassigned`.

Une candidature concurrente au retrait est sérialisée par la base : elle est prise en compte si elle est validée dans l'ordre transactionnel avant la sélection, sinon elle reste candidate pour une attribution ultérieure selon la règle retenue. Aucun téléphone ne choisit lui-même le gagnant.

### 17.4 Arrivée et résolution déclarées

`report_arrival` et `report_resolution` sont des événements informatifs append-only. Ils ne modifient ni le responsable, ni le statut actif/clôturé, ni les tâches de rappel, ni l'échéance SMS. Le serveur vérifie que l'alerte est active au moment du commit et que l'acteur est un destinataire autorisé.

Le contenu utilisateur éventuel doit être limité, nettoyé et soumis à une politique de conservation à définir. Ne pas enregistrer de coordonnées GPS précises dans ces déclarations. Une déclaration de résolution ne constitue pas une preuve indépendante de résolution.

### 17.5 Course entre clôture et action d'un contact

Toutes les opérations contact commencent par une vérification conditionnelle de l'état actif dans la transaction. La clôture auteur utilise une transition conditionnelle de même nature. L'ordre de commit établit l'ordre canonique :
- si l'action contact commit avant la clôture, son événement est conservé puis la clôture termine l'alerte ;
- si la clôture commit en premier, l'action contact est rejetée comme action sur alerte clôturée ;
- aucune opération contact ne peut remettre une alerte clôturée à active.

La clôture annule les tâches non envoyées et les notifications en attente selon le contrat outbox existant ; les envois déjà acceptés par un fournisseur peuvent encore arriver.

### 17.6 Journal, notifications et idempotence

Chaque mutation métier ajoute un événement immuable avec acteur, type, horodatage serveur, séquence serveur et clé d'idempotence. Les notifications sont créées dans l'outbox dans la transaction métier, puis envoyées après commit. Une notification de responsable principal n'est émise qu'après attribution effective ; les autres contacts ne reçoivent que les informations de coordination nécessaires, sans numéro, e-mail ou coordonnées privées d'un tiers.

**Tests D1 obligatoires avant production :**
- 2, 5 et 10 candidatures simultanées : une seule attribution principale ;
- deux retraits/candidatures simultanés : une seule période ouverte et succession déterministe ;
- arrivée et déclaration de résolution simultanées : événements distincts, aucun changement d'état ;
- déclaration « résolu » par un contact : aucun effet de clôture ni arrêt des rappels/SMS ;
- responsable principal qui tente de clôturer : refus d'autorisation ;
- clôture auteur concurrente à candidature, arrivée, résolution et retrait : ordre de commit cohérent, aucune action après clôture ;
- rejeu d'une même clé : un seul événement et un seul effet ;
- panne avant commit / après commit avant envoi outbox : pas de perte ni doublon métier ;
- révocation concurrente à une action : résultat conforme à la règle d'accès retenue.

**Statut : proposition de contrat à valider.** Aucun endpoint, table, migration, scheduler ou envoi réel n'est créé ici.


## 18. Contrat proposé — révocation concurrente à la coordination SOS (à valider)

La relation de confiance, les candidatures et les périodes de responsabilité doivent être arbitrées dans un ordre transactionnel unique. Une vérification de relation effectuée avant la transaction ne constitue pas une preuve d'admissibilité.

### 18.1 Invariant d'autorisation

Toute commande de candidature, attribution, promotion, arrivée déclarée, résolution signalée, accusé ou retrait doit vérifier la relation active dans la même transaction D1 que l'écriture métier. Le contrôle s'applique aussi aux workers qui promeuvent un volontaire.

### 18.2 Ordre de concurrence

- **Révocation commit en premier :** toute candidature ou attribution ultérieure du contact est refusée ; une candidature antérieure non encore attribuée devient inadmissible.
- **Candidature commit en premier :** l'événement de candidature reste dans le journal, mais la révocation la rend inadmissible pour les attributions futures.
- **Attribution commit en premier :** l'attribution est conservée dans l'historique ; la transaction de révocation termine la période active du contact révoqué et tente une promotion atomique du volontaire admissible suivant.
- **Révocation et promotion concurrentes :** la transaction de promotion doit relire et verrouiller/logiquement sérialiser la relation active du candidat au moment du commit. Si la relation est révoquée avant le commit de promotion, le candidat est ignoré et le suivant est examiné.
- **Aucun candidat admissible :** état `unassigned`, alerte toujours active, rappels régis par le contrat existant.

Le résultat final exigé est qu'aucun contact dont la relation est révoquée ne puisse être responsable principal après le commit de cette révocation.

### 18.3 Transaction de révocation

La transaction doit :
1. vérifier que l'acteur est autorisé à révoquer cette relation et que la relation est encore active ;
2. enregistrer la révocation avec horodatage et séquence serveur ;
3. invalider les autorisations futures du contact pour cette relation ;
4. rendre inadmissibles ses candidatures non attribuées ;
5. si ce contact est responsable principal, fermer sa période avec cause `relationship_revoked` et promouvoir atomiquement le volontaire actif admissible le plus ancien, ou laisser l'alerte `unassigned` ;
6. enregistrer les événements append-only et les résultats idempotents ;
7. produire les notifications de coordination après commit, sans révéler de données privées.

Si la révocation est rejouée avec la même clé d'idempotence, retourner le résultat initial sans fermer une seconde période ni promouvoir un autre volontaire.

### 18.4 Limites non tranchées

Ce contrat ne décide pas encore si le destinataire révoqué conserve un accès en lecture à une alerte active, ni si les rappels push déjà prévus continuent à lui être transmis. Ces règles doivent être décidées explicitement et harmonisées avec l'instantané initial, les exigences de confidentialité et l'outbox. Ne pas modifier silencieusement les rappels existants.

**Tests D1 obligatoires :** révocation avant candidature ; révocation après candidature mais avant attribution ; révocation juste après attribution ; révocation concurrente à la promotion ; révocation du premier candidat avec deuxième volontaire disponible ; révocation sans volontaire de remplacement ; rejeu idempotent ; révocation concurrente à clôture auteur ; aucun double responsable ni période ouverte orpheline.
