# SAC — Annexe d’évaluation ECDSA P-256 et formats de signatures

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** évaluation technique et vecteurs de test — aucune homologation cryptographique, aucun protocole d’enrôlement activé.

## 1. Portée

Cette annexe évalue la piste déjà présente dans les documents SAC : ECDSA sur P-256 avec SHA-256. Elle ne transforme pas cette piste en décision définitive et ne permet pas d’activer des appareils.

Les objectifs sont :
- distinguer les formats de signature binaires réellement utilisés par les API ;
- établir un vecteur P-256 vérifiable indépendamment ;
- tester la sortie Web Crypto dans Node.js et le runtime local Cloudflare Workers ;
- identifier les conversions nécessaires pour Android et iOS ;
- documenter l’effet de la malléabilité ECDSA et de la règle low-S.

## 2. Constat sur les formats

### 2.1 Web Crypto — format brut fixe

Pour ECDSA P-256, la spécification Web Cryptography définit la signature comme la concaténation de deux entiers de 32 octets, dans l’ordre `r || s`. Le résultat est donc exactement 64 octets, big-endian, sans encodage ASN.1/DER.

Le profil ES256 de RFC 7518 définit la même représentation : deux entiers non signés de 32 octets, chacun conservant ses zéros initiaux si nécessaire, concaténés dans l’ordre R puis S. Une signature qui ne fait pas 64 octets est invalide pour ES256.

### 2.2 Apple CryptoKit

L’API CryptoKit P-256 expose deux représentations explicites pour `ECDSASignature` :
- `rawRepresentation` ;
- `derRepresentation`.

Il faut sélectionner et vérifier explicitement la représentation utilisée par le pont natif iOS. Les documentations Apple décrivent les deux formes, mais aucun test sur un appareil iOS réel n’a encore été exécuté pour SAC.

Pour les clés publiques, le format d'export natif iOS reste à sélectionner et à tester sur appareil. Il ne doit pas être supposé identique au JWK Web Crypto.

### 2.3 Android Keystore / Java Signature

La documentation Android montre l’usage de `Signature.getInstance("SHA256withECDSA")` avec Android Keystore. L’API Java précise toutefois que le format des octets dépend du schéma et du fournisseur cryptographique ; la documentation Android ne fixe pas à elle seule une représentation binaire universelle.

Le format ASN.1 ECDSA couramment utilisé dans les environnements Java/X.509 est une séquence DER contenant deux entiers `r` et `s`. Il ne faut donc pas supposer que les octets retournés par chaque fournisseur Android sont déjà au format brut 64 octets. Cela doit être mesuré sur les versions et fournisseurs réellement ciblés.

Pour les clés publiques, la représentation fournie par Android Keystore et le fournisseur cryptographique doit être mesurée sur les versions réellement ciblées ; elle ne doit pas être supposée identique au JWK Web Crypto.

### 2.4 Formats à ne jamais confondre

| Représentation | Description | P-256 |
|---|---|---:|
| Raw / IEEE P1363 / ES256 | `r[32] || s[32]`, big-endian | 64 octets |
| ASN.1 DER | `SEQUENCE(INTEGER r, INTEGER s)` | longueur variable |
| JWK public | Objet JSON avec `kty`, `crv`, `x`, `y` | coordonnées base64url |
| X9.63 non compressé | `04 || x[32] || y[32]` | 65 octets |
| SPKI DER | Clé publique enveloppée dans SubjectPublicKeyInfo | longueur variable |

Une signature DER n’est jamais une signature raw de 64 octets. Une clé publique SPKI n’est jamais interchangeable avec les coordonnées JWK ou X9.63 sans conversion explicite.

## 3. Vecteur de vérification RFC 6979 — P-256 / SHA-256

Le test reprend le vecteur public RFC 6979, annexe A.2.5, message `sample`.

- Courbe : NIST P-256 / secp256r1
- Hash : SHA-256
- Coordonnée publique X : `60FED4BA255A9D31C961EB74C6356D68C049B8923B61FA6CE669622E60F29FB6`
- Coordonnée publique Y : `7903FE1008B8BC99A41AE9E95628BC64F2F1B20C2D7E9F5177A3C294D4462299`
- Signature R : `EFD48B2AACB6A8FD1140DD9CD45E81D69D2C877B56AAF991C34D0EA84EAF3716`
- Signature S : `F7CB1C942D657C41D436C7A1B6E29F65F3E900DBB9AFF4064DC4AB2F843ACDA8`

La signature brute est la concaténation R puis S, soit 64 octets.

Le test ajoute également la variante mathématiquement équivalente :
`s_low = n - s_high`, où `n` est l’ordre du point de base P-256 :

`FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551`

Pour le vecteur :
- le S RFC est supérieur à `n / 2` ;
- le S transformé est inférieur ou égal à `n / 2` ;
- les deux signatures sont valides mathématiquement pour le même message et la même clé publique.

## 4. Résultats de tests automatisés dans SAC

Code et tests ajoutés :
- `tests/ecdsa-p256-interoperability.test.ts` ;
- extension de `tests/fixtures/jcs-worker.ts` ;
- extension de `tests/jcs-worker-runtime.test.ts` ;
- commande `npm run test:ecdsa`, intégrée à la CI ;
- `tests/ecdsa-der-format.test.ts`, adaptateur DER/P1363 strict réservé aux tests ;
- `tests/p256-jwk.test.ts`, tests des coordonnées JWK canoniques et des bits de remplissage base64url.

Vérifications réalisées :
1. import de la clé publique P-256 du vecteur RFC ;
2. vérification de la signature raw de 64 octets sur le message `sample` ;
3. vérification de la variante low-S ;
4. génération d’une paire ECDSA P-256 par Web Crypto ;
5. signature et vérification d’un message de test ;
6. répétition du vecteur RFC, des deux variantes S et de la génération d’une signature dans le runtime local Wrangler/Miniflare.
7. conversion raw → DER → raw sur le vecteur RFC ; vérification DER avec le moteur `node:crypto` indépendant ; rejet des INTEGER négatifs, nuls, non minimaux, des longueurs non canoniques et des octets finaux.
8. contrôle des coordonnées JWK P-256, y compris le rejet des chaînes base64url de 43 caractères dont les bits de remplissage finaux ne sont pas nuls.

**Résultat observé :** Node.js Web Crypto et le runtime local Workers acceptent le vecteur raw de 64 octets, vérifient la variante high-S et la variante low-S, et produisent des signatures de 64 octets.

La CI complète a réussi sur le commit `e18dbd6` (workflow `44425763811`) : installation reproductible, vecteurs JCS, parseur JSON strict, runtime local Workers/Web Crypto, ECDSA P-256 RFC 6979, tests DER/P1363, validation JWK P-256, typecheck, tests métier, migration D1 locale isolée, build et audits.

## 5. Conséquence de la malléabilité et arbitrage low-S

ECDSA admet, pour une signature valide `(r, s)`, une autre signature valide `(r, n-s)`. Les tests montrent que les vérificateurs Web Crypto Node et Workers acceptent les deux variantes.

Cela signifie :
- Web Crypto ne normalise pas automatiquement toutes les signatures en low-S ;
- vérifier seulement la validité mathématique ne garantit pas une représentation unique ;
- deux octets de signature différents peuvent authentifier le même message et la même clé.

### Recommandation candidate

Pour SAC, examiner une règle versionnée imposant :
- à l’émission, transformer `s` en `min(s, n-s)` ;
- à la réception, rejeter toute signature où `s > n/2` ;
- valider aussi `1 <= r < n` et `1 <= s < n` ;
- effectuer cette règle sur les entiers décodés du format raw, avant la vérification cryptographique.

Cette recommandation reste **à arbitrer**. Elle n’est pas encore intégrée au certificat expérimental et n’est pas une décision homologuée.

## 6. Représentation réseau candidate

La représentation la plus simple à tester pour P-256 est le format brut fixe de 64 octets :
- 32 octets big-endian pour R ;
- 32 octets big-endian pour S ;
- zéros initiaux conservés ;
- aucune enveloppe DER dans le message SAC ;
- toute conversion native a lieu à la frontière de la plateforme, avant envoi ou après réception.

Ce choix correspond au format ES256 défini par RFC 7518 et au format de sortie Web Crypto pour P-256. Il constitue une **recommandation candidate**, pas une décision de protocole.

Un adaptateur de référence limité aux tests a été écrit dans `tests/ecdsa-der-format.test.ts`. Il démontre le trajet et les contrôles ci-dessous ; il ne doit pas être importé par le code de production avant arbitrage et revue indépendante.

Si Android fournit une signature DER, l’adaptateur natif devra effectuer un décodage DER strict :
- exactement une séquence ;
- exactement deux INTEGER positifs ;
- encodage DER minimal ;
- aucune donnée finale ;
- aucune longueur incohérente ;
- R et S dans l’intervalle valide ;
- conversion vers deux entiers fixes de 32 octets ;
- application de la règle low-S si celle-ci est approuvée.

Un parseur DER permissif ou une simple suppression du premier octet ne serait pas acceptable.

## 7. Clé publique : choix encore à figer

Le prototype expérimental exporte les clés publiques en JWK. Pour le futur protocole, une forme JWK minimale pourrait être retenue :
- `kty = "EC"` ;
- `crv = "P-256"` ;
- `x` et `y` strictement décodés en 32 octets chacun ;
- aucun champ privé `d` ;
- aucun champ inattendu ou ambigu dans le transcript signé.

Le helper `src/services/crypto/p256-jwk.ts` vérifie déjà les champs mathématiques `kty`, `crv`, `x`, `y`, l'absence de `d`, ainsi que l'encodage base64url sans bits de remplissage non canoniques. Il est réutilisé par les validateurs expérimentaux de l'échange ECDH et des certificats d'appareils. L'import cryptographique et la tentative d'accord ECDH restent nécessaires pour vérifier que le point est réellement valide sur la courbe.

Il faut encore définir si le transcript transporte ce JWK minimal, les coordonnées binaires ou une représentation native. La clé publique doit être validée sur la courbe et son empreinte doit utiliser une règle unique versionnée.

## 8. Signatures aléatoires et tests

ECDSA standard choisit un nonce secret frais à chaque signature. Deux signatures du même message par la même clé ne doivent donc pas être attendues identiques.

Les tests d’interopérabilité doivent :
- comparer les octets canoniques du transcript ;
- vérifier une signature fixe RFC 6979 sur chaque environnement ;
- signer sur chaque plateforme puis faire vérifier la signature par toutes les autres ;
- comparer les résultats de vérification et la représentation binaire après normalisation ;
- ne jamais exiger l’égalité octet pour octet de deux signatures fraîchement générées.

RFC 6979 décrit une génération déterministe du nonce ECDSA, mais l’API Web Crypto ne fournit pas de paramètre permettant à l’appelant de fixer ce nonce. Le vecteur RFC sert ici de vecteur de vérification commun, pas d’exigence de signature déterministe pour SAC.

## 9. Matrice réelle restant à exécuter

| Environnement | État |
|---|---|
| Node.js 22 Web Crypto | Vecteur RFC, high-S/low-S et format 64 octets testés |
| Wrangler/Miniflare local | Vecteur RFC, high-S/low-S et format 64 octets testés |
| Chrome Android PWA | Non testé sur appareil |
| Safari iOS PWA | Non testé sur appareil |
| Android natif / AndroidKeyStore | Non testé sur appareil et fournisseur |
| iOS natif / CryptoKit | Non testé sur appareil |
| Worker Cloudflare déployé | Non testé ; aucune ressource distante créée |

Les tests locaux n’autorisent pas à déclarer les environnements mobiles réels conformes.

## 10. Décisions encore bloquantes

Avant l’implémentation de la cérémonie :
1. confirmer ou refuser ECDSA P-256 / SHA-256 ;
2. arbitrer raw P1363 64 octets comme format réseau ;
3. arbitrer la règle low-S ;
4. choisir le format exact de clé publique et d’empreinte ;
5. implémenter et tester les adaptateurs DER/raw natifs Android/iOS ;
6. exécuter les vecteurs sur appareils réels et réaliser les tests croisés ;
7. vérifier les usages, l’exportabilité et les garanties réelles de stockage des clés ;
8. faire relire indépendamment le protocole complet.

Aucun de ces tests n’active une clé racine, un certificat secondaire, une session ou une fonctionnalité GPS. La règle NO-GO de l’enrôlement multi-appareils reste en vigueur.

## 11. Références

- W3C Web Cryptography API, section 23.7 (ECDSA) : https://www.w3.org/TR/WebCryptoAPI/
- RFC 7518, section 3.4 (ES256, signature raw de 64 octets) : https://www.rfc-editor.org/rfc/rfc7518.html
- RFC 6979, annexe A.2.5 (vecteurs ECDSA P-256) : https://www.rfc-editor.org/rfc/rfc6979.html
- RFC 3279, section 2.2.3 (structure ASN.1 ECDSA) : https://www.rfc-editor.org/rfc/rfc3279.html
- Android Keystore, signature et vérification : https://developer.android.com/privacy-and-security/keystore
- Android `java.security.Signature` : https://developer.android.com/reference/java/security/Signature
- Apple CryptoKit `P256.Signing.ECDSASignature` : https://developer.apple.com/documentation/cryptokit/p256/signing/ecdsasignature
- Android `java.security.Key` : https://developer.android.com/reference/java/security/Key
- Cloudflare Workers Web Crypto : https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
