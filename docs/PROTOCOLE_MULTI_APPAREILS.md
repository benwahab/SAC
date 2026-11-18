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
## 12. Revue de conception préliminaire — points de sécurité corrigés ou bloquants

### 12.1 Amorçage de la confiance sur le nouvel appareil

Le nouvel appareil ne peut pas considérer comme fiable une clé publique racine simplement téléchargée depuis le serveur : un serveur compromis pourrait substituer sa propre clé. La mention d'une clé racine « déjà épinglée » dans la procédure doit donc être satisfaite par une cérémonie d'amorçage explicite.

Procédure à spécifier : le nouvel appareil crée un défi aléatoire et ses clés publiques ; l'appareil racine signe un transcript canonique contenant le compte, les identifiants des deux appareils, toutes les clés publiques, les nonces, le défi, les usages et la version du protocole. L'appareil racine transmet au nouvel appareil sa clé publique racine, le certificat et la signature. Les deux appareils calculent indépendamment une courte valeur de comparaison à partir du transcript complet. L'utilisateur compare la même valeur affichée sur les deux écrans, idéalement en présence physique ou par canal vocal indépendant, puis confirme sur les deux appareils. En cas de différence, d'interruption ou d'expiration, l'enrôlement échoue sans activation.

Un QR code seul, ou une clé racine fournie par le serveur, ne suffit pas à authentifier l'identité racine. L'encodage canonique, le calcul de la valeur de comparaison, sa longueur et sa résistance aux erreurs doivent être fixés et revus avant implémentation.

### 12.2 Limites de la clé racine sur PWA

Une clé WebCrypto marquée non exportable ne prouve pas à elle seule un stockage matériel, une résistance à la copie du profil navigateur ou une persistance après réinstallation. La PWA peut servir au parcours initial, mais ne doit pas être présentée comme offrant les mêmes garanties qu'une clé protégée par Android Keystore/TEE/StrongBox ou iOS Keychain avec les attributs adaptés. Les capacités réelles doivent être détectées et affichées honnêtement ; aucune garantie matérielle ne doit être supposée.

### 12.3 Appareil racine : disponibilité et récupération

Le modèle d'un appareil racine unique est une proposition simple, mais il crée un point unique d'approbation et de disponibilité. Si cet appareil est perdu, éteint ou endommagé, aucun nouvel appareil ne peut être approuvé par la voie normale. La récupération du compte avec nouvelle identité et revérification des contacts est donc une procédure de sécurité essentielle, pas une exception administrative. Le modèle ne doit pas être déclaré définitif avant validation de cette conséquence.

### 12.4 Révocation et concurrence

La révocation serveur doit avoir une sémantique transactionnelle et idempotente : après validation de la révocation, toute requête authentifiée avec une session de l'appareil révoqué doit échouer, même si un jeton non expiré existe. Les opérations d'approbation et de révocation concurrentes doivent être sérialisées ; une révocation ne peut jamais être annulée par une approbation tardive ou un rejeu de certificat. Un identifiant de cérémonie ne peut être consommé qu'une fois.

### 12.5 Limite du contrat de domaine ajouté au dépôt

Le module `src/domain/device-management.ts` est un contrat métier pur pour les états pending_verification, active et revoked. Il vérifie des transitions et des invariants d'horodatage ; il n'authentifie pas l'acteur, ne valide aucune signature, ne consulte aucune base, n'invalide aucune session et ne protège aucun endpoint. Tous ces contrôles restent obligatoires côté serveur. Les tests du module ne prouvent donc pas la sécurité du protocole cryptographique complet.

### 12.6 Décision produit validée — appareil racine unique

**Validé explicitement par l'utilisateur le 17 novembre 2026.** Dans la première version, le premier appareil approuvé constitue l'unique appareil racine autorisé à approuver les nouveaux appareils. Les appareils secondaires ne peuvent pas approuver d'autres appareils. Si tous les appareils approuvés sont perdus, la récupération d'accès au compte ne restaure pas l'ancienne identité cryptographique : une nouvelle identité est créée et les contacts doivent vérifier indépendamment sa nouvelle empreinte avant tout partage GPS.

La conséquence acceptée est un point unique d'approbation et une dépendance à l'appareil racine. Cette décision produit n'est pas une validation cryptographique indépendante. Restent obligatoires avant connexion au GPS réel : spécification du transcript canonique signé, UX de comparaison indépendante, expiration et anti-rejeu de la cérémonie, récupération/rotation, tests adversariaux et revue cryptographique indépendante. Les API et migrations ne sont pas encore implémentées.

### 12.7 Résultat des tests du contrat de cycle de vie

Le contrat métier pur `src/domain/device-management.ts` et ses 14 tests (`tests/device-lifecycle.test.ts`) ont été intégrés au dépôt. La CI run `44191818016` sur le commit `eab16e659bd6d8759747f466d4dab57962178005` a réussi : typecheck, test du contrat appareil, tests crypto existants, build et audit bloquant des dépendances de production. Ce résultat valide uniquement le code de transition local ; il ne valide pas le protocole d'identité racine, les API, la persistance ni le comportement multi-appareils réel.

## 13. Cérémonie d'enrôlement — spécification technique proposée

Cette section transforme le principe validé de l'appareil racine unique en un protocole vérifiable. Les paramètres ci-dessous sont une proposition d'ingénierie à soumettre à une revue cryptographique indépendante ; ils ne doivent pas être codés en production avant cette revue.

### 13.1 Acteurs et responsabilités

- **Appareil racine (R)** : seul appareil déjà approuvé ; il détient localement la clé privée de signature racine et autorise l'ajout d'un appareil.
- **Nouvel appareil (N)** : génère ses propres clés locales et ne reçoit jamais les clés privées de R.
- **Serveur SAC** : orchestre la cérémonie, vérifie l'état du compte et consomme les défis ; il ne peut ni signer à la place de R ni décider seul que N est digne de confiance.
- **Utilisateur** : compare la valeur de sécurité affichée sur R et N par un canal indépendant du serveur avant de confirmer.

### 13.2 Matériel cryptographique proposé

- Identité racine : ECDSA P-256 avec SHA-256, clé privée non exportable sur l'appareil racine.
- Identité propre à chaque appareil : paire ECDSA P-256/SHA-256 locale.
- Échange propre à chaque appareil : paire ECDH P-256 locale.
- Dérivation des clés de transport : HKDF-SHA-256 avec sel aléatoire de 32 octets et contexte de protocole/version/compte/cérémonie/appareils.
- Chiffrement de transport : AES-256-GCM avec nonce aléatoire de 96 bits, jamais réutilisé avec une même clé.
- Encodage du transcript : JSON Canonicalization Scheme (RFC 8785), champs strictement définis, identifiants opaques ASCII et rejet des champs inconnus, doublons, tailles excessives et versions non supportées.

Ces choix sont cohérents avec les primitives expérimentales déjà isolées dans le dépôt, mais cette cohérence ne constitue pas une preuve de sécurité. Toute modification d'algorithme ou de paramètre doit incrémenter la version du protocole et être revue.

### 13.3 Déroulement proposé

1. N génère localement sa paire ECDSA et sa paire ECDH ; les clés privées sont marquées non exportables lorsque la plateforme le permet.
2. N demande une cérémonie au serveur. Le serveur crée un `ceremonyId` aléatoire, un défi imprévisible d'au moins 256 bits, une expiration courte (proposition : 120 secondes) et l'état `pending`. Le serveur conserve uniquement les données publiques et le défi, jamais de clé privée ni de GPS.
3. N affiche un QR temporaire contenant le `ceremonyId`, le défi, les clés publiques de N, les identifiants opaques de compte/appareil, la version de protocole et l'expiration. Aucun secret privé ni donnée de localisation n'est inclus.
4. R scanne le QR et récupère auprès du serveur le transcript complet de la demande. R vérifie l'appartenance au compte, l'état pending, l'expiration, la version, l'absence d'utilisation antérieure et les limites de taille.
5. R construit le transcript canonique complet : version, compte, identifiant de R, identifiant de N, empreintes des clés publiques racine et appareil, clés publiques ECDSA/ECDH de N, défi serveur, nonce de R, nonce de N, identifiant de cérémonie, usages autorisés et expiration.
6. R signe les octets canoniques du transcript avec la clé privée racine. La signature et le transcript sont transmis à N via le serveur.
7. R et N calculent indépendamment une courte valeur de comparaison à partir du hash SHA-256 du transcript canonique et de la signature racine. Proposition : six mots choisis dans une liste publique figée d'au moins 2 048 entrées, soit au moins 66 bits de comparaison. L'algorithme d'extraction, la liste, l'ordre et la version doivent être identiques sur toutes les plateformes.
8. L'utilisateur compare les six mots affichés sur les deux écrans, en présence physique ou via un canal vocal indépendant. Il confirme séparément sur R et N. Un QR ou un message reçu par le même serveur ne remplace jamais cette comparaison.
9. Après confirmation, R approuve et signe un certificat d'appareil qui lie compte, appareil, clés publiques, usages, version, cérémonie et transcript. N vérifie la signature et les liaisons exactes.
10. Le serveur effectue une activation atomique : le défi passe une seule fois de pending à consumed, l'appareil passe à active, le certificat public est enregistré et les appareils existants reçoivent une notification sans données GPS.

### 13.4 Règles d'échec obligatoires

- Une expiration, une différence de mots, un refus sur l'un des deux appareils, une perte réseau ambiguë, une signature invalide ou un transcript différent annule la cérémonie.
- Un défi expiré, consommé ou révoqué ne peut jamais être réutilisé ; un nouvel essai crée un nouvel identifiant et un nouveau défi.
- Le serveur doit faire la consommation du défi et l'activation dans une transaction atomique ou un mécanisme équivalent garantissant l'unicité.
- Les demandes concurrentes sont sérialisées par compte et par appareil racine ; une révocation gagne contre une approbation concurrente si elle est validée en premier, et aucun certificat révoqué ne peut être réactivé.
- Les logs, erreurs, analytics et notifications ne contiennent ni QR complet, ni défi, ni transcript complet, ni signature sensible, ni clé privée, ni GPS. Les métadonnées nécessaires au diagnostic doivent être minimisées.
- En cas de résultat incertain après coupure réseau, l'interface affiche « vérification à reprendre » et interroge l'état serveur ; elle ne déclare jamais l'appareil actif sur la seule base d'une confirmation locale.

### 13.5 Limites de la comparaison indépendante

La comparaison SAS vise à détecter une substitution pendant le jumelage ; elle ne protège pas si l'utilisateur confirme sans comparer, si les deux écrans sont contrôlés par un attaquant ou si l'application compromise affiche une valeur mensongère. L'interface doit exiger une confirmation explicite sur les deux appareils et expliquer de recommencer en cas de différence. Le jumelage à distance sans canal indépendant est refusé dans la première version.

### 13.6 Rotation et récupération de la racine

- Si R est encore disponible, une rotation de racine doit être signée par l'ancienne racine et par la nouvelle, avec un transcript de transition qui lie explicitement les deux empreintes et un événement d'audit.
- Si aucun appareil approuvé ne subsiste, la récupération d'accès au compte ne restaure jamais l'ancienne clé racine. Une nouvelle racine est créée ; les contacts doivent revérifier indépendamment son empreinte avant toute nouvelle transmission GPS.
- Une récupération ne restaure jamais des clés GPS expirées ni une archive GPS supprimée au terme de J+30.
- L'ancien certificat racine est révoqué côté serveur ; les certificats et sessions antérieurs ne doivent pas être silencieusement transférés à la nouvelle identité.

### 13.7 Tests adversariaux préalables à l'implémentation

- substitution de la clé racine, de la clé ECDSA ou de la clé ECDH dans le QR ou la réponse serveur ;
- altération d'un champ, changement d'ordre/encodage, doublon de champ, version inconnue ou identifiant de compte différent ;
- rejeu du même QR, défi, signature, confirmation ou requête d'activation ;
- défi expiré, horloge locale fausse, requêtes simultanées, timeout après commit et reconnexion ;
- appareil racine révoqué pendant la cérémonie, appareil N révoqué avant activation, deux ajouts concurrents ;
- comparaison SAS différente, confirmation manquante sur l'un des écrans, tentative de jumelage distant sans canal indépendant ;
- perte de R, perte de tous les appareils, restauration de sauvegarde, réinstallation, changement de téléphone et rotation de racine ;
- PWA sur navigateurs et profils différents, Android avec/sans matériel sécurisé disponible, iOS avec politiques Keychain applicables.

**État :** spécification proposée, pas encore revue ni implémentée. L'approbation produit du modèle racine unique est acquise ; la revue cryptographique indépendante reste un verrou avant l'activation réelle.
## 14. Revue interne des primitives cryptographiques

Une revue interne préliminaire des prototypes ECDH/ECDSA et AES-GCM est consignée dans [REVUE_CRYPTO_PRELIMINAIRE.md](REVUE_CRYPTO_PRELIMINAIRE.md). Elle décrit les durcissements apportés aux validations, à l'encodage HKDF et aux bundles signés, ainsi que les risques encore bloquants.

Cette revue n'est pas indépendante et ne certifie pas le protocole. En particulier, le prototype HKDF v4 lie maintenant compte, cérémonie, session, émetteur, destinataire, usage et algorithme ; l'authenticité des identifiants dépend toujours des certificats d'appareils ; les clés AES-GCM sont séparées par direction ; l'amorçage de la racine, les certificats, la révocation, la récupération, le stockage matériel et la destruction J+30 restent à concevoir et à tester.

**Interdiction maintenue :** ne pas connecter ces prototypes aux coordonnées GPS réelles avant revue cryptographique indépendante et preuve séparée de destruction irréversible J+30.

## 15. Amorçage de la première identité racine — proposition

Cette section traite le cas particulier où aucun appareil racine ni aucune empreinte cryptographique préalablement approuvée n'existe encore. Elle complète la cérémonie d'enrôlement ; elle ne constitue pas une décision sur le fournisseur ou la méthode définitive d'authentification du compte.

### 15.1 Deux preuves différentes à ne pas confondre

L'authentification du compte prouve que la personne a franchi le mécanisme d'accès au compte SAC. La preuve de possession de clé prouve que le terminal détient la clé privée correspondant à une clé publique. **Aucune de ces deux preuves, seule ou combinée, ne prouve à un contact que la première clé publique présentée est réellement celle de la personne attendue.**

La première identité est donc une racine de confiance initiale. Pour chaque contact, son empreinte doit être vérifiée par un canal indépendant du serveur SAC (présence physique ou appel vocal indépendant, par exemple). Une empreinte simplement affichée, envoyée ou confirmée par le même serveur qui héberge la clé n'est pas une vérification indépendante.

### 15.2 Séquence d'initialisation proposée

1. L'utilisateur termine l'authentification du compte SAC selon un mécanisme fort qui reste à spécifier. La session authentifiée autorise une tentative d'initialisation, mais ne rend pas automatiquement la clé racine digne de confiance pour les contacts.
2. Le premier terminal génère localement une nouvelle paire de signature racine. La clé privée ne doit jamais être exportée, téléversée, synchronisée ou incluse dans une sauvegarde SAC.
3. Le terminal crée un identifiant de cérémonie aléatoire et une preuve de possession : un défi serveur imprévisible, à usage unique, lié à l'identifiant du compte, à la clé publique racine, à la version du protocole et à l'expiration. Le terminal signe le transcript exact avec la clé privée nouvellement créée.
4. Le serveur vérifie la signature et l'authentification de la session, puis tente d'enregistrer la clé publique comme racine initiale au moyen d'une opération atomique conditionnelle : « créer seulement si aucune racine n'existe ». Il ne doit exister aucun chemin de mise à jour implicite ou de remplacement silencieux.
5. Si deux terminaux tentent l'initialisation simultanément, un seul gagne la création atomique. L'autre reçoit un état explicite « identité déjà initialisée » et ne peut ni écraser ni remplacer la racine existante.
6. Le terminal affiche l'empreinte complète de la clé racine et explique qu'elle doit être communiquée aux contacts par un canal indépendant. Aucun partage GPS avec un contact n'est autorisé tant que ce contact n'a pas vérifié et épinglé cette empreinte.
7. Le serveur conserve uniquement la clé publique, sa version, son empreinte, l'état et les métadonnées strictement nécessaires. La preuve de possession et les défis consommés ne doivent pas être réutilisables ; les journaux ne contiennent aucun secret.

### 15.3 Limite fondamentale — première confiance et serveur compromis

Lors de la toute première initialisation, il n'existe pas encore d'ancienne clé racine permettant de détecter une substitution. Une signature valide prouve que le terminal possède la clé privée associée à la clé publique soumise ; elle ne prouve pas que le serveur n'a pas substitué une autre racine dans sa réponse ou dans son stockage.

La protection contre cette substitution repose donc sur l'ancrage indépendant de l'empreinte par chaque contact. Si l'utilisateur et ses contacts ne comparent pas l'empreinte via un canal indépendant, la première identité reste exposée à une attaque de type « première confiance » (TOFU). SAC ne doit pas présenter l'initialisation comme résistante à un serveur entièrement compromis tant qu'un mécanisme d'ancrage indépendant et audité ne le démontre pas.

### 15.4 Règles serveur et états

- Une seule racine initiale peut être créée par compte ; contrainte d'unicité et transaction atomique obligatoires.
- Une requête répétée avec le même identifiant de cérémonie est idempotente et retourne le résultat déjà établi, sans créer une seconde racine.
- Un défi expiré, consommé, associé à une autre clé ou à un autre compte est rejeté.
- Une racine existante ne peut être remplacée que par la procédure de rotation signée par l'ancienne racine, ou par la procédure de récupération explicitement définie après perte de tous les appareils.
- L'OTP, la réinitialisation du mot de passe, l'assistance ou la seule session web ne peuvent jamais remplacer silencieusement la racine.
- En cas de résultat réseau incertain, le client relit l'état d'initialisation et compare l'empreinte complète ; il ne génère pas une nouvelle racine automatiquement.
- Tant que l'identité n'est pas initialisée et ancrée par les contacts requis, l'état GPS reste bloqué. L'envoi d'une alerte SOS non-GPS ne doit pas être bloqué par cette étape.

### 15.5 Tests adversariaux obligatoires

- Deux premières initialisations simultanées : exactement une racine créée, aucune écriture perdue ou écrasée.
- Rejeu d'un défi, d'une signature ou d'une cérémonie déjà consommée : rejet ou réponse idempotente sans nouvel effet.
- Substitution de la clé publique entre la signature du terminal et l'enregistrement serveur : échec de vérification.
- Réponse serveur présentant une empreinte différente de celle générée localement : alerte bloquante et aucune activation GPS.
- Compte déjà initialisé : tentative d'initialisation simple refusée, aucune mutation de la racine.
- Réinitialisation du mot de passe ou OTP : aucune modification de l'identité cryptographique.
- Perte réseau avant/après commit : état récupéré sans création d'une deuxième racine.
- Contact qui reçoit l'empreinte uniquement par SAC : état non vérifié ; partage GPS refusé.
- Contact qui compare l'empreinte par canal indépendant : état vérifié seulement après confirmation explicite et traçable.
- Récupération après perte de tous les appareils : nouvelle racine distincte, ancienne racine non restaurée et nouvelle vérification indépendante des contacts.

**État :** proposition de sécurité à examiner en revue indépendante. Le mécanisme d'authentification forte du compte, le format exact du transcript, les preuves de possession, le stockage de la racine et l'interface de vérification des contacts ne sont pas encore implémentés. Aucun schéma D1 ni endpoint n'est créé par cette spécification.


## 16. Séparation des clés de transport par direction — prototype ajouté

Le prototype local `src/services/location/key-exchange.ts` expose désormais `deriveLocationDirectionalKey`.

- Les deux appareils reçoivent les mêmes identifiants canoniques de session, d'émetteur et de destinataire.
- Le contexte HKDF versionné v4 inclut le compte, la cérémonie, la session, l'émetteur, le destinataire, l'usage « location-payload » et l'algorithme AES-256-GCM.
- L'appareil identifié comme émetteur obtient une CryptoKey utilisable uniquement pour `encrypt`.
- L'appareil identifié comme destinataire obtient la clé correspondante utilisable uniquement pour `decrypt`.
- Le sens inverse inverse les identifiants émetteur/destinataire : il produit une clé distincte et les usages WebCrypto sont eux aussi inversés.
- Un identifiant local qui ne correspond ni à l'émetteur ni au destinataire est refusé.

Les tests couvrent le déchiffrement normal, l'échec avec la clé du sens inverse, l'impossibilité d'utiliser une clé de réception pour chiffrer, et le refus d'un appareil étranger.

**Limites et conditions restantes :** la fonction HKDF ne vérifie pas elle-même les certificats. Un prototype séparé de certificat d'appareil secondaire signé ECDSA P-256 par une clé racine de confiance est ajouté dans `src/services/device/device-certificate.ts`. Le vérificateur exige une clé racine fournie comme ancre de confiance par l'appelant ; il ne fait jamais confiance à une clé racine reçue du serveur ou du certificat. Ce certificat lie compte, appareil, plateforme, date, clés publiques et empreinte racine. Il ne gère pas la révocation serveur, les sessions, la cérémonie complète ni la persistance. Il reste à intégrer la vérification du certificat avant toute dérivation, et à lier les identifiants de session au transcript signé. La version du prototype n'est pas une autorisation de transport GPS réel.

**État :** séparation directionnelle expérimentale implémentée et testée en CI ; revue cryptographique indépendante, contexte final complet, authentification des appareils et preuve J+30 toujours obligatoires.


## 17. Contexte HKDF v4 — compte et cérémonie

Le prototype de dérivation directionnelle lie maintenant explicitement le compte et l'identifiant de cérémonie, en plus de la session, de l'émetteur, du destinataire, de l'usage et de l'algorithme. Les tests vérifient qu'une clé dérivée pour un autre compte ou une autre cérémonie ne déchiffre pas le paquet.

Cette liaison contextuelle ne remplace pas l'authentification des appareils : les identifiants d'émetteur et de destinataire doivent provenir de certificats valides signés sous la racine de confiance. La fonction reste expérimentale et non connectée aux positions GPS.


## 18. Certificat expérimental d'appareil secondaire signé par la racine

Le dépôt contient maintenant `src/services/device/device-certificate.ts`. Il permet à une clé racine ECDSA P-256 déjà approuvée de signer un certificat secondaire qui lie :
- l'identifiant du compte et l'identifiant stable de l'appareil ;
- la plateforme (web, Android ou iOS) et la date canonique d'émission ;
- la clé publique d'identité ECDSA P-256 et la clé publique d'échange ECDH P-256 ;
- l'empreinte de la clé racine qui a signé le certificat ;
- le domaine d'usage fixe du certificat (échange de localisation SAC).

La vérification reçoit obligatoirement la clé publique racine de confiance séparément ainsi que les identifiants attendus du compte et de l'appareil. Elle recalcule l'empreinte racine, compare les identifiants attendus et vérifie la signature ; elle ne récupère jamais l'ancre de confiance depuis le certificat. Les tests adversariaux couvrent compte/appareil altéré, clé ECDH substituée, autre racine, signature altérée, certificat mal formé et paire racine incohérente.

**Limites importantes :** le certificat ne constitue pas une cérémonie d'enrôlement complète. Il ne prouve pas que l'utilisateur a comparé les empreintes, ne stocke aucun état, ne révoque aucune session, ne vérifie pas le statut actif côté serveur et ne résout pas les courses d'approbation/révocation. L'appelant doit charger une ancre racine déjà vérifiée et vérifier l'état de révocation serveur à chaque autorisation. Ne pas utiliser avec le GPS réel avant revue indépendante.


## 19. Contrat de révocation serveur — proposition avant API

### Autorité d'approbation
- En V1, seul l'appareil racine actif peut approuver un nouvel appareil.
- Un appareil secondaire, même actif et muni d'un certificat valide, ne peut jamais approuver, signer ou initier une approbation d'un autre appareil.
- Le serveur doit vérifier simultanément l'identité de l'acteur, le statut actif du root enregistré pour le compte et la signature racine du certificat. Un champ `actorRole` fourni par le client n'est jamais une preuve.
- Une révocation du root place le compte en état `root_recovery_required` et bloque tout nouvel enrôlement ainsi que tout partage GPS jusqu'à la création d'une nouvelle identité et à la revérification indépendante des contacts. La récupération du mot de passe ne réactive pas l'ancienne racine.

### Autorisation à chaque requête protégée
Chaque requête utilisant une fonction sensible doit vérifier dans D1, sans cache d'autorisation :
1. le compte de la session correspond au compte de l'appareil ;
2. le `device_id` de la session correspond à l'appareil certifié ;
3. l'appareil existe et son état courant est `active` ;
4. le certificat est valide sous l'empreinte racine de confiance actuellement enregistrée ;
5. la version d'autorisation de session correspond à la version courante de l'appareil ;
6. l'appareil racine est toujours actif si l'action dépend de l'identité racine.

Un jeton signé valide ne suffit jamais à maintenir une autorisation après révocation. Les caches d'autorisation positifs sont interdits pour les routes protégées. Les vérifications sensibles et mutations doivent être sérialisées avec la révocation via transaction D1 ou une condition atomique équivalente.

### Mutation de révocation atomique
La révocation doit, dans une transaction atomique unique :
- passer l'appareil à `revoked`, écrire l'horodatage serveur et incrémenter sa `auth_version` ;
- invalider toutes ses sessions serveur et tous ses jetons de rafraîchissement ;
- désactiver ses abonnements push ;
- annuler les défis de jumelage où il est appareil sujet ou approbateur ;
- fermer/refuser les sessions de partage GPS actives qui dépendent de cet appareil ;
- écrire un événement d'audit append-only sans secret ni coordonnées GPS.

L'opération est idempotente : une deuxième révocation ne réactive rien et ne réécrit pas l'événement initial. Toute course entre une approbation et une révocation doit aboutir à un seul état terminal cohérent. Les opérations qui arrivent après le commit de révocation sont refusées, même avec un ancien jeton.

### Notifications et limites physiques
Les tâches de notification en attente doivent recontrôler l'état de l'appareil et son abonnement juste avant l'envoi. Une notification déjà remise au fournisseur externe ou en transit ne peut pas être rappelée. Les appareils hors ligne ne reçoivent pas un effacement à distance ; les clés et données déjà copiées sur cet appareil ne sont pas réputées effacées.

### État de cette spécification
Ce contrat est une base de conception, pas un endpoint ni une migration existante. Il faut encore le confronter aux garanties transactionnelles réelles de D1, aux limites d'exécution Pages Functions et au modèle de session retenu. Aucun GPS réel ne doit être connecté avant revue indépendante et preuve de suppression irréversible à J+30.


## 20. Garde métier sur l'approbation par la racine — contrat pur ajouté

Le contrat pur `transitionDevice` exige désormais, pour une transition `approve`, un `actorDeviceId` et un `rootDeviceId` identiques. Il refuse également qu'un appareil dont l'identifiant est celui de la racine soit enregistré comme appareil secondaire. Des tests vérifient le refus d'un secondaire approbateur et le refus d'enrôler la racine comme secondaire.

**Limite essentielle :** cette fonction ne prouve pas que l'acteur est réellement le root actif. Le futur contrôleur Pages Functions devra obtenir `actorDeviceId` depuis la session authentifiée, charger `rootDeviceId` et son statut actif depuis D1, puis appeler le contrat. Les valeurs envoyées dans le corps de requête ne doivent jamais établir cette autorité. Aucun endpoint ni schéma D1 n'est créé ici.


## 21. Contrat de session lié à l'appareil — prototype pur

Le dépôt ajoute `src/domain/session-authorization.ts` et ses tests. Le contrat d'une session comprend un identifiant opaque, le compte, l'appareil, le hash SHA-256 du jeton à haute entropie, l'état, la version d'autorisation de l'appareil, la création, l'expiration et l'éventuelle révocation. Le jeton brut n'est jamais un champ du modèle persistant.

À chaque requête protégée, le futur contrôleur doit charger l'état courant de la session et de l'appareil depuis D1 et fournir au contrat le compte et l'appareil attendus depuis le contexte authentifié, l'état courant de l'appareil, la valeur courante de `auth_version` et l'heure UTC du serveur.

Le contrat refuse une session expirée ou révoquée, un compte/appareil différent, un appareil non actif, ou une version de session qui ne correspond plus à la version de l'appareil. L'incrément de `auth_version` lors d'une révocation invalide donc toutes les sessions antérieures de cet appareil sans toucher aux sessions des autres appareils du compte.

### Révocation transactionnelle attendue

La future mutation de révocation doit dans une transaction D1 :
1. passer l'appareil ciblé à `revoked`, renseigner `revoked_at` et incrémenter `auth_version` ;
2. révoquer toutes les sessions liées à cet appareil ;
3. désactiver ses abonnements push ;
4. annuler ses demandes de jumelage en attente ;
5. invalider les autorisations de partage GPS qui en dépendent ;
6. écrire l'événement d'audit sans jeton, clé privée ni coordonnées.

Les routes de lecture doivent filtrer par session et appareil actifs dans la requête SQL elle-même. Toute mutation sensible doit inclure une condition d'autorisation courante dans l'instruction DML finale, ou dans une séquence D1 atomique équivalente ; un contrôle séparé suivi plus tard d'une écriture non conditionnelle crée une course avec la révocation. Aucun cache positif d'autorisation. Les tâches push/outbox recontrôlent l'état juste avant l'envoi.

### Limites et décisions différées

Le prototype est un évaluateur pur : il ne génère pas les jetons, ne vérifie pas le canal OTP, ne stocke rien, ne définit pas le transport du cookie/jeton et ne fournit aucune route. Le fournisseur OTP, le transport de session, le schéma D1 et les garanties transactionnelles finales restent à valider. Aucun secret ou jeton réel n'est utilisé dans les tests. Aucune migration ni modification distante de D1 n'a été effectuée.

## 22. Validation cryptographique du point ECDH des bundles

Le contrôle partagé `validateLocationExchangePublicKey` vérifie la forme JWK, importe la clé publique ECDH P-256, puis tente un accord ECDH éphémère local. Cette troisième étape évite de dépendre uniquement de l'import : un problème d'interopérabilité Deno documenté en octobre 2026 montre qu'un moteur peut accepter un point hors courbe à l'import et ne le rejeter qu'au moment de l'accord.

Le contrôle est appelé par le vérificateur de bundle signé et par le vérificateur de certificat secondaire. Un test adversarial construit un transcript correctement signé par une clé d'identité P-256 et un autre certificat correctement signé par la racine, chacun contenant le point (0,0) encodé dans des coordonnées de 32 octets. Les deux vérificateurs doivent refuser ces objets.

**Limites inchangées :** cela ne valide pas l'identité du propriétaire, n'ancre pas la clé racine, ne constitue pas une cérémonie d'enrôlement, ne gère pas la révocation et ne prouve pas la destruction GPS J+30. Le code reste expérimental et non raccordé aux positions réelles. Le résultat CI doit être contrôlé avant de déclarer ces tests réussis ; des essais WebCrypto sur navigateurs Android/iOS et Cloudflare Workers restent requis.

## 23. Écart entre le certificat expérimental et le transcript d'enrôlement

La comparaison du prototype `SecondaryDeviceCertificate` avec la cérémonie proposée aux sections 3 et 15 révèle un écart bloquant avant toute intégration :

- Le certificat signé lie actuellement le compte, l'identifiant d'appareil, la plateforme, la date, l'empreinte racine et les deux clés publiques.
- Il ne lie pas encore l'identifiant de cérémonie, le défi serveur à usage unique, le nonce du nouvel appareil, la version complète du protocole ni une échéance d'expiration.
- Le champ `createdAt` n'est pas un remplacement d'un défi aléatoire, d'une preuve de fraîcheur et d'une consommation atomique côté serveur.
- Le test de signature du certificat ne démontre donc pas, à lui seul, que l'approbation correspond à la demande d'enrôlement actuellement ouverte.

### Conséquence

Ne pas brancher ce certificat au futur endpoint d'approbation en l'état. Avant toute intégration, définir un transcript canonique unique, partagé par les deux appareils et le serveur, qui lie au minimum : compte, appareil racine, nouvel appareil, identifiants des deux clés, identifiant de cérémonie, défi serveur, nonce client, version du protocole, usages, émission et expiration. La signature racine doit couvrir l'intégralité de ces champs dans un ordre/version déterministes.

Le serveur devra consommer le défi et faire passer l'enrôlement à son état terminal dans une opération atomique conditionnelle. Un certificat expiré, lié à une autre demande, déjà consommé ou destiné à un autre appareil doit être refusé. Les règles d'idempotence après perte réseau doivent être définies sans permettre de réutiliser le défi pour une nouvelle cérémonie.

### Tests obligatoires avant intégration

- Altération de chaque champ du transcript après signature.
- Rejeu du même défi dans une seconde demande.
- Défi expiré et horloge client manipulée (l'heure d'autorité est serveur).
- Nonce, compte, rootDeviceId ou deviceId remplacé.
- Deux approbations concurrentes sur le même défi : un seul commit métier.
- Révocation de la racine entre lecture de la demande et écriture finale : aucune approbation ne doit réussir après le commit de révocation.
- Perte réseau avant/après commit : récupération idempotente sans réutilisation du défi.

**Statut :** constat d'audit documentaire et prototype ; aucune API ni migration n'est créée. Le format final du transcript doit être conçu et revu avant modification du code du certificat.

La proposition de format et de séquence est maintenant détaillée dans [TRANSCRIPT_CEREMONIE_MULTI_APPAREILS.md](TRANSCRIPT_CEREMONIE_MULTI_APPAREILS.md). Elle reste candidate : elle ne doit pas être traitée comme un contrat approuvé ou une implémentation.

## 22. Portée métier de la révocation d'un appareil — proposition à valider

La révocation d'un appareil est une révocation de capacité et de sessions de cet appareil, pas une révocation du compte utilisateur ni de ses relations de confiance.

### 22.1 Révocation d'un appareil secondaire

Après commit de révocation d'un secondaire :
- toutes les sessions et tous les jetons de cet appareil sont invalides ; son auth_version est incrémenté ;
- ses abonnements push sont désactivés ; les autres appareils actifs du même compte conservent leurs propres sessions et abonnements ;
- l'appareil ne peut plus lire, déclencher, répondre, modifier ou clôturer une alerte avec ses anciens jetons ;
- les contacts de confiance, l'abonnement commercial, les alertes et l'historique du compte ne sont pas supprimés ni modifiés ;
- l'instantané des destinataires d'une alerte déjà déclenchée n'est pas réécrit ;
- les notifications destinées au compte peuvent continuer vers ses autres appareils actifs et autorisés ;
- une notification déjà confiée au fournisseur pour l'appareil révoqué peut encore arriver. À son ouverture, tout accès au contenu doit être revalidé côté serveur ;
- les données et clés locales du téléphone révoqué ne sont pas réputées effacées. Si le téléphone est hors ligne, aucune suppression à distance n'est garantie.

La réinscription de ce même matériel doit produire une nouvelle cérémonie et de nouvelles sessions. L'ancien certificat, les anciens jetons et les anciennes clés d'appareil ne sont pas réactivés.

### 22.2 Révocation de l'appareil racine

L'appareil racine a une autorité spéciale d'approbation, mais n'est pas le compte lui-même. Sa révocation :
- invalide ses sessions, jetons et abonnements comme pour tout appareil ;
- fait passer l'état de confiance du compte à root_recovery_required ;
- bloque toute nouvelle approbation d'appareil et toute opération cryptographique qui exige la racine, notamment les nouveaux partages GPS ;
- n'autorise aucun appareil secondaire à devenir racine ou à approuver un autre appareil par simple promotion ;
- ne supprime pas le compte, ses contacts, son abonnement, ses alertes ou son historique ;
- ne doit pas automatiquement révoquer les sessions des appareils secondaires : ceux-ci peuvent conserver les fonctions ordinaires du compte qui ne dépendent pas de la racine, sous réserve de leur propre statut actif ;
- ne permet pas aux appareils secondaires d'accéder aux clés privées de la racine ni de reconstruire son identité.

Le retour à un état avec racine exige une procédure explicite de récupération cryptographique : nouvelle identité racine, nouvelle cérémonie d'approbation et revérification indépendante des empreintes par les contacts concernés avant reprise du partage GPS. La récupération du mot de passe ou une session secondaire ne suffit pas.

### 22.3 Courses et opérations simultanées

La révocation d'un appareil et toute opération protégée de cet appareil doivent être sérialisées côté serveur :
- si la révocation commit en premier, toute requête ultérieure de l'appareil est refusée, même si son jeton signé n'a pas expiré ;
- si une mutation valide commit avant la révocation, son événement est conservé ; la révocation bloque les mutations suivantes ;
- les claims de notifications et les opérations de jumelage revérifient le statut de l'appareil dans leur transaction/condition atomique finale ;
- une révocation répétée est idempotente ;
- une révocation de secondaire ne doit jamais incrémenter auth_version des autres appareils ni invalider leurs sessions.

**Tests obligatoires avant implémentation :** révocation d'un secondaire parmi plusieurs ; révocation concurrente à une requête protégée ; alerte active sans suppression de destinataires ; notification multi-appareils ; notification déjà acceptée ; révocation du root sans révocation implicite des secondaires ; tentative de promotion d'un secondaire ; récupération sans restauration de l'ancienne racine ; rejeu idempotent et courses avec approbation/outbox.

**Statut :** proposition de portée fonctionnelle et sécurité à valider. Aucun endpoint, migration D1 ou flux de récupération n'est créé par cette spécification.


## 23. Perte, vol et remplacement du téléphone racine — parcours proposé à valider

**Statut : proposition de conception et de sécurité, non décision produit complète, non implémentée.**  
Cette section distingue la récupération de l'accès au compte de la récupération de l'identité cryptographique. Elle ne choisit aucun fournisseur d'authentification, aucun mécanisme de support et aucun facteur de récupération qui n'a pas été validé.

### 23.1 Quatre situations à distinguer

| Situation | Interprétation | Traitement proposé |
|---|---|---|
| Perte temporaire, téléphone probablement récupérable | L'utilisateur ne sait pas où se trouve le téléphone ; aucune preuve de compromission | Ne pas déclarer l'appareil effacé ni le compte récupéré. L'utilisateur peut récupérer l'accès au compte, mais la racine reste indisponible tant que sa possession n'est pas démontrée. |
| Vol confirmé ou suspicion crédible de compromission | Le téléphone peut être contrôlé par un tiers | Demander une révocation urgente de l'appareil racine après réauthentification renforcée. Le compte passe en récupération de racine ; les opérations dépendant de la racine sont bloquées. |
| Panne, destruction ou réinitialisation | La clé privée peut être devenue inaccessible, même si le téléphone est retrouvé | Traiter comme perte de la capacité cryptographique. Ne pas supposer que la réparation ou la restauration du téléphone récupère la clé. |
| Remplacement volontaire avec ancienne racine disponible | L'utilisateur possède encore le téléphone racine et peut signer | Utiliser la rotation normale signée par l'ancienne racine et par la nouvelle ; ce n'est pas une récupération après perte. |

Un appareil simplement injoignable ou hors ligne n'est pas automatiquement considéré volé. L'utilisateur doit choisir la situation déclarée ; SAC ne prétend pas déterminer seul si le téléphone est perdu, volé ou détruit.

### 23.2 Deux récupérations séparées

**Récupération d'accès au compte :**
- permet à la personne de retrouver l'accès aux fonctions de compte qui ne nécessitent pas la racine, selon une authentification forte qui reste à spécifier ;
- ne prouve pas la possession de l'ancienne clé privée racine ;
- ne réactive aucun certificat d'appareil révoqué ;
- ne restaure aucune session, clé privée, clé GPS ou archive locale ;
- ne suffit jamais à autoriser l'approbation d'un appareil ni le partage GPS.

**Récupération de l'identité cryptographique racine :**
- est une procédure distincte, déclenchée après authentification du compte et vérifications de sécurité définies ;
- crée une nouvelle paire de clés racine sur le nouvel appareil ; la clé privée est générée localement et n'est jamais envoyée au serveur ;
- attribue une nouvelle version/époque d'identité et révoque l'ancienne racine côté serveur selon une transition atomique ;
- impose aux contacts concernés une vérification indépendante de la nouvelle empreinte avant tout nouveau partage GPS ;
- ne rétablit ni les anciennes clés GPS, ni les archives supprimées, ni les données GPS arrivées à échéance J+30.

Un mot de passe, un OTP, un lien e-mail, une session secondaire ou une intervention du support ne peut jamais être interprété comme une signature de l'ancienne racine.

### 23.3 Cas où un appareil secondaire est encore actif

Un appareil secondaire actif peut, après authentification du compte, **initier une demande de récupération** et afficher son état. Il ne peut pas :
- s'auto-promouvoir en racine ;
- signer à la place de l'ancienne racine ;
- approuver seul un autre appareil ;
- déclarer la nouvelle empreinte vérifiée pour les contacts ;
- réactiver un partage GPS ;
- récupérer les clés privées ou archives GPS de l'ancien téléphone.

La demande lancée depuis un secondaire est une demande de procédure, pas une preuve de légitimité cryptographique. Elle doit être liée à la session et à l'identité propre de ce secondaire, soumise aux contrôles de récupération du compte, puis à la vérification indépendante des contacts. Les fonctions ordinaires du secondaire peuvent rester disponibles tant que son propre certificat et sa session restent actifs et que la politique du compte ne les bloque pas ; les opérations qui exigent l'autorité racine restent refusées.

### 23.4 Déroulement proposé lorsque l'ancienne racine est inaccessible

1. L'utilisateur récupère l'accès au compte via le mécanisme d'authentification renforcée qui sera défini séparément. Cette étape ne modifie pas la racine.
2. L'utilisateur déclare la cause : perte temporaire, vol/suspicion de compromission, panne/destruction ou remplacement. La déclaration est enregistrée comme déclaration de l'utilisateur, pas comme fait vérifié par SAC.
3. Pour un vol ou une suspicion de compromission, l'utilisateur demande la révocation de l'appareil racine. Le serveur vérifie l'autorisation de récupération, puis sérialise la révocation et le passage à root_recovery_required. L'appareil hors ligne ne reçoit pas d'effacement à distance ; ses requêtes futures sont rejetées dès qu'elles atteignent le serveur.
4. Le nouvel appareil génère localement une nouvelle identité racine et une preuve de possession. Il ne reçoit aucune ancienne clé.
5. Le serveur enregistre une demande de rétablissement en attente, liée au compte, à l'ancienne époque racine, à la nouvelle empreinte, au nouvel appareil et à un identifiant de cérémonie unique. Aucune approbation GPS n'est accordée à ce stade.
6. Les contacts avec lesquels l'utilisateur souhaite reprendre le partage GPS sont informés par une notification sobre ne contenant ni empreinte complète, ni coordonnées, ni secret. Ils comparent la nouvelle empreinte par un canal indépendant de SAC et confirment explicitement.
7. Chaque relation/contact conserve son propre état de vérification. Le partage GPS avec un contact reste bloqué tant que ce contact n'a pas terminé sa vérification indépendante.
8. Une fois les contrôles de récupération et les confirmations exigées terminés, le serveur marque la nouvelle racine comme rétablie par une opération atomique. Les appareils secondaires existants ne sont pas automatiquement certifiés par la nouvelle racine : ils doivent suivre une nouvelle cérémonie ou rester limités aux fonctions non dépendantes de la racine.
9. Les notifications de sécurité sont envoyées après commit. L'historique append-only conserve la demande, les vérifications, la révocation, les refus et l'établissement de la nouvelle racine.

Les délais d'expiration, les facteurs d'authentification, les éventuels délais de sécurité et le seuil exact de contacts à vérifier restent à décider. Aucun délai arbitraire n'est fixé ici.

### 23.5 États de récupération proposés

| État | Sens | Effet de sécurité |
|---|---|---|
| recovery_requested | Demande reçue et enregistrée | Aucun droit racine nouveau ; demande soumise aux contrôles |
| recovery_pending_review | Authentification du compte vérifiée selon la politique à définir ; nouvelle identité en attente des validations requises | Approbations d'appareils et partage GPS bloqués |
| root_reestablished | Nouvelle racine créée, preuve de possession validée et transition enregistrée | La nouvelle racine peut exercer les fonctions autorisées ; le GPS reste bloqué contact par contact jusqu'à vérification indépendante |
| recovery_refused | Demande refusée | Aucune nouvelle racine activée ; motif non sensible communiqué |
| recovery_expired | Demande expirée selon une durée à définir | Aucun effet d'activation ; une nouvelle demande et une nouvelle cérémonie sont nécessaires |
| recovery_cancelled | Demande annulée avant établissement | Aucune nouvelle racine activée ; les effets d'une révocation déjà commitée ne sont jamais annulés automatiquement |

Un état de demande ne doit jamais être affiché comme « identité vérifiée » ou « téléphone sécurisé ». root_reestablished signifie que la nouvelle racine est établie côté compte ; il ne signifie pas que tous les contacts ont vérifié son empreinte ni que le GPS est disponible.

### 23.6 Perte temporaire et ancien téléphone qui revient en ligne

- Tant que l'utilisateur n'a pas demandé de révocation ou de récupération, SAC ne prétend pas avoir neutralisé un téléphone perdu qui reste hors ligne.
- Dès que la révocation de l'ancienne racine est commitée, ses sessions, certificats et capacités d'approbation sont invalides ; son retour en ligne ne peut pas annuler la révocation.
- Si une demande de récupération est ouverte, aucune opération de l'ancienne racine ne peut valider une nouvelle cérémonie concurrente sans résolution explicite de la demande.
- Une récupération annulée ne réactive jamais automatiquement une racine déjà révoquée. Si l'utilisateur veut conserver une racine encore active, la demande doit être annulée avant la révocation, et le serveur doit vérifier l'état courant.
- Les données locales de l'ancien téléphone peuvent encore exister. L'interface doit dire « accès serveur révoqué » et non « téléphone effacé ».

### 23.7 Courses, idempotence et ordre serveur

Toutes les opérations de récupération sont sérialisées par compte et par époque de racine. Chaque commande contient un identifiant d'idempotence et la version de racine attendue.

- **Deux demandes simultanées :** une seule demande active est créée pour une même époque racine ; une répétition avec la même clé d'idempotence retourne le résultat existant ; une autre demande concurrente reçoit un conflit explicite et ne crée pas une seconde cérémonie.
- **Ancienne racine reconnectée :** si sa révocation a commit, toute requête est refusée même avec un jeton non expiré. Si une récupération est en attente, aucune signature tardive ne peut la remplacer ou la terminer.
- **Secondaire révoqué pendant la récupération :** toute action future de ce secondaire est refusée ; sa candidature ou demande antérieure reste dans l'audit mais ne peut pas être utilisée comme autorité.
- **Révocation pendant une cérémonie :** la transaction finale revérifie l'état de l'appareil approbateur, l'état du nouvel appareil, l'époque racine attendue, l'expiration et l'absence de consommation du défi. Si l'un est révoqué ou périmé, l'activation échoue.
- **Deux nouvelles racines concurrentes :** une contrainte d'unicité sur l'époque active et une comparaison atomique de l'époque attendue garantissent qu'une seule transition peut gagner.
- **Timeout après commit :** le client relit l'état serveur avec l'identifiant de demande ; il ne relance pas une nouvelle génération de clés ni une nouvelle transition aveuglément.
- **Notification :** elle est émise après commit et n'est jamais une preuve de livraison ni de vérification par un contact.

Le journal est append-only, séquencé et horodaté côté serveur. Les événements ne contiennent ni clé privée, ni OTP, ni jeton, ni QR complet, ni transcript sensible, ni GPS.

### 23.8 Fonctions explicitement bloquées et fonctions préservées

Pendant root_recovery_required, sont bloqués :
- approbation et enrôlement de nouveaux appareils ;
- rotation ou remplacement normal qui nécessiterait l'ancienne racine ;
- création, renouvellement ou reprise de partage GPS ;
- toute opération qui prétend signer ou prouver la continuité de l'ancienne identité.

Ne sont pas supprimés par la seule révocation de la racine :
- le compte et son mécanisme de récupération d'accès ;
- les relations de confiance, l'abonnement, les alertes et l'historique ;
- les sessions secondaires qui restent individuellement actives ;
- les fonctions ordinaires indépendantes de la racine, sous réserve de leur autorisation propre.

Cette liste est une politique proposée. Les fonctions exactes accessibles sur un secondaire pendant la récupération restent à arbitrer avant implémentation.

### 23.9 Tests adversariaux préalables à l'implémentation

- récupération de mot de passe sans aucune modification de la racine ;
- OTP ou session secondaire utilisés pour tenter une promotion racine ;
- demande depuis un secondaire actif, puis révocation de ce secondaire avant commit ;
- téléphone racine perdu qui revient en ligne après révocation ;
- téléphone racine qui revient pendant une récupération non encore résolue ;
- deux demandes de récupération, deux nouvelles racines ou deux appareils candidats concurrents ;
- ancienne racine qui signe après ouverture de la récupération ;
- révocation avant, pendant et après la cérémonie ;
- timeout réseau avant et après commit, rejeu d'identifiant et idempotence ;
- contact qui n'a reçu la nouvelle empreinte que via SAC : GPS doit rester bloqué ;
- un contact vérifie la nouvelle empreinte, un autre refuse ou reste en attente : seuls les partages explicitement autorisés avec le premier peuvent reprendre ;
- révocation de racine sans suppression du compte, des alertes ou des appareils secondaires actifs ;
- aucune ancienne clé GPS ni archive J+30 ne réapparaît après récupération ou restauration ;
- absence de secret, empreinte complète, coordonnées ou détail sensible dans les notifications et journaux.

**Verrou :** aucune récupération racine ne doit être implémentée avant validation des facteurs de récupération du compte, de la politique de vérification des contacts, de l'UX anti-hameçonnage, de la spécification cryptographique et d'une revue indépendante. Aucune migration D1, route API ou ressource Cloudflare n'est créée par cette proposition.
## Annexe — Coordonnées du compte et identité multi-appareils (18 novembre 2026)

Le numéro de téléphone et l'adresse e-mail sont des canaux de contact/authentification du compte ; ils ne sont pas l'identité cryptographique d'un appareil et ne constituent pas une preuve de possession de la racine.

- Modifier le numéro ou l'e-mail ne modifie pas les clés publiques/privées d'un appareil, le certificat d'approbation, l'identifiant de compte ou l'époque de racine.
- La vérification du nouveau canal ne crée, n'approuve, ne réactive et ne certifie aucun appareil.
- Une session secondaire ne peut pas s'auto-élever au rôle racine en démontrant uniquement le contrôle d'un nouveau numéro ou e-mail.
- Un appareil révoqué reste révoqué même si le propriétaire modifie ensuite ses coordonnées ou réinitialise son mot de passe.
- La demande de changement doit vérifier le statut serveur actuel de l'appareil et de la session au moment du commit ; une révocation concurrente gagnante fait échouer la demande.
- Si le changement est effectué avec l'ancienne racine toujours active, l'identité racine reste inchangée. Il n'est donc pas nécessaire de faire revérifier automatiquement toutes les empreintes des contacts uniquement parce qu'un canal de contact a changé.
- Si la racine est perdue et remplacée, le protocole de récupération déjà documenté s'applique : nouvelle identité, révocation de l'ancienne racine, vérification indépendante de la nouvelle empreinte par les contacts concernés avant reprise des partages GPS.
- Les coordonnées privées ne sont pas distribuées aux autres appareils ou contacts sans règle explicite. Les relations de confiance restent attachées à l'identifiant de compte, jamais à la seule valeur d'un numéro ou d'un e-mail.
- Une récupération d'accès au compte et une récupération d'identité cryptographique sont deux opérations distinctes. Aucune modification de canal ne doit restaurer une clé privée absente.

**Point à arbitrer :** déterminer quelles opérations de compte un appareil secondaire peut initier ou finaliser (simple demande, changement avec preuve racine, changement après authentification renforcée), sans lui donner un pouvoir d'approbation racine.


## Annexe — OTP e-mail et frontière de confiance multi-appareils (18 novembre 2026)

La politique OTP validée utilise l'e-mail comme canal standard pour les codes de vérification du compte. Cette décision ne modifie pas la hiérarchie de confiance des appareils.

- Un OTP envoyé à une adresse e-mail vérifiée prouve uniquement le contrôle ponctuel de cette boîte.
- Un OTP e-mail, même valide, ne peut pas approuver un appareil secondaire, promouvoir un appareil en racine, signer une cérémonie, restaurer une clé privée ni annuler une révocation.
- La récupération d'accès au compte par e-mail reste distincte de la récupération de l'identité cryptographique racine.
- Si l'utilisateur a perdu l'accès à son ancienne boîte, la vérification d'une nouvelle adresse ne suffit pas à établir la continuité du compte ; une preuve indépendante préalablement approuvée ou une procédure forte validée est requise.
- Le SMS n'est pas un canal OTP de secours automatique. Il reste réservé à l'escalade SOS et ne participe pas à la récupération de la racine.
- Les appareils secondaires conservent leurs capacités strictement autorisées ; la réception d'un OTP e-mail ne leur confère aucun privilège supplémentaire.

**Verrou :** aucune transition de racine ou approbation d'appareil ne doit être implémentée sur la seule base d'un OTP, qu'il soit reçu par e-mail ou SMS.


## Annexe — Perte de l'e-mail et continuité des appareils (18 novembre 2026)

**Statut :** règles de conception proposées, sous réserve des facteurs de récupération restant à arbitrer.

- Si un appareil approuvé et sûr subsiste, le changement de l'adresse e-mail doit être initié depuis cet appareil et lié à une preuve cryptographique fraîche. La nouvelle adresse est vérifiée par OTP e-mail, mais cet OTP ne constitue pas la preuve d'autorité de l'appareil.
- Une session secondaire ne peut pas devenir racine en raison de la perte de l'e-mail. Ses capacités restent celles de son certificat et de ses autorisations actuelles.
- Si aucun appareil approuvé ne subsiste, un nouvel e-mail vérifié permet uniquement de prouver le contrôle de la nouvelle boîte. Il ne permet pas à lui seul de reprendre le compte, approuver un appareil ou remplacer l'ancienne racine.
- Une récupération d'accès en attente ne change pas l'époque racine, ne certifie aucun appareil et n'autorise aucun partage GPS.
- Si la racine est perdue, une nouvelle paire est générée localement et l'ancienne racine reste non restaurable ; la vérification indépendante des nouvelles empreintes par les contacts concernés reste exigée avant reprise du GPS.
- Aucun OTP SMS de secours automatique n'est ajouté. Les SMS d'escalade SOS restent indépendants.
- La portée de révocation des sessions et les fonctions accessibles pendant une récupération restent à définir explicitement ; aucune révocation globale arbitraire n'est présumée.

**Verrou :** aucun nouvel appareil ne peut être approuvé sur la seule base d'un nouvel e-mail, d'un OTP, d'un mot de passe ou d'une intervention du support.


## Annexe — Contacts de confiance : vérification d'identité, pas récupération du compte (18 novembre 2026)

**Recommandation de sécurité proposée :** les contacts de confiance n'exercent aucun pouvoir d'authentification ou d'administration sur le compte du titulaire.

- Un contact ne peut pas se connecter au compte, réinitialiser son mot de passe, changer son adresse e-mail, approuver un appareil, annuler une révocation ou signer à la place de la racine.
- Aucun vote ou quorum de contacts ne peut remplacer une preuve indépendante de récupération d'accès ou recréer l'ancienne racine.
- Après perte de la racine, la nouvelle identité est générée localement selon la procédure dédiée. Chaque contact concerné vérifie indépendamment la nouvelle empreinte pour sa propre relation avant reprise du partage GPS.
- La vérification d'un contact n'approuve pas automatiquement les autres relations et n'accorde pas au contact un accès au compte ou à l'historique.
- Seuls les contacts dont la relation était active avant l'ouverture de la récupération peuvent être sollicités ; une relation créée ou réactivée pendant la récupération ne peut pas servir de preuve.
- Les réponses des contacts restent privées les unes par rapport aux autres. Aucun contact ne voit les nouvelles coordonnées, les facteurs de récupération, les codes ou les réponses des autres.
- Un contact injoignable ou refusant de vérifier laisse sa relation GPS bloquée ; cela ne doit pas déclencher une approbation automatique ou une substitution silencieuse.

**À arbitrer :** méthode indépendante acceptable (présence physique, appel vocal initié par un canal déjà connu, comparaison d'empreinte sur deux canaux réellement indépendants), traitement des contacts injoignables et éventuelle confirmation humaine complémentaire sans pouvoir d'accès.

**Verrou :** ne pas transformer les contacts de confiance en mécanisme de récupération sociale du compte ni en autorité racine collective.

## Référence de consolidation — 18 novembre 2026

La lecture transversale des pertes d'appareils, sessions et récupération est centralisée dans `CONSOLIDATION_APPAREILS_SESSIONS_ET_RECUPERATION.md`. Le présent protocole reste une proposition technique non homologuée. Les divergences avec le transcript canonique, les limites du prototype, les facteurs de récupération non décidés et l'interdiction de remplacer la racine en V1 doivent être respectés avant toute implémentation.
