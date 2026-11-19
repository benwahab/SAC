# SAC — Étude et sélection du validateur WebAuthn pour Cloudflare Workers

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** recommandation technique documentée ; dépendance non installée ; aucun endpoint ni schéma D1 créé.  
**Décision produit déjà validée :** racine PWA WebAuthn mono-appareil, avec BE=0 et BS=0, sans prétendre à une certification matérielle.

## 1. Conclusion

**Recommandation : retenir `@simplewebauthn/server` comme candidat principal pour la vérification WebAuthn côté Cloudflare Pages Functions / Workers**, sous réserve d'un test d'intégration minimal et d'une revue des versions verrouillées avant toute utilisation dans le parcours d'enrôlement.

Ne pas installer la dépendance ni créer les tables D1 dans le cadre de cette étude. Le choix porte sur la bibliothèque de vérification serveur, pas sur l'architecture D1, le profil cryptographique final ou l'achèvement de l'enrôlement.

## 2. Comparaison des candidates

| Critère | `@simplewebauthn/server` | `@passwordless-id/webauthn` |
|---|---|---|
| Cloudflare Workers annoncé | Oui, explicitement dans la documentation/fiche JSR actuelle | Oui, explicitement dans le README |
| Vérification inscription + authentification | API dédiée `verifyRegistrationResponse` et `verifyAuthenticationResponse` | API dédiée `server.verifyRegistration` et `server.verifyAuthentication` |
| Origine, RP ID et challenge attendus | Paramètres explicites dans les fonctions de vérification | Vérification attendue documentée ; profil d'intégration à approfondir |
| Informations mono-appareil / sauvegarde | Retourne `credentialDeviceType` et `credentialBackedUp` après inscription | Les éléments publics consultés ne démontrent pas aussi clairement l'exposition structurée de ces deux valeurs |
| Écosystème et documentation | Documentation API détaillée, exemples d'inscription/authentification, versions récentes | Projet minimaliste, sans dépendance, documentation plus concise |
| Décision | **Candidat recommandé** | Alternative crédible, non retenue pour le premier prototype technique |

Cette comparaison n'est pas un audit de sécurité indépendant des bibliothèques.

## 3. Pourquoi SimpleWebAuthn

La documentation officielle décrit le cycle complet :
- génération des options d'inscription ;
- vérification de la réponse avec challenge, origine et RP ID attendus ;
- récupération de la credential, de son type d'appareil et de son indicateur de sauvegarde ;
- génération et vérification des options d'authentification, avec la credential publique et le compteur.

Les champs exposés après inscription permettent de construire un contrôle SAC explicite :
- accepter uniquement `credentialDeviceType === "singleDevice"` ;
- accepter uniquement `credentialBackedUp === false` ;
- rejeter toute autre combinaison ;
- ne jamais déduire la conformité de la seule réussite de `verified === true`.

La bibliothèque ne remplace pas la politique SAC : les valeurs doivent être contrôlées explicitement avant la création atomique de la racine.

## 4. Architecture d'intégration proposée

Dans les Pages Functions :
1. Le serveur crée et conserve une cérémonie d'inscription liée au compte, au challenge, à l'expiration et à l'origine/RP ID configurés.
2. Le client reçoit les options WebAuthn générées côté serveur et appelle l'API WebAuthn du navigateur.
3. Le serveur passe la réponse brute à `verifyRegistrationResponse` avec le challenge de la cérémonie, l'origine autorisée et le RP ID attendus.
4. Le serveur exige une vérification réussie, puis contrôle séparément le type `singleDevice` et `backedUp === false`.
5. La racine n'est enregistrée qu'après validation de toutes les préconditions et dans la transaction atomique D1 qui sera définie ultérieurement.
6. Pour chaque approbation d'appareil, le serveur utilise `verifyAuthenticationResponse` avec la credential racine, le challenge dérivé du transcript, l'origine et le RP ID attendus.
7. Les réponses d'erreur publiques restent génériques ; les détails sensibles ne sont jamais renvoyés au client ni consignés dans les journaux.

La configuration `rpID` et les origines autorisées doivent provenir d'une configuration serveur fixe et contrôlée, jamais d'un en-tête `Host`, d'un paramètre ou d'une valeur fournie librement par le client.

## 5. Limites importantes à ne pas masquer

- La bibliothèque vérifie les assertions WebAuthn côté serveur ; elle ne réalise pas à elle seule la vérification indépendante du transcript sur le nouvel appareil. Cette vérification cliente reste un composant séparé à spécifier, implémenter et tester avec des vecteurs indépendants.
- Les champs `credentialDeviceType` et `credentialBackedUp` doivent être interprétés conformément aux bits BE/BS ; ils ne prouvent pas StrongBox, TEE, Secure Enclave ni certification matérielle.
- Le compteur d'authentificateur peut rester à zéro selon l'authentificateur. Il ne doit pas devenir l'unique mécanisme anti-rejeu ; SAC conserve les challenges uniques, leur expiration, leur consommation atomique et les contrôles d'état.
- La compatibilité annoncée par le projet ne prouve pas encore que la version retenue fonctionne dans la configuration exacte de ce dépôt, de Pages Functions et de sa date de compatibilité. Un test Workers réel est obligatoire.
- La présence de `nodejs_compat` ne doit pas être présumée nécessaire ni ajoutée par réflexe. Le test doit d'abord vérifier le paquet dans le runtime cible et documenter toute option de compatibilité réellement requise.
- La bibliothèque ne résout ni l'atomicité D1, ni la révocation de racine, ni la récupération de compte, ni les sessions, ni les courses concurrentes.
- Le profil de preuve WebAuthn liée au transcript reste une proposition technique distincte ; ce document ne le valide pas.

## 6. Test technique obligatoire avant intégration

Créer ultérieurement une branche de travail ? **Non : le dépôt SAC conserve uniquement `main` conformément à la règle du projet.** Le test devra donc être réalisé dans une tranche isolée et réversible directement sur `main`, sans migration distante ni déploiement.

Le test doit couvrir au minimum :
- installation d'une version précise et verrouillée de `@simplewebauthn/server` ;
- compilation TypeScript des Pages Functions ;
- exécution réelle dans le runtime Workers local ;
- génération et vérification d'une réponse d'inscription de test ;
- rejet d'un challenge incorrect, expiré ou réutilisé ;
- rejet d'une origine et d'un RP ID incorrects ;
- rejet des credentials multi-appareils et des credentials sauvegardés ;
- contrôle du comportement de l'authentification et du compteur ;
- tests négatifs sur les champs manquants, les octets malformés et les erreurs CBOR/COSE ;
- preuve que la vérification du transcript n'accepte qu'une assertion liée au transcript exact ;
- aucune clé privée, assertion complète, OTP ou secret dans les logs.

Les tests unitaires synthétiques ne remplacent pas les essais sur téléphones Android physiques et navigateurs réellement ciblés.

## 7. Conditions de GO

L'intégration ne pourra être déclarée GO que lorsque :
1. le test Workers local passe avec la version exacte verrouillée ;
2. les contrôles BE/BS sont prouvés par des tests positifs et négatifs ;
3. les origines et RP ID sont fixes et strictement validés ;
4. les vecteurs indépendants du challenge lié au transcript passent ;
5. l'atomicité D1 et les scénarios de rejeu/concurrence sont définis et testés ;
6. les essais réels sur les appareils cibles confirment le comportement attendu.

**À ce stade : recommandation de bibliothèque = SimpleWebAuthn ; intégration = non commencée ; enrôlement racine = non opérationnel ; ajout d'appareil = non opérationnel.**

## 8. Sources officielles consultées

- SimpleWebAuthn, documentation serveur : https://simplewebauthn.dev/docs/packages/server/
- SimpleWebAuthn, versions JSR et runtimes annoncés : https://jsr.io/@simplewebauthn/server/versions
- SimpleWebAuthn, dépôt : https://github.com/MasterKale/SimpleWebAuthn
- Passwordless.ID, dépôt et compatibilité Workers annoncée : https://github.com/passwordless-id/webauthn
- Cloudflare Workers, Web Crypto : https://developers.cloudflare.com/workers/runtime-apis/web-crypto/

Consultation effectuée le 19 novembre 2026. Les versions et compatibilités devront être revérifiées au moment du test d'intégration.


## 9. Résultat du premier test runtime — 19 novembre 2026

**GO pour la compatibilité de base du paquet dans le runtime Workers local ; pas de GO pour l'intégration métier.**

Le dépôt contient maintenant un test isolé :
- `tests/workers/webauthn-smoke-worker.ts` ;
- `tests/wrangler.webauthn.toml` ;
- `tests/webauthn-workers-smoke.test.ts` ;
- commande `npm run test:webauthn-workers`.

Le workflow CI installe `@simplewebauthn/server@14.1.0` en dépendance temporaire de test avec `npm install --no-save --package-lock=false`. Le paquet n'a donc pas été ajouté aux dépendances applicatives de `package.json` et le lockfile de production n'a pas été modifié.

Résultat observé dans GitHub Actions :
- le module s'importe dans le Worker local ;
- `generateRegistrationOptions()` s'exécute dans le Worker ;
- le Worker retourne un challenge et les options attendues : RP ID, authentificateur de plateforme, clé résidente requise, vérification utilisateur requise et algorithme ES256 (-7) ;
- le chemin de vérification rejette une réponse volontairement invalide ;
- le reste du workflow (tests existants, typecheck, build, audit bloquant des dépendances de production et audit complet) passe également.

**Workflow complet :** [SAC quality checks — run 44474843292](https://github.com/benwahab/SAC/actions/runs/44474843292)  
**Commit testé :** `1e127db1704dcba386b439cfe2e19689fa50dec4`  
**Conclusion GitHub Actions :** `success`.

Ce test est un smoke test de runtime. Il ne prouve pas encore qu'une véritable attestation WebAuthn valide passe avec un authentificateur physique, ni que les contrôles BE/BS sont rejetés/acceptés correctement à partir de fixtures authentiques. Il ne teste pas la vérification complète des signatures d'inscription/authentification, l'approbation du transcript, les courses D1 ou le parcours réel Android.

La configuration du test reprend la date de compatibilité du dépôt (`2026-11-17`). Cloudflare active automatiquement la compatibilité Node.js pour les dates à partir du 4 août 2026 ; aucun drapeau supplémentaire n'a été ajouté. Référence : https://developers.cloudflare.com/workers/runtime-apis/nodejs/

**Décision technique actualisée :** conserver SimpleWebAuthn 14.1.0 comme candidat et poursuivre vers un test cryptographique complet avec des fixtures WebAuthn valides, avant d'ajouter la dépendance au runtime applicatif ou de créer les tables D1 d'enrôlement.


## 10. Test cryptographique complet avec fixtures générées — 19 novembre 2026

Le test runtime a été étendu avec des réponses WebAuthn cryptographiquement construites pendant le test, sans clé privée persistée dans le dépôt :
- génération éphémère d'une paire EC P-256 ;
- construction CBOR d'une clé publique COSE EC2/ES256/P-256 ;
- construction d'un objet d'attestation `fmt: none` avec authenticator data ;
- génération de `clientDataJSON` d'inscription ;
- signature ECDSA DER d'une assertion d'authentification sur `authenticatorData || SHA-256(clientDataJSON)` ;
- vérification de l'inscription et de l'authentification par SimpleWebAuthn **dans le Worker Cloudflare local**, pas seulement dans Node.

Cas couverts par la suite de fixtures :
- inscription ES256 valide et authentification signée valide ;
- `BE=0, BS=0` : classée `singleDevice`, `backedUp=false`, acceptée par la règle candidate de racine SAC ;
- `BE=1, BS=0` : classée `multiDevice`, refusée par la règle de racine ;
- `BE=1, BS=1` : classée `multiDevice` et sauvegardée, refusée ;
- `BE=0, BS=1` : rejetée ;
- challenge d'inscription incorrect ;
- origine d'inscription incorrecte ;
- RP ID d'inscription incorrect ;
- challenge, origine et RP ID d'authentification incorrects ;
- signature d'authentification altérée.

Le Worker vérifie explicitement le booléen `verified` renvoyé par chaque fonction. Un résultat `verified: false` ne doit jamais être interprété comme un succès, même si la fonction ne lève pas d'exception.

**Workflow complet réussi :** [SAC quality checks — run 44475318262](https://github.com/benwahab/SAC/actions/runs/44475318262)  
**Commit testé :** `613720b68176ef18b5b1b0b0f83687615e811a5a`  
**Résultat :** `success`. Le test WebAuthn, le typecheck, les tests existants, le build et les audits de dépendances sont passés.

Les tests supplémentaires de refus lorsque le flag UV est absent viennent d'être ajoutés et doivent encore être confirmés par le workflow suivant.

## 11. Découverte importante : residentKey et passkeys synchronisées sur Android

La documentation SimpleWebAuthn 14.1.x indique que `residentKey: "preferred"` et `"required"` conduisent à la création de passkeys synchronisées sur Android, tandis que `"discouraged"` évite ce comportement par défaut.

Le test Worker a donc été ajusté comme **expérience technique candidate** vers `residentKey: "discouraged"`, sans changer la décision produit validée. Le serveur doit dans tous les cas refuser toute inscription dont les flags ne démontrent pas `BE=0` et `BS=0`.

Cela ne garantit pas que tous les appareils Android fourniront une credential conforme. Les essais physiques restent nécessaires.

Source officielle : https://simplewebauthn.dev/docs/packages/server/#guiding-use-of-authenticators-via-authenticatorselection

## 12. Limites restant à lever

Ce test ne couvre pas encore :
- expiration, consommation atomique et rejeu d'un challenge conservé en D1 ;
- concurrence entre deux cérémonies d'enrôlement ;
- transaction D1 atomique de création de racine ;
- vérification indépendante du transcript sur le nouvel appareil ;
- authentificateurs physiques Android et navigateurs réels ;
- matrice de compatibilité Android/iOS/Desktop effectivement ciblée.

**Conclusion actuelle :** SimpleWebAuthn 14.1.0 a passé un test cryptographique positif/négatif complet de base dans le runtime Workers local, y compris les flags BE/BS et les signatures ES256. Cela autorise la poursuite vers les tests de protocole et d'état, mais ne donne pas encore le GO à l'enrôlement racine de production.
