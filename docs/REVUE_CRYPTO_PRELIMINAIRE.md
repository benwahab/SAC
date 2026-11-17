# SAC — Revue interne préliminaire des primitives cryptographiques

**Date :** 17 novembre 2026  
**Périmètre :** prototypes isolés `src/services/location/key-exchange.ts` et `src/services/location/crypto.ts`, ainsi que leurs tests.  
**Statut :** revue interne de code, non indépendante. Ce document ne constitue ni un audit externe, ni une certification, ni une autorisation de traiter des positions GPS réelles.

## 1. Résumé

L'examen a identifié plusieurs durcissements nécessaires à l'entrée des primitives et à la séparation des contextes cryptographiques. Des corrections limitées ont été apportées au prototype ECDH/ECDSA et des tests adversariaux ont été ajoutés.

Les primitives restent expérimentales et ne sont pas connectées à l'application, aux API, à D1, à R2 ou à un partage GPS. Une revue indépendante par un spécialiste de la cryptographie appliquée reste obligatoire avant toute utilisation réelle.

## 2. Constats et corrections apportées

### 2.1 Encodage du contexte HKDF ambigu — corrigé dans le prototype

L'ancien contexte concaténait les identifiants avec le caractère `:`. Deux paires distinctes pouvaient produire la même chaîne, par exemple `("a:b", "c")` et `("a", "b:c")`.

Le prototype directionnel utilise maintenant un tableau JSON ordonné et versionné pour l'information HKDF (`SAC:location-directional-key:v3`). Des identifiants vides, trop longs ou contenant des caractères de contrôle sont rejetés. Un test vérifie que deux tuples d'identifiants contenant des séparateurs ne dérivent plus la même clé.

**Limite :** le contexte actuel contient la session, l'émetteur, le destinataire, l'usage, l'algorithme et la version. Le compte et l'identifiant de cérémonie ne sont pas encore liés à la dérivation. L'authenticité des identifiants dépendra des certificats d'appareils validés par la racine.

### 2.2 Validation d'un bundle non fiable — corrigé dans le prototype

La vérification lisait certaines propriétés avant son bloc de gestion d'erreur. Une structure distante mal formée pouvait donc provoquer une exception au lieu d'un rejet propre.

La vérification valide désormais la structure dans un bloc protégé, exige des JWK publics EC P-256 avec coordonnées encodées dans le format attendu, refuse un champ privé `d` et exige une signature ECDSA de 64 octets. Une entrée mal formée retourne `false`.

### 2.3 Clés de signature qui ne correspondent pas — corrigé dans le prototype

La fonction de création d'un bundle acceptait auparavant une clé privée de signature et une clé publique d'identité sans vérifier qu'elles formaient une paire. Elle pouvait retourner un bundle inutilisable.

Le bundle créé est maintenant vérifié avant d'être retourné. Une paire incohérente provoque un refus. Les types, courbes et usages des clés sont contrôlés.

### 2.4 Empreinte et JWK privé — corrigé dans le prototype

Le calcul d'empreinte utilise maintenant le même contrôle strict de JWK public et refuse un JWK contenant le matériel privé `d`.

## 3. Tests ajoutés

Le fichier `tests/location-crypto.test.ts` contient maintenant des cas supplémentaires pour :
- clés directionnelles distinctes ;
- restriction des usages WebCrypto (`encrypt` côté émetteur, `decrypt` côté destinataire) ;
- échec de déchiffrement dans le sens inverse ;
- refus d'un identifiant local qui ne correspond à aucun des deux appareils ;
- collision de contexte HKDF par séparateur ;
- clé privée et clé publique d'identité incohérentes ;
- bundle nul ou mal formé ;
- signature de longueur invalide ;
- tentative d'inclure du matériel privé dans un JWK public ;
- identifiant de contexte contenant un caractère de contrôle ;
- rejet d'un JWK privé dans le calcul d'empreinte.

Les tests sont exécutés par `npm run test:crypto` dans la CI existante. Le résultat de la CI correspondant au commit final doit être vérifié avant de déclarer cette série validée.

## 4. Risques bloquants non résolus

1. **Pas d'authentification d'identité complète :** une signature valide d'un bundle prouve seulement que la clé d'identité incluse a signé le lien avec la clé ECDH. Elle ne prouve pas que cette identité est celle du bon utilisateur. L'empreinte doit être ancrée indépendamment et le protocole de l'appareil racine doit être implémenté et audité.
2. **Pas de certificat d'appareil de production :** le bundle expérimental ne lie pas encore l'ensemble des champs requis (compte, appareil, cérémonie, usages, version, expiration, statut et racine).
3. **Séparation directionnelle du prototype — durcie, intégration finale non validée :** `deriveLocationDirectionalKey` dérive un contexte HKDF distinct pour chaque sens. Le pair émetteur reçoit une clé `encrypt` uniquement et le pair destinataire une clé `decrypt` uniquement. Le compte et la cérémonie sont désormais inclus dans le contexte. Les tests vérifient l'isolation entre comptes, cérémonies et directions. L'authentification des identifiants et l'association des clés publiques aux appareils doivent encore être assurées par les certificats.
4. **Contexte HKDF incomplet :** compte, cérémonie, session, appareils, usage, direction, algorithme et version sont liés dans le prototype. Il reste à définir et authentifier formellement les identifiants via le transcript signé, puis à soumettre ce format à la revue indépendante.
5. **Non-exportable ne signifie pas matériellement protégé :** WebCrypto dans une PWA ne garantit ni TEE/StrongBox, ni Android Keystore, ni iOS Keychain, ni absence de copie du profil navigateur. Les garanties doivent être vérifiées par plateforme.
6. **Cycle de vie incomplet :** rotation, révocation, remplacement, récupération, appareils hors ligne et invalidation des partages GPS ne sont pas implémentés.
7. **Démarrage de la première identité racine :** il faut définir comment la première clé racine est liée à un compte après authentification forte, et comment un serveur compromis ne peut pas substituer cette racine au moment de l'inscription.
8. **Comparaison à six mots non finalisée :** liste, algorithme d'extraction, encodage, affichage, contrôle des erreurs et tests interopérables doivent être définis et audités.
9. **Destruction GPS J+30 non résolue :** ces primitives ne prouvent aucune destruction irréversible des clés GPS après 30 jours, y compris contre les sauvegardes et restaurations. La règle stricte J+30 demeure un verrou séparé.
10. **Aucune revue indépendante :** aucune validation externe n'a été effectuée. Ne pas présenter cette revue interne comme un audit professionnel indépendant.

## 5. Conditions avant raccordement aux vraies données GPS

- Revue cryptographique indépendante et traitement documenté de chaque constat.
- Spécification et tests interopérables du transcript canonique et de la cérémonie racine.
- Clés directionnelles, contexte HKDF complet (compte, cérémonie, appareils, usage, sens) et versionné.
- Authentification, autorisation, certificats, révocation et récupération implémentés côté serveur.
- Tests sur PWA, Android et iOS, y compris stockage matériel lorsqu'il est disponible, restauration, réinstallation et perte d'appareil.
- Démonstration séparée de la destruction irréversible J+30 ; aucune clé GPS ne doit dépendre de ces prototypes tant que cette preuve n'existe pas.

## 6. Périmètre de ce qui est réellement fait

- Modifications limitées au prototype expérimental de clés et à ses tests.
- Aucun endpoint, migration D1, stockage R2, fournisseur KMS, ressource Cloudflare ou déploiement créé.
- Aucune clé privée, donnée personnelle ou position GPS réelle ajoutée au dépôt.
- Aucun changement de stack, dépôt ou branche.

## 7. Résultat CI vérifié

La CI du commit de code `234943e9277e0ccbb17de4a9428b537afd22e669` (run GitHub Actions `44192845933`) a réussi. Les journaux confirment **24 tests cryptographiques réussis, 0 échec**, ainsi que le typecheck, les tests du cycle de vie des appareils, le build et l'audit bloquant des dépendances de production. Cette réussite valide les tests automatisés du prototype sur l'environnement CI ; elle ne remplace pas la revue indépendante ni les essais sur appareils physiques.


## 8. Séparation directionnelle ajoutée au prototype

Le prototype ECDH expose maintenant `deriveLocationDirectionalKey`. Les deux appareils dérivent la clé du même sens avec les mêmes identifiants canoniques d'émetteur et de destinataire ; l'appareil émetteur reçoit une CryptoKey AES-GCM limitée à `encrypt`, et le destinataire une clé compatible limitée à `decrypt`. Le sens inverse utilise un contexte HKDF différent et produit une autre clé.

Les tests adversariaux couvrent l'échange normal, le refus des usages interdits, l'échec de déchiffrement avec la clé du sens inverse et le rejet d'un identifiant local étranger.

**Limite importante :** cette fonction est un prototype de dérivation, pas un protocole de transport complet. Elle ne lie pas encore le compte et l'identifiant de cérémonie, ne vérifie pas elle-même le certificat des appareils et ne garantit pas l'authenticité des identifiants fournis. Ces éléments doivent être imposés par la couche de protocole signée avant toute utilisation. Aucun raccordement GPS n'est autorisé.


## 9. Correction de la suite directionnelle après échec CI

La première CI de la séparation directionnelle a révélé un cas de test mal construit : le test de collision HKDF fournissait un identifiant local qui ne correspondait ni à l'émetteur ni au destinataire. La fonction a correctement rejeté cette entrée incohérente ; le défaut était dans le test, pas dans le contrôle d'identité locale.

Le test a été corrigé pour comparer deux tuples valides d'identifiants contenant des séparateurs. La nouvelle CI du commit correctif doit confirmer l'ensemble des tests avant validation.


## 10. Liaison du contexte HKDF au compte et à la cérémonie

La fonction expérimentale `deriveLocationDirectionalKey` utilise désormais le domaine versionné `SAC:location-directional-key:v4` et inclut compte, cérémonie, session, émetteur, destinataire, usage et algorithme dans l'information HKDF. Les tests vérifient qu'un paquet d'une cérémonie ou d'un compte ne peut pas être déchiffré avec une clé dérivée dans un autre contexte.

Cette évolution ne prouve pas à elle seule l'authenticité des identifiants : ceux-ci doivent être issus de certificats d'appareils vérifiés sous la racine de confiance et liés à un transcript signé. L'intégration serveur et la revue cryptographique indépendante restent non réalisées.
