# SAC — Conception Relations externes, partenaires et conventions

**Date :** 24 novembre 2026  
**Dépôt :** benwahab/SAC — branche main  
**Statut :** conception fonctionnelle et sécurité ; aucune table D1 ni fiche partenaire réelle activée.

## 1. Objectif

Centraliser les relations institutionnelles et professionnelles de SAC :
- organismes publics et collectivités ;
- partenaires techniques et financiers ;
- associations et organisations de la société civile ;
- prestataires et fournisseurs, avec lien vers le référentiel financier/logistique plutôt que duplication ;
- conventions, accords, protocoles et engagements ;
- candidatures, demandes de partenariat et correspondances.

Cette rubrique ne doit pas devenir un annuaire public. Les coordonnées personnelles et documents contractuels sont accessibles uniquement selon mission.

## 2. Référentiel partenaire

Une fiche organisation peut contenir :
- identifiant opaque et référence interne non séquentielle ;
- nom officiel, type d'organisation, pays et zone d'intervention ;
- statut de relation : prospect, en discussion, actif, suspendu, terminé ;
- domaine de coopération et objectifs ;
- responsable SAC et unité interne ;
- contacts professionnels avec visibilité contrôlée ;
- source de la relation, date d'entrée et dernière activité ;
- documents de vérification et statut de conformité.

Les personnes physiques ne sont pas confondues avec les organisations. Les doublons sont détectés par identifiants légaux validés ou rapprochement assisté, jamais fusionnés automatiquement.

## 3. Conventions et engagements

Chaque convention doit suivre un cycle contrôlé :
brouillon → revue interne → validation juridique → approbation → signature → active → échéance/renouvellement → clôturée ou résiliée.

Champs utiles :
- référence interne ;
- parties et organisations liées ;
- objet, périmètre, durée et dates clés ;
- obligations réciproques, livrables et responsables ;
- budget ou contribution éventuelle, avec lien vers Finances ;
- indicateurs de suivi ;
- statut juridique et statut opérationnel ;
- documents signés et versions ;
- rappels d'échéance et historique.

Une convention signée ne peut pas être remplacée silencieusement. Un avenant crée une nouvelle version et garde le lien vers la version antérieure.

## 4. Activités et correspondances

Le module pourra tracer :
- réunions, visites, ateliers et événements ;
- comptes rendus et décisions ;
- courriers entrants/sortants ;
- tâches et engagements issus des réunions ;
- échéances et relances ;
- historique de relation.

Le calendrier, la messagerie, les tâches et le service documentaire commun sont réutilisés. Il ne faut pas créer des systèmes parallèles pour chaque écran.

## 5. Permissions

Permissions distinctes recommandées :
- partners.read / create / update / archive ;
- agreements.read / create / review / approve / close ;
- correspondence.read / create / send ;
- partner_contacts.read ;
- partner_documents.read / upload / export.

Les collaborateurs voient uniquement les partenaires et conventions de leur mission et de leur unité. Une personne ne peut pas approuver sa propre convention lorsque la politique de séparation des fonctions l'interdit. Les exports sont séparés des droits de lecture et journalisés.

## 6. Confidentialité et sécurité

- Les coordonnées directes des contacts sont masquées par défaut dans les listes.
- Les documents signés et pièces juridiques sont stockés dans le registre documentaire privé ; les URL de stockage ne sont jamais publiques.
- Les accès, consultations de pièces, modifications, validations et exports sont audités.
- Les données bancaires sont gérées par Finances, pas dupliquées dans la fiche partenaire.
- Les dossiers RH, les alertes SOS, les proches et les données GPS sont hors périmètre.
- Les données personnelles des contacts ont une finalité, une base de conservation et un processus de rectification/suppression documentés.

## 7. Modèle D1 candidat

À harmoniser avant migration :
- partner_organizations ;
- partner_contacts ;
- partner_relationships ;
- partner_activities ;
- partner_agreements ;
- partner_agreement_versions ;
- partner_obligations ;
- partner_deliverables ;
- partner_correspondence ;
- partner_events.

Le système documentaire, les missions, les identités, les événements d'audit, le calendrier et les tâches doivent être réutilisés. Ne pas dupliquer fournisseurs, budgets, factures ou paiements déjà gérés par Finances/Logistique.

## 8. Écrans prévus

- tableau de bord : relations actives, conventions à échéance, dossiers en revue ;
- partenaires : répertoire filtré par type, zone, statut et responsable ;
- fiche partenaire : contacts, historique, activités et documents autorisés ;
- conventions : cycle de revue, validation, signature et renouvellement ;
- correspondances : courrier, compte rendu et suivi ;
- candidatures : réception, évaluation et décision.

Aucun chiffre ou partenaire de démonstration ne doit apparaître comme donnée réelle.

## 9. Conditions avant activation

Confirmer :
1. les catégories de partenaires et les champs obligatoires ;
2. le circuit de revue juridique et les personnes habilitées ;
3. les règles de signature et de versionnement ;
4. les données de contact autorisées et leur conservation ;
5. les liens avec Finances, Logistique, Documents, Calendrier et Tâches ;
6. les missions, unités et permissions des collaborateurs.

Aucune migration D1 ni fiche partenaire fictive n'est créée par cette note. Le module reste non opérationnel jusqu'à la validation du modèle commun, des autorisations et des tests.
