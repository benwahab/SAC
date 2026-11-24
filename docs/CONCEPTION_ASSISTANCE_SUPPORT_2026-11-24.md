# SAC — Conception du module Assistance et support

**Date :** 24 novembre 2026  
**Dépôt :** `benwahab/SAC` — branche `main`  
**Statut :** premier lot de tickets connecté au code ; migration 0021 et API créées dans le dépôt, validation CI en cours ; aucune migration distante appliquée.

## 1. Objectif et séparation

Le module Assistance traite les demandes volontaires d'aide liées à l'utilisation de SAC : difficulté de connexion, compte, appareil, notifications, facturation future, question générale, réclamation ou incident technique.

Il ne constitue pas un centre de supervision SOS. Une demande d'assistance ne crée jamais une alerte SOS et une alerte SOS ne devient jamais un ticket de support.

Le Support ne reçoit aucun droit général de consultation des alertes, de leurs destinataires, des proches, des messages privés, des événements nominatifs ou des coordonnées GPS.

## 2. Périmètre initial

Le premier lot fonctionnel devra couvrir :
- création d'une demande par l'utilisateur depuis un parcours d'assistance dédié ;
- référence de ticket non prédictible et date de création ;
- catégories : compte/connexion, application/appareil, notifications, paiement/facturation (lorsque ce service existe), question générale, réclamation, incident technique ;
- sujet et description saisis volontairement par le demandeur ;
- priorité calculée selon une règle documentée ou fixée par le Super Admin, jamais présentée comme un niveau d'urgence SOS ;
- statuts : nouveau, ouvert, en attente du demandeur, en attente interne, résolu, clôturé ;
- affectation à un collaborateur autorisé par mission ;
- fil de réponses du demandeur et du support ;
- historique des changements d'état, affectations et accès ;
- clôture et réouverture selon une politique à définir ;
- indicateurs agrégés dans le dashboard.

Le centre d'aide public (articles et FAQ) pourra être ajouté dans un lot séparé, avec publication contrôlée.

## 3. Modèle de données candidat — à harmoniser avant migration

Les noms suivants sont des propositions, pas des tables existantes :

### `support_tickets`
- `id` : identifiant opaque ;
- `public_reference` : référence aléatoire, unique et non séquentielle ;
- `requester_account_id` : compte demandeur, nullable uniquement si un parcours sans compte est explicitement validé ;
- `category`, `subject`, `description` ;
- `status` : valeurs contrôlées définies ci-dessus ;
- `priority` : normal, élevé ou critique support, sans équivalence avec les niveaux SOS ;
- `assigned_account_id` : collaborateur affecté, nullable ;
- `created_at`, `updated_at`, `resolved_at`, `closed_at` ;
- `version` pour les mutations concurrentes.

### `support_messages`
- `id`, `ticket_id`, `author_account_id` ;
- `author_kind` : demandeur ou support ;
- `body` ;
- `created_at`, `edited_at` ;
- pièces jointes exclues du premier lot, le temps de définir analyse antivirus, limites, stockage privé, durée de conservation et accès.

### `support_ticket_events`
- `id`, `ticket_id`, `actor_account_id` ;
- `event_type`, `previous_value`, `new_value`, `reason`, `occurred_at` ;
- journal append-only, sans contenu de message ni secret.

Indexes envisagés : statut/date, assignation/statut, demandeur/date, référence publique unique et messages par ticket/date. Les contraintes de clés étrangères et de suppression doivent préserver l'historique utile et respecter le cycle de vie des comptes.

Ces tables doivent être comparées au schéma D1 réel et au modèle documentaire commun avant toute migration. Ne pas créer une table séparée si une entité commune existante couvre déjà le besoin.

## 4. Permissions et accès

- Le Super Admin peut consulter et administrer tous les tickets de support.
- Un collaborateur Support ne voit que les tickets correspondant à sa mission et à son périmètre ; les contrôles sont côté serveur à chaque requête.
- Permissions distinctes recommandées : `support.read`, `support.reply`, `support.assign`, `support.resolve`, `support.export`.
- Le droit d'export est désactivé par défaut et séparé du droit de lecture.
- Les collaborateurs ne peuvent pas attribuer des missions ni élargir leurs propres permissions.
- Les accès à un ticket, les recherches, les réponses, les changements d'état et les exports sont journalisés.
- Une lecture exceptionnelle d'un champ personnel doit être justifiée par le ticket et limitée au strict nécessaire.

## 5. Cloisonnement des données citoyennes

Le Support peut recevoir uniquement :
- la référence du ticket ;
- les coordonnées de contact nécessaires au suivi, masquées par défaut lorsque possible ;
- les informations volontairement communiquées dans le ticket ;
- les métadonnées minimales de diagnostic non sensibles.

Le Support ne peut pas consulter :
- contenu, niveau, localisation ou chronologie privée d'une alerte SOS ;
- liste des proches et destinataires ;
- messages privés de la fonction SOS ;
- GPS précis ou historique de trajets ;
- OTP, mots de passe, jetons, clés ou secrets de récupération.

Si un utilisateur mentionne une urgence dans un ticket, l'interface doit lui indiquer que le support n'est pas un service d'urgence et orienter vers le parcours SOS approprié, sans créer ou modifier une alerte automatiquement.

## 6. Règles opérationnelles

- Une demande créée n'est pas automatiquement considérée comme prise en charge.
- Une réponse du support ne clôture pas automatiquement le ticket.
- La résolution et la clôture sont deux événements distincts.
- Les délais de réponse (SLA), horaires, escalades, réouverture et notifications restent à définir avant activation.
- Les pièces jointes sont exclues du premier lot.
- Les données de ticket sont conservées selon une politique dédiée, avec purge et anonymisation documentées avant mise en production.

## 7. Interfaces prévues

### Côté utilisateur
- entrée « Aide et assistance » distincte du bouton SOS ;
- création de ticket avec explication claire du périmètre ;
- consultation de ses propres demandes et réponses ;
- notifications de réponse et de changement d'état.

### Console professionnelle
- compteurs agrégés : nouveaux, ouverts, en attente, résolus ;
- file de tickets filtrable par état, catégorie et priorité ;
- détail d'un ticket avec fil de messages ;
- affectation, réponse, changement d'état et historique selon permission ;
- aucun affichage de données SOS dans la fiche de support.

## 8. Conditions avant développement des API

Avant l’activation complète, confirmer :
1. la politique finale de récupération de compte (le ticket OTP actuel ne réinitialise pas les accès) ;
2. les catégories et statuts définitifs ;
3. les règles de priorité et les délais de traitement ;
4. les rôles Support et leurs missions exactes ;
5. la durée de conservation et les notifications ;
6. le modèle de pièces jointes (ou leur exclusion définitive).

Le premier lot a été codé dans `migrations/0021_support_tickets.sql`, `functions/api/support/tickets.ts`, `functions/api/support/tickets/[ticketId].ts`, `functions/api/support/tickets/[ticketId]/messages.ts`, `functions/api/admin/support/index.ts`, `functions/api/admin/support/[ticketId].ts` et `functions/api/admin/support/[ticketId]/messages.ts`. Les API actuelles permettent la création authentifiée, la consultation du ticket par son propriétaire, les réponses et la supervision/gestion par le Super Admin. Le parcours de support « accès au compte » accepte désormais une demande sans session après vérification OTP de l’adresse e-mail. Il ne réinitialise pas le mot de passe et n'ouvre pas le compte : il crée uniquement un ticket lié à un compte actif correspondant. Les autres demandes nécessitent une session authentifiée. Les affectations aux délégués, les SLA, notifications et pièces jointes restent hors de ce lot. Les migrations 0021 et 0022 sont locales au dépôt/CI et ne doivent pas être appliquées à la D1 distante sans autorisation explicite. Le flux sans session reste fermé tant que SUPPORT_INTAKE_ENABLED n'est pas explicitement activé après migration, configuration e-mail et tests.


## Extension — accès des collaborateurs par mission (24 novembre 2026)

Les API de la file, du détail, des changements de statut et des réponses acceptent désormais le Super Admin ou un collaborateur muni d'une mission active de périmètre exact `support`. La lecture exige la permission `read`; le traitement et les réponses exigent simultanément `read` et `process`. Les permissions sont relues dans D1 à chaque requête et l'échéance est vérifiée côté serveur. Les événements d'audit associent l'identifiant de mission et le périmètre. Le trigger D1 de la table des messages impose également une mission Support active avec `process` pour une réponse de collaborateur. Cette protection est ajoutée par la migration 0023 et doit être appliquée dans chaque environnement avant d'utiliser les réponses déléguées. La D1 distante n'est pas modifiée.
