# SAC — Homologation de l'enrôlement d'un second appareil V1

**Date :** 21 novembre 2026
**Dépôt :** `benwahab/SAC`, branche unique `main`
**Statut :** décisions produit et techniques approuvées par l'utilisateur ; implémentation partielle du Lot 1 (transcript pur). **Aucun endpoint, aucune migration D1, aucune activation réelle et aucun appareil secondaire opérationnel.**
**Portée :** appareil racine unique déjà validé ; ajout d'un appareil secondaire sous son autorité.

## 1. Décisions approuvées

L'utilisateur a validé le paquet suivant le 21 novembre 2026 :

1. **Format canonique :** JSON strict en entrée, puis RFC 8785 (JCS), UTF-8 et SHA-256.
2. **Preuves :** assertions WebAuthn pour la racine et le nouvel appareil, sur des défis dérivés du transcript et séparés par domaine.
3. **SAS :** six mots, liste versionnée de 2 048 entrées, 66 bits utiles.
4. **Durées :** défi serveur 5 minutes, cérémonie complète 10 minutes.
5. **Concurrence :** une seule cérémonie `pending` par compte.
6. **Activation :** aucune session ni capacité privée avant commit atomique D1.
7. **Anti-restauration :** conception séparée obligatoire avant toute API ou migration ; production NO-GO tant qu'elle n'est pas démontrée.

Ces décisions ne valident pas encore le protocole complet pour la production. Elles autorisent le travail de spécification et le transcript pur, pas l'activation d'un appareil.

## 2. Contrat du transcript — Lot 1

Le module `src/domain/device-enrollment-transcript.ts` implémente :

- le schéma strict à 19 champs de `SCHEMA_CANDIDAT_TRANSCRIPT_ENROLEMENT_V1.md` ;
- le rejet des champs inconnus, doublons JSON, valeurs `null`, flottants, entiers non sûrs, Unicode invalide, base64url non canonique et clés JWK invalides ;
- la validation des deux clés P-256 distinctes, avec import cryptographique et validation du point ECDH ;
- la canonicalisation JCS et le hash SHA-256 des octets UTF-8 ;
- les domaines de signature :
  - `SAC-DEVICE-ENROLLMENT-NEW-DEVICE-V1` ;
  - `SAC-DEVICE-ENROLLMENT-ROOT-APPROVAL-V1` ;
- un défi WebAuthn de 32 octets égal à `SHA-256(domaine || 0x00 || JCS)` ;
- le SAS six mots à partir de `SHA-256("SAC-DEVICE-ENROLLMENT-SAS-V1" || 0x00 || JCS || 0x00 || signature_racine)` ;
- le contrôle de fraîcheur avec tolérance d'horloge bornée.

La liste SAS initiale est la liste BIP-0039 anglaise, versionnée par son empreinte SHA-256. Une localisation FR/AR devra être une liste séparée avec les mêmes 2 048 indices ; elle ne doit jamais réordonner la liste de base.

## 3. Ce que le Lot 1 ne fait pas

Le module ne fait pas :

- de création de cérémonie ;
- de stockage de défi ou de nonce ;
- de consommation atomique D1 ;
- de vérification d'assertion WebAuthn complète côté serveur ;
- d'activation d'appareil ;
- de création de session ;
- de révocation ;
- de notification ;
- de certificat durable ;
- de connexion GPS.

Il ne doit pas être branché à une route d'approbation ou à une session tant que les Lots 2 à 5 ne sont pas terminés.

## 4. Conditions restantes avant activation réelle

1. Revue indépendante du transcript, des domaines, du SAS et du modèle de menace.
2. Choix et test de la vérification WebAuthn côté Worker, avec origines et RP ID autorisés.
3. Schéma D1 final et preuve de consommation atomique, concurrence, rollback et idempotence.
4. Autorité anti-restauration ou procédure fail-closed démontrée.
5. Contrat de session après activation et révocation immédiate.
6. UX de comparaison SAS sur les deux appareils, avec confirmation explicite.
7. Tests sur appareils Android/iOS réels et navigateurs cibles.
8. Revue de sécurité finale avant tout environnement réel.

## 5. Verdict

**Transcript pur : approuvé et testé.**
**Enrôlement secondaire : NON HOMOLOGUÉ POUR LA PRODUCTION.**
**API, D1, sessions et activation : NON AUTORISÉS par ce document.**
