# SAC — Conception Pilotage, indicateurs, projets et rapports de direction

**Date :** 24 novembre 2026  
**Dépôt :** benwahab/SAC — branche main  
**Statut :** conception fonctionnelle ; aucun objectif, KPI, projet ou rapport fictif n'est créé.

## 1. Mission

Le module Pilotage aide la direction à suivre les objectifs, les résultats, les projets, les risques et les décisions. Il lit les données des modules sources ; il ne devient pas une seconde base où les équipes ressaisissent les mêmes chiffres.

## 2. Objectifs et plans d'action

Un objectif doit contenir :
- référence et libellé ;
- période et unité responsable ;
- résultat attendu, indicateur lié et valeur cible ;
- responsable et contributeurs ;
- statut et justification ;
- actions, jalons et échéances ;
- historique de révision et décisions.

Les cibles sont validées par le Super Admin ou le responsable habilité. Les changements de cible sont versionnés ; les périodes antérieures restent consultables.

## 3. Indicateurs de performance (KPI)

Chaque indicateur doit documenter :
- définition métier sans ambiguïté ;
- formule et source(s) de données ;
- unité, devise éventuelle et granularité temporelle ;
- propriétaire, fréquence et périmètre ;
- sens d'évolution (plus haut/plus bas/intervalle cible) ;
- règles d'inclusion/exclusion et date de calcul ;
- qualité, fraîcheur et statut de validation.

Les valeurs calculées, déclarées, vérifiées et validées sont distinctes. Si la source n'existe pas ou n'est pas à jour, l'interface affiche « indisponible » et la date de dernière mesure, jamais une valeur de démonstration.

## 4. Projets et initiatives

Cycle :
proposition → cadrage → approbation → planification → exécution → revue → clôture.

Un projet peut contenir phases, jalons, dépendances, responsables, livrables, budget lié à Finances, risques, décisions et comptes rendus. Les tâches et réunions utilisent le service commun. Un budget projet est une vue liée au budget financier source, pas un montant ressaisi.

## 5. Risques et décisions

Registre des risques :
- catégorie et description limitée au besoin ;
- probabilité, impact et criticité ;
- responsable, mesures de réduction et échéance ;
- statut, acceptation ou escalade ;
- historique des évaluations.

Les risques SOS individuels, données médicales, informations RH sensibles et secrets ne sont jamais copiés dans le registre de direction. Les risques opérationnels agrégés peuvent être partagés sans identifiant citoyen.

Les décisions de direction comprennent auteur, date, participants, justification, actions, responsables, échéances et pièces documentaires.

## 6. Rapports et snapshots

- rapports périodiques et tableaux de bord ;
- comparaisons objectif/réalisé/prévision ;
- filtres par période, unité et périmètre autorisé ;
- export PDF/CSV selon permission distincte ;
- archivage central des rapports générés ou imprimés avec référence, date, auteur, version et statut.

Un snapshot de période conserve les valeurs calculées, les définitions KPI utilisées, la date de génération et les références sources. Il est immuable après validation ; toute correction produit une nouvelle version traçable.

## 7. Permissions

Permissions recommandées :
- steering.read ;
- steering.configure_objectives ;
- steering.update_progress ;
- steering.manage_projects ;
- steering.manage_risks ;
- steering.publish_reports ;
- steering.export.

Chaque permission est limitée à une unité, une période et un ensemble de ressources. Les vues consolidées respectent les règles de confidentialité des modules sources. L'export est distinct de la consultation. Le Super Admin peut consulter la vue globale ; les délégués ne peuvent ni élargir leur périmètre ni s'auto-attribuer des droits.

## 8. Architecture

Le module réutilise les sources de vérité :
- alertes : agrégats strictement anonymisés ;
- assistance : compteurs et délais selon permissions ;
- finances : budgets, recettes/dépenses confirmées et trésorerie autorisée ;
- RH : effectifs et indicateurs agrégés, sans salaires ni dossiers privés ;
- logistique : stocks et disponibilité ;
- projets : phases, jalons, risques et livrables ;
- documents : rapports, décisions et archives.

Tables candidates à harmoniser : strategic_objectives, objective_targets, kpi_definitions, kpi_measurements, initiatives, project_phases, project_milestones, project_dependencies, project_risks, management_decisions, report_definitions, report_snapshots. Ne pas créer de copies des dépenses, alertes, comptes, missions ou documents.

## 9. Conditions avant activation

Confirmer les objectifs institutionnels, propriétaires de données, formules KPI, fréquences, niveaux de validation, unités organisationnelles, politiques d'export et conservation des snapshots. Les KPI doivent être testés contre les sources réelles et documentés avant publication.

Aucune migration D1, aucun objectif fictif, aucun indicateur de démonstration ni rapport de production n'est créé par cette note. Le module reste non opérationnel jusqu'à validation des sources, permissions, tests et règles de direction.
