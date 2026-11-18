# SAC — Audit des abus, du détournement de compte et de la disponibilité du SOS

**Date :** 18 novembre 2026  
**Branche examinée :** `main`  
**Commit de base :** `614e69ddf31002c23c66e1e2b136b72764003e0e`  
**Statut :** audit de conception et de code ciblé ; aucune règle de blocage, route, migration ou intégration anti-abus n'est activée par ce document.

## 1. Objectif

Protéger SAC contre les abus sans transformer les protections anti-fraude en obstacle à une personne qui a réellement besoin d'aide.

Le risque est double :
- laisser un acteur malveillant détourner un compte, envoyer des invitations abusives ou épuiser les ressources de notification ;
- bloquer un utilisateur légitime au moment d'un danger réel par un CAPTCHA, une limite trop stricte, un verrouillage automatique ou une analyse de risque opaque.

**Principe de conception :** les contrôles renforcés doivent protéger les opérations administratives et les ressources coûteuses, mais ne doivent pas empêcher silencieusement le déclenchement d'une alerte d'urgence par une session SAC valide.

## 2. Périmètre effectivement examiné

Fichiers relus sur `main` :
- `docs/CONTRAT_SECURITE_D1.md`
- `docs/PROTOCOLE_MULTI_APPAREILS.md`
- `docs/REVUE_CRYPTO_PRELIMINAIRE.md`
- `docs/AUDIT_CYCLE_VIE_SESSIONS_ET_RENOUVELLEMENT.md`
- `src/domain/session-authorization.ts`
- `src/domain/account-lifecycle.ts`
- `tests/session-authorization.test.ts`
- `tests/device-lifecycle.test.ts`
- `tests/device-certificate.test.ts`
- `tests/account-lifecycle.test.ts`
- `package.json`

Les chemins suivants n'ont pas été trouvés sur la branche examinée :
- `src/domain/abuse-protection.ts`
- `src/domain/rate-limit.ts`
- `functions/api/auth/` comme module de routes vérifié dans cet audit
- `tests/abuse-protection.test.ts`

La recherche était ciblée ; elle ne prouve pas l'absence de toute protection dans chaque fichier du dépôt. Aucun middleware ou stockage de compteurs anti-abus serveur n'a toutefois été démontré dans les éléments relus.

## 3. État constaté

### Protections déjà spécifiées ou testées en partie

- Le compte, l'appareil et la session sont des identités distinctes.
- Le contrat de sécurité exige de retrouver le hash du jeton et de vérifier l'état courant du compte, de la session, de l'appareil et de `auth_version` depuis D1.
- Les sessions expirées ou révoquées, les appareils non actifs et les versions d'autorisation obsolètes sont refusés par le contrat TypeScript pur.
- Les défis à usage unique doivent être liés à un contexte et consommés atomiquement.
- Les certificats d'appareils secondaires sont liés à un compte et à un appareil précis et vérifiés par signature de la racine.
- Les tests unitaires couvrent plusieurs cas négatifs de session, appareil et certificat.
- La demande de suppression de compte bloque les nouvelles activités dans le contrat métier pur.

### Protections non démontrées en production

- Middleware d'authentification exécuté sur chaque route sensible.
- Limitation de débit persistante côté serveur, distribuée entre instances.
- Protection contre credential stuffing et essais OTP répétés.
- Limites anti-spam pour invitations et demandes de vérification.
- Protection contre l'épuisement des coûts push/SMS.
- Détection et traitement des sessions ou appareils compromis.
- Journalisation de sécurité filtrée et alertes d'abus.
- Tests D1 de concurrence, de quotas et de résistance aux rafales.
- Procédure de récupération en cas de faux positif.

Le module `session-authorization.ts` est un évaluateur pur. Il ne lit pas D1, ne vérifie pas lui-même le jeton présenté et ne limite pas le nombre de tentatives. Ses tests ne prouvent donc pas le fonctionnement d'une protection serveur complète.

## 4. Constats et exigences

### S-01 — Aucun mécanisme de limitation de débit serveur n'a été démontré

**Niveau : BLOQUANT AVANT OUVERTURE PUBLIQUE**

Une limite appliquée uniquement dans l'interface ou dans la mémoire d'une instance serait contournable en changeant d'appareil, d'adresse réseau ou en envoyant directement les requêtes.

**À spécifier :**
- compteurs partagés côté serveur, résistants aux requêtes concurrentes ;
- clés de limitation distinctes par compte, appareil, opération et, lorsque nécessaire, source réseau ;
- fenêtres et quotas propres à chaque opération, définis après mesure des usages réels ;
- réponse explicite et réessayable lorsque la limite est atteinte ;
- protection contre la remise à zéro artificielle des compteurs par rotation d'identifiants ;
- limitation de coût des opérations qui appellent un fournisseur externe.

Ne pas fixer de nombres arbitraires dans ce document : les seuils doivent être mesurés, documentés et validés avant déploiement.

### S-02 — Le SOS ne doit pas être bloqué par un anti-abus générique

**Niveau : CRITIQUE — SÛRETÉ UTILISATEUR**

Un attaquant peut tenter d'épuiser les quotas ou provoquer des faux positifs afin qu'un utilisateur légitime ne puisse plus alerter.

**Règles impératives proposées :**
- aucune CAPTCHA obligatoire au moment du SOS ;
- aucun verrouillage automatique du compte uniquement parce que plusieurs SOS ont été déclenchés ;
- aucune interdiction silencieuse basée uniquement sur IP, géolocalisation, changement de réseau ou score comportemental ;
- aucune confirmation supplémentaire longue qui retarde le déclenchement d'une urgence ;
- le bouton SOS ne doit pas attendre une analyse anti-fraude distante avant de confirmer la réception locale de la demande ;
- si le service est limité ou indisponible, afficher honnêtement ce qui a été enregistré et ce qui n'a pas été transmis.

La protection contre les doublons de requête doit être traitée par l'idempotence, pas par un cooldown arbitraire qui empêcherait une seconde urgence réelle.

**À arbitrer séparément :** le comportement de deux alertes distinctes rapprochées, notamment lorsqu'une première alerte est déjà active. Ne pas fusionner ou supprimer automatiquement une alerte nouvelle.

### S-03 — Les tentatives d'authentification et OTP nécessitent des protections dédiées

**Niveau : BLOQUANT**

Le contrat de sécurité prévoit des défis à usage unique, mais le fournisseur et le flux d'authentification ne sont pas implémentés dans le périmètre examiné.

**À spécifier :**
- compteur d'essais côté serveur lié au défi et au compte, sans exposer l'existence d'un compte ;
- expiration courte et consommation atomique à usage unique ;
- délais progressifs et limites de renvoi OTP ;
- limites par compte, destination et source réseau, avec protection contre la distribution d'attaques ;
- réponse générique empêchant l'énumération de comptes ;
- invalidation des défis précédents lors d'un nouveau défi selon une règle explicite ;
- stockage de vérificateurs protégés par secret serveur et non d'OTP en clair ;
- audit sans code, numéro complet, adresse e-mail complète ni jeton.

Un blocage temporaire d'authentification ne doit pas invalider automatiquement une session déjà active et valide, ni neutraliser le SOS depuis cette session.

### S-04 — Les invitations de contacts peuvent être utilisées pour harceler ou épuiser les ressources

**Niveau : ÉLEVÉ**

Les invitations par téléphone/e-mail et l'acceptation explicite sont prévues, mais les quotas, renvois et contrôles d'abus ne sont pas spécifiés.

**À spécifier :**
- quotas d'invitations par compte et par destination sur une période définie ;
- renvoi limité et temporisé ;
- révocation immédiate d'une invitation ;
- aucune création automatique de relation de confiance à la réception d'un SMS/e-mail ;
- acceptation et vérification par le destinataire avant activation ;
- mécanisme « ne plus recevoir d'invitations » et traitement des abus ;
- protection contre l'énumération des numéros ou e-mails déjà inscrits ;
- messages neutres pour éviter de révéler le statut d'un compte.

Un destinataire qui refuse ou ignore une invitation ne doit pas être relancé indéfiniment.

### S-05 — Les notifications et SMS peuvent être détournés pour provoquer des coûts

**Niveau : BLOQUANT AVANT FOURNISSEUR**

Une faille de déclenchement pourrait envoyer des volumes importants de SMS ou push et épuiser le budget.

**À spécifier :**
- quotas de coût par compte, canal, destination et période ;
- plafonds globaux de dépenses et mécanisme d'arrêt d'urgence côté exploitation ;
- déduplication par événement métier, destinataire et occurrence ;
- séparation des notifications d'invitation, OTP, rappels SOS et messages transactionnels ;
- limites de tentatives et politique de reprise par canal ;
- contrôle des destinations internationales et des formats de numéro ;
- alertes de consommation anormale ;
- clés fournisseur protégées hors du dépôt et jamais exposées au client.

Les plafonds de coût ne doivent pas supprimer une alerte déjà acceptée par SAC. Si un canal est indisponible ou plafonné, l'interface doit indiquer le canal qui a échoué et ne pas affirmer que le proche a été prévenu.

### S-06 — Les changements d'appareil et la récupération sont des surfaces de détournement majeures

**Niveau : BLOQUANT**

Les documents de récupération établissent qu'un OTP ou un mot de passe ne remplace pas la confiance cryptographique de la racine. Cette séparation doit rester stricte.

**À conserver :**
- nouvel appareil en attente sans accès privé avant approbation ;
- approbation par l'appareil racine selon la cérémonie validée ;
- aucune promotion automatique d'un appareil secondaire ;
- notification de sécurité sur les appareils actifs après enrôlement ou révocation ;
- révocation qui invalide les sessions de l'appareil concerné ;
- récupération de compte qui ne rétablit pas automatiquement les clés racine ou GPS.

**À spécifier :**
- limites sur les demandes d'enrôlement et de renvoi de défis ;
- alerte à l'utilisateur lors de tentatives répétées ou d'un nouvel appareil ;
- procédure de signalement d'un appareil perdu ou volé ;
- traitement des demandes répétées depuis un appareil non approuvé ;
- protections contre le SIM swap et l'accès à une boîte e-mail compromise.

Aucun contrôle anti-abus ne doit permettre au support ou à un canal OTP de remplacer silencieusement la racine.

### S-07 — Le blocage automatique et les scores de risque peuvent créer des faux positifs dangereux

**Niveau : CRITIQUE — SÛRETÉ UTILISATEUR**

Un changement de téléphone, une connexion mobile instable, un réseau partagé, un VPN ou une adresse IP commune ne prouvent pas une fraude. Ces signaux sont particulièrement peu fiables comme motif unique de bloquer un SOS.

**Politique proposée :**
- utiliser les signaux de risque pour déclencher une vérification supplémentaire sur les opérations non urgentes ;
- ne jamais utiliser un signal isolé pour supprimer, retarder ou cacher une alerte d'urgence ;
- séparer « activité suspecte » de « compte compromis confirmé » ;
- offrir une procédure de récupération accessible et traçable ;
- conserver un journal de décision minimal pour analyser les faux positifs ;
- réviser les règles à partir de mesures réelles avant de les rendre plus strictes.

Aucun modèle opaque ne doit prendre seul la décision d'empêcher un SOS.

### S-08 — Les logs et alertes de sécurité risquent de devenir une fuite de données

**Niveau : BLOQUANT**

Les journaux sont utiles pour détecter les abus, mais ils ne doivent pas collecter les secrets ou les positions précises.

**Interdictions :**
- jetons de session, OTP, mots de passe, clés privées, secrets de cérémonie ;
- coordonnées GPS précises ou historique de trajet ;
- corps complets de requêtes/réponses fournisseur ;
- numéro de téléphone ou e-mail complets ;
- contenu privé d'une alerte.

**Métadonnées minimales possibles :**
- identifiant de corrélation opaque ;
- type d'opération ;
- résultat normalisé ;
- compteur ou classe de limitation ;
- identifiant pseudonyme de compte/appareil lorsque strictement nécessaire ;
- horodatage serveur ;
- code de motif non sensible.

La durée de conservation, les accès et la purge de ces événements doivent être définis avant collecte réelle.

### S-09 — Aucun test adversarial de quotas et de faux positifs n'est démontré

**Niveau : BLOQUANT AVANT ACTIVATION**

Les tests existants vérifient des fonctions métier pures et des certificats, mais pas une défense serveur contre des requêtes distribuées ou concurrentes.

**Tests obligatoires sur environnement isolé :**
1. rafale de demandes OTP sur un compte ;
2. rafale distribuée sur plusieurs sources visant une même destination ;
3. renvoi OTP concurrent et consommation du même défi ;
4. invitations répétées à une même destination ;
5. invitation à des destinations multiples pour épuiser le budget ;
6. tentative de deviner si un compte ou un numéro existe ;
7. requêtes directes sans passer par l'interface ;
8. changement d'IP ou d'appareil pour contourner une limite ;
9. session révoquée qui tente de déclencher une alerte ;
10. session active valide sur réseau partagé ou changeant ;
11. plusieurs SOS rapprochés légitimes depuis une session valide ;
12. nouvelle urgence pendant une alerte déjà active ;
13. épuisement du budget fournisseur et canal en panne ;
14. faux positif de détection : vérifier que le SOS n'est ni bloqué ni retardé ;
15. absence de secrets, contacts complets et GPS dans les logs ;
16. deux requêtes concurrentes au seuil exact d'un quota ;
17. récupération de compte pendant une limitation OTP ;
18. révocation d'appareil concurrente avec un déclenchement.

Chaque test doit contrôler les effets en base et les messages visibles à l'utilisateur, pas seulement le code HTTP.

## 5. Politique recommandée par opération

| Opération | Contrôle prioritaire | Effet d'une limite |
|---|---|---|
| Déclencher un SOS depuis une session valide | Authentification, idempotence, contrôle de cohérence | Ne pas bloquer par quota générique ; signaler toute indisponibilité réelle |
| Répéter la même requête après coupure réseau | Idempotence persistante | Retourner le résultat existant, sans doublon |
| Créer une nouvelle alerte distincte | Authentification et règle métier | Ne pas la fusionner automatiquement |
| Demander/renvoyer un OTP | Quotas stricts, expiration, anti-rejeu | Temporisation explicite, sans invalider une session active |
| Inviter un contact | Quotas par compte/destination | Refus clair et réessayable après délai |
| Enrôler un appareil | Cérémonie cryptographique et anti-rejeu | Refuser sans approbation racine ; limiter les tentatives |
| Lire une alerte | Autorisation propriétaire/destinataire | Refuser si non autorisé, sans révéler l'existence |
| Envoyer un rappel | Outbox, déduplication, plafond fournisseur | Reprise contrôlée ; état de livraison honnête |

## 6. Arbitrages requis avant implémentation

1. Fixer les limites par opération après étude des usages attendus et des capacités fournisseur.
2. Décider si une seconde alerte distincte peut être créée alors qu'une première est active, et comment elle est présentée aux contacts.
3. Définir les messages et parcours lorsqu'un quota OTP/invitation est atteint.
4. Définir la durée de conservation des événements anti-abus non sensibles.
5. Choisir les canaux d'urgence de secours et leurs limites réelles, sans supposer qu'un SMS fonctionne hors réseau ou hors crédit.
6. Définir qui peut consulter les événements de sécurité et dans quelles circonstances.

Ces points ne sont pas validés par ce document. Aucun seuil numérique arbitraire n'est ajouté au produit.

## 7. Plan de remédiation

### Phase 1 — Spécification
- écrire une matrice de quotas par opération ;
- séparer chemin d'urgence et opérations non urgentes ;
- définir idempotence, anti-rejeu et protection fournisseur ;
- définir les erreurs et les messages français affichés ;
- définir journalisation minimale et conservation.

### Phase 2 — Implémentation ultérieure, après autorisation
- middleware d'authentification serveur ;
- compteurs distribués et atomiques ;
- protections OTP/invitations ;
- limites de coûts et alertes d'exploitation ;
- parcours de récupération des faux positifs.

### Phase 3 — Validation
- tests adversariaux et de concurrence ;
- tests de faux positifs sur réseaux mobiles instables et appareils multiples ;
- tests de charge sur environnement isolé ;
- revue indépendante sécurité et sûreté utilisateur ;
- validation explicite avant activation du SOS.

## 8. Décision finale

**NO-GO pour l'ouverture publique et pour toute affirmation que le SOS est opérationnel.**

Les contrats de session, d'appareils et de récupération sont une base utile, mais la limitation de débit, les protections OTP/invitations, la maîtrise des coûts fournisseur et la gestion des faux positifs ne sont pas démontrées dans le code examiné.

La règle la plus importante de cet audit est la suivante :

**SAC doit freiner les abus sans fermer la porte à une vraie urgence.** Les contrôles anti-abus doivent être mesurables, réversibles et testés ; aucune détection de risque ne doit bloquer silencieusement un SOS.

Aucune route, migration, règle de quota, verrouillage de compte, fournisseur, secret, ressource Cloudflare, donnée GPS ou activation SOS n'est créée par cet audit.
