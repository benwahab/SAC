# SAC — Architecture technique du Web Push par appareil

**Version :** 1.0 — 20 novembre 2026  
**Statut :** conception technique consolidée ; règles produit de reprise validées ; implémentation, migration D1 et mise en service non réalisées.  
**Dépôt :** `benwahab/SAC`, branche `main`.  
**Portée :** fiabiliser chaque livraison Web Push par appareil, sans modifier le cycle métier SOS ni activer l'envoi réel.

> Ce document décrit la cible technique. Il n'autorise ni migration distante, ni création/déploiement de Worker ou Workflow, ni dépense, ni activation d'envois réels.

## 1. Décisions produit verrouillées

Pour chaque abonnement/appareil et pour chaque rappel distinct :

1. Deux appels réseau maximum : un envoi initial et au plus une reprise.
2. La reprise intervient 15 secondes après un résultat ambigu ou un échec temporaire confirmé.
3. Une acceptation explicite du fournisseur arrête immédiatement les tentatives de cet appareil pour ce rappel.
4. Un abonnement invalide est terminal et n'est pas réessayé.
5. Après le second appel, un résultat encore ambigu devient `unknown_exhausted` (« résultat inconnu après 2 tentatives »).
6. Aucun troisième appel n'est permis pour ce rappel/appareil.
7. Les autres appareils du destinataire continuent indépendamment.
8. Les rappels suivants restent indépendants et gardent leur cadence métier.
9. Le statut inconnu épuisé ne bloque pas l'évaluation ni la file SMS déjà prévue et ne change pas le seuil choisi par le lanceur.
10. Si le SOS est clôturé pendant l'attente de 15 secondes, la reprise est annulée.
11. « Accepté » signifie uniquement que le fournisseur a accepté la requête ; cela ne prouve pas la livraison au téléphone, l'affichage ou la lecture.

Le risque d'un doublon est accepté uniquement lorsqu'une réponse réseau est perdue après que le fournisseur a éventuellement accepté le premier appel. Ce risque est limité à une seule reprise.

## 2. Audit de l'existant

Fichiers contrôlés sur `main` :

- `functions/lib/alerts/sos-service.ts`
- `functions/lib/notifications/web-push-delivery.ts`
- `migrations/0004_sos_reminder_leases.sql`
- `migrations/0008_push_subscriptions.sql`
- `workers/sos-notification-delivery/index.ts`
- `workers/sos-notification-delivery/wrangler.toml`
- `tests/web-push-delivery.test.ts`

Constats vérifiés :

- `alert_reminder_outbox` est une file métier par alerte, destinataire et numéro de rappel.
- Le bail D1 et le compteur actuels protègent cette tâche destinataire, avec jusqu'à cinq tentatives.
- Le transport charge les abonnements actifs du compte et les traite séquentiellement.
- Le résultat du transport est un booléen global ; il ne persiste pas l'état de chaque abonnement.
- Une acceptation sur un téléphone peut donc être suivie d'une reprise globale causée par un autre téléphone, avec risque de renvoyer le même rappel au premier.
- Le Worker actuel est planifié à la minute. Un Cron à la minute ne garantit pas une reprise à 15 secondes.
- La clôture du SOS annule déjà les lignes de rappel en attente/en traitement au niveau outbox ; le transport revérifie aussi l'état actif avant l'appel réseau.
- Le code SMS actuel ne contacte aucun fournisseur : il crée uniquement des tâches dans `alert_sms_outbox`.
- L'évaluation SMS considère les rappels du seuil terminés lorsque les lignes destinataire correspondantes sont `sent` ou `failed`.

## 3. Architecture cible

### 3.1 Séparer orchestration métier et transport technique

Conserver :

- `alert_reminder_outbox` : source de vérité métier pour le rappel d'un destinataire ;
- `alert_sms_escalations` et `alert_sms_outbox` : mécanisme SMS existant, sans intégration fournisseur dans ce chantier.

Ajouter, après validation et migration :

- `notification_device_deliveries` : une ligne par tâche outbox et abonnement Push ciblé ;
- `notification_delivery_attempts` : une ligne par appel réseau réservé, avec résultat technique minimal.

Relations :

```
alert_reminder_outbox
  └── notification_device_deliveries
        └── notification_delivery_attempts (0, 1 ou 2)
```

D1 demeure la source de vérité. Cloudflare Workflows orchestre l'attente durable et les étapes ; son état interne n'est jamais la seule preuve du résultat d'un envoi.

### 3.2 Livraison par appareil

Champs conceptuels de `notification_device_deliveries` :

- identifiant interne ;
- `outbox_id` ;
- `alert_id` et `recipient_account_id` pour les contrôles de périmètre ;
- `device_id` ;
- `subscription_id` (identifiant technique seulement, sans endpoint ni clés) ;
- état courant ;
- compteur de tentatives réservé, borné strictement à 0..2 ;
- `next_attempt_at` ;
- jeton de bail et expiration ;
- dates de création et de dernière transition ;
- code d'erreur normalisé et expurgé.

Contrainte d'unicité : une seule livraison par couple `(outbox_id, subscription_id)`.

Ne pas ajouter de clé étrangère qui empêcherait de révoquer/supprimer un abonnement devenu invalide. L'identifiant historique de l'abonnement est conservé comme référence opaque ; juste avant chaque envoi, le Worker doit retrouver l'abonnement actif et vérifier qu'il appartient toujours au même compte et au même appareil.

États recommandés :

- `pending` : livraison enregistrée, aucun appel réservé ;
- `processing` : appel réservé, bail actif ;
- `retry_wait` : premier appel terminé par échec temporaire ou résultat ambigu ; attente de 15 secondes ;
- `accepted` : acceptation explicite du fournisseur ; terminal ;
- `permanent_failure` : abonnement invalidé ou refus définitif ; terminal ;
- `unknown_exhausted` : second appel effectué, résultat toujours ambigu ; terminal ;
- `cancelled` : alerte clôturée ou appareil/abonnement révoqué avant l'appel suivant ; terminal.

Un état terminal n'est jamais remis en attente pour le même rappel.

### 3.3 Historique des appels

`notification_delivery_attempts` conserve au maximum deux lignes par livraison :

- `delivery_id`, numéro 1 ou 2 ;
- identifiant interne de réservation ;
- heure de réservation, début et fin si disponibles ;
- résultat normalisé : `accepted`, `retry_wait`, `permanent_failure`, `unknown`, `cancelled` ;
- code HTTP fournisseur autorisé ou catégorie technique expurgée ;
- durée technique si utile.

Contrainte d'unicité : `(delivery_id, attempt_number)`.

Ne jamais enregistrer dans ce journal : endpoint Push, clés `p256dh`/`auth`, payload, contenu privé du SOS, description libre, GPS, jeton VAPID ou réponse brute du fournisseur.

Les secrets et l'abonnement déchiffré restent uniquement en mémoire pendant l'envoi.

## 4. Déroulement exact d'une livraison

### Étape A — Détection et fan-out

1. Le Worker planifié existant détecte les rappels destinataires dus.
2. Il réclame chaque ligne outbox avec son bail et son jeton de clôture, selon les protections D1 déjà présentes.
3. Il vérifie que l'alerte est active et que le destinataire figure dans le snapshot immuable de cette alerte.
4. Il prend un snapshot des abonnements actifs appartenant à des appareils actifs de ce destinataire.
5. Il crée de façon idempotente une livraison par abonnement actif. Une nouvelle souscription créée plus tard ne rejoint pas rétroactivement ce rappel ; elle sera éligible aux rappels suivants.
6. Si aucun abonnement n'est actif, le destinataire est considéré comme n'ayant aucun appareil Push éligible pour ce rappel ; il ne doit pas provoquer cinq cycles de reprises inutiles.

### Étape B — Réservation atomique du premier appel

Une opération D1 atomique doit :

- vérifier que l'alerte est toujours active ;
- vérifier que le compte, l'appareil et l'abonnement sont toujours actifs et liés entre eux ;
- vérifier que la livraison est `pending` ou `retry_wait` arrivée à échéance ;
- vérifier que le compteur est inférieur à deux ;
- incrémenter le compteur une seule fois ;
- passer à `processing` ;
- écrire le bail/jeton et l'entrée de tentative correspondante.

Une seule exécution peut obtenir cette réservation. Un second Worker ne doit jamais pouvoir réserver le même numéro de tentative.

### Étape C — Appel réseau

- Recharger l'abonnement actif à partir de son identifiant, vérifier son propriétaire et déchiffrer les clés en mémoire.
- Revalider l'état actif du SOS immédiatement avant l'appel externe.
- Conserver la politique actuelle de validation stricte des endpoints, sans redirection.
- Appliquer un timeout réseau strict de **8 secondes maximum** par appel fournisseur. Le timeout doit être appliqué au niveau du transport et testé ; il doit interrompre l'attente locale sans supposer que le fournisseur n'a pas reçu la requête.
- Ne pas laisser les retries automatiques de Cloudflare Workflows déclencher des appels Push supplémentaires. Les erreurs réseau doivent être converties en résultats normalisés ; le compteur D1, et lui seul, autorise le prochain appel.

Résultat :

- réponse 2xx : `accepted`, terminal ;
- réponse 404/410 ou abonnement définitivement invalide : `permanent_failure`, terminal et révocation/suppression selon les règles existantes ;
- refus temporaire confirmé : `retry_wait` si c'est le premier appel ;
- timeout, coupure ou réponse perdue : `retry_wait` si c'est le premier appel, car le résultat reste ambigu ;
- erreur définitive de configuration ou endpoint interdit : échec terminal, sans réessai réseau aveugle.

### Étape D — Attente durable et seconde tentative

Si le premier résultat est `retry_wait` :

1. D1 enregistre `next_attempt_at = première_fin + 15 secondes`.
2. Le Workflow exécute `step.sleep(..., "15 seconds")`.
3. À la reprise, il relit D1 ; il ne se fie pas seulement à son état en mémoire.
4. Si l'alerte est clôturée, l'appareil révoqué, l'abonnement remplacé/révoqué ou la livraison déjà terminale, il marque/maintient `cancelled` et n'appelle pas le fournisseur.
5. Sinon il réserve atomiquement la tentative 2.
6. La tentative 2 suit les mêmes contrôles.
7. Si elle est acceptée, état `accepted`. Si l'abonnement est invalide, `permanent_failure`. Si le résultat reste ambigu ou temporaire, état final `unknown_exhausted` : aucun troisième appel.

### Étape E — Résultat perdu ou bail expiré

- Le jeton de bail est un fencing token : seule l'exécution détenant le jeton courant peut modifier la livraison.
- La durée du bail de traitement est fixée à **30 secondes** à compter de la réservation atomique de l'appel. Elle couvre le timeout réseau de 8 secondes et laisse une marge pour la persistance du résultat et les retards d'exécution.
- Un ancien Worker ne peut pas écrire sur une réservation plus récente.
- Si une exécution s'interrompt après réservation et avant un résultat certain, la reprise ne rejoue jamais aveuglément le même numéro d'appel.
- Après expiration du bail de 30 secondes, l'état de la tentative inachevée est classé ambigu ; il consomme le numéro déjà réservé. Le Workflow attend ensuite jusqu'à l'échéance de reprise de 15 secondes calculée depuis la fin/constat d'ambiguïté, puis peut réserver la seconde tentative si elle reste autorisée.
- Si le second numéro avait déjà été réservé avant l'interruption, aucun troisième numéro ne peut être créé : état final `unknown_exhausted`.
- Une acceptation fournisseur déjà obtenue mais non persistée reste un cas de doublon potentiel lors de l'unique reprise ; ce risque est explicitement accepté par la règle produit.

## 5. Orchestration Cloudflare Workflows

### Rôle recommandé

Le Worker Cron existant reste le détecteur et le récupérateur. Il n'est plus responsable de mesurer les 15 secondes.

Un Workflow durable est déclenché par livraison appareil/rappel et exécute le cycle de cette seule livraison. Son identifiant doit être déterministe et opaque, dérivé d'un hash de `delivery_id` (pas d'identifiants personnels en clair). Le payload Workflow contient uniquement l'identifiant interne de livraison.

D1 reste l'autorité pour :

- l'éligibilité ;
- le compteur 0..2 ;
- le statut ;
- les baux ;
- la clôture ;
- le résultat final.

Le Workflow sert à dormir, reprendre et orchestrer ; il ne peut pas contourner les contrôles D1.

### Idempotence et récupération

- Le déclencheur utilise un identifiant d'instance stable pour la livraison.
- Un doublon « instance déjà existante » n'est pas traité comme une erreur métier ; l'orchestrateur vérifie l'instance et son statut.
- Si une instance a échoué alors que D1 indique une livraison non terminale, la récupération peut redémarrer/réconcilier l'instance, mais toujours après lecture D1.
- Le Cron périodique balaie les livraisons non terminales sans instance active ou dont le bail est expiré, puis relance l'orchestration de manière idempotente.
- Les limites de création d'instances et les erreurs 429 doivent être gérées avec une file de reprise ; aucun rappel ne doit être perdu si la création d'un Workflow échoue temporairement.
- Les appels réseau ne doivent pas être cachés dans un `step.do` qui peut être automatiquement rejoué sans contrôle D1. Désactiver les retries automatiques de l'étape réseau ou retourner un résultat normalisé sans lever d'exception pour les erreurs de transport.

### Pourquoi le Cron seul ne suffit pas

Le Cron actuel `* * * * *` ne s'exécute qu'à la minute. Il ne peut pas assurer une reprise exactement 15 secondes après le premier résultat. `step.sleep` de Workflows sait attendre en secondes et reprendre durablement.

## 6. Agrégation vers la file métier et compatibilité SMS

Les lignes par appareil sont indépendantes, mais la file métier reste une ligne par destinataire/rappel.

Règle d'agrégation proposée :

- si au moins un appareil de ce destinataire a l'état `accepted`, la ligne outbox destinataire devient `sent` ;
- si tous les appareils ciblés sont terminaux et qu'aucun n'est `accepted` (tous invalides, révoqués, annulés ou `unknown_exhausted`), la ligne outbox devient `failed` ;
- si aucun appareil n'était éligible, la ligne outbox devient terminale `failed` sans boucles de retry ;
- tant qu'un appareil est non terminal, l'agrégation attend, mais les autres appareils continuent.

Cette agrégation permet à la logique SMS existante de voir le rappel du destinataire comme terminé (`sent` ou `failed`) sans attendre indéfiniment un résultat inconnu. Elle ne change ni le seuil SMS, ni la décision de suppression SMS lorsqu'un responsable a pris en charge le SOS. Le SMS reste une tâche D1 en attente ; aucun fournisseur SMS n'est appelé par cette architecture.

## 7. Révocation, renouvellement et clôture

- Révoquer un appareil supprime déjà ses abonnements actifs via le trigger existant. La livraison historique est conservée et devient `cancelled` si aucun appel n'a été lancé ou si une reprise restait prévue.
- Un appel réseau déjà transmis ne peut pas être annulé rétroactivement.
- Un abonnement renouvelé sur le même appareil reçoit un nouvel identifiant. Il ne remplace pas la cible du rappel déjà fan-out ; le nouvel abonnement sera ciblé aux rappels suivants.
- Une clôture SOS annule les rappels en attente côté outbox. Le Workflow revérifie également l'état actif juste avant chaque appel. Si la clôture intervient après transmission de l'appel, aucun système ne peut rappeler le fournisseur pour annuler cette requête déjà partie.
- Une tâche de rappel terminée ne rouvre jamais l'alerte et ne change pas la responsabilité humaine.

## 8. Tests obligatoires avant mise en service

Tests D1/Workers/Workflow simulés, sans Push réel :

1. deux appareils : appareil A accepté, appareil B temporaire ; reprise de B seule ;
2. appareil A accepté : aucune reprise de A, même si B échoue ;
3. timeout initial : une reprise après 15 secondes, jamais avant ;
4. second résultat ambigu : `unknown_exhausted`, aucune troisième tentative ;
5. réponse 410 : `permanent_failure`, aucun nouvel appel ;
6. alerte clôturée pendant le sommeil : zéro second appel ;
7. appareil révoqué pendant le sommeil : zéro second appel ;
8. renouvellement d'abonnement pendant le sommeil : ancien abonnement annulé, nouveau abonnement réservé aux rappels suivants ;
9. deux Workers concurrents : un seul gagne chaque réservation ;
10. bail expiré et ancien Worker tardif : écriture tardive rejetée ;
11. fournisseur accepte puis D1 tombe : une seule reprise potentielle, puis arrêt ;
12. aucun appareil éligible : outbox terminale, sans cinq retries ;
13. appareils tous terminaux inconnus : outbox agrégée `failed`, SMS threshold évalué normalement ;
14. un appareil accepté + un appareil inconnu : outbox `sent`, aucune reprise de l'appareil accepté ;
15. création Workflow échouée/429/instance déjà existante : reprise Cron idempotente ;
16. rappels successifs : compteurs indépendants et cadence inchangée.

Les tests doivent aussi prouver que les journaux ne contiennent ni endpoint, ni clés Push, ni contenu privé, ni GPS.

## 9. Conservation et observabilité

### Décision validée

Les résultats techniques individuels de livraison par appareil et leurs tentatives sont conservés pendant **30 jours après la fin du rappel concerné**. Cette durée court à partir de la fin effective du cycle de rappel (tous les appareils ciblés sont dans un état terminal et l'outbox destinataire est agrégée), et non à partir de la création de la ligne.

À l'issue de ces 30 jours, les lignes individuelles `notification_device_deliveries` et `notification_delivery_attempts` doivent être purgées automatiquement. La purge doit être idempotente, contrôlable et testée ; elle ne doit pas dépendre d'une suppression manuelle.

Seules les données techniques minimales sont conservées pendant cette période : identifiants techniques internes nécessaires aux relations, statuts, dates, numéro de tentative et codes d'erreur normalisés/expurgés. Aucun endpoint Push, aucune clé `p256dh`/`auth`, aucun payload, aucun contenu SOS, aucune description libre, aucune donnée GPS, aucun secret et aucune réponse brute du fournisseur ne sont conservés dans ces tables.

La durée de 30 jours concerne uniquement ce registre technique par appareil et ses tentatives. Elle ne définit pas la conservation des dossiers SOS, des autres journaux SAC ou des données GPS, qui restent régis par leurs propres règles.

### Décision validée — Cloudflare Workflows

Les instances et historiques Cloudflare Workflow liés aux livraisons Push sont conservés **7 jours maximum après la fin de chaque exécution**. La politique d'exploitation doit configurer ou appliquer cette limite selon les capacités réelles du compte Cloudflare. Si la plateforme impose une rétention supérieure, SAC ne doit pas y stocker de contenu sensible et doit documenter cette limite avant activation.

Les historiques Workflow ne doivent contenir que des identifiants internes opaques, étapes, états, dates et erreurs techniques expurgées. Aucun contenu SOS, donnée personnelle non nécessaire, endpoint Push, clé d'abonnement, secret ou donnée GPS ne doit y être placé.

Cette durée est indépendante de la purge D1 des livraisons et tentatives individuelles à 30 jours. Elle ne remplace pas cette purge.

### Spécification opérationnelle — purge D1 automatique

**Périmètre strict :** seules les lignes du registre technique `notification_delivery_attempts` et `notification_device_deliveries` sont concernées. La purge ne touche jamais `alert_reminder_outbox`, les dossiers SOS, les comptes, les abonnements actifs, les données GPS, ni aucune autre table.

#### Déclenchement et cadence

- Utiliser le Cron du Worker de notification déjà prévu dans l'architecture, sans créer un service supplémentaire.
- Exécuter la purge une fois par heure, après le traitement normal des rappels, dans une étape isolée et protégée par `try/catch`.
- La purge ne doit jamais retarder, bloquer ou faire échouer le traitement des alertes et des rappels.
- Chaque exécution traite un lot borné (maximum **200 livraisons** par passage). Si le lot est plein, le passage suivant continue ; aucune suppression massive non bornée.
- Le mécanisme est idempotent : relancer le même passage ne doit ni altérer les résultats métier ni supprimer une donnée hors périmètre.

#### Point de départ des 30 jours

- Le début de conservation est la date de fin du cycle complet du rappel, lorsque toutes les livraisons appareil ciblées sont terminales et que la ligne outbox destinataire a été agrégée.
- À ce moment, enregistrer une seule fois un horodatage immuable `cycle_terminal_at` (ou équivalent) et calculer `retention_expires_at = cycle_terminal_at + 30 jours`.
- Une livraison appareil ne doit **pas** démarrer son délai de conservation dès qu'elle devient terminale si d'autres appareils du même rappel sont encore en cours.
- Une livraison sans appareil éligible doit être agrégée immédiatement et suivre la même règle de 30 jours à partir de cette agrégation.
- Une ligne non terminale, une ligne sans horodatage fiable ou une ligne dont l'outbox n'a pas été agrégée est exclue de la purge. En cas de doute, conserver et signaler plutôt que supprimer.

#### Suppression en deux phases, bornée et cohérente

1. Sélectionner au plus 200 livraisons éligibles dont `retention_expires_at <= maintenant`, avec un index sur l'échéance et l'état terminal.
2. Supprimer d'abord les tentatives liées à ces livraisons, puis les livraisons elles-mêmes, dans une transaction D1 (`batch`) ; ne pas utiliser de suppression en cascade implicite comme unique garantie.
3. La suppression parent doit inclure une condition `NOT EXISTS` vérifiant qu'aucune tentative enfant ne subsiste.
4. Si une étape échoue, la transaction est annulée ; le lot reste disponible pour le passage suivant. Ne jamais marquer une purge réussie si une seule des deux étapes a échoué.
5. Les contraintes de clé étrangère et les index doivent être testés sur la migration locale avant toute demande d'application distante.
6. La purge ne supprime jamais les lignes outbox métier : elles conservent leur historique métier selon leur propre politique de conservation.

#### Preuve de couverture et surveillance

Créer une petite ligne de contrôle technique unique (par exemple `notification_retention_control`, singleton) contenant uniquement :
- date/heure du dernier passage réussi ;
- nombre agrégé de lignes de livraisons et tentatives supprimées au dernier passage ;
- nombre actuel de lignes arrivées à échéance mais non purgées ;
- date de la plus ancienne échéance encore en attente ;
- nombre de passages consécutifs en échec ;
- code d'erreur technique normalisé, sans message brut.

Cette ligne ne contient aucun identifiant de compte, identifiant SOS, endpoint, clé, payload, GPS ou donnée personnelle. Elle n'est pas un journal d'activité utilisateur.

À chaque passage, le Worker :
- met à jour les compteurs agrégés après la transaction ;
- vérifie qu'il ne reste pas de lignes échues non supprimées ;
- écrit un log structuré minimal avec date, durée, volumes agrégés, backlog et code d'état ;
- ne journalise jamais les identifiants des lignes supprimées ni le contenu SQL lié à une donnée utilisateur.

**Alertes obligatoires :**
- échec d'une exécution : produire une erreur observable (avec code normalisé) afin que Cloudflare Workers Issues puisse la détecter ;
- deux passages horaires consécutifs en échec : alerte de niveau élevé ;
- présence d'une ligne échue depuis plus de 24 heures : alerte de niveau élevé ;
- compteur de backlog qui augmente sur plusieurs passages : alerte de surveillance ;
- absence de passage réussi depuis plus de 2 heures : alerte de niveau élevé.

Les notifications d'alerte doivent être configurées vers un canal d'exploitation effectivement surveillé avant mise en service. Tant qu'aucun canal n'est configuré et testé, la purge ne peut pas être déclarée surveillée en production.

#### Reprise après incident et protection contre les restaurations

- Une panne du Cron ne remet pas le compteur de conservation à zéro : les échéances absolues restent inchangées et les passages suivants rattrapent le retard par lots.
- Un lot partiellement traité doit être rejoué sans doublon ni perte de cohérence.
- Une restauration D1 peut réintroduire des lignes déjà purgées dans le registre technique : après restauration, le contrôle doit relire les échéances et relancer la purge jusqu'à résorption du backlog.
- Cette purge du registre Push n'est **pas** une preuve de suppression irréversible des GPS précis dans les sauvegardes ou D1 Time Travel. La règle GPS de 30 jours exige un mécanisme distinct, une preuve spécifique et une autorisation séparée.

#### Schéma SQL préparé — migration 0009

Le fichier additif `migrations/0009_notification_delivery_retention.sql` prépare :

- `notification_device_deliveries` : état par appareil, identifiants opaques, compteur strict 0..2, bail, horodatage de fin de cycle et échéance de purge ;
- `notification_delivery_attempts` : au plus deux tentatives par livraison, résultat normalisé, dates et durée ;
- `notification_retention_control` : singleton de contrôle avec bail anti-concurrence, dates de passage, volumes agrégés, backlog et codes d'erreur normalisés.

Les contraintes et triggers interdisent notamment les tentatives non réservées, les numéros non séquentiels, les transitions hors état terminal, le démarrage de la rétention avant l'agrégation de l'outbox et la suppression d'une tentative ou livraison avant échéance. La suppression du parent est bloquée tant que des tentatives enfants existent. Les clés étrangères vers l'outbox sont en restriction ; aucun lien FK ne bloque la révocation/suppression d'un abonnement Push devenu invalide.

La migration ne modifie pas les lignes existantes et ne touche aucune donnée GPS. Le test `tests/d1_notification_retention_schema.test.py` applique la chaîne de migrations 0001 à 0009 dans une base SQLite isolée et vérifie les contraintes, la limite de lot de 200, la suppression enfant-avant-parent, le rollback transactionnel en cas d'échec, l'impossibilité d'étendre le fan-out après agrégation et la préservation de l'outbox métier. Il vérifie aussi l'absence de colonnes de contenu sensible. La commande est `npm run test:d1-notification-retention`, intégrée au workflow CI. Le workflow GitHub Actions `44800621093` a réussi le 20 novembre 2026, y compris l'application Wrangler de 0001 à 0009 sur la base locale isolée et les 12 tests du contrat de rétention.

**Important :** la migration 0009 a été appliquée uniquement à la D1 locale isolée de CI, jamais à la D1 distante `sac-db`. Le code Worker qui exécute la purge horaire et met à jour le singleton reste à implémenter ; aucune suppression automatique n'est active en production.

#### Tests obligatoires de purge

- ligne à 29 jours : conservée ;
- ligne à exactement 30 jours après `cycle_terminal_at` : éligible selon l'horloge UTC ;
- cycle rappel non agrégé : conservé même si certains appareils sont terminaux depuis plus de 30 jours ;
- tentative enfant supprimée avant sa livraison parent ;
- échec entre les deux opérations : transaction annulée, aucune suppression partielle ;
- lot supérieur à 200 : un seul lot borné traité, les suivants restent éligibles ;
- répétition du même passage : aucun effet secondaire ;
- panne Cron de plusieurs heures : rattrapage progressif sans modifier les échéances ;
- restauration d'une sauvegarde contenant des lignes échues : repurge automatique ;
- table hors périmètre (outbox, SOS, comptes, abonnements, GPS) : aucune ligne supprimée ;
- backlog supérieur à 24 heures et deux échecs consécutifs : alertes déclenchées ;
- absence de canal d'alerte configuré : recette de mise en service refusée.

La cadence horaire, le lot de 200 et les seuils d'alerte sont des paramètres techniques initiaux prudents ; ils doivent être testés avec les quotas D1 du compte et ajustés avant activation, sans augmenter le périmètre des données supprimées.

### Points distincts à arbitrer
- choix et configuration du canal d'alerte réellement surveillé ;
- validation des quotas D1 et de la charge de purge sur le plan Cloudflare réel.

La conservation Cloudflare Workflow n'est pas une politique de conservation SAC. D1 doit appliquer sa propre purge à 30 jours, même si l'état Workflow est déjà expiré ou conservé plus longtemps.

Métriques minimales sans données personnelles : nombre de livraisons par état, taux d'acceptation fournisseur, taux `unknown_exhausted`, reprises, baux expirés, erreurs de création Workflow, âge des livraisons non terminales, erreurs d'agrégation outbox et tâches SMS en attente.

Aucun endpoint, identifiant de compte, adresse e-mail, contenu SOS ou GPS dans les logs.

## 10. Limites Cloudflare et contrôle des coûts

Documentation Cloudflare consultée le 20 novembre 2026 :

- Workflows est disponible sur Workers Free et Paid.
- `step.sleep` accepte une durée en secondes ; l'attente ne consomme pas de CPU.
- Les étapes `step.do` ont par défaut cinq retries supplémentaires si une configuration personnalisée n'est pas fournie. Les retries automatiques doivent donc être explicitement maîtrisés pour ne jamais contourner la limite de deux appels réseau.
- Workers Free : 3 000 steps/jour, 100 000 exécutions/jour partagées, 100 instances concurrentes ; les instances en attente/sommeil ne comptent pas dans le plafond de concurrence.
- Workers Paid : 500 000 steps/mois inclus puis facturation supplémentaire ; les limites de concurrence et de requêtes diffèrent.
- Les états Workflow terminés sont conservés 3 jours sur Free et 7 jours par défaut sur Paid (configurable jusqu'à 30 jours sur Paid). Cette conservation est distincte de D1.

Sources officielles :
- Limits : https://developers.cloudflare.com/workflows/reference/limits/
- Sleeping and retrying : https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/
- Pricing : https://developers.cloudflare.com/workflows/reference/pricing/
- Workers API / create : https://developers.cloudflare.com/workflows/build/workers-api/
- Rules of Workflows : https://developers.cloudflare.com/workflows/build/rules-of-workflows/

**Décision d'exploitation :** ne pas supposer que le compte est Free ou Paid. Vérifier le plan et les quotas réels avant de déployer ou d'activer Workflows. Estimer le nombre de livraisons et de steps par jour à partir d'un scénario de charge SAC. Ne pas activer une ressource payante ou dépasser les quotas sans autorisation.

## 11. Ordre de réalisation sécurisé

1. Faire relire cette architecture et fermer les points ouverts de conservation, d'expiration de bail et de surveillance.
2. Concevoir le schéma SQL final et les opérations atomiques ; valider les index, contraintes, triggers et stratégie de purge.
3. Écrire les tests de contrat et de concurrence avant le branchement au transport.
4. Préparer la migration additive et le code du registre D1, sans l'appliquer à la D1 distante.
5. Préparer le Workflow et le Cron de récupération, sans créer/déployer la ressource Cloudflare.
6. Exécuter les tests locaux/CI et vérifier qu'aucun appel réseau Push réel ne peut partir dans les environnements de test.
7. Obtenir une autorisation explicite avant migration D1 distante.
8. Obtenir une autorisation explicite distincte avant création/déploiement du Worker et Workflow Cloudflare.
9. Configurer les secrets et paramètres, sans exposer leur valeur.
10. Effectuer une recette contrôlée avec appareils de test et autorisation explicite avant activation des envois réels.
11. Vérifier les métriques, les états D1, les erreurs et le comportement SMS ; documenter les preuves de fonctionnement.

## 12. État de réalisation

- [x] Règles produit de reprise validées par le Super Admin.
- [x] Audit de l'architecture existante.
- [x] Architecture cible et contrats conceptuels documentés.
- [x] Conservation des résultats techniques individuels D1 fixée à 30 jours après la fin du rappel ; purge automatique requise.
- [x] Conservation des instances et historiques Workflow fixée à 7 jours maximum après la fin de l'exécution.
- [x] Timeout réseau fournisseur fixé à 8 secondes maximum ; bail de traitement fixé à 30 secondes avec fencing token et consommation de la tentative après expiration.
- [x] Spécification opérationnelle de purge D1 bornée, idempotente, surveillée et testable documentée (exécution horaire, lots de 200, conservation prudente en cas de doute, alertes et reprise après restauration).
- [x] Migration D1 additive 0009 écrite et appliquée uniquement à la D1 locale isolée de CI.
- [x] Tests de schéma, purge bornée, rollback, fan-out figé et confidentialité réussis en CI (`44800621093`).
- [ ] Registre livraison/appareil implémenté.
- [ ] Workflow et Cron de récupération implémentés.
- [ ] Tests de concurrence et de clôture réussis.
- [ ] CI verte sur la version implémentée.
- [ ] Migration D1 distante autorisée et appliquée.
- [ ] Worker/Workflow déployés après autorisation.
- [ ] Configuration et recette réelle autorisées et vérifiées.
