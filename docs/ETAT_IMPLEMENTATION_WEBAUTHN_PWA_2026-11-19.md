# SAC — État d'implémentation WebAuthn PWA

- **Date :** 19 novembre 2026
- **Dépôt :** `benwahab/SAC`
- **Branche :** `main`
- **Statut :** socle de contrôle et adaptateur navigateur partiellement implémentés ; enrôlement réel NON opérationnel.

## 1. Implémenté dans le dépôt

### Politique de credential racine
- Refus des credentials `multiDevice` et `unknown`.
- Refus des credentials sauvegardées/synchronisées ou d'un état de sauvegarde incohérent.
- Refus si le validateur ne confirme pas explicitement `userVerified === true`.
- Le Worker de test refuse la credential avant de retourner un résultat positif si la politique racine échoue.
- Tests unitaires des entrées absentes, nulles, mal formées et des indicateurs non conformes.

### Validation cryptographique en runtime Worker de test
- Dépendance de test SimpleWebAuthn 14.1.0.
- Fixtures synthétiques ES256/COSE/CBOR pour les scénarios positifs et négatifs.
- Contrôles challenge, origine, RP ID, flags UP/UV/BE/BS et signature d'authentification.
- Ces fixtures ne remplacent pas les essais avec authenticator physique.

### Adaptateur navigateur
Fichier : `src/services/device/webauthn.ts`

- Conversion stricte des champs Base64URL en `ArrayBuffer`.
- Vérification côté client que les options imposent `authenticatorAttachment: platform` et `userVerification: required`.
- Respect du choix `residentKey` fourni par le serveur : l'adaptateur ne décide pas cette préférence.
- Appel à `navigator.credentials.create()` uniquement en contexte sécurisé et si WebAuthn est disponible.
- Sérialisation de l'identifiant, de `clientDataJSON`, de l'`attestationObject`, des transports et des extensions.
- Gestion explicite de l'annulation et des réponses mal formées.
- Aucun fallback vers Web Crypto, IndexedDB ou une clé logicielle.

Tests : `tests/webauthn-browser-adapter.test.ts`, commande `npm run test:webauthn-browser`.

## 2. Limites importantes

L'adaptateur navigateur n'est pas encore raccordé à un endpoint d'enrôlement SAC. Il ne prouve pas à lui seul l'identité du compte, l'origine, le RP ID, la validité cryptographique de la réponse ni l'unicité de la racine. Ces vérifications appartiennent au serveur.

À ce stade, il n'existe toujours pas de parcours de production complet pour :
- créer et persister une cérémonie racine dans D1 ;
- conserver puis consommer atomiquement un challenge à usage unique ;
- vérifier la réponse réelle de l'appareil avec le validateur côté serveur ;
- enregistrer le credential ID et la clé publique validée ;
- lier une session authentifiée à l'appareil racine ;
- tester la création et l'assertion sur un téléphone Android physique.

## 3. Décisions techniques non figées

Ne pas transformer les propositions documentaires en paramètres de production sans validation :
- `residentKey` final et compatibilité Android réelle ;
- RP ID et liste exacte des origines par environnement ;
- durée, quotas, limitation des tentatives et reprise des cérémonies ;
- modèle D1 définitif et contraintes de concurrence ;
- transaction atomique de création/consommation et idempotence ;
- politique de rétention des cérémonies et preuves.

La règle produit BE=0/BS=0 et la vérification utilisateur obligatoire restent impératives. Si le navigateur ne fournit pas une credential conforme, SAC refuse l'enrôlement.

## 4. CI et statut des tests

Le workflow `.github/workflows/ci.yml` inclut désormais le test de l'adaptateur navigateur. Les commandes de test sont enregistrées dans `package.json`.

**Les tests n'ont pas été déclarés réussis.** Les dernières exécutions GitHub Actions observées échouent au niveau du job avant de publier des étapes ou des journaux (`steps: []`, `logs_url: null`). Il est donc impossible d'attribuer cet échec à une commande du projet ou de confirmer la compilation à distance. Une exécution CI exploitable reste nécessaire.

## 5. Critère de sortie

Le parcours ne sera considéré opérationnel qu'après :
1. endpoint serveur authentifié et options générées côté serveur ;
2. cérémonie/challenge D1 avec consommation unique démontrée sous concurrence ;
3. validation cryptographique serveur et contrôle de la politique racine ;
4. persistance atomique de la credential publique ;
5. session liée à l'appareil et contrôles de révocation ;
6. tests CI verts et essais physiques sur les appareils cibles.

Aucune mise en production ni phase de test utilisateur ne doit être annoncée avant ces critères.
