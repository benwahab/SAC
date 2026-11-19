# SAC — Audit transversal de suivi et écarts confirmés

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`  
**Branche :** `main` uniquement  
**Commit examiné :** `042da88898ab9b83500421f733b8946322cdf80e`  
**Portée :** lecture du dépôt GitHub, routes API, interface privée, services SOS, contrats et état CI.  
**Limite :** aucun build local, test d'appareil, accès direct D1 ou déploiement n'a été effectué pendant cette passe. Les constats ci-dessous distinguent donc le code présent des services réellement activés.

## 1. Conclusion exécutive

Le dépôt contient désormais une tranche serveur réelle pour les proches et le SOS, ainsi qu'une première interface privée. Cependant, l'interface SOS est incomplète par rapport aux opérations serveur déjà disponibles. La documentation de suivi contient plusieurs passages historiques qui ne reflètent plus l'état courant et doivent être lus avec leurs mises à jour ultérieures.

Le workflow GitHub Actions correspondant au commit examiné est en échec. Le job `validate` ne fournit aucune étape récupérable par l'API utilisée et le téléchargement de ses journaux retourne 404. La cause racine n'est donc **pas identifiée** ; aucune correction CI ne doit être inventée à partir de cette seule information.

Aucun déploiement, aucune migration D1 distante et aucune activation de service externe n'ont été effectués.

## 2. État confirmé des parcours proches

### Présent dans le code

- `GET /api/contacts` : liste les relations actives du compte authentifié.
- `POST /api/contacts/invitations` : crée et transmet une invitation si les paramètres nécessaires sont configurés.
- `POST /api/contacts/invitations/accept` et `decline` : acceptation ou refus authentifié.
- `POST /api/contacts/revoke` : révocation par le propriétaire de la relation.
- `src/PrivateSpacePage.tsx` : affichage des proches actifs, invitation par e-mail et révocation.

### Manques confirmés dans l'interface

- Aucun écran/flux de réception listant les invitations en attente.
- Aucun écran dédié pour accepter ou refuser une invitation reçue.
- Aucun affichage de l'état d'une invitation, de son expiration ou de son historique.

Les routes d'acceptation/refus existent, mais leur existence seule ne fournit pas le parcours utilisateur complet.

## 3. État confirmé du parcours SOS

### Présent côté serveur

- `POST /api/alerts` : création authentifiée du SOS et instantané des destinataires.
- `GET /api/alerts` : liste des alertes récentes auxquelles le compte participe.
- `GET /api/alerts/:alertId` : détail réservé à l'auteur ou à un destinataire de l'instantané.
- `POST /api/alerts/:alertId/respond` : accusé de réception, volontariat, retrait.
- `POST /api/alerts/:alertId/close` : clôture par l'auteur.
- `GET /api/alerts/:alertId/events` : chronologie filtrée, sans exposer les identifiants des autres comptes.
- `functions/lib/alerts/sos-service.ts` : persistance des réponses, attribution séquentielle du responsable principal, retrait/transfert, clôture et outbox de rappels/escalade.

### Présent dans l'interface

- Sélection de proches actifs.
- Catégorie, niveau et description d'une alerte personnalisée.
- Choix de 1 à 5 rappels push, avec intervalle de cinq minutes expliqué.
- Confirmation avant déclenchement.
- Liste sommaire des alertes créées/reçues et état actif/clôturé.
- Message précisant qu'une alerte enregistrée ne prouve pas l'envoi ni la réception des notifications.

### Manques confirmés dans l'interface

- Le destinataire ne peut pas accuser réception depuis la page.
- Le destinataire ne peut pas proposer son aide depuis la page.
- Le responsable ne peut pas se retirer depuis la page.
- L'auteur ne dispose pas du bouton de clôture depuis la page.
- Le détail d'une alerte n'est pas chargé dans une vue dédiée.
- La chronologie exposée par API n'est pas affichée.
- Aucun état de responsabilité principale n'est présenté à l'utilisateur.

**Conclusion :** les opérations serveur existent, mais le parcours de suivi et d'intervention SOS n'est pas terminé. Il faut compléter l'interface en réutilisant les API et services existants, pas réécrire le moteur SOS.

## 4. Notifications et escalade

Le service SOS gère des tâches d'outbox, des baux de traitement, des tentatives et l'évaluation des tâches SMS. Cela ne prouve pas une livraison réelle :

- le code de service documente explicitement que l'acceptation fournisseur n'est pas une preuve de livraison ou de lecture ;
- le dispatch dépend d'un adaptateur d'envoi injecté ;
- aucune preuve examinée ici n'établit un worker de production connecté à un fournisseur push ou SMS ;
- l'état de la file ne doit jamais être présenté comme « envoyé », « reçu » ou « lu » sans preuve de transport correspondante.

Le chemin de création d'une alerte doit rester indépendant de la disponibilité d'un fournisseur tiers.

## 5. Authentification et disponibilité réelle

Les routes privées utilisent une garde de session appareil authentifiée. La page privée vérifie la session avant de charger les proches.

La documentation de suivi indique que l'émission d'une session lors d'une connexion ultérieure reste à finaliser : le parcours initial d'enrôlement racine ne remplace pas un mécanisme de reconnexion d'un appareil déjà enrôlé. Le drapeau `WEBAUTHN_ROOT_ENROLLMENT_ENABLED` reste désactivé selon le dernier état documenté.

Les migrations D1 0001 à 0007 sont présentes dans le dépôt. Leur présence dans Git ne signifie pas qu'elles sont appliquées à la base distante. Le dernier état documenté indique que la base distante `sac-db` est vide (0 table) et que le projet Pages `sac` a été créé mais qu'aucun déploiement n'a été lancé. Ces points devront être relus directement avant toute modification d'infrastructure.

## 6. CI — constat et limite diagnostique

- Workflow : `.github/workflows/ci.yml`.
- Dernier run associé au commit examiné : `44563692028`.
- Job : `validate`, identifiant `135700010488`.
- Conclusion GitHub : `failure`.
- Le job renvoie une liste d'étapes vide via l'API consultée.
- Le téléchargement des journaux renvoie 404 (BlobNotFound).
- Le check indique une annotation, mais le point d'accès correspondant n'est pas accessible avec l'outil de lecture utilisé.

**Cause racine : inconnue.** Ne pas affirmer que l'échec vient de TypeScript, npm, d'un test, du build ou de l'audit de dépendances sans journal exploitable. Ne pas désactiver ou rendre non bloquant un contrôle pour faire passer la CI.

Le fichier `package-lock.json` est bien présent à la racine (blob SHA `7311da1ea1adcd92ae715313a04b098e774ad808`), contrairement à une note plus ancienne de l'audit du 18 novembre qui disait qu'il était absent. Le workflow courant utilise `npm ci`.

## 7. Documentation : contradictions historiques à corriger

Le fichier `docs/ETAT_REEL_ET_FEUILLE_DE_ROUTE_OPERATIONNELLE_2026-11-19.md` contient des sections initiales qui indiquent encore :
- que les endpoints SOS n'existent pas ;
- que la chronologie n'a pas d'endpoint ;
- que l'interface privée ne présente pas le parcours SOS ;
- que les routes de proches ne sont pas encore ajoutées.

Des sections ultérieures du même document enregistrent explicitement l'ajout de ces routes et de l'interface. Les sections initiales sont historiques et ne doivent plus être utilisées comme état courant.

Le fichier `docs/AUDIT_ETAT_REEL_CODE_2026-11-18.md` décrit lui aussi un état antérieur et affirme que le SOS réel n'est pas implémenté. Il doit être conservé comme photographie historique, mais être clairement marqué comme remplacé pour l'état courant.

La documentation doit maintenir une seule source de vérité datée pour l'état réel, avec les décisions validées séparées des propositions et des blocages.

## 8. Priorités de correction

### P0 — CI et fiabilité de validation
1. Obtenir le diagnostic de l'annotation ou des journaux du job `validate`.
2. Identifier la première étape réellement exécutée et son erreur.
3. Corriger uniquement la cause démontrée.
4. Relancer le workflow sur le commit correct et vérifier le résultat complet.

### P0 — Terminer le parcours privé sans réécrire les services
1. Ajouter une vue détail d'alerte en s'appuyant sur `GET /api/alerts/:alertId`.
2. Charger la chronologie avec `GET /api/alerts/:alertId/events`.
3. Ajouter les actions du destinataire : accusé de réception, volontariat, retrait du volontariat selon l'état.
4. Ajouter la clôture auteur avec confirmation explicite et motif `completed` ou `cancelled`.
5. Actualiser les données après chaque action et distinguer erreur réseau, résultat confirmé et résultat ambigu.
6. Couvrir ces parcours par des tests adaptés sans inventer un état de livraison push/SMS.

### P1 — Compléter les invitations
1. Concevoir un endpoint de lecture des invitations reçues et envoyées, avec cloisonnement par compte.
2. Ajouter la boîte de réception et les actions accepter/refuser.
3. Afficher expiration et statut sans révéler de jeton.
4. Réutiliser les services et contrats existants.

### P1 — Harmoniser la documentation
1. Marquer les audits antérieurs comme historiques.
2. Mettre à jour l'état réel courant et ses liens.
3. Faire correspondre les tableaux de statut aux routes, migrations, interfaces et tests effectivement présents.
4. Conserver explicitement les limites : D1 non migrée, connexion ultérieure non finalisée, services push/SMS non livrés, GPS réel NO-GO, déploiement non lancé.

## 9. Règles de prudence

- Ne pas modifier la base distante ni appliquer les migrations sans autorisation explicite.
- Ne pas activer l'enrôlement WebAuthn racine tant que les conditions de revue et de sécurité ne sont pas satisfaites.
- Ne pas activer le GPS précis avant preuve indépendante de suppression et de non-résurrection selon le contrat de conservation applicable.
- Ne pas connecter de fournisseur, créer de dépense ou déployer sans accord explicite.
- Ne pas supprimer les contrats/tests existants ni reconstruire une fonctionnalité déjà implémentée.
- Toute modification de code doit être précédée d'une lecture des décisions concernées et suivie de tests ciblés, typecheck, build et CI vérifiés.


## 10. Mise à jour après corrections ciblées (19 novembre 2026)

Les commits suivants ont été poussés sur `main` :
- `10eef622f881a98afcaa0d8d20f2d5c533aeffb5` — ajout du panneau de suivi SOS privé.
- `4e3f92f47ce3435d3653104a97768c91080ad719` — intégration du panneau dans « Mes alertes ».
- `a80dea3d4cd0f6bf6355a9435d99c0f7e64352f7` — aperçu d'invitation authentifié, lié à l'e-mail vérifié destinataire.
- `33dfe46e868e4c7f7c2308865b5a74c8061bcdfa` — écran d'acceptation/refus explicite.
- `5ebec3b88520c17b00bfabb09271a2358aae8ce5` — préservation du lien d'invitation pendant la connexion.
- `5856a057ae8eb07b3b66a6838a07fa82e302ced9` — routage de l'écran d'invitation et retour après connexion.

### Corrections apportées

**Suivi SOS privé**
- Le panneau détaille le niveau, l'heure de création, l'heure/motif de clôture et la chronologie.
- Le destinataire peut accuser réception, se porter volontaire ou retirer son volontariat.
- L'auteur peut clôturer en choisissant « situation terminée » ou « annuler cette alerte ».
- Les opérations utilisent les endpoints et services déjà présents ; aucun nouveau moteur de responsabilité n'a été introduit.
- Les actions sont confirmées avant envoi et les erreurs réseau/API restent visibles.
- Les réponses n'exposent pas les identifiants des autres participants.

**Invitation reçue par e-mail**
- Le lien e-mail existant `/invitation/accept?id=…&token=…` dispose maintenant d'un écran.
- L'écran vérifie la session, l'adresse e-mail vérifiée correspondante, l'état et l'expiration de l'invitation côté serveur avant d'afficher l'identité e-mail minimale de l'invitant.
- Le destinataire doit accepter ou refuser explicitement ; la consommation reste assurée par les services existants et le jeton à usage unique.
- Si le destinataire n'est pas connecté, le retour vers le lien complet est conservé après l'enrôlement/connexion.
- Le jeton n'est pas stocké en clair en D1. L'aperçu ne retourne jamais le jeton.

### Ce qui reste bloqué / non vérifié

1. **CI toujours en échec.** Le run `44565618505` sur le commit `5ebec3b88520c17b00bfabb09271a2358aae8ce5` termine en échec environ deux secondes après le démarrage du job. GitHub ne renvoie aucune étape et l'archive de logs répond `BlobNotFound`. L'annotation est inaccessible via l'API autorisée. Cela ne permet pas d'affirmer que le code est compilé ni de corriger une cause imaginaire. La validation CI reste P0 ouverte.
2. **Boîte de réception des invitations :** aucun endpoint ne liste les invitations entrantes sans jeton. Le destinataire reçoit l'invitation via le lien e-mail individuel. Le lien peut être accepté/refusé dans l'application après connexion. Une boîte de réception interne demanderait un arbitrage de confidentialité et un mécanisme sécurisé de reprise d'invitation ; ne pas exposer les jetons ni permettre une acceptation sans preuve du lien.
3. **Validation runtime :** les commits déclenchent le workflow mais celui-ci ne fournit pas de résultat exploitable. Aucune affirmation de build vert, de tests passants ou de parcours testé sur téléphone n'est faite.
4. **D1 distante, notifications, GPS et déploiement :** inchangés. Aucune migration distante, activation fournisseur, activation GPS ou mise en production n'a été effectuée.

**État après cette passe :** le parcours d'intervention SOS est maintenant relié à l'interface et le lien d'invitation reçu par e-mail possède un parcours explicite. La validation CI, la boîte de réception interne et les autres domaines de l'audit transversal restent ouverts ; SAC n'est pas déclaré prêt pour production.


## 11. Diagnostic CI complémentaire — 19 novembre 2026

Une lecture complémentaire des objets GitHub Actions a permis de préciser le constat sans identifier la cause racine :

- Run le plus récent examiné : `44565787936`, commit `c50f4fd8473404a978180ef3b8312d904ed92b0d`.
- Job `validate` : `135707009240`, conclusion `failure`.
- Le job a commencé à `16:24:44Z` et s'est terminé à `16:24:47Z`.
- GitHub retourne `runner_id: 0`, un nom de runner vide et `steps: []`.
- Le check-run signale une annotation (`annotations_count: 1`), mais le point d'accès des annotations n'est pas disponible via l'interface de lecture utilisée.
- Les huit exécutions récentes examinées sur `main` présentent la même absence d'étapes récupérables ; elles échouent toutes en quelques secondes.

**Interprétation permise :** le job échoue avant qu'une étape du workflow soit rapportée comme exécutée. Ces éléments orientent le diagnostic vers le démarrage/dispatch du runner ou un autre problème d'infrastructure GitHub Actions. Ils ne démontrent pas une erreur dans le code, le lockfile, npm, TypeScript ou les tests.

**Interprétation interdite :** conclure que le code compile, que les tests passent, ou que la cause exacte est un incident GitHub sans preuve supplémentaire. Le workflow ne doit pas être désactivé, contourné ou rendu non bloquant.

### État actualisé des priorités

- **P0 — diagnostic CI : toujours ouvert**, mais le constat est précisé : aucune étape ne démarre/est remontée et aucun runner n'est attribué dans les données consultées. La cause racine reste inconnue.
- **Parcours SOS privé : corrections d'interface réalisées** dans les commits `10eef622` et `4e3f92f` ; le panneau charge le détail et la chronologie, et expose les actions du destinataire et de l'auteur. La validation automatique reste bloquée par l'état CI.
- **Invitation reçue par lien : parcours d'aperçu, connexion, acceptation/refus ajouté** dans les commits `a80dea3`, `33dfe46`, `5ebec3b` et `5856a05`. Ce parcours n'est pas une boîte de réception interne.
- **P1 — boîte de réception interne : toujours ouverte** ; ne pas créer une liste qui contourne la preuve du lien ou révèle des jetons.
- **Autres domaines, D1 distante, notifications réelles, GPS et déploiement : inchangés et non certifiés.**

Cette section complète les constats précédents ; les sections historiques restent conservées pour la traçabilité.


## 12. Continuité de connexion — lacune prioritaire confirmée

Lecture complémentaire de `src/App.tsx`, `src/services/device/root-enrollment.ts`, des routes `functions/api/auth/*` et de l'état WebAuthn :

- Le parcours client raccordé prépare puis termine l'enrôlement de la première clé racine.
- `POST /api/auth/complete-root-enrollment` crée l'appareil racine et la première session dans le même batch D1.
- `GET /api/auth/session` vérifie une session déjà présentée ; il ne crée pas une nouvelle session.
- `POST /api/auth/logout` révoque la session courante.
- Aucun parcours client/endpoint d'assertion WebAuthn (`navigator.credentials.get`) pour une connexion ultérieure n'a été trouvé dans l'arborescence examinée.
- Le service client expose la vérification de session et la déconnexion, mais pas une opération d'authentification par assertion.

**Conséquence :** l'enrôlement initial et la première session ne constituent pas un cycle de connexion réutilisable. Après expiration, révocation, déconnexion ou changement d'appareil, le parcours de reconnexion n'est pas complet. La page de connexion ne doit pas être présentée comme une authentification déjà opérationnelle pour un appareil enrôlé.

**Priorité P0 avant toute ouverture à des utilisateurs :** définir et implémenter la connexion WebAuthn par assertion sur appareil déjà enrôlé, avec challenge serveur à usage unique, vérification cryptographique côté serveur, origine/RP ID, contrôle du compte et de l'appareil, anti-rejeu, limites de tentatives et création de session atomique. Le parcours d'un nouvel appareil et la récupération de compte restent des parcours distincts à spécifier. Ne pas inventer un refresh token ni contourner la racine matérielle avec un mot de passe seul.

Cette lacune n'a pas été modifiée dans cette passe : le protocole d'assertion doit être conçu et audité avant implémentation. Aucune migration distante ni activation de l'enrôlement n'a été effectuée.


## 13. Suivi du responsable principal — mise à jour du 19 novembre 2026

Deux commits ont complété le suivi privé d'une alerte SOS :

- `277695793a3f0fdf5a26956c476a8dd228af8d2e` — l'endpoint `GET /api/alerts/:alertId/events` renvoie maintenant l'état de la responsabilité principale active.
- `63052d642fe5a87d56c8e527af4bbd2b3fc079e3` — le panneau privé affiche si le compte connecté est responsable principal, si un autre proche l'est, ou si aucune responsabilité n'est actuellement attribuée.

### Données exposées

L'API renvoie uniquement deux booléens :
- `responsibility.assigned` : une responsabilité principale active existe ;
- `responsibility.isSelf` : elle appartient au compte actuellement connecté.

Aucun identifiant, nom, e-mail ou autre donnée personnelle du proche responsable n'est exposé. La lecture reste précédée de la vérification de session et du contrôle d'accès à l'alerte effectué par le service de chronologie. Une erreur de lecture D1 renvoie une indisponibilité explicite (503), sans inventer un état de responsabilité.

### Limite de validation

Les deux commits ont déclenché GitHub Actions. Le run du dernier commit (`44569930288`) a échoué avant de fournir des étapes exécutées ; l'API GitHub consultée ne fournit toujours aucun journal exploitable. Aucun résultat de typecheck, build ou tests n'est donc revendiqué pour cette modification. La CI reste P0 ouverte.


## 14. Projection privée du responsable SOS — durcissement et tests D1

Complément apporté après le premier affichage de la responsabilité :

- `b32dc260e39b8d765bfdb79d4681d8c7815bb91e` — ajout de `getSosResponsibilityForParticipant` dans le service métier. La lecture de la responsabilité et le contrôle d'accès auteur/destinataire sont réunis dans une requête D1.
- `9ea56155fafcf8cd3969cc4f97337bf50b329685` — l'endpoint des événements utilise désormais cette projection métier et ne réalise plus de requête SQL directe.
- `057bd4714b102e0356040b3570f45141ad30cae7` — ajout d'une route au worker D1 de test pour la projection.
- `dfcc181eeda744786a161718774fb0c01fc58dc8` — tests D1 couvrant l'absence initiale de responsable, l'auteur, le responsable, un autre destinataire, le transfert après retrait, l'accès refusé à un tiers et la clôture.

La projection ne retourne que `assigned` et `isSelf`. L'accès est limité à l'auteur et aux destinataires figés de l'alerte. Les tests ont été ajoutés au scénario D1 existant `test:sos-d1`, mais leur exécution n'est pas certifiée tant que GitHub Actions ne démarre pas ses étapes.
