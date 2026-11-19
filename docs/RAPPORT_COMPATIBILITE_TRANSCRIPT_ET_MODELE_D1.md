# SAC — Rapport de compatibilité du transcript candidat avec le modèle existant

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** constat d'audit — aucun schéma d'enrôlement approuvé, aucune migration ni API créée.  
**Transcript examiné :** `SCHEMA_CANDIDAT_TRANSCRIPT_ENROLEMENT_V1.md`

## 1. Conclusion exécutive

Le transcript candidat est cohérent comme contrat cryptographique de travail, mais il n'est pas encore raccordable au modèle D1 actuel.

Le dépôt ne contient qu'une migration D1, `0001_account_email_otp.sql`. Elle crée les tables `accounts`, `account_identities` et `email_otp_challenges`. Elle ne crée aucune table d'appareils, de racine cryptographique, de cérémonie, de défi d'enrôlement, de certificat, de session ou de preuve de signature.

Le domaine TypeScript `src/domain/device-management.ts` définit un cycle de vie d'appareil purement en mémoire. Il ne persiste rien et ne prouve aucune autorisation serveur. Le certificat de `src/services/device/device-certificate.ts` est explicitement expérimental, sans stockage, révocation serveur ni sessions.

**Décision d'audit : NO-GO pour tout branchement du transcript aux endpoints, à D1 ou aux sessions.** Il faut d'abord définir le modèle relationnel d'autorité appareil/racine et résoudre les divergences ci-dessous.

## 2. Éléments réellement présents

### 2.1 D1

La migration `migrations/0001_account_email_otp.sql` contient :

- `accounts` : identifiant, état, langue, hash du mot de passe, dates ;
- `account_identities` : identifiants email/téléphone et vérification ;
- `email_otp_challenges` : défis OTP d'activation email.

Aucune colonne ou contrainte ne représente :
- l'appareil racine unique d'un compte ;
- la version ou l'empreinte de sa clé ;
- un appareil secondaire ;
- une demande/cérémonie d'enrôlement ;
- un défi cryptographique à usage unique ;
- le hash du transcript ;
- les deux signatures ;
- la consommation atomique du défi ;
- une session liée à un appareil.

Il serait donc incorrect de présenter aujourd'hui les champs du transcript comme des colonnes D1 déjà existantes.

### 2.2 Domaine appareil

`src/domain/device-management.ts` définit `DeviceRecord` avec :

- `deviceId`, `accountId`, `displayName`, `platform`, `status` ;
- `createdAt`, `verifiedAt`, `lastSeenAt`, `revokedAt`.

Les dates de ce contrat sont des chaînes UTC canoniques ISO avec millisecondes. Le module définit aussi une transition pure ; ses commentaires imposent que l'acteur, l'appareil racine et la session soient déterminés depuis des données authentifiées côté serveur, jamais depuis le corps de requête client.

Ce modèle ne contient pas de clé publique, de version de clé racine, de cérémonie, de défi, de nonce, de hash ni de signature. Il ne constitue pas un registre D1.

### 2.3 Certificat expérimental

`src/services/device/device-certificate.ts` utilise actuellement :

- `accountId`, `deviceId`, `platform`, `createdAt` ;
- `rootFingerprint` ;
- `identityPublicKey` et `exchangePublicKey` ;
- une signature racine.

Le certificat utilise une représentation positionnelle construite avec `JSON.stringify`, et non le transcript JCS candidat. Il ne comporte pas de version de clé racine, de challenge, de cérémonie, de nonce, de durée d'expiration ni de preuve de possession signée par le nouvel appareil.

Il ne faut donc ni le renommer ni le traiter comme une implémentation du nouveau transcript. Ce serait une substitution silencieuse de protocole.

## 3. Matrice de compatibilité du transcript candidat

| Champ candidat | État dans le dépôt | Constat |
|---|---|---|
| `accountId` | Présent dans `accounts.id` et le domaine appareil | Identifiant existant, mais sa source autoritaire doit rester la session côté serveur |
| `rootDeviceId` | Absent de D1 | Aucun registre persistant de racine |
| `rootKeyVersion` | Absent | Aucun compteur/version de clé racine |
| `rootFingerprint` | Présent uniquement dans le certificat expérimental | Calcul existant à auditer ; pas de stockage/liaison D1 |
| `ceremonyId` | Absent | Aucun enregistrement de cérémonie |
| `challengeId`, `challenge` | Absents pour l'enrôlement | Les défis OTP existants sont d'une autre finalité et ne doivent pas être réutilisés |
| `newDeviceId` | Champ analogue `deviceId` dans le domaine | Pas de persistance ni de réservation atomique |
| `newDeviceNonce`, `rootNonce` | Absents | Aucun stockage ni contrôle anti-rejeu |
| `platform` | Enum web/android/ios dans le domaine | Compatible sur les valeurs, pas encore persisté |
| `identityPublicKey` | Présente dans le certificat expérimental | Type et validation P-256 à harmoniser avec le transcript strict |
| `agreementPublicKey` | Le certificat nomme le champ `exchangePublicKey` | Divergence de nom et de contrat ; ne pas accepter les deux silencieusement |
| `usages` | Le certificat encode des usages GPS fixes | Divergence fonctionnelle : le transcript candidat propose device-authentication et key-agreement ; aucune fusion implicite |
| `issuedAt`, `expiresAt` | Absents du domaine appareil | Le transcript propose des entiers millisecondes Unix ; le domaine appareil utilise des chaînes ISO UTC |
| Hash canonique et signatures séparées | Absents de D1 et des endpoints | Aucune preuve persistée ni vérification serveur d'enrôlement |

## 4. Divergences à résoudre avant migration

### D1 — Autorité et relations

Le futur schéma devra exprimer sans ambiguïté :
- au plus une racine active par compte ;
- l'identité/version de la clé racine et son empreinte ;
- la séparation racine / appareil secondaire ;
- une demande d'enrôlement liée au compte, à la racine et au nouvel appareil ;
- le défi à usage unique, son expiration et son état ;
- l'empreinte exacte du transcript et les preuves requises ;
- les transitions monotones et la révocation ;
- la liaison des sessions à l'appareil.

Les noms de tables et contraintes ne sont pas fixés dans ce rapport. Aucun SQL ne doit être déduit de ce tableau seul.

### Horodatages

Le candidat transcript utilise des timestamps entiers en millisecondes Unix, alors que `DeviceRecord` et le certificat utilisent des chaînes ISO UTC canoniques. Le protocole doit conserver une seule représentation binaire normative pour les champs signés. Les conversions d'affichage ou de persistance devront être explicites, testées et sans arrondi.

### Clés et usages

Le certificat expérimental utilise `exchangePublicKey` et des usages liés à l'échange/partage de localisation. Le transcript candidat utilise `agreementPublicKey` et des usages dédiés à l'authentification appareil et à l'accord de clé. Ces contrats ont des finalités différentes. Il faut valider le vocabulaire et les usages définitifs avant d'écrire un adaptateur.

### Canonicalisation et signatures

Le certificat expérimental signe une liste JSON positionnelle avec `JSON.stringify`. Le candidat propose JCS et deux signatures avec séparation de domaine. Ce sont des formats distincts. Aucun code ne doit convertir automatiquement l'ancien certificat en transcript ou accepter les deux encodages sur une même route.

## 5. Découpage sûr des prochaines étapes

1. Définir le modèle d'autorité appareil/racine et les invariants relationnels, sans encore créer de migration.
2. Fixer le vocabulaire final des champs, notamment `agreementPublicKey` et les usages, en cohérence avec les fonctions réelles attendues.
3. Définir le contrat de dates et de stockage du hash/signatures.
4. Obtenir une revue indépendante du transcript, des domaines de signature, de l'empreinte JWK et des usages cryptographiques.
5. Concevoir les transactions D1 conditionnelles et les tests de concurrence, rollback, rejeu et idempotence.
6. Seulement après ces étapes, préparer une migration isolée et ses tests D1 ; aucun déploiement distant sans autorisation distincte.

## 6. Garde-fous confirmés

- Les défis OTP email ne sont pas des défis d'enrôlement d'appareil.
- Mot de passe, OTP et session secondaire ne remplacent jamais l'approbation cryptographique de la racine.
- Aucun secondaire ne devient racine et aucune récupération/remplacement de racine n'est autorisé en V1.
- Aucun appareil en attente ne reçoit de session protégée.
- Aucun endpoint, aucune migration D1, aucune activation d'appareil et aucune ressource Cloudflare n'est créée par ce rapport.
- Le GPS reste hors de ce périmètre et NO-GO selon les conditions de destruction déjà établies.

## 7. Références de dépôt examinées

- `migrations/0001_account_email_otp.sql`
- `src/domain/device-management.ts`
- `src/services/device/device-certificate.ts`
- `docs/ARCHITECTURE_ET_MODELE_DONNEES.md`
- `docs/ARBITRAGE_RECUPERATION_RACINE_ET_ATOMICITE_D1.md`
- `docs/SCHEMA_CANDIDAT_TRANSCRIPT_ENROLEMENT_V1.md`
- `docs/SPECIFICATION_CANDIDATE_ENROLEMENT_MULTI_APPAREILS_V1.md`

**Verdict final :** le transcript candidat ne correspond pas encore à une structure persistée existante. Le modèle appareil actuel est un contrat métier isolé, le certificat est expérimental et la seule migration D1 concerne l'inscription/OTP email. La prochaine livraison doit être le modèle relationnel conceptuel d'autorité et de cérémonie, soumis à revue avant tout SQL exécutable.
