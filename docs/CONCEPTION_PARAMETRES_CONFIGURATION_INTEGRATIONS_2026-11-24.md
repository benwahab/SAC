# SAC — Conception Paramètres, configuration et intégrations

**Date :** 24 novembre 2026  
**Dépôt :** benwahab/SAC — branche main  
**Statut :** conception fonctionnelle ; aucune configuration sensible ou intégration fournisseur n'est modifiable depuis cette rubrique.

## 1. Objectif

La rubrique Paramètres centralise les réglages autorisés de SAC sans exposer les secrets Cloudflare ni permettre à un délégué de modifier la sécurité, les fournisseurs ou les fonctions globales.

## 2. Domaines de configuration

- organisation : nom légal, unités, établissements et coordonnées publiques ;
- langues : français, anglais et arabe, langue par défaut et préférences ;
- formats : fuseau horaire, dates, heures, numéros et devises ;
- notifications : canaux autorisés, modèles, préférences et limites ;
- sécurité : politiques de session, appareils, WebAuthn, OTP, rétention et accès ;
- intégrations : fournisseur e-mail, Push, Mobile Money éventuel, stockage et services techniques ;
- fonctions : activation contrôlée des modules et fonctions expérimentales ;
- versions : version applicative, migrations attendues, état de déploiement et maintenance.

## 3. Séparation des paramètres et secrets

Les valeurs non sensibles peuvent être stockées en D1 avec validation, version et historique. Les secrets, clés privées, tokens, clés API et secrets cryptographiques restent dans les secrets Cloudflare ou les environnements dédiés.

L'interface ne doit jamais relire ni afficher la valeur d'un secret. Elle peut afficher uniquement son état de configuration (présent/absent), la date de dernière modification et le fournisseur associé. Le remplacement d'un secret est une opération dédiée et ne retourne jamais sa valeur.

## 4. Gouvernance des changements

Chaque modification enregistre :
- acteur et appareil ;
- clé du paramètre et périmètre ;
- ancienne et nouvelle valeur non sensible ;
- justification ;
- date, version et résultat ;
- approbation supplémentaire si la politique l'exige.

Les changements critiques (sécurité, authentification, paiements, rétention, activation publique, intégrations) sont protégés par confirmation renforcée et peuvent exiger une seconde approbation. Un délégué ne peut jamais changer les permissions, créer un secret, activer une fonction globale ou modifier le périmètre d'un autre compte.

Les changements doivent être réversibles lorsque c'est possible. Les paramètres de sécurité et historiques sont append-only ou versionnés ; aucune suppression silencieuse.

## 5. Activation de fonctionnalités

Une fonction est activée seulement si :
- les migrations requises sont appliquées dans l'environnement visé ;
- les secrets et fournisseurs nécessaires sont configurés ;
- les tests de sécurité et métier passent ;
- les conditions d'exploitation et de support sont documentées ;
- l'autorisation du Super Admin est enregistrée.

Un simple booléen UI ne doit jamais activer une API non préparée. Les gardes serveur vérifient également les paramètres d'environnement et la disponibilité du schéma. En cas d'incertitude, la fonction échoue fermée.

## 6. Permissions

- settings.read : consulter les réglages autorisés ;
- settings.update_general : modifier les préférences non sensibles ;
- settings.manage_integrations : gérer les paramètres non secrets d'intégration ;
- settings.manage_features : proposer/activer une fonction selon politique ;
- settings.manage_security : réservé au Super Admin ;
- settings.manage_secrets : réservé aux opérations sécurisées hors lecture UI ;
- settings.export : exporter l'historique autorisé.

Le Super Admin conserve le contrôle global. Les délégués peuvent recevoir des permissions de lecture ou d'édition limitées de paramètres non critiques si une mission l'autorise explicitement.

## 7. Modèle de données candidat

À harmoniser avant migration :
- system_settings ;
- setting_versions ;
- setting_change_events ;
- feature_registry ;
- integration_registry ;
- integration_health_checks ;
- maintenance_windows ;
- release_records.

Les secrets ne sont jamais stockés dans ces tables. Les identités, missions, événements d'audit, documents et données de santé des services sont réutilisés.

## 8. Écrans prévus

- profil organisationnel et unités ;
- langues et formats régionaux ;
- notifications et modèles ;
- intégrations et état de configuration ;
- fonctions disponibles et conditions d'activation ;
- sécurité et politiques réservées au Super Admin ;
- versions, maintenance et état des services ;
- historique des changements.

Aucune valeur secrète, aucun faux état fournisseur et aucun statut de déploiement non vérifié ne doit être affiché.

## 9. Conditions avant activation

Confirmer les personnes autorisées, les paramètres modifiables, les règles d'approbation, les environnements, les fournisseurs réels, les secrets attendus et les procédures de rollback. Les modifications de paramètres doivent être testées et auditées avant exposition.

Aucune migration ni fonction d'administration des secrets n'est créée par cette note. La rubrique reste non opérationnelle jusqu'à validation des règles, du modèle D1 et des tests.
