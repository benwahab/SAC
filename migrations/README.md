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
- un trigger D1 refuse toute nouvelle insertion qui ne déclare pas explicitement `pending` (le défaut historique `accepted` ne peut pas être utilisé par inadvertance) ;
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

## 0007 — credential racine, appareils et sessions

`0007_root_device_enrollment.sql` ajoute le premier parcours serveur d'enrôlement :
- cérémonie et challenge WebAuthn à usage unique, avec seule empreinte SHA-256 persistée et origine exacte liée à la cérémonie ;
- expiration après cinq minutes et cinq tentatives maximum ;
- une seule racine par compte, liée à une credential P-256 ES256 non synchronisable ;
- clé publique, compteur, type de credential et état de sauvegarde ;
- session opaque liée au compte et à l'appareil, jeton brut uniquement dans un cookie `__Host-` HttpOnly/Secure/SameSite=Strict ;
- événement d'audit de fin d'enrôlement dont le trigger refuse un parcours incomplet ;
- limite de tentatives par empreinte d'adresse e-mail, sans conserver l'adresse dans cette table.

Le parcours HTTP est exposé par :
- `POST /api/auth/root-enrollment-options` : mot de passe + e-mail vérifié, création du challenge et options WebAuthn ;
- `POST /api/auth/complete-root-enrollment` : vérification de l'attestation, consommation atomique du challenge, création de l'appareil, de la credential et de la première session ;
- `GET /api/auth/session` : vérification D1 de la session et de l'état courant du compte/appareil ;
- `POST /api/auth/logout` : révocation D1 et suppression du cookie.

Configuration Worker requise : `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME` et `WEBAUTHN_ALLOWED_ORIGINS` (tableau JSON d'origines HTTPS exactes). En leur absence, le parcours échoue fermé. Aucun domaine de production n'est présumé dans le code. Les deux routes d'enrôlement exigent aussi `WEBAUTHN_ROOT_ENROLLMENT_ENABLED="true"` ; en son absence elles répondent 503 avant tout accès D1. Ce verrou reste désactivé tant que la revue cryptographique indépendante, le choix du profil racine et les essais physiques ne sont pas validés. Ne pas l'activer sur un environnement réel à ce stade.

La vérification actuelle accepte exclusivement l'attestation WebAuthn `none`, la clé COSE EC2/P-256 ES256, UP=1, UV=1, BE=0 et BS=0. Les signatures d'attestation ne sont donc pas vérifiées (profil none) ; la possession de la clé privée sera prouvée lors de l'authentification WebAuthn ultérieure, qui reste une étape distincte à implémenter avant d'offrir la reconnexion par passkey.

Vérifications ajoutées :
- `npm run test:webauthn-root-verifier`
- `npm run test:d1-root-device-enrollment`

Cette migration n'a pas été appliquée à la base distante. Avant mise en production, configurer les origines réelles, appliquer les migrations après revue, puis réaliser des essais physiques Android/Chrome et vérifier la compatibilité du profil residentKey retenu.
