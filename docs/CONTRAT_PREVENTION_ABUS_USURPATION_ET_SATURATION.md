# SAC — Contrat de prévention des abus, de l'usurpation et de la saturation

**Date :** 18 novembre 2026  
**Statut :** consolidation des invariants existants et cadre de conception. Les seuils, procédures et mesures nouvelles proposés restent à arbitrer.  
**Portée :** faux comptes, usurpation, harcèlement, invitations abusives, fausses alertes, abus du SOS, automatisation, saturation, déni de service, compromission, abus interne et signalements malveillants.  
**Nature :** documentation uniquement. Aucun anti-abus, seuil, verrouillage, détection, endpoint, fournisseur ou mécanisme n'est implémenté par ce contrat.

## 1. Références et décisions qui prévalent

À lire avec :
- `CONTRAT_SECURITE_CYCLE_SOS_ET_INTEGRITE_ALERTES.md` ;
- `CONTRAT_SECURITE_NOTIFICATIONS_ET_COMMUNICATIONS.md` ;
- `CONTRAT_SECURITE_COMPTES_ET_APPAREILS_EN_URGENCE.md` ;
- `CONTRAT_CYCLE_VIE_PROCHES_ET_INVITATIONS.md` ;
- `PROPOSITIONS_ARBITRAGE_INVITATIONS_ET_REVOCATION.md` ;
- `CONTRAT_PROTECTION_DONNEES_ACCES_INTERNES_ET_AUDIT.md` ;
- `CONTRAT_CONFIDENTIALITE_FAMILIALE_ET_ISOLATION_DONNEES.md` ;
- `PROPOSITION_POLITIQUE_GENERALE_CONSERVATION_DONNEES.md`.

Les règles SOS déjà validées prévalent : le chemin critique doit rester utilisable en situation de danger ; aucune sanction automatique ne peut être fondée uniquement sur le nombre d'alertes répétées ; une alerte ne dépend ni d'un fournisseur de notification ni du GPS ; seul l'auteur clôture l'alerte selon le cycle établi ; les destinataires initiaux restent figés et les rappels prévus continuent jusqu'à clôture.

Les seuils d'invitation déjà consignés dans le document de propositions restent des propositions et ne deviennent pas approuvés par leur reprise ici.

## 2. Objectifs et principes non négociables

SAC doit :
1. protéger les personnes contre le harcèlement, l'usurpation, l'accès non autorisé et la divulgation de données ;
2. limiter les attaques automatisées et la saturation de l'infrastructure ;
3. protéger les destinataires contre les invitations répétées et les sollicitations abusives ;
4. conserver une disponibilité prioritaire du déclenchement SOS ;
5. distinguer une anomalie technique, un comportement inhabituel, un abus probable et un abus établi ;
6. préserver les preuves minimales nécessaires à l'analyse, sans constituer une surveillance générale des utilisateurs ;
7. garantir qu'un signalement d'abus ne donne pas au plaignant le pouvoir de suspendre un compte, supprimer une alerte ou révoquer une relation.

**Principe prioritaire :** les contrôles anti-abus doivent être proportionnés et gradués. Une mesure de protection ne doit pas créer un obstacle disproportionné à une personne qui demande réellement de l'aide.

## 3. Modèle de menaces

### 3.1 Abus entre personnes
- création de comptes pour contourner un refus ou une révocation ;
- invitations répétées, pression, intimidation ou harcèlement d'un destinataire ;
- usurpation de l'identité ou de l'adresse d'une autre personne ;
- tentative de prendre le contrôle d'un compte ou d'un appareil ;
- utilisation d'un compte familial partagé pour espionner un autre membre ;
- faux signalements visant à faire sanctionner une personne ;
- divulgation volontaire de détails d'alerte à des tiers non autorisés.

### 3.2 Abus des fonctions SOS
- déclenchements automatisés ou massifs destinés à saturer les notifications ;
- répétitions artificielles créées par rejeu, scripts ou clients modifiés ;
- fausses informations ajoutées pour nuire à un proche ;
- tentative d'annuler, modifier ou clôturer l'alerte d'une autre personne ;
- usurpation d'accusés de réception, de candidatures ou de statut de livraison ;
- utilisation du SOS pour harceler un destinataire ou le contraindre à intervenir.

Une fréquence élevée de SOS peut aussi correspondre à une situation réelle, à un risque récurrent ou à une personne qui a besoin d'aide. La fréquence seule n'est jamais une preuve de fraude.

### 3.3 Attaques techniques
- énumération de comptes, invitations, alertes et identifiants ;
- force brute sur mot de passe, OTP, jetons ou défis ;
- rejeu d'une requête ou d'un webhook ;
- création massive de comptes, invitations ou abonnements push ;
- épuisement des quotas e-mail, push, SMS, CPU, stockage ou connexions ;
- déni de service sur les API de connexion, de lecture ou de déclenchement SOS ;
- saturation par pièces jointes, médias, requêtes coûteuses ou pagination ;
- exploitation des courses concurrentes pour dupliquer une alerte ou contourner une révocation.

### 3.4 Abus interne
- consultation de données sans mission ou hors finalité ;
- export excessif ou consultation répétitive ;
- usage abusif d'une délégation ou tentative de redelegation ;
- falsification ou suppression de traces ;
- utilisation d'un compte professionnel ou privilégié pour rechercher un proche.

Les missions, délégations et permissions restent soumises au contrat d'accès interne ; aucun rôle ne peut s'auto-attribuer de droits.

## 4. Défense en profondeur

Les contrôles doivent être répartis entre plusieurs couches indépendantes :

1. **Identité :** e-mail obligatoire et vérifié avant activation ; mot de passe et OTP protégés ; aucune activation par SMS.
2. **Autorisation :** contrôle serveur pour chaque action et chaque ressource ; aucune confiance dans les identifiants fournis par le client.
3. **Intégrité :** clés d'idempotence, défis à usage unique, protection anti-rejeu et opérations atomiques.
4. **Débit :** limites adaptées au type d'action, au compte, à l'appareil et à la ressource, sans blocage aveugle du SOS.
5. **Abus interpersonnel :** refus, blocage, révocation, signalement et limites d'invitation sans exposer les comptes.
6. **Disponibilité :** quotas d'infrastructure, isolation des files, priorisation des fonctions critiques et protection contre les coûts incontrôlés.
7. **Détection :** signaux de risque contextualisés, avec revue avant toute sanction durable.
8. **Audit :** traces minimales, protégées, horodatées côté serveur et contrôlées selon les règles de confidentialité.

Aucun signal isolé — adresse IP, appareil, numéro déclaré, géolocalisation, fréquence ou plainte — ne suffit à établir une identité frauduleuse.

## 5. Protection du parcours SOS — priorité absolue

### 5.1 Ne pas transformer l'anti-abus en barrière d'urgence

Interdictions :
- CAPTCHA obligatoire par défaut avant le déclenchement SOS ;
- paiement, abonnement ou publicité comme condition d'accès au SOS essentiel ;
- confirmation retardant systématiquement l'envoi d'une alerte ;
- blocage automatique d'un compte uniquement parce qu'il a déclenché plusieurs SOS ;
- sanction automatique fondée uniquement sur une adresse IP, un appareil partagé, un réseau mobile ou une plainte ;
- dépendance du SOS à un service tiers de scoring, de notification, de GPS ou à un fournisseur indisponible ;
- suppression automatique d'une alerte parce qu'un destinataire la qualifie de fausse.

### 5.2 Distinguer répétition réseau et nouvelle urgence

- La répétition technique de la même commande avec la même clé d'idempotence et le même contenu doit retourner le résultat initial, sans créer une deuxième alerte.
- La réutilisation de la clé avec un contenu différent doit être refusée.
- Une nouvelle commande explicite de l'utilisateur constitue un nouvel événement à évaluer selon le cycle métier, et non un doublon à supprimer arbitrairement.
- Un client qui perd la réponse réseau doit pouvoir retrouver l'état serveur sans multiplier les alertes.
- L'interface ne doit jamais annoncer « alerte envoyée » avant confirmation serveur.

### 5.3 Débit et saturation

Proposition de conception à arbitrer :
- réserver une capacité minimale au déclenchement SOS et aux opérations indispensables à son cycle ;
- isoler les files de notifications, médias, analyses et tâches non critiques du chemin de création d'alerte ;
- appliquer des limites distinctes aux lectures, recherches, uploads, invitations et tentatives d'authentification ;
- limiter les coûts par compte et par ressource sans plafonner arbitrairement le nombre d'urgences réelles ;
- prévoir une réponse de dégradation honnête si la base ou l'API critique est indisponible : ne pas prétendre qu'une alerte est transmise.

Les quotas, réserves de capacité, priorités d'exécution et budgets restent à définir par tests de charge et arbitrage. Aucun chiffre n'est approuvé.

## 6. Invitations, proches et harcèlement

Les règles déjà validées restent :
- une invitation n'est pas une relation active ;
- l'acceptation explicite est obligatoire ;
- le destinataire peut refuser ;
- le destinataire peut révoquer une relation selon le contrat applicable ;
- une nouvelle relation exige une nouvelle invitation et un nouveau consentement ;
- aucun ancien jeton ne peut être réactivé ;
- un lien familial ou un groupe ne contourne pas le refus ou la révocation.

Le document `PROPOSITIONS_ARBITRAGE_INVITATIONS_ET_REVOCATION.md` contient des seuils proposés :
- 3 invitations vers la même adresse sur 30 jours, tous invitants confondus ;
- 10 invitations par compte invitant sur 24 heures ;
- une invitation en attente par couple invitant/destination ;
- refroidissement de 30 jours après refus ;
- refroidissement de 90 jours après révocation par le destinataire ;
- validité 7 jours et relances limitées.

**Ces nombres ne sont pas approuvés.** Ne pas les coder ni les présenter comme des limites déjà actives. Le destinataire doit pouvoir bloquer un invitant sans devoir justifier son choix. Les réponses ne doivent pas révéler si l'adresse possède un compte SAC.

## 7. Inscription, connexion, OTP et récupération

Préserver les règles validées :
- e-mail obligatoire, vérifié par OTP avant activation ;
- téléphone obligatoire comme coordonnée déclarée, mais non vérifiée ;
- aucun SMS OTP pour créer, activer, connecter ou récupérer un compte ;
- OTP non exigé à chaque connexion normale par défaut ;
- OTP seul ne prouve ni l'approbation d'un appareil secondaire ni la possession de la racine ;
- mot de passe d'au moins 12 caractères ;
- expiration, usage unique, invalidation après succès/remplacement et protection anti-rejeu pour les OTP.

Contrôles à concevoir, sans seuil inventé :
- limitation progressive des demandes et vérifications OTP ;
- délai croissant après tentatives répétées, sans révéler si une adresse est enregistrée ;
- protection contre la consommation de quota e-mail ;
- invalidation des défis antérieurs après changement d'état ;
- détection des séquences automatisées ;
- récupération et révocation conformes au contrat comptes/appareils.

Une limitation d'authentification ne doit pas créer un moyen pour un attaquant de verrouiller durablement le compte d'une victime en provoquant des tentatives depuis l'extérieur. Les effets d'un verrouillage et le déverrouillage doivent être arbitrés.

## 8. Usurpation et création de comptes

- Le nom, la photo, le téléphone déclaré ou l'appartenance à un groupe ne constituent pas à eux seuls une preuve d'identité civile.
- L'e-mail vérifié prouve le contrôle de la boîte au moment de la vérification, pas l'identité réelle de la personne.
- Ne pas présenter SAC comme un service de vérification d'identité officielle tant qu'aucune procédure indépendante et légale n'existe.
- Ne pas collecter de pièce d'identité ou de biométrie « au cas où » ; toute vérification supplémentaire exige une finalité, une base juridique, une minimisation et un arbitrage distinct.
- Les doublons suspects peuvent être examinés selon des signaux proportionnés, mais ne doivent pas être fusionnés automatiquement.
- Le support ne peut pas attribuer un compte à une personne sur simple demande ou connaissance d'informations publiques.

## 9. Signalement d'un abus et traitement des plaintes

Proposition de parcours à arbitrer :
1. l'utilisateur signale un comportement, une invitation, une notification ou un contenu précis ;
2. le serveur enregistre la ressource concernée, le type de plainte, l'auteur authentifié, l'heure serveur et une référence de preuve minimale ;
3. le plaignant reçoit un accusé de réception, sans révéler le statut privé d'un autre compte ;
4. une personne habilitée examine la plainte selon une mission explicite ;
5. une décision éventuelle est motivée, proportionnée, auditée et contestable selon une procédure à définir ;
6. le signalement ne supprime pas automatiquement une alerte, ne modifie pas les destinataires et ne clôture pas le SOS.

Garde-fous :
- empêcher les plaintes en masse de devenir un outil de sanction automatique ;
- détecter les plaintes répétitives coordonnées sans présumer qu'elles sont fausses ;
- protéger l'identité du plaignant dans la mesure compatible avec l'examen contradictoire ;
- ne pas révéler au plaignant les données privées ou les sanctions détaillées d'un autre compte ;
- permettre le retrait ou la correction d'un signalement selon une règle à définir ;
- distinguer signalement d'urgence, plainte de harcèlement, abus de plateforme et incident technique.

Le rôle chargé de l'examen, les délais, la procédure de contestation et les sanctions ne sont pas approuvés ici.

## 10. Mesures graduées et garanties contre les faux positifs

Une réponse de sécurité doit suivre une progression adaptée à la gravité et à la fiabilité des preuves :
- journaliser un signal faible sans affecter l'utilisateur ;
- demander une nouvelle authentification pour une action sensible lorsque le contexte le justifie ;
- limiter temporairement l'action non critique qui est abusée ;
- neutraliser un jeton, une invitation ou un appareil compromis ;
- suspendre une capacité ciblée plutôt que l'ensemble du compte lorsque c'est possible ;
- escalader vers une revue humaine pour toute sanction durable ou contestée.

Principes :
- ne pas afficher au suspect les seuils exacts qui faciliteraient le contournement ;
- fournir à l'utilisateur légitime un message clair et un moyen de recours ;
- ne pas confondre suspension administrative par le Super Admin et verrouillage technique de sécurité ;
- ne pas modifier l'état du compte sans respecter les cinq états validés ;
- aucune mesure anti-abus ne permet à un délégataire de déléguer, suspendre ou attribuer une mission hors de ses droits ;
- conserver une trace des motifs, de la portée, de l'auteur et de la durée de chaque mesure, selon une politique de rétention à approuver.

Les seuils, délais, durées, facteurs de risque, recours et pouvoirs d'intervention restent à arbitrer.

## 11. Protection contre le déni de service et les coûts

À concevoir :
- plafonds de ressources par type de route et de tâche ;
- limites de taille et de fréquence pour les médias, sans inventer de limite produit ;
- pagination bornée et requêtes coûteuses protégées ;
- files séparées et travailleurs idempotents ;
- budgets et alertes de consommation pour e-mail, push, SMS futur et stockage ;
- protection des webhooks par signature, horodatage, fenêtre anti-rejeu et authentification ;
- réponses génériques et limitation des tentatives d'énumération ;
- tests de charge, de rafale, de reprise et de panne fournisseur ;
- mécanisme de dégradation qui préserve le statut honnête des opérations.

Les protections périphériques (WAF, quotas Cloudflare, règles réseau ou fournisseurs) ne remplacent jamais l'autorisation applicative et ne doivent pas être configurées au hasard. Aucun service, plan, fournisseur ou ressource n'est choisi par ce contrat.

## 12. Abus interne et contrôle privilégié

- Toute lecture sensible, recherche, export et mutation doit respecter la mission et la permission serveur.
- Les délégataires ne peuvent ni s'auto-attribuer des droits ni redéléguer.
- Le Super Admin reste soumis à l'audit et ne doit pas pouvoir réécrire silencieusement les traces.
- Une consultation atypique génère un signal à examiner, pas une sanction automatique.
- Le contrôle indépendant du Super Admin et le scellement externe des journaux restent des points ouverts.
- Le support ne peut pas supprimer une alerte, modifier ses destinataires, récupérer une racine ou contourner une suspension.
- Les données utilisées pour détecter l'abus doivent être minimisées et ne pas inclure de GPS précis, secrets, OTP ou contenu SOS inutile.

## 13. Journalisation et protection des preuves

Les traces de sécurité doivent être :
- horodatées côté serveur ;
- liées à un identifiant de corrélation et à un résultat ;
- protégées contre l'altération et l'accès non autorisé ;
- minimisées et séparées des contenus métier ;
- dépourvues de mots de passe, OTP, jetons bruts, clés privées, racines, GPS précis et corps sensibles de SOS ;
- consultables uniquement selon une mission/permission explicite ;
- conservées selon une durée qui doit être approuvée dans la politique générale.

Un hash dans la même base accessible au même opérateur privilégié ne suffit pas à prouver l'intégrité contre cet opérateur. Le scellement indépendant reste à concevoir.

## 14. Tests d'acceptation indispensables

1. Un client rejoue la même requête SOS : une seule alerte est créée.
2. Une clé d'idempotence réutilisée avec un contenu différent est refusée.
3. Deux déclenchements concurrents identiques ne créent pas de doublon.
4. Deux nouvelles urgences explicites ne sont pas supprimées par une règle de répétition aveugle.
5. Une fréquence élevée de SOS ne provoque jamais à elle seule un blocage automatique.
6. Un CAPTCHA, paiement ou abonnement ne bloque pas le parcours SOS critique par défaut.
7. Une attaque sur invitations ne permet pas de harceler un destinataire au-delà des limites finalement approuvées.
8. Les seuils d'invitation proposés ne sont pas traités comme approuvés avant arbitrage.
9. Une réponse d'inscription ou de récupération ne révèle pas l'existence d'un compte.
10. Une rafale OTP ne consomme pas sans limite le quota du fournisseur.
11. Un attaquant ne peut pas verrouiller durablement la victime en déclenchant seul des tentatives.
12. Un SMS sur le téléphone déclaré ne permet pas l'activation ni la récupération.
13. Un ancien jeton d'invitation, OTP ou webhook rejoué est refusé.
14. Un groupe ou lien familial ne contourne pas un refus ou une révocation.
15. Une plainte coordonnée ne suspend pas automatiquement le compte ciblé.
16. Un signalement d'abus ne clôture pas une alerte et ne modifie pas ses destinataires.
17. Un destinataire ne peut pas clôturer le SOS de l'auteur.
18. Une notification ou un accusé fournisseur falsifié ne modifie pas l'état métier.
19. Un compte professionnel ne peut pas consulter hors mission.
20. Un délégataire ne peut pas se donner une mission ou redéléguer.
21. Une attaque sur les médias, recherches et API non critiques n'épuise pas la capacité réservée au SOS.
22. Une panne d'e-mail, push, SMS ou GPS ne bloque pas la création d'une alerte si le service SOS serveur est disponible.
23. Si le service SOS serveur est indisponible, l'interface ne prétend pas que l'alerte est envoyée.
24. Les limites de débit ne sanctionnent pas tous les utilisateurs partageant une IP ou un réseau mobile.
25. Les mesures temporaires expirent ou sont réévaluées selon une règle serveur explicite.
26. Toute sanction durable ou contestée est traçable et suit une procédure de recours.
27. Aucun log ou signal anti-abus ne contient de secret, OTP, GPS précis ou contenu SOS inutile.
28. Une restauration ne réactive ni compte, ni jeton, ni appareil, ni invitation ou permission révoquée.

## 15. Arbitrages restant ouverts

- seuils et fenêtres de débit pour inscription, login, OTP, invitations, lecture, recherche et médias ;
- stratégie anti-automatisation hors du parcours SOS critique ;
- capacité réservée, priorité et isolation des tâches SOS ;
- traitement des tentatives répétées sans créer un verrouillage exploitable par un tiers ;
- politique de blocage des invitations et éventuelle liste de blocage personnelle ;
- procédure de plainte, équipe habilitée, preuve, délais, recours et sanctions ;
- critères de détection et revue humaine des fausses alertes ;
- mesures contre les comptes multiples et l'usurpation sans collecte excessive d'identité ;
- budget et limites fournisseurs, coûts et seuils d'alerte ;
- durées de conservation des preuves anti-abus et scellement indépendant des journaux ;
- contrôle indépendant des actions du Super Admin.

Aucun seuil numérique nouveau, aucune durée, sanction, équipe de modération, fournisseur ou politique de vérification d'identité n'est approuvé ici.

## 16. Conditions avant implémentation

Avant tout anti-abus opérationnel :
1. arbitrer les seuils et les mesures de réponse par catégorie d'action ;
2. préserver explicitement la disponibilité du SOS et les règles SOS validées ;
3. spécifier les transactions, idempotences, courses et protections anti-rejeu ;
4. établir les budgets de capacité et tester les scénarios de saturation ;
5. définir la procédure de plainte, de revue, de contestation et de correction ;
6. valider la minimisation et les durées de conservation des preuves ;
7. effectuer une revue sécurité/confidentialité indépendante ;
8. obtenir une autorisation distincte avant code, tests d'intégration, migration D1, WAF, ressource Cloudflare, fournisseur, secrets ou déploiement.

**Conclusion :** SAC doit être difficile à abuser, mais facile à utiliser lorsqu'une personne est réellement en danger. La sécurité protège le SOS ; elle ne doit pas le punir.
