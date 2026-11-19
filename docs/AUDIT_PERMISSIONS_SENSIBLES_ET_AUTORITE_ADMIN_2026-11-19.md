# SAC — Audit des permissions sensibles et de l'autorité administrative

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** audit documentaire et statique ; aucun code, schéma, rôle ou permission modifié.

## 1. Périmètre consulté

- `docs/MATRICE_AUTORISATION_ROLES.md`
- `docs/GOUVERNANCE_MISSIONS_ADMIN_ET_CYCLE_DE_VIE.md`
- `docs/CONTRATS_OPERATIONS_ADMIN_ATOMIQUES.md`
- `docs/MODELE_MENACES_ET_PLAN_SECURITE_ADMIN.md`
- `functions/api/alerts/[alertId].ts`
- `functions/api/alerts/[alertId]/close.ts`
- `functions/api/alerts/[alertId]/respond.ts`
- `functions/api/contacts/revoke.ts`
- `functions/api/push/subscriptions.ts`
- `functions/api/auth/complete-root-enrollment.ts`
- `functions/api/auth/root-enrollment-options.ts`
- `src/domain/session-authorization.ts`
- `src/domain/device-management.ts`

## 2. Constat principal — gouvernance administrative spécifiée, mais non opérationnelle

Les documents définissent correctement plusieurs invariants :
- refus par défaut ;
- identité et appareil issus de la session serveur ;
- aucun rôle ou périmètre accepté depuis le navigateur ;
- le Super Admin est l'unique autorité de création, attribution, modification, suspension, reprise et révocation des missions/délégations ;
- un délégataire ne peut ni déléguer à son tour, ni créer un administrateur, ni élargir ses propres droits ;
- les permissions sont atomiques, limitées à une mission, une ressource et un périmètre ;
- toute opération sensible doit être auditée dans la même frontière transactionnelle que la mutation.

Toutefois, dans l'arborescence des routes `functions/api` consultée, aucune API d'administration, de gestion de missions/délégations, de gestion de rôles, de suspension administrative de compte ou de journal d'audit administratif n'a été identifiée. Les documents de gouvernance le disent eux-mêmes : ils sont des contrats de conception et ne créent aucune permission ni API opérationnelle.

**Conclusion :** ne pas présenter l'espace Super Admin, les délégations ou les missions comme des fonctions de sécurité déjà actives. Leur modèle est documenté, mais leur chaîne d'autorisation serveur reste à construire.

## 3. Autorité racine et appareils secondaires

Le contrat produit impose que seul le Super Admin contrôle les délégations et que seul l'appareil racine actif puisse approuver un nouvel appareil secondaire. Ces deux autorités sont distinctes :
- le Super Admin exerce l'autorité métier sur les missions et délégations ;
- l'appareil racine exerce l'autorité cryptographique d'approbation des appareils du compte.

Un appareil secondaire ne doit jamais hériter de l'autorité cryptographique de la racine ni pouvoir s'accorder des privilèges administratifs. Une session valide prouve une identité de session ; elle ne suffit pas à elle seule à accorder une permission administrative.

Le code consulté comporte des contrats purs pour les transitions d'appareil et l'autorisation de session. Ils ne remplacent pas une vérification serveur de la racine, de sa preuve cryptographique, de l'état de mission et de la permission au moment du commit.

## 4. Routes métier présentes : contrôles observés et limites

### Alertes SOS
Les routes de détail, de réponse et de clôture appellent le garde de session appareil et transmettent au service l'identifiant de compte authentifié. La clôture exposée par `functions/api/alerts/[alertId]/close.ts` est une clôture par l'auteur via `closeSosAlertByAuthor`, et non une clôture administrative. Aucun droit de Super Admin ne doit être supposé par cette route.

### Contacts
La route `functions/api/contacts/revoke.ts` prend l'identité du propriétaire depuis la session et l'identifiant du contact depuis le corps de requête. Le service doit continuer à vérifier la relation appartenant à ce propriétaire ; le simple identifiant du contact ne doit jamais suffire à agir sur une relation tierce.

### Push
La route `functions/api/push/subscriptions.ts` lie l'abonnement au compte et à l'appareil issus de la session. C'est le bon principe : le client ne choisit pas le compte ou l'appareil auquel rattacher l'abonnement. La révocation complète d'un appareil doit néanmoins invalider toutes ses sessions et ses abonnements au niveau serveur ; la suppression d'un abonnement Push n'est pas une révocation d'appareil.

## 5. Risques et priorités

### P0 — ne pas créer de privilège administratif avant sa source d'autorité
Aucune permission administrative ne doit être activée via un champ de profil, un rôle envoyé par le client, une adresse e-mail, un identifiant connu ou une condition d'interface. Il faut une source d'autorité serveur unique, une authentification renforcée et une procédure de bootstrap du Super Admin explicitement revue.

### P0 — séparer les autorités métier et cryptographique
Une permission Super Admin ne doit pas permettre de forger une approbation cryptographique de nouvel appareil. Inversement, posséder l'appareil racine ne doit pas conférer le rôle Super Admin ni permettre de déléguer des missions.

### P1 — implémenter les permissions par opération
Chaque commande administrative doit recharger au commit : acteur, statut du compte, session/appareil, rôle, mission active, permission atomique, périmètre, ressource et version attendue. Les tâches différées et téléchargements doivent refaire ces contrôles avant leur effet.

### P1 — audit append-only effectif
Le journal d'audit doit être écrit côté serveur, append-only, protégé contre l'altération par l'acteur concerné, et transactionnel avec les mutations sensibles. Le document de conception ne prouve pas encore l'existence de ce mécanisme.

### P1 — tests négatifs indispensables
- utilisateur ordinaire appelant directement une route administrative ;
- délégataire tentant de créer ou modifier une mission ;
- délégataire tentant de transmettre une permission ;
- mission expirée, suspendue ou révoquée utilisée avec une ancienne session ;
- permission valide mais ressource hors périmètre ;
- secondaire tentant d'approuver un autre appareil ;
- appareil racine tentant d'attribuer une mission sans rôle Super Admin ;
- révocation concurrente avec une commande administrative ;
- échec de l'écriture d'audit ;
- rejeu d'une commande sensible et conflit de version.

## 6. Ordre de construction recommandé

1. Résoudre d'abord le modèle D1 des appareils relevé dans l'audit du cycle de vie : racine unique et secondaires multiples.
2. Finaliser indépendamment le protocole cryptographique d'approbation secondaire.
3. Définir la source serveur de bootstrap et de vérification du Super Admin, sans rôle implicite.
4. Finaliser le schéma des missions, délégations, permissions atomiques et versions.
5. Implémenter une seule opération administrative à la fois avec contrôle au commit et audit atomique.
6. Ajouter les tests d'intégration D1 et de concurrence avant d'ouvrir l'interface d'administration.

## 7. Éléments volontairement non décidés

Cet audit ne choisit pas :
- une méthode de récupération ou de remplacement de la racine ;
- un mécanisme de renouvellement silencieux des sessions ;
- les droits des contacts après révocation pendant une alerte active ;
- les droits de lecture après clôture ;
- les permissions exceptionnelles du support ;
- la conservation et le scellement définitifs du journal d'audit.

Ces points restent soumis à leurs décisions et revues dédiées.

## 8. Protections maintenues

Aucun rôle, endpoint, permission, table ou migration n'a été créé. Aucune migration distante n'a été appliquée. Aucun service payant, push, SMS ou déploiement n'a été activé. La production reste désactivée.

**Conclusion :** la séparation des autorités est bien décrite dans les documents, mais elle n'est pas encore démontrée par une couche administrative opérationnelle. La priorité est de conserver cette séparation dans le futur code : Super Admin pour la gouvernance métier, racine pour l'approbation cryptographique des appareils, et délégataires strictement limités à leurs missions.
