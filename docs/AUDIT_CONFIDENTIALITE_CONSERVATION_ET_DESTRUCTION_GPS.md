# SAC — Audit transversal de confidentialité, conservation et destruction GPS

**Date :** 18 novembre 2026  
**Branche examinée :** `main`  
**Commit de base :** `6a24abda187ab914f585a8f37f0c8e60d1c85639`  
**Statut :** audit documentaire et code ciblé ; aucune donnée réelle, migration, purge ou connexion GPS n'est autorisée par ce document.

## 1. Conclusion exécutive

**NO-GO pour la collecte GPS réelle, l'historique GPS et toute promesse de destruction irréversible à J+30.**

Les règles de confidentialité sont clairement posées : pas de coordonnées précises dans D1, R2, files, journaux, traces, analytics, exports ou sauvegardes serveur ; aucune clé GPS dans ces systèmes ; pas d'historique GPS avant preuve stricte de destruction.

Mais le mécanisme qui prouverait la garantie J+30 n'existe pas encore. Les primitives cryptographiques de localisation sont expérimentales et non connectées. Les tests existants vérifient le chiffrement/déchiffrement et la dérivation de clés, pas l'expiration cryptographique, les sauvegardes/restaurations ou l'effacement irréversible.

Autre constat majeur : la suppression de compte est actuellement un contrat métier pur. Elle change un état logique ; elle ne supprime ni n'anonymise effectivement les données persistées. Les durées de conservation hors GPS sont encore ouvertes.

## 2. Périmètre vérifié

Documents relus sur `main` :
- `docs/SECURITE_GPS_DESTRUCTION_CRYPTO.md`
- `docs/PLAN_VALIDATION_DESTRUCTION_GPS_J30.md`
- `docs/MACHINES_ETATS_ET_CONSERVATION.md`
- `docs/SCHEMA_RELATIONNEL_D1_PROPOSITION.md`
- `docs/MATRICE_TRACABILITE_SCHEMA_D1.md`
- `docs/CONTRAT_SECURITE_D1.md`
- `docs/DECISIONS_PRODUIT_RESTANTES.md`
- `docs/CONFORMITE_DONNEES_NIGER.md`
- `docs/MISE_A_JOUR_JURIDIQUE_NIGER_NOV_2026.md`
- `docs/RECHERCHE_COMPLEMENTAIRE_GPS_J30_ET_TEXTES_NIGER.md)

Code et tests relus :
- `src/services/location/key-exchange.ts`
- `tests/location-crypto.test.ts`
- `src/domain/account-lifecycle.ts`
- `tests/account-lifecycle.test.ts`

Les chemins `src/domain/trusted-contact-lifecycle.ts`, `src/domain/alert-access.ts` et `src/domain/location-sharing.ts` n'ont pas été trouvés aux emplacements recherchés. Aucun audit exhaustif de tous les appels applicatifs, routes ou dépendances n'est revendiqué.

## 3. Constats

### P-01 — L'exigence GPS J+30 est documentée, mais aucune preuve de destruction n'existe

**Niveau : CRITIQUE / BLOQUANT**

Le plan de validation fixe une exigence exigeante : à l'instant exact J+30, aucune interface, restauration, sauvegarde, export ou action administrative ne doit rendre la position lisible. Le plan comprend 36 scénarios, dont téléphone éteint, hors ligne, recul d'horloge, réinstallation, migration d'appareil, sauvegardes natives, restauration HSM/KMS, copies de clés et accès administrateur.

Le document marque encore les essais appareils réels, restaurations, évaluation d'un service externe et décision GO/NO-GO comme non réalisés. Aucun résultat PASS natif n'a été vérifié pendant cet audit.

**Décision :** conserver le NO-GO. Ne pas connecter le GPS réel, ne pas stocker d'historique et ne jamais afficher « supprimé définitivement » tant que chaque scénario critique n'a pas de preuve indépendante.

### P-02 — Le chiffrement expérimental n'est pas une politique d'expiration

**Niveau : CRITIQUE / BLOQUANT**

`key-exchange.ts` indique lui-même que le module est expérimental, non branché à l'application et qu'il ne valide pas l'identité du propriétaire d'une clé distante. Il dérive des clés directionnelles ECDH/HKDF et les marque non exportables dans WebCrypto.

Les tests couvrent notamment la dérivation directionnelle, l'isolation de contexte, l'intégrité AES-GCM et les clés non exportables. Ils ne démontrent pas :
- une date d'expiration imposée indépendamment de l'application ;
- la destruction d'une clé à J+30 lorsque le téléphone est éteint ;
- la résistance au recul de l'horloge et à la restauration d'une sauvegarde ;
- l'absence de copie de clé sur un autre appareil ;
- l'impossibilité de restaurer un état antérieur du service de clés ;
- l'effacement de caches, plaintext, mémoire ou exports.

Une clé WebCrypto non exportable n'est pas une clé qui s'autodétruit à une échéance. Le chiffrement protège la confidentialité au repos/transit, mais ne prouve pas la destruction dans le temps.

**Décision :** maintenir cette primitive comme expérimentation isolée. Ne pas la brancher aux positions réelles ni la présenter comme solution J+30.

### P-03 — Le stockage GPS serveur est interdit par les contrats, mais les tests d'absence de fuite restent à créer

**Niveau : BLOQUANT AVANT TOUTE DONNÉE RÉELLE**

Les contrats excluent les coordonnées précises, géohash, payloads de localisation et clés de D1, R2, KV, Durable Objects, files, journaux, traces, analytics, exports et sauvegardes. Les événements doivent utiliser une liste blanche de métadonnées.

La matrice demande encore des tests automatiques d'absence de fuite dans champs libres, erreurs, événements, logs, analytics, outbox, fichiers et environnements Preview. Aucun test d'intégration exhaustif de ce type n'a été vérifié dans le périmètre.

**À exiger :**
- schémas stricts qui rejettent les champs GPS inattendus ;
- sérialisation par liste blanche, jamais journalisation d'objets de requête complets ;
- tests canaris avec coordonnées synthétiques dans chaque champ et chaque canal de journalisation ;
- inspection des traces, crash reports, analytics, exports et sauvegardes ;
- preuve que les environnements Preview ne répliquent pas les données de Production.

### P-04 — La suppression de compte n'est pas un effacement physique

**Niveau : BLOQUANT AVANT LANCEMENT**

`account-lifecycle.ts` est explicitement un contrat métier pur. Il gère les états `active`, `deletion_pending` et `deleted`, ainsi que les conditions liées aux alertes et trajets actifs. Son commentaire indique que l'effacement/anonymisation et les dépendances doivent être exécutés séparément côté serveur.

Les tests vérifient les transitions mémoire. Ils ne prouvent pas :
- suppression des identités téléphone/e-mail ;
- invalidation des sessions et appareils ;
- révocation des invitations et abonnements push ;
- anonymisation ou suppression des alertes et événements ;
- suppression des payloads/outbox et fichiers ;
- purge des exports, caches, sauvegardes et outils de support ;
- traitement d'une finalisation concurrente ou restauration d'un ancien état.

**Décision :** ne pas présenter « supprimer mon compte » comme une fonctionnalité disponible tant que l'opération D1 et la purge de toutes les dépendances ne sont pas conçues, implémentées et testées.

### P-05 — Les durées de conservation hors GPS sont inconnues

**Niveau : BLOQUANT AVANT COLLECTE DE DONNÉES PERSONNELLES**

Les documents indiquent que les durées hors GPS ne sont pas arrêtées. Cela concerne notamment :
- comptes et identités ;
- appareils, certificats, sessions et défis ;
- invitations et relations de confiance ;
- alertes, événements, réponses et responsabilités ;
- outbox et tentatives fournisseur ;
- abonnements push ;
- trajets, participants et confirmations d'arrivée ;
- journaux de sécurité, demandes de support et exports.

Une mention « conserver selon la politique » n'est pas une politique exécutable. Chaque catégorie doit avoir une finalité, un point de départ du délai, une durée, une base légale validée, un propriétaire, des accès, une procédure de suppression/anonymisation et un traitement des sauvegardes.

**Décision :** aucune durée chiffrée n'est inventée dans cet audit. Une matrice finale doit être validée après revue juridique pour les pays effectivement ciblés.

### P-06 — Les droits d'un contact révoqué et les données accessibles restent partiellement ouverts

**Niveau : ÉLEVÉ / BLOQUANT AVANT API D'ACCÈS**

Les documents séparent correctement :
- le maintien des rappels vers le destinataire initial d'une alerte déjà déclenchée ;
- l'arrêt des nouvelles transmissions GPS à la révocation ;
- le retrait proposé de l'accès au détail et à l'historique après clôture.

Cependant, les droits de lecture pendant l'alerte, les paquets GPS déjà reçus, les réponses autorisées après révocation et l'ordre atomique entre révocation et émission ne sont pas tous définitivement arbitrés.

**À exiger avant API :**
- matrice de droits par ressource et par moment : avant alerte, pendant alerte, après révocation, après clôture ;
- séparation entre droit de recevoir un rappel, droit de lire le détail, droit de répondre, droit de voir une position et droit de consulter un historique ;
- blocage immédiat des nouvelles transmissions GPS après révocation effective ;
- aucune réécriture rétroactive de l'instantané des destinataires ;
- test de concurrence révocation/lecture/émission ;
- aucun accès implicite aux trajets ou aux positions du seul fait d'être membre d'un groupe familial.

### P-07 — La liste figée des destinataires ne doit pas devenir un droit permanent

**Niveau : ÉLEVÉ**

L'instantané garantit que les rappels initialement décidés ne changent pas quand les contacts évoluent. Il ne signifie pas que les destinataires conservent indéfiniment l'accès aux données privées.

**Règle de séparation à préserver :**
- instantané initial : immuable pour la traçabilité et les rappels prévus ;
- autorisation de lecture : vérifiée séparément à chaque accès ;
- autorisation de localisation : limitée à la session et à la finalité autorisées ;
- révocation : empêche les nouvelles transmissions autorisées par SAC ;
- clôture : déclenche l'application de la politique d'accès post-alerte ;
- aucune restauration d'un ancien instantané ne rétablit un droit révoqué.

Cette séparation doit être matérialisée dans les requêtes serveur et les tests D1, pas seulement dans l'interface.

### P-08 — Les sauvegardes et restaurations constituent une frontière de sécurité distincte

**Niveau : CRITIQUE**

Le plan GPS couvre explicitement les restaurations de sauvegardes locales Android/iOS, copies d'application, anciens états logiciels, snapshots de services de clés et accès administrateur. Les documents signalent notamment que des mécanismes natifs de sauvegarde/restauration et certains éléments Keychain ne suffisent pas à prouver l'expiration à J+30.

Les triggers SQL anti-modification envisagés pour les événements ne protègent pas contre la restauration complète d'une sauvegarde antérieure. Une suppression dans l'état courant peut être annulée par une restauration si la source restaurée contient toujours les données.

**À exiger :**
- inventaire des sauvegardes et règles d'exclusion par plateforme ;
- test réel de restauration Android/iOS sur appareils de laboratoire ;
- politique de restauration serveur qui ne réactive jamais une clé GPS échue ni un compte révoqué ;
- preuve que les secrets d'expiration ne sont pas inclus dans les snapshots restaurables ;
- procédure de reprise après sinistre qui maintient les échéances et révocations ;
- journal de preuve minimal, sans coordonnées ni secrets.

### P-09 — Les journaux et systèmes de support sont des copies potentielles

**Niveau : BLOQUANT**

L'interdiction GPS s'étend aux logs applicatifs et plateforme, traces, analytics, crash reports, support, captures de diagnostic, exports et fichiers temporaires. Les contrats interdisent aussi les jetons, OTP, clés privées et secrets de cérémonie dans les journaux.

**À exiger :**
- politique de redaction par défaut pour toutes les erreurs et exceptions ;
- aucun dump de corps de requête ou réponse fournisseur ;
- données synthétiques dans les outils de support ;
- accès de support sans possibilité de consulter les coordonnées ou les clés ;
- contrôles automatiques sur les logs et exports ;
- conservation et suppression des journaux définies dans la matrice générale.

### P-10 — Les obligations juridiques et les durées doivent être vérifiées avant collecte

**Niveau : BLOQUANT AVANT OUVERTURE AU PUBLIC**

Le dépôt contient une pré-analyse et une mise à jour juridique datée de novembre 2026. Elles doivent être considérées comme des travaux de recherche, pas comme un avis juridique final ni comme une validation de conformité. Les pays de déploiement et les rôles exacts de SAC dans le traitement doivent être établis avant collecte réelle.

**À exiger :**
- validation par un conseil compétent des textes en vigueur au Niger et dans chaque pays ciblé ;
- identification du responsable de traitement, des sous-traitants et des transferts transfrontaliers ;
- finalités et bases juridiques par catégorie de données ;
- information des utilisateurs, droits d'accès/effacement/opposition et mécanisme de plainte ;
- règles applicables aux données de localisation et aux données d'urgence ;
- contrats fournisseurs, sous-traitance, hébergement et transferts ;
- analyse d'impact vie privée/sécurité avant le GPS réel.

## 4. Matrice des données — décisions encore requises

| Catégorie | Règle déjà posée | Lacune bloquante |
|---|---|---|
| GPS précis | Aucun stockage serveur ; historique NO-GO | Preuve J+30 et règles du flux éphémère |
| Clés GPS | Exclues de D1/R2/logs/backups | Mécanisme d'expiration/destruction validé |
| Alertes et événements | Métadonnées minimales, événements append-only envisagés | Durée, anonymisation, accès et sauvegardes |
| Contacts et invitations | Acceptation explicite, révocation | Durées, purge, accès après révocation |
| Sessions et appareils | Révocation et versions d'autorisation | Durées et purge des métadonnées |
| Notifications | Payloads minimisés | Durées outbox/tentatives, données fournisseur |
| Trajets et arrivées | Pas de GPS dans D1 | Durées et droits d'accès après fin |
| Journaux de sécurité | Pas de secrets ni GPS | Liste de champs, accès, durée et purge |
| Compte supprimé | Cycle logique à deux phases proposé | Effacement/anonymisation effectifs et preuves |

## 5. Plan de validation avant toute donnée réelle

### Phase A — Politique et décisions
1. Finaliser la matrice de conservation hors GPS.
2. Finaliser les droits de chaque destinataire pendant et après révocation.
3. Définir précisément le partage de position éphémère : durée, fréquence, cache, fin, annulation et comportement hors ligne.
4. Définir la procédure de suppression de compte et les données qui doivent être anonymisées ou supprimées.
5. Faire valider les obligations légales par pays de déploiement.

### Phase B — Conception technique
1. Choisir une architecture de localisation qui ne persiste aucune coordonnée serveur.
2. Démontrer comment les paquets chiffrés sont supprimés des buffers/relais après livraison ou expiration.
3. Séparer les clés d'identité, de transport et de session GPS.
4. Définir la révocation des droits et des clés de session.
5. Définir l'effacement de compte couvrant D1, stockage objet, files, push, exports, logs, support et sauvegardes.
6. Définir une reprise après sinistre qui ne restaure aucun droit ou clé expirée.

### Phase C — Tests en environnement isolé
- tests canaris d'absence de GPS dans toutes les sorties ;
- lecture inter-comptes et accès par contact non autorisé ;
- contact révoqué avant, pendant et après alerte ;
- révocation concurrente à une transmission ;
- restauration D1 et sauvegardes avant/après échéance ;
- tests de suppression complète du compte et de toutes ses dépendances ;
- scénarios GPS-01 à GPS-36 sur chaque plateforme/configuration supportée ;
- revue indépendante cryptographique et sécurité.

Un scénario critique NON TESTABLE maintient le NO-GO. Aucun test destructif sur appareil personnel ou Production.

## 6. Invariants non négociables

1. Pas de GPS précis dans D1, R2, KV, Durable Objects, files, logs, traces, analytics, exports ou sauvegardes serveur.
2. Pas d'historique GPS V1 tant que la destruction irréversible J+30 n'est pas prouvée.
3. Aucune clé GPS récupérable par récupération de compte, nouvel appareil, backup ou restauration.
4. Une position périmée est toujours horodatée et jamais affichée comme en direct.
5. Un destinataire initial n'obtient pas automatiquement un droit permanent de lecture.
6. La révocation coupe les nouvelles transmissions GPS dès qu'elle est effective côté serveur.
7. La suppression logique d'un compte n'est jamais présentée comme effacement physique.
8. Les durées de conservation hors GPS sont définies avant collecte.
9. Les logs et outils de support ne reçoivent ni GPS ni secrets.
10. Une restauration ne réactive jamais un droit, appareil, session ou clé qui était définitivement révoqué/expiré.

## 7. Décision finale

**NO-GO — aucune collecte GPS réelle, aucun historique GPS et aucune déclaration de destruction J+30 garantie.**

La meilleure décision actuelle pour protéger les futurs utilisateurs est de ne pas collecter ce que SAC ne sait pas encore détruire de manière démontrable. Le partage temporaire éphémère pourra être étudié séparément, mais il devra lui aussi prouver l'absence de persistance et la révocation des droits.

La suppression de compte, les durées hors GPS, les accès après révocation et la conformité juridique restent également des prérequis avant une mise en service réelle.

Aucune route, migration, table, politique de purge, ressource Cloudflare, fournisseur, donnée GPS ou activation de fonctionnalité n'est créée par cet audit.

## Addendum — décision produit confirmée sur les alertes clôturées — 18 novembre 2026

Les formulations antérieures de cet audit sur une conservation GPS J+30 sont remplacées par la décision confirmée et détaillée dans docs/CONTRAT_CONSERVATION_ALERTES_ET_PURGE.md :

- GPS associé à l'alerte : suppression automatique immédiate à la clôture ;
- historique : seule la nature/catégorie de l'alerte reste pendant 30 jours après clôture ;
- à l'expiration : suppression définitive de l'entrée d'historique et de sa catégorie ;
- sauvegardes, snapshots, Time Travel, réplications, exports et restaurations ne doivent jamais ressusciter les positions ni les alertes supprimées.

Le NO-GO GPS demeure : cet addendum est une décision de produit et une exigence d'architecture, pas une preuve que les purges ou les restaurations sont déjà correctement implémentées. Toute contradiction antérieure dans cet audit doit être lue à la lumière de cet addendum.
