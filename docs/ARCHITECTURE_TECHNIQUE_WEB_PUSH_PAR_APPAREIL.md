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
- Appliquer un timeout réseau explicite inférieur au délai de reprise de 15 secondes, à définir et tester pour éviter qu'un premier appel toujours en vol chevauche la seconde tentative.
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
- Un ancien Worker ne peut pas écrire sur une réservation plus récente.
- Si une exécution s'interrompt après réservation et avant un résultat certain, la reprise ne rejoue jamais aveuglément le même numéro d'appel.
- Après expiration du bail, l'état de la tentative inachevée est classé ambigu ; il consomme le numéro déjà réservé. Le Workflow peut alors attendre 15 secondes et réserver la seconde tentative si elle reste autorisée.
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

## 9. Conservation et observabilité — décisions encore ouvertes

Ne pas inventer de durée de conservation avant arbitrage. À définir avant migration :

- durée de conservation des lignes livraison et tentatives ;
- politique de purge automatique et vérifiable ;
- durée de conservation des instances Workflow (distincte de la conservation D1) ;
- politique de métriques et logs expurgés.

La conservation Cloudflare Workflow n'est pas une politique de conservation SAC. D1 doit conserver la preuve minimale nécessaire au suivi pendant la durée qui sera décidée, puis être purgée selon une politique dédiée.

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
- [ ] Arbitrage de la conservation D1 et Workflow.
- [ ] Spécification définitive des baux et récupération après interruption.
- [ ] Migration D1 écrite et testée localement.
- [ ] Registre livraison/appareil implémenté.
- [ ] Workflow et Cron de récupération implémentés.
- [ ] Tests de concurrence et de clôture réussis.
- [ ] CI verte sur la version implémentée.
- [ ] Migration D1 distante autorisée et appliquée.
- [ ] Worker/Workflow déployés après autorisation.
- [ ] Configuration et recette réelle autorisées et vérifiées.
