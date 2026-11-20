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
- ne reçoit et n'écrit aucune coordonnée GPS.

Secret nécessaire dans Pages et Worker : `GPS_RELAY_HMAC_SECRET` (au moins 32 caractères aléatoires). URL nécessaire côté Pages : `GPS_RELAY_PUBLIC_URL`.

### Relais éphémère

Worker isolé `workers/gps-relay` :
- route les connexions WebSocket vers un Durable Object par alerte ;
- vérifie le ticket HMAC et le statut/participant dans D1 à la connexion ;
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

1. Déployer le Worker et créer son namespace Durable Object après CI verte.
2. Configurer le même secret aléatoire `GPS_RELAY_HMAC_SECRET` dans Pages et Worker, et `GPS_RELAY_PUBLIC_URL` dans Pages.
3. Ajouter le binding Worker/namespace à Pages ou conserver le Worker public avec authentification HMAC stricte.
4. Implémenter côté navigateur la permission de géolocalisation, la gestion du cycle de vie de la permission, l'arrêt de `watchPosition` à la clôture, et l'état d'indisponibilité GPS.
5. Implémenter un véritable chiffrement de bout en bout : ECDH éphémère par appareil/participant, dérivation HKDF, AES-GCM, IV unique, compteur anti-rejeu et rotation de clé. Le relais ne doit jamais recevoir de coordonnées en clair. La présente tranche ne réalise pas encore cette couche cliente.
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
