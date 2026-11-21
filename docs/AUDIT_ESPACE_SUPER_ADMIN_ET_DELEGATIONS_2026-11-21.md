# SAC — Audit de l'espace Super Admin et des missions déléguées

**Date : 21 novembre 2026**  
**Dépôt :** `benwahab/SAC` — branche unique `main`  
**Statut :** audit du code existant et des décisions produit déjà validées.

## 1. Décisions produit à respecter

- L'espace d'administration est réservé au Super Admin et aux collaborateurs auxquels une mission a été explicitement attribuée.
- Le tableau de bord d'administration est accessible uniquement sur ordinateur ou tablette. Il ne doit jamais apparaître ni être accessible depuis l'interface mobile citoyenne.
- Le Super Admin est l'unique autorité qui peut créer, attribuer, modifier, suspendre ou retirer une mission/délégation.
- Un délégué ne peut jamais créer une autre délégation, transmettre sa mission, attribuer des tâches ou augmenter ses propres permissions.
- Une mission est limitée à un périmètre et à des tâches précis. Les permissions sont indépendantes et accordées seulement si elles sont explicitement cochées : consulter, créer, modifier, traiter, exporter et supprimer.
- Une échéance peut être associée à une mission. La révocation ou la suspension doit couper immédiatement les accès correspondants.
- Toute action administrative doit laisser une trace append-only contenant au minimum l'acteur, l'action, le périmètre, l'horodatage, le résultat, la permission utilisée et l'appareil.

## 2. Constat vérifié dans le dépôt

### Interface

Le routeur de `src/App.tsx` ne reconnaît actuellement que les parcours publics, la connexion, l'acceptation d'invitation et l'espace privé citoyen. Il n'existe pas de route d'administration dédiée dans ce routeur.

Les écrans de `src/private/` concernent le compte citoyen, les proches, le SOS, l'historique et les réglages. Ils ne constituent pas un tableau de bord Super Admin.

### API et autorisations

Aucun parcours d'administration Super Admin n'a été trouvé dans les routes actuellement examinées. Les contrôles de session existants authentifient un compte et un appareil, mais ne prouvent pas à eux seuls un rôle Super Admin ni une délégation.

Le test `tests/acl-ude-contract-model.test.ts` décrit un modèle de journal de sécurité simulé. Son propre commentaire précise qu'il ne constitue ni un client Azure, ni un émulateur CCF, ni une preuve RBAC ou cryptographique. Il ne doit donc pas être présenté comme un journal administratif de production.

### Identité initiale du Super Admin

Aucun compte, adresse e-mail ou mécanisme d'initialisation du Super Admin n'a été explicitement désigné. Aucun compte ne doit être promu automatiquement sur la base de son ordre de création, de son adresse supposée ou de la possession d'une session citoyenne.

## 3. Travaux nécessaires

1. Définir un mécanisme de bootstrap contrôlé pour désigner le compte Super Admin initial, sans auto-promotion par le premier inscrit.
2. Ajouter un modèle de rôles et de permissions côté serveur, indépendant des écrans et jamais contrôlé par le navigateur.
3. Créer les tables D1 pour les missions, leurs périmètres, permissions, échéances, états, versions et événements d'audit append-only.
4. Créer les API Super Admin pour créer, attribuer, modifier, suspendre, reprendre et retirer une mission.
5. Créer les API déléguées en lecture/écriture strictement limitée au périmètre et aux permissions accordées. Aucune API de délégation ne doit être accessible à un délégué.
6. Garantir côté serveur qu'une suspension, une échéance ou une révocation bloque immédiatement les nouvelles requêtes, y compris si un écran reste ouvert.
7. Construire l'interface « Missions et délégations » pour ordinateur/tablette, avec masquage mobile comme amélioration d'interface uniquement ; le serveur doit aussi refuser les opérations non autorisées.
8. Ajouter les tests d'isolation entre comptes, d'élévation de privilèges, de délégation en cascade, de révocation immédiate, d'expiration, de concurrence et d'immutabilité du journal.
9. Ajouter une consultation et un export du journal réservés aux permissions explicitement accordées, sans permettre sa modification ou sa suppression.

## 4. Invariants de sécurité

- Cacher un bouton ou une route sur mobile n'est jamais une mesure d'autorisation suffisante.
- Le rôle Super Admin est vérifié à chaque opération sensible côté serveur.
- Les permissions d'une mission sont positives et explicites : absence de permission = refus.
- Les permissions ne sont jamais héritées implicitement d'un rôle de confort ou d'une mission antérieure.
- Un délégué ne peut ni modifier son propre périmètre ni attribuer des permissions à autrui.
- Les journaux d'audit sont append-only ; les corrections se font par un nouvel événement, jamais par réécriture.
- Une mission suspendue, expirée ou révoquée ne donne plus aucun accès opérationnel.
- Les tests ne déclenchent aucun vrai SOS, push ou SMS.

## 5. Point de blocage avant l'implémentation administrative

Le seul arbitrage d'identité indispensable qui manque est le compte qui recevra le rôle Super Admin initial. Il faut le désigner explicitement avant de créer la procédure de bootstrap et les droits d'administration.

Aucune promotion de compte, migration D1, route d'administration ou interface Super Admin n'a été ajoutée par cet audit.
