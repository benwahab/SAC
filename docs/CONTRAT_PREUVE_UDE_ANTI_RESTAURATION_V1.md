# SAC — Contrat de preuve UDE pour l'autorité anti-retour-arrière

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** contrat technique candidat + tests comportementaux locaux uniquement. Aucune ressource Azure, aucun endpoint UDE déployé, aucun SDK ajouté à l'application.  
**Décision fournisseur :** Azure Confidential Ledger non sélectionné.  
**Production :** NO-GO maintenu.

## 1. Objet

Définir le contrat minimal à prouver pour qu'une route UDE puisse devenir l'autorité externe de séquence des événements de sécurité SAC et empêcher qu'une restauration D1 ressuscite un ancien état de racine, d'appareil, de challenge ou de session.

Le registre externe serait l'autorité ; D1 ne serait qu'une projection reconstruisible. Le test local ajouté au dépôt est un modèle comportemental en mémoire, et non un émulateur CCF ou un test Azure.

## 2. Route métier proposée

Route unique candidate : `POST /sac/security-events`.

L'identité d'exécution SAC ne reçoit aucun droit Contributor/Administrator. Un rôle personnalisé doit autoriser uniquement cette route et les lectures de récupération explicitement nécessaires. L'identité de déploiement UDE et l'identité de gouvernance restent séparées.

Le payload métier candidat comprend :
- `schemaVersion` ;
- `accountRef` opaque, généré côté serveur et non réversible ;
- `operationId` aléatoire, stable lors des reprises d'une même commande ;
- `expectedSequence` ;
- `previousHash` ;
- `eventType` enum fermé ;
- `objectRef` opaque ;
- `generation` ;
- `eventPayloadDigest` ou données minimales strictement autorisées.

Le serveur calcule le digest canonique. Il ne fait pas confiance à un hash envoyé seul par le client. Le protocole exact de canonicalisation, le domaine de hash et les vecteurs devront être gelés avant une implémentation.

Aucune donnée personnelle, GPS, secret, OTP, jeton, clé privée, assertion WebAuthn brute, challenge brut ou contenu libre SOS ne peut être inscrite dans le registre.

## 3. Invariants transactionnels requis

Dans une transaction CCF unique, la route doit :
1. valider strictement le schéma, les tailles, les enums et l'identité appelante ;
2. retrouver `operationId` ;
3. si même clé et même digest déjà commis, retourner le résultat original sans nouvelle transition ;
4. si même clé mais digest différent, rejeter ;
5. lire la tête du compte ;
6. comparer `expectedSequence` et `previousHash` à la tête réelle ;
7. vérifier que la clé d'événement et la clé de séquence n'existent pas ;
8. écrire l'événement sous une clé jamais réutilisée ;
9. mettre à jour la tête et le registre idempotent ;
10. lier l'événement au mécanisme de transaction/reçu vérifiable ACL, sans prétendre que le numéro de séquence métier est un reçu natif.

Toute erreur doit annuler événement, tête et registre idempotent ensemble. Une écriture partielle n'est pas acceptable.

Deux commandes concurrentes présentant la même tête doivent produire exactement une seule transition réussie. La deuxième doit échouer avec un conflit d'état et ne doit laisser aucune mutation.

## 4. Réponse perdue et reprise

L'appelant crée une seule fois un `operationId` pour une intention. Après timeout, il ne génère pas une nouvelle clé et ne renvoie pas aveuglément un append différent.

La reprise doit interroger la route de consultation métier par `operationId` :
- résultat commis retrouvé : retourner le résultat déjà enregistré ;
- clé inconnue et tête inchangée : autoriser une reprise contrôlée de la même commande ;
- clé inconnue mais tête avancée : réconcilier l'historique avant toute nouvelle décision ;
- même clé avec digest différent : blocage de sécurité.

Le contrat de consultation doit permettre de retrouver la référence de transaction native ACL, le statut de commit et le reçu. Si l'UDE ne peut pas exposer cette information ou une méthode fiable de récupération, le critère reçu/reprise reste NO-GO.

## 5. Reçus et preuve indépendante

Une référence métier, une séquence KV, un hash chain ou une réponse HTTP 200 ne constitue pas à elle seule un reçu cryptographique ACL.

La preuve réelle doit démontrer :
- comment l'écriture UDE est liée à une transaction native du registre ;
- comment récupérer la référence native après perte de la réponse UDE ;
- comment attendre le commit ;
- comment obtenir le reçu Merkle ;
- comment vérifier le reçu et la chaîne de certificat indépendamment du Worker SAC ;
- comment un auditeur peut reconstruire les événements et détecter une lacune, un doublon, une substitution ou un rollback.

Si l'API UDE ne permet pas de faire cette liaison, il faut revoir l'architecture ou rejeter le fournisseur pour ce rôle. Ne pas remplacer silencieusement le reçu par un hash calculé par SAC.

## 6. RBAC et tests négatifs obligatoires

Sur un registre de test réel, une identité d'exécution SAC doit pouvoir appeler la route métier autorisée, mais se voir refuser :
- `POST /app/transactions` ;
- les autres endpoints UDE en écriture ;
- les endpoints d'administration ;
- les modifications de rôles, utilisateurs, politiques et bundle UDE ;
- la suppression ou la reconfiguration du registre.

Les permissions doivent être inspectées dans le registre réellement déployé. Une allowlist simulée dans le code de test local ne prouve aucun RBAC Azure.

## 7. Contrat de reprise D1

Ordre de cohérence candidat :
1. vérifier la tête indépendante ;
2. append/valider l'événement auprès de l'autorité ;
3. obtenir le commit et le reçu vérifié ;
4. appliquer la projection D1 à la même séquence/hash ;
5. confirmer que la projection correspond ;
6. seulement ensuite confirmer l'opération métier au demandeur.

Si l'autorité a commis l'événement mais que D1 échoue, le Worker doit retourner un état de reprise, pas un succès final. Au retry, la même clé retrouve l'événement existant et reconstruit D1 sans nouvel append.

Si D1 est en avance ou diverge de l'autorité, ne pas auto-écraser les preuves : geler le compte et déclencher une procédure de réconciliation/audit. La politique de disponibilité du SOS lors d'une panne de l'autorité reste un arbitrage ouvert.

## 8. Tests locaux ajoutés

Fichier : `tests/acl-ude-contract-model.test.ts`  
Commande : `npm run test:acl-ude-contract`

Le modèle teste :
- deux append concurrents avec la même séquence : une seule réussite ;
- séquence obsolète et empreinte précédente incorrecte ;
- idempotence même clé/même contenu ;
- refus même clé/contenu différent ;
- rollback modèle après erreur à deux étapes ;
- réponse perdue après commit et reprise sans doublon ;
- isolation des têtes par compte ;
- rejet des entrées mal formées ;
- allowlist locale de la route métier et refus des routes natives/admin non autorisées.

**Limites expresses :**
- le stockage en mémoire et le copy-on-write ne simulent pas CCF ;
- les références de transaction générées par le test sont synthétiques et ne sont pas des transaction IDs Azure ;
- aucun reçu Merkle n'est généré ni vérifié ;
- l'allowlist est une simulation locale, pas une preuve RBAC ;
- le test ne démontre ni disponibilité, ni latence, ni persistance, ni restauration, ni sécurité du fournisseur.

## 9. Protocole de test réel ultérieur — seulement après autorisation

Sur un registre de test neuf et sans données personnelles :
1. déployer le bundle UDE de test et une identité d'exécution limitée ;
2. inspecter les rôles et les actions effectives ;
3. exécuter toutes les tentatives d'accès direct interdites ;
4. exécuter les tests de concurrence, de conflit, de clé existante et de rollback ;
5. couper le transport avant acceptation, après acceptation et après commit ;
6. retrouver l'opération par la même clé et vérifier l'absence de doublon ;
7. obtenir et vérifier les reçus natifs ;
8. reconstruire la tête et l'historique depuis le registre ;
9. tester D1 restaurée en arrière, D1 en avance, et D1 indisponible ;
10. mesurer latence depuis le Niger, limites, coûts et résidence primaire + région jumelée.

Aucune de ces opérations réelles n'est exécutée par le présent commit. Elles exigent le choix explicite du fournisseur, l'accord sur les régions et les coûts, puis l'autorisation de créer une ressource de test.

## 10. Décision

Le contrat local est utile pour stabiliser les attentes SAC et empêcher une future implémentation de réduire la sécurité à un simple append. Il ne permet pas de déclarer Azure Confidential Ledger compatible ou sélectionné.

**NO-GO production maintenu** jusqu'à preuve réelle du compare-and-append, de l'idempotence, du reçu, du RBAC, de la reprise après coupure, de la reconstruction et de la résistance au retour arrière.
