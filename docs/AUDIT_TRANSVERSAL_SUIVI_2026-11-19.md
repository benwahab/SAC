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
