# SAC — Conception Ressources humaines, logistique, équipements et documents

**Date :** 24 novembre 2026  
**Dépôt :** benwahab/SAC — branche main  
**Statut :** conception fonctionnelle ; aucun registre RH, inventaire, dossier logistique ou dépôt documentaire professionnel activé.

## 1. Objectif

La rubrique Ressources regroupe les moyens humains, matériels et documentaires nécessaires au fonctionnement de SAC. Elle doit éviter les fichiers dispersés, les doublons et les registres parallèles, tout en cloisonnant les informations personnelles et confidentielles.

Périmètres :
- ressources humaines et administration du personnel ;
- logistique, stocks, achats et mouvements ;
- équipements, véhicules, locaux et maintenance ;
- documents reçus, générés, signés, imprimés et archivés.

Les achats, engagements, factures et paiements sont reliés à Finances. Les fournisseurs et conventions sont reliés à Relations externes. Les mêmes documents, utilisateurs, missions, tâches et événements sont réutilisés dans tous les modules.

## 2. Ressources humaines

Fiche professionnelle minimale :
- identifiant interne opaque ;
- identité et coordonnées professionnelles ;
- unité, poste, responsable et statut de collaboration ;
- contrat, dates de début/fin et documents associés ;
- affectations, missions, formations et habilitations ;
- absences et congés selon politique ;
- historique des changements.

Les informations salariales, disciplinaires, bancaires, médicales ou familiales sont cloisonnées par permission RH spécifique. Les rôles logistiques, support et direction ne reçoivent pas un accès général au dossier RH. Les données médicales ne sont pas collectées par défaut.

Les demandes de congé suivent : brouillon → soumise → validation responsable → validation RH si nécessaire → approuvée/refusée → consommée. Toute décision est tracée.

## 3. Logistique et stocks

Fonctions prévues :
- catalogue des articles et unités ;
- entrepôts, dépôts et emplacements ;
- entrées, sorties, transferts et inventaires ;
- seuils de réapprovisionnement ;
- demandes de matériel ;
- fournisseurs et commandes liés au module Finance ;
- réception, contrôle qualité, retours et écarts ;
- historique des mouvements.

Un mouvement de stock est enregistré une seule fois et ne doit pas être confondu avec une dépense ou un paiement. Les corrections sont tracées par mouvement d'ajustement, pas par modification silencieuse.

## 4. Équipements, véhicules et locaux

Registre d'actifs :
- référence interne, catégorie et numéro de série ;
- date et source d'acquisition ;
- propriétaire ou unité responsable ;
- emplacement et détenteur actuel ;
- état : disponible, attribué, en maintenance, hors service, perdu ou réformé ;
- garantie, contrats, inspections et documents ;
- historique d'affectation et de maintenance.

Véhicules : immatriculation masquée selon rôle, kilométrage, assurance, visite technique, carburant, affectations et incidents. Les données de trajet personnel ne sont pas collectées dans ce registre.

Maintenance : demande → diagnostic → autorisation → intervention → réception → clôture. Les dépenses et factures restent dans Finances.

## 5. Service documentaire commun

Le registre documentaire est partagé entre tous les modules :
- référence unique non prédictible ;
- titre, type, catégorie, unité, source et niveau de confidentialité ;
- auteur, date de création, date d'impression, version et statut ;
- liens métier vers ticket, convention, commande, dossier RH ou équipement ;
- historique des accès, validations, signatures, impressions et archivages ;
- durée de conservation et règle de destruction.

Tout document généré ou imprimé par la plateforme doit être archivé automatiquement avec sa référence, sa date, son auteur, sa version et son statut. L'impression ne doit pas créer un second dossier métier : elle ajoute une trace et, si nécessaire, un exemplaire PDF archivé.

Stockage :
- métadonnées dans D1 ;
- fichiers dans R2 privé ;
- clés d'objet opaques, aucun bucket public ;
- accès via URL signée courte durée après contrôle serveur ;
- limites de taille/type, validation MIME, analyse anti-malware avant publication ;
- versions immuables et journal d'accès ;
- sauvegarde et rétention alignées sur la politique documentaire.

## 6. Permissions

Permissions séparées :
- hr.read / create / update / approve ;
- hr.sensitive.read pour les données RH restreintes ;
- logistics.read / create / update / approve / reconcile ;
- assets.read / create / update / assign / maintain / retire ;
- documents.read / create / version / approve / print / export / archive.

Les permissions sont liées à une mission, un périmètre et une échéance. Les délégués ne peuvent pas s'auto-attribuer des droits. Les opérations sensibles sont auditées. Les exports et téléchargements sont séparés du droit de consultation.

## 7. Modèle D1/R2 candidat

À harmoniser avec les modèles communs avant migration :
- RH : hr_people, hr_contracts, hr_assignments, hr_leave_requests, hr_training, hr_events ;
- logistique : inventory_items, warehouses, stock_movements, stock_counts, procurement_requests, goods_receipts ;
- actifs : assets, asset_assignments, vehicles, vehicle_maintenance, facility_records, maintenance_work_orders ;
- documents : documents, document_versions, document_links, document_access_events, document_print_events, document_retention_policies.

Ne pas dupliquer comptes, missions, organisations partenaires, dépenses, paiements, calendrier, tâches et journaux d'audit existants. Les contraintes d'accès et les cycles de vie doivent être appliqués par D1 et API serveur.

## 8. Écrans prévus

- RH : effectifs autorisés, contrats à échéance, congés et habilitations ;
- Logistique : stock disponible, mouvements, demandes et réapprovisionnement ;
- Équipements : registre, affectations, maintenance et garanties ;
- Documents : recherche autorisée, versions, validations, impression et archives.

Les tableaux de bord montrent des compteurs calculés depuis les registres réels. Les données RH sensibles sont exclues des indicateurs généraux.

## 9. Conditions avant activation

Confirmer :
1. unités, postes, rôles et responsables RH ;
2. politiques de congés, contrats, conservation et accès aux données RH ;
3. catalogue de stock, entrepôts, unités et règles d'inventaire ;
4. catégories d'actifs, véhicules, inspections et maintenance ;
5. classifications documentaires, signatures, archivage, impression et durées de conservation ;
6. configuration R2, antivirus, chiffrement, URLs signées et procédures de sauvegarde.

Aucune migration D1/R2 ni donnée fictive n'est créée par cette note. Le module reste non opérationnel jusqu'à validation du modèle commun, des politiques et des tests.


## Prérequis d'infrastructure vérifié le 24 novembre 2026

Le compte Cloudflare relié au projet répond actuellement que R2 doit d'abord être activé depuis le tableau de bord Cloudflare. Aucun bucket SAC ne peut donc être supposé disponible. En conséquence :
- aucune liaison R2 n'est ajoutée à `wrangler.toml` ;
- aucune route d'upload/téléchargement n'est activée ;
- aucun document n'est stocké publiquement ou dans D1 sous forme de contenu binaire ;
- la mise en œuvre du stockage documentaire attend l'activation R2, la création d'un bucket privé dédié, puis les tests de liaison locale et d'accès serveur.

Cette vérification n'a créé ni modifié aucune ressource Cloudflare.
