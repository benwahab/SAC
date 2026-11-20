# SAC — Proposition de suivi Web Push par appareil

**Date :** 19 novembre 2026  
**Statut :** arbitrage partiel validé le 20 novembre 2026 ; la règle de reprise est approuvée, mais les autres points de conception restent ouverts. Aucun changement SQL distant ni déploiement Worker n'est autorisé par ce document.  
**Périmètre :** reprise fiable des notifications Web Push lorsqu'un même compte SAC est connecté sur plusieurs appareils.

## 1. Décision produit déjà validée

Un compte SAC peut être connecté simultanément sur plusieurs appareils. Chaque appareil possède sa session et son abonnement Push indépendants. La révocation d'un appareil ne révoque pas les autres.

Cette règle produit n'autorise pas à elle seule une modification du cycle des alertes, des durées de session, du renouvellement des jetons ou du schéma D1.

## 2. État actuel vérifié dans le dépôt

Fichiers examinés :
- `functions/lib/alerts/sos-service.ts`
- `functions/lib/notifications/web-push-delivery.ts`
- `migrations/0004_sos_reminder_leases.sql`
- `migrations/0008_push_subscriptions.sql`
- `workers/sos-notification-delivery/index.ts`
- `tests/web-push-delivery.test.ts`

Comportement observé :
1. L'outbox SOS contient une tâche par alerte, destinataire et numéro de rappel, et non une tâche par appareil.
2. Le Worker réclame la tâche destinataire avec un bail D1, puis le transport charge les abonnements actifs de tous les appareils actifs du compte.
3. Le transport envoie séquentiellement vers chaque abonnement.
4. Il ne persiste pas de résultat distinct pour chaque abonnement.
5. Il renvoie un succès global seulement si au moins un appareil a accepté et si tous les autres résultats sont résolus (acceptés ou abonnements invalides supprimés).
6. Si un appareil accepte et qu'un autre rencontre une erreur temporaire, le résultat global échoue et la tâche destinataire peut être reprise. L'appareil déjà accepté peut alors recevoir un doublon.
7. Si le fournisseur accepte mais que l'enregistrement final dans D1 échoue ou que le bail expire, la reprise peut également renvoyer le même rappel. Le transport Web Push ne fournit pas ici de mécanisme d'idempotence fournisseur garanti.
8. Le service SOS applique actuellement jusqu'à cinq tentatives par tâche destinataire, avec des délais progressifs plafonnés à cinq minutes. Ce mécanisme reste une reprise « au moins une fois », pas une garantie « exactement une fois ».

La réponse positive d'un fournisseur signifie seulement que le fournisseur a accepté la requête ; elle ne prouve ni affichage ni lecture.

## 3. Problème à résoudre

L'unité de suivi actuelle est le destinataire, alors que l'unité réelle de transport est l'abonnement d'un appareil.

Il faut pouvoir répondre durablement, pour chaque tâche de rappel :
- quels appareils étaient éligibles au moment de la tentative ;
- quels abonnements ont été acceptés ;
- quels abonnements sont devenus invalides ;
- quels résultats sont temporaires ;
- quels résultats sont ambigus parce que la réponse fournisseur a été perdue ;
- quels appareils ont été révoqués avant une tentative ou entre deux tentatives.

Sans ces résultats persistants, une reprise globale ne peut pas éviter les renvois aux appareils déjà acceptés.

## 4. Modèle cible proposé

Conserver `notification_outbox` comme unité métier de rappel (alerte + destinataire + numéro), et ajouter une unité technique de livraison par abonnement/appareil.

Relations conceptuelles :

```
notification_outbox
  └── notification_device_deliveries
        ├── une ligne par abonnement/appareil ciblé
        └── notification_delivery_attempts
              └── historique minimal des tentatives
```

Ces noms sont des noms de travail, pas des tables approuvées.

### 4.1 Livraison par appareil

Chaque ligne de livraison devrait référencer :
- l'identifiant de la tâche outbox ;
- l'identifiant du compte destinataire ;
- l'identifiant de l'appareil ;
- l'identifiant de l'abonnement Push ;
- un instantané technique minimal permettant de ne jamais cibler un autre compte ;
- l'état de livraison ;
- les dates de création, dernière tentative et dernière transition ;
- un bail/jeton de réservation si une tentative est en cours ;
- un code d'erreur technique normalisé, sans endpoint, clé, payload ni donnée personnelle.

États proposés :
- `pending` : livraison enregistrée, aucune tentative terminée ;
- `processing` : tentative réservée par un Worker avec bail valide ;
- `accepted` : le fournisseur a explicitement accepté la requête ;
- `permanent_failure` : échec définitif confirmé, par exemple abonnement invalidé ;
- `retry_wait` : échec temporaire confirmé, nouvelle tentative possible ;
- `unknown` : résultat ambigu (timeout, coupure ou réponse perdue) ; ne pas prétendre que le fournisseur a accepté ou refusé.

Les états `accepted` et `permanent_failure` sont terminaux pour cette livraison. `unknown` ne doit pas être transformé silencieusement en succès ou en échec certain.

### 4.2 Tentatives

Une tentative doit être réservée atomiquement avant l'appel réseau. Son résultat doit être enregistré séparément de la tâche métier.

L'historique ne devrait conserver que :
- identifiants internes de tâche, appareil et abonnement ;
- numéro de tentative ;
- début et fin ;
- résultat normalisé ;
- code fournisseur autorisé et expurgé ;
- durée technique si utile.

Ne jamais conserver :
- endpoint Push en clair ;
- clés `p256dh` ou `auth` ;
- payload complet ;
- GPS, description libre ou contenu privé de l'alerte ;
- réponse brute du fournisseur si elle peut contenir des données sensibles.

### 4.3 Déroulement cible

1. Le Worker réclame une tâche outbox avec un bail.
2. Il vérifie que l'alerte est toujours active et que le destinataire appartient toujours à l'instantané initial.
3. Il récupère les appareils et abonnements actifs, en excluant ceux déjà traités pour cette tâche.
4. Il crée ou retrouve une ligne de livraison par appareil, de façon idempotente.
5. Avant chaque envoi, il revalide en base le compte, l'appareil et l'abonnement. Un appareil révoqué ne reçoit aucune nouvelle tentative.
6. Il réserve atomiquement la livraison et enregistre le début de tentative.
7. Il envoie le Web Push sans redirection, après contrôle de l'endpoint et déchiffrement en mémoire.
8. Il enregistre le résultat individuel :
   - acceptation fournisseur → `accepted` ;
   - abonnement expiré/invalide → `permanent_failure` et suppression de l'abonnement selon la règle existante ;
   - refus temporaire explicite → `retry_wait` ;
   - résultat réseau ambigu → `unknown`.
9. La tâche outbox est considérée traitée lorsque toutes les livraisons connues sont dans un état terminal, ou lorsqu'une politique explicite de traitement des résultats ambigus est appliquée.
10. Les rappels suivants restent des tâches métier distinctes, planifiées selon le cycle SOS validé. Le suivi par appareil d'un rappel ne doit pas modifier le nombre de rappels choisi par le lanceur.

## 5. Invariants de sécurité et de concurrence

- Une livraison ne peut jamais être transférée à un autre compte, destinataire ou appareil.
- Une ligne de livraison est unique pour une tâche outbox et un abonnement déterminé.
- Une livraison `accepted` n'est jamais renvoyée par une reprise de la même tâche.
- Une livraison `permanent_failure` n'est pas réessayée.
- Une livraison `processing` n'est récupérable qu'après expiration de son bail.
- Un ancien Worker ne peut pas écraser le résultat d'un Worker ayant acquis un nouveau bail.
- La révocation d'un appareil empêche tout nouvel envoi vers ses abonnements, même si une tâche outbox existe encore.
- La clôture de l'alerte empêche de nouvelles tentatives ; les résultats déjà obtenus restent des faits techniques, sans réouverture de l'alerte.
- Une acceptation fournisseur ne devient jamais « livré », « affiché » ou « lu ».
- Aucun résultat de transport ne modifie la responsabilité humaine ou l'état métier du SOS.
- La livraison multi-appareils reste « au moins une fois » face aux résultats réseau ambigus ; ne pas annoncer « exactement une fois ».

## 6. Points à arbitrer avant toute migration

Aucune valeur ne doit être inventée pour ces points :
1. durée de conservation des livraisons et tentatives ;
2. nombre maximal de tentatives par appareil ;
3. délais et plafond de reprise par appareil ;
4. traitement final des résultats `unknown` : attente, nouvelle tentative avec risque de doublon, ou arrêt après une limite ;
5. règle de clôture de la tâche outbox si un appareil reste durablement inconnu ;
6. comportement si un abonnement est renouvelé sur le même appareil pendant une tâche en cours ;
7. plafond d'appareils/abonnements par compte ;
8. purge des journaux techniques et preuve d'absence de données sensibles.

La politique existante de cinq tentatives au niveau destinataire ne doit pas être copiée automatiquement au niveau appareil : ces deux unités n'ont pas la même sémantique.

## 7. Plan de réalisation après arbitrage

1. Valider les états, l'idempotence, la conservation et le traitement de `unknown`.
2. Mettre à jour la matrice de traçabilité D1 et les contrats d'opérations atomiques.
3. Concevoir les contraintes SQL, index, clés étrangères et triggers.
4. Ajouter la migration D1 seulement après validation explicite.
5. Adapter le transport et le Worker pour persister chaque résultat par appareil.
6. Ajouter les tests de concurrence, révocation pendant livraison, acceptation partielle, réponse perdue, bail expiré et reprise sans renvoi des appareils acceptés.
7. Garder l'envoi réel désactivé tant que la configuration et l'autorisation de mise en service ne sont pas accordées.

## 8. Limites de ce document

Cette proposition ne crée aucune table, migration, tâche, API ou ressource Cloudflare. Elle n'active aucun fournisseur et n'envoie aucune notification. Elle ne modifie ni le seuil SMS choisi par le lanceur, ni les rappels toutes les cinq minutes, ni les règles de clôture du SOS.
