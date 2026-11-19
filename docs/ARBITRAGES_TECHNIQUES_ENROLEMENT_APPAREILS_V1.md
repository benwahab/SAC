# SAC — Arbitrages techniques proposés pour l'enrôlement des appareils V1

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** recommandations techniques pour revue — NON validées par l'utilisateur, NON implémentées.  
**Périmètre :** racine WebAuthn PWA déjà validée comme décision produit ; ajout d'appareils secondaires, modèle D1, sessions et reprise après restauration.  
**Interdiction :** ce document n'autorise aucune migration D1 de production, route API, ressource Cloudflare ou déploiement.

## 1. Décisions déjà acquises — ne pas les rouvrir

1. La racine V1 est une credential WebAuthn de plateforme créée depuis la PWA.
2. L'authenticator doit exiger la vérification utilisateur.
3. Seules les credentials single-device `BE=0` et `BS=0` sont admises ; aucune affirmation de certification matérielle.
4. Aucune bascule silencieuse vers Web Crypto/IndexedDB ou une clé logicielle.
5. Un compte possède au plus une racine active en V1.
6. Seule la racine active peut approuver un appareil secondaire ; un secondaire ne peut ni approuver ni devenir racine.
7. Aucune récupération, synchronisation ou promotion automatique de la racine perdue.
8. Une session est liée à un compte et à un appareil ; inactivité maximale 30 jours, durée absolue maximale 90 jours.
9. Les preuves d'approbation doivent être liées à la demande exacte et le défi ne peut être consommé qu'une fois.

Ces décisions ne rendent pas le protocole technique complet ni l'application opérationnelle.

## 2. Arbitrages techniques recommandés

Les choix ci-dessous sont des recommandations de conception. Ils ne deviennent pas des décisions produit sans validation explicite.

### 2.1 Source de vérité des clés et relation racine/appareil

**Recommandation :** faire de `devices` l'unique source de vérité pour l'identité cryptographique de chaque appareil. Cette table porte le credential ID WebAuthn, la clé publique validée, l'algorithme, le RP ID/profil et l'état de l'appareil.

La table `device_roots` ne dupliquerait aucune clé publique. Elle représenterait seulement l'autorité racine courante du compte : `account_id` unique, `root_device_id` unique et référencé vers `devices`, génération/version strictement croissante, dates et état.

Contraintes à prouver :
- la racine référence un appareil du même compte ;
- un appareil ne peut être racine de plusieurs comptes ;
- au plus une racine active par compte ;
- la racine référencée doit être un appareil actif ;
- révoquer la racine invalide immédiatement son autorité d'approbation ;
- une génération révoquée n'est jamais réutilisée ;
- les clés privées restent sur l'appareil.

Cette normalisation évite deux copies divergentes d'une même clé et sépare le rôle d'autorité de l'identité cryptographique de l'appareil.

### 2.2 Une seule cérémonie secondaire en attente par compte

**Recommandation V1 :** imposer une seule cérémonie secondaire active (`pending`) par compte. Une nouvelle demande ne doit pas remplacer silencieusement la précédente : l'utilisateur doit annuler explicitement l'ancienne ou attendre son expiration.

Motifs : réduire les courses entre approbations, simplifier l'écran de validation de la racine et limiter les demandes concurrentes. La contrainte doit être garantie par D1, pas seulement par une vérification TypeScript.

La même règle de sérialisation doit être appliquée à l'enregistrement initial de la racine : une seule cérémonie racine en attente par compte.

### 2.3 Défi WebAuthn et transcript

**Recommandation :**
- générer un nonce serveur CSPRNG de 32 octets par cérémonie ;
- conserver les éléments nécessaires pour recalculer exactement le challenge WebAuthn et vérifier l'approbation ;
- conserver les octets canoniques exacts du transcript, ou une représentation immuable permettant de les reconstruire à l'identique ;
- conserver également l'empreinte SHA-256 et la version du profil ;
- ne jamais stocker seulement un digest si le serveur ou le nouvel appareil doit reconstruire les octets exacts ;
- ne jamais journaliser le nonce, le challenge, le transcript brut ou l'assertion complète.

Le challenge WebAuthn est public après émission : sa sécurité repose sur son caractère imprévisible, son association à une cérémonie précise, son expiration et sa consommation atomique. Le nonce n'est pas un mot de passe. Son stockage doit néanmoins être protégé contre les accès non autorisés et les fuites de logs.

Le transcript candidat de 19 champs doit être gelé avec des vecteurs indépendants avant toute utilisation. Le profil JCS/UTF-8/SHA-256, les types, les limites, l'ordre logique des champs et les règles de rejet doivent être identiques sur serveur et appareil secondaire. Aucun parseur permissif ni re-sérialisation implicite.

### 2.4 Durées et limites des cérémonies

**Valeurs techniques proposées pour les essais, non homologuées :**
- challenge WebAuthn : expiration à 5 minutes ;
- cérémonie complète : expiration à 10 minutes ;
- une seule relance explicite de la cérémonie après expiration ;
- limitation serveur des créations et validations répétées, avec réponse générique qui ne révèle pas l'existence d'un compte ;
- expiration contrôlée par horloge serveur, jamais par horloge du navigateur.

Ces valeurs doivent être testées sur des téléphones réels et avec réseau intermittent avant homologation. Le dépassement de délai ne doit jamais activer un appareil ; il ferme seulement la tentative.

### 2.5 Validation WebAuthn et bibliothèque

**Candidat conservé :** `@simplewebauthn/server@14.1.0`.

Le smoke test Workers déjà passé prouve uniquement que le paquet s'importe dans le runtime local Cloudflare Workers, que la génération d'options fonctionne et qu'une réponse volontairement invalide est rejetée. Il ne prouve pas qu'une vraie inscription ou authentification valide est acceptée.

Avant d'ajouter la dépendance à l'application :
1. intégrer des fixtures WebAuthn valides et indépendamment générées ;
2. vérifier inscription et assertion d'authentification valides ;
3. vérifier BE/BS, UP/UV, origin, RP ID, challenge, algorithme et credential ID ;
4. tester signatures altérées, mauvais compte, rejeu, expiration et credential révoquée ;
5. comparer les résultats avec un second vérificateur indépendant ;
6. tester le parcours sur appareils Android réels et navigateurs cibles.

Ne pas écrire un vérificateur WebAuthn maison pour contourner une incompatibilité de la bibliothèque.

### 2.6 Activation secondaire — transaction D1 cible

Le commit final doit recontrôler dans la transaction :
- compte actif ;
- cérémonie pending et non expirée ;
- défi issued, non expiré et non consommé ;
- racine active, non révoquée et génération identique à celle du début ;
- credential racine exacte ;
- appareil demandeur réservé au compte et toujours non activé ;
- preuves valides et liées aux mêmes octets canoniques ;
- identifiants et clés non déjà liés ailleurs.

Dans le même `D1.batch()`, les écritures doivent :
1. consommer le défi par transition conditionnelle ;
2. finaliser la cérémonie ;
3. activer l'appareil et enregistrer les clés publiques vérifiées ;
4. enregistrer les résultats d'audit minimaux ;
5. déclencher une garde SQL qui provoque un rollback si une précondition attendue n'a affecté aucune ligne.

Le batch résolu n'est pas, à lui seul, un succès métier : vérifier les résultats et le nombre de lignes affectées. La session est créée après le commit d'activation. Une réponse perdue doit pouvoir être récupérée par une clé d'idempotence liée au compte, à l'appareil et à la commande, sans répéter l'activation.

### 2.7 Sessions PWA

**Recommandation à étudier :** cookie de session opaque, aléatoire et de forte entropie, avec attributs `HttpOnly`, `Secure`, `SameSite` adaptés au déploiement SAC ; ne conserver côté D1 que l'empreinte du secret, jamais le jeton brut. Prévoir rotation, révocation et protection CSRF.

Toute requête sensible relit l'état courant du compte, de l'appareil et de la session. Un appareil révoqué perd immédiatement toutes ses sessions. Le renouvellement ne doit pas pouvoir réactiver une session révoquée.

Le stockage natif Capacitor, si l'application devient native, devra être spécifié séparément ; ne pas présumer qu'un cookie PWA est le bon mécanisme natif.

### 2.8 Audit et rétention des cérémonies

**Recommandation :** conserver les métadonnées strictement nécessaires à l'anti-rejeu et à l'investigation : identifiants opaques, transitions d'état, timestamps serveur, versions de protocole/validateur, empreintes, code de résultat et corrélation.

Ne pas conserver par défaut :
- challenge ou nonce en clair dans les journaux ;
- OTP, mot de passe, jeton de session ;
- clés privées ;
- assertion brute complète ;
- contenu libre non nécessaire.

La durée de rétention des cérémonies et événements d'audit reste à décider dans la matrice globale de conservation. Ne pas inventer une durée légale ou conserver indéfiniment par défaut.

## 3. Point critique : restauration D1 et retour d'un état antérieur

La documentation officielle Cloudflare indique que D1 Time Travel peut restaurer une base à un point antérieur, en écrasant la base en place. Les bookmarks antérieurs restent disponibles après une restauration. La fenêtre documentée est jusqu'à 30 jours sur Workers Paid et 7 jours sur Workers Free. Une restauration vers un état antérieur peut donc remettre dans la base un état qui précédait une révocation ou la consommation d'un défi.

Référence officielle : https://developers.cloudflare.com/d1/reference/time-travel/

**Conclusion de sécurité : D1 seul ne prouve pas l'irréversibilité d'une révocation.** La transaction atomique protège les opérations concurrentes en fonctionnement normal ; elle n'empêche pas un administrateur autorisé de restaurer ensuite une ancienne image cohérente de la base.

### Exigence avant production

Le système doit définir une autorité anti-retour-arrière indépendante de l'historique D1 restaurable, ou une procédure de restauration qui invalide de façon démontrable toutes les autorités cryptographiques et sessions susceptibles d'avoir été réactivées.

La conception doit au minimum traiter :
- restauration à un point avant révocation d'une racine ;
- restauration à un point avant consommation d'un challenge ;
- restauration après activation d'un appareil ;
- restauration après révocation d'un appareil ou d'une session ;
- restauration répétée vers des bookmarks encore plus anciens ;
- reprise du trafic pendant ou après restauration ;
- cohérence des clés, secrets et epochs conservés hors D1.

**Option de repli fail-closed à étudier :** suspendre les opérations sensibles après toute restauration et exiger une invalidation globale des sessions et des autorités appareil avant réouverture. Cette procédure est une piste, pas une garantie démontrée : elle doit elle-même être protégée contre une seconde restauration et testée de bout en bout.

Aucun service externe n'est sélectionné par ce document. Aucun compte, secret, KMS, Durable Object ou ressource Cloudflare n'est autorisé ou créé.

**NO-GO maintenu :** pas de migration d'enrôlement de production ni d'activation réelle tant que la stratégie anti-retour-arrière et son test de restauration ne sont pas démontrés.

## 4. Matrice des tests bloquants avant migration

| Domaine | Tests minimum |
|---|---|
| Modèle relationnel | racine d'un autre compte, doublon de credential, racine orpheline, deux racines actives |
| Concurrence | deux demandes secondaires, deux approbations, révocation racine pendant approbation |
| Challenge | mauvais nonce, expiration, rejeu, consommation simultanée, réponse perdue |
| Transcript | un octet modifié, champ inconnu, doublon JSON, mauvais ordre/canonicalisation, limites dépassées |
| WebAuthn | fixture valide, signature altérée, mauvaise origine/RP ID, UP/UV absents, BE/BS interdits |
| Appareil | demandeur substitué, appareil révoqué, appareil d'un autre compte |
| Session | session avant activation, renouvellement après révocation, révocation concurrente |
| Restauration | état avant/après chaque révocation, ancien bookmark après restauration, deuxième restauration |
| Exploitation | réseau interrompu, réponse perdue, reprise idempotente, horloge client incorrecte |
| Compatibilité | Android physique, navigateurs PWA ciblés, authenticator réellement disponible |

## 5. Ordre de réalisation recommandé après validation

1. Revue indépendante du protocole WebAuthn et des vecteurs de transcript.
2. Validation des arbitrages de ce document, notamment le modèle normalisé et les règles de concurrence.
3. Conception de l'autorité anti-retour-arrière et d'un runbook de restauration.
4. Schéma relationnel SQL et contraintes D1 finales.
5. Tests D1 isolés sur le schéma exact, y compris courses de révocation et restauration.
6. Fixtures cryptographiques valides et vérificateur secondaire indépendant.
7. Implémentation des routes d'enrôlement, activation, révocation et sessions.
8. Tests sur appareils physiques.
9. Revue sécurité finale avant tout environnement réel.

## 6. État honnête

À la date de ce document :
- la décision produit de racine WebAuthn single-device est validée ;
- le smoke test SimpleWebAuthn dans Workers est réussi, mais limité ;
- le test local D1 de consommation atomique, rejeu concurrent et rollback est réussi ;
- le modèle relationnel, le profil d'enregistrement et le profil de preuve restent des documents de conception ;
- aucun endpoint de racine ou d'appareil secondaire n'est opérationnel ;
- aucune migration d'enrôlement de production n'existe ;
- aucun test cryptographique avec fixture valide ni test d'authenticator physique n'a été réalisé ;
- aucune stratégie anti-retour-arrière D1 n'est homologuée.

Le passage à l'implémentation ne doit pas être confondu avec la validation des documents ni avec le succès du CI.
