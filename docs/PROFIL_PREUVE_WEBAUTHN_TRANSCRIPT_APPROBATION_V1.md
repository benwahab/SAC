# SAC — Profil candidat de preuve WebAuthn liée au transcript d'approbation

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** étude technique complémentaire, non validée et non implémentée.  
**Dépendance :** `ARCHITECTURE_RACINE_PWA_WEBAUTHN_ET_CLES_NATIVES_V1.md`.

## 1. But et limites

Définir comment une assertion WebAuthn de l'appareil racine peut approuver **une demande précise** d'ajout d'appareil, sans prétendre que WebAuthn signe directement le transcript SAC.

WebAuthn signe les octets `authenticatorData || SHA-256(clientDataJSON)`. Le challenge inclus dans `clientDataJSON` doit donc engager le hash du transcript SAC. Le serveur vérifie l'assertion selon WebAuthn ; le nouvel appareil peut refaire une vérification cryptographique locale avec la clé publique racine déjà enregistrée.

Cette vérification locale apporte une preuve vérifiable du lien avec la demande. Elle ne remplace pas les contrôles serveur, l'usage unique du challenge, ni l'atomicité D1. Un client secondaire compromis peut mentir sur ce qu'il affiche : le serveur demeure l'autorité de validation et doit appliquer exactement les mêmes règles.

## 2. Entrées nécessaires

Pour une cérémonie donnée, les éléments suivants sont fixés côté serveur et liés au compte :

- identifiant opaque de cérémonie ;
- identifiant de compte et identifiant de l'appareil racine actif ;
- identifiant de credential WebAuthn racine ;
- clé publique COSE/JWK racine enregistrée lors de l'enrôlement ;
- nonce serveur aléatoire de 32 octets, à usage unique ;
- transcript canonique SAC et son empreinte SHA-256 ;
- RP ID et origine autorisés, configurés côté serveur ;
- date d'expiration et état du challenge.

Le transcript doit être construit selon le profil canonique SAC validé. Aucun champ client ne peut remplacer les valeurs autoritatives du serveur. La sérialisation et les règles de rejet (champs inconnus, doublons, types, tailles) doivent être strictement identiques entre serveur et appareils.

## 3. Construction du challenge WebAuthn

Profil candidat V1 :

1. Calculer `transcriptHash = SHA-256(transcriptBytes)`.
2. Construire les octets :
   `UTF8("SAC-ROOT-APPROVAL-WEBAUTHN-V1") || 0x00 || transcriptHash || serverNonce`.
3. Calculer `webauthnChallenge = SHA-256(octets)`.
4. Encoder ces 32 octets en Base64URL sans padding pour les options WebAuthn.
5. Envoyer `navigator.credentials.get()` avec ce challenge, la credential racine explicitement autorisée dans `allowCredentials`, `userVerification: "required"`, et le RP ID SAC attendu.

Le domaine constant sépare cette approbation des autres opérations SAC. Le nonce empêche la répétition et le hash du transcript lie la preuve à la demande exacte. Le challenge est public : sa sécurité vient de son imprévisibilité, de son association au compte/cérémonie, de son expiration et de sa consommation atomique, pas de sa confidentialité.

**Point de gel :** cette construction ne doit pas être utilisée en production avant génération de vecteurs de test indépendants (au moins TypeScript/Web Crypto et un second environnement), avec les octets exacts et les résultats attendus.

## 4. Assertion produite

Le navigateur retourne notamment :

- `rawId` / identifiant credential ;
- `response.authenticatorData` (octets bruts) ;
- `response.clientDataJSON` (octets JSON bruts) ;
- `response.signature` (signature WebAuthn) ;
- éventuellement `userHandle`.

Conserver les octets originaux pour la vérification. Ne pas parser puis re-sérialiser `clientDataJSON` avant le calcul de son hash. Le texte JSON exact retourné par l'authenticator est l'entrée du hash.

## 5. Vérification obligatoire côté serveur

Le serveur doit rejeter l'assertion si une seule condition échoue :

1. La cérémonie existe, appartient au compte concerné, est en attente et n'est pas expirée.
2. Le nonce serveur et le transcript correspondent exactement aux valeurs persistées.
3. La credential de l'assertion est exactement la credential racine active attendue.
4. `clientDataJSON.type` vaut `webauthn.get`.
5. Le challenge décodé est exactement égal aux 32 octets calculés selon la section 3.
6. L'origine est strictement égale à une origine SAC autorisée ; aucune comparaison par suffixe ou correspondance approximative.
7. `crossOrigin` est absent ou faux selon le profil retenu ; tout `topOrigin` inattendu est refusé.
8. `rpIdHash` est égal à SHA-256 du RP ID configuré.
9. Le flag UP vaut 1 et le flag UV vaut 1.
10. Pour le profil racine proposé, BE vaut 0 et BS vaut 0. BE est invariant après l'enregistrement ; toute incohérence avec la valeur initiale entraîne le rejet et une alerte de sécurité.
11. Les bits réservés et extensions sont traités selon le standard et la politique SAC ; toute extension non prise en charge est refusée, pas ignorée si elle modifie l'interprétation de la preuve.
12. La signature est valide avec la clé publique enregistrée pour cette credential sur la concaténation exacte `authenticatorData || SHA-256(clientDataJSON)`.
13. L'algorithme, le format de clé et le format de signature correspondent au profil enregistré ; aucun choix d'algorithme fourni librement par le client.
14. Les contrôles de compteur sont appliqués selon les propriétés réelles de l'authenticator ; un compteur nul n'est pas, à lui seul, une preuve d'échec, et un compteur ne doit pas être artificiellement considéré comme une garantie matérielle.

Le serveur consomme le challenge et passe la cérémonie à l'état terminal dans la même opération transactionnelle que l'approbation, après vérification complète. Un second envoi, une course concurrente ou une réponse perdue suivie d'un rejeu ne doit jamais produire une deuxième approbation.

## 6. Vérification indépendante par le nouvel appareil

Le nouvel appareil reçoit, après approbation, un paquet de preuve contenant les octets originaux de l'assertion et les paramètres publics nécessaires :

- transcript canonique exact ;
- nonce serveur et identifiant de cérémonie ;
- credential ID racine ;
- clé publique racine et algorithme issus de l'enrôlement racine authentifié ;
- `authenticatorData`, `clientDataJSON` et signature WebAuthn bruts ;
- RP ID et origine SAC attendus ;
- version du profil de preuve.

Il refait les contrôles cryptographiques suivants :

1. Recalculer le hash du transcript et le challenge de la section 3.
2. Parser `clientDataJSON` sans modifier les octets originaux utilisés pour le hash.
3. Contrôler `type`, challenge, origine et contexte cross-origin.
4. Contrôler le `rpIdHash`, UP, UV, BE et BS dans `authenticatorData`.
5. Vérifier la signature avec la clé publique racine enregistrée.
6. Comparer le credential ID et la version de profil avec l'enrôlement racine authentifié.
7. Vérifier que le transcript approuvé est strictement identique à celui que le nouvel appareil présente à l'utilisateur et à celui de sa propre cérémonie.

La vérification locale doit être réalisée avec un code crypto audité et des vecteurs partagés. Elle ne doit pas être remplacée par un booléen `approved: true` reçu du serveur.

**Limite importante :** l'appareil secondaire ne peut pas déduire de cette seule assertion que la personne a compris tous les détails affichés, ni que l'authenticator est matériellement certifié. L'assertion prouve une opération WebAuthn valide sous la credential racine, avec les flags et le challenge observés.

## 7. Interopérabilité des signatures

WebAuthn ES256 utilise une signature ECDSA encodée selon le format attendu par WebAuthn (DER ASN.1). Les API crypto peuvent utiliser un autre format binaire, notamment P1363 `r || s`. Le serveur et le vérificateur secondaire doivent normaliser strictement les formats, avec un parseur DER borné et un convertisseur testé si nécessaire.

Ne jamais interpréter arbitrairement une signature DER comme un tableau P1363, ni accepter des encodages ambigus, tronqués ou non minimaux. Les tests doivent couvrir les valeurs limites de `r` et `s`, les longueurs DER, les signatures altérées et les clés de courbe incorrecte.

## 8. Cas de tests obligatoires

- transcript différent d'un seul octet ;
- mauvais nonce, mauvais compte, mauvaise cérémonie ;
- challenge expiré, consommé ou rejoué ;
- credential d'un autre compte ou credential secondaire ;
- origine incorrecte, sous-domaine non autorisé, RP ID incorrect ;
- type `webauthn.create` au lieu de `webauthn.get` ;
- UP absent, UV absent, BE=1, BS=1 ;
- signature modifiée, clé publique substituée, DER invalide ;
- `clientDataJSON` re-sérialisé avant hash ;
- approbations concurrentes de la même cérémonie ;
- réponse serveur perdue puis répétition de la requête ;
- preuve vérifiée par le serveur mais volontairement altérée avant réception secondaire ;
- vérification serveur et secondaire comparées sur les mêmes vecteurs valides et invalides.

## 9. Décisions encore ouvertes

- Acceptation ou non de la racine PWA WebAuthn single-device.
- Politique d'attestation WebAuthn et compatibilité réelle.
- Profil exact de credential (algorithmes, extensions autorisées, discoverable ou non).
- Durée de vie du challenge et limites de tentatives.
- Profil canonique définitif du transcript SAC et ses vecteurs.
- Bibliothèque ou implémentation de vérification serveur et secondaire, auditée et maintenue.
- Stratégie exacte de compteur et de détection d'anomalies.
- Preuve de l'enrôlement racine initial et distribution authentifiée de sa clé publique aux appareils secondaires.

Aucune table, migration, route API ou fonction crypto de production ne doit être créée sur la seule base de cette proposition.

## 10. Références

- W3C WebAuthn Level 3 (Recommandation du 25 août 2026) : https://www.w3.org/TR/webauthn-3/
- W3C WebAuthn Level 4 (brouillon de travail, non normatif final) : https://www.w3.org/TR/webauthn-4/
- MDN — structure des données authenticator : https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API/Authenticator_data
- OWASP Web Security Testing Guide — Passkeys et WebAuthn : https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/04-Authentication/13-Passkeys_and_WebAuthn

