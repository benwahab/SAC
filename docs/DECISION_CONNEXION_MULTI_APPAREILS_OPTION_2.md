# SAC — Décision produit : connexion multi-appareils par mot de passe (Option 2)

**Date :** 21 novembre 2026
**Statut :** décision produit explicite du propriétaire. **Non homologuée par une revue de sécurité indépendante.**
**Portée :** autoriser un nouvel appareil à ouvrir une session avec l'adresse e-mail vérifiée et le mot de passe du compte, sans QR et sans approbation WebAuthn d'un autre appareil.

## 1. Décision

L'Option 2 est retenue :

- un appareil peut se connecter directement avec **e-mail vérifié + mot de passe** ;
- le QR et la comparaison des mots ne sont pas exigés pour cette voie ;
- l'approbation par le téléphone principal n'est pas exigée pour cette voie ;
- une seule credential WebAuthn racine reste autorisée par compte ;
- la session est créée côté serveur après vérification du mot de passe et de l'état du compte.

Cette décision modifie le modèle précédent « seule la racine approuve un secondaire » pour les comptes qui utilisent cette voie. Elle ne doit pas être présentée comme aussi forte que l'Option 1.

## 2. Risques acceptés

- un mot de passe volé suffit pour ouvrir une session sur un nouvel appareil ;
- le vol de la boîte e-mail et du mot de passe augmente le risque ;
- la révocation d'un appareil ne bloque pas une nouvelle connexion par mot de passe ;
- il n'y a pas de comparaison indépendante entre les appareils ;
- le QR ne peut plus servir de preuve de proximité puisqu'il n'est pas utilisé ;
- la révocation globale et la récupération de compte restent des sujets distincts non résolus.

## 3. Ce qui reste obligatoire

- mot de passe vérifié avec le hash existant ;
- compte `active` ;
- adresse e-mail principale vérifiée ;
- limite de tentatives existante ;
- cookie de session `__Host-sac_session` HttpOnly, Secure, SameSite=Strict ;
- vérification D1 de la session et de l'état du compte/appareil à chaque réquête ;
- une seule credential racine par compte ;
- aucune session si le compte est suspendu, en supretion ou supprimé ;
- aucun secret, OTP ou mot de passe dans les logs.

## 4. Mise en œuvre préparée

- migration `0020_multi_device_password_login.sql` : supprime l'index `devices_one_root_per_account`, garde l'unicité d'une credential racine par compte, ajoute un index compte/statut ;
- `functions/lib/security/device-cookie.ts` : cookie d'identité d'appareil non authentifiant, pour réutiliser la ligne `devices` d'un même navigateur ;
- `functions/api/auth/password-session.ts` : nouveau chemin derrière `MULTI_DEVICE_PASSWORD_LOGIN_ENABLED="true"` ;
- `functions/api/auth/session.ts` : l'état « clé de sécurité configurée » est évalué au niveau du compte, pas seulement de l'appareil ;
- tests : `test:password-session`, `test:d1-multi-device-password-login`.

## 5. Activation

La fonctionnalité reste **désactivée par défaut**. Pour l'activer :

1. sauvegarder la base D1 ;
2. vérifier qu'il n'y a pas plus d'une credential racine par compte ;
3. appliquer `0020_multi_device_password_login.sql` sur l'environnement cible ;
4. vérifier `PRAGMA foreign_key_check` et les index ;
5. définir `MULTI_DEVICE_PASSWORD_LOGIN_ENABLED="true"` ;
6. déployer le code ;
7. tester un compte sans clé, un compte avec clé, un appareil révoqué et une course de connexion.

Aucune migration distante ne doit être appliquée par un déploiement implicite.

## 6. Retour arrière

- désactiver le drapeau ;
- ne pas recréer `devices_one_root_per_account` avant d'avoir vérifié qu'il n'y a qu'un appareil actif par compte ;
- une fois plusieurs appareils créés, le retour arrière de schéma nécessite une déduplication explicitement autorisée.

## 7. Verdict

**Option 2 : décidée et préparée.**
**Migration : non appliquée.**
**Drapeau : désactivé.**
**Production : non activée.**
**Revue de sécurité indépendante : requise avant activation.**
