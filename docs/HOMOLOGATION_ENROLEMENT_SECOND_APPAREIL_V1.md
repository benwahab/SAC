# SAC — Homologation de l'enrôlement d'un second appareil V1

**Date :** 21 novembre 2026
**Dépôt :** `benwahab/SAC`, branche unique `main`
**Statut :** décisions produit et techniques approuvées ; Lots 1 et 2 réalisés, plus une preuve locale de détection de restauration D1 (transcript pur, fixture D1 isolé et rehearsal de restauration). **Aucun endpoint, aucune migration D1 de production, aucune activation réelle et aucun appareil secondaire opérationnel.**
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

## 4. Modèle D1 atomique — Lot 2

Le fixture isolé `tests/d1-secondary-enrollment/` prouve localement :

- consommation unique du défi ;
- activation conditionnelle de l'appareil secondaire ;
- certificat et audit atomiques ;
- une seule cérémonie pending par compte ;
- idempotence par clé et hash de requête ;
- rollback complet sur mauvais digest, mauvais transcript ou défi expiré ;
- course approbation/révocation sans appareil secondaire actif sous une racine révoquée.

Le modèle anti-restauration existant est étendu aux événements d'activation secondaire et d'émission de certificat. Il ne prouve pas encore une restauration D1 réelle avec autorité d'ancrage indépendante. Voir `MODELE_D1_ATOMIQUE_ENROLEMENT_SECOND_APPAREIL_V1.md`.

## 5. Restauration réelle locale — preuve partielle

`npm run test:d1-restore-rehearsal` sauvegarde réellement les fichiers SQLite D1 locaux, applique une révocation, restaure la sauvegarde, redémarre le Worker et vérifie que la tête d'ancrage externe détecte le retour arrière. Le service reste fermé (`503`) jusqu'au rejeu de la révocation.

Le hash d'ancre est défini dans `src/domain/security-anchor.ts`. Le choix de l'autorité de production reste ouvert : voir `ANTI_RESTAURATION_D1_CHOIX_AUTORITE.md`. Aucun fournisseur ni ressource Cloudflare n'est ajouté.

## 6. Proposition QR-assisted pairing

`SPECIFICATION_QR_ASSISTED_PAIRING_V1.md` distingue :

- **Q0** : le nouvel appareil s'authentifie normalement et affiche un QR de récupération ; la racine scanne, compare le SAS et approuve. Pas de nouvelle voie d'authentification.
- **Q1** : la racine affiche un ticket, le nouvel appareil le scanne sans mot de passe et reste `pending`. Nouvelle voie d'authentification, non approuvée.
- **Q2** : QR qui crée une session ou remplace l'approbation racine. Interdit.

Aucun code QR, endpoint ou secret d'appairage n'est implémenté.

## 7. Conditions restantes avant activation réelle

1. Revue indépendante du transcript, des domaines, du SAS et du modèle de menace.
2. Choix et test de la vérification WebAuthn côté Worker, avec origines et RP ID autorisés.
3. Schéma D1 final de production et preuve de consommation atomique, concurrence, rollback et idempotence sur ce schéma.
4. Autorité anti-restauration ou procédure fail-closed démontrée.
5. Contrat de session après activation et révocation immédiate.
6. UX de comparaison SAS sur les deux appareils, avec confirmation explicite.
7. Tests sur appareils Android/iOS réels et navigateurs cibles.
8. Revue de sécurité finale avant tout environnement réel.

## 8. Verdict

**Transcript pur : approuvé et testé.**
**Enrôlement secondaire : NON HOMOLOGUÉ POUR LA PRODUCTION.**
**API, D1, sessions et activation : NON AUTORISÉS par ce document.**
