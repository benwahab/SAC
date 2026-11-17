# SAC — Cahier des charges v2.0

Validé le 17 novembre 2026. Ce document remplace intégralement l'ancien concept d'alertes privées aux proches.

## Objectif
Plateforme citoyenne, d'abord au Niger, pour signaler un problème/danger, suivre le dossier par code unique et permettre aux autorités/modérateurs de le traiter.

## Profils
- Citoyen : consulter, signaler sans compte, suivre par code.
- Agent/autorité : consulter les dossiers attribués et les mettre à jour selon permissions.
- Modérateur : vérifier, approuver ou rejeter avant publication.
- Administrateur : gérer comptes, rôles, zones, affectations et audit.

## Catégories
Danger/sécurité ; accident de la route ; urgence médicale ; incendie/sinistre ; infrastructure/panne.

## Parcours en trois étapes
1. Catégorie et niveau d'urgence.
2. GPS facultatif, point ajustable sur carte, description courte, photo ou note vocale facultative.
3. Envoi et code de suivi unique.

Aucun compte citoyen requis. Position indisponible n'empêche pas l'envoi. Média facultatif. En danger immédiat, contacter directement les secours ; SAC ne les remplace pas.

## Suivi
Saisie du code secret pour consulter l'état non sensible : Reçu, En cours d'intervention, Résolu. Code hashé en base, tentatives limitées et réponses minimales.

## Modération
État distinct : En attente, Approuvé, Rejeté. Seuls les signalements approuvés peuvent être publics. Médias R2 privés ; accès par fonction vérifiant les droits et l'approbation.

## Espace professionnel
Carte, liste, filtres urgence/catégorie/statut/date/zone, détail, affectation, modération, mise à jour de statut, historique et audit. Contrôle serveur selon rôle, zone et affectation.

## Stack
React, Vite, TypeScript strict, Tailwind, Lucide React, Pages Functions REST, D1, R2 privé, Leaflet/OSM, adaptateurs Capacitor. Le frontend ne contacte jamais D1 directement.

## Hors périmètre
Alertes privées aux proches, contacts de confiance, groupes familiaux, protection des trajets, SOS programmé, abonnement Premium, dispatch secours garanti.

## Acceptation
Soumission sans compte ; code unique ; carte ajustable ; média facultatif et privé ; modération préalable ; suivi sans fuite ; espace professionnel authentifié ; build/tests validés.