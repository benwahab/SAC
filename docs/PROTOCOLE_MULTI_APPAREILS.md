# SAC — Proposition de protocole multi-appareils

**Statut : proposition technique à valider — non implémentée, non homologuée pour la production.**

Ce document précise une piste de conception pour permettre à un même compte SAC d'utiliser plusieurs appareils sans copier les clés privées. Il ne constitue pas une décision produit supplémentaire ni une garantie cryptographique déjà acquise.

## 1. Objectifs et invariants

- Un compte SAC représente une personne ; plusieurs appareils enregistrés restent rattachés à ce compte.
- Chaque appareil crée et conserve ses propres clés privées.
- Le serveur ne reçoit que des clés publiques, certificats, empreintes et métadonnées d'appareils.
- Un OTP ou la seule possession du mot de passe ne remplace pas l'approbation cryptographique d'un nouvel appareil.
- Un serveur compromis ne doit pas pouvoir remplacer silencieusement une clé d'appareil déjà approuvée.
- La récupération du compte ne restaure pas automatiquement la confiance cryptographique ni les anciennes clés GPS.
- Les alertes essentielles restent indépendantes de la disponibilité du protocole de chiffrement GPS.
- Aucun GPS précis n'est ajouté à D1, R2, aux journaux ou à un stockage serveur persistant par ce protocole.

## 2. Hiérarchie de clés proposée

### 2.1 Clé d'identité racine du compte

À la première activation cryptographique, le premier appareil crée une paire de signature d'identité racine (piste actuelle : ECDSA P-256 / SHA-256). La clé privée racine reste non exportable et liée au terminal qui l'a créée ; la clé publique et son empreinte constituent l'identité cryptographique du compte présentée aux contacts.

La clé privée racine n'est pas synchronisée vers les autres appareils. Dans cette première proposition, seul l'appareil racine (dit appareil maître) peut approuver l'ajout d'un appareil. Les autres appareils actifs ne peuvent pas approuver à leur tour de nouveaux appareils. Une délégation d'approbation multi-niveaux serait une évolution distincte.

### 2.2 Clés propres à chaque appareil

Chaque appareil génère localement une paire ECDSA de signature, une paire ECDH P-256 pour l'accord de clé, et des identifiants aléatoires opaques avec un nonce d'enrôlement. Les clés privées ne quittent jamais l'appareil.

Le certificat d'appareil lie au minimum l'identifiant du compte, l'identifiant d'appareil, les clés publiques de signature et d'échange, la version du protocole, les usages autorisés et un identifiant de cérémonie d'enrôlement. La clé racine signe ce certificat après approbation explicite.

Les contacts peuvent vérifier la signature du certificat à partir de la clé publique racine qu'ils ont déjà authentifiée indépendamment. Une clé d'appareil auto-présentée par le serveur n'est jamais considérée comme approuvée.

### 2.3 Clés de session GPS

Les clés de session GPS sont distinctes des clés d'identité et des clés d'appareil. Elles doivent être limitées à leur contexte (session, auteur, appareil, destinataire). La distribution des clés GPS entre appareils et contacts reste un sous-protocole à spécifier ; le prototype ECDH/HKDF existant ne suffit pas à lui seul.

## 3. Cérémonie d'ajout d'un appareil

1. L'utilisateur ouvre Ajouter un appareil depuis son nouvel appareil et s'authentifie au compte.
2. Le nouvel appareil génère localement ses paires de clés et un nonce aléatoire à usage unique. Il s'enregistre avec le statut pending_verification.
3. Le nouvel appareil affiche un QR ou code de jumelage contenant un identifiant de cérémonie, un défi aléatoire, les clés publiques proposées et une expiration courte. Aucun secret privé ni jeton de session n'y figure.
4. L'utilisateur ouvre SAC sur l'appareil racine déjà actif, scanne le QR et voit le nom/type du nouvel appareil ainsi que les empreintes des clés publiques.
5. Les deux écrans affichent une valeur de comparaison dérivée de l'intégralité du transcript : compte, appareils, clés publiques, nonces, défi, version et usages. L'utilisateur compare cette valeur en présence physique ou par canal vocal indépendant. Le QR seul ne constitue pas une preuve si son origine n'est pas authentifiée.
6. L'utilisateur confirme explicitement sur l'appareil racine. Celui-ci signe le certificat d'appareil et le transcript de la cérémonie avec la clé racine.
7. Le nouvel appareil vérifie la signature avec la clé publique racine déjà épinglée, puis vérifie que le défi, le nonce, le compte, l'identifiant d'appareil, les clés et l'expiration correspondent exactement à sa demande.
8. Le serveur valide le certificat signé, l'absence de rejeu et l'état du compte. Il passe l'appareil à active seulement après validation complète.
9. L'utilisateur reçoit une notification de sécurité sur les appareils déjà actifs.

Le défi est à usage unique, expire rapidement et est lié à un compte et à deux appareils précis. Les durées exactes, formats de QR, encodage canonique et représentation lisible de la valeur de comparaison devront être fixés dans une spécification versionnée et testée.

## 4. Appareil racine perdu ou remplacé

### Appareil racine encore disponible

L'utilisateur peut enregistrer un nouvel appareil racine par une cérémonie de remplacement signée par l'ancienne clé racine. Le nouvel appareil génère une nouvelle clé racine ; l'ancienne racine signe explicitement la transition. Les contacts reçoivent une preuve de rotation et vérifient la continuité selon la politique de confiance à définir.

### Tous les appareils approuvés sont perdus

L'authentification du compte peut être récupérée selon le mécanisme retenu, mais elle ne reconstitue pas la clé privée racine. Une nouvelle racine est créée. Le compte passe en état identity_reverification_required pour les échanges GPS ; chaque contact doit vérifier indépendamment la nouvelle empreinte avant tout nouveau partage chiffré.

Aucun SMS, e-mail, support administratif, sauvegarde de base de données ou restauration Cloudflare ne peut déclarer automatiquement la nouvelle racine digne de confiance. Les anciennes clés GPS locales ne sont pas restaurées par cette procédure.

## 5. Révocation d'un appareil

La révocation est une opération authentifiée et atomique côté serveur : marquer l'appareil revoked ; invalider ses sessions et jetons de rafraîchissement ; révoquer ses abonnements push ; refuser ses nouvelles requêtes et opérations sensibles ; refuser ses clés pour de nouveaux partages ; invalider les autorisations de partage en cours initiées par cet appareil selon les règles de session ; enregistrer un événement d'audit sans GPS ni secret ; notifier les autres appareils actifs.

La révocation n'efface pas physiquement un appareil hors ligne. Elle ne prouve pas la suppression de ses clés privées ou des archives locales. L'interface doit dire accès révoqué et non données effacées à distance. Au retour en ligne, l'appareil révoqué doit être bloqué avant toute lecture de données serveur.

## 6. États proposés

| État | Signification | Accès |
|---|---|---|
| pending_verification | Enrôlement commencé, cérémonie non approuvée | Aucun accès aux données privées |
| active | Certificat racine valide et appareil autorisé | Accès selon droits du compte |
| revoked | Appareil révoqué ou certificat invalidé | Aucun nouvel accès serveur |
| identity_reverification_required | Identité racine renouvelée après récupération | Partage GPS bloqué jusqu'à vérification des contacts |

Les transitions sont contrôlées côté serveur. Un client ne peut pas s'attribuer l'état active.

## 7. Modèle de données conceptuel

- user_devices : identifiant opaque, compte, libellé, plateforme, statut et dates d'enregistrement/vérification/dernière activité/révocation.
- account_identity_keys : clé publique racine, empreinte, version, statut et dates ; aucune clé privée.
- device_public_keys : appareil, usage, algorithme, clé publique, empreinte, version et dates de validité.
- device_certificates : transcript canonique signé par la racine, signature, défi/nonce consommé, expiration et résultat de vérification.
- device_sessions : appareil propriétaire, empreinte du jeton ou identifiant non secret, expiration et révocation ; aucun jeton en clair.
- device_push_subscriptions : abonnement propre à l'appareil, protégé et révocable indépendamment.

Les noms et colonnes définitifs restent à valider avec le schéma relationnel complet et les contraintes de confidentialité.

## 8. Contrats API indicatifs

- GET /api/devices — lister les appareils du compte authentifié.
- POST /api/devices/enroll — créer une demande en attente avec les clés publiques et le défi.
- POST /api/devices/{deviceId}/approve — soumettre le certificat et la signature racine.
- POST /api/devices/{deviceId}/revoke — révoquer un appareil et ses sessions.
- PATCH /api/devices/{deviceId} — modifier le libellé autorisé.
- POST /api/account-identity/rotate — enregistrer une transition de racine signée par l'ancienne racine.
- POST /api/account-identity/recover — lancer une récupération qui exige une nouvelle vérification indépendante des contacts.

Ce sont des contrats de conception, pas des endpoints présents. Chaque requête devra contrôler l'authentification, l'autorisation, l'appartenance au compte, la signature, la version, l'expiration, l'anti-rejeu, l'idempotence et la limitation de débit.

## 9. Tests adversariaux obligatoires

- Un nouvel appareil ne peut pas s'activer avec un OTP seul.
- Une signature racine invalide, une clé publique substituée ou un transcript altéré est rejeté.
- Un défi expiré ou déjà consommé est rejeté.
- Un certificat destiné à un autre compte ou appareil est rejeté.
- Un serveur qui remplace une clé publique après approbation ne peut pas produire une signature racine valide.
- Un appareil secondaire ne peut pas approuver un troisième appareil dans la version initiale.
- La révocation de B invalide B sans déconnecter A.
- Un appareil révoqué hors ligne n'est pas présenté comme effacé.
- Une récupération après perte de la racine impose une nouvelle vérification indépendante des contacts.
- Une rotation signée par l'ancienne racine est distinguée d'une récupération sans ancienne clé.
- Les certificats et clés sont liés aux usages ; pas de confusion entre signature, accord ECDH et chiffrement GPS.
- Aucun secret privé, jeton, OTP ou GPS n'apparaît dans les logs, notifications, D1, R2 ou exports.
- L'échec du protocole GPS ne bloque pas une alerte SOS essentielle.
- Tests de concurrence, rejeu, horloge décalée, réseau interrompu, PWA réinstallée, Android et iOS.

## 10. Limites et décisions encore nécessaires

1. Valider ou refuser le modèle d'un seul appareil racine approbateur. Il est simple à auditer, mais constitue un point unique d'approbation et peut être indisponible si l'appareil racine est perdu.
2. Définir le mécanisme d'authentification du compte et la récupération d'accès.
3. Définir l'algorithme et l'encodage canonique exacts du transcript et des certificats.
4. Évaluer WebCrypto en PWA puis Android Keystore/iOS Keychain en natif ; non-exportable ne signifie pas automatiquement matériellement protégé.
5. Concevoir la révocation des clés GPS et le traitement des partages en cours.
6. Définir les conséquences de la rotation d'identité pour les contacts déjà vérifiés.
7. Définir comment les contacts reçoivent et valident les certificats d'appareils du compte.
8. Prouver que les opérations de révocation et de récupération restent fiables en cas de restauration de base de données.

**Interdictions tant que ces points ne sont pas validés :** pas de synchronisation de clé privée, pas de récupération silencieuse de l'identité, pas de migration D1, pas d'endpoint en production, pas de GPS réel relié au prototype, pas de déclaration de sécurité de production.

## 11. Relation avec la règle GPS J+30

Ce protocole ne change pas la règle stricte de destruction des données GPS après 30 jours. Les clés d'identité de compte et les clés d'appareil ne doivent jamais devenir des moyens de restaurer une clé GPS expirée. Les clés GPS doivent rester séparées, limitées à leur session et détruites selon une architecture dont l'irréversibilité J+30 reste à démontrer. La récupération d'un compte ou l'ajout d'un appareil ne doit pas réintroduire des coordonnées expirées.