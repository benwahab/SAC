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
- [ ] Finaliser les choix OTP restants, fournisseur e-mail, push, SMS et paiement.
- [x] Valider le mode de connexion SAC : adresse e-mail + mot de passe (option A) ; OTP e-mail pour vérification initiale, opérations sensibles et réinitialisation, sans OTP systématique à chaque connexion.
- [x] Documenter les recommandations techniques comptes, OTP et sessions dans `docs/ARBITRAGES_TECHNIQUES_COMPTES_OTP_SESSIONS.md` ; les durées de session (30 jours d'inactivité / 90 jours absolus) sont désormais validées ; le fournisseur e-mail et les protocoles cryptographiques restent à valider.
- [x] Valider et documenter les cinq états du cycle de vie du compte (en attente de vérification, actif, suspendu, suppression en attente, supprimé).
- [x] Valider le principe de continuité d'une alerte SOS déjà transmise pendant une suspension : rappels maintenus vers les destinataires initiaux et capacité d'urgence strictement limitée à cette alerte, sans session générale.
- [ ] Définir les règles de clôture si le titulaire a perdu son appareil, les notifications et les garde-fous anti-abus ; aucune implémentation avant spécification et revue.
- [ ] Obtenir une revue cryptographique indépendante et clôturer les autres points bloquants avant toute migration D1 ou route d'authentification.
- [x] Documenter une proposition de politique de mot de passe et de paramètres de session PWA dans `docs/ARBITRAGES_TECHNIQUES_COMPTES_OTP_SESSIONS.md` ; seuils OTP et autres paramètres techniques encore à valider ; durées de session validées séparément.
- [x] Valider un minimum de 12 caractères pour le mot de passe (décision utilisateur du 18 novembre 2026).
- [x] Valider la déconnexion automatique après 30 jours consécutifs sans activité et la reconnexion obligatoire au plus tard après 90 jours, même en cas d'utilisation régulière (décision utilisateur du 18 novembre 2026).
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
- [x] Rédiger la proposition UX du parcours de déclenchement SOS dans `docs/PARCOURS_DECLENCHEMENT_SOS_V1.md` ; les choix du bouton principal, de la modification ponctuelle des destinataires et du cas sans contact restent à valider.
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

## Journal officiel Niger — vérification institutionnelle complémentaire — 18 novembre 2026

- [x] Vérifier sur le site du Ministère de la Justice que le Journal officiel est la référence officielle d'entrée en vigueur des textes.
- [x] Rechercher le numéro spécial du 8 juin 2026 sur les domaines institutionnels accessibles du Ministère de la Justice, du Ministère des Finances et du SGG.
- [x] Consigner que la recherche en ligne n'a pas retrouvé le numéro spécial contenant l'ordonnance 2026-30 ; ne pas en déduire qu'il n'existe pas.
- [ ] Demander au service du Journal officiel / Ministère de la Justice une copie authentifiée du numéro spécial du 8 juin 2026.
- [ ] Vérifier les articles abrogatoires et transitoires de l'ordonnance 2026-30 sur l'exemplaire authentique.
- [ ] Obtenir le décret de suppression de la HAPDP authentifié afin de résoudre la divergence OCR 2026-310 / 2026-340.

## Veille picomatch ReDoS — 18 novembre 2026

- [x] Vérifier GHSA-fc5q-39xc-vjpf / CVE-2026-112366 dans GitHub Advisory Database et NVD : picomatch jusqu'à 4.0.7 affecté, version corrigée non indiquée.
- [x] Examiner PR amont #238 : correctif candidat pour master/4.x, encore ouvert et non publié ; limite connue sur certains extglobs imbriqués.
- [x] Examiner PR amont #246 : proposition pour branche v2 uniquement, ouverte et non publiée.
- [x] Examiner PR #194 : changement de parsing distinct, explicitement non correctif de sécurité ; +(*a) reste vulnérable.
- [ ] Surveiller fusion et publication d'une version picomatch 4.x corrigée.
- [ ] Après publication, confirmer que l'avis GHSA identifie la version corrigée, vérifier l'arbre npm réel et exécuter toute la CI.
- [ ] Ne pas utiliser de commit Git non publié, patch artisanal, override non vérifié, suppression de l'audit ou rétrogradation forcée.

## Revue crypto complémentaire — 18 novembre 2026

- [x] Corriger la chronologie de la revue crypto : le contexte HKDF v4 inclut désormais compte et cérémonie ; les anciennes mentions v3 sont historiques.
- [x] Consigner la distinction entre signature auto-incluse d'un bundle et identité réellement ancrée par un canal indépendant.
- [x] Ajouter validation cryptographique/import de la clé publique ECDH incluse dans un bundle signé ; rejeter un point P-256 invalide même si les champs JWK ont le bon format.
- [x] Renforcer la validation par un accord ECDH éphémère après import, afin de couvrir les moteurs WebCrypto qui ne rejettent pas le point invalide au stade import.
- [x] Réutiliser ce contrôle dans le vérificateur des certificats secondaires et ajouter un test de certificat correctement signé contenant un point hors courbe.
- [ ] Confirmer la CI du changement ECDH renforcé (code + deux tests adversariaux) avant de considérer le contrôle automatisé validé.
- [ ] Tester les moteurs WebCrypto des navigateurs Android/iOS et Cloudflare Workers ; la CI Node ne prouve pas cette interopérabilité.
- [ ] Tester l'empreinte indépendante, la substitution de racine, le changement de clé, la récupération après perte d'appareil et l'interopérabilité Android/iOS.
- [ ] Définir le transcript canonique complet et la confirmation de clé, puis faire examiner le protocole par un spécialiste indépendant.
- [ ] Vérifier l'orchestration serveur : certificat validé avant dérivation, révocation vérifiée avant chaque partage, et protection contre les courses entre révocation et envoi.
- [ ] Ne pas brancher ces prototypes à des positions réelles avant validation indépendante et preuve J+30.

## Transcript de cérémonie multi-appareils — audit complémentaire — 18 novembre 2026

- [x] Comparer le certificat secondaire expérimental à la cérémonie documentée.
- [x] Relever que le certificat signé ne lie pas encore ceremonyId, défi serveur, nonce client, version complète du protocole et expiration.
- [x] Consigner l'interdiction d'intégrer ce certificat au futur endpoint d'approbation avant correction du transcript.
- [ ] Définir un format canonique versionné unique du transcript signé par la racine.
- [ ] Définir émission, durée de vie, consommation atomique et idempotence du défi serveur.
- [ ] Définir le traitement des pertes réseau avant/après commit sans permettre le rejeu d'un défi.
- [ ] Ajouter les tests de rejeu, expiration, altération de chaque champ, concurrence et révocation pendant approbation.
- [ ] Faire relire le transcript et le protocole par un spécialiste indépendant avant implémentation serveur.

- [x] Rédiger une proposition candidate de transcript canonique : `docs/TRANSCRIPT_CEREMONIE_MULTI_APPAREILS.md`.
- [ ] Faire arbitrer et relire indépendamment le format, les signatures doubles, les défis, la consommation atomique et l'idempotence avant toute implémentation.


## Parcours SOS — arbitrage des deux accès — 18 novembre 2026

- [x] Valider la coexistence du SOS principal guidé (choix catégorie + niveau avant envoi) et d'un accès SOS critique immédiat distinct.
- [x] Exiger une catégorie et des destinataires éligibles préconfigurés pour le raccourci critique immédiat.
- [x] Interdire une seconde confirmation générique qui ralentirait le SOS critique immédiat.
- [x] Exiger que les deux parcours affichent uniquement un résultat de transmission confirmé par le serveur.
- [ ] Arbitrer la modification ponctuelle des destinataires pour une alerte, sans changer les préférences permanentes.
- [ ] Arbitrer le comportement lorsqu'aucun contact éligible n'est configuré.
- [ ] Arbitrer le comportement du seuil SMS tant qu'aucun fournisseur opérationnel n'est sélectionné.
- [ ] Concevoir les écrans détaillés des deux parcours après clôture des points ouverts.
- [ ] Ne pas activer le SOS, créer d'API ou de migration D1, ni collecter de GPS réel dans le cadre de cette mise à jour documentaire.


## Sélection ponctuelle des destinataires SOS — décision validée — 18 novembre 2026

- [x] Autoriser, dans le parcours SOS guidé uniquement, le retrait et l'ajout explicites de contacts pour une alerte donnée.
- [x] Limiter les ajouts aux relations de confiance actives, invitations acceptées et moyens de contact vérifiés.
- [x] Autoriser cette sélection ponctuelle à déroger aux préférences habituelles de catégorie sans modifier les préférences permanentes.
- [x] Maintenir les plafonds de l'offre et interdire tout ajout automatique de destinataire.
- [x] Garder le raccourci SOS critique immédiat sur sa liste préconfigurée, sans écran de modification.
- [x] Exiger la validation serveur de chaque relation et le gel atomique de la sélection finale avec l'alerte et les tâches initiales.
- [ ] Arbitrer le comportement lorsqu'aucun contact éligible n'est configuré ou sélectionné.
- [ ] Arbitrer le comportement du seuil SMS tant qu'aucun fournisseur opérationnel n'est sélectionné.
- [ ] Concevoir les écrans détaillés des deux parcours après clôture des points ouverts.
- [ ] Ne pas activer le SOS, créer d'API ou de migration D1, ni collecter de GPS réel dans le cadre de cette mise à jour documentaire.

## Audit de l'état réel du code — 18 novembre 2026

- [x] Réaliser un audit en lecture seule du code, de la configuration PWA, de l'API D1, des contrats métier, des tests et du workflow CI ; rapport : `docs/AUDIT_ETAT_REEL_CODE_2026-11-18.md`.
- [x] Confirmer que le socle React/Vite/TypeScript, la page de présentation, la PWA minimale, la route de santé D1, les contrats métier purs et plusieurs suites de tests existent.
- [x] Confirmer que le SOS reste désactivé et que les contrats métier ne constituent pas encore des endpoints ni une persistance D1.
- [x] Identifier l'écart d'identité visuelle : le code utilise encore bleu nuit/bleu ciel/gris au lieu du vert clair effet verre dépoli validé.
- [x] Identifier l'écart langues : l'interface examinée reste en français ; anglais et arabe RTL ne sont pas encore démontrés.
- [x] Vérifier un run CI antérieur `44261699221` réussi pour typecheck, six suites de tests, build et audits ; ce run ne prouve pas l'exécution des tests trajets et suppression de compte ajoutés au workflow actuel.
- [ ] Versionner `package-lock.json` après installation contrôlée et rendre l'installation CI reproductible.
- [ ] Appliquer l'identité visuelle vert clair Glassmorphism dans l'application et ses métadonnées PWA.
- [ ] Mettre en place français/anglais/arabe RTL.
- [ ] Finaliser le schéma et les migrations D1 métier après validation des permissions et contrats.
- [ ] Implémenter et tester les endpoints métier côté serveur avant toute activation du SOS.
- [ ] Obtenir la preuve irréversible GPS J+30 avant toute collecte GPS précise.
- [ ] Refaire une vérification CI complète sur le code récent, y compris Protection des trajets et suppression de compte.


## Mise à jour interface citoyenne — 18 novembre 2026

- [x] Appliquer la première déclinaison vert clair Glassmorphism à la page d'accueil.
- [x] Réserver le rouge à l'état d'alerte et employer un vert distinct pour les confirmations.
- [x] Harmoniser la couleur de thème, le fond et les métadonnées PWA.
- [x] Centraliser les textes de la page dans `src/i18n/translations.ts`.
- [x] Ajouter le sélecteur français / anglais / arabe et conserver la préférence localement.
- [x] Activer `lang` et `dir` sur le document ; ajouter les adaptations RTL de la page d'accueil.
- [ ] Faire relire les traductions, particulièrement les formulations d'urgence en arabe et en anglais.
- [ ] Appliquer le système i18n et RTL à chaque nouvel écran avant son ouverture aux utilisateurs.
- [ ] Valider les contrastes, le rendu mobile et les langues sur appareils Android réels.
- [ ] Confirmer ultérieurement les valeurs hexadécimales définitives de la charte visuelle.


## Cycle de vie du compte — continuité SOS validée, détails ouverts

- [x] Valider le principe : une suspension ne clôture ni n'interrompt une alerte SOS déjà transmise ; les rappels restent adressés toutes les 5 minutes aux seuls contacts initiaux, sans ajout automatique.
- [x] Valider le principe d'une capacité d'urgence cryptographique limitée à l'alerte existante et à l'appareil d'origine : état minimal, mise à jour de sécurité et demande/confirmation de clôture ; aucun accès général au compte ni aux autres alertes.
- [x] Valider la distinction anti-abus : le titulaire suspendu peut signaler qu'il est en sécurité, mais cette mise à jour ne clôture pas l'alerte ; si la suspension est liée à un abus potentiel sur cette alerte, sa demande de clôture ne suffit pas à elle seule et des contrôles serveur supplémentaires sont requis ; aucune preuve ni trace ne peut être effacée.
- [x] Valider que seule l'administration SAC peut clôturer une alerte dans ce contexte ; ni le titulaire suspendu ni les proches, même le responsable principal, ne peuvent la clôturer.
- [x] Trancher le nombre de validations : un seul administrateur SAC habilité suffit pour décider et clôturer ; aucune double validation n'est exigée.
- [x] Définir la procédure de vérification de clôture administrative, le profil habilité, les critères de contrôle renforcé et les notifications aux contacts.
- [x] Valider que le silence ou l'absence de réponse d'un proche ne prouve jamais que la personne est en sécurité ; si la fin du danger n'est pas vérifiable, l'alerte reste active et les rappels continuent vers les seuls destinataires initiaux.
- [x] Valider les vérifications préalables : statut et référence de l'alerte, signalement du responsable principal, accusés de réception, prises en charge, dernières informations et absence d'indice récent de danger persistant ; informations contradictoires ou insuffisantes = pas de clôture.
- [x] Définir la procédure détaillée de vérification de clôture administrative, le profil habilité, les critères de contrôle renforcé et les notifications aux contacts.
- [ ] Spécifier et faire examiner indépendamment le protocole cryptographique et les contrôles serveur avant toute implémentation.
- [ ] Ne créer aucune route API, permission opérationnelle, session spéciale ou migration D1 sans autorisation distincte.


## Procédure de clôture administrative d'une alerte pendant suspension — 18 novembre 2026

- [x] Valider une vérification administrative avant clôture : identifier l'alerte et l'appareil d'origine ; examiner les accusés de réception, prises en charge, signalements et dernières mises à jour ; tenter si possible de joindre directement le titulaire ; rechercher les contradictions et indices récents de danger.
- [x] Valider que la déclaration du titulaire disant être en sécurité est un élément à examiner, jamais une clôture automatique.
- [x] Valider que l'absence de réponse du titulaire ou d'un proche ne prouve jamais la sécurité ; si la fin du danger ne peut être vérifiée, l'alerte reste active et les rappels continuent vers les seuls destinataires initiaux.
- [x] Confirmer que les informations contradictoires ou insuffisantes, ou tout indice récent de danger persistant, interdisent la clôture à ce stade.
- [x] Confirmer qu'un proche peut signaler une fin supposée et demander une clôture, mais que seul un administrateur SAC habilité l'exécute ; un seul administrateur suffit, sans double validation.
- [x] Définir le canal de contact direct du titulaire, les délais et les tentatives, sans transformer l'absence de réponse en preuve.
- [x] Définir le profil administratif habilité, les contrôles renforcés déclenchés par suspicion d'abus et les notifications de clôture aux contacts.
- [ ] Spécifier et faire examiner indépendamment les contrôles serveur et la traçabilité avant toute implémentation.
- [ ] Ne créer aucune route API, permission opérationnelle, session spéciale ou migration D1 sans autorisation distincte.


## Habilitation à la clôture administrative — 18 novembre 2026

- [x] Valider que le Super Admin peut clôturer une alerte concernée après les vérifications prévues.
- [x] Valider qu'un administrateur sécurité ne peut clôturer que si le Super Admin lui attribue explicitement la permission dédiée ; aucun droit par défaut.
- [x] Exclure le support, l'auditeur, les proches et le titulaire suspendu de l'autorité de clôture dans ce scénario.
- [x] Séparer la permission de clôture des autres permissions ; seul le Super Admin peut l'attribuer, la modifier, la suspendre ou la retirer.
- [x] Interdire au délégataire de transmettre ou déléguer cette permission ; une seule personne habilitée suffit, sans double validation.
- [x] Exiger une trace d'audit minimale : identité de l'administrateur, référence de l'alerte, date/heure, motif et éléments vérifiés.
- [x] Réserver l'espace d'administration à l'ordinateur et à la tablette ; pas d'accès administratif prévu sur téléphone.
- [ ] Définir les contrôles techniques empêchant toute élévation ou délégation par un administrateur délégué.
- [ ] Définir le parcours d'attribution et de retrait de la permission dédiée par le Super Admin.
- [ ] Spécifier les événements d'audit, leur intégrité, leur conservation et leur consultation.
- [ ] Ne créer aucun rôle, endpoint, permission opérationnelle ou migration D1 sans autorisation distincte.


## Contact direct du titulaire avant clôture — 18 novembre 2026

- [x] Définir une notification privée initiale via SAC, sans divulguer les détails sensibles à un tiers.
- [x] Définir jusqu'à trois appels si le numéro déclaré est disponible : immédiatement, environ +5 min, puis +5 min supplémentaires.
- [x] Prévoir un message écrit privé complémentaire par un canal de contact disponible.
- [x] Journaliser chaque tentative : date/heure, canal, résultat objectif et identité de l'administrateur ; distinguer envoi, lecture et réponse.
- [x] Préciser qu'un appel sans réponse, un message vocal ou un accusé technique ne constitue pas une réponse du titulaire.
- [x] Préciser que l'absence de canal ou de réponse est consignée, mais ne prouve jamais la sécurité et ne déclenche aucune clôture automatique.
- [x] Fixer la séquence d'appels à environ dix minutes entre la première et la troisième tentative, sans en faire un délai maximal de danger ou une échéance de clôture.
- [x] Maintenir l'alerte et les rappels aux seuls destinataires initiaux tant que la fin du danger n'est pas suffisamment vérifiée.
- [x] Confirmer que chaque utilisateur doit fournir un numéro à la création du compte ; préciser que collecte ne vaut pas vérification.
- [ ] Définir les modèles de messages privés et leur minimisation des données.
- [ ] Spécifier l'intégrité, la conservation et l'accès aux journaux de tentatives avant toute implémentation.
- [ ] Ne créer aucun canal, endpoint, envoi automatique ou migration D1 sans autorisation distincte.


## Numéro obligatoire à la création du compte — 18 novembre 2026

- [x] Décider que chaque utilisateur doit obligatoirement renseigner un numéro de téléphone à la création du compte ; création impossible si le champ est absent.
- [x] Prévoir l'enregistrement du numéro avec son indicatif international.
- [x] Distinguer collecte obligatoire et vérification effective du numéro.
- [x] Maintenir la décision antérieure : pas de SMS OTP pour l'authentification des comptes ; aucune vérification SMS n'est autorisée implicitement.
- [x] Aucune vérification indépendante du numéro n'est prévue ; l'OTP e-mail suffit pour la vérification initiale du compte.
- [ ] Définir les règles de changement, de mise à jour et de nouvelle vérification du numéro.
- [ ] Spécifier les protections d'accès et la conservation du numéro.
- [ ] Ne créer aucun champ, validation opérationnelle, envoi SMS, service externe, endpoint ou migration D1 sans autorisation distincte.


## Vérification du compte : OTP e-mail uniquement — 18 novembre 2026

- [x] Confirmer que l'OTP envoyé à l'adresse e-mail est la seule vérification initiale requise pour le compte.
- [x] Confirmer que la saisie correcte de l'OTP valide l'adresse e-mail et suffit à la vérification initiale du compte.
- [x] Maintenir le numéro de téléphone obligatoire à la création du compte, sans vérification indépendante.
- [x] Exclure SMS OTP, appel automatisé de validation et toute procédure supplémentaire de preuve de propriété du numéro.
- [x] Autoriser l'utilisation du numéro déclaré comme coordonnée de contact ; une réponse depuis ce numéro ne prouve pas seule l'identité de l'interlocuteur.
- [x] Remplacer les anciennes tâches prévoyant une vérification du numéro par la présente décision.
- [ ] Définir les règles de changement et de mise à jour du numéro déclaré.
- [ ] Spécifier les protections d'accès et la conservation du numéro.
- [ ] Ne créer aucun champ, validation opérationnelle, SMS, service externe, endpoint ou migration D1 sans autorisation distincte.


## Notification après clôture administrative — spécification

- [x] Décider que chaque destinataire initial est informé individuellement après clôture administrative, via les canaux SAC disponibles et activés.
- [x] Limiter le message à la confirmation de clôture administrative et à sa date/heure ; ne pas exposer les notes internes, éléments d'enquête, échanges privés ou coordonnées tierces.
- [x] Arrêter les rappels de cette alerte pour tous les destinataires initiaux à la clôture.
- [x] Conserver intégralement les accusés de réception, interventions, mises à jour et événements antérieurs.
- [x] Journaliser les notifications envoyées et les échecs ; un échec n'entraîne pas de réouverture automatique.
- [x] Préciser que la notification ne donne aucun droit de clôture aux proches.
- [ ] Définir les événements et statuts techniques de livraison des notifications avant implémentation.
- [ ] Ne créer aucun service push, e-mail, SMS, endpoint ou migration D1 sans autorisation distincte.

## Sécurité de l'administration et traçabilité — cadre documentaire — 18 novembre 2026

- [x] Formaliser le principe d'autorité : seul le Super Admin crée, attribue, modifie, suspend et retire les délégations et missions.
- [x] Confirmer qu'un délégataire ne peut ni déléguer, ni attribuer des tâches, ni modifier ses propres droits, ni étendre son périmètre.
- [x] Formaliser le refus par défaut et la séparation des permissions : lecture, modification, suspension, délégation, export et clôture.
- [x] Exiger une autorisation côté serveur à chaque action, indépendante de l'affichage de l'interface, avec identité, rôle, permission et périmètre issus des données serveur.
- [x] Exiger que les accès refusés, tentatives d'élévation, changements de délégation, opérations sensibles et décisions soient auditables.
- [x] Définir le journal append-only : aucune modification/suppression d'un événement ; toute correction devient un nouvel événement lié.
- [x] Définir les champs minimaux d'audit et interdire l'enregistrement de mots de passe, OTP, jetons bruts, clés privées, secrets de récupération, messages privés complets et GPS précis.
- [x] Prévoir un accès au journal en lecture seule, limité aux personnes autorisées ; consultation et export également audités.
- [x] Réserver l'espace d'administration à l'ordinateur et à la tablette, pas au téléphone.
- [ ] Arbitrer le mécanisme concret de preuve d'intégrité et de détection d'altération, après étude des capacités D1 et stockage.
- [ ] Définir la durée de conservation, la base légale, la purge et les règles de conservation des traces après suppression d'un compte.
- [ ] Arbitrer la réauthentification/OTP récent pour les opérations critiques ; recommandation non approuvée à ce stade.
- [ ] Définir une politique spécifique de sessions administratives, plus stricte si nécessaire que la règle générale 30 jours d'inactivité / 90 jours maximum.
- [ ] Faire relire le modèle de permissions, le journal, l'intégrité et la conservation par une revue de sécurité indépendante avant tout code.
- [ ] Ne créer aucun rôle opérationnel, endpoint, middleware, table, migration D1, journal actif, ressource Cloudflare ou écran administratif sans autorisation distincte.

**Correction de cohérence :** le numéro de téléphone est obligatoire mais déclaré, non vérifié. La procédure administrative peut utiliser ce numéro comme coordonnée ; une réponse ne prouve pas à elle seule l'identité. L'OTP e-mail reste l'unique vérification initiale du compte.


## Modèle des rôles, permissions et missions — 18 novembre 2026

- [x] Séparer les notions de rôle fonctionnel, permission précise et mission déléguée.
- [x] Formaliser les rôles de référence : Super Admin, administrateur sécurité, support et auditeur.
- [x] Confirmer que seul le Super Admin crée, attribue, modifie, suspend, reprend, révoque et termine les missions/délégations.
- [x] Confirmer qu'un délégataire ne peut jamais déléguer, inviter un autre administrateur, attribuer des droits ou modifier son propre périmètre.
- [x] Définir une mission personnelle, non transférable, avec objectif, permissions, périmètre, limites, dates et motif.
- [x] Formaliser le refus par défaut, l'absence d'héritage automatique et la séparation des droits consulter/créer/modifier/suspendre/révoquer/clôturer/exporter.
- [x] Confirmer que chaque action est vérifiée côté serveur à partir de la mission active et du périmètre réel de la ressource.
- [x] Maintenir la permission de clôture d'alerte distincte, nominative et attribuée explicitement par le Super Admin à un administrateur sécurité ; aucun droit automatique pour Support ou Auditeur.
- [ ] Établir le catalogue exhaustif des ressources et actions SAC.
- [ ] Arbitrer les périmètres disponibles (global, service, région, dossier, alerte) et leurs combinaisons.
- [ ] Définir précisément les données et opérations accessibles au Support.
- [ ] Définir les vues et exports accessibles à l'Auditeur.
- [ ] Définir les durées par défaut des missions, alertes d'expiration et règles de renouvellement.
- [ ] Définir la suspension d'urgence d'une mission et ses effets sur les sessions ouvertes.
- [ ] Définir les règles de conflit entre missions et le circuit de demande d'extension au Super Admin.
- [ ] Transformer le modèle en matrice de permissions exhaustive et en tests positifs/négatifs avant toute implémentation.
- [ ] Ne créer aucun rôle actif, compte administratif, permission, mission, écran, endpoint, middleware ou migration D1 sans autorisation distincte.


- [x] Établir un catalogue de référence des ressources SAC et une matrice de permissions par rôle.
- [x] Définir les restrictions transversales et les tests d'autorisation négatifs obligatoires.
- [ ] Arbitrer les périmètres, données Support, vues/exports Auditeur, révocation des appareils/sessions, durée des missions et authentification renforcée.
- [ ] Faire relire la matrice par une revue de sécurité avant toute implémentation.
- [ ] Ne créer aucun rôle actif, permission, mission, endpoint ou migration D1 sans autorisation explicite.

## Classification des données et limites d'accès administratif — 18 novembre 2026

- [x] Proposer une classification de sensibilité C0 à C4 pour les ressources SAC.
- [x] Définir les limites minimales recommandées pour Support et Auditeur.
- [x] Poser les règles de minimisation, masquage, accès exceptionnel et traçabilité.
- [ ] Valider les classes et les champs exacts par ressource.
- [ ] Confirmer les vues minimales Support/Auditeur et le processus d'accès exceptionnel.
- [ ] Définir pseudonymisation, masquage et contrôles d'export.
- [ ] Faire vérifier la classification et les obligations légales avant implémentation.
- [ ] Ne créer aucun accès opérationnel ou migration D1 sans autorisation distincte.


## Gouvernance et cycle de vie des missions administratives — 18 novembre 2026

- [x] Décrire les états et transitions d'une mission, de la préparation à la terminaison.
- [x] Définir les champs obligatoires d'une mission et l'absence de droits actifs avant activation.
- [x] Définir suspension d'urgence, révocation immédiate côté serveur et invalidation des autorisations différées/en cache.
- [x] Définir les règles de non-cumul permissif, de conflits et de demande d'extension au Super Admin.
- [x] Définir les contrôles spécifiques des exports, accès exceptionnels et sessions administratives.
- [x] Établir les critères et tests de sécurité avant implémentation.
- [ ] Valider les durées proposées des missions standard/sensibles et les alertes d'échéance.
- [ ] Valider la politique de sessions administratives et les opérations exigeant un OTP e-mail récent.
- [ ] Définir les protections techniques et la durée de vie des exports.
- [ ] Définir la conservation, la purge et la preuve d'intégrité du journal d'audit.
- [ ] Faire réaliser une revue indépendante de sécurité et conformité.
- [ ] Ne créer aucun rôle, permission, mission active, endpoint, session administrative ou migration D1 sans autorisation distincte.


## Modèle de menaces et plan de sécurité administratif — 18 novembre 2026

- [x] Cartographier les actifs critiques et frontières de confiance.
- [x] Décrire les adversaires, erreurs et scénarios de menace prioritaires.
- [x] Définir les contrôles cibles pour autorisation, sessions, journaux, données et exports.
- [x] Définir un flux de gestion des incidents administratifs.
- [x] Définir les tests de sécurité et les conditions de passage en production.
- [ ] Faire examiner le modèle par une personne indépendante en sécurité applicative.
- [ ] Transformer les exigences validées en conception technique détaillée avant toute implémentation.
- [ ] Vérifier la conformité juridique, la conservation, la purge et les obligations de notification.
- [ ] Ne pas déclarer les contrôles opérationnels avant preuve dans le code, tests et CI.


## Contrats atomiques des opérations administratives — 18 novembre 2026

- [x] Formaliser les contrats de création et transitions des missions.
- [x] Formaliser suspension de compte et continuité des alertes déjà transmises.
- [x] Formaliser la clôture administrative dans le scénario spécifique du titulaire suspendu.
- [x] Définir les contrôles de consultation sensible et d'export.
- [x] Définir les invariants d'audit, d'idempotence et de concurrence.
- [x] Établir les tests d'intégration et de courses concurrentes.
- [ ] Valider le modèle D1 final et les primitives transactionnelles exactes.
- [ ] Faire relire les contrats par une personne indépendante en sécurité applicative.
- [ ] Arbitrer conservation/scellement des audits, durée des exports et sessions administratives.
- [ ] N'implémenter qu'après validation et autorisation explicite distincte.


## Modèle de données administratif — 18 novembre 2026

- [x] Cartographier les entités administratives et leurs relations logiques.
- [x] Séparer compte, rôle, permission, mission et portée.
- [x] Décrire dossiers de vérification, décisions de clôture, notifications, exports et audit.
- [x] Identifier les contradictions entre architecture générale et décisions validées.
- [x] Distinguer clôture ordinaire par l'auteur et exception administrative limitée.
- [ ] Arbitrer les points ouverts du modèle logique.
- [ ] Réconcilier les contrats historiques et les états TypeScript avant le schéma D1.
- [ ] Faire relire le modèle par une personne indépendante en sécurité et données.
- [ ] Autoriser séparément toute création de migration ou modification du code.


## Modèle global des données — 18 novembre 2026

- [x] Consolider les domaines comptes, identités, appareils, contacts, groupes, alertes, interventions, trajets, notifications, abonnements/paiements et administration dans un référentiel unique.
- [x] Fixer `accounts` comme identité canonique pour les domaines citoyens et administratifs.
- [x] Identifier les entités absentes de la première proposition D1 : groupes, alertes programmées, SOS discret, abonnements/paiements.
- [x] Comparer les états compte/alerte/trajet entre décisions, contrats, code et proposition relationnelle.
- [x] Préserver le NO-GO GPS J+30 et l'absence de coordonnées précises en D1/R2.
- [ ] Arbitrer la preuve d'identité d'un proche invité (téléphone déclaré non vérifié vs vérification du moyen de contact).
- [ ] Finaliser les droits d'un contact révoqué pendant une alerte active.
- [ ] Définir le traitement d'une alerte orpheline hors scénario administratif déjà validé.
- [ ] Spécifier groupes privés, alertes programmées et SOS discret.
- [ ] Concevoir le sous-modèle abonnements/paiements et choisir les règles de cycle financier.
- [ ] Harmoniser les cinq états du compte dans les contrats TypeScript et les futurs états SQL.
- [ ] Harmoniser les états et motifs de clôture des alertes et trajets.
- [ ] Définir les durées de conservation hors GPS et les politiques de suppression/anonymisation.
- [ ] Compléter la matrice D1 avec les nouveaux domaines et leurs tests.
- [ ] Faire relire le modèle complet indépendamment avant toute migration.
- [ ] Obtenir une autorisation explicite distincte avant toute migration ou implémentation.


## Revue finale de cohérence du modèle relationnel — 18 novembre 2026

- [x] Examiner les cardinalités et relations entre comptes, identités, appareils, sessions, contacts, alertes, trajets, notifications et administration.
- [x] Définir les contraintes référentielles composites à exiger pour l'isolation inter-comptes.
- [x] Examiner les politiques de suppression et interdire les cascades destructives par défaut.
- [x] Recenser les opérations multi-tables et courses concurrentes à couvrir par contrats atomiques.
- [x] Identifier les divergences entre les cinq états de compte validés et le contrat TypeScript à trois états.
- [x] Identifier la divergence entre les états de trajet documentés et le contrat TypeScript.
- [x] Distinguer clôture ordinaire par l'auteur et exception administrative limitée.
- [x] Confirmer les lacunes de la première proposition : groupes, programmation SOS, SOS discret et sous-modèle paiements.
- [x] Confirmer que migrations/ ne contient pas de schéma métier versionné.
- [ ] Fermer les blocages P0 de `docs/REVUE_FINALE_COHERENCE_MODELE_RELATIONNEL.md`.
- [ ] Spécifier les sous-modèles P1 avant migration des domaines concernés.
- [ ] Aligner contrats TypeScript, décisions produit, machines à états et modèle relationnel.
- [ ] Finaliser la matrice de conservation hors GPS.
- [ ] Faire une revue indépendante sécurité, cryptographie, confidentialité et paiements.
- [ ] Vérifier Preview isolé de Production.
- [ ] Obtenir une autorisation explicite distincte avant création/application de migrations D1.

**Verdict actuel : NON PRÊT POUR MIGRATION.** Aucune modification applicative, API, D1, Cloudflare ou déploiement n'est autorisée par cette revue documentaire.


## Arbitrage P0 — cycle de compte et preuve des proches — 18 novembre 2026

- [x] Reconfirmer les cinq états de compte déjà validés.
- [x] Relever les deux états manquants dans `src/domain/account-lifecycle.ts`.
- [x] Documenter la matrice des transitions connues et marquer les transitions non décidées.
- [x] Séparer l'état de vérification e-mail de l'état du compte.
- [x] Rappeler que le téléphone obligatoire reste non vérifié et qu'aucun SMS OTP de compte n'est autorisé.
- [x] Distinguer invitation, preuve de destination, compte destinataire et consentement explicite.
- [x] Documenter une voie recommandée par e-mail vérifié sans la présenter comme approuvée.
- [x] Définir les tests de transitions, OTP, invitation, rejeu, concurrence et révocation.
- [ ] Arbitrer la durée et l'expiration d'une inscription non vérifiée.
- [ ] Arbitrer les transitions suppression/suspension concomitantes.
- [ ] Valider ou remplacer le parcours d'acceptation des proches par e-mail vérifié.
- [ ] Définir un parcours alternatif si un proche n'a pas d'adresse e-mail ou de compte SAC.
- [ ] Autoriser distinctement la mise à jour du contrat TypeScript et des tests.
- [ ] Refaire la revue de préparation D1 après alignement code/produit.

**Statut : blocage P0 clarifié mais non fermé.** Aucun code, test, API, migration, base D1 ou ressource Cloudflare n'a été modifié.

## Condition obligatoire d'activation du compte — 18 novembre 2026

- [x] Confirmer que toute inscription SAC exige une adresse e-mail.
- [x] Confirmer que la vérification de cette adresse par OTP e-mail est une condition sine qua non de l'activation.
- [x] Exclure toute création/activation par téléphone seul ou tout contournement en l'absence d'adresse e-mail.
- [x] Maintenir le compte en `pending_verification`, sans accès privé ni session, tant que l'OTP e-mail n'est pas validé côté serveur.
- [x] Maintenir le téléphone obligatoire comme coordonnée déclarée, sans qu'il puisse remplacer l'e-mail.
- [x] Confirmer qu'aucun SMS OTP de compte n'est autorisé ; les usages SMS SOS restent distincts.
- [ ] Implémenter ultérieurement le parcours uniquement après autorisation distincte, fournisseur e-mail choisi, conception OTP validée et tests de sécurité.

**Portée de cette décision :** règle produit/documentaire uniquement. Aucun code d'authentification, fournisseur, SMS, endpoint, schéma ou migration D1 n'est créé par cette mise à jour.
