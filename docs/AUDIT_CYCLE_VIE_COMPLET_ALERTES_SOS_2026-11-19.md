# Audit du cycle de vie complet des alertes SOS — 2026-11-19

## Périmètre et méthode

Audit en lecture seule du code présent sur `main` :
- `functions/api/alerts/index.ts`
- `functions/api/alerts/[alertId].ts`
- `functions/api/alerts/[alertId]/close.ts`
- `functions/api/alerts/[alertId]/events.ts`
- `functions/api/alerts/[alertId]/respond.ts`
- `functions/lib/alerts/sos-service.ts`
- `functions/lib/notifications/web-push-delivery.ts`
- `src/domain/alert-lifecycle.ts`
- `migrations/0003_alerts_sos.sql`
- `tests/alert-lifecycle.test.ts`

Aucun envoi Push/SMS, aucune création de compte, aucune migration distante, aucun changement de code ou de configuration n'a été effectué pendant cet audit. Les constats décrivent le code inspecté, pas une activation en production.

## Résumé exécutif

Le socle du cycle SOS est déjà structuré : création authentifiée, destinataires figés, journal append-only, réponses des destinataires, attribution du responsable principal, clôture réservée à l'auteur et file de rappels. Plusieurs protections importantes sont présentes.

L'audit identifie toutefois des points bloquants à corriger avant d'activer les notifications :
1. **Course entre clôture et envoi Push** : une ligne déjà réservée par le worker peut être envoyée après la clôture, car le sender ne revalide pas l'état de l'alerte juste avant chaque envoi.
2. **Risque de répétition partielle multi-appareils** : si un appareil accepte le Push et qu'un autre échoue, le résultat global est un échec et le rappel peut être rejoué vers l'appareil qui l'avait déjà accepté. Il n'existe pas encore de suivi durable par appareil.
3. **Exposition d'identifiants de participants** : la route de détail retourne le snapshot complet avec les identifiants de tous les destinataires à chaque participant autorisé. La route d'événements réduit les acteurs à « self » ou « participant », et la projection de responsabilité ne révèle pas l'identité du responsable. Les projections doivent être harmonisées avec le principe de minimisation.
4. **Idempotence concurrente incomplète de l'accusé de réception** : le contrôle préalable et l'insertion sont séparés et aucun index unique ne garantit un seul événement « acknowledged » par compte et alerte en cas de requêtes concurrentes.
5. **Escalade SMS** : le code crée des évaluations et tâches en base uniquement. Il ne réalise pas d'envoi SMS. Le critère d'escalade repose sur le statut des rappels au seuil choisi et l'existence d'une période de responsabilité.

## 1. Déclenchement et autorisation

- La création exige une session authentifiée liée à un appareil.
- La requête est protégée par le contrôle same-origin et une limite de taille JSON.
- L'auteur est pris depuis la session, jamais depuis le corps de la requête.
- Le service vérifie que chaque destinataire est un proche actif de l'auteur et que le compte destinataire est actif.
- Les doublons, l'auteur dans sa propre liste, les catégories/niveaux inconnus, les descriptions trop longues et les seuils hors plage sont rejetés.
- La migration ajoute une seconde protection SQL : auteur actif, destinataire proche actif au moment du déclenchement, destinataire différent de l'auteur.
- L'alerte, les destinataires, l'événement initial et les lignes initiales de l'outbox sont écrits dans un batch D1.

**Point de vigilance :** l'endpoint transmet actuellement `recipientLimit: 2` en dur alors que le contrat produit général prévoit jusqu'à 10 proches. Ce point doit être rapproché de la règle d'éligibilité/abonnement réellement validée avant toute activation. Ne pas remplacer arbitrairement cette valeur sans confirmer le modèle de droits applicable.

## 2. Snapshot des destinataires et confidentialité

- `alert_recipients` constitue un snapshot immuable : les triggers SQL interdisent UPDATE et DELETE.
- Une révocation ultérieure du lien de confiance ne réécrit pas l'historique de l'alerte déjà déclenchée.
- Les lectures de liste, détail, événements et responsabilité vérifient l'identité de l'auteur ou l'appartenance au snapshot.
- Les événements sont présentés dans la route comme « self » ou « participant », sans exposer les identifiants d'acteurs tiers.
- La projection de responsabilité ne renvoie que `assigned` et `isSelf`.

**Écart constaté :** `getSosAlertForParticipant` construit `recipientSnapshot` avec tous les `recipient_account_id` et la route de détail renvoie cet objet directement. Cela révèle à chaque participant les identifiants internes des autres destinataires. Même si ces identifiants ne sont pas des coordonnées personnelles, cette exposition n'est pas nécessaire pour afficher le résumé SOS. Recommandation : renvoyer au client une projection minimale (nombre de proches, éventuellement statut de participation), et réserver les identifiants internes aux opérations serveur. Si le besoin « accès aux coordonnées des proches » est maintenu, créer un contrat distinct, explicite et limité aux seules informations de contact nécessaires.

Le payload Push inspecté est volontairement minimal : `{ version: 1, kind: "private_sos" }`. Il ne contient ni description, ni coordonnées GPS, ni identité du lanceur d'alerte.

## 3. Accusé de réception, volontariat et responsable principal

- Seuls les comptes présents dans le snapshot peuvent répondre.
- L'accusé de réception est enregistré dans `alert_events`.
- Le volontariat est ordonné par un numéro de séquence généré côté D1, pas par un horodatage fourni par le client.
- Une seule période de responsabilité ouverte est autorisée par alerte grâce à un index unique partiel.
- Une prise en charge exige un événement de volontariat correspondant.
- Un proche qui s'est déjà retiré ne peut pas se porter volontaire une seconde fois.
- Lorsqu'un responsable se retire, le service ferme sa période et cherche le volontaire encore éligible ayant le plus petit numéro de séquence. Il lui attribue automatiquement la responsabilité si aucun autre responsable n'est déjà actif.
- Si aucun autre volontaire éligible n'existe, aucune responsabilité principale n'est ouverte.

Cela correspond au principe validé : si le responsable principal se retire, le prochain volontaire disponible devient automatiquement responsable.

**Point à durcir :** l'accusé de réception utilise un `INSERT ... WHERE NOT EXISTS`, mais sans contrainte unique dédiée sur `(alert_id, actor_account_id)` pour le type `acknowledged`. Deux requêtes concurrentes peuvent franchir simultanément le contrôle. Ajouter une garantie SQL d'unicité ou une insertion idempotente atomique dédiée avant activation.

## 4. Clôture et annulation par l'auteur

- Seul l'auteur authentifié peut clôturer l'alerte.
- Deux motifs sont acceptés : `completed` et `cancelled`.
- La transition n'est possible que depuis `active`.
- L'événement de clôture est ajouté au journal.
- La période de responsabilité ouverte est terminée.
- Le trigger SQL passe les rappels `pending` et `processing` à `cancelled`.
- Les lectures de détail restent accessibles à l'auteur et aux destinataires après clôture ; les réponses et rappels exigent une alerte active.

**Course critique à corriger :** le worker peut avoir déjà réclamé une ligne et obtenu un lease avant que l'auteur ne clôture l'alerte. Le trigger marque ensuite la ligne `cancelled`, mais `dispatchDueSosReminders` appelle le sender sans relecture de l'état de l'alerte ni vérification du lease juste avant l'envoi. Un Push peut donc partir après l'annulation si la clôture intervient dans cette fenêtre. Il faut ajouter une vérification serveur juste avant chaque envoi et une stratégie de coordination qui ferme autant que possible cette fenêtre. Il faut documenter qu'une requête déjà acceptée par le service Push externe ne peut pas être rappelée.

## 5. Rappels Push et reprises

- Le rappel initial porte le numéro 0.
- Les rappels numérotés sont espacés de cinq minutes.
- Le nombre choisi par l'utilisateur représente le seuil d'escalade SMS, pas la fin de l'alerte.
- Les rappels continuent tant que le SOS reste actif, indépendamment du seuil.
- Les tâches sont réservées par lease, avec reprise après expiration et limite de cinq tentatives.
- Une erreur de livraison est réessayée avec un délai progressif plafonné à cinq minutes.
- La fermeture annule les tâches encore en attente ou en cours dans la base.

Le sender Web Push cible les abonnements actifs des appareils actifs de comptes actifs. Les abonnements déclarés expirés (404/410) sont supprimés. Les autres erreurs, erreurs de déchiffrement et problèmes de persistance conduisent à un résultat global non résolu.

**Risque multi-appareils confirmé :** le sender parcourt plusieurs abonnements, mais ne persiste pas un résultat indépendant par appareil. Si un appareil reçoit une acceptation du fournisseur et qu'un autre échoue, le sender retourne `false`. L'outbox peut alors réessayer l'ensemble et renvoyer un Push à l'appareil déjà accepté. Le mécanisme ne garantit donc pas une livraison exactement une fois, ni une reprise propre par appareil. La proposition de suivi par appareil déjà documentée doit être traitée avant activation.

Une acceptation HTTP du fournisseur Push signifie que le fournisseur a accepté la requête, pas que l'appareil a affiché ou que la personne a lu la notification.

## 6. Escalade SMS

- Le seuil est calculé à partir de l'heure de déclenchement et du nombre de rappels Push choisi, par pas de cinq minutes.
- L'évaluation n'est créée que lorsque toutes les lignes de rappel correspondant au numéro seuil sont en statut `sent` ou `failed`.
- Si une période de responsabilité existe, l'évaluation est `suppressed`.
- Sinon, l'évaluation est `queued` et des tâches SMS sont créées pour les destinataires du snapshot initial.
- L'implémentation inspectée ne contacte aucun fournisseur SMS : elle ne fait que persister des tâches.

**Point de décision à clarifier avant implémentation SMS :** le critère « tous les destinataires ont une tâche seuil sent ou failed » ne mesure pas une prise de connaissance réelle. De plus, une tâche SMS est créée pour chaque destinataire initial, pas seulement pour un contact qui n'aurait pas reçu le Push. Le futur contrat SMS doit définir explicitement le destinataire, les conditions de déclenchement, l'idempotence, la révocation, les limites de coût et l'annulation à la clôture. Aucun envoi SMS réel ne doit être activé avant cette validation.

## 7. GPS et données sensibles

Les fichiers examinés dans ce périmètre ne stockent pas de coordonnées GPS dans la table `alerts` ni dans le payload Push. Cet audit ne prouve toutefois pas le cycle de vie complet d'une éventuelle localisation stockée ailleurs, ni l'effacement irréversible après 30 jours dans les sauvegardes et D1 Time Travel. Cette exigence reste un **no-go indépendant** : aucune activation de GPS précis avant preuve technique et documentaire de la suppression irréversible.

## 8. Plan de correction priorisé

### P0 — avant activation Push/SOS
1. Revalider l'état de l'alerte et la validité du lease juste avant chaque envoi ; empêcher au maximum l'envoi après clôture.
2. Mettre en place la traçabilité de livraison par appareil, avec traitement explicite des états acceptés, échec permanent, nouvelle tentative et résultat inconnu.
3. Réduire la projection du détail SOS afin de ne pas exposer les identifiants internes des autres destinataires.
4. Garantir l'unicité/idempotence concurrente des accusés de réception.
5. Vérifier et harmoniser la limite des destinataires (2 dans l'endpoint actuel contre 10 dans le besoin produit général).

### P1 — avant activation SMS
1. Valider le sens exact du seuil et les conditions d'escalade.
2. Définir quels proches reçoivent le SMS et comment les Push déjà acceptés sont pris en compte.
3. Ajouter annulation, reprise, idempotence et audit des tâches SMS.
4. Ne pas considérer une acceptation fournisseur comme une livraison ou une lecture.

### P0 indépendant — GPS
Prouver l'effacement irréversible des coordonnées précises au bout de 30 jours, y compris sauvegardes et Time Travel, avant toute activation GPS.

## Conclusion

Le cycle métier de base est présent et plusieurs invariants sont bien protégés par D1. Il n'est cependant pas prêt à être activé avec des notifications réelles. Les priorités sont la course clôture/envoi, le suivi de livraison par appareil, la minimisation des données retournées et l'idempotence de l'accusé de réception. L'escalade SMS reste une file de tâches sans fournisseur d'envoi actif. Aucun changement de code ou de base n'a été effectué dans le cadre de cet audit.
