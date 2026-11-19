# SAC — Décision d'intégration de SimpleWebAuthn dans Cloudflare Workers

- Date : 19 novembre 2026
- Dépôt : `benwahab/SAC`
- Cible : `main`
- Statut : décision technique de migration ; aucune activation de l'enrôlement autorisée.

## 1. Décision

Retenir `@simplewebauthn/server@14.1.0` comme bibliothèque de validation WebAuthn côté serveur, sous réserve d'une installation reproductible dans le dépôt et d'une validation effective du bundle Cloudflare Workers.

La documentation JSR de la version 14.1.0 déclare explicitement la compatibilité Cloudflare Workers. Le dépôt possède déjà un Worker de smoke test qui importe cette bibliothèque et exerce `generateRegistrationOptions`, `verifyRegistrationResponse` et `verifyAuthenticationResponse`. Ce smoke test est actuellement installé uniquement dans le job CI, pas comme dépendance de production.

Références :
- https://jsr.io/@simplewebauthn/server/versions
- https://jsr.io/@simplewebauthn/server/doc
- https://github.com/MasterKale/SimpleWebAuthn/blob/master/CHANGELOG.md

## 2. Pourquoi ne pas conserver le vérificateur artisanal

Le vérificateur actuel implémente lui-même le décodage CBOR, l'interprétation de l'attestation, le profil COSE et une partie des contrôles WebAuthn. Même limité au profil `none`/ES256, ce code crée une responsabilité cryptographique spécifique au projet et doit être remplacé par la bibliothèque maintenue.

Le vérificateur actuel ne doit donc pas être étendu pour implémenter les assertions de connexion.

## 3. Préserver le challenge actuellement stocké sous forme d'empreinte

Le challenge WebAuthn est un nonce public, non un secret d'authentification. Le schéma actuel conserve uniquement son SHA-256, avec expiration, consommation unique et liaison à la cérémonie.

Pour conserver cette propriété avec SimpleWebAuthn, utiliser le callback `expectedChallenge` accepté par la bibliothèque : le callback reçoit le challenge présenté, le décode en Base64URL canonique, calcule son SHA-256 et compare l'empreinte au digest D1 en temps constant. Ne pas réintroduire le challenge brut en base par commodité.

Le callback doit refuser toute chaîne malformée, trop longue ou non canonique et retourner false en cas d'erreur.

## 4. Données de credential à conserver

La vérification SimpleWebAuthn retourne les données nécessaires à la suite du protocole, notamment :
- identifiant credential ;
- clé publique COSE (`Uint8Array`) ;
- compteur de signature ;
- transports éventuels ;
- type d'appareil et indicateur de sauvegarde ;
- résultat de vérification utilisateur.

La migration actuelle stocke les coordonnées P-256 séparément (`public_key_x`, `public_key_y`). Pour transmettre la credential à `verifyAuthenticationResponse` sans reconstruire manuellement une clé COSE, ajouter une colonne dédiée à la clé publique COSE brute, avec contrôle de taille et encodage binaire cohérent. La clé publique est publique ; elle ne doit jamais être confondue avec une clé privée.

Ne pas supprimer les champs existants avant migration et tests de compatibilité. Toute migration doit rester additive, testée localement et non appliquée à distance sans autorisation.

## 5. Parcours d'enrôlement cible

1. Le serveur génère les options avec `generateRegistrationOptions`, profil limité à ES256, attestation `none`, authenticator de plateforme, vérification utilisateur obligatoire et RP/origines exacts.
2. Le serveur conserve le digest du challenge, l'origine exacte, le compte, l'expiration et l'état de cérémonie.
3. Le client déclenche `navigator.credentials.create()` depuis une action utilisateur.
4. Le serveur appelle `verifyRegistrationResponse` avec le challenge vérifié par callback, l'origine exacte, le RP ID attendu et `requireUserVerification: true`.
5. Le résultat passe ensuite par la politique SAC : credential single-device, non sauvegardée, vérification utilisateur vraie. La politique métier ne remplace pas la vérification cryptographique de la bibliothèque.
6. Credential, appareil, session et événement d'audit sont persistés dans une transaction atomique D1. Le challenge est consommé une seule fois.

## 6. Parcours de connexion cible

1. L'utilisateur fournit son identifiant de compte ; le serveur retrouve le compte sans révéler son existence.
2. Le serveur génère des options via `generateAuthenticationOptions` et un challenge à usage unique lié au compte et à la credential racine.
3. Le navigateur déclenche `navigator.credentials.get()`.
4. Le serveur relit la credential enregistrée et appelle `verifyAuthenticationResponse` avec challenge par callback, origine et RP ID exacts, `requireUserVerification: true`, et la credential persistée.
5. Le serveur vérifie le résultat et la politique SAC avant de créer une session liée à l'appareil.
6. Le compteur est mis à jour de façon conditionnelle et atomique avec la consommation du challenge et la création de session. Les compteurs constamment à zéro doivent rester compatibles avec les authenticators qui ne fournissent pas de compteur exploitable ; toute régression d'un compteur non nul est refusée.
7. Un challenge consommé, expiré, déjà utilisé ou lié à une autre origine ne peut jamais créer de session.

Aucune session ne doit être créée avant validation cryptographique réussie de l'assertion.

## 7. Dépendance et verrouillage reproductible

L'intégration runtime n'est pas encore faite. Le manifeste et le lockfile npm doivent être mis à jour ensemble avec une installation npm réelle et reproductible, puis `npm ci` doit réussir. Il ne faut pas éditer à la main un lockfile v3 incomplet ni contourner le verrouillage avec une installation réseau au démarrage.

Le job CI actuel installe la version 14.1.0 avec `--no-save --package-lock=false` uniquement pour le smoke test. Cette étape ne rend pas la bibliothèque disponible dans un déploiement de production et ne constitue pas une dépendance runtime.

Une tentative de clonage et d'installation npm dans l'environnement de travail de cette session a échoué car l'accès réseau au registre/GitHub n'était pas disponible. Aucun manifeste ni lockfile n'a donc été modifié. Reprendre cette étape depuis un environnement de développement disposant de npm et d'un accès réseau contrôlé ; conserver la version exacte 14.1.0 ou documenter une version ultérieure revue.

## 8. Conditions de sortie

Avant de remplacer le vérificateur ou d'ajouter les endpoints d'assertion :
- installation runtime verrouillée dans `package.json` et `package-lock.json` ;
- `npm ci` réussi ;
- smoke test Worker exécuté avec la dépendance réellement bundlée ;
- tests d'enrôlement valides et négatifs via SimpleWebAuthn ;
- tests d'assertion valides, challenge réutilisé, challenge expiré, origine/RP incorrects, UV absent, signature incorrecte, credential inconnue, compte/appareil suspendu ou révoqué, compteur en régression ;
- tests D1 d'atomicité et de concurrence ;
- revue indépendante du parcours complet.

Le verrou `WEBAUTHN_ROOT_ENROLLMENT_ENABLED` reste absent/désactivé. Ne pas appliquer la migration 0007 à distance, ne pas déployer et ne pas ouvrir les endpoints privés à ce stade.
