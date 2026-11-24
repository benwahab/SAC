# SAC — Audit complet du dashboard professionnel et Super Admin

**Date : 24 novembre 2026**  
**Dépôt :** `benwahab/SAC` — branche `main`  
**Périmètre :** comparaison du code présent avec `docs/CONSOLE_PROFESSIONNELLE_ET_SERVICES.md`, `docs/ANNEXE_MODELE_DONNEES_SERVICES_PROFESSIONNELS.md` et les décisions d'organisation professionnelle.  
**Nature :** audit en lecture seule ; aucun module métier ni aucune migration n'a été créé pendant cet audit.

## 1. Conclusion générale

Le dashboard Super Admin complet décidé n'est **pas encore implémenté** dans le dépôt.

Le fichier `src/AdminDashboard.tsx` contient actuellement un espace de gouvernance restreint : indicateurs liés aux missions, recherche de comptes pour l'attribution, création/modification/suspension/reprise/révocation des missions, consultation du journal d'audit et export CSV.

Il ne contient pas les onze espaces principaux de la console professionnelle. Aucun code correspondant à une console complète de finances/comptabilité, RH, logistique, secrétariat, juridique, DSI, relations externes ou pilotage n'a été identifié dans les routes et écrans applicatifs inspectés.

Les documents de conception décrivent ces espaces et leurs règles ; ils ne constituent pas une preuve d'implémentation.

## 2. Les onze espaces principaux décidés

| Espace cible | État constaté dans le code | Conclusion |
|---|---|---|
| 1. Vue d'ensemble | Quelques compteurs de gouvernance (missions actives, délégués, événements d'audit) | Partiel ; pas de tableau de pilotage global |
| 2. Utilisateurs | Recherche d'adresses e-mail vérifiées pour attribuer une mission ; API administrative de comptes | Partiel ; pas de gestion complète des utilisateurs |
| 3. Alertes | API citoyennes SOS/alertes présentes, mais aucun espace de supervision Super Admin complet identifié | Non livré comme module de console |
| 4. Finances | Aucun module comptable/financier dédié identifié | Absent |
| 5. Assistance | Aucun centre de tickets ou d'assistance professionnelle identifié | Absent |
| 6. Sécurité | Socle d'authentification, sessions, autorisation, missions et journal d'audit présents | Partiel ; pas de centre complet de supervision et continuité |
| 7. Équipe et missions | Gestion des missions et délégations présente ; tâches, rapports, messagerie, réunions et calendrier non identifiés comme modules opérationnels | Partiel |
| 8. Relations externes | Aucun registre complet de partenaires, candidatures ou conventions identifié | Absent |
| 9. Ressources | Quelques fonctions citoyennes et modèles documentaires ; pas de console RH/logistique/équipements/documents partagée opérationnelle | Absent comme espace professionnel |
| 10. Pilotage | Aucun module d'objectifs, projets, KPI et rapports de direction identifié | Absent |
| 11. Paramètres | Paramètres de compte citoyen et configurations techniques ; pas de centre de configuration de la console | Partiel / non livré comme espace professionnel |

## 3. Fonctions transversales décidées

| Fonction | État constaté |
|---|---|
| Messagerie interne et groupes d'équipe | Non identifiée comme fonctionnalité professionnelle opérationnelle |
| Rendez-vous, réunions et calendrier partagé | Non identifiés comme module professionnel opérationnel |
| Gestion des absences et disponibilités | Non identifiée |
| Tâches, sous-tâches, livrables et validation Super Admin | Non identifiés comme module opérationnel |
| Rapports d'avancement et évaluation des missions | Non identifiés |
| Secrétariat et accueil des rendez-vous | Non identifié |
| Comptabilité, trésorerie, budgets, factures, paiements et rapprochements | Non identifié |
| Ressources humaines et paie | Non identifiées |
| Achats, fournisseurs, devis, commandes, stocks et logistique | Non identifiés |
| Juridique, contrats, conformité et échéances | Non identifiés |
| DSI, incidents, versions, sauvegardes et supervision technique centralisée | Non identifiés comme espace complet |
| Gestion centralisée des documents, versions, impressions et archives | Non identifiée comme service documentaire commun |
| Rapports de direction, objectifs, risques et indicateurs | Non identifiés |

## 4. Ce qui existe réellement aujourd'hui

- Application citoyenne : parcours de compte, proches, alertes/SOS, historique, paramètres et rappels, avec des API et services dédiés.
- Authentification et sessions par appareil, contrôles d'accès et garde Super Admin côté serveur.
- Missions administratives : création, modification, suspension, reprise et révocation.
- Permissions explicites de mission : lire, créer, modifier, traiter, exporter et supprimer.
- Expiration des missions prise en compte dans l'accès et la liste des missions.
- Journal d'audit administratif et export CSV protégé.
- Entrée de l'espace professionnel affichée selon l'autorisation retournée par le serveur et limitée à l'interface desktop/tablette.

La présence de ces fondations ne signifie pas que les futurs modules métier sont déjà connectés à la garde de permission. Chaque API métier devra intégrer ses contrôles par ressource, action et périmètre.

## 5. Écarts et points de vigilance

1. **Console incomplète :** l'écran actuel est une page de gestion des missions, pas la console professionnelle à onze espaces.
2. **Accès mobile :** l'interface masque l'entrée et affiche un écran d'indisponibilité sous 768 px. Cela ne suffit pas à établir un refus serveur de toute navigation directe vers la console depuis un téléphone. La règle cible demande un contrôle serveur, avec les limites de détection du type d'appareil documentées.
3. **Permissions futures :** la garde de mission existe, mais les futurs modules et API métier ne sont pas tous raccordés puisqu'ils ne sont pas encore développés.
4. **Données réelles :** les futurs indicateurs devront lire les sources réelles et distinguer données calculées, déclarées, vérifiées, validées et simulations. Aucun chiffre fictif ne doit être présenté comme réel.
5. **Confidentialité :** RH, finances, juridique, alertes privées, GPS, clés et informations de récupération doivent rester cloisonnés. Le rôle Super Admin ne doit pas exposer les secrets cryptographiques ou les coordonnées GPS précises.
6. **Documents :** le référentiel documentaire doit être commun aux services, avec référence, date, auteur, service, version, statut et événements d'impression distincts.
7. **Architecture :** réutiliser les entités communes et harmoniser le modèle D1 avant d'ajouter des tables ; ne pas convertir automatiquement le catalogue conceptuel en migrations.
8. **Validation locale :** le plan comptable, la fiscalité, la paie, les contrats et les obligations réglementaires doivent être validés par des professionnels compétents au Niger avant activation.

## 6. Séquence de réalisation recommandée

Cette séquence est une proposition d'exécution technique qui respecte les décisions déjà documentées ; elle ne vaut pas validation de nouveaux choix métier.

1. Construire le shell de la console : navigation des onze espaces, en-tête, profil, notifications, recherche globale et personnalisation contrôlée.
2. Compléter l'espace Vue d'ensemble avec les seuls indicateurs réellement disponibles.
3. Compléter Utilisateurs, Alertes et Sécurité avec leurs API, filtres de confidentialité et autorisations dédiées.
4. Construire Équipe et missions : collaborateurs, tâches, livrables, rapports, messagerie, réunions et calendrier.
5. Construire le service documentaire commun et les fonctions de secrétariat.
6. Construire Ressources : RH, logistique et équipements, avec cloisonnement strict.
7. Construire Finances : comptabilité, trésorerie, budgets, factures, paiements et rapprochements, avec séparation des tâches et validations.
8. Construire Relations externes et le périmètre juridique/conformité.
9. Construire Pilotage et Paramètres, puis les rapports et la supervision transversale.
10. Pour chaque lot : modèle de données, migration D1 testée, API sécurisées, permissions, interface, tests, audit et preuve de déploiement avant de déclarer le module livré.

## 7. État de validation du dépôt

- Audit du code et des documents de conception réalisé le 24 novembre 2026.
- CI GitHub Actions du commit `5100197c36f1071c85dca4960b8d2838dc3b6630` : succès (run `45497448126`).
- Cet audit n'a créé ni module métier, ni migration D1, ni déploiement de production.
- Le présent rapport devient le point de référence pour distinguer le périmètre cible de ce qui est réellement livré.

## 8. Références

- `docs/CONSOLE_PROFESSIONNELLE_ET_SERVICES.md`
- `docs/ANNEXE_MODELE_DONNEES_SERVICES_PROFESSIONNELS.md`
- `docs/AUDIT_ESPACE_SUPER_ADMIN_ET_DELEGATIONS_2026-11-21.md`
- `docs/ADMIN_DASHBOARD_ACCESS_IMPLEMENTATION_2026-11-24.md`
- `src/AdminDashboard.tsx`
- `src/App.tsx`
