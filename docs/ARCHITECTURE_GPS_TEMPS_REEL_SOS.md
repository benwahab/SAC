# SAC — GPS temps réel pour les alertes SOS

**Statut au 20 novembre 2026 : première tranche serveur écrite sur `main`, non déployée et non activée en production.** Le navigateur n'est pas encore raccordé à la géolocalisation et au chiffrement de bout en bout. Ne pas présenter le GPS comme disponible aux utilisateurs avant les étapes de recette.

## Décision produit applicable

- Le GPS est utilisé uniquement pendant une alerte SOS active et uniquement pour l'auteur et les proches figés dans le snapshot de cette alerte.
- Dès la clôture effective, toutes les positions et copies gérées par SAC sont supprimées immédiatement. Il n'existe aucun délai de conservation GPS de 30 jours.
- L'historique de l'alerte conserve uniquement sa catégorie pendant 30 jours ; l'alerte et sa catégorie sont ensuite purgées.
- Aucune coordonnée, adresse dérivée, géohash, itinéraire, miniature de carte ou clé de déchiffrement ne doit être persistée dans D1, R2, KV, stockage Durable Object, Queue, logs, traces ou analytics.
- Les données déjà copiées hors de SAC par un destinataire ne peuvent pas être effacées à distance ; l'application ne doit pas proposer d'export GPS.

## Première tranche serveur ajoutée

### Ticket d'accès

`POST /api/alerts/:alertId/gps-ticket` :
- exige une session d'appareil authentifiée ;
- exige une alerte active ;
- exige que l'appelant soit l'auteur ou un destinataire du snapshot immuable ;
- émet un ticket HMAC de portée `connect`, limité à l'alerte, au compte et à 120 secondes ;
- stocke uniquement son empreinte SHA-256 dans `gps_relay_tickets`, avec alerte, compte, rôle et expiration ;
- ne reçoit et n'écrit aucune coordonnée GPS.

Secret nécessaire dans Pages et Worker : `GPS_RELAY_HMAC_SECRET` (au moins 32 caractères aléatoires). URL nécessaire côté Pages : `GPS_RELAY_PUBLIC_URL`.

### Relais éphémère

Worker isolé `workers/gps-relay` :
- route les connexions WebSocket vers un Durable Object par alerte ;
- reçoit le ticket via un sous-protocole WebSocket dédié (`Sec-WebSocket-Protocol`), jamais dans l'URL ;
- vérifie le ticket HMAC, puis consomme atomiquement son empreinte D1 : un rejeu du même ticket est refusé ;
- revérifie le statut/participant dans D1 à la connexion ;
- revérifie le statut et les droits avant chaque message ;
- ne possède aucun binding de stockage GPS et n'écrit aucun payload dans le stockage Durable Object ;
- refuse les messages contenant des champs évidents de position en clair ;
- autorise uniquement l'auteur à publier les enveloppes `gps-encrypted` ;
- relaie les annonces de clés publiques et les enveloppes chiffrées aux participants connectés ;
- ferme toutes les connexions quand l'alerte est clôturée.

Les WebSockets utilisent ici l'API standard avec état en mémoire uniquement, pas l'API d'hibernation et pas `serializeAttachment`. Une éviction/reprise coupe la session : le client doit se reconnecter avec un nouveau ticket et le serveur revérifie l'alerte active. Aucune position n'est récupérable après redémarrage du relais.

### Clôture

La route de clôture SOS :
1. clôture l'alerte dans D1 ; les messages suivants sont immédiatement refusés par le contrôle du statut ;
2. appelle le Worker avec un ticket signé de portée `close`, valable 60 secondes ;
3. le relais ferme toutes les connexions de la salle.

La réponse de clôture expose `gpsRelayRevocation` comme `confirmed` ou `pending_configuration_or_retry`. La fermeture de l'alerte n'est pas annulée si le relais est indisponible ; le statut D1 fermé empêche néanmoins toute nouvelle transmission.

## Ce qui manque avant une activation réelle

1. Appliquer la migration `0010_gps_relay_tickets.sql` à D1 distante après validation CI.
2. Déployer le Worker et créer son namespace Durable Object après CI verte.
3. Configurer le même secret aléatoire `GPS_RELAY_HMAC_SECRET` dans Pages et Worker, et `GPS_RELAY_PUBLIC_URL` dans Pages.
3. Ajouter le binding Worker/namespace à Pages ou conserver le Worker public avec authentification HMAC stricte.
4. Implémenter côté navigateur la permission de géolocalisation, la gestion du cycle de vie de la permission, l'arrêt de `watchPosition` à la clôture, et l'état d'indisponibilité GPS.
5. Raccorder le ticket à usage unique au client WebSocket et traiter les reconnexions avec un nouveau ticket.
6. Implémenter un véritable chiffrement de bout en bout : ECDH éphémère par appareil/participant, dérivation HKDF, AES-GCM, IV unique, compteur anti-rejeu et rotation de clé. Le relais ne doit jamais recevoir de coordonnées en clair. La présente tranche ne réalise pas encore cette couche cliente.
6. Gérer le renouvellement du ticket, la reconnexion après perte réseau, la déconnexion de chaque appareil, la révocation d'un proche, le changement de responsable et les états hors ligne.
7. Ajouter des tests unitaires et d'intégration pour l'autorisation, le rejeu, le payload en clair, le chiffrement, la clôture concurrente, la fermeture de salle, la révocation et la reprise.
8. Recette sur Android réel, avec deux comptes/appareils, réseau instable et vérification qu'aucune coordonnée ne figure dans D1, stockage DO, logs ou traces.

## Critère d'activation

Le GPS de production reste désactivé jusqu'à réussite des points 1 à 8. Ce statut est un verrou de sécurité explicite, pas une décision de conserver le GPS 30 jours. Dès que la recette est passée, le partage GPS peut être activé uniquement pendant les alertes actives.


## Revue de sécurité complémentaire — 20 novembre 2026, 21:22 (heure du Niger)

### Vérifications confirmées

- Commit serveur : `a795b283aae61370656010553cde2c14816dc850`.
- Contrôle TypeScript/CI GitHub Actions `validate` : succès sur ce commit.
- Déploiement Cloudflare Pages associé : succès, aperçu `60651649.sac-3xh.pages.dev`.
- Ces deux résultats valident la compilation et le déploiement Pages, pas le déploiement du Worker GPS ni un partage GPS fonctionnel.

### Blocages de sécurité identifiés avant toute mise en service

1. Le ticket WebSocket est actuellement placé dans le paramètre d'URL `ticket`. Même s'il expire après 120 secondes, il peut être exposé par des journaux de requête ou des outils d'observabilité. Avant production, remplacer ce transport par un mécanisme d'échange à usage unique, ou démontrer explicitement que les URL complètes ne sont jamais journalisées et réduire encore la fenêtre d'utilisation.
2. Les messages `key-announce` sont actuellement relayés comme données opaques. Le Worker ne prouve pas l'identité du propriétaire de la clé annoncée. Le client doit vérifier une signature d'identité et comparer l'empreinte à une référence obtenue par un canal indépendant ; aucune clé reçue du seul serveur ne peut être considérée comme fiable.
3. Le Worker ne possède pas encore de tests d'intégration dédiés couvrant l'autorisation par rôle, les tickets rejoués, l'isolation entre salles, les messages malformés, les déconnexions et la clôture concurrente.
4. Le navigateur n'utilise toujours pas `navigator.geolocation.watchPosition` dans le parcours SOS ; aucun paquet GPS réel ne doit donc être émis.
5. Le Worker `sac-gps-relay` n'est pas confirmé comme déployé et son secret partagé avec Pages n'est pas configuré/validé.

### Décision opérationnelle

Le statut de la fonctionnalité reste **non activée en production**. Ne pas afficher de position fictive ni un indicateur « GPS actif ». La prochaine tranche doit traiter les tickets à usage unique et leur exposition, établir la confiance des clés par appareil, écrire les tests du relais, puis raccorder le navigateur. Le GPS ne sera activé qu'après une recette Android à deux appareils démontrant l'arrêt immédiat à la clôture et l'absence de coordonnées dans toute persistance ou journalisation SAC.


### Contrôle du cycle de vie Durable Objects — documentation Cloudflare consultée le 20 novembre 2026

Le relais actuel utilise `server.accept()` et une table de connexions conservée uniquement dans la mémoire de l'instance. Il n'utilise ni `ctx.acceptWebSocket()`, ni `serializeAttachment()`, ni stockage SQLite/KV pour les connexions ou les paquets.

Conséquence : il n'active pas l'hibernation WebSocket de Durable Objects. C'est cohérent avec l'objectif de ne jamais restaurer une session GPS à partir d'un état persistant, mais cela maintient l'objet actif pendant les connexions et doit être évalué en charge et en coût. Il ne faut pas migrer vers l'API hibernatable sans définir explicitement la fermeture des sockets lors d'une éviction : Cloudflare précise que l'état mémoire est réinitialisé lors de l'hibernation et que les WebSockets hibernatables peuvent rester connectés.

**Décision provisoire :** conserver les connexions non hibernatables pour le prototype sécurisé, sans sérialiser d'attachements et sans stockage de contenu GPS. Ajouter des tests d'éviction/fermeture et mesurer le coût avant toute optimisation. Si l'objet ou le processus est interrompu, les connexions doivent se terminer et les clients doivent réobtenir une autorisation sur l'alerte toujours active ; aucune session ni position ne doit être restaurée.

Référence Cloudflare : https://developers.cloudflare.com/durable-objects/best-practices/websockets/ et https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/.


## Avancement technique — tickets WebSocket à usage unique

Une tranche de durcissement a été ajoutée sur `main` :
- migration additive `0010_gps_relay_tickets.sql` : stockage d'une empreinte SHA-256 du ticket et de métadonnées de portée/expiration uniquement ;
- l'endpoint Pages émet un ticket HMAC de 120 secondes et enregistre son empreinte seulement si l'alerte est toujours active et l'appelant encore autorisé ;
- le client doit présenter le ticket dans le sous-protocole `sac-gps-ticket.<ticket>`, avec `sac-gps-v1` ; le ticket n'est plus placé dans l'URL ;
- le Worker vérifie le HMAC, consomme l'empreinte par un DELETE conditionnel atomique et refuse tout rejeu ;
- le Worker ne sélectionne que le sous-protocole public `sac-gps-v1` dans la réponse WebSocket ;
- tests de schéma D1 ajoutés pour usage unique, expiration, rôle, empreinte et absence de colonnes GPS.

**Limite inchangée :** cette tranche n'active pas encore la géolocalisation du navigateur ni le partage chiffré vers les proches. La migration doit encore être appliquée à D1 distante, le Worker configuré/déployé et le client raccordé puis testé sur deux appareils. Le GPS reste donc non opérationnel en production à ce stade.


## Vérification de la migration D1 distante — 20 novembre 2026

La CI GitHub du commit `9011168f2ab5668b10d3e8503f4d0487897b1992` a terminé avec succès : tests de schéma GPS, typecheck, build et tests d'intégration SOS inclus.

La migration `0010_gps_relay_tickets.sql` a ensuite été appliquée à la base D1 distante `sac-db` (`892ce876-f279-409c-8f9e-06b1dca66e9d`). La table `gps_relay_tickets`, son index d'expiration et l'entrée `d1_migrations` numéro 10 ont été créés. La vérification de la table de suivi avant application indiquait que seules les migrations 0001 à 0009 étaient présentes ; l'exécution distante a confirmé trois opérations SQL réussies.

Le déploiement Pages de production correspondant au commit `9011168f` est terminé avec succès : `https://02de0faa.sac-3xh.pages.dev`.

**État d'activation :** le Worker `sac-gps-relay` n'existe pas encore sur le compte Cloudflare et les variables Pages `GPS_RELAY_HMAC_SECRET` / `GPS_RELAY_PUBLIC_URL` ne sont pas configurées. Le client SOS n'appelle pas encore `watchPosition` et n'ouvre pas le WebSocket. Les primitives de chiffrement et d'échange de clés restent expérimentales ; aucune clé d'identité privée de localisation n'est encore provisionnée sur les appareils. Par conséquent, aucun partage GPS réel n'est actif malgré la migration et le déploiement Pages.

**Prochaine tranche obligatoire avant activation :** provisionnement vérifiable des clés d'identité des appareils et de leur révocation, échange ECDH authentifié entre appareils, client de géolocalisation SOS avec effacement local immédiat à la clôture, puis déploiement du relais et test sur deux appareils réels. Ne pas envoyer de coordonnées en clair pour contourner ce blocage.


## Liaison ticket — appareil — session (20 novembre 2026)

Le ticket de connexion WebSocket est maintenant lié à trois identifiants distincts :
- le compte autorisé dans le snapshot de l'alerte ;
- l'appareil enrôlé et encore actif ;
- la session d'authentification précise, encore active et non expirée.

La migration additive `0011_gps_ticket_device_binding.sql` remplace la table de tickets par une version contenant `device_id` et `session_id`, avec clés étrangères vers les appareils et sessions. Elle supprime les anciens tickets non consommés lors de cette transition. Le Worker revérifie le compte, l'appareil et la session lors du handshake et avant chaque message ; une session révoquée ou expirée ne peut donc plus continuer à utiliser le relais lors de son prochain message. Les identifiants de session ne sont pas exposés dans les messages WebSocket.

Les tests D1 couvrent désormais la liaison compte/appareil/session, le rejeu, l'expiration, l'absence de colonnes de localisation et le refus d'une session révoquée. Les tests de négociation WebSocket couvrent l'offre de sous-protocoles et les limites du ticket.

**État de cette tranche :** tests D1 GPS et WebSocket réussis dans la CI du commit `0756d86b27cffb54a14e8c49fe9281ffd26cf985` (typecheck également réussi). La CI complète doit finir avant l'application distante de la migration 0011. Le Worker n'est toujours pas déployé ; la géolocalisation navigateur et le chiffrement/authentification de clés restent à raccorder.


## Migration distante 0011 — vérification du 20 novembre 2026

Après succès complet de la CI du commit `0756d86b27cffb54a14e8c49fe9281ffd26cf985`, la migration `0011_gps_ticket_device_binding.sql` a été appliquée à la base D1 distante `sac-db`. La table ne contenait aucun ticket au moment de la transition ; les tickets éphémères existants ont donc été supprimés sans perte de session GPS active. La table contient maintenant `device_id` et `session_id`, avec les clés étrangères attendues. Le journal D1 confirme l'entrée 11 et `PRAGMA foreign_key_check` ne retourne aucune anomalie.

La CI suivante inclut une étape supplémentaire de bundle à blanc Wrangler du Worker et de validation des bindings Durable Objects avant tout déploiement réel. Le Worker n'est pas encore déployé et les variables de secret Pages ne sont pas configurées.
