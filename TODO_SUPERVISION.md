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
- [x] Préparer une proposition de schéma relationnel D1 sans migration ni stockage GPS dans docs/SCHEMA_RELATIONNEL_D1_PROPOSITION.md.
- [x] Réaliser une revue critique de cette proposition et relever les contraintes composites, les garanties de prise en charge, les rappels/outbox, les abonnements push, l'immutabilité, la suppression et les risques de fuite GPS dans docs/REVUE_SCHEMA_RELATIONNEL_D1.md.
- [x] Enrichir la proposition avec les corrections structurelles de la revue : liens composites, abonnements push, outbox récupérable, responsabilité principale, immutabilité et prévention des fuites GPS.
- [x] Formaliser les machines à états métier et la matrice de conservation/suppression (durées hors GPS explicitement laissées ouvertes) dans docs/MACHINES_ETATS_ET_CONSERVATION.md.
- [x] Définir les contrats des opérations D1 atomiques (création d'alerte, prise en charge, clôture, révocation appareil, consommation OTP/jumelage, outbox et accès) dans docs/CONTRATS_OPERATIONS_ATOMIQUES_D1.md.
- [x] Créer le registre des décisions produit restantes avec recommandations explicites et points à valider dans docs/DECISIONS_PRODUIT_RESTANTES.md.
- [x] Formaliser la matrice d'autorisation par acteur, ressource et action dans docs/MATRICE_AUTORISATION_ROLES.md ; les accès après révocation/clôture restent explicitement à valider.
- [x] Ajouter le contrat TypeScript pur de clôture d'alerte et d'éligibilité des rappels, avec 11 tests dédiés ; CI complète réussie (run 44260895045, commit a9ec56f4). Le contrôle ne remplace pas les autorisations serveur ni les transactions D1.
- [x] Ajouter le contrat TypeScript pur des accusés de réception, candidatures volontaires, attribution du responsable principal et transfert après retrait ; 12 tests réussis en CI (run 44261699221, commit d17b8c9f). Le séquencement devra être généré et appliqué atomiquement côté serveur/D1.
- [ ] Faire valider les règles encore ouvertes : accès après révocation d'un contact, suppression de compte, durées de conservation hors GPS et détails des trois modes de Protection des trajets.
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
- [x] Vérifier la CI du commit f9093d20 : typecheck, tests crypto, cycle de vie appareils, certificats racine, autorisation des sessions, build et audits de dépendances réussis (run 44195249590).
- [x] Vérifier les commits documentaires du contrat D1 et du suivi : run 44258827197 et run 44258840470, succès complets.
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
- [ ] Finaliser le protocole complet d'identité racine et de certification des appareils ; ne pas connecter le prototype crypto actuel avant revue.
- [ ] Définir le parcours UX de jumelage (QR/code de comparaison, approbation sur appareil existant, erreurs et annulation).
- [ ] Définir la récupération après perte de tous les appareils et la procédure de revérification indépendante des contacts.
- [ ] Définir les règles de révocation des sessions, push, certificats, clés ECDH et partages GPS en cours.
- [x] Ajouter le contrat TypeScript pur et les tests unitaires des états/transitions d'appareil (14 tests) ; CI run 44191818016 réussie sur commit eab16e659bd6d8759747f466d4dab57962178005. Ce contrat ne remplace pas les contrôles serveur.
- [x] Ajouter un évaluateur pur d'autorisation des sessions liées à un appareil, avec vérification du compte, appareil, état, expiration et auth_version ; tests ajoutés à la CI. Aucun jeton brut ni persistance dans ce prototype.
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
- [x] Ajouter la dérivation directionnelle et le contexte HKDF v4 lié au compte et à la cérémonie ; tests CI run 44193976083 réussis. La validation des certificats et la revue indépendante restent séparées.
- [ ] Définir l'amorçage sécurisé de la première identité racine et finaliser l'intégration des certificats d'appareil complets.
- [x] Ajouter le prototype de certificat secondaire signé par une clé racine ECDSA P-256 préalablement approuvée, avec compte et appareil attendus obligatoires à la vérification, et tests adversariaux dédiés ; validation CI en attente sur le commit courant.
- [ ] Finaliser et tester le transcript canonique et la comparaison indépendante à six mots sur PWA, Android et iOS.
- [ ] Démontrer les garanties de stockage et de révocation des clés sur les appareils cibles.
- [ ] Prouver séparément la destruction irréversible des clés GPS à J+30, y compris contre toute restauration.

- [x] Vérifier la CI incluant les tests de certificats racine et de sessions par appareil : run 44195249590, succès complet.
- [ ] Intégrer obligatoirement la vérification du certificat et de son statut de révocation avant toute dérivation de clé ou autorisation d'échange.
- [x] Durcir le contrat métier pur : seule l'identité d'appareil racine peut être l'acteur d'une approbation secondaire ; tests de refus ajoutés. Le contrôleur serveur doit encore charger le root actif depuis D1.
- [x] Spécifier le contrat de session par appareil et la règle d'invalidation par auth_version dans docs/PROTOCOLE_MULTI_APPAREILS.md.
- [x] Documenter les garanties et limites de D1 batch, les contrôles d'autorisation conditionnels, les risques de concurrence et les tests d'intégration requis dans docs/CONTRAT_SECURITE_D1.md. Aucune migration ni API D1 n'a été créée.
- [ ] Implémenter et tester la transaction D1 de révocation et les contrôles d'accès conditionnels sur chaque lecture/écriture sensible.


## Protection des trajets — travail du 18 novembre 2026

- [x] Ajouter un contrat TypeScript pur distinguant `arrival_check`, `accompaniment` et `full_protection`.
- [x] Exiger un délai de grâce explicite au niveau du trajet, sans inventer de valeur par défaut.
- [x] Modéliser la confirmation tardive et l'état « arrivée non confirmée » sans déclenchement automatique d'un SOS.
- [x] Réserver la clôture du trajet à son auteur dans le contrat métier pur.
- [x] Ajouter 15 tests dédiés et les intégrer à la CI.
- [x] Documenter les limites du prototype et les contrats D1 futurs.
- [x] Vérifier la CI du contrat de trajets et des tests renforcés : run 44262515022, commit 2c9db536 ; typecheck, 15 tests de trajets, tests existants, build et audit bloquant des dépendances de production réussis.
- [ ] Valider les délais de grâce, les rappels à l'auteur et aux contacts, la pause/reprise, la fraîcheur des positions et le comportement hors ligne.
- [ ] Spécifier le traitement atomique des confirmations concurrentes avec le planificateur d'échéance.
- [ ] Ne pas créer de migration D1 ni d'API de trajet avant validation des règles produit et de la matrice de conservation.


## Conformité des données — Niger

- [x] Consulter le texte de base de la loi n° 2022-59 et les informations officielles HAPDP sur les modifications 2023/2024.
- [x] Rédiger une pré-analyse des formalités, numéros de téléphone, données de santé, localisation, transferts internationaux, conservation, droits et sous-traitants dans `docs/CONFORMITE_DONNEES_NIGER.md`.
- [ ] Obtenir la version consolidée annoncée par l'ancienne HAPDP et la confronter aux textes postérieurs à juin 2026 ; cette consolidation antérieure à juin ne suffit pas à elle seule.
- [ ] Obtenir et examiner le texte officiel intégral de l'ordonnance n° 2026-30 du 8 juin 2026 ; identifier exactement les dispositions de la loi 2022-59 abrogées ou modifiées.
- [ ] Obtenir le décret officiel de suppression de la HAPDP et les textes organisant le transfert de ses missions ; identifier les services opérationnels compétents au Ministère de la Justice et au Ministère de l'Intérieur.
- [ ] Faire confirmer par les services ministériels désormais compétents les formalités applicables aux numéros de téléphone, urgences médicales, localisation, transferts transfrontaliers et notifications de violations.
- [ ] Cartographier les fournisseurs, pays, régions, sous-traitants et flux de données avant toute activation.
- [ ] Déterminer les obligations de désignation du correspondant à la protection des données pour la personne morale porteuse de SAC.
- [ ] Faire valider la matrice finale de conservation hors GPS par un conseil juridique nigérien et par le service public actuellement compétent, après vérification des textes 2026.


## Suppression de compte et révocation d'un contact — 18 novembre 2026

- [x] Ajouter le contrat TypeScript pur de suppression en deux phases : demande, annulation avant finalisation, finalisation logique seulement sans alerte ni trajet actif.
- [x] Préserver la capacité de clôturer les activités existantes pendant la suppression en attente, tout en bloquant les nouvelles activités.
- [x] Ajouter 12 tests dédiés au cycle de compte et les intégrer à la CI.
- [x] Documenter les limites : aucun effacement physique/anonymisation, aucun délai de grâce, aucune clôture automatique et aucune durée hors GPS inventés.
- [x] Décrire les contrats D1 futurs de suppression et de révocation pendant une alerte active.
- [ ] Valider les droits exacts du contact révoqué pendant l'alerte : détail, accusé de réception, volontariat et retrait.
- [ ] Définir le scénario d'une alerte active dont l'auteur ne revient jamais pour la clôturer.
- [ ] Faire vérifier la finalisation de suppression par tests D1 concurrents avant toute activation.
- [ ] Définir la matrice finale d'effacement/anonymisation et les durées de conservation hors GPS avec validation juridique Niger.
- [x] Vérifier la CI du contrat de compte : run 44262859615, commit d39a1f75 ; typecheck, 12 tests de compte, tests existants, build et audits réussis.


## Arbitrages de sécurité et audit des dépendances — 18 novembre 2026

- [x] Examiner les journaux de l'audit npm : les 11 occurrences élevées du run 44262859615 proviennent de la même vulnérabilité transitive picomatch GHSA-fc5q-39xc-vjpf ; audit production = 0 vulnérabilité.
- [x] Vérifier que l'avis ne présente pas encore de version corrigée confirmée dans les sources consultées ; ne pas lancer `npm audit fix --force`.
- [x] Documenter le risque de chaîne de build et l'absence de `package-lock.json` dans `docs/AUDIT_DEPENDANCES_ET_REPRODUCTIBILITE.md`.
- [x] Documenter les options de révocation pendant alerte et les scénarios d'alerte orpheline dans `docs/ARBITRAGES_CONTACT_REVOQUE_ET_ALERTE_ORPHELINE.md`.
- [ ] Valider l'accès au détail de l'alerte active après révocation : dossier minimal ou rappels opaques uniquement.
- [ ] Valider les droits d'accusé de réception, volontariat et transfert de responsabilité après révocation.
- [ ] Arbitrer le comportement des rappels si l'auteur ne revient jamais ; aucune suspension automatique ni clôture par contact n'est autorisée sans décision.
- [ ] Définir une durée maximale explicite du partage de position indépendante de la clôture de l'alerte.
- [ ] Générer et vérifier un `package-lock.json` dans un environnement Node/npm contrôlé, puis remplacer `npm install` par `npm ci`.
- [ ] Revoir l'avis picomatch à chaque évolution amont et auditer les éventuels motifs glob contrôlables par utilisateur.
- [ ] Ne pas créer d'API de révocation, d'effacement final ou de rappel durable avant validation des décisions produit et des tests D1 concurrents.


## Préparation du schéma — droits destinataires et alerte orpheline

- [x] Ajouter au schéma conceptuel la séparation entre instantané de destinataire, rappels initiaux, accès au détail, partage de position et droits de réponse.
- [x] Ajouter au schéma l'état logique terminal `deleted` et les exigences de finalisation atomique.
- [x] Compléter la revue critique avec le cas d'une alerte orpheline et l'expiration du partage GPS indépendante de la clôture.
- [ ] Valider les valeurs d'accès par destinataire après révocation avant de figer les tables et contraintes.
- [ ] Valider la règle de secours si l'auteur ne revient jamais ; aucune clôture automatique ou par contact avant arbitrage.
- [ ] Réaliser une revue finale croisée de la proposition de schéma et des contrats D1 après ces décisions.


## Matrice de traçabilité du schéma D1

- [x] Inventorier les 21 tables conceptuelles de la proposition et relier chacune à ses invariants, contraintes, tests D1 et points de conservation.
- [x] Identifier les objets manquants ou conditionnels : permissions par destinataire, idempotence persistante, suppression, partage GPS hors D1, politique d'alerte orpheline.
- [x] Définir les critères d'acceptation avant première migration.
- [ ] Traiter les décisions produit ouvertes avant de figer les contraintes de droits.
- [ ] Compléter les durées de conservation hors GPS après revue juridique consolidée.
- [ ] Faire une revue croisée de la matrice avec les contrats d'opérations atomiques.
- [ ] Garder la décision « non prêt pour migration » tant que tous les critères de passage ne sont pas satisfaits.


## Traçabilité des tests déjà présents vs preuves D1 futures

- [x] Cartographier les suites TypeScript/cryptographiques déjà présentes et leurs limites dans `docs/MATRICE_TRACABILITE_SCHEMA_D1.md`.
- [x] Éviter de présenter les tests unitaires purs comme des preuves d'intégrité D1 ou de concurrence SQL.
- [ ] Créer les tests d'intégration D1 seulement après arbitrages produit et validation du schéma.
- [ ] Exécuter les tests D1 localement puis sur Preview isolé, avec vérification des identifiants de base.


## Alignement de l'architecture GPS — 18 novembre 2026

- [x] Auditer la cohérence entre l'étude KMS, le contrat D1, les machines à états et la matrice de schéma.
- [x] Corriger `docs/SECURITE_GPS_DESTRUCTION_CRYPTO.md` : la conservation GPS serveur par KMS est désormais explicitement historique et hors cible.
- [x] Mettre en tête la direction retenue : relais chiffré éphémère sans persistance GPS serveur ; archive locale chiffrée sur le téléphone de l'auteur pendant 30 jours.
- [x] Retirer comme point à rediscuter la portée des copies reçues par les contacts ; le périmètre de la garantie est celui des données sous contrôle de SAC.
- [ ] Tester l'archive locale sur Android/iOS, les sauvegardes/restaurations, la réinstallation, la perte de téléphone et les appareils sans matériel sécurisé compatible.
- [ ] Démontrer le refus d'accès dès la première reprise après J+30 et caractériser séparément la limite de suppression physique lorsque le téléphone reste éteint.
- [ ] Prouver qu'aucun payload GPS n'est écrit dans D1, R2, KV, Durable Objects, files, logs, traces, analytics, crash reports ou sauvegardes.
- [ ] Tester le relais éphémère en direct, réseau faible et destinataires hors ligne ; distinguer alerte transmise et position effectivement disponible.

## Mise à jour juridique institutionnelle — 18 novembre 2026

- [x] Vérifier auprès de l'Agence Nigérienne de Presse que la HAPDP a été supprimée le 8 juin 2026 et que ses missions sont transférées au Ministère de la Justice et au Ministère de l'Intérieur.
- [x] Créer `docs/MISE_A_JOUR_JURIDIQUE_NIGER_NOV_2026.md` avec les constats, sources, limites et questions à résoudre.
- [x] Ajouter un avertissement en tête de `docs/CONFORMITE_DONNEES_NIGER.md` pour empêcher l'utilisation des anciennes formalités HAPDP comme procédure actuelle confirmée.
- [ ] Obtenir le texte officiel de l'ordonnance n° 2026-30 du 8 juin 2026 et vérifier les dispositions de la loi 2022-59 qu'elle abroge.
- [ ] Obtenir les textes officiels de suppression/transfert des missions et identifier les services ministériels qui reçoivent effectivement les demandes.
- [ ] Revalider les formalités, les délais de notification d'incident, les transferts internationaux et les droits des personnes sur la base des textes postérieurs à juin 2026.
- [ ] Ne pas considérer la pré-analyse HAPDP antérieure comme une validation juridique actuelle.


## Vérification juridique approfondie — 18 novembre 2026

- [x] Confirmer que la loi 2023-31 a modifié les articles 6, 7, 14, 23, 24 et 111 de la loi 2022-59.
- [x] Préciser dans `docs/MISE_A_JOUR_JURIDIQUE_NIGER_NOV_2026.md` ce qui est confirmé et ce qui demeure inconnu.
- [x] Consigner que l'ordonnance 2026-30 est citée comme modifiant/abrogeant certaines dispositions, sans prétendre connaître les articles exacts.
- [ ] Obtenir l'édition authentique du Journal officiel contenant l'ordonnance 2026-30 et vérifier ses articles.
- [ ] Confirmer le numéro exact du décret du 8 juin 2026 sur le Journal officiel ; les copies secondaires présentent une incohérence de transcription (310/340), même si plusieurs sources citent 2026-310/PRN/PM.
- [ ] Identifier les services réellement opérationnels dans les ministères de la Justice et de l'Intérieur, et leur répartition des compétences.

## Faisabilité de la destruction GPS J+30 — 18 novembre 2026

- [x] Créer `docs/PLAN_VALIDATION_DESTRUCTION_GPS_J30.md` avec 18 scénarios de test, critères GO/NO-GO et preuves attendues.
- [x] Documenter la limite Android : les restrictions temporelles du Keystore sont généralement logiciellement appliquées faute d'horloge indépendante du matériel sécurisé.
- [x] Distinguer la non-migration iOS `ThisDeviceOnly` de la destruction automatique à date fixe.
- [x] Corriger `docs/SECURITE_GPS_DESTRUCTION_CRYPTO.md` : l'archive locale n'est plus considérée comme architecture approuvée avant preuve de l'expiration même téléphone éteint.
- [ ] Prototyper le stockage local natif uniquement après définition d'un mécanisme d'expiration qui résiste à l'arrêt, au retour d'horloge et à la restauration.
- [ ] Étudier un modèle de clé à deux parts avec destruction externe non restaurable, sans transmettre ni stocker les coordonnées GPS sur le service externe.
- [ ] Ne pas activer de stockage historique GPS, de migration, de ressource cloud ni de flux GPS réel tant que le GO n'est pas démontré.


## Comparaison KMS complémentaire — 18 novembre 2026

- [x] Examiner la documentation officielle Google Cloud KMS sur la période de restauration avant destruction, la désactivation immédiate pendant l'état planifié et la purge de la matière de clé des infrastructures/sauvegardes.
- [x] Examiner la documentation officielle AWS KMS sur la période obligatoire de 7 à 30 jours, l'annulation possible pendant l'attente, la suppression finale et les exceptions CloudHSM/External Key Store.
- [x] Consigner la comparaison et les limites dans `docs/RECHERCHE_COMPLEMENTAIRE_GPS_J30_ET_TEXTES_NIGER.md`.
- [x] Écarter Cloudflare KV comme mécanisme de destruction cryptographique : expiration logique, cohérence éventuelle et chiffrement au repos géré par Cloudflare ne prouvent pas la destruction de toutes les copies de clé.
- [ ] Rechercher un mécanisme permettant de prouver la destruction irréversible de toutes les copies à l'échéance, sans fenêtre de restauration administrative et sans cache de clé locale.
- [ ] Faire auditer contractuellement et techniquement toute solution KMS candidate avant de l'utiliser ; aucune ressource ou compte externe ne doit être créé sans autorisation explicite.
- [ ] Ne pas présenter la lecture hors ligne de l'historique GPS et la destruction stricte J+30 comme simultanément garanties tant que la clé complète peut être copiée ou restaurée.


## Compléments de recherche — 18 novembre 2026

- [x] Nuancer l'analyse Android : certains matériels peuvent appliquer des autorisations temporelles en hardware ; vérifier l'attestation `hardwareEnforced`. La précision StrongBox documentée (±10 %) ne permet toujours pas de garantir J+30 exact.
- [x] Examiner AWS External Key Store / HYOK : la révocation de la clé externe peut rendre le ciphertext irrécupérable, mais les data keys déjà en cache peuvent continuer à fonctionner ; XKS ne fournit pas à lui seul une destruction automatique à J+30.
- [x] Examiner Fortanix DSM : l'expiration/désactivation laisse possible le déchiffrement ; la destruction est distincte et la Key Undo Policy introduit une période réversible. Sauvegardes et réplication à analyser.
- [x] Examiner Azure Managed HSM : soft-delete récupérable 7 à 90 jours, incompatible avec l'accès jusqu'à J+30 puis l'irréversibilité immédiate.
- [x] Étendre la recherche juridique aux domaines gouvernementaux nigériens ; le Journal officiel est identifié par le ministère de la Justice comme référence officielle, mais l'ordonnance n° 2026-30 n'a pas été authentifiée.
- [ ] Obtenir le numéro spécial du Journal officiel du 8 juin 2026 contenant l'ordonnance n° 2026-30 et le décret de suppression, puis faire analyser les articles par un juriste nigérien.
- [ ] Pour chaque gestionnaire externe candidat, obtenir les garanties écrites sur l'effacement des réplicas, sauvegardes, archives, exports, clés de récupération et clés de données en cache.
- [ ] Tester une destruction de clé avec tentative de restauration de toutes les sauvegardes, réplicas et exports disponibles ; conserver les preuves et journaux d'audit.
- [ ] Évaluer le coût, la latence, la disponibilité et la localisation juridique d'un service HSM externe avant toute décision d'architecture.


## Recherche HSM/KMS — Thales, Oracle OCI et HashiCorp — 18 novembre 2026

- [x] Examiner la documentation Thales CipherTrust Manager sur sauvegardes, restauration, planification des sauvegardes et clé Root of Trust HSM.
- [x] Examiner Oracle OCI Vault : suppression planifiée de 7 à 30 jours et possibilité d'annulation avant l'échéance.
- [x] Examiner HashiCorp Vault Transit : trim irréversible de versions, sauvegarde exportable et API de restauration.
- [x] Consigner les limites et décisions dans `docs/RECHERCHE_COMPLEMENTAIRE_GPS_J30_ET_TEXTES_NIGER.md`.
- [ ] Pour Thales ou tout HSM dédié, obtenir par écrit le comportement exact des sauvegardes, réplicas, nœuds, clés de restauration et procédures de reprise après destruction d'une clé individuelle.
- [ ] Pour tout service candidat, démontrer qu'aucun administrateur ne peut annuler, restaurer, réimporter ou récupérer la clé après l'instant J+30.
- [ ] Ne pas lancer de prototype d'archive GPS historique avant qu'une solution candidate satisfasse les tests GO/NO-GO de `docs/PLAN_VALIDATION_DESTRUCTION_GPS_J30.md`.


## Précision Thales CipherTrust — Root of Trust — 18 novembre 2026

- [x] Vérifier la documentation officielle sur la suppression d'une clé Root of Trust et l'impact sur les sauvegardes « tied-to-HSM ».
- [x] Confirmer que supprimer la dernière RoT peut rendre l'appliance et ses clés irrécupérables, sans confondre cette opération globale avec une destruction sélective de clé GPS.
- [x] Ajouter la nuance et les limites à la section 15 de `docs/RECHERCHE_COMPLEMENTAIRE_GPS_J30_ET_TEXTES_NIGER.md`.
- [ ] Demander à Thales une confirmation écrite sur l'isolation d'une clé par dossier, les partitions HSM, clusters/HA, copies RoT, sauvegardes liées au HSM, exports et procédures de reprise.
- [ ] N'envisager une démonstration qu'en environnement isolé, après autorisation explicite et protocole de test approuvé ; aucune destruction de clé réelle SAC.
- [ ] Vérifier que toute preuve de sanitisation s'aligne sur NIST SP 800-88 Rev. 2 sans présenter cette référence comme une certification automatique de l'architecture.


## Luna HSM — destruction d'objet et zeroization — 18 novembre 2026

- [x] Examiner la différence entre PKCS #11 `C_DestroyObject` (invalidation puis purge possible lors de la réallocation) et les opérations de zeroization plus larges.
- [x] Consigner les limites de restauration HSM/Backup HSM/HA/DR et les questions fabricant dans la section 16 de `docs/RECHERCHE_COMPLEMENTAIRE_GPS_J30_ET_TEXTES_NIGER.md`.
- [ ] Obtenir du fabricant, pour un modèle et firmware précis, la preuve du comportement de destruction ciblée et de l'état de la matière de clé après l'opération.
- [ ] Vérifier les copies sur HSM de sauvegarde hors ligne, partitions HA, exports, sauvegardes applicatives et procédures DR.
- [ ] Vérifier si une échéance J+30 peut être exécutée hors ligne, sans possibilité d'annulation administrative ou de réimportation.
- [ ] Séparer dans les critères de preuve : (a) impossibilité cryptographique de déchiffrer après J+30 ; (b) sanitisation physique de la mémoire, selon les capacités certifiées du module.
- [ ] Garder toutes les solutions HSM non approuvées jusqu'à démonstration et revue indépendante ; aucune clé réelle SAC ni aucun équipement ne doit être soumis à un test destructif.


## Architecture à deux composants et accès hors ligne — 18 novembre 2026

- [x] Documenter la séparation DEK/KEK et les limites des clés locales, des caches et des sauvegardes.
- [x] Documenter le compromis entre consultation hors ligne et impossibilité de restauration après J+30.
- [x] Documenter le risque D1 Time Travel : restauration d'un état antérieur et restauration annulable ; exclure GPS précis et secrets de déchiffrement de D1 et de ses exports.
- [ ] Faire arbitrer explicitement l'option produit : accès hors ligne pendant 30 jours, priorité à l'irréversibilité avec déchiffrement en ligne, ou compromis sans historique GPS hors ligne.
- [ ] Pour toute option locale, obtenir une matrice de compatibilité StrongBox/TEE par modèle, attestation hardwareEnforced, horloge, anti-rollback, état après extinction, réinitialisation, restauration et migration.
- [ ] Pour toute option externe, prouver l'absence de cache de DEK, de clés de session persistantes, de réplica restaurable et de voie d'administration permettant une récupération après J+30.
- [ ] Ajouter des essais D1 de restauration de bookmarks antérieurs pour confirmer que seules des métadonnées non sensibles réapparaissent ; ne pas créer de base ni effectuer de restauration réelle sans autorisation.
- [ ] Maintenir le statut GPS historique : NO-GO jusqu'à arbitrage, démonstration et revue indépendante.


## Position ponctuelle, flux actif et historique GPS — 18 novembre 2026

- [x] Vérifier la documentation D1 à jour : Time Travel toujours actif, bookmarks jusqu'à 30 jours Workers Paid / 7 jours Workers Free ; restauration antérieure et possibilité d'annulation.
- [x] Documenter la séparation entre position ponctuelle actuelle, flux temporaire explicitement partagé et historique GPS consultable après coup.
- [x] Recommander provisoirement de ne pas promettre la consultation hors ligne de l'historique GPS ; ne jamais afficher une position périmée comme actuelle.
- [ ] Aligner la matrice de conservation et les contrats de données sur cette distinction, sans ajouter de stockage GPS réel avant autorisation.
- [ ] Valider les règles de rétention exactes du flux actif (mémoire, stockage temporaire, notifications, files, journaux, sauvegardes) et démontrer qu'aucune coordonnée ne fuit dans les textes libres.
- [ ] Maintenir historique GPS précis : désactivé / NO-GO jusqu'à preuve de destruction J+30 et revue indépendante.


## Modèle de menace GPS J+30 — 18 novembre 2026

- [x] Ajouter les chemins de restauration à tester : sauvegardes OS, copie fichiers, rollback application, caches, presse-papiers, clés dérivées, copies DEK, HSM/KMS HA/DR, exports et comptes break-glass.
- [x] Définir la limite fondamentale : un OS entièrement compromis pendant une période d'accès autorisé peut capturer du plaintext déjà affiché ; SAC ne peut pas effacer rétroactivement cette copie exfiltrée.
- [x] Ajouter les scénarios GPS-19 à GPS-26 et renforcer le critère GO.
- [ ] Faire relire le modèle de menace par un spécialiste indépendant mobile/cryptographie et confirmer le périmètre adversaire retenu.
- [ ] Pour chaque OS supporté, établir les réglages précis de sauvegarde système, exclusions applicatives et scénarios de transfert/restauration.
- [ ] Obtenir des preuves contractuelles et techniques fournisseur couvrant toutes les copies de clés, réplicas, sauvegardes, caches, exports et procédures break-glass.
- [ ] Garder historique GPS : NO-GO tant qu'un scénario critique reste FAIL ou NON TESTABLE.

## Sauvegardes natives Android/iOS et restauration GPS — 18 novembre 2026

- [x] Vérifier la documentation Android Auto Backup : inclusion par défaut des fichiers internes, bases et préférences ; règles distinctes Android 11 et Android 12+.
- [x] Vérifier la nuance Android 12+ : allowBackup=false ne bloque pas nécessairement les transferts D2D sur certains OEM ; cloud-backup, device-transfer et cross-platform-transfer doivent être couverts.
- [x] Vérifier la nuance iOS : ThisDeviceOnly bloque la migration vers un nouvel appareil mais peut être restauré sur le même appareil ; non-synchronisable iCloud Keychain requis.
- [x] Vérifier que l'exclusion de sauvegarde iOS peut être remise à false après certaines opérations de fichiers ; la réappliquer à chaque écriture.
- [x] Ajouter les scénarios GPS-27 à GPS-36 au plan de validation.
- [ ] Définir, lors du développement natif, les règles Android manifest/XML pour toutes les versions et tous les modes de transfert.
- [ ] Définir, lors du développement natif, les exclusions iOS pour chaque fichier GPS et tester les opérations qui réinitialisent le drapeau.
- [ ] Exécuter les tests de sauvegarde/restauration sur appareils Android de plusieurs OEM et versions, et sur iPhone/iPad réels.
- [ ] Inspecter les APK/IPA produits pour vérifier les règles embarquées et tester les restaurations réelles.
- [ ] Maintenir le statut GPS historique : NO-GO tant que les scénarios de restauration ne sont pas tous validés.

## Clarification du statut de l'architecture GPS — 18 novembre 2026

- [x] Corriger l'intitulé de l'étude crypto : archive locale 30 jours = cible candidate, non approuvée ; pas une architecture retenue.
- [x] Clarifier que les exclusions Android/iOS sont des contrôles de réduction du risque et non une preuve J+30.
- [x] Journaliser les détails Android Auto Backup, transferts D2D/cross-platform, iOS ThisDeviceOnly, iCloud Keychain et exclusions de fichiers.
- [ ] Maintenir l'architecture d'historique GPS en NO-GO ; aucune promesse d'accès hors ligne ni de suppression définitive avant validation indépendante.

## Arbitrage produit sur l'historique GPS — 18 novembre 2026

- [x] Formaliser les trois orientations : priorité destruction stricte, priorité accès hors ligne (non conforme à ce stade), ou compromis sans historique après la session.
- [x] Consigner que la décision produit n'est pas validée et que l'historique GPS reste NO-GO.
- [ ] Obtenir l'arbitrage explicite du propriétaire produit avant de concevoir une fonctionnalité d'historique GPS.
- [ ] Après arbitrage, mettre à jour les machines à états, contrats de données, matrice de conservation et parcours UI sans créer de stockage réel avant validation sécurité.
