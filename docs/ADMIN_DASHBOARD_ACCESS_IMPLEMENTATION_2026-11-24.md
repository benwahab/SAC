# Espace administrateur SAC — implémentation du 24 novembre 2026

## Règle d'affichage

- Le bouton « Espace administrateur » n'est rendu que sur les écrans desktop/tablette (largeur minimale de 768 px).
- La page d'accueil interroge `GET /api/admin/access` sans cache et n'affiche le bouton que si la réponse serveur confirme `canAccess: true` et un rôle `super_admin` ou `delegate`.
- Un compte ordinaire sans mission active ne voit donc pas le bouton.
- Un compte délégué ne reçoit l'accès qu'après attribution d'au moins une mission active non expirée.
- Le Super Admin conserve l'accès complet à l'espace de gouvernance.
- Masquer le bouton n'est qu'une règle d'interface : chaque API administrative continue de vérifier la session et le rôle côté serveur.

## Expiration et révocation

- Le calcul d'accès délégué ignore les missions dont `due_at` est dépassé.
- La liste « Mes missions » ignore également les missions expirées.
- Les missions suspendues ou révoquées ne donnent pas accès.
- Les API de gestion des missions restent réservées au Super Admin.
- La suspension, la révocation et l'expiration doivent être vérifiées côté serveur à chaque requête ; l'interface n'est jamais une frontière de sécurité.

## Tableau de bord Super Admin

Le tableau de bord existant fournit :
- les indicateurs de gouvernance ;
- la recherche d'un compte actif par adresse e-mail vérifiée ;
- la création et le remplacement d'une mission ;
- le périmètre, les permissions explicites et la date d'expiration ;
- la suspension, la reprise et la révocation ;
- le journal d'audit append-only ;
- l'export CSV du journal (maximum 5 000 entrées), protégé par la vérification serveur Super Admin.

L'export neutralise les cellules CSV susceptibles d'être interprétées comme des formules par un tableur.

## Base de données

Les migrations `0001` à `0020` ont été vérifiées dans la table `d1_migrations` de la base D1 `sac-db` le 24 novembre 2026. Aucune migration supplémentaire n'était nécessaire pour ces changements applicatifs.

## Vérifications restantes

- Attendre la fin de la CI GitHub déclenchée par les commits sur `main`.
- Vérifier le rendu réel sur desktop/tablette avec un compte Super Admin, un compte délégué ayant une mission active et un compte ordinaire sans mission.
- Vérifier l'accès direct à `/administration` et aux API depuis un compte ordinaire : l'accès doit être refusé côté serveur.
- Vérifier le téléchargement CSV avec un compte Super Admin et son refus avec tout autre compte.

## Limites explicites

Cette livraison finalise le contrôle d'accès et la gouvernance des missions dans l'espace administrateur existant. Elle ne prétend pas implémenter des modules métier qui ne disposent pas encore de leurs API et règles de permissions propres.
