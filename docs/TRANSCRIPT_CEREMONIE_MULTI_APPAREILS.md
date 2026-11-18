# SAC — Transcript canonique de la cérémonie multi-appareils

**Statut : proposition de sécurité à examiner — non approuvée, non implémentée.**

Ce document formalise les champs et contrôles manquants relevés dans le certificat secondaire expérimental. Il ne crée aucune API, migration D1, ressource Cloudflare ou fonctionnalité GPS. Il doit être relu par un spécialiste indépendant avant toute implémentation.

## 1. Objectif et règle de confiance

L'enrôlement d'un nouvel appareil doit prouver simultanément :

1. que l'appareil racine actuellement approuvé autorise précisément cette demande ;
2. que le nouvel appareil possède les clés privées correspondant aux clés publiques présentées ;
3. que les deux appareils approuvent exactement le même transcript ;
4. que le défi serveur est frais, destiné à cette demande et consommé une seule fois ;
5. que l'appareil racine est toujours actif au moment de la validation finale.

Une authentification de compte, un OTP, un certificat ancien ou un champ de rôle envoyé par le client ne remplace aucune de ces preuves.

## 2. Identifiants et valeurs

Le transcript candidat contient, dans un ordre canonique fixe :

| Champ | Source et contrainte |
|---|---|
| Domaine | Constante `SAC:device-enrollment-transcript:v1` |
| Version protocole | Entier constant pris en charge |
| accountId | Compte déterminé par la session authentifiée côté serveur |
| rootDeviceId | Appareil racine actif lu dans l'état serveur |
| rootKeyVersion | Version de la clé racine active |
| rootKeyFingerprint | Empreinte calculée depuis l'ancre racine de confiance |
| ceremonyId | Identifiant aléatoire unique de cette cérémonie |
| challengeId | Identifiant opaque du défi serveur |
| serverChallenge | Valeur aléatoire serveur, 32 octets minimum |
| newDeviceId | Identifiant attribué à la demande en attente |
| deviceNonce | Nonce aléatoire généré par le nouvel appareil, 32 octets minimum |
| platform | Valeur contrôlée parmi web, android, ios |
| identityPublicKey | Clé publique ECDSA P-256 du nouvel appareil |
| exchangePublicKey | Clé publique ECDH P-256 du nouvel appareil |
| permittedUses | Liste fixe et ordonnée des usages réellement autorisés |
| issuedAt | Horodatage UTC serveur |
| expiresAt | Expiration UTC décidée par le serveur |

Les clés privées ne figurent jamais dans le transcript. Aucun secret d'authentification, jeton de session ou donnée GPS ne doit y être inclus.

## 3. Encodage canonique et signatures

Avant implémentation, un encodage déterministe interopérable doit être choisi et versionné. La proposition est une structure binaire déterministe (par exemple CBOR déterministe), avec :

- types stricts et longueurs maximales ;
- ordre de champs imposé ;
- encodage canonique des clés publiques ;
- rejet des champs inconnus, doublons, valeurs nulles non prévues et représentations alternatives ;
- mêmes octets signés et vérifiés sur Android, iOS, Web et serveur.

Il ne faut pas signer des objets JSON reconstruits librement par chaque client : des différences de sérialisation pourraient faire diverger les signatures. Le choix final du format et de sa bibliothèque doit être documenté avant le code.

Deux signatures distinctes sont requises dans cette proposition :

1. **Preuve du nouvel appareil :** le nouvel appareil signe le transcript avec sa clé privée d'identité. Cela prouve la possession de la clé privée correspondant à la clé publique incluse.
2. **Approbation de la racine :** l'appareil racine signe exactement les mêmes octets avec sa clé privée racine.

Les signatures couvrent l'intégralité des champs, y compris les identifiants, clés publiques, défi, nonce, usages, version et expiration. Aucune signature ne doit porter seulement sur une partie du transcript.

## 4. Séquence candidate

1. Le nouvel appareil s'authentifie et crée localement ses clés ainsi que son nonce aléatoire.
2. Le serveur crée une demande en attente et émet un défi imprévisible lié au compte, à la racine active, au nouvel appareil et au hash de la demande.
3. Le serveur conserve l'état du défi : émis, expiré ou consommé. Le défi n'est jamais choisi par le client.
4. Le nouvel appareil reçoit le transcript exact et vérifie que les identifiants et clés correspondent à sa demande locale.
5. L'appareil racine récupère la demande, affiche clairement le nouvel appareil et les empreintes à comparer.
6. Les deux appareils affichent une comparaison complète du transcript par un canal indépendant. Le QR ou le serveur seuls ne constituent pas ce canal.
7. Après confirmation explicite, le nouvel appareil et la racine signent exactement le même transcript.
8. Le nouvel appareil vérifie la signature racine sous une clé déjà épinglée indépendamment ; la racine vérifie la preuve de possession du nouvel appareil.
9. Le serveur vérifie les deux signatures, l'expiration, le défi, l'état de la demande, l'état courant de la racine et l'absence de révocation.
10. Le serveur consomme le défi et active l'appareil dans une opération atomique conditionnelle. L'appareil ne devient jamais actif sur la seule base d'une réponse du client.

## 5. Règles d'autorité serveur

- L'identité de l'acteur vient de la session authentifiée, jamais du body.
- Le rootDeviceId et la version de la racine viennent de l'état serveur courant.
- Le serveur vérifie que la racine est active au moment de l'écriture finale.
- Le défi doit correspondre à la demande, au compte, au root, au nouvel appareil et au hash exact du transcript.
- L'expiration est évaluée avec l'heure serveur ; l'heure du téléphone n'est pas une autorité.
- La consommation du défi, la transition de la demande et l'activation doivent être atomiques.
- Une révocation de la racine qui gagne la course interdit l'approbation.
- Un appareil secondaire ne peut jamais signer ou autoriser l'enrôlement d'un autre appareil.
- Un certificat ancien ne peut pas être réutilisé pour une nouvelle demande.

## 6. Idempotence et pertes réseau

Si le client perd la connexion après l'envoi de l'approbation, il ne doit pas créer une nouvelle cérémonie automatiquement.

La reprise doit interroger l'état serveur de la même demande :

- si le commit a réussi, retourner l'état déjà établi sans consommer un autre défi ;
- si le commit n'a pas eu lieu et que le défi est encore valide, autoriser la reprise strictement identique ;
- si le défi a expiré ou a été consommé sans résultat récupérable, terminer la demande et exiger une nouvelle cérémonie avec de nouveaux identifiants et nonces ;
- ne jamais réactiver une demande annulée, expirée ou révoquée.

La réponse idempotente ne doit jamais révéler un secret ou une clé privée.

## 7. Tests adversariaux bloquants

- Altération individuelle de chaque champ après signature.
- Remplacement du compte, de la racine, de la version racine ou de l'appareil cible.
- Substitution des clés ECDSA ou ECDH.
- Nonce trop court, réutilisé ou remplacé.
- Défi d'une autre demande, autre compte ou autre racine.
- Défi expiré ; horloge client avancée ou reculée.
- Rejeu après consommation.
- Deux approbations concurrentes du même défi.
- Deux racines concurrentes ou racine révoquée pendant l'approbation.
- Perte réseau juste avant et juste après le commit.
- Sérialisations différentes Android/iOS/Web/serveur donnant un transcript non identique.
- Champs inconnus, dupliqués, réordonnés ou encodages non canoniques.

## 8. Conditions avant implémentation

- Revue indépendante du transcript et des choix cryptographiques.
- Choix et tests d'un encodage canonique interopérable.
- Définition des tailles, formats, durées et états exacts des défis.
- Contrat transactionnel D1 démontré pour consommation et révocation concurrentes.
- Tests d'interopérabilité sur navigateurs Android/iOS et environnement serveur cible.
- Procédure de récupération et de rotation de racine spécifiée séparément.
- Aucun raccordement GPS tant que le protocole complet et la destruction J+30 ne sont pas validés.

**Conclusion :** cette proposition comble le manque de champs et de règles du certificat expérimental, mais elle ne vaut pas validation cryptographique. Le certificat actuel ne doit pas être raccordé à une API d'approbation avant que ce transcript soit arbitré, implémenté et audité.
