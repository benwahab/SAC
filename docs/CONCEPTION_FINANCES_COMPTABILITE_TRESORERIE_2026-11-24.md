# SAC — Conception du module Finances, comptabilité et trésorerie

**Date :** 24 novembre 2026  
**Dépôt :** benwahab/SAC — branche main  
**Statut :** conception et règles de contrôle ; aucune table financière D1, écriture comptable, caisse, paiement ou connexion bancaire n'est activée.

## 1. Objectif et périmètre

Le module Finances doit fournir une source de vérité contrôlée pour :
- budgets et révisions ;
- recettes, dépenses et engagements ;
- factures, avoirs et paiements ;
- trésorerie, caisses et rapprochements ;
- écritures comptables et clôtures ;
- approbations financières ;
- rapports financiers et prévisions.

La paie et les informations salariales restent sous contrôle RH avec un accès financier strictement limité. Les données de paiement des citoyens, les secrets bancaires et les informations privées SOS ne doivent pas apparaître dans les vues générales.

## 2. Principes non négociables

1. **Aucune donnée fictive :** les cartes et rapports affichent les montants réellement enregistrés, sinon zéro ou « indisponible ».
2. **Devise explicite :** chaque montant porte un code ISO 4217. XOF peut être configuré comme devise principale après validation de la structure, sans empêcher une devise étrangère si nécessaire.
3. **Pas de flottants :** stocker les montants dans une représentation entière en unité mineure ou dans une représentation décimale exacte contrôlée ; ne jamais calculer de montants financiers avec float/REAL.
4. **Partie double :** toute écriture comptabilisée équilibre les débits et crédits dans la même devise.
5. **Journal immuable :** une écriture comptabilisée n'est pas modifiée ou supprimée ; une correction se fait par extourne et nouvelle écriture liée.
6. **Séparation des fonctions :** le créateur, le vérificateur, l'approbateur et le payeur ne peuvent pas être la même personne lorsque la politique exige une double validation.
7. **Traçabilité :** chaque création, modification d'état, approbation, paiement, rapprochement et export est audité.
8. **Périmètre serveur :** les droits sont vérifiés à chaque API selon mission, action, ressource, seuil financier et période.
9. **Aucune intégration implicite :** une caisse, banque ou Mobile Money n'est considérée comme connectée qu'après configuration et test fournisseur explicites.

## 3. Modèle métier cible

Les entités suivantes sont un modèle conceptuel à harmoniser avant migration D1 ; ce ne sont pas des tables déjà présentes.

### 3.1 Référentiels
- entités légales, établissements, départements et centres de coûts ;
- exercices et périodes comptables ;
- devises et règles d'arrondi ;
- plan comptable validé pour l'entité et la juridiction ;
- journaux comptables, catégories et sources de recettes/dépenses ;
- fournisseurs, bénéficiaires et tiers, avec accès aux coordonnées bancaires limité.

### 3.2 Budgets
- budget annuel ou pluriannuel ;
- lignes par centre de coûts, catégorie et période ;
- allocations, engagements et consommations ;
- révisions versionnées et approuvées ;
- réservations et dépassements soumis à approbation.

Distinguer explicitement : budget initial, budget révisé, disponible, engagé, facturé, payé et prévisionnel. Un engagement n'est pas un paiement.

### 3.3 Dépenses et recettes
- demande initiale et justification ;
- pièces documentaires liées au registre central de documents ;
- fournisseur ou source de recette ;
- catégorie, centre de coûts, devise et montant ;
- étapes de validation ;
- facture ou justificatif ;
- paiement(s) partiel(s) ou total ;
- avoir, annulation, remboursement ou litige ;
- journal d'événements append-only.

Une recette annoncée ou attendue n'est pas une recette encaissée. Une dépense approuvée n'est pas une dépense payée.

### 3.4 Trésorerie
- comptes financiers et caisses physiques ;
- portefeuilles Mobile Money configurés ;
- transactions et transferts internes ;
- rapprochements bancaires et de caisse ;
- prévisions de trésorerie et engagements attendus.

Un transfert entre deux comptes propres n'est ni une nouvelle recette ni une dépense. Les numéros complets de comptes, références sensibles et secrets fournisseurs sont masqués ou absents des vues de direction.

### 3.5 Comptabilité générale
- plan de comptes versionné ;
- journaux et pièces ;
- écritures et lignes débit/crédit ;
- périodes ouvertes, verrouillées et clôturées ;
- balances, grand livre et états financiers ;
- extournes et écritures de régularisation.

La règle d'équilibre est vérifiée dans la transaction D1 qui comptabilise l'écriture. Les écritures postées et leurs lignes sont append-only. Une clôture de période verrouille les écritures rétroactives, sauf procédure de réouverture tracée.

### 3.6 Factures et paiements
- facture et lignes ;
- taxes calculées selon des règles validées et versionnées ;
- échéances ;
- paiements et allocations de paiement ;
- avoirs et remboursements.

Le système doit prévenir les doublons de facture et de paiement, les écarts commande/réception/facture, les changements suspects de coordonnées bancaires et les paiements déjà effectués.

### 3.7 Approbations
- politiques par montant, catégorie, centre de coûts et entité ;
- seuils versionnés ;
- demandes d'approbation et historique ;
- refus motivé, retour pour correction et délégation temporaire autorisée ;
- verrou contre l'auto-approbation lorsque la règle l'interdit.

Les seuils, les personnes habilitées et la double validation sont à configurer par le Super Admin après validation de la gouvernance réelle.

## 4. Permissions recommandées

Permissions séparées, jamais un rôle financier global :
- finance.read : consulter les données autorisées ;
- finance.create : créer demandes et brouillons ;
- finance.update : modifier un brouillon non validé ;
- finance.submit : soumettre pour validation ;
- finance.approve : approuver dans les limites attribuées ;
- finance.pay : enregistrer ou déclencher un paiement selon fournisseur autorisé ;
- finance.reconcile : effectuer les rapprochements ;
- finance.close_period : verrouiller une période ;
- finance.export : exporter selon périmètre.

Le Super Admin conserve le contrôle total. Un délégué ne peut jamais s'accorder de permission, modifier son plafond, changer son périmètre ou déléguer une mission. Les droits expirés, suspendus ou révoqués cessent d'être effectifs côté serveur immédiatement.

## 5. Confidentialité et sécurité

- Les coordonnées bancaires sont chiffrées au repos et masquées par défaut.
- Les secrets API et clés Mobile Money restent dans les secrets Cloudflare, jamais dans D1 en clair ni dans Git.
- Les exports financiers sont soumis à permission distincte, bornés, tracés et neutralisent les formules de tableur.
- Les détails de paie sont invisibles aux rôles financiers ordinaires.
- Les informations personnelles des citoyens et les données SOS sont hors du domaine financier.
- Les documents justificatifs utilisent le système documentaire central, stockage privé et politique de conservation dédiée.
- Les journaux financiers ne contiennent pas de mot de passe, OTP, clé, numéro de carte ou secret bancaire.

## 6. Architecture D1 cible

Tables conceptuelles à regrouper et harmoniser avec l'annexe des services :
- référentiels : financial_entities, financial_periods, currencies, accounting_accounts, accounting_journals, cost_centers ;
- budgets : budgets, budget_lines, budget_revisions, budget_commitments ;
- opérations : financial_documents, expenses, revenues, invoices, invoice_lines, payments, payment_allocations, credit_notes ;
- trésorerie : financial_accounts, cash_registers, financial_transactions, internal_transfers, reconciliations ;
- comptabilité : accounting_entries, accounting_entry_lines, accounting_period_closures, accounting_reversals ;
- contrôle : financial_approval_policies, financial_approval_requests, financial_approval_history, financial_audit_events.

Ne pas créer une table par écran ou par type de rapport. Les entités communes, documents, identités, missions et événements doivent être réutilisés. Les contraintes, index, triggers, montants exacts et transactions atomiques doivent être testés dans une D1 locale isolée.

## 7. Écrans du dashboard

- synthèse : trésorerie disponible, recettes encaissées, dépenses payées, engagements et alertes de rapprochement ;
- budgets : consommation, disponibilité et dépassements ;
- dépenses : demandes, approbations, factures et paiements ;
- recettes : attendues, encaissées, impayées et remboursées ;
- trésorerie : comptes masqués, mouvements, caisses et rapprochements ;
- comptabilité : écritures, journaux, balance, grand livre et périodes ;
- rapports : périodes, centres de coûts, devises et exports autorisés.

Chaque indicateur doit préciser sa période, sa devise et son état de validation. Les prévisions sont séparées des montants exécutés.

## 8. Conditions avant mise en œuvre

Avant de créer une migration D1 ou d'activer les paiements, confirmer :
1. la structure juridique, les entités et le référentiel comptable applicable ;
2. les devises utilisées et la devise de reporting ;
3. les centres de coûts, catégories et circuits de validation ;
4. les seuils de paiement et les règles de double approbation ;
5. les banques, caisses et fournisseurs Mobile Money réellement utilisés ;
6. les règles de clôture, conservation, pièces justificatives et exports ;
7. les rôles exacts et la séparation des fonctions.

Aucune migration financière ni opération de paiement n'est créée par cette note. Le dashboard doit rester explicitement non opérationnel tant que ces prérequis, le modèle D1, les tests et les autorisations ne sont pas validés.
