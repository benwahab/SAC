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
- relations et préférences des contacts actives au moment du déclenchement ;
- aucune coordonnée GPS précise ne doit être écrite dans D1.

**Effets qui doivent être cohérents :**
1. créer une alerte active ;
2. figer la liste des destinataires éligibles ;
3. créer l'événement initial ;
4. créer les tâches initiales de notification, une par destinataire/canal selon la politique retenue ;
5. enregistrer le résultat d'idempotence.

**Concurrence :**
- deux requêtes avec la même clé d'idempotence ne créent qu'une alerte ;
- une relation révoquée avant la transition finale ne peut pas être utilisée pour une nouvelle alerte ;
- une modification concurrente des préférences doit avoir une règle d'ordre déterministe : l'instantané reflète un état cohérent au moment de la création.

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

## 6. Contrat — annulation ou clôture par l'auteur

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
