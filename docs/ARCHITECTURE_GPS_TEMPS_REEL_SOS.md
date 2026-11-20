# SAC — GPS temps réel des alertes SOS

**Document de référence — état au 20 novembre 2026**

Ce document remplace les anciennes notes de conception qui demandaient une comparaison manuelle d'empreintes. Toute instruction historique contraire est obsolète.

## Décision produit obligatoire

Le partage GPS doit être simple pour le lanceur d'alerte et ses proches :

- Aucun échange manuel d'identifiants ou d'empreintes.
- Aucun code de vérification supplémentaire, appel téléphonique ou comparaison en personne.
- Aucun écran « Sécurité du partage GPS » à configurer.
- Les proches déjà associés à l'alerte et authentifiés dans SAC sont reconnus automatiquement à partir de leur compte, appareil et session.
- La seule autorisation spécifique demandée à l'utilisateur est celle de la géolocalisation du téléphone, au démarrage du partage pendant une alerte SOS active.
- Le GPS est lancé uniquement sur le téléphone du lanceur d'alerte et uniquement lorsqu'au moins un appareil destinataire autorisé est connecté.
- Si l'authentification SAC, l'autorisation de localisation ou le relais échoue, aucune coordonnée n'est envoyée. Le statut affiché doit expliquer l'indisponibilité sans demander une procédure manuelle.

## Cycle de vie des positions — règle de confidentialité

1. Pendant une alerte SOS active, le téléphone du lanceur peut transmettre sa position précise en temps réel aux proches autorisés de cette alerte.
2. Les coordonnées sont chiffrées de bout en bout entre les appareils participants. Le relais ne reçoit que des paquets chiffrés.
3. Les positions précises et les clés de session ne sont jamais écrites dans D1, R2, KV, Cache, IndexedDB, localStorage, journaux, historiques ou pièces jointes.
4. À la clôture de l'alerte, le suivi GPS s'arrête, les connexions sont fermées et les coordonnées/clefs détenues en mémoire sont effacées immédiatement.
5. Après clôture, l'historique conserve uniquement la catégorie/nature de l'alerte selon la durée métier prévue. Les coordonnées ne sont pas conservées 30 jours.
6. Après 30 jours, l'enregistrement de l'alerte et sa catégorie sont supprimés selon la politique de rétention. Aucune sauvegarde ou restauration ne doit faire réapparaître une position GPS.
7. Après une interruption réseau ou une éviction du processus, aucune position ni session GPS n'est restaurée. Les appareils doivent obtenir une nouvelle autorisation liée à l'alerte encore active.

## Authentification automatique des appareils

Le serveur SAC est l'autorité d'authentification de la relation compte/appareil/session. Ce choix remplace explicitement l'épinglage manuel des empreintes.

- L'endpoint `POST /api/alerts/:alertId/gps-ticket` vérifie la session SAC, l'appareil, le rôle et la participation à l'alerte active.
- Il émet un ticket HMAC de courte durée et à usage unique. Seule l'empreinte SHA-256 du ticket et ses métadonnées techniques sont conservées dans D1 ; aucun contenu GPS n'y est écrit.
- Le ticket est transmis au WebSocket par le sous-protocole WebSocket, pas dans l'URL.
- Le Worker vérifie le ticket, consomme son empreinte atomiquement et rattache la connexion au compte, à l'appareil, à la session et au rôle issus du ticket vérifié.
- Lorsqu'une clé de session est annoncée, le Worker ajoute lui-même l'identité du compte et de l'appareil authentifiés. Ces identifiants ne sont pas acceptés depuis le message client.
- Le client vérifie la signature du bundle et sa correspondance exacte avec le compte/appareil authentifiés, l'alerte et la session. Les clés ECDH de transport sont éphémères et dérivées séparément pour chaque direction.
- Une annonce non authentifiée, incohérente, expirée ou liée à une autre alerte/session est rejetée. Les positions ne sont jamais transmises à cette connexion.
- La sécurité de cette liaison dépend de la sécurité des sessions et de l'authentification SAC. Une compromission d'un compte ou d'une session autorisée reste un risque à traiter par les contrôles généraux de session et de révocation SAC.

Aucune interface ni documentation destinée aux utilisateurs ne doit demander une comparaison, une copie, une saisie ou une confirmation d'empreinte.

## Relais Cloudflare

- Worker : `sac-gps-relay`.
- Durable Object : `GpsRelayRoom`.
- Connexions WebSocket non hibernatables conservées uniquement en mémoire de l'instance.
- Aucun stockage Durable Object, SQLite, attachment sérialisé ou autre stockage persistant pour les sockets, clés ou paquets GPS.
- Cette décision évite de restaurer une session GPS depuis un état persistant. Elle implique que l'objet reste actif tant que les connexions restent ouvertes ; les coûts et la stabilité doivent être suivis.
- Le Worker vérifie à nouveau la participation active avant le traitement des messages. Les rôles et les connexions sont isolés par alerte.
- Les messages de position sont chiffrés côté client. Le relais ne doit jamais les déchiffrer, les journaliser ou les conserver.
- La configuration de production utilise le verrou `GPS_RELAY_E2EE_READY=true` et un secret HMAC Cloudflare. Les valeurs secrètes ne sont jamais ajoutées au dépôt.

## Client web

- Service de géolocalisation : `src/services/location/live-geolocation.ts`.
- Transport et accord de clés : `src/services/location/sos-location-relay.ts` et `src/services/location/location-session.ts`.
- Interface : `src/components/SosLiveLocation.tsx`.
- Le client utilise `navigator.geolocation.watchPosition` avec haute précision, `maximumAge: 0` et un délai de 15 secondes.
- Le suivi est arrêté si l'alerte est clôturée, si le composant est démonté, si aucun destinataire ne reste connecté ou si la session expire.
- Les coordonnées reçues ne sont affichées que dans l'espace du destinataire et sont présentées comme non archivées.
- La PWA doit rester ouverte au premier plan pour le suivi fiable dans cette version. Le suivi en arrière-plan, application fermée, n'est pas garanti sans intégration native Android/iOS.
- Les utilisateurs ne doivent jamais voir « GPS actif » avant réception effective d'une position et établissement du canal sécurisé.

## Déploiement et validation

- Dépôt : `benwahab/SAC`, branche `main`.
- Pages : projet `sac`, production `https://sac-3xh.pages.dev`.
- Worker GPS : `sac-gps-relay`.
- D1 : `sac-db`. La base contient uniquement les empreintes de tickets à usage unique et les métadonnées d'autorisation nécessaires, jamais des coordonnées GPS.
- Le code de suppression de la procédure manuelle a passé la CI et le build Pages de production a été déployé le 20 novembre 2026.
- Le fonctionnement cryptographique et le parcours applicatif ont des tests automatisés. Un test de bout en bout avec deux téléphones physiques, deux comptes SAC réellement associés à une alerte et une permission GPS accordée reste nécessaire avant de déclarer la validation terrain complète.
- Aucun test ne doit déclencher un vrai SOS, un SMS ou une notification Push à des proches réels.

## Contrôles de non-régression

Avant chaque évolution du GPS, vérifier au minimum :

1. Aucun composant, libellé, route ou parcours ne réintroduit la comparaison manuelle d'empreintes.
2. Un compte/appareil non participant à l'alerte ne peut pas obtenir de ticket ni rejoindre son relais.
3. Un ticket expiré ou déjà consommé est rejeté.
4. Une annonce de clé dont le compte/appareil ne correspond pas à la connexion authentifiée est rejetée.
5. Une position ne peut pas être déchiffrée dans une autre alerte, session ou direction.
6. Une position rejouée ou malformée est rejetée.
7. La clôture de l'alerte arrête le suivi et efface immédiatement les coordonnées et clés en mémoire.
8. Aucune coordonnée n'apparaît dans D1, R2, logs, traces, URL, sauvegardes ou historique.
9. Le refus de permission, la perte du réseau et la déconnexion d'un destinataire échouent de manière sûre et avec un message clair.
10. Aucun vrai Push ou SMS n'est envoyé pendant les tests.

## Historique de décision

Le mécanisme initial d'épinglage manuel des empreintes a été retiré à la demande explicite du propriétaire du produit. Il ne fait pas partie du parcours SAC et ne doit pas être réintroduit. La vérification cryptographique et l'autorisation restent obligatoires, mais elles sont exécutées automatiquement à partir de l'identité de session vérifiée par SAC.
