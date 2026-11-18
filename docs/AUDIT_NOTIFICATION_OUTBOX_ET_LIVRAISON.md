# SAC — Audit de l'outbox et de la livraison des alertes

**Date :** 18 novembre 2026  
**Branche examinée :** `main`  
**Commit de base :** `e2e238c1b345063e927bf288b38e221441aa444b`  
**Statut :** audit de préparation ; aucun worker, fournisseur ou mécanisme de notification n'est créé ici.

## 1. Périmètre vérifié

Fichiers relus :
- `docs/CONTRATS_OPERATIONS_ATOMIQUES_D1.md`, notamment la section 9 sur l'outbox et les rappels ;
- `docs/MACHINES_ETATS_ET_CONSERVATION.md`, notamment les états d'outbox, les rappels et les abonnements push ;
- `docs/MATRICE_TRACABILITE_SCHEMA_D1.md`, lignes conceptuelles `notification_outbox`, `notification_attempts` et `push_subscriptions` ;
- `package.json` ;
- `wrangler.toml` ;
- `functions/api/health.ts`.

Chemins recherchés mais absents sur `main` :
- `src/domain/notification-outbox.ts`
- `src/domain/notification-lifecycle.ts`
- `tests/notification-outbox.test.ts`
- `docs/CONTRAT_OPERATIONS_NOTIFICATIONS.md`

Cette recherche ciblée ne prétend pas inventorier chaque fichier du dépôt. Elle suffit néanmoins à constater que les contrats examinés décrivent un mécanisme futur, sans module ou suite de tests d'outbox trouvés aux emplacements attendus.

## 2. Conclusion

**NO-GO pour toute promesse de notification fiable ou de SOS livré.**

Le contrat de conception est bien orienté : tâche persistée, bail, appel fournisseur hors transaction, résultat ambigu distinct, reprise et déduplication. Mais aucune preuve d'implémentation d'un worker, d'une planification périodique, d'un fournisseur ou d'une reprise n'a été trouvée dans le périmètre vérifié.

Le fichier `functions/api/health.ts` vérifie uniquement que D1 répond à `SELECT 1`. Ce contrôle ne prouve ni qu'une tâche peut être planifiée, ni qu'un worker la traite, ni qu'un push ou SMS est transmis.

Le `wrangler.toml` examiné déclare le binding D1 et la sortie Pages. Il ne documente aucun déclencheur planifié de notification. Le `package.json` ne déclare aucune commande de test dédiée à l'outbox ou à l'intégration d'un fournisseur.

## 3. Constats

### N-01 — Pas de preuve d'un worker de notification

**Niveau : BLOQUANT**

Les contrats spécifient des états `pending`, `processing`, `sent`, `retry_wait`, `failed_terminal` et `cancelled`, mais aucun worker ni code d'acquisition de tâche n'a été identifié dans le périmètre vérifié.

**À exiger avant implémentation :**
- acquisition conditionnelle et atomique d'une tâche ;
- bail unique avec identifiant de propriétaire et échéance serveur ;
- récupération contrôlée des baux expirés ;
- revalidation de l'alerte et du destinataire avant tout appel externe ;
- finalisation conditionnelle réservée au détenteur du bail ;
- aucune transaction D1 ouverte pendant l'appel réseau.

### N-02 — Aucun planificateur vérifié pour les rappels de cinq minutes

**Niveau : BLOQUANT**

La fréquence produit de cinq minutes est documentée. Aucun mécanisme planifié réel, aucune règle de rattrapage et aucun test d'horloge/scheduler n'ont été vérifiés.

**À exiger avant implémentation :**
- une occurrence déterministe par alerte, destinataire, canal et numéro de séquence ;
- calcul des prochaines échéances côté serveur, jamais depuis l'horloge du téléphone ;
- planification atomique avec l'état actif de l'alerte ;
- clôture qui empêche toute occurrence future, même si elle concurrence le scheduler ;
- rattrapage défini après indisponibilité du scheduler sans créer de rafale non maîtrisée ;
- limites d'envoi et budget de tentatives documentés.

L'intervalle de cinq minutes est une règle métier de planification, pas une garantie de livraison toutes les cinq minutes. Les limites des plateformes mobiles et des fournisseurs doivent être communiquées honnêtement.

### N-03 — Le résultat ambigu du fournisseur est le risque principal de doublon

**Niveau : BLOQUANT**

Le contrat identifie déjà le cas critique : le fournisseur peut avoir accepté un message alors que le worker perd la réponse. Un simple retry peut alors envoyer un doublon.

**À exiger avant implémentation :**
- transmettre une clé d'idempotence stable au fournisseur lorsqu'il le permet ;
- conserver un identifiant fournisseur non secret et un état de réconciliation ;
- distinguer `accepted`, `delivered`, `read`, `temporary_failure`, `permanent_failure` et `unknown` ;
- ne jamais reclasser automatiquement un résultat ambigu en échec certain ;
- définir une procédure de réconciliation avant retry ;
- documenter le cas où le fournisseur ne permet ni idempotence ni interrogation d'état.

Ne pas promettre « exactement une fois ». Selon les capacités du fournisseur, la garantie réaliste peut être au mieux une livraison au moins une fois avec déduplication, ou une livraison incertaine explicitement signalée.

### N-04 — L'état « sent » ne doit pas signifier « proche prévenu »

**Niveau : ÉLEVÉ**

Les documents distinguent correctement l'acceptation par le fournisseur de la lecture par le proche. L'interface ne doit pas effacer cette distinction.

**À exiger avant implémentation :**
- « demande reçue par SAC » uniquement après persistance confirmée ;
- « notification acceptée par le fournisseur » uniquement après réponse positive du fournisseur ;
- « livrée » seulement si un accusé de livraison fiable existe ;
- « vue/confirmée par le proche » uniquement après une action authentifiée du proche ;
- afficher séparément les erreurs et les destinataires non confirmés.

Un accusé de réception dans SAC est une déclaration du contact, pas une preuve que le téléphone a affiché une notification système.

### N-05 — Les rappels doivent rester indépendants des accusés et de la prise en charge

**Niveau : BLOQUANT MÉTIER**

Règle produit existante : les rappels initiaux continuent vers tous les destinataires figés toutes les cinq minutes jusqu'à clôture par l'auteur. Un accusé, une candidature volontaire ou une responsabilité principale ne les arrête pas.

**À exiger avant implémentation :**
- le scheduler ne consulte pas un simple booléen « quelqu'un a répondu » pour arrêter les rappels ;
- chaque occurrence vise uniquement l'instantané initial ;
- aucun nouveau contact n'est ajouté à une alerte active ;
- les tâches en attente sont annulées à la clôture ;
- les tâches déjà acceptées par un fournisseur sont signalées comme potentiellement encore livrables ;
- une révocation de contact ne supprime pas implicitement un rappel initial déjà prévu.

### N-06 — Révocation appareil, abonnement push et droits du contact doivent être revalidés

**Niveau : ÉLEVÉ**

La matrice prévoit un abonnement push lié à un appareil et révoqué avec celui-ci. Les droits détaillés d'un contact révoqué pendant une alerte restent néanmoins à arbitrer.

**À exiger avant implémentation :**
- vérifier le statut de l'appareil et de l'abonnement juste avant l'envoi ;
- invalider les abonnements d'un appareil révoqué ;
- ne pas utiliser un endpoint push comme preuve d'identité ou de réception ;
- séparer les tâches de rappel SOS des tâches de partage GPS ;
- appliquer la politique décidée pour le contact révoqué sans réécrire l'instantané ;
- exclure tout GPS précis et tout secret du payload outbox.

### N-07 — La rétention et la protection des données des tentatives sont incomplètes

**Niveau : BLOQUANT AVANT DONNÉES RÉELLES**

La matrice identifie les durées de conservation des tâches et tentatives comme non décidées. Une erreur fournisseur peut contenir des données sensibles si elle est enregistrée sans filtre.

**À exiger avant implémentation :**
- définir une durée distincte pour tâche, tentative, identifiant fournisseur et code d'erreur ;
- journaliser des codes d'erreur normalisés et bornés, pas des corps de requête/réponse bruts ;
- exclure numéro de téléphone, e-mail, token, endpoint push, contenu libre, coordonnées GPS et clés ;
- borner la taille des messages d'erreur et filtrer les exceptions ;
- définir purge et restauration sans contourner les exigences de conservation ;
- vérifier les logs de workers, observabilité et analytics.

### N-08 — Aucun test outbox/D1 ou fournisseur n'est actuellement démontré

**Niveau : BLOQUANT**

Le `package.json` examiné ne déclare pas de script `test:notifications` ou de test d'intégration outbox. Les suites de tests pures existantes ne prouvent pas la concurrence entre workers, la reprise, la livraison ou le rollback D1.

**Tests obligatoires avant activation :**
1. deux workers tentent d'acquérir la même tâche ;
2. bail expiré repris une seule fois ;
3. clôture simultanée au scheduler ;
4. révocation appareil simultanée à l'envoi ;
5. réponse fournisseur perdue après acceptation ;
6. erreur temporaire, permanente et limite de tentatives ;
7. doublon d'occurrence et réutilisation d'une clé d'idempotence ;
8. échec après écriture intermédiaire et vérification du rollback ;
9. rappel continu après accusé et prise en charge ;
10. arrêt des rappels futurs après clôture ;
11. absence de GPS, secrets et données personnelles dans payloads/logs ;
12. isolation vérifiée de la base Preview.

Les tests doivent être exécutés sur D1 local, puis sur Preview isolé par identifiant de base. Aucun test destructif ne cible Production.

## 4. Architecture minimale à spécifier avant le code

1. **Écriture métier :** création atomique de l'alerte, de l'instantané, de l'événement et des tâches initiales.
2. **Scheduler :** crée les occurrences périodiques de manière déterministe et idempotente.
3. **Worker :** acquiert un bail, revalide l'autorisation et l'état, appelle le fournisseur hors transaction, puis finalise conditionnellement.
4. **Réconciliation :** traite les réponses ambiguës avant une nouvelle tentative.
5. **Clôture :** bloque atomiquement la planification et annule les tâches non encore envoyées.
6. **Observabilité :** conserve uniquement les métadonnées minimales, sans GPS ni secrets.
7. **Interface :** exprime exactement le niveau de preuve disponible et ne prétend jamais qu'un message a été lu sans confirmation.

Le fournisseur push/SMS, les garanties de délai, les budgets de retry, les durées de conservation et le mécanisme de planification restent à choisir et valider séparément. Aucun fournisseur n'est supposé.

## 5. Décision finale

**NO-GO — aucune notification d'urgence ne doit être annoncée comme opérationnelle.**

Les documents de conception fournissent une bonne base, mais le worker, le scheduler, l'idempotence fournisseur, la réconciliation et les tests D1 ne sont pas démontrés dans le périmètre vérifié. La priorité est de spécifier et tester ces mécanismes avant toute interface qui pourrait laisser croire à un envoi réel.

Aucun worker, route, migration, fournisseur, secret, ressource Cloudflare, donnée GPS ou notification réelle n'a été créé par cet audit.
