# SAC — Avancement de la console professionnelle

**Date :** 24 novembre 2026  
**Dépôt :** `benwahab/SAC` — branche `main`  
**Référence fonctionnelle :** `docs/CONSOLE_PROFESSIONNELLE_ET_SERVICES.md`

## Phase 1 — Structure de navigation

La console Super Admin dispose désormais d'une navigation structurée selon les onze espaces principaux validés :

1. Vue d'ensemble
2. Utilisateurs
3. Alertes
4. Finances
5. Assistance
6. Sécurité
7. Équipe et missions
8. Relations externes
9. Ressources
10. Pilotage
11. Paramètres

La navigation est latérale sur grand écran et horizontale sur les formats tablette compatibles. L'interface conserve l'identité claire vert clair / verre dépoli de SAC. L'accès reste réservé au rôle Super Admin dans cette vue ; les collaborateurs conservent leur espace limité par mission.

## Fonctions réelles réutilisées

- **Équipe et missions :** création, modification, suspension, reprise et révocation des missions, avec permissions explicites et échéances.
- **Sécurité :** consultation du journal d'audit et export CSV protégé.
- **Utilisateurs :** répertoire en lecture seule des comptes actifs ayant une adresse e-mail principale vérifiée, alimenté par `GET /api/admin/accounts`, limité à 25 résultats. Il ne permet ni modification ni suspension de compte.

## Rubriques non encore opérationnelles

Les espaces Alertes, Finances, Assistance, Relations externes, Ressources, Pilotage et Paramètres ont leur entrée de navigation mais leurs modules métier restent à développer. La Vue d'ensemble ne contient encore que les compteurs de gouvernance déjà disponibles. Ces vues affichent explicitement leur état non opérationnel et aucune donnée fictive.

La présence d'une entrée de navigation ne vaut pas livraison du module.

## Sécurité et données

- Aucun nouveau schéma D1 ni aucune migration n'a été créé dans cette phase.
- Les routes métier existantes gardent leurs gardes serveur ; le répertoire des comptes utilise `requireSuperAdminSession`.
- La supervision des alertes ne renvoie aucun nom, e-mail, identifiant de citoyen, description libre, destinataire ou emplacement GPS ; elle n’expose que des compteurs et répartitions agrégées.
- Les données citoyennes sensibles, les coordonnées GPS précises et les secrets cryptographiques ne sont pas exposés par la nouvelle navigation.
- Les futures rubriques devront utiliser des permissions serveur par ressource, action et périmètre, pas seulement masquer des boutons.
- Les modules financiers, RH, juridiques et logistiques nécessitent un modèle D1 harmonisé, des validations métier et des tests dédiés avant activation.

## Étapes suivantes

1. Compléter la Vue d’ensemble avec des états de santé mesurés et des tendances historiques contrôlées.
2. Harmoniser et faire approuver le modèle D1 de l’Assistance avant de créer les tables et API de tickets.
3. Définir si un traitement individuel des alertes est nécessaire, avec une permission distincte, une justification d’accès et une piste d’audit.
4. Développer les services d'équipe (tâches, livrables, rapports, messagerie, réunions, calendrier et absences).
5. Créer le service documentaire commun et les fonctions de secrétariat.
6. Harmoniser le modèle D1, puis construire les ressources RH et logistiques.
7. Développer le module finances/comptabilité avec séparation des tâches, validations et journalisation.
8. Ajouter relations externes, juridique/conformité, pilotage et paramètres.
9. Pour chaque lot : migration D1 testée en environnement isolé, API protégées, tests de permissions, interface, audit et vérification du déploiement.

## Validation

Les commits de la supervision des alertes et de la conception Assistance déclenchent des exécutions GitHub Actions. Les workflows de la supervision précédente ont été lancés ; leur conclusion doit être vérifiée avant de déclarer le lot validé. Aucun déploiement de production n’est revendiqué.
