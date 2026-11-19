# SAC — Schéma strict candidat du transcript d'enrôlement V1

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** candidat technique détaillé — non homologué, non implémenté dans une cérémonie réelle.  
**Dépendances :** spécification candidate multi-appareils, annexes JCS/ECDSA P-256 et protocole d'essais croisés.

## 1. Objet et règle d'autorité

Ce document définit une structure candidate unique pour représenter une demande d'enrôlement. Il ne crée aucune permission et ne permet aucune activation.

Règles déjà validées :
- un seul appareil racine actif en V1 ;
- seul l'appareil racine actif et non révoqué peut approuver un appareil secondaire ;
- le nouvel appareil doit prouver la possession de sa clé privée ;
- les deux appareils signent les mêmes octets canoniques ;
- le serveur est l'autorité pour le compte, la racine, les identifiants de cérémonie, le défi et les dates ;
- un secondaire ne peut jamais approuver un autre appareil ;
- aucune récupération ou promotion de racine en V1.

## 2. Proposition de profil de sérialisation

**Candidat recommandé :** JSON strict à l'entrée, puis canonicalisation RFC 8785 (JCS), UTF-8, SHA-256.

Justification : le dépôt possède déjà une bibliothèque JCS verrouillée, un parseur strict et des tests ciblés. Cela réduit les divergences d'implémentation. Ce choix reste soumis à approbation formelle et à revue indépendante ; CBOR déterministe n'est pas déclaré incompatible, mais ne doit pas être mélangé à ce profil.

Règles proposées :
- entrée JSON UTF-8 valide uniquement ;
- noms de propriétés dupliqués interdits, y compris lorsqu'ils sont écrits avec des échappements différents ;
- propriétés inconnues interdites ;
- aucune valeur `null` ;
- aucune valeur flottante, aucun NaN/Infinity ;
- aucun entier hors plage sûre JavaScript ;
- chaînes Unicode valides, sans normalisation Unicode implicite ;
- canonicalisation JCS uniquement après validation complète du schéma ;
- hash SHA-256 calculé sur les octets UTF-8 canoniques ;
- aucune canonicalisation permissive ou correction automatique d'une entrée invalide.

## 3. Schéma candidat exact

Le transcript est un objet JSON plat avec les propriétés suivantes. Les noms et l'ordre ci-dessous sont la présentation documentaire ; JCS détermine l'ordre des propriétés dans les octets canoniques.

| Champ | Type / format candidat | Source faisant autorité | Règle |
|---|---|---|---|
| `protocol` | chaîne constante `SAC-DEVICE-ENROLLMENT` | serveur | domaine du protocole |
| `version` | entier `1` | serveur | version exacte |
| `accountId` | identifiant opaque chaîne | serveur | compte authentifié, jamais fourni librement par le client |
| `rootDeviceId` | identifiant opaque chaîne | serveur | racine actuellement active |
| `rootKeyVersion` | entier positif | serveur | version de clé racine active |
| `rootIdentityKeyThumbprint` | base64url sans padding, 32 octets | calcul serveur | SHA-256 de la représentation de clé publique définie par le profil |
| `ceremonyId` | base64url sans padding, 16 octets | serveur | identifiant aléatoire unique |
| `challengeId` | base64url sans padding, 16 octets | serveur | identifiant opaque du défi |
| `challenge` | base64url sans padding, 32 octets | serveur CSPRNG | défi imprévisible, une seule utilisation |
| `newDeviceId` | base64url sans padding, 16 octets | serveur | identifiant réservé au nouvel appareil |
| `newDeviceNonce` | base64url sans padding, 32 octets | nouvel appareil | nonce aléatoire local |
| `rootNonce` | base64url sans padding, 32 octets | appareil racine | nonce aléatoire local |
| `platform` | enum `web`, `android`, `ios` | client contrôlé puis validé | aucune autre valeur |
| `identityPublicKey` | objet JWK public P-256 minimal | nouvel appareil | clé de signature, aucun champ privé |
| `agreementPublicKey` | objet JWK public P-256 minimal | nouvel appareil | clé ECDH, aucun champ privé |
| `usages` | tableau de chaînes enum | serveur selon version | ordre fixe, sans doublon |
| `issuedAt` | entier epoch Unix en millisecondes | serveur | date d'émission |
| `expiresAt` | entier epoch Unix en millisecondes | serveur | expiration strictement postérieure à émission |

Aucun autre champ n'est accepté dans la version 1. Les champs d'état (pending/approved/revoked), les signatures, les sessions, les jetons et les données de transport ne font pas partie du transcript.

### 3.1 Profil JWK public candidat

Chaque clé est un objet contenant exactement :
- `kty`: `EC`
- `crv`: `P-256`
- `x`: base64url sans padding décodant exactement 32 octets
- `y`: base64url sans padding décodant exactement 32 octets

Interdits : `d`, `key_ops`, `alg`, `use`, `ext`, membres inconnus, padding `=`, caractères hors alphabet base64url, longueurs incorrectes et bits de remplissage non nuls.

La validation syntaxique JWK ne suffit pas : le point public doit être importé/validé par le moteur cryptographique et être un point valide de P-256. Les deux paires de clés doivent être distinctes et leurs usages ne doivent jamais être confondus.

### 3.2 Enumération candidate des usages

Ordre strict proposé :
1. `device-authentication`
2. `key-agreement`

Le tableau doit contenir exactement ces deux valeurs dans cet ordre pour la V1 candidate. Aucun usage GPS, stockage, signature de document ou approbation d'appareil supplémentaire n'est implicite. Les usages GPS relèvent d'un protocole séparé et restent NO-GO.

## 4. Contraintes de validation proposées

- Taille maximale du JSON reçu avant parsing : 16 KiB.
- Profondeur maximale : 8 niveaux.
- Nombre maximal de propriétés : 32.
- Longueur maximale d'une chaîne : 512 caractères Unicode.
- Les identifiants base64url ont une longueur exacte correspondant à leurs octets décodés.
- `issuedAt` et `expiresAt` sont des entiers sûrs positifs en millisecondes.
- `expiresAt > issuedAt`.
- La durée maximale du défi n'est pas encore fixée ; elle doit être une constante versionnée décidée avant implémentation.
- Le serveur refuse toute demande si la durée ou l'horodatage ne correspondent pas à son état autoritaire.
- Les valeurs de plateforme ne déterminent jamais les permissions ou le niveau de confiance.
- Les clés publiques sont validées avant leur empreinte et avant toute signature.
- Le transcript ne peut pas être reconstruit depuis des champs clients après signature : les octets canoniques et leur hash sont figés pour la cérémonie.

Les limites 16 KiB, profondeur 8, 32 propriétés et 512 caractères sont des valeurs de travail à mesurer contre les implémentations mobiles et à faire approuver ; elles ne sont pas des décisions produit déjà validées.

## 5. Domaines de signature candidats

Les signatures ne sont pas des propriétés du transcript. Elles sont transportées séparément pour empêcher une signature de signer elle-même ou l'autre signature.

Deux messages distincts sont proposés :

- preuve du nouvel appareil : octets UTF-8 de `SAC-DEVICE-ENROLLMENT-NEW-DEVICE-V1`, suivis d'un octet nul, puis des octets JCS du transcript ;
- approbation racine : octets UTF-8 de `SAC-DEVICE-ENROLLMENT-ROOT-APPROVAL-V1`, suivis d'un octet nul, puis des mêmes octets JCS du transcript.

Cette séparation empêche de réutiliser une signature valide dans l'autre rôle. Elle signifie que les deux appareils signent le même transcript, mais avec un préfixe de domaine différent. Ce point doit être validé par la revue cryptographique avant toute implémentation.

Aucune signature ne doit être calculée sur un JSON re-sérialisé différemment, sur un hash textuel hexadécimal, ou sur une représentation de transcript reconstruite.

## 6. Empreinte de clé candidate

La règle de calcul proposée pour `rootIdentityKeyThumbprint` est :
1. valider strictement le JWK public minimal ;
2. canonicaliser l'objet JWK minimal avec JCS ;
3. encoder la chaîne canonique en UTF-8 ;
4. calculer SHA-256 ;
5. encoder les 32 octets en base64url sans padding.

L'ordre, les membres exacts et la version de cette règle doivent rester identiques dans les clients et le serveur. Une empreinte fournie par le client n'est jamais autoritaire.

## 7. Exemple de structure — valeurs fictives non utilisables

L'exemple ci-dessous est uniquement illustratif. Les valeurs ne sont pas des clés, identifiants ou défis valides à utiliser en production.

```json
{
  "protocol": "SAC-DEVICE-ENROLLMENT",
  "version": 1,
  "accountId": "EXAMPLE_ACCOUNT_ID",
  "rootDeviceId": "EXAMPLE_ROOT_DEVICE_ID",
  "rootKeyVersion": 1,
  "rootIdentityKeyThumbprint": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "ceremonyId": "AAAAAAAAAAAAAAAAAAAAAA",
  "challengeId": "AAAAAAAAAAAAAAAAAAAAAA",
  "challenge": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "newDeviceId": "AAAAAAAAAAAAAAAAAAAAAA",
  "newDeviceNonce": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "rootNonce": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "platform": "android",
  "identityPublicKey": {
    "kty": "EC",
    "crv": "P-256",
    "x": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "y": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
  },
  "agreementPublicKey": {
    "kty": "EC",
    "crv": "P-256",
    "x": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "y": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
  },
  "usages": ["device-authentication", "key-agreement"],
  "issuedAt": 1795046400000,
  "expiresAt": 1795047000000
}
```

Les coordonnées de clé de cet exemple sont des placeholders et ne représentent pas nécessairement un point P-256 valide. L'exemple ne doit jamais être utilisé comme vecteur de test cryptographique.

## 8. Ordre des validations

1. Limiter la taille brute avant parsing.
2. Parser en rejetant les noms dupliqués, les Unicode invalides et les nombres interdits.
3. Vérifier l'ensemble exact des propriétés et les types.
4. Valider les enums, les longueurs, les formats et les limites.
5. Valider les deux clés publiques et leurs usages.
6. Comparer les champs autoritaires au compte, à la racine et à la demande D1.
7. Construire les octets JCS une seule fois.
8. Calculer SHA-256 sur ces octets.
9. Afficher/calculer le SAS uniquement depuis ces octets après sa spécification indépendante.
10. Vérifier les signatures sur les messages avec domaines dédiés.
11. Réévaluer toutes les préconditions au commit atomique D1.

Une erreur à une étape entraîne le rejet complet de la cérémonie. Aucun fallback ou correction silencieuse.

## 9. Hors périmètre et décisions bloquantes

Ce schéma ne fixe pas :
- la durée exacte du défi, les quotas ou les tentatives ;
- le calcul du SAS et sa liste de mots ;
- l'algorithme de signature final, le format raw/DER réseau ou la politique low-S ;
- la construction et les paramètres ECDH/HKDF ;
- le stockage matériel des clés selon les plateformes ;
- le modèle de session après activation ;
- l'atomicité D1, les courses avec révocation et l'idempotence ;
- le contenu exact du certificat durable d'appareil ;
- les règles d'audit, notification et révocation.

Le schéma ne doit pas être branché aux endpoints, au certificat expérimental ou aux sessions avant fermeture de ces points et revue indépendante.

## 10. Prochaines vérifications

Avant de transformer ce candidat en schéma exécutable :
1. confronter chaque champ au modèle D1 actuel et aux identifiants réellement utilisés ;
2. vérifier les tailles et contraintes contre les limites réelles des runtimes Web, Android et iOS ;
3. examiner l'empreinte JWK et les domaines de signature avec un spécialiste cryptographique ;
4. définir les vecteurs de transcript avec vraies clés de test P-256 et octets canoniques exacts ;
5. faire les essais interopérables sur appareils réels ;
6. résoudre l'atomicité D1 par tests de concurrence et de rollback ;
7. enregistrer les décisions approuvées dans la spécification principale avant d'écrire une cérémonie.

**Verdict :** schéma candidat détaillé disponible pour revue. Aucun endpoint, aucune migration D1, aucun appareil ou aucune session n'est activé. Le NO-GO reste en vigueur.
