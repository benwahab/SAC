# Migrations D1

Les migrations sont versionnées dans ce dossier et doivent être testées avant toute application distante.

## 0001 — comptes et vérification e-mail

`0001_account_email_otp.sql` crée uniquement le premier périmètre d'authentification :
- comptes avec les cinq états validés ;
- identités e-mail et téléphone, téléphone restant non vérifié ;
- défis OTP e-mail avec empreinte HMAC, durée et compteur ;
- contraintes d'unicité et clés étrangères composites ;
- triggers SQLite qui appliquent le délai de renvoi, invalident le défi précédent, protègent le compteur et activent le compte dans la transaction de consommation réussie.

Les autres domaines SAC (appareils, sessions, contacts, alertes, trajets, groupes, outbox) ne sont pas créés par cette migration.

## 0006 — état de livraison OTP

`0006_email_otp_delivery_state.sql` ajoute un état de livraison aux défis OTP :
- les défis historiques sont conservés comme déjà acceptés ;
- les nouveaux défis sont créés en `pending` ;
- un échec fournisseur les marque `failed` sans invalider le code précédemment livré ;
- seule l'acceptation du nouveau courriel le rend vérifiable et invalide l'ancien défi ;
- le parcours de vérification ne sélectionne que les défis acceptés ;
- les tentatives ne peuvent pas être consommées sur un défi en attente ou non livré.

Le délai minimal de 60 secondes continue de s'appliquer à toute création de défi, y compris une tentative de livraison échouée.

## Vérification locale

1. Exécuter `python3 tests/d1_email_otp_schema.test.py` pour tester le schéma et ses triggers SQLite.
2. Exécuter `npx wrangler d1 migrations apply sac-db --local`.
3. Vérifier le schéma local et exécuter les scénarios d'intégration avant toute demande de migration distante.

La base distante `sac-db` ne doit pas être modifiée par une commande locale ou un déploiement implicite.

## Application distante

Commande de référence, **non exécutée** :

`npx wrangler d1 migrations apply sac-db --remote`

Elle nécessite une revue dédiée, la confirmation de l'environnement cible et l'autorisation explicite du propriétaire. Ne jamais appliquer une migration distante depuis cette documentation seule.
