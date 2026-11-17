# SAC — Cahier des charges v2.0

Validé le 17 novembre 2026. Ce document remplace le concept d'alertes privées entre proches.

## Objectif
Plateforme citoyenne destinée au grand public, d'abord au Niger, permettant de signaler un problème/danger, de suivre le dossier par code unique et de permettre aux autorités/modérateurs de traiter les signalements.

## Profils
- Citoyen : consulter, signaler sans compte, suivre par code.
- Agent/autorité : consulter les dossiers attribués et mettre à jour selon permissions.
- Modérateur : vérifier, approuver ou rejeter avant publication.
- Administrateur : gérer comptes, rôles, zones, affectations et audit.

## Catégories initiales
Danger/sécurité ; accident de la route ; urgence médicale ; incendie/sinistre ; infrastructure/panne.

## Parcours en trois étapes
1. Catégorie et niveau d'urgence.
2. GPS facultatif, ajustement de la position sur carte, description courte, photo ou note vocale facultative.
3. Envoi sécurisé et code de suivi unique.

Le compte citoyen n'est pas obligatoire. La position indisponible n'empêche pas l'envoi. Aucun média n'est obligatoire. En danger immédiat, contacter directement les services de secours ; SAC ne remplace pas les secours.

## Suivi
Saisie du code secret pour afficher uniquement l'état non sensible : Reçu, En cours d'intervention, Résolu. Code hashé en base, rate limiting et réponses minimales.

## Modération
État distinct : En attente, Approuvé, Rejeté. Seuls les signalements approuvés peuvent alimenter le flux public. Médias R2 privés ; accès par fonction vérifiant les droits et la décision de publication.

## Espace professionnel
Carte, liste, filtres urgence/catégorie/statut/date/zone, détail, affectation, modération, mise à jour de statut, historique et audit. Contrôle serveur selon rôle, zone et affectation.

## Stack obligatoire
React + Vite + TypeScript strict + Tailwind CSS + Lucide React ; Pages Functions API REST ; D1 ; R2 privé ; Leaflet/OSM ; adaptateurs device compatibles Capacitor. Le frontend ne contacte jamais la base directement.

## Données initiales
users, reports, report_updates, rate_limits. D1 conserve la clé média privée et non une URL publique. Seed synthétique uniquement pour démo locale.

## Hors périmètre
Alertes privées aux proches, contacts de confiance, groupes familiaux, trajets, SOS programmé, abonnement citoyen Premium, dispatch secours garanti.

## Acceptation
Soumission anonyme ; code unique ; carte ajustable ; média facultatif et privé ; modération préalable ; suivi sans fuite ; tableau professionnel authentifié ; build et tests validés.