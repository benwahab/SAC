# SAC — Catalogue des ressources et matrice de permissions

Date : 18 novembre 2026  
Statut : spécification documentaire — non implémentée

## 1. Règle générale

Le rôle décrit une fonction, la permission autorise une action précise et la mission détermine son périmètre et sa durée. Aucun droit n'est accordé par défaut à un délégataire du seul fait de son titre. Toute permission non explicitement attribuée est refusée.

Les codes ci-dessous constituent un vocabulaire de conception, pas des permissions actives ni un schéma de base de données.

## 2. Catalogue des ressources SAC

| Domaine | Ressources à protéger | Actions à distinguer |
|---|---|---|
| Comptes | Identité, adresse e-mail, numéro déclaré, état du compte | consulter, assister, suspendre si autorisé, demander une vérification |
| Profils | Informations personnelles et préférences | consulter, corriger si autorisé |
| Proches | Liste des contacts de confiance et liens avec le titulaire | consulter dans le strict besoin, assister ; aucune modification par défaut |
| Alertes SOS | Alerte, statut, chronologie, destinataires initiaux | consulter, examiner, ajouter une note interne, transmettre une demande administrative |
| Réponses à une alerte | Accusés de réception, prise en charge, interventions et mises à jour de sécurité | consulter, vérifier, consigner ; aucune réécriture ni suppression |
| Clôture administrative | Demande, vérifications, décision et notification de clôture | examiner, décider et clôturer uniquement avec permission spéciale |
| Notifications | Événements, préférences, tentatives et résultats de livraison | consulter l'état, diagnostiquer ; aucun accès au contenu privé non nécessaire |
| Appareils | Appareils associés, clés publiques, certificats et révocations | consulter les métadonnées utiles, révoquer si permission explicite |
| Sessions | Sessions actives, dates, appareil et révocation | consulter les métadonnées, révoquer si permission explicite |
| Vérification et récupération | État OTP, demandes de récupération et événements de sécurité | consulter les états ; jamais lire OTP, secrets ou clés privées |
| Missions et délégations | Affectations, permissions, périmètres et échéances | gérer exclusivement par le Super Admin |
| Journal d'audit | Événements de sécurité et d'administration | consulter en lecture seule ; exporter uniquement avec permission distincte |
| Configuration | Paramètres fonctionnels et de sécurité par domaine | consulter ou modifier uniquement avec permission spécifique |
| Données techniques | Santé du service, incidents et diagnostics expurgés | consulter les informations nécessaires ; aucun secret ni contenu personnel superflu |

Le GPS précis, lorsqu'il sera éventuellement autorisé après validation de sa suppression irréversible, ne constitue pas une ressource librement consultable par les administrateurs. Son accès doit faire l'objet d'une spécification et d'une autorisation distinctes. À ce stade, sa collecte reste bloquée.

## 3. Matrice de référence par rôle

Cette matrice définit les limites de principe. Elle ne donne pas automatiquement accès aux données : chaque mission doit encore nommer les ressources, actions et périmètres.

| Action / pouvoir | Super Admin | Administrateur sécurité | Support | Auditeur |
|---|---|---|---|---|
| Créer/modifier/retirer une mission | Oui | Non | Non | Non |
| Attribuer ou retirer une permission | Oui | Non | Non | Non |
| Modifier ses propres droits | Non par auto-attribution ; autorité de gestion via décision explicite | Non | Non | Non |
| Consulter les alertes | Selon nécessité d'administration | Selon mission | Seulement données minimales de support | Selon périmètre de contrôle |
| Ajouter une note interne | Selon besoin | Si mission explicite | Si mission explicite | Non |
| Modifier une réponse ou un événement d'alerte | Non | Non | Non | Non |
| Suspendre un compte | Oui, selon procédure | Non par défaut | Non | Non |
| Révoquer une session ou un appareil | Selon permission et procédure | Si mission explicite | Non par défaut | Non |
| Clôturer l'alerte du scénario spécial | Oui | Seulement si permission nominative distincte | Non | Non |
| Consulter le journal d'audit | Selon périmètre | Si mission explicite | Non par défaut | Selon périmètre |
| Exporter le journal ou des données | Permission distincte, tracée | Permission distincte, tracée | Non par défaut | Permission distincte, tracée |
| Modifier la configuration | Seulement domaine autorisé | Seulement domaine autorisé | Non | Non |
| Effacer ou réécrire une trace | Jamais | Jamais | Jamais | Jamais |

Le Super Admin ne peut pas s'auto-attribuer une permission au moyen d'une action déléguée ou d'une requête client : les actes d'autorité doivent être explicites et audités. Le journal demeure non modifiable par tous les rôles.

## 4. Permissions atomiques et périmètres

Une permission est définie par le tuple conceptuel : `ressource + action + périmètre + conditions`.

Actions normalisées : `read`, `create`, `update`, `suspend`, `revoke`, `close`, `export`, `administer`. Ces verbes ne se déduisent pas les uns des autres.

Périmètres possibles à confirmer selon les fonctions réellement disponibles : global, service, région, dossier, alerte unique, ou ressource appartenant à une mission. Le périmètre le plus étroit est privilégié. Une permission sur une alerte ne donne aucun accès aux autres alertes du même compte.

Les missions multiples ne s'additionnent pas pour créer un accès global. Chaque requête doit être justifiée par une mission active qui couvre exactement la ressource et l'action.

## 5. Restrictions transversales

- Aucun délégataire ne peut créer un compte administratif, inviter un collègue, sous-déléguer ou attribuer une tâche donnant accès à SAC.
- Aucun rôle ne peut modifier ou supprimer les événements historiques d'une alerte, les accusés de réception, les interventions ou les traces d'audit.
- Les données personnelles visibles sont limitées au besoin de la mission ; l'export est toujours un droit distinct.
- Le support ne reçoit jamais un accès général aux alertes ou aux contacts au seul motif qu'il doit aider un utilisateur.
- L'auditeur n'effectue aucune opération métier et ne modifie aucune donnée.
- Les permissions spéciales, notamment la clôture administrative, sont nominatives, non transférables et contrôlées côté serveur à chaque requête.
- L'espace d'administration reste accessible uniquement depuis ordinateur ou tablette, conformément à la décision déjà validée.

## 6. Tests obligatoires avant implémentation

Prévoir des tests qui prouvent notamment que :
1. une permission absente entraîne un refus ;
2. une mission expirée, suspendue ou révoquée ne permet plus d'action, même avec une page déjà ouverte ;
3. un délégataire ne peut ni s'auto-augmenter ni déléguer ;
4. un accès à une alerte n'ouvre pas les autres alertes ;
5. Support et Auditeur ne peuvent clôturer une alerte ;
6. un administrateur sécurité sans permission spéciale ne peut pas clôturer ;
7. une permission d'audit en lecture n'autorise pas l'export ;
8. aucune requête client ne peut falsifier rôle, permission ou périmètre ;
9. aucune opération ne peut modifier ou supprimer une trace historique ;
10. la révocation est appliquée immédiatement côté serveur.

## 7. Décisions encore nécessaires

À arbitrer avant conception technique finale : périmètres réellement utiles à chaque fonction ; données exactes visibles par Support ; vues et exports de l'Auditeur ; droits éventuels de révocation de sessions/appareils ; durée et renouvellement des missions ; procédure d'urgence ; authentification renforcée pour actions critiques ; conservation des journaux et preuve technique d'intégrité.

Aucun de ces points ouverts ne doit être comblé par un droit général implicite.

## 8. Portée et interdiction d'implémentation implicite

Ce catalogue est une base de spécification. Il ne crée aucun rôle actif, compte, permission, mission, interface, endpoint, middleware, journal opérationnel, table ou migration D1. Toute implémentation exige une autorisation explicite, une revue de sécurité et des tests positifs et négatifs.


## Gouvernance des missions

Les règles détaillées de cycle de vie, suspension d'urgence, expiration, révocation, conflits, sessions administratives, exports et tests sont centralisées dans [GOUVERNANCE_MISSIONS_ADMIN_ET_CYCLE_DE_VIE.md](GOUVERNANCE_MISSIONS_ADMIN_ET_CYCLE_DE_VIE.md). Les durées et contrôles renforcés proposés dans ce document restent à valider.
