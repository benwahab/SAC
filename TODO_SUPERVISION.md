# SAC — Suivi et supervision

Ce fichier suit les étapes réelles du projet. Une tâche ne passe à « terminée » qu'après vérification observable.

## État général

- [x] Périmètre produit corrigé : sécurité personnelle et familiale, alertes privées aux proches.
- [x] Dépôt officiel confirmé : `benwahab/SAC`.
- [x] Branche unique confirmée : `main`.
- [x] Cahier des charges et documents de décisions présents.
- [x] Règle de rappels : toutes les 5 minutes vers les contacts initiaux jusqu'à clôture.
- [x] SOS discret, écran neutre, code de contrainte et protection contre désactivation forcée documentés.
- [x] Cible d'architecture corrigée : Pages, Pages Functions, D1, R2 sous condition d'activation.
- [x] Audit du Worker Cloudflare `sac` : source `Hello world` uniquement, aucun binding, sous-domaine désactivé, aucune zone DNS associée ; Worker modèle supprimé après audit.
- [x] Créer et vérifier l'existence de la base D1 officielle `sac-db` (UUID confirmé par l'API Cloudflare le 17 novembre 2026, vide, région WEUR, réplication désactivée).
- [ ] Créer et connecter le projet Cloudflare Pages au dépôt GitHub, branche main, après validation du build.
- [ ] Configurer le binding D1 DB dans Pages et vérifier /api/health en Preview.
- [ ] Activer R2 depuis le tableau de bord Cloudflare puis créer le bucket privé SAC.
- [ ] Finaliser les choix d'authentification, OTP, push, SMS et paiement.
- [x] Décider la conservation des positions GPS précises : 30 jours après la fin du partage, puis purge automatique définitive des données actives SAC.
- [x] Réaliser une étude comparative des pistes de destruction cryptographique (KMS externe, D1 Time Travel, Durable Objects) et consigner les limites dans `docs/SECURITE_GPS_DESTRUCTION_CRYPTO.md`.
- [x] Compléter l'évaluation documentaire des limites Google KMS, AWS KMS, AWS CloudHSM et Cloudflare Secrets ; aucun candidat n'est validé pour la garantie stricte J+30.
- [ ] Étudier un mécanisme externe dont l'effacement de clé et toutes ses sauvegardes sont irréversibles à l'échéance, avec preuve contractuelle et testable.
- [x] Vérifier en lecture seule que `sac-db` utilise D1 `version: production`, sans tables, réplication désactivée (17 novembre 2026).
- [x] Documenter la fenêtre D1 Time Travel (30 jours Paid / 7 jours Free) et le risque de réapparition des positions après restauration.
- [x] Valider l'exigence : après 30 jours, aucune restauration ne doit pouvoir récupérer ni rendre lisibles les coordonnées GPS expirées.
- [ ] Définir le chiffrement enveloppe GPS et le cycle de vie des clés après sélection d'un mécanisme réellement compatible J+30.
- [ ] Tester la restauration de sauvegardes antérieures à J+30 et prouver que les coordonnées expirées restent indéchiffrables, y compris après restauration administrative du KMS.
- [ ] Implémenter la purge de rattrapage et son contrôle bloquant avant toute réouverture après restauration D1.
- [ ] Finaliser les détails des rappels de Protection des trajets et les relances d'arrivée.
- [ ] Définir les avantages Premium au-delà des 10 contacts.
- [ ] Valider les limites et rôles des groupes familiaux.
- [ ] Préparer les tests de sécurité, de réseau faible et de non-livraison des notifications.
- [x] Autorisation de démarrer le développement reçue dans la conversation.
- [x] Créer le socle React/Vite/TypeScript et Pages Functions sur main.
- [x] Ajouter manifeste PWA et service worker minimal, sans prétendre à une protection hors-ligne des alertes.
- [x] Ajouter les interfaces d'adaptateurs Web pour géolocalisation, notifications et partage, sans demander de permission automatiquement.
- [x] Ajouter les types TypeScript partagés pour les six catégories d'alerte, les niveaux, les états, les durées de partage et les limites d'offre.
- [x] Ajouter une route de santé API vérifiant réellement l'accès D1.
- [x] Ajouter un workflow CI de typecheck et build.
- [ ] Valider le schéma relationnel détaillé, les rôles, les politiques d'accès, les états, les sauvegardes et les tests de sécurité avant toute migration D1.
- [ ] Créer les migrations D1 et les tests d'accès après validation de ces prérequis.
- [x] Installer les dépendances, exécuter typecheck et build dans GitHub Actions (run 44151374924, commit 6edbd77d).
- [ ] Générer et versionner package-lock.json après installation vérifiée.
- [x] Vérifier le build `npm run build` dans GitHub Actions (run 44151374924, commit 6edbd77d).
- [ ] Configurer et vérifier les déploiements Preview/Production.
- [ ] Tester la préparation Capacitor sur Android puis iOS.

## Règles de mise à jour

- Ne pas cocher une tâche sur la base d'une intention ou d'une configuration supposée.
- Après chaque changement, indiquer le commit GitHub et la preuve de vérification.
- Ne jamais créer une branche secondaire.
- Ne pas supprimer une ressource Cloudflare avant audit de son contenu et de ses dépendances.

- [x] Étendre l'étude documentaire aux mécanismes Fortanix DSM, HashiCorp Vault Transit et AWS External Key Store ; consigner pourquoi aucun n'est encore validé.
- [ ] Auditer un ou plusieurs gestionnaires de clés externes compatibles AWS XKS, notamment leurs sauvegardes, réplications, snapshots, restaurations administrateur et garanties contractuelles de destruction.

- [x] Examiner les documents officiels AWS XKS, Entrust nShield et Thales CipherTrust/CCKM ; consigner les limites de restauration et de destruction individualisée.
- [ ] Rechercher un gestionnaire externe offrant une destruction individualisée non restaurable, avec preuve sur sauvegardes/répliques et disponibilité compatible avec une application d'urgence.\n- [ ] Étudier un relais GPS chiffré sans persistance côté serveur, afin qu'aucune restauration D1/R2 ne puisse réintroduire des coordonnées.\n- [ ] Tester les clés locales Android Keystore (TEE/StrongBox) et iOS Keychain ThisDeviceOnly, y compris sauvegardes, restaurations et suppression à J+30.\n- [ ] Clarifier si la rétention J+30 vise les seules données sous contrôle de SAC ou prétend aussi couvrir les copies reçues par les contacts.
