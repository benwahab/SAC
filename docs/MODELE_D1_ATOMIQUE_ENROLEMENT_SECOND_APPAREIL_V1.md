# SAC — Modèle D1 atomique de l'enrôlement secondaire V1

**Date :** 21 novembre 2026
**Statut :** modèle candidat prouvé dans un environnement D1 local isolé. **Aucune migration de production, aucune API et aucune activation réelle.**
**Dépendances :** `HOMOLOGATION_ENROLEMENT_SECOND_APPAREIL_V1.md`, `SCHEMA_CANDIDAT_TRANSCRIPT_ENROLEMENT_V1.md`, `CONTRATS_OPERATIONS_ADMIN_ATOMIQUES.md`, `CONTRAT_RESILIENCE_CONTINUITE_ET_REPRISE_INCIDENT.md`.

## 1. Objectif

Démontrer qu'une approbation d'appareil secondaire peut être :

- autorisée uniquement par une racine active ;
- liée à un transcript et à un défi consommés une seule fois ;
- atomique avec l'activation de l'appareil, le certificat, l'audit et l'idempotence ;
- annulée si une précondition échoue ;
- non rejouable après une réponse perdue ;
- cohérente en cas de course avec la révocation de la racine.

Le modèle est volontairement isolé sous `tests/`. Il ne doit pas être copié en migration de production sans arbitrage et autorisation distincte.

## 2. Tables candidates

Le fixture `tests/d1-secondary-enrollment/migrations/0001_secondary_enrollment_test.sql` définit :

- `test_devices` avec `role` (`root`/`secondary`) et `status` (`pending`/`active`/`revoked`) ;
- un index unique partiel garantissant **une seule racine par compte** ;
- un index unique partiel garantissant **une seule cérémonie pending par compte** ;
- `test_enrollment_ceremonies` liée au compte, à la racine et au nouvel appareil ;
- `test_enrollment_challenges` avec digest, expiration et consommation unique ;
- `test_device_certificates` immuable et unique par cérémonie/appareil ;
- `test_enrollment_idempotency` avec clé par compte et hash de requête ;
- `test_enrollment_audit` append-only ;
- des gardes de commit et de révocation contraintes par `CHECK`.

## 3. Transaction d'approbation

L'ordre prouvé est :

1. consommer le défi avec `consumed_at IS NULL` et `expires_at > now` ;
2. activer l'appareil secondaire `pending -> active`, seulement si la racine est active et la cérémonie pending ;
3. insérer le certificat, seulement si le transcript hash correspond et que le défi est consommé ;
4. passer la cérémonie `pending -> approved`, seulement si le certificat et l'appareil actif existent ;
5. écrire l'audit append-only ;
6. insérer une garde de commit `CHECK (accepted_rows = 1)` ;
7. enregistrer le résultat idempotent.

Si une étape conditionnelle n'écrit aucune ligne, la garde insère `0` et la contrainte `CHECK` force D1 à annuler tout le batch. Les tests couvrent un échec après consommation du défi et après activation de l'appareil.

## 4. Idempotence

La clé d'idempotence est liée au compte. Le hash de requête couvre le compte, la cérémonie, le défi, le digest, la racine, le nouvel appareil et le transcript. Une même clé avec le même hash renvoie le résultat enregistré. Une même clé avec un contenu différent est refusée.

Deux requêtes concurrentes avec la même clé produisent un seul certificat et un seul audit ; la seconde est rejouée ou refusée sans nouvel effet.

## 5. Course avec la révocation

La révocation de la racine :

- révoque la racine ;
- révoque tous les appareils secondaires actifs ;
- rejette les cérémonies pending ;
- vérifie dans une garde que la racine a bien été révoquée, sinon le batch est annulé.

Si l'approbation gagne la course, la révocation suivante révoque le nouvel appareil. Si la révocation gagne, l'approbation échoue et ne consomme pas le défi. Le test vérifie qu'aucun appareil secondaire ne reste actif sous une racine révoquée.

## 6. Anti-restauration

Le fixture D1 ne prouve pas la non-résurrection après restauration. Le modèle indépendant existant `tests/anti-rollback-model.test.ts` montre la propriété attendue : une projection D1 restaurée doit être détectée par une ancre indépendante, puis réconciliée avant remise en service.

Avant toute production, il faut :

- choisir l'autorité d'ancrage indépendante ;
- définir la séquence, le hash chaîné et l'idempotence des commandes ;
- prouver la réconciliation d'une sauvegarde D1 antérieure à une activation ou à une révocation ;
- refuser le trafic tant que la projection n'est pas synchronisée ;
- tester la restauration réelle, pas seulement le modèle.

Sans cette preuve, le verdict reste NO-GO.

## 7. Écarts avec le schéma de production

Le schéma actuel `migrations/0007_root_device_enrollment.sql` contient `devices_one_root_per_account`, un index unique sur `account_id` qui empêche plusieurs appareils. Une future migration devrait :

- remplacer cet index par un index unique partiel `role = 'root'` ;
- ajouter `role`, `status = 'pending'` et les transitions associées ;
- ajouter les tables de cérémonie secondaire, défi, certificat, idempotence et audit ;
- préserver les triggers de révocation et de session ;
- ne jamais réactiver une ressource après restauration.

Ce document ne contient aucune migration de production et n'autorise pas cette évolution.

## 8. Preuves exécutées

`npm run test:d1-secondary-enrollment` vérifie :

- approbation nominale atomique ;
- rejeu idempotent ;
- conflit de clé avec contenu différent ;
- huit approbations concurrentes, un seul gagnant ;
- deux approbations concurrentes avec la même clé ;
- mauvais digest et mauvais transcript, avec rollback complet ;
- défi expiré ;
- une seule cérémonie pending par compte ;
- révocation préalable de la racine ;
- course approbation/révocation.

## 9. Verdict

**Atomicité D1 locale : démontrée dans le fixture.**
**Idempotence et rollback : démontrés dans le fixture.**
**Anti-restauration : non démontrée en conditions réelles.**
**Migration de production, API et activation : NON AUTORISÉES.**
**Enrôlement secondaire réel : NON HOMOLOGUÉ POUR LA PRODUCTION.**
