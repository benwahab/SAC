# SAC — Revue de décision cryptographique et protection des clés V1

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** recommandations techniques à arbitrer — non homologuées, non implémentées dans une cérémonie réelle.  
**Périmètre :** signatures, formats réseau, low-S, séparation des usages et protection des clés sur PWA/mobile.

Ce document distingue les propriétés établies par les standards, les essais réellement exécutés dans le dépôt et les choix proposés pour SAC. Il ne vaut ni audit cryptographique indépendant ni validation des appareils mobiles réels.

## 1. Synthèse des recommandations

| Sujet | Recommandation proposée | État |
|---|---|---|
| Signature d'identité | ECDSA P-256 avec SHA-256 (ES256) | Candidat privilégié, à homologuer |
| Format réseau | Raw IEEE P1363 : 64 octets `r || s` | Candidat privilégié |
| Android natif | Convertisseur DER vers raw strict à la frontière native, si le fournisseur retourne DER | À tester sur appareils |
| iOS natif | Utiliser explicitement `rawRepresentation` de CryptoKit | À tester sur appareils |
| Politique low-S | Ne pas imposer de rejet low-S en V1 ; accepter les deux formes mathématiquement valides après contrôle des bornes | Recommandation |
| Domaines de signature | Préfixes distincts, versionnés, pour preuve du nouvel appareil et approbation racine | Recommandation |
| Clé ECDH du secondaire | Ne pas l'inclure dans le transcript d'enrôlement tant qu'un besoin de chiffrement concret et son protocole ne sont pas définis | Recommandation |
| Clés privées PWA | Ne jamais prétendre qu'une clé Web Crypto est matériellement liée au téléphone sans preuve de l'authenticator/OS | Garde-fou impératif |
| Racine V1 | Ne pas homologuer la racine PWA comme « appareil matériellement lié » sans un mécanisme de protection et une politique d'attestation adaptés | Blocage à arbitrer |

## 2. ECDSA P-256 / SHA-256 et format réseau

### 2.1 Base technique

La piste ECDSA P-256 / SHA-256 est déjà testée dans SAC avec :
- le vecteur public RFC 6979 ;
- une signature brute de 64 octets ;
- des signatures générées et vérifiées par Web Crypto dans Node.js ;
- le runtime local Wrangler/Miniflare ;
- des conversions DER/raw strictes dans les tests ;
- des cas négatifs sur les longueurs, les entiers et les coordonnées JWK.

Ces tests sont réels dans les environnements cités. Ils ne démontrent pas le fonctionnement des fournisseurs Android/iOS, de Safari, de WebView ou d'un Worker Cloudflare distant.

### 2.2 Recommandation de format

Retenir comme format réseau candidat unique :
- exactement 64 octets ;
- `r` sur 32 octets big-endian, suivi de `s` sur 32 octets big-endian ;
- zéros initiaux conservés ;
- aucun DER/ASN.1 transmis dans le protocole SAC.

Les adaptateurs de plateforme convertissent localement leurs formats natifs vers/depuis ce format unique. Toute conversion doit être stricte et testée par vecteurs croisés. Aucun parseur DER permissif.

La RFC 7518, section 3.4, décrit ES256 comme ECDSA P-256/SHA-256 et impose la valeur de signature JOSE de 64 octets, divisée en R et S. Web Cryptography produit également les octets R puis S pour ECDSA sur P-256.

### 2.3 Interopérabilité native obligatoire

- **Web/PWA :** Web Crypto, signature et vérification raw.
- **Android natif :** mesurer le format exact du fournisseur Keystore utilisé. Si DER est retourné, convertir strictement en raw ; ne jamais supposer le format d'après le seul nom d'API.
- **iOS natif :** sélectionner explicitement la représentation raw de CryptoKit pour le transport ; ne pas laisser le pont natif choisir implicitement entre raw et DER.
- **Serveur :** vérifier le format raw exact et les bornes des entiers avant la vérification cryptographique.

Critères avant homologation :
1. même vecteur de vérification sur tous les runtimes retenus ;
2. chaque environnement signe un message temporaire et tous les autres le vérifient ;
3. altération d'un octet, substitution de clé et mauvaise longueur sont rejetées ;
4. les versions OS, navigateurs, WebView et fournisseurs sont enregistrées ;
5. aucun test simulé n'est compté comme test d'appareil réel.

## 3. Arbitrage low-S : recommandation de ne pas ajouter de règle propriétaire

### Constat

Pour une signature ECDSA valide `(r,s)`, la valeur `(r,n-s)` est également une signature mathématiquement valide pour le même message et la même clé. Les essais SAC ont observé que Node Web Crypto et le runtime local Workers acceptent les variantes high-S et low-S.

Le format ES256 de la RFC 7518 fixe la longueur et la séparation R/S ; il n'impose pas une règle low-S. La validation doit toutefois rejeter les valeurs hors intervalle : `1 <= r < n` et `1 <= s < n`.

### Recommandation V1

Ne pas imposer une normalisation low-S à l'émission ni rejeter les signatures high-S à la réception.

À la place :
- valider le format raw de 64 octets ;
- décoder R et S comme entiers non signés big-endian ;
- rejeter zéro et toute valeur supérieure ou égale à l'ordre de P-256 ;
- vérifier la signature selon ECDSA P-256/SHA-256 ;
- ne jamais utiliser les octets de signature comme identifiant, clé d'idempotence, preuve d'unicité ou identifiant d'audit ;
- utiliser `ceremony_id`, le hash du transcript et l'état terminal du défi pour l'anti-rejeu et l'idempotence.

### Justification

L'anti-rejeu doit être assuré par l'état serveur et le défi à usage unique, pas par l'espoir qu'une signature ait une représentation binaire unique. Une règle low-S propriétaire ajouterait des divergences entre fournisseurs natifs sans améliorer l'identité de la cérémonie si les signatures ne sont pas utilisées comme identifiants.

Cette recommandation doit être confirmée par la revue cryptographique indépendante. Si une bibliothèque ou un protocole externe impose ultérieurement low-S, cette exigence devra être versionnée et testée explicitement.

## 4. Domaines de signature

Conserver le principe de séparation des rôles proposé dans le transcript candidat :

- preuve du nouvel appareil : domaine fixe `SAC-DEVICE-ENROLLMENT-NEW-DEVICE-V1` ;
- approbation racine : domaine fixe `SAC-DEVICE-ENROLLMENT-ROOT-APPROVAL-V1`.

Chaque message signé est construit par concaténation non ambiguë :
1. octets UTF-8 exacts du domaine ;
2. un octet nul séparateur ;
3. octets UTF-8 canoniques exacts du transcript.

Règles :
- les constantes sont versionnées et ne sont jamais fournies par le client ;
- aucun JSON ne doit être reconstruit différemment entre signature et vérification ;
- le hash de transcript est calculé sur les octets canoniques, pas sur une chaîne hexadécimale du hash ;
- les clés d'identité SAC ne doivent pas être réutilisées pour signer des certificats ou messages d'un autre protocole sans analyse de séparation des domaines ;
- la racine vérifie la preuve du nouvel appareil ; le nouvel appareil vérifie la signature racine à l'aide de l'ancre racine qu'il a déjà vérifiée ; le serveur vérifie les deux avec les clés liées à la cérémonie.

Les domaines proposés doivent être confirmés avec le schéma exact du transcript et des vecteurs cryptographiques complets.

## 5. Clé d'accord ECDH : ne pas l'inclure sans protocole consommateur

Le transcript candidat contient `agreementPublicKey` et exige les usages `device-authentication` et `key-agreement`. Le certificat expérimental utilise pour sa part `exchangePublicKey` dans un contexte de partage de localisation. Ces éléments ne forment pas encore un contrat cohérent.

### Recommandation

Pour l'enrôlement V1, ne transporter que la clé publique d'identité nécessaire à la preuve de possession, sauf si une fonction V1 précise exige réellement un échange de clé au moment de l'enrôlement.

Avant d'ajouter ECDH, définir séparément :
- quelles données seront chiffrées ;
- qui chiffre pour qui et qui déchiffre ;
- la courbe et le format de clé ;
- la dérivation de clé (KDF), le contexte et les identifiants de pairs ;
- les algorithmes AEAD, nonces et règles de rotation ;
- le traitement de la révocation et des appareils hors ligne ;
- la compatibilité future et les tests de cryptographie croisée.

Une clé publique ECDH sans protocole consommateur ne procure pas de sécurité fonctionnelle. Elle augmente la surface d'attaque et la complexité de l'enrôlement. Les clés GPS restent dans leur protocole séparé et NO-GO tant que les exigences de conservation/destruction ne sont pas prouvées.

## 6. Protection des clés : limite fondamentale de la PWA

### 6.1 Ne pas confondre clé non exportable et clé matériellement liée

Une clé Web Crypto déclarée non extractible empêche l'export direct de sa matière privée par l'API Web Crypto. Cela ne prouve pas à lui seul que :
- la clé est générée dans un Secure Enclave, StrongBox ou TEE ;
- elle est liée à un matériel précis ;
- elle ne peut pas être synchronisée, sauvegardée ou restaurée par un mécanisme de plateforme ;
- son usage exige une vérification biométrique ou un code local ;
- une copie de profil/navigateur ne permet pas de réutiliser l'objet clé.

La PWA ne doit donc pas afficher ni promettre « clé protégée matériellement » sur la seule base de `extractable: false`.

### 6.2 Options à étudier

**Option A — clé Web Crypto PWA**
- meilleure simplicité et compatibilité ;
- peut être non extractible au niveau API et conservée dans le stockage du navigateur ;
- protection matérielle et attestation non garanties de manière uniforme ;
- ne doit pas être assimilée à une racine matérielle sans preuve.

**Option B — authenticator WebAuthn**
- utilise un authenticator plateforme ou itinérant ;
- peut fournir une preuve cryptographique de possession et des indicateurs de présence/vérification utilisateur ;
- les identifiants peuvent être synchronisés selon l'authenticator ; il faut distinguer credentials liés à un appareil et credentials synchronisés ;
- attestation, politique d'authenticator et vérification serveur doivent être définies ; WebAuthn n'est pas une preuve automatique de matériel dédié.

**Option C — pont natif Capacitor et clés protégées par l'OS**
- Android Keystore/StrongBox si disponible et vérifié ;
- Apple Secure Enclave si disponible et vérifié ;
- nécessite un code natif, un cycle de vie des clés, une gestion de disponibilité et des tests physiques ;
- les appareils sans capacité exigée doivent être refusés ou bénéficier d'un niveau de confiance explicitement inférieur, jamais d'un faux statut matériel.

### 6.3 Recommandation d'architecture

Garder la PWA comme interface et parcours initial, mais isoler la génération, la conservation et l'utilisation des clés derrière une abstraction de fournisseur cryptographique.

Le contrat de fournisseur devra rapporter des capacités vérifiées, pas des affirmations du client :
- type de stockage : navigateur logiciel, Keystore/TEE, StrongBox, Secure Enclave, authenticator WebAuthn ;
- clé exportable ou non selon l'API ;
- présence d'une attestation vérifiable et sa politique ;
- vérification locale de l'utilisateur exigée ou non ;
- identifiant/version de fournisseur et limites connues.

Le serveur décide du niveau accepté. Un champ client `platform = android` ou `ios` n'est jamais une preuve de matériel, de sécurité ou de modèle de téléphone.

### 6.4 Décision utilisateur encore nécessaire

Le produit doit décider si une PWA seule peut être acceptée comme premier appareil racine avec une protection logicielle explicitement documentée, ou si la racine exige dès V1 un authenticator/stockage matériel vérifiable, ce qui imposerait un parcours natif ou WebAuthn compatible et pourrait exclure certains appareils.

Aucune décision n'est prise à la place de l'utilisateur. Tant que ce choix n'est pas fermé, le mécanisme d'enrôlement ne peut pas être déclaré prêt.

## 7. SAS : authentification humaine indépendante

Le SAS reste un contrôle humain complémentaire, et ne remplace pas les signatures.

Recommandation à étudier :
- dériver une valeur de comparaison à partir d'un hash du transcript, avec un domaine distinct ;
- définir exactement l'ordre des octets, la troncature et le nombre de bits ;
- si six mots sont conservés, choisir une liste versionnée de 2 048 mots et convertir 66 bits en six indices de 11 bits ;
- fournir une liste contrôlée, sans doublons ni mots trop proches phonétiquement, et des vecteurs identiques sur toutes les plateformes ;
- comparer par un canal indépendant du serveur et du QR : présence physique ou appel vocal sur un numéro/canal déjà connu ;
- toute différence, impossibilité de comparer ou absence de confirmation explicite annule la cérémonie.

Le choix de 66 bits et de six mots reste à confirmer. La liste doit être localisée sans changer les indices cryptographiques entre langues : chaque index doit désigner une entrée correspondante dans les listes FR/EN/AR versionnées.

## 8. Décisions à fermer avant le SQL et l'enrôlement

1. ECDSA P-256/SHA-256 confirmé ou autre suite cryptographique.
2. Raw P1363 64 octets confirmé comme unique format réseau.
3. Proposition sans low-S confirmée ou remplacée après revue.
4. Domaines de signature définitifs et vecteurs complets.
5. Présence ou absence d'une clé ECDH dans l'enrôlement V1.
6. Niveau de protection exigé pour la racine et acceptation éventuelle d'une PWA logicielle.
7. Stratégie WebAuthn / Android Keystore / StrongBox / Secure Enclave et exigences d'attestation.
8. SAS : nombre de mots, bits, dictionnaires et procédure.
9. Essais croisés réels Android, iOS, navigateurs, WebView et Worker.
10. Revue cryptographique indépendante du protocole complet.

## 9. Garde-fous d'implémentation

Jusqu'à clôture de ces décisions :
- aucune cérémonie réelle d'enrôlement ;
- aucune clé racine de production ;
- aucun appareil secondaire activé ;
- aucune session créée sur la base de ces propositions ;
- aucun déploiement Cloudflare ou secret externe ;
- aucun usage GPS introduit par le biais de la clé ECDH.

Les tests actuels prouvent uniquement les comportements des environnements explicitement testés. Ils ne prouvent pas l'attestation matérielle, le stockage mobile, la protection contre un appareil compromis ou l'interopérabilité physique.

## 10. Références techniques

- W3C Web Cryptography API, ECDSA : https://www.w3.org/TR/WebCryptoAPI/
- RFC 7518, section 3.4, ES256 et signature de 64 octets : https://www.rfc-editor.org/rfc/rfc7518.html
- RFC 6979, génération déterministe ECDSA : https://www.rfc-editor.org/rfc/rfc6979.html
- W3C Web Authentication Level 3 : https://www.w3.org/TR/webauthn-3/
- Android Keystore : https://developer.android.com/privacy-and-security/keystore
- Android Key Attestation : https://developer.android.com/privacy-and-security/keystore/attestation
- Apple CryptoKit P-256 Signing : https://developer.apple.com/documentation/cryptokit/p256/signing
- Apple Secure Enclave : https://developer.apple.com/documentation/security/certificate_key_and_trust_services/keys/protecting_keys_with_the_secure_enclave

**Verdict :** ECDSA P-256/SHA-256 avec transport raw 64 octets est la piste la mieux étayée par les essais actuels du dépôt, mais elle n'est pas encore homologuée. La question de la racine PWA est un blocage de sécurité majeur : une clé non extractible Web Crypto ne suffit pas à prouver un ancrage matériel. Aucune fonctionnalité d'enrôlement ne doit être activée avant décision explicite sur ce niveau de confiance et validation indépendante.
