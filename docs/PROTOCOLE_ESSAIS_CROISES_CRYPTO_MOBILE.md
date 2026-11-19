# SAC — Protocole d’essais croisés cryptographiques sur appareils réels

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** protocole de test préparatoire — aucun résultat mobile réel enregistré, aucune homologation.

## 1. Objectif et limites

Ce protocole permet de vérifier que plusieurs environnements manipulent exactement les mêmes octets JCS et les mêmes signatures ECDSA P-256. Il complète les tests automatisés Node.js et Wrangler/Miniflare.

Il ne constitue pas une spécification d’enrôlement. Il ne fixe pas les champs du futur transcript SAC, le stockage des clés, les permissions d’export, la politique low-S, le SAS, l’anti-rejeu ou l’atomicité D1. Ces décisions restent bloquantes et doivent être arbitrées séparément.

Aucune clé privée de production, aucun compte SAC réel et aucune donnée personnelle ne doivent être utilisés. Les essais utilisent uniquement des clés temporaires et des valeurs synthétiques.

## 2. Vecteurs communs

### 2.1 Canonicalisation JCS

Utiliser le vecteur JCS-01 de la RFC 8785, reproduit dans `docs/ANNEXE_EVALUATION_JCS_ET_VECTEURS_INTEROPERABILITE.md`.

Chaque environnement doit produire exactement cette chaîne canonique :

```json
{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA'B\\\"\\\\\\\\\\"/"}
```

Les octets UTF-8 de cette chaîne doivent avoir l’empreinte SHA-256 suivante :

```text
2d5e01a318d0f0879ab568c4be289c8b1f64ef8921a53c6277d5e069978baacb
```

Le résultat doit être identique octet pour octet. Une comparaison visuelle de chaînes n’est pas suffisante : enregistrer les octets UTF-8 et calculer leur SHA-256.

### 2.2 Signature ECDSA P-256 / SHA-256

Utiliser le vecteur public RFC 6979, annexe A.2.5, message ASCII `sample`. Les coordonnées publiques, R et S sont reprises dans `docs/ANNEXE_EVALUATION_ECDSA_P256_INTEROPERABILITE.md`.

La signature raw attendue fait exactement 64 octets : `r[32] || s[32]`, big-endian. Le vecteur RFC high-S et sa variante mathématiquement équivalente low-S doivent tous deux être vérifiés par les implémentations de test actuelles. Ce contrôle observe le comportement des API ; il ne tranche pas la politique low-S du futur protocole.

### 2.3 Signature fraîche inter-environnements

Chaque plateforme génère une paire de test temporaire, signe un message de test identique et exporte uniquement :
- la clé publique de test ;
- la signature ;
- le format et la longueur des octets ;
- la version du système, du navigateur/WebView et du fournisseur crypto ;
- le résultat de vérification.

Ne jamais exporter la clé privée. Ne pas comparer les signatures fraîchement produites octet pour octet : ECDSA peut produire des signatures différentes pour un même message. Chaque autre plateforme doit plutôt vérifier la signature avec la clé publique correspondante.

## 3. Environnements à tester

| Environnement | Vérifications requises | État |
|---|---|---|
| Node.js 22 / Web Crypto | JCS, hash, vecteur RFC, signature fraîche | Test automatisé CI |
| Wrangler / Miniflare local | JCS, hash, vecteur RFC, signature fraîche | Test automatisé local CI |
| Chrome Android (PWA) | JCS, hash, import/verify RFC, génération/verify | À exécuter sur appareil |
| Android WebView utilisée par Capacitor | Même suite, plus comparaison avec Chrome Android | À exécuter sur appareil |
| Android Keystore / API native si retenue | Génération, signature, export public, format DER/raw mesuré | À exécuter sur appareil |
| Safari iOS (PWA) | JCS, hash, import/verify RFC, génération/verify | À exécuter sur appareil |
| WKWebView utilisée par Capacitor | Même suite, plus comparaison avec Safari iOS | À exécuter sur appareil |
| Apple CryptoKit si retenu | Génération, signature, export public, format DER/raw mesuré | À exécuter sur appareil |
| Cloudflare Workers distant de test | JCS, hash, vecteur RFC et signature/verify | Non exécuté ; aucune ressource distante créée |

Pour chaque appareil, consigner le modèle, la version exacte du système, la version du navigateur ou WebView, la version de l’application de test, la date UTC et le résultat. Les essais natifs ne sont obligatoires que si une API native est effectivement retenue pour SAC ; ils ne peuvent pas être remplacés par un test WebView.

## 4. Procédure commune

1. Installer une version de test identifiée par commit et empreinte de build.
2. Exécuter le vecteur JCS-01 sans modifier son entrée.
3. Exporter la chaîne canonique sous forme d’octets UTF-8 hexadécimaux et calculer SHA-256 localement.
4. Comparer la chaîne, la longueur des octets et le hash à la référence de la section 2.1.
5. Importer la clé publique du vecteur RFC 6979 et vérifier la signature high-S de 64 octets sur le message `sample`.
6. Vérifier également la variante low-S, en enregistrant le résultat sans en déduire une politique protocolaire.
7. Générer une paire temporaire P-256, signer le message de test et vérifier localement la signature.
8. Exporter la clé publique et la signature de test, sans clé privée.
9. Faire vérifier chaque paire clé publique/signature par tous les autres environnements disponibles.
10. Altérer un octet du message, puis un octet de signature : les vérifications doivent échouer.
11. Substituer une autre clé publique : la vérification doit échouer.
12. Si l’environnement natif renvoie DER, vérifier que le convertisseur strict DER/P1363 round-trip conserve R et S et rejette les encodages malformés. Ne pas convertir en supprimant simplement des octets de tête.
13. Répéter chaque essai au moins trois fois après redémarrage de l’application ; les résultats cryptographiques doivent rester cohérents.

## 5. Tests négatifs obligatoires

| Cas | Résultat attendu |
|---|---|
| Un octet du transcript/message modifié | Signature refusée |
| Un octet de signature modifié | Signature refusée |
| Clé publique substituée | Signature refusée |
| Signature raw de longueur différente de 64 octets | Refusée par le profil P-256 raw |
| R ou S égal à zéro ou supérieur/égal à l’ordre de P-256 | Refusé par le validateur de format |
| DER avec INTEGER négatif, non minimal ou longueur incohérente | Refusé par le convertisseur strict |
| Clé publique hors courbe | Refusée à l’import/validation |
| JSON contenant des noms de propriétés dupliqués | Refusé avant canonicalisation |
| JSON avec Unicode invalide ou nombre non fini | Refusé avant canonicalisation |
| Hash JCS différent de la référence | Essai échoué, aucune signature croisée interprétable |

Les tests doivent distinguer un rejet de format, un rejet d’import de clé et un échec de vérification cryptographique. Un simple booléen « échec » sans diagnostic n’est pas suffisant pour l’analyse.

## 6. Fiche de résultats par environnement

Copier une fiche par appareil/runtime :

| Champ | Valeur |
|---|---|
| Environnement / plateforme | À renseigner |
| Modèle et version OS | À renseigner |
| Navigateur / WebView / fournisseur crypto | À renseigner |
| Version de l’application de test | À renseigner |
| Commit SAC testé | À renseigner |
| JCS chaîne exacte conforme | Oui / Non |
| Longueur UTF-8 | À renseigner |
| SHA-256 conforme | Oui / Non |
| RFC 6979 high-S vérifié | Oui / Non |
| RFC 6979 low-S vérifié | Oui / Non |
| Signature fraîche longueur / encodage | À renseigner |
| Vérification locale | Oui / Non |
| Vérification par les autres plateformes | À renseigner |
| Tests d’altération et substitution rejetés | Oui / Non |
| DER/raw et aller-retour (si applicable) | À renseigner |
| Logs expurgés et référence de preuve | À renseigner |
| Anomalies et reproduction | À renseigner |
| Date UTC et opérateur du test | À renseigner |

Ne pas joindre de clé privée, secret, jeton, donnée d’utilisateur ou capture contenant des informations personnelles. Les preuves doivent être expurgées et conservées dans l’espace de test approuvé.

## 7. Critères de réussite et blocages

Un environnement est « réussi » uniquement si :
- il reproduit les octets JCS et le hash exacts ;
- il vérifie le vecteur RFC 6979 ;
- il signe et vérifie une paire temporaire ;
- les autres environnements vérifient sa signature ;
- les altérations et substitutions sont rejetées ;
- son format de signature et sa représentation de clé publique sont documentés sans ambiguïté.

La matrice n’est globalement complète que lorsque tous les environnements effectivement retenus pour SAC ont passé les tests croisés. Un test Node ou Miniflare ne peut pas être compté comme test Android, iOS ou Worker distant.

Toute divergence d’octets, de hash, de format, d’import de clé ou de vérification maintient le NO-GO. Aucun contournement silencieux, fallback permissif ou normalisation implicite n’est autorisé.

Même après réussite de cette matrice, l’enrôlement reste NO-GO tant que le transcript métier versionné, les domaines de signature, la politique low-S, le SAS, l’anti-rejeu, l’expiration/consommation atomique du défi, les garanties D1 et la revue cryptographique indépendante ne sont pas validés.

## 8. Références normatives et techniques

- RFC 8785 — JSON Canonicalization Scheme : https://www.rfc-editor.org/rfc/rfc8785.html
- RFC 6979 — Deterministic Usage of DSA and ECDSA : https://www.rfc-editor.org/rfc/rfc6979.html
- RFC 7518 — JSON Web Algorithms, ES256 : https://www.rfc-editor.org/rfc/rfc7518.html
- W3C Web Cryptography API : https://www.w3.org/TR/WebCryptoAPI/
- Android Keystore : https://developer.android.com/privacy-and-security/keystore
- Android `java.security.Signature` : https://developer.android.com/reference/java/security/Signature
- Apple CryptoKit ECDSA signature : https://developer.apple.com/documentation/cryptokit/p256/signing/ecdsasignature
- Cloudflare Workers Web Crypto : https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
