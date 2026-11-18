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


## Annexe — Menaces liées à la perte ou à la compromission de l'e-mail (18 novembre 2026)

**Statut :** exigences de conception et scénarios de test ; aucun facteur de récupération ni fournisseur n'est choisi.

| Scénario | Risque | Contrôle exigé |
|---|---|---|
| Ancienne boîte inaccessible, appareil racine encore sûr | Blocage légitime ou changement détourné | Preuve cryptographique fraîche depuis l'appareil approuvé, puis OTP à la nouvelle adresse ; contrôle atomique de révocation et de version |
| Ancienne boîte compromise | Attaquant intercepte les codes/liens | Ne pas traiter l'ancienne boîte comme autorité ; parcours depuis appareil sûr ou récupération indépendante |
| Aucun appareil approuvé, nouvel e-mail contrôlé | Prise de contrôle du compte par simple OTP | Refuser la récupération complète tant qu'un facteur indépendant validé n'est pas fourni |
| Téléphone et e-mail perdus | Faux sentiment de preuve par cumul de nouveaux canaux | Aucun cumul de nouveaux OTP ne prouve la continuité ; procédure indépendante séparée |
| Demande concurrente avec révocation d'appareil | Une demande continue après révocation | Revalidation atomique au commit ; révocation gagnante fait échouer la demande |
| Faux support | Ingénierie sociale pour contourner les facteurs | Support sans pouvoir de remplacer la racine ou d'accepter un OTP comme preuve suffisante |
| Demande en attente | Accès privé accordé avant vérification | État d'attente sans privilèges implicites ; réponse uniforme et journalisation minimale |

### Disponibilité et protection de l'urgence

- La perte de l'e-mail ne doit pas transformer l'OTP en prérequis au SOS depuis une session toujours valide.
- Une récupération d'accès en attente ne doit pas afficher « compte récupéré » ni prétendre que des contacts ou appareils ont été vérifiés.
- Ne pas révéler l'existence d'un compte, les coordonnées complètes ou l'état précis d'une demande à un demandeur non authentifié.
- Ne pas envoyer automatiquement un SMS OTP de remplacement lorsque l'e-mail échoue.

### Tests obligatoires à préparer

- appareil racine valide + ancienne boîte inaccessible + nouvel e-mail vérifié ;
- appareil secondaire valide mais racine perdue ;
- aucun appareil approuvé + nouvel e-mail et nouveau numéro contrôlés ;
- ancienne boîte compromise qui tente d'annuler ou détourner la demande ;
- révocation concurrente avant et pendant la validation ;
- demande répétée, expirée, annulée, rejouée et concurrente ;
- récupération d'accès sans restauration de racine, de clé GPS ou d'autorisation d'appareil ;
- SOS valide pendant indisponibilité e-mail ;
- absence d'accès aux données privées pendant l'attente.

**NO-GO :** ne pas déclarer le parcours sûr avant sélection et validation des facteurs indépendants, des délais, des droits temporaires, des règles de session et des tests adversariaux.


## Annexe — Risques de récupération sociale par les contacts (18 novembre 2026)

**Recommandation :** ne pas autoriser les contacts de confiance à récupérer le compte par vote, quorum ou simple reconnaissance humaine.

| Menace | Conséquence possible | Contrôle proposé |
|---|---|---|
| Collusion de plusieurs contacts | Prise de contrôle coordonnée du compte | Aucun quorum de contacts ne donne accès au compte ni ne change les coordonnées |
| Contact sous coercition | Validation forcée d'une récupération | Aucune réponse d'un contact n'est suffisante pour authentifier le titulaire |
| Compte d'un contact compromis | Faux signal de reconnaissance | Authentification propre du contact et vérification d'empreinte par canal indépendant ; pas d'accès au compte titulaire |
| Faux contact ajouté pendant la récupération | Renforcement frauduleux de la demande | N'accepter que les relations actives antérieures à l'ouverture de la récupération |
| Contact silencieux ou injoignable | Blocage de la vérification | Ne jamais transformer le silence en accord ; maintenir la relation GPS bloquée |
| Réponses divulguées entre contacts | Pression, manipulation ou coordination | Isoler les réponses et ne pas exposer les coordonnées ou les facteurs du titulaire |

La reconnaissance humaine peut éventuellement être étudiée comme signal complémentaire non décisif. Elle ne doit jamais remplacer un facteur indépendant de récupération d'accès, ni autoriser une session, un changement d'e-mail, une approbation d'appareil ou une restauration racine.

**Tests adversariaux à prévoir :** contacts complices, contact sous contrainte, compte contact compromis, relation ajoutée pendant la récupération, réponses contradictoires, silence, usurpation vocale et tentative d'obtenir les nouvelles coordonnées du titulaire.

**NO-GO :** aucun mécanisme de récupération sociale du compte ou de quorum racine n'est autorisé par cette annexe.


## Annexe — Menaces du kit de récupération hors ligne (18 novembre 2026)

**Statut :** analyse préliminaire d'une option non validée ; aucun facteur de récupération n'est activé.

| Scénario | Risque | Contrôle à concevoir |
|---|---|---|
| Kit photographié ou copié | Un tiers obtient le facteur complet | Affichage unique, conseil de stockage privé, révocation/régénération authentifiée |
| Papier perdu ou détruit | Titulaire incapable de prouver le facteur | Expliquer la perte irréversible ; ne pas créer de contournement par OTP ou contacts |
| Téléphone compromis lors de la création | Secret exfiltré avant impression | Génération locale, appareil sûr, avertissement de ne pas créer le kit sur un appareil suspect |
| Secret deviné ou testé en masse | Prise de contrôle ou déni de service | Forte entropie, limitation distribuée, détection d'abus, réponses uniformes |
| Rejeu après usage | Récupérations répétées | Consommation atomique à usage unique et versionnement du compte |
| Deux demandes simultanées | Double récupération ou état incohérent | Une transition gagnante par transaction ; invalider le facteur à la première consommation réussie |
| Base de données divulguée | Attaque hors ligne sur les vérificateurs | Aucun secret brut ; vérificateur et paramètres validés, secret serveur séparé, revue cryptographique |
| Contact ou support manipulé | Contournement du facteur | Aucun pouvoir de récupération délégué ; notification seulement informative |
| Kit utilisé pour récupérer la racine | Restauration d'une confiance cryptographique perdue | Séparation stricte compte/racine ; nouvelle identité et vérification indépendante par relation |
| Kit conservé dans la même boîte e-mail perdue | Facteur indisponible avec le canal principal | Stockage hors ligne et copie indépendante facultative, jamais e-mail comme seule sauvegarde |

**Tests adversariaux requis :** copie/photo du kit, saisies erronées, tentatives distribuées, rejeu, concurrence, perte du kit, régénération, révocation d'appareil pendant récupération, récupération sans accès e-mail, absence de restauration racine/GPS, et fuite du vérificateur serveur.

**NO-GO :** ne pas implémenter avant choix explicite du format et de la politique, analyse cryptographique, tests sur appareils mobiles réels et revue indépendante.


### Décision utilisateur — une clé unique hors ligne (18 novembre 2026)

Le format retenu pour la suite de la conception est une seule clé personnelle de récupération, générée localement, affichée une fois et à usage unique. Les risques de copie, photographie, vol, perte, rejeu et saisie automatisée restent à tester. La clé doit être invalidée atomiquement après récupération réussie ; aucune série de codes n'est retenue.

Le choix de ce format ne valide pas encore l'entropie exacte, l'encodage, le stockage du vérificateur, les limites de tentatives ou les délais. La clé ne doit jamais permettre une restauration racine, une approbation d'appareil ou un accès GPS.


### Complément — audit du format Base32 et du vérificateur (18 novembre 2026)

**Orientation candidate :** 32 octets aléatoires (256 bits) générés localement, encodés en Base32 Crockford sur 52 caractères canoniques, avec regroupement visuel uniquement. Aucun checksum maison. Le format reste à tester et à faire auditer avant adoption définitive.

| Risque | Contrôle/test requis |
|---|---|
| Entropie insuffisante ou générateur défaillant | Vérifier l'usage du CSPRNG natif et l'absence de graine prévisible ; tests et revue du code de génération |
| Troncature ou altération du dernier symbole | Décodage strict, bits de remplissage canoniques, rejet des représentations non canoniques |
| Confusion de caractères sur clavier mobile | Essais sur Android AZERTY/QWERTY, copie-coller, saisie manuelle, impression et lecture à voix haute |
| Correction automatique/clavier qui transforme la clé | Champ dédié sans autocorrection ni capitalisation imprévue ; validation exacte après normalisation autorisée |
| Faux sentiment de sécurité dû au checksum | Expliquer qu'un checksum ne prouve ni identité ni validité du facteur ; ne retenir qu'un mécanisme standard audité |
| Fuite du vérificateur | Examiner SHA-256 domain-separé lié au compte versus HMAC avec secret serveur séparé ; vérifier les risques de rotation et de restauration du secret |
| Fuite par télémétrie ou capture | Tests d'absence dans logs, analytics, rapports de crash, presse-papiers distant et traces réseau |
| Brute force distribué | Limites atomiques multidimensionnelles, détection d'abus et réponses uniformes ; paramètres chiffrés à arbitrer |
| Deux récupérations concurrentes | Une seule consommation atomique gagnante ; toutes les autres demandes échouent sans réutiliser le kit |
| Régénération pendant une demande | Invalidation atomique de l'ancienne version et rejet des demandes liées à celle-ci |

Le fait que 256 bits aléatoires rendent une attaque exhaustive impraticable ne dispense pas des limites anti-abus : elles protègent aussi le service contre le déni de service et les essais distribués. Aucun nombre de tentatives, délai de blocage ou délai de sécurité n'est fixé dans cette annexe.

**NO-GO maintenu :** aucune implémentation ni activation du kit avant revue cryptographique indépendante, tests de saisie sur appareils réels, validation de la politique de session/récupération et preuve que le secret n'est jamais journalisé ou transmis en clair.


## Annexe — Audit anti-abus : téléphone perdu, e-mail historique inaccessible, clé hors ligne disponible (18 novembre 2026)

**Statut :** analyse de menace du parcours candidat ; aucune récupération réelle activée.

| Menace | Risque | Contrôle exigé ou point à arbitrer |
|---|---|---|
| Clé photographiée, copiée ou volée | Un tiers possède le facteur hors ligne | Usage unique, affichage unique, vérification protégée, consommation atomique ; déterminer si une preuve indépendante supplémentaire est nécessaire |
| Clé et nouvel e-mail compromis ensemble | Prise de contrôle du compte historique | Ne pas assimiler l'OTP de la nouvelle boîte à une identité ; délai et facteurs complémentaires à arbitrer |
| Faux nouvel e-mail | L'attaquant redirige les communications du compte | Vérification OTP liée à la demande et à la destination ; aucune notification sensible ni transfert automatique |
| Ancien téléphone encore en ligne | L'attaquant continue d'utiliser une session volée | Définir révocation ciblée ou globale au commit ; vérifier atomiquement les sessions et appareils |
| Autres appareils légitimes | Une révocation globale déconnecte des proches appareils du titulaire | Arbitrer la portée ; ne pas supposer conservation ou révocation générale sans décision explicite |
| Demandes concurrentes | Deux récupérations ou deux sessions gagnantes | Une seule consommation atomique de la version de clé ; invalidation des demandes concurrentes |
| Réponse réseau perdue après commit | Le titulaire répète l'opération ou croit à un échec | Idempotence et consultation de l'état par identifiant opaque ; jamais renvoyer ou redemander la clé en clair |
| Demande en attente | Accès privé accordé trop tôt | Aucun privilège complet avant la fin de la procédure ; états d'attente distincts d'un succès |
| Support ou contact manipulé | Contournement de la preuve | Aucun pouvoir de validation manuelle, quorum ou veto ; support sans accès à la clé |
| Récupération utilisée pour rétablir GPS | Reprise d'un partage avec une identité non vérifiée | Racine et appareil séparés ; GPS bloqué jusqu'à nouvelle cérémonie et vérification indépendante par relation |
| Épuisement / déni de service | Le titulaire légitime ne peut plus essayer | Limites atomiques par compte, version de clé, appareil et signaux réseau ; ne pas verrouiller globalement le SOS |
| Énumération de comptes | Un attaquant découvre les comptes SAC | Réponses uniformes, identifiants opaques, absence de confirmation d'existence ou de validité partielle |

### Règles de notification et de contestation
- Une notification à l'ancienne adresse inaccessible n'est pas considérée comme délivrée ni comme un moyen de contestation fiable.
- Si un ancien canal est suspecté compromis, aucune donnée sensible ni secret ne doit y être envoyé.
- Une notification informative aux anciens canaux ou contacts ne doit pas divulguer la nouvelle adresse, la clé, les facteurs validés ou les détails privés.
- Aucun contact ne peut approuver, bloquer ou récupérer le compte par vote ou simple reconnaissance humaine.
- Le délai de sécurité et le mécanisme de contestation restent à définir ; un veto indéfini d'une ancienne boîte potentiellement compromise est à proscrire.

### Politique de session à décider
Évaluer explicitement au moins ces options avant implémentation :
1. révoquer toutes les sessions/jetons existants au succès ;
2. révoquer uniquement l'appareil déclaré perdu et les sessions présentant des signaux de risque ;
3. révoquer toutes les sessions sauf une session de récupération à privilèges strictement limités.

Pour chaque option, tester le cas où un appareil secondaire légitime est encore détenu par le titulaire, celui où l'ancien téléphone est utilisé par un attaquant, et celui où la demande est interrompue. Aucune option n'est actée dans cette annexe.

### Tests adversariaux obligatoires
- clé correcte + nouvel OTP correct, avant, pendant et après la période de sécurité ;
- clé copiée/volée + nouvelle boîte contrôlée par un attaquant ;
- clé erronée, expirée, consommée, régénérée ou liée à une autre version ;
- deux demandes simultanées et deux validations concurrentes ;
- révocation du téléphone perdu juste avant et pendant le commit ;
- appareil secondaire légitime encore actif ;
- réponse réseau perdue avant ou après le commit ;
- contestation simultanée, ancienne boîte compromise et notification non délivrée ;
- tentative d'utiliser la session récupérée pour approuver un appareil ou consulter/partager le GPS ;
- preuve que la clé, ses fragments, les OTP et les coordonnées ne sont jamais présents dans logs, analytics, crash reports ou tickets ;
- SOS valide depuis une session encore autorisée pendant une récupération ou une panne e-mail.

**NO-GO :** pas de mise en production avant décision sur le seuil de preuve, le délai, la contestation, les droits temporaires, la politique de session et la validation des tests de concurrence et d'abus.



## Annexe — Évaluation des choix candidats pour la récupération sans ancien téléphone ni e-mail (18 novembre 2026)

**Statut : recommandations à arbitrer ; aucune politique n'est activée.**

### 1. Risque résiduel du couple clé + nouvel e-mail
La clé hors ligne est un facteur de possession indépendant seulement si elle a été générée correctement et conservée séparément. Le nouvel OTP confirme le contrôle de la nouvelle boîte, pas l'identité du titulaire. Si un attaquant vole ou photographie la clé et contrôle une adresse qu'il vient de créer, le couple de preuves peut être détourné. Le délai réduit la fenêtre de prise de contrôle mais ne corrige pas une clé compromise.

Contrôles candidats :
- clé aléatoire à forte entropie, usage unique, vérificateur protégé et consommation atomique ;
- OTP à durée limitée, lié à la demande et à la nouvelle adresse ;
- réponses uniformes, limites d'essais multidimensionnelles et absence de fuite dans les journaux ;
- refus du parcours standard lorsque la clé est signalée compromise ;
- procédure indépendante distincte à concevoir pour les cas de clé compromise ou perdue.

### 2. Délai de sécurité candidat : 24 heures
Un délai de 24 heures après validation des deux preuves permet aux sessions encore actives de signaler un comportement suspect. Il ne garantit pas que le titulaire verra une notification, notamment si le téléphone perdu était son seul appareil. Le délai n'est donc ni une preuve d'identité, ni une protection suffisante en cas de clé volée.

À tester : demandes répétées, délai contourné par concurrence, contestation tardive, notification non délivrée, ancien e-mail compromis et absence de tout autre appareil connecté.

### 3. Contestation sans récupération sociale
- Une session active et authentifiée peut signaler une activité suspecte et suspendre provisoirement le traitement selon une politique définie.
- Un ancien e-mail ne doit pas disposer d'un bouton de veto ou d'un pouvoir de récupération ; notification neutre uniquement si canal non suspecté compromis.
- Aucun quorum, vote ou reconnaissance humaine de contacts.
- La suspension doit avoir une durée maximale et une résolution documentée pour éviter le déni de service par un appareil secondaire compromis.

### 4. Révocation et appareils secondaires
Option candidate : invalider toutes les sessions et tous les jetons existants au commit, sauf la nouvelle session limitée. Révoquer l'appareil déclaré perdu et ses abonnements push. Conserver séparément les enregistrements cryptographiques des appareils secondaires approuvés ; leur propriétaire devra se réauthentifier et prouver la possession de leur clé locale avant de retrouver une session.

Cette séparation évite deux erreurs opposées : laisser vivre une session volée, ou détruire sans nécessité l'identité cryptographique d'un appareil secondaire encore légitime. Elle ne restaure jamais la racine perdue.

### 5. Session limitée et SOS
La session de récupération ne doit pas ouvrir les données privées, l'historique d'alertes, les coordonnées des contacts ou le GPS. La possibilité de déclencher un SOS sans GPS depuis cette session est un arbitrage séparé : elle peut préserver l'accès à l'urgence, mais nécessite un contrôle anti-usurpation et un périmètre très précis. Aucun OTP e-mail ne doit être demandé au moment d'un SOS valide.

### Tests adversariaux supplémentaires
- clé copiée + nouvelle adresse contrôlée par l'attaquant ;
- notification neutre reçue sur une session encore active ;
- contestation d'une session secondaire compromise visant à bloquer le titulaire ;
- suspension qui expire correctement et ne peut pas être prolongée abusivement ;
- toutes sessions invalidées sauf session limitée, même en cas de commit rejoué ;
- appareils secondaires conservés cryptographiquement mais incapables de réutiliser une ancienne session ;
- tentative d'accès aux alertes privées, coordonnées, GPS ou fonctions racine depuis la session limitée ;
- tentative de déclencher SOS depuis session limitée, selon la politique finalement retenue ;
- clé compromise signalée avant, pendant et après le délai de sécurité.

**NO-GO :** aucune activation avant validation explicite de la politique et tests indépendants du délai, de la contestation, de la révocation et de la session limitée.



### Audit de moindre privilège — session de récupération

**Statut : matrice candidate à valider.**

Tester explicitement que la session limitée :
- ne peut pas énumérer les alertes, contacts, groupes ou coordonnées privées ;
- ne peut pas lire l'historique GPS, les positions précises, les clés ou les métadonnées sensibles ;
- ne peut pas approuver un appareil, changer la racine, récupérer une clé privée ou créer une session de privilège supérieur ;
- ne peut pas modifier silencieusement les coordonnées de compte une seconde fois ;
- ne peut pas générer une nouvelle clé de récupération avant l'étape de confiance requise ;
- ne peut pas accéder aux fonctions de paiement ou d'administration ;
- expire et peut être révoquée sans affecter l'intégrité des alertes actives.

Le droit SOS est un cas distinct : tester l'usurpation, les alertes abusives et la possibilité de transmettre une alerte sans GPS depuis une session limitée, sans jamais bloquer le SOS d'une session déjà autorisée par un OTP e-mail.



### Analyse de menace — SOS depuis session de récupération limitée

**Statut : proposition à valider.**

| Risque | Mesure candidate |
|---|---|
| Clé de récupération volée utilisée pour envoyer de faux SOS | Droit limité à une session de récupération achevée, délai de sécurité, session courte, destinataires préexistants, journal d'audit sans secrets |
| Attaquant découvre les contacts du titulaire | Ne jamais exposer la liste ou les coordonnées au terminal limité ; résolution des destinataires côté serveur |
| Attaquant ajoute ses propres destinataires | Interdire ajout/retrait et figer la configuration SOS antérieure |
| Contacts croient que le nouvel appareil est déjà approuvé | Indicateur explicite dans la notification : appareil non approuvé, récupération limitée |
| Fausse localisation ou localisation résiduelle | Aucun GPS, aucune adresse, aucune donnée de localisation jointe |
| Envoi répété par rejeu ou double clic | Idempotence, sérialisation et identifiant de demande |
| Réseau indisponible | Aucun faux accusé de succès ; statut non confirmé et reprise idempotente |
| Abus par texte ou fichier | Aucun texte libre ni pièce jointe dans ce mode candidat |
| Aucun contact disponible | Bloquer l'envoi et expliquer qu'aucun destinataire éligible n'est configuré |
| SOS bloqué par OTP e-mail | Aucun OTP e-mail au moment du SOS ; la session doit être déjà valide |

### Tests obligatoires
- session de récupération en attente, expirée, révoquée ou terminée : aucun SOS ;
- session limitée valide : seules les capacités SOS explicitement autorisées fonctionnent ;
- appareil non approuvé : aucune opération racine ou GPS n'est possible ;
- contacts ajoutés après récupération : non inclus dans le SOS de secours ;
- contact révoqué ou relation inactive : exclu au moment de l'envoi ;
- liste vide : aucun succès affiché ;
- double déclenchement, rejeu et réponse réseau perdue : une seule alerte ;
- notification reçue : mention non ambiguë du statut non approuvé et de l'absence de localisation ;
- tentative d'ajout de destinataire, texte libre, pièce jointe ou GPS : refus côté serveur ;
- vérification que l'OTP e-mail n'est jamais sollicité au moment du SOS ;
- panne réseau : aucune promesse d'envoi hors ligne ni de SMS direct.

**NO-GO :** aucun SOS de secours depuis session limitée avant validation du périmètre et réussite des tests adversariaux et de disponibilité.



### Audit de confidentialité — états visibles du SOS de secours (18 novembre 2026)

**Décision utilisateur :** le titulaire en récupération limitée peut consulter l'état de son propre SOS de secours et savoir si un proche l'a pris en charge. Cette permission n'ouvre aucun accès aux réponses privées ou aux données des contacts.

| Information demandée | Autorisation |
|---|---|
| État de traitement de l'alerte côté SAC | Autorisé, si confirmé |
| État technique push/SMS | Autorisé avec libellé exact du niveau de preuve |
| Accusé humain de réception | Autorisé sous forme agrégée, sans identité du contact |
| Prise en charge principale | Autorisé si transition confirmée, sans identité du répondant |
| Clôture par l'auteur | Autorisé si confirmée |
| Texte libre, chat ou pièce jointe d'un contact | Interdit |
| Nom, numéro, e-mail, avatar ou profil d'un contact | Interdit |
| Position, adresse ou historique GPS | Interdit |
| Liste des destinataires ou activité détaillée de chaque contact | Interdit |
| Toute autre alerte ou historique privé du compte | Interdit |

**Risques et contrôles :**
- Énumération d'alertes : autorisation côté serveur sur l'auteur et l'identifiant de l'alerte ; identifiants opaques ; aucune confiance dans le filtrage client.
- Inférence de présence d'un contact : états agrégés uniquement, pas de chronologie détaillée par destinataire ni d'horodatage individuel superflu.
- Confusion de statut : libellés séparés pour acceptation fournisseur, livraison confirmée, accusé humain, prise en charge et clôture.
- Fuite de conversation : aucun contenu libre ni pièce jointe dans la projection de session limitée.
- Session expirée/révoquée : toute lecture ultérieure refusée côté serveur.

**Tests requis :** tenter de lire une autre alerte ; modifier l'identifiant de l'alerte ; demander les champs interdits ; déduire l'identité d'un contact depuis les états ; présenter une notification acceptée comme livrée ou lue ; lire après expiration/révocation ; vérifier que la prise en charge n'est affichée qu'après transition atomique confirmée.

Cette décision autorise uniquement la visibilité minimale décrite. Elle n'active pas le SOS de secours, ne définit aucun endpoint et ne lève pas le NO-GO d'implémentation.


## Audit anti-abus — perte de tous les moyens de récupération (18 novembre 2026)

**Statut :** analyse de menace ; facteur alternatif non sélectionné.

| Situation | Risque | Règle de sécurité proposée |
|---|---|---|
| Téléphone perdu, autre appareil approuvé disponible | Session volée ou appareil secondaire compromis | Preuve cryptographique fraîche et contrôle de révocation au commit |
| Téléphone et kit perdus, appareil approuvé secondaire disponible | Réémission abusive du kit | Authentifier depuis l'appareil approuvé ; invalider l'ancien kit ; générer un nouveau kit une seule fois |
| Aucun appareil approuvé, facteur indépendant préenregistré | Facteur faible, volé ou rejoué | Ne pas activer avant protocole, tests et revue indépendante |
| Aucun appareil approuvé ni facteur indépendant | Prise de compte par ingénierie sociale | Refuser la récupération historique ; aucun contournement support/contact/OTP |
| Attaquant contrôle une nouvelle boîte e-mail | Substitution du canal de connexion | OTP prouve uniquement le contrôle de cette boîte, jamais l'identité historique |
| Attaquant se fait passer pour le titulaire auprès du support | Réinitialisation manuelle abusive | Support sans pouvoir de substitution des preuves ni accès aux secrets |
| Nouveau compte créé après refus | Fusion abusive avec l'ancien compte | Identité distincte ; aucune fusion, transfert d'historique ou relation automatique |

### Tests adversariaux requis
- perte du kit alors qu'un appareil approuvé est encore accessible ;
- appareil approuvé révoqué juste avant la preuve ou pendant la transaction ;
- appareil secondaire légitime et appareil secondaire compromis ;
- kit perdu déclaré, ancien vérificateur présenté après invalidation ;
- facteur alternatif absent, expiré, révoqué, rejoué ou compromis ;
- OTP valide sur une adresse contrôlée par un attaquant sans autre preuve ;
- demande de récupération par support, contact ou administrateur ;
- tentatives d'énumération pour découvrir si le compte possède un kit ou un facteur ;
- tentative de rattacher un nouveau compte aux alertes, contacts, abonnement ou racine historiques ;
- preuve qu'aucune voie de récupération de compte ne restaure la racine ou les données GPS expirées.

**NO-GO :** aucune récupération sans appareil approuvé ni facteur indépendant préenregistré tant qu'une méthode n'a pas été explicitement choisie, documentée, testée et revue. Si aucune preuve suffisante n'existe, le refus est le comportement sûr attendu.


## Audit comparatif — facteurs alternatifs de récupération (18 novembre 2026)

**Conclusion de sécurité :** ne pas assimiler une méthode de connexion pratique à une preuve indépendante de récupération du compte historique.

| Menace | Exemple | Mesure / limite |
|---|---|---|
| Compromission du compte fournisseur | Passkey synchronisée récupérée après compromission de l'e-mail fournisseur | Ne pas lui accorder seule le droit de récupération historique |
| Perte simultanée des appareils | Téléphone principal et secondaire perdus | Passkey liée aux appareils indisponible ; le kit hors ligne reste nécessaire |
| Perte d'une clé matérielle | Clé FIDO2 unique perdue ou cassée | Procédure de remplacement à définir avant activation ; ne pas prévoir de contournement support |
| Vol d'un deuxième secret | Plusieurs codes stockés ensemble | Éviter la multiplication des secrets ; un seul kit personnel reste la décision actuelle |
| SIM swap / numéro recyclé | Attaquant contrôle le numéro | SMS ne prouve pas l'identité historique |
| Ingénierie sociale | Faux titulaire auprès d'un contact ou du support | Aucun contact/support ne peut récupérer le compte ou approuver une racine |
| Confusion de privilèges | Passkey de connexion utilisée pour approuver un appareil | Séparer authentification de session, récupération du compte et cérémonie cryptographique |

### Tests avant toute évolution
- indépendance réelle des facteurs et dépendances communes (e-mail, fournisseur, appareil) ;
- perte, vol, remplacement, révocation et restauration de chaque facteur ;
- résistance au phishing, rejeu, clonage et récupération abusive du compte fournisseur ;
- absence d'élévation de privilège vers racine, approbation appareil ou GPS ;
- parcours Android réel, accessibilité et récupération après changement de téléphone ;
- support et contacts incapables de contourner les preuves.

**NO-GO :** aucun facteur alternatif ou fournisseur tiers ne peut être activé sur la seule base de cette comparaison. La politique actuelle reste : kit unique ou appareil approuvé encore disponible ; sinon refus de récupération historique.


## Scénarios d'abus — perte ou vol d'un appareil avec appareil survivant (18 novembre 2026)

| Scénario | Risque | Contrôle attendu |
|---|---|---|
| Téléphone secondaire volé, racine disponible | L'attaquant utilise une session encore valide | Révocation explicite par la racine ; invalidation sessions, jetons et push |
| Téléphone racine volé, secondaire disponible | Le secondaire s'attribue abusivement l'autorité racine | Interdiction d'auto-promotion ; demande seulement, récupération racine séparée |
| Ancien téléphone revient en ligne | Réactivation ou renouvellement après révocation | Vérification serveur du statut révoqué à chaque renouvellement et opération sensible |
| Révocation et renouvellement concurrents | Course entre session active et révocation | Transaction atomique ; la révocation empêche tout renouvellement postérieur |
| Racine survivante compromise | L'attaquant révoque les autres appareils ou approuve le sien | Suspendre les opérations dépendantes et utiliser la récupération racine si compromission suspectée |
| Fausse déclaration de perte | Un titulaire révoque volontairement son propre appareil | Confirmation explicite, cible clairement identifiée, audit non sensible |
| Perte pendant un SOS actif | Alertes et tâches de notification interrompues à tort | Conserver alerte, instantané destinataires et tâches SOS ; ne pas confondre révocation appareil et clôture |
| GPS après remplacement racine | Nouvelle clé interprétée comme continuité de l'ancienne | Bloquer partage GPS jusqu'à vérification indépendante de la nouvelle empreinte par relation |
| Effacement à distance supposé | Utilisateur croit ses données supprimées d'un téléphone hors ligne | Expliquer que révocation serveur bloque les accès futurs mais n'efface pas les données déjà stockées hors ligne |

### Tests de sécurité requis avant implémentation
- Révoquer un appareil secondaire depuis la racine et vérifier que ses sessions, jetons et abonnements push sont inutilisables.
- Remettre en ligne l'ancien appareil après révocation : aucune réactivation possible.
- Faire concourir renouvellement de session, envoi push et révocation ; aucun droit ne doit survivre à la révocation confirmée.
- Vérifier qu'un secondaire ne peut pas approuver un autre appareil ni modifier la racine.
- Vérifier que la perte de la racine déclenche le parcours racine distinct et que le GPS reste bloqué.
- Vérifier qu'une alerte active conserve son instantané initial, ses tâches, son état et son historique après révocation.
- Vérifier qu'aucune révocation appareil ne clôture une alerte ou ne supprime contacts/abonnement/historique.
- Vérifier les notifications de sécurité sans fuite de coordonnées, contenu d'alerte ou GPS.
- Vérifier qu'aucune interface ne prétend effacer à distance un téléphone hors ligne.

**NO-GO :** aucun scénario n'est déclaré testé. Aucun code, API, migration, notification réelle ou commande de révocation n'est ajouté.


## Audit — téléphone racine volé avec code de déverrouillage connu (18 novembre 2026)

| Scénario | Risque | Contrôle attendu |
|---|---|---|
| Voleur connaît le code Android | Accès à la session et aux facteurs locaux | Ne pas considérer le déverrouillage local comme preuve indépendante ; revalidation serveur |
| Racine approuvée mais propriétaire absent | Opérations sensibles effectuées par voleur | Suspension/révocation de l'autorité racine selon procédure à arbitrer |
| Secondaire compromis | Suspension abusive de la racine | Preuve fraîche, appareil actif non révoqué, confirmation explicite, audit |
| Secondaire tente de se promouvoir | Prise de contrôle de l'identité cryptographique | Interdiction absolue d'auto-promotion et d'approbation de remplacement |
| Ancienne racine revient en ligne | Réactivation après déclaration de compromission | Révocation irréversible de l'ancienne époque ; aucun renouvellement |
| Suspension pendant un SOS | Interruption des alertes | Conserver alertes actives, instantanés et tâches de notification |
| Demande de suspension abusive | Déni de service au titulaire | Risque explicite, preuve du demandeur, procédure de contestation sans réactivation ancienne racine |
| Téléphone hors ligne | Faux sentiment d'effacement | Révocation serveur seulement ; aucune promesse d'effacement distant |
| StrongBox indisponible | Niveau de protection matériel inférieur | Politique de compatibilité explicite ; ne pas annoncer une garantie uniforme |
| Code Android connu avec biométrie activée | Le code peut rester un facteur de secours | Ne pas présenter la biométrie comme indépendante du code système |

### Tests requis avant implémentation
- Vol simulé d'un appareil racine avec code système connu ; vérifier quelles opérations restent possibles et les protections effectives.
- Vérifier que la confirmation d'une opération sensible sur le même appareil n'est pas traitée comme une preuve indépendante.
- Depuis un secondaire valide, vérifier la suspension de la racine et l'impossibilité d'approuver un remplaçant.
- Depuis un secondaire révoqué ou non autorisé, vérifier le refus de suspension.
- Reconnecter l'ancienne racine après suspension : aucun renouvellement, approbation ou accès sensible.
- Vérifier que les alertes actives et tâches SOS persistent après suspension.
- Tester les courses suspension/réauthentification/approbation avec revalidation transactionnelle.
- Tester Android Keystore, StrongBox quand présent, fallback matériel, verrouillage biométrique et code système sur appareils cibles.
- Vérifier que la contestation ne réactive pas l'ancienne racine et qu'aucun support ne peut contourner la procédure.
- Vérifier l'absence de fuite de clés, secrets, OTP, GPS et contenu d'alerte dans les journaux.

**NO-GO :** ces tests ne sont pas exécutés. Aucune intégration Android, API, migration, notification ou suspension réelle n'est mise en place.


## Audit — récupération avec kit hors ligne sans appareil approuvé (18 novembre 2026)

| Scénario | Risque | Contrôle attendu |
|---|---|---|
| Kit volé avec téléphone | Prise de contrôle du compte | Kit à usage unique, OTP nouvelle boîte, délai proposé, session limitée |
| Kit divulgué à distance | Récupération frauduleuse | Secret aléatoire fort, vérificateur protégé, challenge lié à la demande, limitation d'essais |
| OTP nouvelle boîte présenté comme identité | Usurpation | OTP prouve uniquement le contrôle de la boîte, jamais l'identité historique |
| Ancienne session du téléphone volé encore valide | Attaquant conserve l'accès | Invalidation serveur de toutes les sessions/jetons au succès final |
| Téléphone volé hors ligne | Fausse promesse d'effacement | Pas d'effacement distant ; rejet des opérations lors du retour en ligne |
| Rejeu du kit | Réutilisation après récupération | Consommation atomique unique et version de kit |
| Deux demandes simultanées | Double session ou double consommation | Une seule demande active et verrouillage atomique |
| Contestation pendant le délai | Récupération abusive ou blocage malveillant | Politique de contestation à définir, sans veto automatique d'une ancienne boîte |
| Session limitée trop puissante | Accès privé avant rétablissement confiance | Liste d'autorisation minimale, refus par défaut |
| Récupération confondue avec racine | Restauration abusive des clés | Séparation stricte compte/racine/appareil/GPS |
| Panne pendant finalisation | Kit consommé sans récupération effective | Transaction atomique et règles de reprise idempotentes |
| SOS actif pendant récupération | Interruption ou réécriture de l'alerte | Conserver instantanés, tâches et historique ; accès limité à l'état agrégé déjà validé |

### Tests obligatoires avant implémentation
- Kit correct + nouvelle adresse vérifiée : demande en attente, aucune session complète.
- Kit incorrect, expiré ou déjà consommé : refus générique, aucune fuite d'existence du compte.
- OTP nouvelle adresse invalide : aucune modification de canal.
- Tentatives distribuées, rejeu, deux demandes concurrentes et consommation simultanée.
- Contestation pendant le délai et panne au moment de la finalisation.
- Vérifier que la session limitée ne peut lire ni modifier les données privées, contacts, alertes, GPS, appareils ou racine.
- Vérifier que l'état agrégé du SOS de secours n'expose aucune identité ou coordonnée de contact.
- Au succès final, vérifier invalidation de toutes les sessions, jetons et abonnements push antérieurs.
- Reconnecter le téléphone volé après récupération : rejet serveur et absence de réactivation.
- Vérifier conservation des alertes actives, instantanés destinataires et tâches de notification.
- Vérifier qu'aucune opération de récupération ne restaure une clé GPS expirée ou une archive détruite.

**NO-GO :** ces tests ne sont pas exécutés. Aucun mécanisme réel de récupération ou de révocation n'est activé.


## Audit — kit volé avec ancienne adresse e-mail encore accessible (18 novembre 2026)

| Scénario | Risque | Contrôle attendu |
|---|---|---|
| Kit volé, appareil approuvé encore sûr | Attaquant utilise le kit avant son propriétaire | Invalidation depuis session de confiance, demandes concurrentes refusées |
| Kit volé, aucun appareil, ancienne boîte accessible | OTP e-mail utilisé comme récupération complète | Refuser récupération historique ; e-mail ne prouve que contrôle de boîte |
| Attaquant possède kit mais pas ancienne boîte | Tentative de demande avec nouvelle adresse | Notification neutre et contestation négative possible ; aucune session complète |
| Attaquant contrôle aussi ancienne boîte | Deux facteurs de récupération potentiellement compromis | Ne pas considérer l'e-mail comme facteur indépendant suffisant ; refuser sans preuve indépendante |
| Lien de contestation volé ou transféré | Pause non autorisée d'une demande | Lien à usage unique, lié à une demande, durée courte, privilège négatif uniquement |
| Contestations répétées | Déni de service contre le titulaire | Limitation de fréquence, journalisation et pause bornée |
| E-mail révèle nouvelle adresse | Divulgation et ciblage | Ne jamais inclure la nouvelle adresse ou coordonnées sensibles |
| Kit remplacé mais ancien kit encore accepté | Rejeu et récupération concurrente | Version de kit, invalidation atomique et contrôle anti-rejeu |
| Support/contact intervient | Contournement de la preuve | Aucun pouvoir de récupération manuelle |

### Tests obligatoires avant implémentation
- Depuis appareil approuvé valide, invalider un kit compromis ; vérifier que l'ancien kit ne peut plus ouvrir de demande.
- Vérifier que le remplacement du kit exige une session de confiance et que le nouveau secret n'est affiché qu'une fois.
- Sans appareil approuvé, présenter kit compromis + OTP ancienne boîte : aucune récupération complète.
- Vérifier que l'e-mail de contestation ne permet que de suspendre la demande visée et n'accorde aucune session ni changement de compte.
- Réutiliser, transférer, rejouer et expirer le lien de contestation.
- Saturer les contestations : les limites anti-abus ne doivent pas bloquer durablement le titulaire.
- Contrôler les fuites dans les messages : aucune nouvelle adresse, position, contact, alerte ou secret.
- Vérifier qu'une demande suspendue ne reprend pas automatiquement sans preuve indépendante.
- Vérifier absence de contournement par support, contact, SMS ou formulaire manuel.

**NO-GO :** aucun test n'est exécuté ; aucun lien de contestation, OTP, invalidation ou remplacement réel du kit n'est activé.


## Audit — remplacement du kit perdu depuis un appareil approuvé (18 novembre 2026)

| Scénario | Risque | Contrôle attendu |
|---|---|---|
| Kit oublié ou perdu, appareil sûr disponible | Blocage inutile de la récupération future | Remplacement sans ancien kit depuis appareil approuvé |
| Kit volé, appareil sûr disponible | Ancien kit utilisé pendant la procédure | Invalidation atomique au commit ; demandes concurrentes refusées |
| Appareil initiateur compromis | Voleur remplace le kit et exclut le titulaire | Preuve cryptographique fraîche ; ne pas se fier au code local ou à la session seule |
| OTP e-mail seul | Remplacement par attaquant contrôlant une boîte | OTP ne suffit jamais |
| Perte réseau avant commit | Ancien kit invalidé à tort | Ancien kit reste valide tant que commit non effectué |
| Perte réseau après commit | Client croit à tort que l'ancien kit reste valide | État d'opération consultable sans réafficher le secret ; nouveau kit seul valide |
| Double clic / demandes concurrentes | Plusieurs kits actifs ou invalidations incohérentes | Version attendue, idempotence et transaction atomique |
| Capture écran / presse-papiers / télémétrie | Fuite du nouveau secret | Masquage autant que possible, aucune télémétrie, logs ou sauvegarde ; avertissement stockage sûr |
| Fermeture avant sauvegarde | Kit perdu immédiatement après génération | Secret non récupérable ; nouveau remplacement depuis appareil de confiance |
| Ancien kit réutilisé | Rejeu après remplacement | Vérificateur précédent invalidé et version incrémentée |

### Tests obligatoires avant implémentation
- Remplacer un kit sans saisir l'ancien depuis appareil approuvé valide.
- Refuser depuis appareil révoqué, non approuvé, ou dont preuve cryptographique est périmée.
- Vérifier qu'un OTP e-mail, mot de passe ou session en cache seul ne peut pas remplacer le kit.
- Vérifier l'invalidation de l'ancien kit exactement au commit et l'absence de double version active.
- Simuler panne réseau avant et après commit ; confirmer les états sans réafficher le secret.
- Simuler deux remplacements concurrents et vérifier une seule réussite.
- Vérifier que le secret brut ne figure dans aucun log, télémétrie, rapport d'erreur, sauvegarde ou requête réseau.
- Vérifier qu'aucune session, racine, relation, alerte ou tâche SOS n'est modifiée.
- Vérifier que la fermeture de l'écran ne permet pas de récupérer le secret depuis le serveur.

**NO-GO :** aucun test n'est exécuté et aucun remplacement réel n'est activé.


## Audit — fuite du kit pendant génération et affichage (18 novembre 2026)

| Vecteur | Risque | Exigence / limite |
|---|---|---|
| Capture d'écran ou enregistrement | Copie du kit par une personne ou application | Protection Android native à tester ; PWA ne peut pas garantir le blocage |
| Aperçu multitâche | Secret visible dans les applications récentes | Masquage à l'arrière-plan et protection native si disponible |
| Presse-papiers | Autre application ou historique récupère le secret | Aucune copie par défaut ; effacement universel non garanti |
| Sauvegarde Android / cloud | Secret réapparaît après restauration | Ne jamais écrire le kit dans les données persistantes ou sauvegardables |
| localStorage / IndexedDB / Cache API | Secret récupéré après fermeture ou par script | Interdiction de persistance |
| Service worker | Secret mis en cache | Ne jamais mettre en cache écran ou réponse contenant le secret |
| Logs / analytics / crash reports | Fuite vers outils tiers | Exclure secret, fragments, captures et valeurs saisies |
| URL / historique / notification | Secret conservé hors écran | Aucun secret dans URL, titre, notification ou message |
| Appareil rooté / espionné | Lecture ou photographie pendant affichage | Risque résiduel explicite ; aucune protection absolue |
| Accessibilité / lecteur d'écran | Exposition à un service tiers | Évaluer les services actifs ; ne pas sacrifier l'accessibilité sans analyse |

### Tests requis avant GO
- Inspecter stockage navigateur, caches, service worker et sauvegardes : aucune occurrence du secret.
- Inspecter requêtes réseau : aucun caractère du kit envoyé au serveur.
- Inspecter journaux, analytics, crash reports et traces : aucun secret ni fragment.
- Vérifier effacement à fermeture, navigation, expiration, verrouillage et mise en arrière-plan sur les plateformes supportées.
- Sur Android natif, tester capture, enregistrement, aperçu multitâche et sauvegarde sur plusieurs versions et fabricants.
- Sur PWA, documenter explicitement les captures et enregistrements qui restent possibles.
- Vérifier qu'aucun bouton ne copie, partage, télécharge ou exporte le secret.
- Vérifier que le secret n'est pas restauré après fermeture, redémarrage, restauration de sauvegarde ou réinstallation.
- Tester accessibilité, contraste, zoom et lecteur d'écran avec un modèle de menace explicite.

**NO-GO :** aucun test n'est exécuté ; aucune protection native ou écran réel n'est livré.