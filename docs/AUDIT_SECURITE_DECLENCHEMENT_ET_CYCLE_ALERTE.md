# SAC — Audit de sécurité du déclenchement et du cycle d'une alerte

**Date :** 18 novembre 2026  
**Branche examinée :** `main`  
**Commit de base :** `4eeb0eee4e977c11f99be2ca8c8fb4526643d1ea`  
**Statut :** audit documentaire ciblé ; aucune implémentation serveur ou migration autorisée par ce document.

## 1. Périmètre et méthode

Fichiers examinés :

- `docs/CONTRATS_OPERATIONS_ATOMIQUES_D1.md`
- `docs/MACHINES_ETATS_ET_CONSERVATION.md`
- `docs/SCHEMA_RELATIONNEL_D1_PROPOSITION.md`
- `docs/MATRICE_TRACABILITE_SCHEMA_D1.md`
- `src/domain/alert-lifecycle.ts`
- `src/domain/alert-responses.ts`
- `src/domain/session-authorization.ts`
- `tests/alert-lifecycle.test.ts`
- `tests/alert-responses.test.ts`
- `tests/session-authorization.test.ts`

Le chemin `src/domain/sos-lifecycle.ts` n'existe pas sur le commit examiné. Les trois modules de domaine présents sont des contrats TypeScript purs : ils ne créent aucune alerte, n'authentifient aucune requête et n'écrivent rien dans D1.

Cet audit évalue les garanties documentées et le code effectivement lu. Il ne constitue ni un test d'intrusion, ni une revue exhaustive de toutes les routes du dépôt, ni une preuve d'exécution D1.

## 2. Conclusion générale

**NO-GO pour activer ou présenter le SOS comme fonctionnel.**

Les règles métier essentielles sont bien documentées et plusieurs transitions pures disposent de tests. En revanche, les preuves nécessaires à un vrai déclenchement serveur ne sont pas présentes dans les fichiers examinés : authentification de la requête, validation serveur des paramètres, sélection atomique des destinataires, création atomique alerte/instantané/événement/outbox, idempotence persistante, envoi et reprise des notifications.

La présence de fonctions pures testées ne doit jamais être interprétée comme la preuve que le SOS peut être envoyé de manière sûre.

## 3. Constats

### A-01 — Aucun contrat de création/déclenchement implémenté dans le domaine examiné

**Niveau : BLOQUANT**

`alert-lifecycle.ts` traite la clôture d'une alerte déjà créée et l'éligibilité théorique aux rappels. Il n'expose pas de transition de création. Aucun des fichiers examinés ne fournit une opération complète qui reçoit une demande de SOS et crée l'alerte.

Conséquence : les tests actuels ne prouvent pas qu'une requête réelle peut déclencher une alerte, encore moins qu'elle le fait avec les bonnes autorisations et sans effets partiels.

**Exigence avant implémentation :** définir une commande serveur unique dont l'acteur est issu d'une session vérifiée et dont les paramètres sont validés côté serveur. Elle devra créer, dans une seule opération métier D1 démontrée atomique, l'alerte, l'instantané des destinataires, l'événement initial, les tâches outbox et le résultat d'idempotence.

### A-02 — L'identité d'auteur doit être exclusivement dérivée de la session authentifiée

**Niveau : BLOQUANT**

Le contrat D1 impose correctement que compte et appareil proviennent de la session authentifiée, jamais du JSON client. Le module `session-authorization.ts` vérifie un enregistrement de session fourni en entrée, la correspondance compte/appareil, l'état actif de l'appareil, l'expiration et `authVersion`.

Mais ce module est une fonction pure : il ne retrouve pas lui-même le jeton présenté, ne lit pas D1 et ne prouve pas que l'enregistrement transmis correspond au secret reçu sur la requête. Son contexte ne contient pas non plus l'état du compte ni l'état du certificat d'appareil.

**Exigence avant implémentation :**
- résoudre le jeton présenté côté serveur vers un hash stocké, sans jamais accepter un `accountId` ou `deviceId` du corps comme identité ;
- relire à chaque requête protégée le compte, la session, l'appareil, `auth_version` et les états de révocation requis ;
- vérifier le certificat et les conditions cryptographiques applicables avant d'autoriser le déclenchement ;
- refuser compte suspendu/supprimé, session expirée/révoquée, appareil non actif ou version d'autorisation périmée ;
- répéter les conditions critiques dans l'écriture SQL finale afin de fermer la course avec une révocation concurrente.

Ne pas considérer la fonction pure comme une authentification serveur.

### A-03 — Le module de clôture n'interdit pas un auteur présent dans son propre instantané

**Niveau : ÉLEVÉ**

La validation de l'instantané dans `alert-lifecycle.ts` rejette les identifiants vides, dates invalides et doublons. Elle ne compare toutefois pas les destinataires à `authorAccountId`. Un enregistrement construit avec l'auteur dans `recipientSnapshot` peut donc passer la validation de cette fonction.

La matrice relationnelle prévoit un contrôle non-auteur pour les destinataires, mais ce contrôle n'est pas démontré par le module pur examiné.

**Exigence avant implémentation :** la sélection serveur doit exclure explicitement le compte auteur ; le schéma doit imposer autant que possible cette règle ; ajouter un test négatif au contrat de domaine et un test d'intégration D1. Ne jamais compter uniquement sur l'interface pour empêcher l'auto-destinataire.

### A-04 — Les paramètres métier du SOS ne sont pas validés par le contrat de cycle de vie examiné

**Niveau : ÉLEVÉ**

Le module de clôture ne porte pas les champs de catégorie, d'urgence, de mode de déclenchement ni les limites de destinataires. Cela est cohérent avec son périmètre actuel, mais aucune preuve ne doit être déduite de ses tests concernant ces paramètres.

**Exigence avant implémentation :** valider côté serveur les catégories et niveaux autorisés, les limites de l'offre, le nombre de destinataires, l'état actif des relations et les préférences applicables. Les valeurs inconnues, les dépassements et les combinaisons incohérentes doivent être refusés sans mutation.

### A-05 — La cohérence D1 et l'idempotence restent des prérequis non démontrés

**Niveau : BLOQUANT**

Le contrat D1 explique correctement qu'un `batch()` résolu ne garantit pas le succès métier : une instruction qui affecte zéro ligne n'est pas une erreur SQL. Il exige aussi une clé d'idempotence liée à l'acteur et au type de commande, avec rejet d'une même clé réutilisée pour un contenu différent.

Cependant, le format, la portée, la durée et la persistance de cette idempotence restent à définir. Aucun test D1 de création alerte + destinataires + événement + outbox n'est présent dans les fichiers examinés.

**Exigence avant implémentation :**
- choisir une clé opaque, limitée au compte et à la commande, avec empreinte du contenu canonique ;
- retourner le résultat déjà enregistré lors d'une répétition identique ;
- refuser une clé réutilisée avec un contenu différent ;
- concevoir la transaction pour que chaque écriture dépend réellement des préconditions et que les résultats affectés soient vérifiés ;
- démontrer le rollback en cas d'échec intermédiaire et la concurrence de deux déclenchements ;
- vérifier qu'aucune tâche outbox orpheline ni notification en double n'est créée.

### A-06 — L'instantané des destinataires est un invariant métier, pas encore une preuve d'autorisation serveur

**Niveau : BLOQUANT**

Les contrats décrivent correctement une liste figée au déclenchement, issue des relations actives, des préférences et des limites de l'offre. Les rappels doivent viser cette liste initiale ; une modification ultérieure des contacts ne doit pas la réécrire.

Le type `TriggeredAlertRecord` et les tests de clôture ne prouvent toutefois pas que cette liste a été sélectionnée depuis D1 dans un état cohérent, ni que chaque contact était éligible à l'instant de la transition finale.

**Exigence avant implémentation :**
- sélectionner les relations actives et préférences côté serveur ;
- ordonner cette lecture avec la création de l'alerte dans une opération cohérente ;
- enregistrer l'instantané initial de façon immuable ;
- refuser le déclenchement ou appliquer une règle produit explicitement validée lorsqu'aucun destinataire n'est éligible ;
- ne jamais afficher « alerte envoyée » si aucun destinataire n'a été sélectionné.

### A-07 — La fonction d'éligibilité des rappels ne remplace pas le contrôle d'accès ni le worker

**Niveau : ÉLEVÉ**

`isReminderEligible()` vérifie seulement que l'alerte est active et que le compte figure dans l'instantané fourni. Elle ne vérifie ni l'identité de la requête, ni les droits de lecture, ni l'état de l'abonnement push, ni l'appareil, ni l'existence d'une tâche planifiée, ni l'état du fournisseur.

**Exigence avant implémentation :** le worker doit revalider la tâche, son bail, l'état de l'alerte et le destinataire juste avant l'envoi. Les tâches doivent être dédupliquées par alerte, destinataire, canal et occurrence. Les états « accepté par fournisseur », « livré » et « lu » doivent rester distincts.

### A-08 — Les réponses et la responsabilité sont testées en mémoire, pas en concurrence D1

**Niveau : ÉLEVÉ**

`alert-responses.ts` distingue correctement accusé, volontariat et retrait. Il utilise une séquence serveur plutôt qu'une heure client et maintient au plus une responsabilité ouverte dans l'état fourni.

Ces garanties sont calculées sur un objet mémoire. Elles ne prouvent pas que deux requêtes concurrentes ne peuvent pas obtenir le même rang, créer deux responsabilités ouvertes ou perdre un transfert dans D1. La fonction reçoit aussi `actorAccountId` en paramètre : le serveur doit le dériver de la session, jamais du corps.

**Exigence avant implémentation :** contrainte unique pour le responsable courant, séquence attribuée par le serveur dans une opération sérialisée/atomique, contrôles d'accès D1 et tests de concurrence entre volontaires, retraits, clôture et révocation.

### A-09 — La politique « aucun destinataire » et la révocation pendant une alerte restent ouvertes

**Niveau : BLOQUANT PRODUIT**

Les documents signalent déjà que le comportement d'une alerte sans destinataire n'est pas arbitré. Les droits d'un contact révoqué sur le détail, les réponses et le partage GPS restent également à valider, même si l'instantané initial et les rappels initiaux ne doivent pas être réécrits.

**Exigence avant implémentation :** trancher explicitement ces politiques. Ne pas inventer une règle dans le code, et ne pas confondre maintien des rappels initiaux avec maintien automatique de tous les droits d'accès.

### A-10 — Les tests existants ne prouvent pas l'intégration ni l'exploitation réelle

**Niveau : BLOQUANT**

Les suites examinées couvrent les transitions pures de clôture, de réponses et d'autorisation de session. Elles ne démontrent pas les routes Pages Functions, les lectures/écritures D1, l'outbox, les workers, la livraison push/SMS, les délais réels ni l'isolation Preview/Production.

**Exigence avant activation :** tests d'intégration sur D1 local puis Preview isolé, tests adversariaux et de concurrence, preuve des limites fournisseur et revue de sécurité indépendante. Les tests ne doivent jamais cibler la base de production.

## 4. Invariants à conserver sans exception

1. L'auteur est identifié exclusivement depuis une session serveur vérifiée.
2. Un identifiant d'alerte ou de compte fourni par le client n'est jamais une preuve d'autorisation.
3. Le compte, l'appareil, la session, le certificat et les versions de révocation sont contrôlés à chaque requête protégée.
4. L'auteur ne figure jamais parmi les destinataires de sa propre alerte.
5. Les destinataires sont sélectionnés côté serveur, puis figés.
6. Alerte, destinataires, événement initial, outbox et idempotence ne doivent pas produire d'état partiel.
7. Une répétition réseau ne crée pas une deuxième alerte.
8. Seul l'auteur clôture l'alerte ; annuler après déclenchement est une clôture avec motif conservé.
9. Accusé de réception et prise en charge ne stoppent pas les rappels.
10. Les rappels ciblent les destinataires initiaux et cessent d'être planifiés à la clôture.
11. Aucun GPS précis ne doit être ajouté à D1, aux événements, à l'outbox ou aux logs tant que la preuve de destruction irréversible J+30 n'est pas validée.
12. Une acceptation du fournisseur ne doit jamais être présentée comme une livraison ou une lecture confirmée.

## 5. Plan de remédiation ordonné

### Étape 1 — Arbitrages produit bloquants
- décider du comportement lorsqu'aucun destinataire n'est disponible ;
- valider les droits d'un contact révoqué pendant et après une alerte active ;
- confirmer les limites et paramètres autorisés du déclenchement.

### Étape 2 — Contrat serveur de déclenchement
- définir l'identité serveur et les préconditions relues depuis D1 ;
- définir sélection et instantané des destinataires ;
- définir idempotence et résultat métier ;
- définir la transaction alerte/instantané/événement/outbox ;
- définir les erreurs métier et les messages affichés au citoyen.

### Étape 3 — Preuves D1 isolées
- création normale et absence de destinataire ;
- double-tap et répétition après perte de réponse ;
- révocation d'un appareil ou contact concurrente au déclenchement ;
- échec provoqué à chaque étape d'écriture et vérification du rollback ;
- deux workers concurrents, bail expiré et résultat fournisseur ambigu ;
- contrôle d'accès inter-comptes et destinataire non sélectionné ;
- clôture simultanée à la planification d'un rappel.

### Étape 4 — Revue avant activation
- revue indépendante du modèle d'authentification et du protocole multi-appareils ;
- vérification des fournisseurs et des limites de livraison ;
- tests sur appareils/réseaux représentatifs ;
- validation de l'isolation Preview/Production ;
- décision explicite de mise en service distincte.

## 6. Décision finale

**NO-GO — le SOS doit rester désactivé.**

Ce dépôt contient des contrats métier utiles et des tests unitaires ciblés, mais pas encore la preuve d'un déclenchement serveur authentifié, atomique, idempotent et réellement transmis. La prochaine réalisation ne doit pas être une interface qui donne l'impression que l'alerte est partie : elle doit d'abord apporter les garanties serveur et les preuves D1 ci-dessus.

Aucune route, migration, table, donnée GPS, ressource Cloudflare, intégration fournisseur ou activation SOS n'est créée par cet audit.
