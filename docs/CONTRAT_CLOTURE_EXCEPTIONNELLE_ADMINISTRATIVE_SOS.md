# SAC — Contrat de clôture exceptionnelle administrative d'une alerte SOS

**Date :** 18 novembre 2026  
**Statut :** formalisation d'une exception déjà validée par le propriétaire du projet ; aucune nouvelle autorité n'est créée.  
**Portée :** clôture d'une alerte SOS déjà déclenchée lorsque le titulaire est suspendu dans le scénario exceptionnel décrit ci-dessous.  
**Référence de priorité :** ce contrat précise l'exception à la règle générale de clôture par l'auteur. Il ne transforme pas l'administration en autorité générale de clôture.

## 1. Règle générale

Une alerte SOS déclenchée est normalement clôturée par son auteur. Un proche, destinataire, responsable principal, opérateur technique, support, auditeur, worker ou administrateur sans habilitation nominative ne peut pas la clôturer.

L'exception ci-dessous est étroite, conditionnelle et auditable. Elle ne doit jamais être interprétée comme une permission générale de clôturer les alertes des utilisateurs.

## 2. Conditions cumulatives de l'exception

La clôture administrative n'est permise que lorsque toutes les conditions suivantes sont réunies :

1. L'alerte existe déjà et est toujours active.
2. Le compte de l'auteur est à l'état pending status: suspended.
3. Le cas correspond au scénario exceptionnel validé : suspicion d'abus ou perte/compromission du téléphone du titulaire.
4. L'action est effectuée soit par le Super Admin, soit par un Administrateur sécurité auquel le Super Admin a attribué explicitement la permission nominative dédiée à la clôture exceptionnelle.
5. Les vérifications préalables prévues ont été effectuées et consignées.
6. La décision et son motif sont enregistrés dans une trace d'audit minimale.

Si une condition manque, la clôture administrative est refusée. L'absence de réponse du titulaire, d'un proche ou d'un destinataire ne constitue jamais une preuve que le danger est terminé.

## 3. Autorité et délégation

- Le Super Admin détient l'autorité de clôture exceptionnelle.
- Un Administrateur sécurité ne peut agir que si le Super Admin lui a attribué explicitement la permission dédiée.
- Seul le Super Admin peut attribuer, modifier, suspendre ou retirer cette permission.
- Le délégataire ne peut ni transmettre cette permission, ni la déléguer, ni modifier son propre périmètre.
- Une seule personne habilitée suffit ; aucune double validation n'est exigée par la règle validée.
- Le support, l'auditeur, les proches, les destinataires et le titulaire suspendu n'ont pas cette autorité.
- Le titulaire suspendu peut uniquement demander la clôture dans ce scénario ; il ne peut pas l'exécuter lui-même par un accès général ou un accès d'urgence restreint.

## 4. Vérifications et contact du titulaire

La séquence de contact documentée avant décision comprend, lorsque le numéro déclaré et les canaux sont disponibles :

- une notification privée initiale via SAC ;
- jusqu'à trois tentatives d'appel : immédiatement, environ cinq minutes plus tard, puis environ cinq minutes après la deuxième ;
- un message écrit privé complémentaire par un canal disponible ;
- la journalisation de chaque tentative avec date/heure, canal, résultat objectif et identité de l'administrateur.

Un appel sans réponse, un message vocal, un accusé technique, l'absence de canal ou le silence du titulaire ne prouve jamais que le danger est terminé et ne déclenche aucune clôture automatique.

Les éléments vérifiés et le seuil permettant de conclure que la clôture exceptionnelle est justifiée doivent être consignés. **Le critère métier exact de suffisance des preuves reste à spécifier avant implémentation** ; il ne doit pas être inventé par le développeur ou déduit du seul nombre d'appels.

Pendant les vérifications, l'alerte reste active et les rappels continuent vers les destinataires initiaux conformément aux règles SOS. La clôture arrête ensuite les rappels et déclenche les règles normales de notification de clôture administrative.

## 5. Effets métier de la clôture

Une clôture administrative valide produit le même état terminal d'alerte et les mêmes effets de conservation qu'une clôture autorisée par l'auteur :

- l'alerte passe une seule fois d'active à clôturée ;
- les tâches de rappel non envoyées sont annulées ; une livraison déjà acceptée par un fournisseur peut encore arriver ;
- chaque destinataire initial reçoit individuellement une notification limitée à la confirmation de clôture administrative et à sa date/heure, via les canaux SAC disponibles et activés ;
- les accusés, interventions et événements antérieurs sont conservés dans la chronologie selon la politique de conservation applicable ;
- toutes les positions GPS précises liées à l'alerte sont supprimées immédiatement à la clôture ;
- seule la catégorie/nature reste 30 jours, puis l'entrée et sa catégorie sont supprimées définitivement à J+30, sans résurrection par restauration.

L'exception ne donne aucun droit de consulter d'autres alertes, le compte complet, les conversations privées, les positions GPS après clôture ou les données sans rapport avec l'alerte concernée.

## 6. Trace d'audit minimale

La décision doit enregistrer au minimum :

- identité de l'administrateur qui a agi ;
- preuve que la permission dédiée était active au moment de l'action ;
- référence opaque de l'alerte ;
- date et heure serveur ;
- motif codifié ;
- éléments vérifiés et référence aux tentatives de contact ;
- résultat de la décision ;
- référence de corrélation de l'opération de clôture.

Ne jamais inscrire dans le journal : coordonnées GPS précises, mots de passe, OTP, jetons bruts, clés privées, secrets de récupération ou contenu complet de messages privés. Les notes internes éventuelles doivent être séparées, protégées et soumises à la politique d'accès et de conservation validée.

## 7. Contrôle technique obligatoire avant implémentation

Le contrôle doit être réalisé côté serveur, sur l'état persistant, au moment de l'opération atomique :

1. authentifier l'administrateur ;
2. vérifier son rôle et son périmètre ;
3. vérifier que la permission nominative est actuellement attribuée par le Super Admin et non révoquée ;
4. vérifier que l'auteur est suspendu et que l'alerte est toujours active ;
5. vérifier que le scénario et les éléments préalables sont consignés ;
6. consommer atomiquement la transition de clôture afin que deux clôtures concurrentes ne produisent qu'un seul résultat ;
7. déclencher les effets de rappel, notification et purge GPS prévus ;
8. enregistrer l'événement d'audit.

L'interface d'administration est réservée à l'ordinateur et à la tablette ; aucun parcours d'administration sur téléphone n'est prévu.

Le module actuel src/domain/alert-lifecycle.ts ne modélise que closed_by_author et rejette un acteur autre que l'auteur. Il ne représente donc pas encore cette exception validée. Le module actuel est un contrat pur, pas une autorisation serveur. Avant toute migration ou API, il faudra aligner le modèle de domaine et ses tests sans élargir la permission.

## 8. Tests d'acceptation

- auteur actif : clôture normale par l'auteur autorisée ;
- auteur suspendu hors scénario exceptionnel : clôture administrative refusée ;
- administrateur sans permission dédiée : refus ;
- permission révoquée ou suspendue : refus ;
- délégataire tentant de transmettre la permission : refus ;
- support, auditeur, proche, destinataire ou responsable principal : refus ;
- titulaire suspendu tentant de clôturer lui-même : refus ;
- alerte déjà clôturée : seconde clôture idempotente sans second événement ni effets répétés ;
- compte auteur non suspendu : exception administrative refusée ;
- absence de preuve suffisante ou vérifications non consignées : refus ;
- silence du titulaire ou appels sans réponse : aucune clôture automatique ;
- deux administrateurs concurrents : une seule transition et une seule notification de clôture ;
- rappels non envoyés annulés après clôture ;
- notifications individuelles minimales ;
- GPS supprimé immédiatement à la clôture, y compris les copies gérées par SAC ;
- catégorie seule conservée 30 jours, puis purge totale à J+30 sans restauration possible ;
- audit sans GPS, secrets, OTP ni contenu privé.

## 9. Limites et décisions encore ouvertes

Ce contrat ne fixe pas le critère métier final de suffisance des preuves, les catégories détaillées de motif, la durée de conservation des traces administratives ni le mécanisme indépendant de scellement du journal. Ces points doivent être validés avant implémentation.

Aucune permission opérationnelle, route API, session spéciale, migration D1, ressource Cloudflare ou déploiement n'est créée par ce document.
