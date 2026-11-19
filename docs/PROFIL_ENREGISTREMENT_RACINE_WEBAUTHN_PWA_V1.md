# SAC — Profil candidat d'enregistrement de la racine WebAuthn PWA

- **Date :** 19 novembre 2026
- **Dépôt :** `benwahab/SAC`, branche `main`
- **Statut :** proposition technique issue de la décision produit validée ; non implémentée, non encore gelée pour production.
- **Dépendances :** `DECISION_VALIDEE_RACINE_PWA_WEBAUTHN_2026-11-19.md`, `ARCHITECTURE_RACINE_PWA_WEBAUTHN_ET_CLES_NATIVES_V1.md`.

## 1. Objectif et décision produit applicable

La racine SAC V1 est créée depuis la PWA par WebAuthn. L'authenticator doit être de plateforme, exiger une vérification de l'utilisateur et produire une credential single-device non éligible à la sauvegarde/synchronisation.

La règle produit validée est BE=0 et BS=0. Selon WebAuthn Level 3, BE indique l'éligibilité multi-appareil et ne change pas après l'enregistrement ; BS indique l'état de sauvegarde courant. La combinaison BE=0/BS=1 est invalide. La combinaison BE=0/BS=0 désigne une credential single-device. Une credential BE=1 est refusée comme racine V1, même si BS=0 au moment de l'inscription.

Cette politique peut exclure des passkeys de plateforme courantes, notamment celles éligibles à la synchronisation. SAC ne doit jamais contourner ce refus avec une clé logicielle de secours.

## 2. Préconditions côté serveur

Avant d'émettre les options WebAuthn :

1. Le compte existe et son adresse email est vérifiée ; son état est autorisé à poursuivre l'enrôlement.
2. Aucun appareil racine n'est déjà actif pour ce compte.
3. Aucune cérémonie racine concurrente n'est déjà ouverte, selon la règle de concurrence qui sera validée dans le modèle D1.
4. La requête est authentifiée par le parcours d'inscription/connexion prévu et protégée contre CSRF et abus.
5. Le serveur choisit lui-même un identifiant de cérémonie opaque, un challenge cryptographiquement aléatoire, le RP ID, les origines autorisées et les algorithmes acceptés.
6. Les paramètres de déploiement (RP ID/origines) proviennent d'une configuration serveur explicite par environnement ; jamais d'un Host ou Origin arbitrairement reflété depuis la requête.

Les limites de durée, quotas, fréquence de création et stratégie de remplacement d'une cérémonie expirée restent à fixer dans le contrat D1 avant implémentation. Ne pas inventer ces valeurs dans le code.

## 3. Options d'enregistrement proposées

Le serveur construit les options de `navigator.credentials.create()` avec les propriétés suivantes :

- `challenge` : challenge serveur aléatoire à usage unique, encodé Base64URL sans padding dans le JSON d'options.
- `rp.id` : RP ID SAC exact configuré pour l'environnement ; `rp.name` : nom d'affichage SAC.
- `user.id` : identifiant opaque et stable propre à SAC, non dérivé de l'email ou du téléphone.
- `user.name` et `user.displayName` : valeurs d'affichage contrôlées, sans utiliser ces champs comme preuve d'identité.
- `pubKeyCredParams` : profil initial limité à ES256 (COSE alg -7) pour alignement avec la revue crypto P-256 existante ; compatibilité réelle à vérifier sur appareils cibles avant gel.
- `authenticatorSelection.authenticatorAttachment` : `platform`.
- `authenticatorSelection.userVerification` : `required`.
- `authenticatorSelection.residentKey` : proposition `required` afin d'obtenir une credential découvrable et d'éviter une dépendance à un identifiant saisi pour retrouver la credential ; à confirmer par test de compatibilité du parcours SAC.
- `attestation` : proposition `none` pour limiter la collecte d'identifiants d'authenticator et les risques de corrélation. Cela ne signifie pas absence de vérification de la credential, de son attestation object ou des données authenticator ; le serveur doit toujours valider le format et les champs requis.
- `excludeCredentials` : inclure toute credential racine SAC déjà connue pour le compte si une tentative précédente ou un état partiel l'exige, sans exposer des credentials d'autres comptes.

Aucune option ne doit être construite à partir de paramètres de sécurité fournis par le navigateur. Le client ne décide ni du RP ID, ni de l'origine autorisée, ni des algorithmes acceptés, ni du niveau de confiance.

## 4. Vérifications obligatoires de la réponse d'enregistrement

Le serveur décode strictement la réponse et rejette toute structure invalide, trop volumineuse ou incohérente. La liste suivante est un contrat de vérification candidat, à transformer en tests de conformité :

1. La cérémonie existe, appartient au compte et au contexte d'enrôlement attendus, est encore en attente et n'a jamais été consommée.
2. Le challenge de `clientDataJSON` correspond octet pour octet au challenge serveur ; `type` vaut `webauthn.create`.
3. L'origine est exactement l'une des origines SAC autorisées pour l'environnement. Pas de suffixe, sous-chaîne, wildcard ou comparaison approximative.
4. Le contexte cross-origin est refusé selon la politique SAC ; un `topOrigin` inattendu est refusé.
5. Le `rpIdHash` dans `authenticatorData` est égal à SHA-256 du RP ID configuré.
6. Le flag UP vaut 1 et le flag UV vaut 1.
7. Le flag BE vaut 0 et le flag BS vaut 0. BE=0/BS=1 est rejeté comme combinaison invalide ; BE=1 est rejeté comme credential multi-device, même si BS=0.
8. Les bits réservés doivent respecter la version WebAuthn et le profil de parseur ; aucune donnée inconnue ne peut être interprétée comme une preuve de sécurité.
9. Le flag AT et les données credential attestées sont présents dans le contexte d'enregistrement ; le parseur CBOR extrait sans ambiguïté credential ID et clé publique COSE.
10. Le credential ID retourné correspond à celui inclus dans les données attestées et n'est pas déjà lié à un autre compte SAC.
11. La clé publique COSE correspond à l'algorithme autorisé (ES256/P-256 selon le profil retenu), avec paramètres de courbe et points strictement validés.
12. Le format d'attestation est traité selon la politique `none` et le standard : aucune attestation de fabricant ou preuve StrongBox/TEE ne doit être revendiquée.
13. Les extensions sont refusées si non prévues par le profil ; celles acceptées doivent être explicitement parsées et validées.
14. Les tailles des champs, encodages Base64URL, CBOR, identifiants et JSON sont bornés ; les entrées malformées et doublons sont rejetés.
15. Les valeurs de confiance enregistrées sont calculées par le serveur à partir des preuves validées, jamais reprises comme assertions du client.

Ne jamais accepter la réponse parce que le navigateur a affiché un succès ou parce que le client affirme que l'empreinte est correcte.

## 5. Enregistrement atomique et état de racine

Après validation cryptographique complète, une transaction atomique doit :

- consommer la cérémonie et son challenge une seule fois ;
- vérifier qu'aucune autre racine active n'a été créée entre-temps ;
- enregistrer le credential ID, la clé publique COSE/JWK normalisée, l'algorithme, le RP ID/version de profil, BE=0, BS=0, l'état actif et les métadonnées minimales nécessaires ;
- créer l'appareil racine et la relation de racine du compte ;
- écrire l'événement d'audit sans challenge brut, assertion complète inutile, clé privée, mot de passe, OTP ou secret ;
- rendre impossible un état partiel où le compte possède une racine active mais où la cérémonie reste réutilisable, ou l'inverse.

Une simple séquence de requêtes SQL séparées ou l'hypothèse que `DB.batch()` garantit à elle seule toutes les propriétés ne suffit pas. Le contrat transactionnel D1 doit démontrer les préconditions, l'ordre, la concurrence, l'idempotence et le comportement en cas de réponse perdue.

## 6. Utilisation ultérieure de la racine

Pour une approbation sensible (notamment ajout d'appareil), SAC doit appeler `navigator.credentials.get()` en demandant explicitement la credential racine attendue, avec `userVerification: required`, un challenge neuf lié à l'opération et au transcript canonique. Le serveur vérifie chaque assertion avec la clé publique enregistrée, le RP ID, l'origine, le challenge, les flags UP/UV et l'état du credential.

La preuve doit être liée à l'opération exacte ; une assertion de connexion ordinaire ne vaut jamais approbation d'un appareil. Le profil séparé `PROFIL_PREUVE_WEBAUTHN_TRANSCRIPT_APPROBATION_V1.md` demeure candidat et doit être finalisé avant toute intégration.

## 7. Perte de l'appareil racine et récupération

BE=0 signifie que la credential est liée à un seul appareil et ne peut pas être sauvegardée comme credential multi-device. La perte de cet appareil peut donc faire perdre la capacité cryptographique racine.

Le kit de récupération de compte ne restaure pas l'ancienne racine et ne doit pas contourner la preuve cryptographique. Après perte de tous les appareils approuvés, le parcours de rétablissement doit suivre la décision produit déjà actée : nouvelle identité racine créée localement, puis vérification indépendante de la nouvelle empreinte par les proches concernés avant tout nouveau partage GPS. Les règles exactes de réenrôlement, de révocation des anciennes clés et de notification des proches doivent être raccordées au modèle D1 et aux contrats de récupération ; aucune récupération silencieuse de l'ancienne racine n'est autorisée.

## 8. Matrice de tests avant mise en service

### Cas positifs
- authenticator plateforme compatible, UP=1, UV=1, BE=0, BS=0, RP ID/origine corrects ;
- inscription avec attestation `none` conforme ;
- inscription puis assertion racine depuis le même appareil et navigateur ;
- credential découvrable retrouvée dans le parcours prévu.

### Cas négatifs
- BE=1/BS=0 ou BE=1/BS=1 ;
- BE=0/BS=1 ;
- UV=0 ou UP=0 ;
- challenge erroné, expiré, consommé ou associé à une autre cérémonie ;
- mauvais RP ID, origine ou contexte cross-origin ;
- credential ID dupliqué, clé COSE inattendue, algorithme non autorisé ;
- CBOR, JSON ou Base64URL malformé, champs dupliqués, extensions non autorisées ;
- réponse rejouée, requêtes concurrentes, double création de racine ;
- réponse perdue après commit puis nouvelle soumission ;
- authenticator absent, refus utilisateur, annulation ou navigateur incompatible ;
- tentative de fallback vers Web Crypto/IndexedDB : doit être impossible.

### Tests physiques obligatoires
Construire une matrice réelle Android (fabricants, versions Android, navigateurs, méthodes de verrouillage et fournisseurs de passkeys). Pour chaque appareil, relever uniquement les résultats techniques utiles : création possible, type d'authenticator, UV, BE/BS, assertion ultérieure et comportement après redémarrage/mise à jour. Ne pas déduire la compatibilité d'un modèle de téléphone à partir de son nom commercial.

## 9. Points à fermer avant le code de production

- Confirmer le besoin de credential découvrable `residentKey: required` sur les appareils ciblés.
- Confirmer ES256 seul ou ajouter un autre algorithme après revue et tests.
- Fixer RP ID/origines par environnement et stratégie de changement de domaine.
- Fixer TTL, quotas, limitation d'essais, expiration et reprise d'une cérémonie interrompue.
- Fixer le schéma D1, les contraintes uniques, le contrôle d'unicité de racine et la transaction atomique.
- Sélectionner et auditer un validateur WebAuthn serveur compatible Workers/Cloudflare ; vérifier sa maintenance, son parsing CBOR, son support exact de WebAuthn Level 3 et ses tests.
- Produire des vecteurs de conformité et tests d'interopérabilité indépendants.
- Tester sur appareils physiques réels, notamment la disponibilité de credentials BE=0 dans l'écosystème Android réellement utilisé.

## 10. Conclusion

Le choix de l'option A est validé par l'utilisateur ; ce profil est une traduction technique candidate de ce choix. Il ne doit pas être implémenté tel quel avant fermeture des points de la section 9 et revue indépendante du validateur. Le critère produit reste ferme : si l'appareil ne fournit pas une credential WebAuthn plateforme vérifiable avec BE=0 et BS=0, SAC refuse la création de racine plutôt que de réduire silencieusement le niveau de sécurité.

## Références normatives

- W3C, Web Authentication: An API for accessing Public Key Credentials — Level 3, recommandation publiée le 25 août 2026 : https://www.w3.org/TR/2026/REC-webauthn-3-20260825/
- W3C, WebAuthn Level 3, sections sur authenticator data, flags UP/UV/BE/BS, credential backup state et vérification d'enregistrement.


## 11. Réexamen du choix residentKey — observation SimpleWebAuthn 14.1.x

Le profil initial proposait `residentKey: "required"` pour créer une credential découvrable. La documentation actuelle de SimpleWebAuthn 14.1.x indique toutefois que les préférences `"preferred"` et `"required"` entraînent la création de passkeys synchronisées sur Android, tandis que `"discouraged"` évite ce comportement par défaut sur Android.

Cette observation est importante pour SAC, dont la racine V1 doit être mono-appareil :
- **candidat à tester :** `residentKey: "discouraged"` ;
- conserver `authenticatorAttachment: "platform"` et `userVerification: "required"` ;
- refuser côté serveur toute credential dont `BE !== 0` ou `BS !== 0`, même si le navigateur a reçu `residentKey: "discouraged"` ;
- ne jamais considérer `residentKey` comme une preuve de non-synchronisation.

La préférence `"discouraged"` ne garantit pas à elle seule BE=0/BS=0. Le contrôle des flags reçus reste obligatoire et souverain.

**Statut :** recommandation technique candidate, pas une nouvelle décision produit validée. Le profil initial `residentKey: "required"` est à considérer comme remis en question et ne doit pas être implémenté sans révision. La compatibilité réelle doit être mesurée sur les appareils Android ciblés.

Source : documentation officielle SimpleWebAuthn 14.1.x, section `authenticatorSelection.residentKey` : https://simplewebauthn.dev/docs/packages/server/#guiding-use-of-authenticators-via-authenticatorselection
