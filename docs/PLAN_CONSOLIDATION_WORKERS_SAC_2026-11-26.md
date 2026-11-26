# Plan de consolidation des Workers SAC — 26 novembre 2026

## Objectif validé

Réduire au maximum les Workers visibles pour SAC et centraliser l'application dans `sac-app`, sans perdre de données, de secrets, de tâches programmées, de notifications ni de sessions GPS.

Le dépôt reste `benwahab/SAC`, branche `main`. UPK reste totalement séparé et ne doit faire l'objet d'aucune modification.

## Inventaire Cloudflare vérifié le 26 novembre 2026

Workers présents dans le compte :
- `sac-app`
- `sac-gps-relay`
- `sac-notification-retention-purge`
- `sac-ordinary-notification-delivery`
- `sac-sos-notification-delivery`
- `upk` — hors périmètre SAC, à préserver.

Ressources de données :
- D1 `sac-db` — base SAC, à préserver.
- D1 `upk` — hors périmètre SAC, à préserver.
- R2 `sac-private-documents` et `sac-private-documents-preview` — stockage SAC, à préserver.
- R2 `upk-photos` — hors périmètre SAC, à préserver.

Les bases D1 et les buckets R2 sont des ressources Cloudflare indépendantes : elles ne deviennent pas des fichiers internes au Worker. Le Worker principal peut y accéder par des bindings.

## Constat technique

### 1. Worker principal `sac-app`

- Utilise déjà la base D1 de production `sac-db`.
- Possède déjà les secrets de push VAPID et de chiffrement des abonnements.
- Possède déjà `INTERNAL_DISPATCH_TOKEN`.
- N'a actuellement aucun déclencheur Cron déclaré.
- La configuration actuelle référence encore le Worker GPS via `GPS_RELAY_PUBLIC_URL`.
- Les buckets R2 SAC ne sont pas encore déclarés comme bindings dans la configuration du Worker.

### 2. Notifications ordinaires

Le Worker `sac-ordinary-notification-delivery` ne contient qu'un déclencheur Cron chaque minute et un appel HTTP authentifié vers :
`https://sac-3xh.pages.dev/api/internal/ordinary-notification-dispatch`

Le projet Pages SAC a été supprimé. Cette ancienne destination doit donc être considérée comme obsolète jusqu'à preuve du contraire.

Le traitement métier existe déjà dans :
- `functions/api/internal/ordinary-notification-dispatch.ts`
- `functions/lib/notifications/ordinary-dispatch.ts`

La voie cible est d'exécuter ce traitement directement depuis le Worker principal, sans appel HTTP vers Pages et sans conserver le Worker relais ordinaire. Il faut d'abord vérifier le point d'entrée Worker compilé et tester le traitement programmé.

### 3. Notifications SOS

Le Worker `sac-sos-notification-delivery` :
- utilise la même base `sac-db` ;
- possède les secrets push nécessaires ;
- exécute le dispatch des rappels SOS chaque minute ;
- exécute aussi une purge de rétention chaque heure.

Les mêmes fonctions métier de dispatch SOS sont importées depuis le code partagé du dépôt. Le Worker principal possède déjà les noms des secrets push, mais il faut vérifier leurs valeurs et leur cohérence sans jamais les afficher ni les régénérer.

### 4. Purge de rétention

Le Worker `sac-notification-retention-purge` exécute une purge horaire dans `sac-db`.

Le code de purge existe également dans le Worker SOS. Il y a donc un chevauchement à résoudre : une seule tâche de purge doit être active à terme, avec verrouillage, traitement par lots et tests de concurrence conservés.

### 5. Relais GPS et Durable Object

Le Worker `sac-gps-relay` :
- valide les tickets GPS à usage unique dans `sac-db` ;
- vérifie les appareils, sessions et participants d'une alerte ;
- gère les WebSockets ;
- héberge la classe Durable Object `GpsRelayRoom` dans le namespace `GPS_ROOMS` ;
- détient le secret `GPS_RELAY_HMAC_SECRET`.

Ce service est plus qu'un simple relais HTTP. Son Durable Object détient l'état des salles et connexions en temps réel. Le secret HMAC ne doit pas être transféré ou régénéré sans analyse du protocole et des appels côté application.

**Aucune suppression ni migration du Worker GPS n'est autorisée à ce stade.** Il faut d'abord établir si le namespace Durable Object existant peut être repris sans perte par `sac-app`. Si la migration ne peut pas être garantie, le relais GPS restera le seul Worker technique séparé.

## Architecture cible

Objectif prioritaire :
- `sac-app` : application, API, assets, dispatch ordinaire, dispatch SOS et purge planifiée ;
- `sac-db` : base de données unique SAC, inchangée ;
- buckets R2 SAC : stockage privé, inchangé ;
- GPS : intégré à `sac-app` uniquement si le transfert du Durable Object et de son état est techniquement sûr ; sinon, conservé temporairement comme service isolé.

UPK ne doit jamais être rattaché à SAC.

## Ordre de migration obligatoire

1. Confirmer les points d'entrée compilés et les contrats des handlers programmés de `sac-app`.
2. Ajouter et tester les tâches Cron dans un environnement local ou isolé, sans activer de double exécution en production.
3. Déplacer le dispatch ordinaire vers `sac-app` et vérifier son authentification.
4. Déplacer le dispatch SOS vers `sac-app`, en préservant les secrets push existants.
5. Unifier la purge de rétention : un seul déclencheur, un seul chemin d'exécution, tests de concurrence et de verrouillage.
6. Étudier et tester séparément le transfert du Durable Object GPS, sans supprimer le namespace ni son Worker d'origine.
7. Effectuer les tests de santé, authentification, push, SOS, WebSocket GPS et rétention.
8. Vérifier le déploiement réel et les journaux.
9. Désactiver les anciens Workers uniquement après validation complète et période de vérification.
10. Supprimer les anciens Workers uniquement après confirmation explicite et preuve qu'ils ne sont plus utilisés.

## Interdictions de sécurité

- Ne pas supprimer ou recréer `sac-db`.
- Ne pas supprimer ou vider les buckets R2.
- Ne pas régénérer les secrets push, HMAC GPS ou tokens d'authentification.
- Ne pas faire tourner simultanément deux dispatchers ou deux purges en production.
- Ne pas modifier UPK, ses Workers, sa base ou son bucket.
- Ne pas déclarer la fusion terminée tant que les tests et le déploiement réel ne sont pas vérifiés.

## État au 26 novembre 2026

Audit Cloudflare et dépôt effectué. Aucune ressource Cloudflare n'a été modifiée et aucun Worker n'a été supprimé. La consolidation du code et des tâches planifiées reste à réaliser selon l'ordre ci-dessus.


## Avancement après audit

Le 26 novembre 2026, une première intégration préparatoire a été ajoutée sur `main` :

- `workers/app/entry.ts` conserve le gestionnaire HTTP généré par Pages Functions et lui ajoute un gestionnaire `scheduled`.
- Le traitement des notifications ordinaires est appelé directement depuis `sac-app`, sans l'ancien appel HTTP vers Pages.
- Le traitement SOS et la purge horaire réutilisent le Worker SOS existant comme module, sans recopier sa logique.
- `workers/app/wrangler.toml` pointe maintenant vers cet entrypoint et déclare les deux Cron Triggers.

Les quatre secrets Push nécessaires sont présents dans les bindings/secrets de `sac-app`. Le binding D1 `DB` est également présent. Les valeurs des secrets ne sont pas lues ni exposées.

**Statut : code préparatoire ajouté, validation CI de cette nouvelle entrée et déploiement réel encore à confirmer.** La configuration de production Cloudflare n'a pas encore été mise à jour par un déploiement. Les Workers secondaires restent actifs ; aucun Cron n'a été retiré et aucune ressource n'a été supprimée.

Le précédent run GitHub Actions `45886606319` a validé les contrôles existants, mais le job de déploiement a échoué avant le déploiement parce que le secret GitHub `CLOUDFLARE_API_TOKEN` était absent. Ce secret doit être configuré dans les secrets du dépôt GitHub avant tout déploiement.
