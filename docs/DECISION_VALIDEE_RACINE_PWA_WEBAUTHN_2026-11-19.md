# SAC — Décision validée : racine PWA avec WebAuthn

> **Mise à jour du 21 novembre 2026 :** la clé de sécurité reste recommandée mais n’est plus exigée à la première connexion. Un compte peut ouvrir une session avec e-mail + mot de passe, puis configurer la clé depuis les réglages. Voir [DECISION_CLE_SECURITE_OPTIONNELLE_2026-11-21.md](DECISION_CLE_SECURITE_OPTIONNELLE_2026-11-21.md). Le profil WebAuthn et les garanties single-device restent inchangés.

- **Date :** 19 novembre 2026
- **Dépôt :** benwahab/SAC
- **Branche :** main
- **Statut :** choix produit/architecture validé par l'utilisateur ; détails d'implémentation encore à spécifier et tester.

## Décision

SAC V1 retiendra l'option A : permettre la création de l'appareil racine depuis la PWA au moyen de WebAuthn, avec authenticator de plateforme, vérification utilisateur obligatoire et credential single-device non éligible à la sauvegarde/synchronisation (BE=0, BS=0).

Ce choix vise à rendre possible l'utilisation normale de SAC et la phase de tests depuis la PWA sur les appareils compatibles WebAuthn qui satisfont effectivement ces contrôles.

## Garanties à afficher sans exagération

- Le serveur vérifie la cérémonie WebAuthn, le challenge, l'origine SAC, le RP ID, l'identité de la credential, les flags UP/UV et les flags BE/BS selon le profil final.
- Une credential avec BE=1 est refusée comme racine V1.
- La garantie annoncée est « authenticator lié à un appareil et non synchronisable selon les indicateurs WebAuthn vérifiés ».
- Cette approche ne prouve pas que la clé réside dans StrongBox, TEE ou Secure Enclave. Ne jamais employer « matériel certifié » pour cette racine PWA.
- Aucun fallback silencieux vers une clé Web Crypto non extractible dans IndexedDB n'est autorisé.
- Si un appareil/navigateur ne satisfait pas les contrôles, SAC doit refuser la création de racine et expliquer la limite, plutôt que dégrader silencieusement la sécurité.

## Conséquences sur le multi-appareils

- Un seul appareil racine actif par compte en V1.
- Seul l'appareil racine peut approuver un nouvel appareil secondaire.
- Un appareil secondaire ne peut pas approuver un autre appareil ni se promouvoir racine.
- L'approbation doit porter cryptographiquement sur la demande/transcript exact, être à usage unique et être protégée contre rejeu et courses concurrentes.

## Hors périmètre de cette validation

Les clients natifs Android avec Android Keystore/attestation et iOS avec Secure Enclave/App Attest restent des pistes d'évolution distinctes. Cette décision ne les rend ni nécessaires à la phase de tests PWA, ni déjà opérationnels.

## Travaux techniques encore obligatoires avant mise en service

1. Finaliser le profil WebAuthn d'enregistrement de la racine et sa politique d'attestation/confidentialité.
2. Finaliser le transcript canonique et les vecteurs de test indépendants.
3. Finaliser et auditer la preuve WebAuthn qui lie l'approbation racine au transcript exact.
4. Définir la vérification serveur et, si retenue, la vérification indépendante par le nouvel appareil.
5. Spécifier l'atomicité D1, la consommation unique des challenges, l'idempotence et les courses concurrentes.
6. Définir la persistance des credentials, appareils, cérémonies et sessions sans stocker de clé privée ni de jeton brut.
7. Tester sur des appareils Android physiques et les navigateurs réellement ciblés, puis vérifier les autres plateformes prévues.
8. Documenter les erreurs de compatibilité et garantir l'absence de fallback moins sûr.

## État réel

Au moment de cette décision, l'authentification complète, l'enrôlement WebAuthn racine, l'approbation des appareils secondaires et les parcours SOS ne sont pas encore implémentés de bout en bout. Le choix est validé ; l'application n'est pas déclarée prête pour les essais utilisateurs tant que ces parcours n'ont pas été construits et testés.

## Documents techniques associés

- [Étude d'architecture racine PWA/WebAuthn](ARCHITECTURE_RACINE_PWA_WEBAUTHN_ET_CLES_NATIVES_V1.md)
- [Profil candidat de preuve WebAuthn liée au transcript](PROFIL_PREUVE_WEBAUTHN_TRANSCRIPT_APPROBATION_V1.md)
- [Modèle relationnel conceptuel des appareils](MODELE_RELATIONNEL_CONCEPTUEL_APPAREILS_ENROLEMENT_V1.md)
