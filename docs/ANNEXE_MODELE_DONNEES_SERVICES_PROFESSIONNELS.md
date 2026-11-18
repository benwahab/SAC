# SAC — Annexe du modèle de données des services professionnels

**Date :** 18 novembre 2026  
**Statut :** catalogue conceptuel de tables proposées ; aucune migration D1 de console ou de service administratif n'est autorisée par ce document.  
**Dépendances :** `docs/CONSOLE_PROFESSIONNELLE_ET_SERVICES.md`, `docs/ARCHITECTURE_ET_MODELE_DONNEES.md`.

## 1. Avertissement de portée

Cette annexe conserve le travail de conception détaillé des services professionnels. Les noms sont des propositions de modélisation, pas des tables déjà présentes dans D1.

Avant toute migration :
- comparer avec les tables existantes ;
- réutiliser les entités communes ;
- supprimer les doublons conceptuels ;
- vérifier les relations, contraintes et permissions ;
- définir la conservation et les règles juridiques ;
- obtenir une autorisation explicite de l'utilisateur.

La stack SAC reste Cloudflare D1. Les conventions PostgreSQL évoquées dans des échanges de conception antérieurs ne remplacent pas cette cible : les types, contraintes et transactions devront être adaptés aux capacités réelles de D1/SQLite.

## 2. Principes de modélisation

- Une seule source de vérité par opération.
- Une référence commune permet les liens entre services.
- Les tables de documents, utilisateurs, permissions et événements transversaux sont réutilisées.
- Les journaux append-only ne sont pas modifiés silencieusement.
- Les montants sont stockés avec une précision décimale adaptée et une devise explicite.
- Les états métier sont contrôlés.
- Les permissions sont vérifiées côté serveur par acteur, ressource, action et périmètre.
- Les données RH, bancaires, disciplinaires, médicales et les alertes privées sont cloisonnées.
- Les tables ne sont pas créées simplement pour correspondre à un écran.
- Les migrations doivent être versionnées et testées.

## 3. Logistique — catalogue proposé

### 3.1 Besoins et demandes d'achat
- `logistics_needs`
- `logistics_need_items`
- `logistics_need_attachments`
- `logistics_need_approvals`
- `purchase_requests`

### 3.2 Fournisseurs
- `suppliers`
- `supplier_contacts`
- `supplier_categories`
- `supplier_documents`
- `supplier_bank_accounts`
- `supplier_evaluations`
- `supplier_events`

Les changements de coordonnées bancaires fournisseurs exigent une vérification renforcée et un historique.

### 3.3 Devis et comparaison
- `quotation_requests`
- `quotation_suppliers`
- `supplier_quotes`
- `supplier_quote_items`
- `quote_comparisons`

### 3.4 Commandes
- `purchase_orders`
- `purchase_order_items`
- `purchase_order_approvals`
- `purchase_order_events`

### 3.5 Stocks et inventaires
- `inventory_items`
- `inventory_categories`
- `warehouses`
- `warehouse_locations`
- `stock_levels`
- `stock_movements`
- `stock_reservations`
- `stock_counts`
- `stock_adjustments`
- `warehouse_zones`
- `warehouse_bins`
- `inventory_sessions`
- `inventory_count_lines`
- `inventory_variances`

Les mouvements de stock sont traçables. Les ajustements ne sont jamais silencieux ; les écarts d'inventaire doivent être justifiés et approuvés selon les permissions.

### 3.6 Réception, livraison et retours
- `goods_receipts`
- `goods_receipt_items`
- `delivery_orders`
- `delivery_events`
- `delivery_proofs`
- `returns`

### 3.7 Équipements et immobilisations logistiques
- `assets`
- `asset_assignments`
- `asset_transfers`
- `asset_warranties`
- `asset_disposals`

### 3.8 Maintenance
- `maintenance_plans`
- `maintenance_requests`
- `maintenance_interventions`
- `maintenance_parts`
- `maintenance_costs`

### 3.9 Flotte
- `fleet_vehicles`
- `vehicle_assignments`
- `vehicle_documents`
- `vehicle_maintenance`
- `fuel_records`
- `vehicle_incidents`
- `trip_requests`

### 3.10 Locaux et installations
- `facilities`
- `facility_zones`
- `facility_contracts`
- `facility_incidents`
- `facility_maintenance`

### 3.11 Contrats et rapports logistiques
- `logistics_contracts`
- `contract_obligations`
- `contract_renewals`
- `logistics_reports`
- `logistics_kpis`
- `logistics_period_summaries`

### 3.12 Cycle d'achat et intégration comptable

Cycle cible :
besoin → approbation → consultation de fournisseurs → comparaison des devis → autorisation d'achat → commande → réception/inspection → facture → comptabilité → paiement.

La logistique et la comptabilité utilisent une référence commune pour la même opération. Une commande non facturée n'est pas une dépense payée. Une réception peut mettre à jour le stock, tandis que la facture et le paiement suivent leurs propres états financiers.

Les annulations, retours, avoirs et remboursements doivent être synchronisés sans créer de doublons.

## 4. Comptabilité — catalogue proposé

### 4.1 Plan comptable
- `accounting_accounts`
- `accounting_account_classes`
- `accounting_account_groups`
- `accounting_account_mappings`

Le référentiel comptable doit être configurable selon le référentiel applicable à la structure juridique. Ne pas supposer automatiquement un plan comptable sans validation locale.

### 4.2 Dépenses et recettes
- `expenses`
- `revenues`
- `revenue_categories`
- `revenue_sources`
- `revenue_documents`
- `revenue_events`

Les états distinguent prévu, demandé, engagé, facturé, partiellement payé, payé, contesté, annulé et remboursé.

### 4.3 Journaux et écritures
- `accounting_journals`
- `accounting_entries`
- `accounting_entry_lines`
- `accounting_periods`

La partie double doit respecter débit = crédit. Une écriture comptabilisée est corrigée par une écriture tracée, pas par modification silencieuse.

### 4.4 Trésorerie et rapprochements
- `financial_accounts`
- `cash_registers`
- `financial_transactions`
- `internal_transfers`
- `bank_reconciliations`
- `cash_reconciliations`

Les banques, caisses physiques et portefeuilles Mobile Money sont distingués. Un transfert interne n'est ni un nouveau revenu ni une nouvelle dépense.

### 4.5 Factures et paiements
- `invoices`
- `invoice_lines`
- `invoice_taxes`
- `invoice_payments`
- `credit_notes`

Le rapprochement avec commande et réception doit détecter les doublons, écarts de quantités/montants, fournisseurs suspendus, changements bancaires et paiements antérieurs.

### 4.6 Paie et charges
- `payroll_accounting_entries`
- `payroll_liabilities`
- `payroll_payments`
- `employer_contributions`

La paie reste confidentielle et liée au module RH selon des permissions spécifiques.

### 4.7 Budgets
- `budgets`
- `budget_lines`
- `budget_allocations`
- `budget_revisions`
- `budget_consumption`

Les vues distinguent budget prévu, engagé, facturé, payé et disponible.

### 4.8 Fiscalité
- `tax_types`
- `tax_rules`
- `tax_declarations`
- `tax_payments`
- `compliance_deadlines`

Les taux, échéances et règles sont configurés après validation professionnelle pour la juridiction et la forme juridique applicables.

### 4.9 Dettes, créances et avances
- `payables`
- `receivables`
- `employee_advances`
- `supplier_advances`
- `loans`
- `repayment_schedules`

### 4.10 Immobilisations
- `fixed_assets`
- `asset_acquisitions`
- `depreciation_schedules`
- `asset_impairments`
- `asset_disposals`

### 4.11 Trésorerie prévisionnelle et engagements
- `cashflow_forecasts`
- `cashflow_items`
- `liquidity_alerts`
- `recurring_expenses`
- `financial_commitments`
- `subscription_expenses`

Les prévisions et engagements attendus restent distincts des transactions réellement exécutées.

### 4.12 Approbations financières
- `financial_approval_policies`
- `financial_approval_limits`
- `financial_approval_requests`
- `financial_approval_history`

Les limites, seuils et éventuelles doubles validations restent à définir. Les collaborateurs ne peuvent pas approuver leurs propres opérations au-delà de leurs permissions.

### 4.13 Rapports et clôtures
- `financial_reports`
- `financial_report_runs`
- `financial_report_parameters`
- `accounting_closures`
- `accounting_closure_checks`
- `accounting_adjustments`
- `accounting_period_locks`

Rapports envisagés : journaux, grand livre, balance, bilan, compte de résultat, trésorerie, dépenses par service/catégorie, recettes, dettes, créances, paie, immobilisations et suivi budgétaire. Les déclarations statutaires nécessitent une revue professionnelle.

## 5. Ressources humaines — catalogue proposé

### 5.1 Personnel et contrats
- `employees`
- `employee_contacts`
- `employment_contracts`
- `contract_amendments`
- `contract_events`

### 5.2 Congés, absences et temps de travail
- `leave_types`
- `leave_balances`
- `leave_requests`
- `leave_decisions`
- `absence_records`
- `work_schedules`
- `attendance_records`
- `attendance_events`
- `overtime_requests`
- `overtime_records`
- `attendance_corrections`

### 5.3 Rémunérations et paie
- `salary_structures`
- `salary_components`
- `payroll_periods`
- `payroll_runs`
- `payroll_items`
- `payroll_adjustments`
- `payslips`
- `payroll_approvals`
- `payroll_payment_links`

### 5.4 Évaluations et développement
- `evaluation_campaigns`
- `employee_evaluations`
- `evaluation_criteria`
- `evaluation_results`
- `evaluation_comments`
- `development_plans`

### 5.5 Discipline
- `disciplinary_cases`
- `disciplinary_events`
- `disciplinary_documents`
- `disciplinary_decisions`

Accès strictement restreint et conformité juridique obligatoire.

### 5.6 Recrutement et intégration
- `job_positions`
- `job_openings`
- `job_applications`
- `candidate_profiles`
- `interview_sessions`
- `candidate_assessments`
- `employment_offers`
- `onboarding_plans`
- `onboarding_tasks`

L'acceptation d'un candidat ne lui accorde pas automatiquement un compte professionnel ou une permission de console.

### 5.7 Formation et départ
- `training_programs`
- `training_sessions`
- `training_enrollments`
- `training_progress`
- `training_assessments`
- `training_certificates`
- `employee_departures`
- `departure_checklists`
- `asset_returns`
- `access_revocations`
- `final_payroll_items`

## 6. Pilotage — catalogue proposé

### 6.1 Objectifs stratégiques
- `strategic_objectives`
- `strategic_objective_categories`
- `objective_owners`
- `objective_indicators`
- `objective_targets`
- `objective_results`
- `objective_reviews`

### 6.2 Indicateurs
- `performance_indicators`
- `indicator_definitions`
- `indicator_measurements`
- `indicator_targets`
- `indicator_alert_rules`

### 6.3 Projets stratégiques
- `strategic_projects`
- `project_phases`
- `project_milestones`
- `project_dependencies`
- `project_budgets`
- `project_risks`
- `project_deliverables`
- `project_reviews`

### 6.4 Performance financière et d'équipe
- `strategic_financial_snapshots`
- `financial_performance_indicators`
- `budget_variances`
- `financial_forecasts`
- `department_performance_reviews`
- `team_performance_indicators`
- `mission_performance_summaries`
- `management_reviews`

### 6.5 Risques, alertes et rapports de direction
- `organizational_risks`
- `risk_categories`
- `risk_assessments`
- `risk_mitigation_plans`
- `risk_reviews`
- `executive_alerts`
- `alert_rules`
- `alert_acknowledgements`
- `alert_escalations`
- `executive_reports`
- `executive_report_templates`
- `executive_report_sections`
- `executive_report_runs`
- `executive_report_approvals`

### 6.6 Prévisions et directives
- `strategic_forecasts`
- `forecast_assumptions`
- `forecast_scenarios`
- `scenario_variables`
- `scenario_results`
- `executive_directives`
- `directive_assignments`
- `directive_followups`
- `directive_evidence`

Les indicateurs distinguent valeurs calculées, déclarées, vérifiées et validées. Les scénarios simulés doivent être explicitement marqués comme simulations.

## 7. Équipe, documents et services transversaux

Les tables communes déjà existantes ou proposées dans les documents de référence doivent être réutilisées autant que possible :
- comptes, rôles, permissions et affectations ;
- missions, tâches, délégations et historique ;
- messages, conversations, réunions et notifications ;
- documents, versions, relations et événements d'archive ;
- fournisseurs, partenaires, contrats et engagements ;
- événements d'audit et contrôles de sécurité.

Ne pas créer une nouvelle table de documents propre à chaque service si le référentiel central peut porter les métadonnées et les permissions.

## 8. Intégrations entre services

### Logistique → Comptabilité
Une commande, une réception, une facture et un paiement sont des étapes liées, mais distinctes. Elles partagent des références et des montants réconciliables.

### RH → Comptabilité
La paie préparée par RH est contrôlée par la comptabilité puis payée par la trésorerie. Les informations salariales ne sont accessibles qu'aux personnes autorisées.

### DSI → Tous les services
La DSI gère les systèmes et incidents dans son périmètre, mais n'obtient pas un accès général aux données métier privées.

### Secrétariat → Documents
Les documents reçus ou générés sont référencés dans le système documentaire central. Leur origine, leur auteur et leur statut restent traçables.

### Pilotage → Données sources
Pilotage lit des indicateurs consolidés ; il ne doit pas devenir une seconde base où les utilisateurs ressaisissent les mêmes chiffres.

## 9. Règles avant conversion en schéma D1

Pour chaque table candidate :
1. confirmer qu'elle correspond à une entité métier distincte ;
2. chercher une table existante équivalente ;
3. définir les clés et relations ;
4. définir les contraintes d'unicité ;
5. définir les états et transitions ;
6. définir les permissions par acteur et action ;
7. définir les données sensibles et leur conservation ;
8. définir les index à partir des requêtes réelles ;
9. écrire des tests d'intégrité et d'accès ;
10. obtenir validation avant migration.

**Conclusion :** ce catalogue conserve les propositions de modélisation des services professionnels. Il ne doit pas être transformé automatiquement en centaines de tables. L'unification et la réduction des doublons doivent précéder toute migration.