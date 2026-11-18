# SAC — Annexe candidate : évaluation JCS et vecteurs d’interopérabilité

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** bibliothèque candidate intégrée et tests RFC ciblés exécutés — protocole non homologué, non activé.  
**Objet :** évaluer RFC 8785 et préparer les vecteurs communs du futur protocole d’enrôlement multi-appareils.

Cette annexe ne choisit pas définitivement l’encodage, les algorithmes de signature, les règles low-S, les formats de clés, le SAS ou la politique de cérémonie. Elle n’autorise aucune route d’approbation, activation de terminal, session, migration D1, ressource Cloudflare, déploiement ou usage GPS.

## 1. Conclusion provisoire

**JCS (RFC 8785) est le candidat privilégié pour la canonicalisation du transcript**, devant CBOR déterministe, sous réserve de validation indépendante et de tests multi-environnements.

Motifs :
- le dépôt utilise TypeScript/JavaScript côté client et Cloudflare Pages Functions ;
- le runtime Cloudflare documente Web Crypto, dont ECDSA, ECDH et SHA-256 ;
- la RFC 8785 définit une représentation JSON déterministe, UTF-8, adaptée aux signatures et empreintes ;
- la RFC cite explicitement `canonicalize` comme implémentation JavaScript compatible dans son annexe G ;
- le paquet npm `canonicalize` 5.1.0 annonce zéro dépendance directe et une licence Apache-2.0.

Cette recommandation porte uniquement sur le format de canonicalisation. Elle ne valide pas la cérémonie cryptographique entière.

## 2. Bibliothèque candidate

Paquet évalué : `canonicalize` (npm), version observée `5.1.0`.

| Critère | Observation | Statut |
|---|---|---|
| Spécification | RFC 8785 / JCS | Référence normative de conception |
| Implémentation JavaScript | Référencée par l’annexe G de la RFC | Candidat |
| TypeScript | Déclarations TypeScript annoncées par npm | À vérifier dans le build SAC |
| Dépendances directes | 0 annoncée par npm | À confirmer sur l’archive exacte |
| Licence | Apache-2.0 annoncée par npm | À archiver et vérifier |
| Navigateur | JavaScript standard, mais bundle SAC non testé | Non vérifié |
| Cloudflare Workers | JavaScript standard, mais import/build Worker non testé | Non vérifié |
| Android/iOS Capacitor | Aucun test sur WebView ou adaptateur natif | Non vérifié |
| Arbre verrouillé | `canonicalize@5.1.0` est fixé dans `package.json` et `package-lock.json` v3 | Verrouillé et vérifié par `npm ci` |

**Décision de dépendance :** `canonicalize` est désormais ajouté comme dépendance directe exacte `5.1.0`. Le lockfile npm v3 contient l’archive `canonicalize-5.1.0.tgz`, son intégrité SHA-512 et sa licence Apache-2.0. Le code source de `lib/canonicalize.js` a été examiné : tri natif des clés selon l’ordre UTF-16, sérialisation des nombres via `JSON.stringify`, rejet des nombres non finis et des surrogates isolés. La bibliothèque est ESM et déclare Node `>=22`; son usage dans les WebView ciblées reste à vérifier. La CI utilise désormais `npm ci` avec Node `22.23.4` et npm `10.9.9`.

La bibliothèque ne doit jamais recevoir directement un objet JSON non validé provenant du réseau. Le serveur et les clients doivent d’abord rejeter les doublons de propriétés, les chaînes Unicode invalides, les nombres non finis et les structures hors schéma. Il faut éviter le cycle parse/normalisation qui ferait vérifier une représentation différente de celle que l’émetteur a réellement signée.

## 3. Vecteurs JCS de référence à intégrer aux tests

Les exemples ci-dessous sont tirés de RFC 8785, sections 3.2.2 et 3.2.3. Ils servent de fixtures communes. Les espaces et retours à la ligne de présentation ne font pas partie des octets attendus.

### Vecteur JCS-01 — nombres, chaînes et littéraux

Entrée JSON (forme lisible) :

```json
{
  "numbers": [333333333.33333329, 1E30, 4.50, 2e-3, 0.000000000000000000000000001],
  "string": "\u20ac$\u000F\u000aA'\u0042\u0022\u005c\\\"\/",
  "literals": [null, true, false]
}
```

Sortie canonique exacte :

```json
{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\u000f\nA'B\"\\\\\"/"}
```

Contrôles attendus :
- ordre des propriétés : `literals`, `numbers`, `string` ;
- nombre arrondi et notation exponentielle selon ECMAScript/JCS ;
- caractères Unicode non ASCII émis en UTF-8 ;
- échappement des contrôles en minuscules hexadécimales ;
- absence d’espaces hors chaînes.

### Vecteur JCS-02 — ordre UTF-16 des noms de propriétés

Entrée :

```json
{
  "€": "Euro Sign",
  "\r": "Carriage Return",
  "דּ": "Hebrew Letter Dalet With Dagesh",
  "1": "One",
  "😀": "Emoji: Grinning Face",
  "\u0080": "Control",
  "ö": "Latin Small Letter O With Diaeresis"
}
```

Ordre canonique attendu des valeurs :
1. Carriage Return
2. One
3. Control
4. Latin Small Letter O With Diaeresis
5. Euro Sign
6. Emoji: Grinning Face
7. Hebrew Letter Dalet With Dagesh

Le tri doit porter sur les unités de code UTF-16, pas sur la locale, l’ordre Unicode abstrait, UTF-8 ou UTF-32.

### Vecteur JCS-03 — entrée refusée

Les cas suivants doivent échouer avant signature et avant vérification :
- nom de propriété dupliqué dans le JSON brut ;
- chaîne contenant un surrogate isolé ;
- `NaN`, `Infinity` ou `-Infinity` ;
- valeur numérique hors domaine IEEE-754/I-JSON ;
- valeur `undefined`, fonction, symbole ou objet non JSON ;
- objet contenant un comportement `toJSON` inattendu ;
- profondeur ou taille dépassant les limites du schéma SAC.

Une simple valeur JavaScript déjà parsée ne permet pas de détecter de façon fiable les doublons présents dans le JSON source. Le parseur de la frontière réseau doit donc les détecter avant de construire l’objet métier.

## 4. Vecteur de transcript SAC à figer ensuite

Le transcript SAC n’est pas encore suffisamment arbitré pour publier un vecteur cryptographique complet. Les valeurs ci-dessous ne doivent pas être inventées dans une implémentation. Le futur fixture doit contenir des valeurs synthétiques déterministes pour tous les champs du schéma approuvé :

- domaine et version du protocole ;
- identifiants opaques du compte, de la racine, du terminal secondaire et de la cérémonie ;
- version et empreinte de la clé racine ;
- identifiant du défi serveur et défi aléatoire de test ;
- nonces de test des deux appareils ;
- plateforme et usages dans les énumérations approuvées ;
- clés publiques de test encodées selon le format approuvé ;
- horodatages de test imposés par le fixture.

Le fichier fixture final devra fournir :
1. l’objet JSON de test ;
2. la chaîne JCS exacte ;
3. les octets UTF-8 en hexadécimal ;
4. le SHA-256 exact de ces octets ;
5. les signatures d’essai générées par chaque environnement ;
6. les résultats attendus de vérification positive et négative.

Les signatures ECDSA ne sont généralement pas déterministes dans Web Crypto. Il ne faut donc pas exiger que les signatures produites par chaque plateforme soient identiques octet pour octet. Il faut exiger que chaque signature valide les mêmes octets canoniques dans tous les environnements, et que chaque vérificateur rejette les signatures altérées ou liées à un autre transcript.

## 5. Points ECDSA à ne pas confondre

La documentation Cloudflare confirme la prise en charge de ECDSA et ECDH dans Workers. Web Crypto définit une représentation de signature ECDSA brute `r || s`, contrairement à certaines API natives qui peuvent exposer une représentation DER.

Le protocole doit fixer un seul format transporté et testé :
- P-256 et SHA-256 si cette piste est confirmée ;
- signature brute de longueur exacte ou conversion DER strictement définie ;
- validation de `r` et `s` dans les intervalles de la courbe ;
- décision explicite sur low-S ;
- comportement identique des vérificateurs sur toutes les plateformes.

**Low-S reste non arbitré.** Ne pas supposer que Web Crypto normalise automatiquement `s` à la moitié basse de l’ordre de courbe. Ne pas normaliser silencieusement une signature reçue : la règle devra être écrite, testée et appliquée uniformément. La revue cryptographique indépendante devra notamment examiner le risque de malléabilité et les différences de comportement entre fournisseurs.

Les signatures de la racine et du nouvel appareil devront porter sur le même tableau d’octets JCS, avec des domaines de signature distincts et explicites. Les domaines ne doivent pas modifier ou reconstruire différemment le transcript.

## 6. Matrice de tests interopérables obligatoire

| Environnement | Canonicaliser | Signer | Vérifier les signatures des autres | Statut |
|---|---:|---:|---:|---|
| Node.js 22 utilisé en CI | Oui | Tests JCS ciblés | Tests cryptographiques existants | Réussi sur GitHub Actions |
| Chrome Android ciblé | Oui | Oui | Oui | À tester sur appareil |
| Android WebView ciblé | Oui | Oui | Oui | À tester sur appareil |
| Safari iOS ciblé | Oui | Oui | Oui | À tester sur appareil |
| WKWebView iOS ciblé | Oui | Oui | Oui | À tester sur appareil |
| Cloudflare Workers | Oui | Oui si retenu | Oui | À tester dans un Worker isolé |
| Android natif Capacitor/plugin éventuel | Via adaptateur | Via adaptateur | Oui | Non disponible / à tester |
| iOS natif Capacitor/plugin éventuel | Via adaptateur | Via adaptateur | Oui | Non disponible / à tester |

Pour chaque environnement :
- comparer les octets canoniques et leur hash ;
- vérifier une signature issue de chacun des autres environnements ;
- altérer un octet et vérifier le rejet ;
- substituer une clé publique et vérifier le rejet ;
- tester expiration, version et domaine de signature incorrects ;
- tester les clés publiques malformées et les points EC invalides ;
- conserver les résultats, versions runtime et appareils dans les artefacts CI ou le rapport d’essai, sans clé privée ni secret.

Une CI Node verte ne prouve pas les essais Android, iOS ou Worker. Aucun de ces essais ne doit être déclaré réussi sans résultat réellement observé.

## 7. État d’intégration et séquence suivante

Travaux effectivement réalisés dans le dépôt :
- `canonicalize@5.1.0` ajouté en version exacte et verrouillé dans `package-lock.json` v3 ;
- source de la bibliothèque examinée ;
- script `npm run test:jcs` ajouté et branché à la CI ;
- tests exécutés avec succès pour JCS-01 (nombres, chaînes, littéraux), JCS-02 (ordre UTF-16 des noms), tri récursif, préservation de l’ordre des tableaux, nombres non finis, surrogate isolé et stabilité des octets UTF-8 ;
- les 24 valeurs IEEE-754 finies de l’Appendix B sont comparées à leur représentation attendue, et les vecteurs NaN/Infinity sont rejetés ;
- `npm ci`, typecheck, tests cryptographiques existants, build et audit de production réussis dans le workflow de génération.

Limites explicites : ces tests ciblés, y compris tous les exemples numériques de l’Appendix B, ne constituent pas encore la suite exhaustive de conformité RFC 8785. Ils ne valident pas la détection des noms dupliqués dans le JSON brut, le schéma métier du transcript, les signatures inter-plateformes, le SAS, low-S, ni l’atomicité D1.

Séquence suivante :
1. compléter les vecteurs de nombres de l’annexe B et les cas négatifs I-JSON ;
2. ajouter une validation stricte des objets métier avant canonicalisation (objets JSON simples, profondeur/taille bornées, absence de `toJSON`, de valeurs non JSON et de cycles) ;
3. concevoir et tester un parseur d’entrée qui rejette les noms de propriétés dupliqués avant `JSON.parse` ;
4. faire vérifier le schéma de transcript et les champs par la revue indépendante ;
5. après arbitrage, publier un fixture de transcript SAC et ses octets exacts ;
6. exécuter la matrice sur les environnements réellement disponibles ;
7. n’envisager l’implémentation de la cérémonie qu’après validation des formats, de la politique low-S, du SAS, des défis et de l’atomicité D1.

## 8. Sources

- RFC 8785, sections 3.1 à 3.2, sécurité, annexes B et G : https://www.rfc-editor.org/rfc/rfc8785.html
- Paquet npm `canonicalize` : https://www.npmjs.com/package/canonicalize
- Documentation Cloudflare Workers Web Crypto : https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
- Spécification W3C Web Cryptography : https://www.w3.org/TR/WebCrypto/

## 9. Verdict

**JCS + `canonicalize` 5.1.0 est intégré comme candidat de canonicalisation et couvert par des tests ciblés réussis dans Node.js 22. Ce n’est pas une homologation du protocole d’enrôlement.** Aucun transcript de production, aucune cérémonie d’approbation, aucune activation d’appareil et aucune session n’ont été implémentés. Aucun test Chrome/Android, Safari/iOS, WebView ou Cloudflare Workers n’est déclaré exécuté.

Le prochain verrou technique est la reproductibilité des dépendances, puis la production d’un fixture de transcript SAC complet uniquement après fermeture des champs et règles encore ouvertes.
