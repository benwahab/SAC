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


## 9. Audit ciblé — fraude à la récupération du compte SAC

**Date : 18 novembre 2026**  
**Statut : analyse et recommandations à valider ; aucune protection supplémentaire n'est implémentée par cette section.**

### 9.1 Objectifs et frontières de sécurité

Un attaquant peut chercher à obtenir l'accès au compte sans posséder le téléphone racine. Les actifs à protéger sont distincts :
- accès au compte et sessions ;
- autorité cryptographique de l'appareil racine ;
- appareils secondaires et leurs certificats ;
- contacts de confiance et invitations ;
- alertes actives et données privées ;
- autorisations de partage GPS.

La réussite d'une récupération de mot de passe ou d'une vérification OTP ne doit jamais être interprétée comme preuve de possession de la racine. Elle ne peut ni rétablir les clés GPS, ni approuver un appareil, ni changer l'empreinte racine, ni reprendre un partage GPS.

### 9.2 Scénarios de menace et protections proposées

| Attaque | Risque | Protection proposée |
|---|---|---|
| Échange frauduleux de SIM / portage du numéro | L'attaquant reçoit les SMS destinés à la victime | Ne jamais considérer le contrôle du numéro ou un OTP SMS comme preuve suffisante pour une récupération racine. Prévoir un canal de récupération indépendant à définir. |
| Compromission de la boîte e-mail | L'attaquant utilise un lien de réinitialisation | Liens à usage unique, liés au compte et au but précis, durée limitée à définir, invalidation après usage, stockage serveur sous forme non réutilisable, notification de sécurité après changement. Le lien ne donne aucune autorité racine. |
| Vol d'un OTP | Connexion ou récupération frauduleuse | Expiration, usage unique, limitation des tentatives et des renvois, liaison au contexte de demande, invalidation des codes précédents selon une règle documentée, aucune valeur en clair dans les journaux. |
| Hameçonnage / faux support | La victime remet codes, liens ou approbations | SAC ne demande jamais de communiquer un OTP, un mot de passe, une clé privée ou un code de récupération à un agent. Aucune validation de racine par simple ticket support. Messages de sécurité courts et non ambigus. |
| Vol de session / jeton de renouvellement | L'attaquant agit sans connaître le mot de passe | Rotation des jetons de renouvellement, détection du rejeu, révocation ciblée de l'appareil, contrôle du statut appareil à chaque mutation sensible et invalidation serveur après révocation. |
| Changement de numéro après SIM swap | L'attaquant remplace le canal de récupération | Changement de numéro traité comme opération sensible distincte, notification aux anciens canaux encore sûrs et délai de protection proposé ; le nouveau numéro ne devient pas instantanément une preuve de propriété. |
| Épuisement OTP / déni de service | La victime ne peut plus récupérer son compte | Quotas par compte, destination, appareil et signaux réseau, réponse uniforme ; temporisation progressive et voie de recours. Ne pas verrouiller globalement le compte ni bloquer le SOS pour une seule limite IP. |
| Énumération de comptes | L'attaquant découvre les numéros ou e-mails inscrits | Réponses externes uniformes pour compte existant/inexistant, temps et parcours aussi proches que possible, aucun détail personnel dans les erreurs. |
| Usurpation du support | Un opérateur est poussé à contourner les contrôles | Séparation des rôles, procédure documentée, double contrôle pour toute action administrative sensible, journal append-only, aucun accès support aux clés privées et aucun bouton « forcer la racine ». |
| Réinitialisation pendant une alerte active | Un attaquant prend le compte pendant une urgence | Les changements d'authentification ne clôturent, ne modifient ni ne suppriment une alerte ; chaque action sur l'alerte continue de vérifier l'autorisation serveur. Les contacts ne reçoivent pas une fausse annonce de prise en charge. |
| Restauration d'une ancienne session ou sauvegarde | Réactivation d'un jeton ou certificat révoqué | Vérification en ligne du statut de session/appareil et de l'époque ; aucune restauration locale ne peut annuler la révocation serveur. |

### 9.3 Protection contre le SIM swap et limites de détection

Un changement soudain de SIM, un portage ou une réattribution de numéro n'est pas toujours observable par une application. SAC ne doit pas prétendre détecter un SIM swap sans signal fiable fourni par un opérateur ou un service spécialisé effectivement intégré et évalué.

En l'absence d'un tel signal :
- un OTP SMS prouve uniquement que le demandeur reçoit le SMS à cet instant ;
- il ne prouve pas l'identité civile du demandeur, la possession de l'ancien appareil ni la continuité cryptographique ;
- il ne suffit pas pour rétablir la racine, approuver un nouvel appareil ou réactiver le GPS ;
- la modification du numéro de récupération doit rester une opération sensible, distincte de la récupération racine.

Aucun fournisseur de détection SIM swap n'est choisi ni supposé disponible.

### 9.4 Politique de sessions proposée

- Chaque session est liée à un appareil identifié et à une famille de jetons de renouvellement.
- Les jetons de renouvellement sont rotatifs ; un jeton déjà consommé présenté de nouveau déclenche une détection de rejeu et la révocation de la famille concernée selon une politique à définir.
- Une révocation d'appareil est vérifiée côté serveur sur chaque action protégée ; l'expiration cryptographique locale seule n'est pas le contrôle principal.
- Une récupération de mot de passe ne réactive aucun appareil révoqué.
- Les sessions des autres appareils ne sont pas automatiquement supprimées par une simple révocation d'un appareil. L'effet exact d'une récupération d'accès sur les sessions existantes reste à décider.
- Toute notification de sécurité est émise après commit ; une notification non livrée n'annule pas la transition.

### 9.5 Protections OTP et liens de récupération

Exigences proposées :
- codes et jetons aléatoires à usage unique, liés à un compte, une finalité et une demande précise ;
- stockage sous forme de vérificateur non réutilisable, avec secret serveur adapté pour protéger les OTP de faible entropie ;
- expiration courte, à définir selon le canal et les contraintes réelles ;
- limites atomiques de tentatives et de renvois, sans seuil arbitraire dans cet audit ;
- invalidation des codes précédents selon une règle cohérente, sans permettre à plusieurs codes actifs de multiplier les chances d'essai ;
- réponses d'erreur qui ne révèlent ni l'existence du compte ni le code attendu ;
- aucune valeur OTP, aucun lien complet, aucun jeton, aucune clé ni donnée GPS dans les logs, analytics ou tickets support ;
- défi consommé atomiquement : deux requêtes simultanées ne peuvent pas utiliser le même code ;
- protection contre les renvois massifs et maîtrise des coûts fournisseur.

Le canal SMS ne doit pas être l'unique facteur de récupération de l'autorité racine.

### 9.6 Support et récupération exceptionnelle

Le support ne peut pas :
- demander ou recevoir un mot de passe, un OTP, une clé privée, un QR complet ou un code secret ;
- changer directement la clé publique racine ;
- réactiver un certificat révoqué ;
- marquer un contact comme ayant vérifié une empreinte ;
- rétablir le GPS ;
- contourner l'expiration, l'idempotence ou les contrôles de concurrence.

Toute intervention de support qui affecte le compte doit être limitée, authentifiée, justifiée, auditée et soumise à une séparation des rôles. L'existence d'une procédure de récupération exceptionnelle et les personnes autorisées restent à décider ; aucune procédure de contournement n'est créée ici.

### 9.7 Anti-abus sans bloquer les urgences

Les contrôles de récupération peuvent appliquer des limites strictes, mais ne doivent pas être réutilisés comme un verrouillage générique du parcours SOS. Une limite OTP, une IP partagée, un changement de réseau mobile ou un signal de risque ne doit pas bloquer silencieusement une alerte déclenchée depuis une session déjà authentifiée et valide.

Si une session est réellement révoquée ou invalide, le serveur doit refuser honnêtement l'action protégée ; il ne doit pas inventer une alerte envoyée. Les erreurs et la disponibilité du SOS restent distinctes des mécanismes de récupération.

### 9.8 Tests adversariaux complémentaires

- SIM swap simulé : OTP reçu, tentative de récupération racine refusée ;
- boîte e-mail compromise : lien utilisé deux fois, après expiration ou pour une autre finalité ;
- OTP deviné, renvoyé en rafale, rejoué ou utilisé en concurrence ;
- énumération de comptes par numéro, e-mail, temps de réponse et messages ;
- jeton de renouvellement ancien rejoué après rotation ;
- session volée utilisée après révocation de l'appareil ;
- changement de numéro immédiatement après récupération ;
- support sollicité pour remplacer une racine ou révéler un code ;
- tentative de changement de mot de passe pendant alerte active ;
- limites anti-abus déclenchées sur une IP partagée avec plusieurs utilisateurs légitimes ;
- vérification que les contrôles OTP ne bloquent pas un SOS valide ;
- vérification de l'absence de secrets dans journaux, analytics, notifications et tickets.

### 9.9 Décision de sécurité

**NO-GO pour une récupération de compte en production tant que les facteurs, les limites, les sessions, les notifications et les procédures de recours ne sont pas spécifiés et testés.**  
**NO-GO permanent pour toute récupération racine fondée uniquement sur SMS, e-mail, mot de passe ou support.**

Cette section est documentaire. Elle ne crée aucun fournisseur, endpoint, quota chiffré, verrouillage, ressource Cloudflare, SMS réel ni mécanisme GPS.
## Annexe — Audit anti-abus du changement de coordonnées (18 novembre 2026)

**Statut :** analyse de menaces et contrôles proposés ; pas de code ni de fournisseur activé.

### Menaces couvertes

| Menace | Risque | Contrôle de conception |
|---|---|---|
| SIM swap | Un attaquant reçoit les SMS du numéro historique | OTP SMS jamais considéré comme preuve racine ; exiger une preuve indépendante déjà approuvée |
| Numéro recyclé/réattribué | Un nouveau titulaire reçoit des codes destinés à l'ancien titulaire | Identité du compte immuable ; aucune récupération sur la seule possession du numéro ; notification neutre et absence de transfert d'historique |
| Boîte e-mail compromise | L'attaquant intercepte les liens de changement/récupération | L'e-mail est un canal, pas une racine ; lien à usage unique, lié à la demande et à sa finalité |
| Perte des deux canaux | Un tiers contrôle les nouveaux canaux mais pas le compte historique | Deux nouveaux OTP ne s'additionnent pas en preuve d'identité ; suivre la récupération forte sans contournement |
| Session volée | Un attaquant modifie les coordonnées depuis une session ouverte | Réauthentification/élévation de preuve à arbitrer ; vérification finale de l'état appareil et session ; notification minimale sur un canal encore sûr |
| Appareil secondaire compromis | L'attaquant utilise une session valide mais non autorisée à changer certains paramètres | Autorisation serveur par rôle d'appareil ; aucune élévation racine ; politique de capacité à définir |
| Hameçonnage du support | Un faux support demande un code ou change les coordonnées | Support ne demande jamais OTP, mot de passe, clé privée, QR complet ou code de récupération ; support sans pouvoir de remplacement racine |
| Énumération | Un attaquant teste si un numéro/e-mail est associé à un compte | Réponses publiques uniformes, absence de confirmation d'existence et limitation anti-abus |
| Déni de service | Multiples demandes bloquent le propriétaire ou le SOS | Limites ciblées par opération, destination et contexte ; pas de verrouillage global fondé sur IP seule ; ne pas bloquer le SOS essentiel |
| Rejeu/concurrence | Un ancien code ou deux demandes remplacent successivement le canal | Challenge à usage unique, version de coordonnées, sérialisation atomique, idempotence et contrôle d'état final |

### Notifications et contestation

- Une notification à l'ancien canal n'est envoyée que si ce canal est encore considéré sûr. La notification est neutre et ne contient ni nouvelle coordonnée, ni lien de connexion automatique, ni détail d'alerte.
- Un ancien canal suspecté compromis ne doit pas recevoir de secret ni disposer d'un veto qui permettrait à un attaquant de bloquer indéfiniment le propriétaire.
- La contestation depuis un appareil déjà approuvé peut suspendre une demande avant son commit, sous réserve d'une règle atomique et d'une procédure de résolution. Les critères et délais restent à arbitrer.
- Après validation, un signal de compromission ouvre une procédure de sécurité distincte (révocation ciblée, récupération, examen des sessions) ; il ne restaure pas l'ancien canal par simple message.
- SAC ne doit pas affirmer détecter un SIM swap si aucun signal opérateur ou fournisseur fiable n'est disponible.

### Limites OTP et stockage

- Codes à durée limitée, consommation unique, tentatives et renvois limités de manière atomique ; paramètres numériques à valider avant implémentation.
- Challenge lié au compte, à la destination normalisée, au but, à la demande et à l'époque/version concernée.
- Un vérificateur OTP de faible entropie ne doit pas être stocké sous forme de hash rapide seul ; secret serveur/HMAC ou protection équivalente à définir lors de la conception.
- Aucun OTP, lien de vérification, jeton, adresse complète, numéro complet ou réponse brute fournisseur dans les logs, analytics, tickets ou notifications.
- Réponses publiques uniformes pour limiter l'énumération ; ne pas confirmer si la nouvelle destination appartient déjà à un autre compte.
- La vérification du nouveau canal ne doit pas déclencher automatiquement des invitations, notifications aux contacts ou transferts de relations.

### Continuité du service et alertes actives

- Une demande de changement de coordonnées ne doit jamais retarder ou bloquer un SOS essentiel déjà autorisé.
- Les alertes actives gardent leur instantané de destinataires et leur cycle d'alerte ; les notifications en cours ne sont pas reroutées vers une nouvelle coordonnée de l'auteur.
- Une demande de changement ne modifie pas la liste initiale des contacts destinataires.
- Une indisponibilité du fournisseur de vérification ne doit jamais être présentée comme une réussite ; elle ne doit pas entraîner de verrouillage global arbitraire.
- La politique de sessions après changement (conservation de l'appareil courant, révocation ciblée, révocation des sessions récentes ou autre) demeure ouverte et doit être testée contre le vol de session.

### Tests adversariaux requis avant toute mise en œuvre

- SIM swap simulé, numéro réattribué, ancien canal compromis et canal perdu.
- Perte simultanée téléphone/SIM/e-mail ; nouveaux OTP reçus par un tiers.
- Session volée, appareil secondaire, appareil révoqué pendant la demande.
- Challenge expiré, consommé, rejoué ou destiné à une autre demande.
- Deux demandes concurrentes pour le même champ ou pour numéro et e-mail.
- Contestation simultanée au commit, changement de version, demande répétée après coupure réseau.
- Récupération racine en cours, alerte active, appareil hors ligne.
- Vérification qu'aucun secret, canal complet ou donnée GPS n'apparaît dans logs et réponses.

**NO-GO :** aucun flux de changement de coordonnées ne peut être déclaré sûr tant que le facteur indépendant, la politique de session, la contestation et les tests de concurrence ne sont pas approuvés.


## Annexe — Contrôles anti-abus de la politique OTP e-mail (18 novembre 2026)

**Décision produit :** l'e-mail est le canal standard des OTP SAC. Le SMS n'est pas utilisé comme canal OTP de secours automatique ; il reste réservé à l'escalade SOS.

### Menaces et contrôles à conserver

- Compromission de boîte e-mail : un OTP ou lien e-mail ne vaut pas preuve d'identité historique ni preuve de possession de la racine ; les changements sensibles exigent une preuve de continuité indépendante.
- Perte de l'ancienne boîte : ne jamais envoyer automatiquement un OTP à une nouvelle adresse pour prendre le contrôle du compte ; appliquer la récupération forte validée.
- Énumération : réponses publiques uniformes, qu'une adresse soit connue ou non ; ne pas exposer l'existence d'un compte, l'état de livraison ou les détails du fournisseur.
- Épuisement : limites distinctes par compte, destination, finalité, appareil et signaux réseau ; ne pas verrouiller globalement un réseau mobile partagé.
- Rejeu/concurrence : challenge lié au compte, à la finalité, à la destination et à la demande ; usage unique, expiration et consommation atomique.
- OTP faible entropie : vérificateur protégé par secret serveur/HMAC ou mécanisme équivalent, jamais hash rapide seul ni stockage en clair.
- Fournisseur ambigu : ne pas renvoyer aveuglément un code ni considérer l'envoi comme réussi ; réconcilier l'état selon les preuves disponibles.

### Disponibilité et séparation du SOS

- Aucun basculement silencieux vers SMS si le service e-mail est indisponible.
- L'absence de réception d'un OTP ne doit pas bloquer une alerte SOS valide déjà autorisée par une session active.
- Le déclenchement SOS ne doit pas attendre un code e-mail ; les vérifications OTP de compte ne sont pas un prérequis ajouté au moment critique.
- Les SMS d'escalade SOS restent indépendants des OTP et suivent leur propre outbox, leur propre suivi de livraison et les règles de prise en charge.
- Aucun SMS OTP réel, fournisseur e-mail, endpoint, quota chiffré ou ressource Cloudflare n'est créé par cette annexe.

**À tester avant mise en production :** boîte compromise, ancienne adresse inaccessible, nouvel e-mail contrôlé par un tiers, renvois concurrents, résultat fournisseur ambigu, énumération, épuisement ciblé, panne e-mail pendant une urgence et preuve qu'aucun SMS OTP de secours n'est déclenché automatiquement.
