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
- [ ] Rechercher un gestionnaire externe offrant une destruction individualisée non restaurable, avec preuve sur sauvegardes/répliques et disponibilité compatible avec une application d'urgence.
- [ ] Évaluer le relais WebSocket Durable Objects lié à Pages Functions ; vérifier qu'aucune coordonnée ou charge utile GPS n'est écrite dans attachments, SQLite, logs ou traces.
- [ ] Tester le relais en direct avec plusieurs contacts, contacts hors ligne, réseau faible et application en arrière-plan ; distinguer explicitement alerte livrée et position disponible.
- [ ] Prototyper les clés locales Android Keystore (TEE/StrongBox) et iOS Keychain WhenPasscodeSetThisDeviceOnly ; tester sauvegardes, restaurations, révocation et suppression à l'échéance.
- [x] Ajouter un prototype expérimental d'échange ECDH P-256 par destinataire, dérivation HKDF-SHA-256 et signature ECDSA P-256 des clés publiques ; tests de base validés par CI run 44189717717 (commit 0c6dd008).
- [x] Ajouter une empreinte SHA-256 lisible de la clé publique d'identité ; typecheck, tests existants et build validés par CI run 44189915423 (commit 7b3afdadd).
- [x] Valider en CI les tests de stabilité, différence et validation d'empreinte : 18 tests réussis, 0 échec, typecheck et build réussis (run 44189940721, commit 0f83c114).
- [ ] Vérifier la CI du dernier commit documentaire et de mise à jour du suivi.
- [ ] Concevoir puis faire valider l'écran et la procédure de comparaison indépendante des empreintes entre proches ; ne jamais considérer une clé reçue du serveur comme authentifiée par défaut.
- [ ] Spécifier et tester rotation, révocation, multi-appareils et récupération de compte sans rétablissement silencieux de la confiance.
- [ ] Étendre les tests crypto à la rotation, à la révocation, au rejeu, à la liaison session/destinataire et à l'interopérabilité Android/iOS.
- [ ] Démontrer le comportement après J+30 si le téléphone est éteint ou si le système ne réveille pas l'application ; la suppression à l'heure exacte n'est pas encore garantie.
- [ ] Vérifier sur Android/iOS les fenêtres réelles d'exécution en arrière-plan ; WorkManager et BGTaskScheduler ne garantissent pas une exécution à l'heure exacte.
- [x] Confirmer que la protection J+30 porte sur les données sous contrôle de SAC ; les copies conservées par les contacts de confiance ne sont pas dans le périmètre d'effacement.


## Gestion multi-appareils — décision du 17 novembre 2026

- [x] Valider le principe produit : un même compte SAC peut utiliser plusieurs appareils.
- [x] Définir les règles de base : identité par compte, sessions et clés privées propres à chaque appareil, approbation explicite, révocation indépendante.
- [x] Documenter la séparation entre récupération du compte et récupération de la confiance/clé GPS.
- [x] Documenter la limite : une révocation serveur ne peut pas effacer à distance un appareil hors ligne ni ses données locales.
- [x] Ajouter le modèle conceptuel, les familles d'API et les critères de test dans l'architecture.
- [ ] Concevoir le protocole complet d'identité racine et de certification des appareils ; ne pas connecter le prototype crypto actuel avant revue.
- [ ] Définir le parcours UX de jumelage (QR/code de comparaison, approbation sur appareil existant, erreurs et annulation).
- [ ] Définir la récupération après perte de tous les appareils et la procédure de revérification indépendante des contacts.
- [ ] Définir les règles de révocation des sessions, push, certificats, clés ECDH et partages GPS en cours.
- [x] Ajouter le contrat TypeScript pur et les tests unitaires des états/transitions d'appareil (14 tests) ; CI run 44191818016 réussie sur commit eab16e659bd6d8759747f466d4dab57962178005. Ce contrat ne remplace pas les contrôles serveur.
- [ ] Implémenter les API d'enrôlement, liste, approbation, renommage et révocation après validation des contrats.
- [ ] Valider le schéma D1 et les politiques d'accès avant toute migration.
- [ ] Tester plusieurs appareils PWA, Android et iOS, y compris appareil hors ligne, perdu, restauré et réinstallé.
- [ ] Vérifier qu'aucune synchronisation automatique ne copie les archives GPS ni les clés privées.


- [x] Rédiger une proposition détaillée de protocole multi-appareils (hiérarchie de clés, enrôlement, récupération, révocation, contrats indicatifs et tests adversariaux) dans docs/PROTOCOLE_MULTI_APPAREILS.md.
- [x] Modèle d'un appareil racine unique approbateur validé par l'utilisateur le 17 novembre 2026 ; risque de point unique d'approbation accepté et récupération après perte de tous les appareils soumise à une nouvelle identité + revérification indépendante des contacts.
- [ ] Faire valider le format du transcript signé, la comparaison indépendante et la durée de vie du défi anti-rejeu.
- [ ] Spécifier la transition de racine, la récupération après perte de tous les appareils et la revérification des contacts.
- [ ] Faire une revue cryptographique indépendante du protocole avant toute implémentation.


## Revue cryptographique — état

- [x] Réaliser une revue interne préliminaire des primitives ECDH/ECDSA/AES-GCM et consigner les constats dans docs/REVUE_CRYPTO_PRELIMINAIRE.md.
- [x] Durcir le prototype : contexte HKDF non ambigu, validation défensive des bundles, contrôle de cohérence des clés de signature et rejet des JWK privés.
- [ ] Faire réaliser une revue cryptographique indépendante par un spécialiste externe avant tout raccordement aux données GPS réelles.
- [ ] Définir et tester les clés directionnelles et le contexte HKDF complet (compte, cérémonie, appareils, usage, direction, version).
- [ ] Définir l'amorçage sécurisé de la première identité racine et les certificats d'appareil complets.
- [ ] Finaliser et tester le transcript canonique et la comparaison indépendante à six mots sur PWA, Android et iOS.
- [ ] Démontrer les garanties de stockage et de révocation des clés sur les appareils cibles.
- [ ] Prouver séparément la destruction irréversible des clés GPS à J+30, y compris contre toute restauration.