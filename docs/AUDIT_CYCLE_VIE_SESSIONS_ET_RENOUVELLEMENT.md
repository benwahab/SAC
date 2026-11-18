# SAC — Audit du cycle de vie des sessions et de leur renouvellement

**Date :** 18 novembre 2026  
**Statut :** audit documentaire et du contrat de domaine ; les durées de session (30 jours consécutifs d'inactivité et 90 jours maximum absolus) ont depuis été validées par l'utilisateur le 18 novembre 2026. Le mécanisme de renouvellement reste non décidé ; aucun endpoint ni stockage n'est implémenté.

## 1. Périmètre vérifié

Documents et code examinés sur `main` :

- `docs/CONTRAT_SECURITE_D1.md`
- `docs/CONTRATS_OPERATIONS_ATOMIQUES_D1.md`
- `docs/PROTOCOLE_MULTI_APPAREILS.md`
- `docs/MACHINES_ETATS_ET_CONSERVATION.md`
- `src/domain/session-authorization.ts`

Le module TypeScript est un évaluateur pur. Il ne crée pas de session, ne lit pas D1, ne vérifie pas un jeton présenté, ne renouvelle pas une session et ne révoque aucun appareil.

## 2. Garanties déjà écrites et cohérentes

Les documents convergent sur les points suivants :

1. Une session appartient à un seul compte et à un seul appareil.
2. Chaque requête protégée doit contrôler l'état actif et l'expiration de la session, l'état actif de l'appareil et l'égalité de `auth_version`.
3. Le jeton brut ne doit jamais être persisté ; seul un hash adapté est stocké.
4. Une révocation d'appareil incrémente `auth_version`, invalide toutes ses sessions et bloque les renouvellements futurs.
5. Les autres appareils du compte ne doivent pas être invalidés par la révocation d'un appareil.
6. Les vérifications sensibles doivent être réévaluées dans l'écriture SQL finale ; une lecture préalable en TypeScript ne ferme pas la course.
7. Une réponse perdue après commit doit pouvoir être rejouée sans créer un second effet.

## 3. Divergences et précisions nécessaires

### 3.1 Expiration : état calculé ou état persisté

Le document des machines à états liste `active`, `revoked` et `expired`. Le type du module `src/domain/session-authorization.ts` ne stocke que `active` ou `revoked` et déduit l'expiration en comparant `now` à `expiresAt`.

Ce n'est pas nécessairement une contradiction : l'expiration peut être un état dérivé, sans écriture de transition. Il faut toutefois choisir explicitement avant le schéma D1 :

- soit `expired` est un état calculé à la lecture et aucun worker n'est requis pour l'établir ;
- soit l'expiration doit être matérialisée pour des besoins d'audit/nettoyage, avec une règle idempotente et sans que cette matérialisation soit nécessaire au refus d'accès.

Dans les deux cas, le refus doit être immédiat à l'heure serveur dès que `now >= expiresAt`, sans attendre un job planifié.

### 3.2 Jeton de rafraîchissement : mentionné mais non spécifié

`docs/PROTOCOLE_MULTI_APPAREILS.md` exige d'invalider les jetons de rafraîchissement lors d'une révocation. En revanche, le modèle conceptuel décrit `device_sessions` avec empreinte de jeton, expiration et révocation, sans contrat distinct de refresh token, de famille de jetons, de rotation ou de détection de rejeu.

Il ne faut donc pas coder un refresh token sur la seule base de cette mention. Avant toute implémentation, décider si SAC utilise :
- des sessions à durée limitée sans renouvellement silencieux ;
- ou un mécanisme de renouvellement distinct, avec jeton opaque, stockage hashé, rotation à usage unique et révocation atomique.

Si le renouvellement est retenu, il faudra définir la politique de rejeu d'un ancien jeton, le traitement des requêtes concurrentes, l'idempotence après perte de réponse et la révocation de toute la famille concernée. Une simple rotation côté client ne suffit pas.

### 3.3 Renouvellement et changement d'appareil

Un renouvellement ne doit jamais transformer un appareil révoqué ou en attente en appareil actif. Il doit vérifier l'appareil et la session courants depuis D1, ainsi que la version `auth_version`. Le renouvellement ne doit pas modifier l'identité racine, le certificat ou les droits d'un appareil.

Un appareil neuf passe par la cérémonie d'enrôlement distincte. Un mot de passe ou un OTP ne doit pas faire passer un appareil en attente à l'état actif.

### 3.4 Révocation et requêtes en vol

Le contrat doit distinguer :
- requêtes qui ont validé leur autorisation avant le commit de révocation ;
- requêtes dont l'écriture finale intervient après ce commit ;
- requêtes qui lisent un état ancien depuis une réplique ;
- requêtes de renouvellement simultanées à la révocation.

Pour toute mutation sensible, l'autorisation doit être vérifiée dans l'écriture finale sur l'état D1 courant. Une fois la révocation validée, aucune opération ultérieure avec l'ancienne session ou l'ancien jeton de renouvellement ne doit réussir. La sémantique des opérations déjà engagées avant le commit doit être documentée ; ne pas promettre l'annulation rétroactive d'une opération déjà validée.

## 4. Contrat minimal à exiger si le renouvellement est approuvé

- Jeton généré par CSPRNG, opaque et à forte entropie ; seule une empreinte/hash adapté est persistée.
- Liaison immuable au compte, à l'appareil, à la session ou famille, et à la version d'autorisation.
- Expiration serveur et limites d'utilisation explicites.
- Rotation à usage unique si refresh token retenu ; deux consommations concurrentes ne peuvent pas toutes deux réussir.
- Une ancienne valeur consommée ne peut jamais recréer une session après rotation ou révocation.
- Révocation de l'appareil invalide les sessions et toutes les autorisations de renouvellement associées dans une opération D1 contrôlée.
- Idempotence explicite pour la perte de réponse après commit ; la même commande ne crée pas plusieurs successeurs.
- Aucun jeton, secret, OTP ou contenu GPS dans logs, analytics, traces ou messages d'erreur.
- Transport non choisi à ce stade : cookies sécurisés, CSRF, XSS, PWA et futur client Capacitor doivent être analysés ensemble avant arbitrage.

## 5. Matrice de tests requise avant activation

| Scénario | Résultat attendu |
|---|---|
| Session active, appareil actif, avant expiration | Autorisation possible si toutes les autres conditions sont valides |
| À l'instant exact `now = expiresAt` | Refus |
| Session expirée mais appareil toujours actif | Refus ; aucun renouvellement implicite |
| Appareil révoqué avec session non expirée | Refus immédiat côté serveur |
| Ancienne sauvegarde locale restaurée après révocation | Refus par l'état serveur courant |
| Révocation concurrente avec mutation protégée | Aucune mutation dont l'écriture finale survient après le commit de révocation |
| Révocation concurrente avec renouvellement | Aucun nouveau jeton/session accepté après le commit |
| Deux utilisations simultanées d'un même refresh token (si adopté) | Une seule consommation métier |
| Rejeu d'un refresh token déjà consommé | Refus et traitement de sécurité défini |
| Perte réseau après renouvellement validé | Retry idempotent, pas de deuxième successeur |
| Révocation d'un appareil parmi plusieurs | Les autres appareils restent actifs |
| Révocation de l'appareil courant | Toutes les conséquences terminent ou aucune ; pas d'arrêt à mi-chemin |

Les tests de concurrence doivent être exécutés sur un runtime D1 isolé. Les tests unitaires du module pur ne suffisent pas.

## 6. Décisions encore ouvertes — ne pas inventer

- Durée d'une session et délai d'inactivité éventuel.
- Renouvellement silencieux ou réauthentification périodique.
- Existence d'un refresh token séparé, durée, rotation et détection de réutilisation.
- Transport du jeton selon PWA et futur client natif.
- Politique après changement de mot de passe, récupération du compte ou suspicion de compromission.
- Politique d'expiration matérialisée ou calculée.
- Délai et contenu des notifications de sécurité aux autres appareils.

## 7. Garde-fous de réalisation

Aucun endpoint, migration D1, fournisseur OTP/SMS, stockage de refresh token ou changement du code d'autorisation n'est autorisé par cet audit. Le document ne choisit pas les durées et ne rend pas le mécanisme de session prêt pour production.

Aucune donnée GPS précise ne doit être ajoutée aux sessions, jetons, journaux ou mécanismes de renouvellement. Le verrou de destruction irréversible J+30 reste indépendant et inchangé.

**Conclusion :** le contrôle de session et la révocation par appareil sont correctement posés comme invariants, mais le cycle de renouvellement n'est pas encore spécifié. Le point le plus important à trancher est l'existence ou non d'un refresh token séparé ; tant que ce choix et ses règles anti-rejeu ne sont pas validés, il ne faut pas implémenter de renouvellement silencieux.
