# SAC — Contrat commun API et fondations d'authentification V1

**Date :** 18 novembre 2026  
**Statut :** proposition technique de consolidation, à relire avant toute implémentation.  
**Dépôt :** `benwahab/SAC`, branche unique `main`.  
**Périmètre :** API REST Cloudflare Pages Functions, authentification de compte, sessions par appareil, autorisation serveur et conventions HTTP.  
**Hors périmètre :** fournisseur OTP/SMS/e-mail, migration D1, routes métier, remplacement de racine, GPS, notifications réelles et déploiement.

> Ce document ne vaut pas approbation de décisions produit encore ouvertes. Il établit les invariants de sécurité communs et identifie les choix qui doivent être arbitrés avant d'écrire les routes.

## 1. Décision d'architecture

La stack reste inchangée :
- React + Vite + TypeScript + Tailwind + Lucide React ;
- API REST TypeScript dans Cloudflare Pages Functions sous `functions/api/` ;
- Cloudflare D1 comme base relationnelle ;
- PWA d'abord, Capacitor ultérieurement ;
- adaptateurs de capacités terminal sous `src/services/device/`.

Le code actuel ne contient qu'une route `GET /api/health`. Les fonctions de domaine dans `src/domain/` sont des contrats purs : elles ne créent pas de session, ne valident pas un jeton HTTP, ne lisent pas D1 et n'autorisent pas directement une requête réseau.

**Conséquence :** aucune route métier ne doit être créée en copiant simplement l'appel à une fonction pure. Il faut d'abord établir le socle serveur partagé décrit ci-dessous.

## 2. Vocabulaire à ne pas confondre

| Terme | Ce qu'il prouve | Ce qu'il ne prouve pas |
|---|---|---|
| Identité de compte | Quel compte SAC est authentifié | La possession d'une clé racine |
| Vérification OTP | Le contrôle d'un canal de contact à un instant donné | L'identité cryptographique, l'approbation d'un appareil ou le droit GPS |
| Session | Une authentification de compte limitée dans le temps | Que l'appareil est encore actif ou autorisé |
| Appareil approuvé | L'appareil a été accepté selon le protocole autorisé | Que sa session est valide à chaque requête |
| Racine cryptographique | Autorité de confiance selon le protocole multi-appareils | L'accès au compte à elle seule |
| Autorisation de ressource | Le compte courant a le droit d'effectuer cette action sur cette ressource | Un droit permanent à toutes les données liées |

Une récupération de compte ne remplace jamais la racine. Un OTP ne peut jamais approuver silencieusement un appareil secondaire. La transition/remplacement de racine reste interdite en V1.

## 3. Contrat HTTP commun

### 3.1 Origine et version

- Les routes métier futures doivent être regroupées sous un préfixe versionné, proposition : `/api/v1/`.
- La route de santé existante `GET /api/health` reste distincte et ne prouve que l'accès SQL D1.
- Aucun endpoint métier ne doit être exposé avant son contrat, ses tests et ses règles de conservation.
- Les méthodes HTTP doivent refléter l'intention : lecture sans effet de bord ; commandes sensibles avec méthode non sûre et vérification d'autorisation.
- Les réponses ne doivent jamais révéler si un compte tiers existe, ni distinguer des états secrets lorsqu'une telle distinction faciliterait l'énumération.

### 3.2 Formats et validation

- JSON UTF-8 pour les corps structurés.
- Rejeter les types MIME inattendus, JSON invalide, corps trop volumineux, propriétés inconnues sur les commandes sensibles et valeurs hors schéma.
- Validation côté serveur obligatoire, même si le frontend valide déjà.
- Les identifiants fournis par le client ne sont que des sélecteurs de ressource ; ils ne prouvent aucun droit.
- Requêtes D1 préparées et paramètres liés ; jamais de concaténation de données utilisateur dans SQL.
- Horodatages serveur canoniques UTC ; l'heure du téléphone ne décide ni expiration, ni ordre de priorité, ni autorisation.
- Limites de taille distinctes par route, définies avant implémentation. Aucun corps de requête complet ne doit être journalisé.

### 3.3 Réponse de succès et d'erreur

La forme exacte reste à figer dans les types partagés, mais toutes les routes doivent respecter les mêmes principes :
- résultat métier explicite ;
- identifiant de corrélation opaque pour support ;
- pas de stack trace, SQL, nom de table, secret, OTP, jeton ou détail d'infrastructure dans la réponse publique ;
- codes HTTP cohérents ;
- aucun succès annoncé avant le commit D1 et la confirmation de l'effet métier.

Codes de référence :
- `400` : requête mal formée ;
- `401` : absence d'authentification valide ;
- `403` : authentifié mais action interdite ;
- `404` : ressource absente ou volontairement masquée pour éviter l'énumération ;
- `409` : conflit d'état, doublon métier ou clé d'idempotence réutilisée avec un contenu différent ;
- `413` : corps trop volumineux ;
- `415` : type de contenu non accepté ;
- `422` : données structurées mais invalides selon le contrat ;
- `429` : limite anti-abus atteinte ;
- `500/503` : erreur ou indisponibilité, sans faux succès.

Les erreurs métier renvoyées au client doivent utiliser des codes stables non sensibles. Les messages destinés aux utilisateurs seront localisés dans l'interface.

### 3.4 CORS, origine et CSRF

- Autoriser uniquement les origines SAC explicitement configurées pour chaque environnement ; jamais de reflet arbitraire de l'en-tête `Origin`.
- Ne pas activer `Access-Control-Allow-Origin: *` avec des identifiants.
- La politique de transport de session n'est pas encore choisie. Si des cookies sont retenus : `Secure`, `HttpOnly`, `SameSite` adapté, protection CSRF pour les commandes et validation d'origine. Les cookies seuls ne constituent pas une protection CSRF.
- Si un transport Authorization est retenu pour un client natif, définir stockage sécurisé, expiration, révocation et absence de jeton dans les logs.
- Les options exactes doivent être testées sur domaines Preview/Production et sur les clients PWA/Capacitor.

## 4. Authentification et sessions par appareil

### 4.1 Invariants déjà présents dans le domaine

`src/domain/session-authorization.ts` définit un évaluateur pur avec :
- identifiants de session, compte et appareil ;
- empreinte de jeton hexadécimale de 64 caractères ;
- statut actif/révoqué ;
- `authVersion` ;
- dates UTC de création, expiration et révocation ;
- vérification du compte attendu, appareil attendu, statut actif de l'appareil et version d'autorisation courante.

Cet évaluateur est utile, mais son appelant doit lui fournir des données déjà authentifiées et relues depuis D1. Il n'est pas un middleware HTTP.

### 4.2 Contrat de chaque requête protégée

Le futur middleware Pages Functions devra, pour chaque requête protégée :

1. Extraire le justificatif de session selon le transport approuvé.
2. Le valider en format et taille sans l'écrire dans les logs.
3. Calculer l'empreinte selon la méthode approuvée ; ne jamais stocker le jeton brut dans D1.
4. Retrouver la session à partir de l'empreinte dans D1.
5. Charger l'état courant du compte et de l'appareil associés.
6. Vérifier compte actif, session active, expiration selon horloge serveur, appareil actif et `auth_version` identique.
7. Vérifier les éventuelles restrictions spécifiques à l'opération (racine, relation, destinataire, état de ressource).
8. Construire un contexte d'acteur serveur immuable pour le handler.
9. N'exposer au handler que les identifiants vérifiés et les capacités nécessaires.

Aucun cache positif d'autorisation ne doit permettre de continuer à accepter une session ou un appareil révoqué après la révocation effective côté serveur.

### 4.3 Création, expiration et révocation

Les éléments suivants restent à arbitrer avant implémentation :
- transport web et transport Capacitor ;
- format, génération cryptographique et durée de vie du jeton ;
- durée absolue et éventuelle inactivité maximale ;
- rotation et renouvellement ;
- nombre de sessions simultanées par appareil ;
- comportement de déconnexion et révocation globale ;
- stratégie après changement de numéro/e-mail ou récupération de compte.

Invariants :
- chaque session est liée à un compte et à un appareil précis ;
- une session n'est jamais transférée vers un autre appareil ;
- un jeton brut n'est jamais persisté ;
- la révocation doit être vérifiée côté serveur sur chaque requête protégée ;
- une session expirée/révoquée ou dont la version ne correspond plus est refusée ;
- révoquer un appareil invalide les sessions dépendantes ;
- restaurer une sauvegarde cliente ancienne ne réactive pas une session révoquée ;
- les opérations d'émission/révocation sont idempotentes et résistantes à la concurrence.

### 4.4 OTP et récupération de compte

Aucun fournisseur ni parcours OTP n'est choisi par ce contrat. Avant implémentation, il faudra préciser :
- finalité de chaque OTP (vérification de canal, connexion, récupération) ;
- durée, nombre d'essais, renvoi, invalidation et consommation unique ;
- stockage sous forme protégée, jamais en clair ;
- limites par compte, canal, destination, appareil et signaux anti-abus ;
- résistance à la substitution SIM, énumération et rejeu ;
- comportement si le fournisseur répond de façon ambiguë ;
- procédure de support sans pouvoir remplacer la racine.

**Interdiction :** OTP valide, SMS, e-mail ou réinitialisation de mot de passe ne peut approuver un nouvel appareil, restaurer une clé privée ou remplacer la racine.

## 5. Contexte d'acteur et autorisation des ressources

Le middleware doit produire un contexte serveur issu de D1, jamais du JSON client. Exemple conceptuel de champs :
- identifiant du compte authentifié ;
- identifiant de session ;
- identifiant de l'appareil authentifié ;
- statut/version d'autorisation courants ;
- date serveur de la requête ;
- capacités strictement nécessaires à l'action.

Le handler ne doit jamais accepter comme preuve d'autorité :
- `accountId`, `actorAccountId`, `deviceId`, `rootDeviceId`, `authVersion` ou rôle transmis par le client ;
- une valeur de rôle ou d'abonnement calculée seulement dans l'interface ;
- un identifiant de ressource sans contrôle d'appartenance/permission.

Chaque lecture doit inclure dans la requête SQL les critères d'accès : propriétaire, destinataire explicitement autorisé, relation active et état courant selon la ressource. Les écritures sensibles doivent réévaluer les conditions dans l'écriture finale ou dans un mécanisme atomique démontré sur D1.

Le droit de recevoir un rappel, de lire le détail, de répondre, de devenir responsable et de consulter une position sont des permissions différentes. Être membre d'un groupe familial ne confère aucun accès implicite.

## 6. Idempotence et concurrence

Toute commande susceptible d'être répétée après coupure réseau doit définir :
- une clé d'idempotence opaque ;
- sa portée (acteur + type de commande) ;
- une empreinte du contenu canonique ;
- une durée de conservation à valider ;
- le résultat stable retourné lors d'une répétition identique ;
- le refus d'une même clé avec contenu différent.

La clé et le résultat doivent être persistés côté serveur avant de déclarer le succès. Les effets externes ne doivent pas être répétés par une simple répétition HTTP.

Attention à D1 : un batch transactionnel n'est pas automatiquement conditionnel au sens métier. Une instruction qui affecte zéro ligne ne déclenche pas nécessairement le rollback des suivantes. Les tests doivent prouver le comportement réel sur D1 local/Preview isolé.

## 7. Anti-abus sans neutraliser une urgence

Les limites doivent être spécifiques à chaque opération :
- OTP et renvoi ;
- invitations ;
- connexion/récupération ;
- création d'appareil et défis d'approbation ;
- lecture et écriture API ;
- opérations coûteuses ou fournisseur.

Règles de sécurité :
- ne pas bloquer un SOS légitime sur la seule base d'une IP, d'un changement de réseau ou de plusieurs alertes ;
- ne pas imposer un CAPTCHA au moment critique du SOS ;
- l'idempotence protège contre les répétitions de la même commande, sans empêcher une nouvelle alerte légitime ;
- ne pas verrouiller automatiquement tout un compte à la suite d'un signal faible ;
- les limites, temporisations et éventuelles vérifications renforcées doivent avoir un chemin de secours qui ne fabrique jamais un succès.

Aucun quota numérique ni verrouillage n'est défini par ce document.

## 8. Journaux, confidentialité et réponses

Les logs techniques peuvent contenir seulement des métadonnées minimales et nécessaires : identifiant de corrélation, route logique, code de résultat, durée, catégorie d'erreur non sensible et identifiant interne pseudonyme si justifié.

Interdiction de journaliser :
- jetons, cookies, en-têtes Authorization, OTP, secrets et clés privées ;
- corps complets de requête/réponse ;
- coordonnées GPS, géohash, paquets de localisation ou URL révélant une position ;
- contenu privé des alertes, contacts et messages ;
- réponses brutes des fournisseurs contenant des données personnelles.

Les exceptions doivent être redigées avant journalisation. Les durées d'accès et de conservation des logs restent à valider dans la politique générale de conservation.

## 9. Familles d'API candidates — non implémentées

Cette liste sert à structurer les futurs contrats, pas à autoriser la création immédiate des routes.

| Famille | Actions envisagées | Précondition |
|---|---|---|
| Authentification | démarrer et terminer une vérification, ouvrir/fermer session | fournisseur, OTP et transport approuvés |
| Compte | lire profil, modifier préférences, demander suppression | matrice données et suppression validées |
| Appareils | enrôler, lister, approuver, renommer, révoquer | protocole de cérémonie final et revue crypto |
| Contacts | inviter, accepter, refuser, révoquer | permissions et conservation arbitrées |
| Alertes | déclencher sans GPS, lire, répondre, prendre en charge, clôturer | contrat D1 atomique + outbox + tests |
| Trajets | démarrer, confirmer arrivée, terminer | règles produit et conservation validées |
| Notifications | enregistrer abonnement, traiter outbox, réconcilier | fournisseur et scheduler validés |
| Abonnement | lire formule, initier paiement, traiter webhook | prestataire et règles financières validés |

Le SOS non-GPS est une voie produit importante, mais il ne doit être activé qu'après définition d'une authentification sûre, du comportement pendant récupération et de son chemin d'envoi réel.

## 10. Tests obligatoires avant d'exposer une première route protégée

### Tests unitaires
- empreinte de jeton mal formée ;
- session expirée, révoquée ou incohérente ;
- compte différent, appareil différent, appareil en attente/révoqué ;
- `auth_version` obsolète ;
- horodatage invalide et limites exactes d'expiration ;
- absence de confiance implicite dans les identifiants client.

### Tests d'intégration Pages Functions + D1
- jeton inconnu/refusé ;
- compte supprimé ou en suppression ;
- session révoquée pendant une requête concurrente ;
- appareil révoqué et toutes ses sessions ;
- ancienne sauvegarde cliente présentée après révocation ;
- deux commandes identiques simultanées ;
- même clé d'idempotence avec contenu différent ;
- erreur SQL au milieu d'une opération sensible ;
- accès inter-comptes et accès par non-destinataire ;
- absence de secret, OTP, jeton et GPS dans logs et réponses.

### Tests HTTP et navigateur
- CORS origine autorisée/refusée ;
- CSRF si cookies ;
- corps trop volumineux, JSON invalide, mauvais Content-Type ;
- absence de stack trace ;
- comportement réseau coupé avant/après commit ;
- PWA et client natif sur leurs transports retenus.

Aucun test D1/Pages Functions n'est actuellement revendiqué par ce document.

## 11. Points à arbitrer avant implémentation

1. Transport session PWA et Capacitor, avec protection CSRF si cookies.
2. Durée et renouvellement des sessions, révocation et limites multi-appareils.
3. Parcours OTP, finalités distinctes, fournisseur et politique anti-abus.
4. Comportement du SOS non-GPS durant récupération ou racine indisponible.
5. Origines exactes Preview/Production et politique CORS.
6. Durées de conservation des sessions, challenges, traces et idempotence.
7. Procédure de suppression de compte et invalidation de toutes les dépendances.
8. Protocole d'enrôlement appareil final, transcript de cérémonie et revue cryptographique indépendante.

Les décisions produit restent à l'utilisateur ; aucune de ces questions n'est tranchée par le présent document.

## 12. Séquence de réalisation recommandée

1. Valider ce contrat et résoudre les points ouverts qui conditionnent la session.
2. Concevoir le schéma D1 minimal compte/appareil/session/challenge, sans GPS.
3. Écrire migrations et tests D1 local/Preview isolée après autorisation explicite.
4. Implémenter le middleware Pages Functions et les tests d'intégration.
5. Implémenter un premier parcours d'authentification avec fournisseur réel approuvé.
6. Ajouter les routes compte/appareils seulement après revue de sécurité et du protocole multi-appareils.
7. Ajouter contacts puis SOS non-GPS, chacune avec son contrat atomique et ses tests.
8. Ne jamais activer GPS réel ou historique sans décision GO indépendante sur J+30.

## 13. État final

- **GO :** consolidation documentaire et conception du socle API/authentification non-GPS.
- **NO-GO :** prétendre qu'une session est déjà opérationnelle ; exposer une route métier protégée sans middleware ; créer une migration D1 sur la base de ce document seul ; implémenter un fournisseur OTP non choisi ; remplacer la racine ; activer GPS réel/historique.
- **État du code après cet audit :** inchangé. Aucune route, migration, table, clé, ressource Cloudflare ou intégration fournisseur n'est créée.

Ce contrat doit être relu avec `CONTRAT_SECURITE_D1.md`, `CONTRATS_OPERATIONS_ATOMIQUES_D1.md`, `PROTOCOLE_MULTI_APPAREILS.md`, `RECUPERATION_COMPTE_ET_RACINE.md` et `ARBITRAGE_RECUPERATION_RACINE_ET_ATOMICITE_D1.md`. En cas de divergence, les décisions explicites plus récentes et les consignes de sécurité priment ; toute contradiction non résolue bloque l'implémentation.


## 12. Notifications d'alerte : push prioritaire et SMS d'escalade

Cette section intègre la décision produit validée le 18 novembre 2026. Elle ne signifie pas que les notifications sont déjà implémentées.

### 12.1 Canal normal

- La notification push dans l'application est le canal principal pour informer les contacts initiaux.
- Les rappels push sont planifiés toutes les cinq minutes tant que l'alerte reste active, conformément au contrat de cycle d'alerte.
- Le push peut être affiché par le système même lorsque SAC n'est pas ouvert, sous réserve des permissions, du réseau, des capacités du téléphone et du fournisseur.
- Une tentative push, une acceptation fournisseur, une livraison système, une ouverture et un accusé de réception SAC sont des preuves distinctes. Ne jamais les confondre.

### 12.2 Seuil SMS choisi par le lanceur

- Lors de la préparation/déclenchement de chaque alerte, le lanceur choisit le nombre de rappels push à effectuer avant l'escalade SMS.
- Ce seuil est propre à l'alerte et est persisté côté serveur avec la commande de création ; l'horloge et le compteur ne sont jamais contrôlés par le téléphone après déclenchement.
- Le seuil porte sur les occurrences de rappels push planifiées après la notification initiale ; la notification initiale ne compte pas comme un rappel.
- Après le nombre choisi de rappels, si aucun destinataire initial n'a pris la responsabilité principale, le serveur peut créer les tâches SMS de secours pour les destinataires de l'instantané initial.
- Un accusé de réception, une ouverture de notification ou une candidature volontaire sans attribution de responsabilité ne suffit pas à empêcher l'escalade SMS.
- Dès qu'un responsable principal est effectivement attribué, l'escalade SMS non encore engagée est annulée. Les SMS déjà acceptés par un fournisseur peuvent néanmoins arriver.
- Le nombre de rappels doit être validé côté serveur dans une plage produit explicitement définie avant implémentation. Aucune plage numérique n'est approuvée par cette section.

### 12.3 Destinataires et clôture

- L'escalade SMS ne peut viser que les destinataires de l'instantané initial ; aucun contact supplémentaire n'est ajouté.
- Les rappels push restent indépendants de l'accusé de réception et de la prise en charge, et suivent la règle existante jusqu'à clôture par l'auteur.
- La clôture par l'auteur annule les rappels et tâches push/SMS non encore envoyés.
- Une tâche déjà acceptée par un fournisseur peut encore être livrée après clôture ou prise en charge ; l'interface doit l'indiquer sans prétendre pouvoir la rappeler.

### 12.4 État et preuves de livraison

Le backend doit distinguer au minimum : occurrence push planifiée ; tentative push effectuée ; notification acceptée par le fournisseur ; livraison confirmée si le canal fournit une preuve fiable ; accusé de réception déclaré par le contact ; responsabilité principale effectivement attribuée ; seuil SMS atteint ; tâche SMS créée, acceptée, livrée si preuve disponible, échouée ou résultat ambigu.

Aucun état « proche prévenu » ne peut être déduit d'une simple tentative ou acceptation fournisseur. Une absence de prise en charge n'est pas une preuve que le téléphone n'a pas reçu le push.

### 12.5 Préconditions techniques

Avant activation, il faut prouver : compteur durable et idempotent, concurrence entre scheduler et attribution du responsable, annulation conditionnelle des tâches SMS, déduplication/réconciliation fournisseur, limites de coût, rétention des tentatives et tests D1/Preview isolés. Aucun fournisseur, scheduler, worker, numéro SMS ou envoi réel n'est créé par ce contrat.


## 13. Récupération de compte et de racine — contrats conceptuels, non routes implémentées

**Statut :** exigences de sécurité proposées ; hors périmètre d'implémentation de ce contrat. Aucun endpoint, fournisseur d'authentification, facteur OTP, e-mail ou mécanisme de support n'est créé ici.

### 13.1 Séparation obligatoire des autorités

Le contrat doit distinguer :
1. l'authentification et la récupération d'accès au compte ;
2. la preuve de possession d'une clé d'appareil ;
3. l'autorité de la clé racine ;
4. la vérification indépendante de la nouvelle empreinte par chaque contact pour le partage GPS.

Une session authentifiée peut autoriser une demande de récupération, mais ne prouve jamais la possession de l'ancienne clé racine. La récupération du mot de passe, l'OTP, la session d'un appareil secondaire ou l'assistance ne doivent pas modifier directement la clé publique racine ni son époque.

### 13.2 Commandes conceptuelles à spécifier avant toute route

Les opérations ci-dessous sont des noms de domaine indicatifs, pas des chemins API approuvés :
- demander la récupération du compte ;
- déclarer la perte, le vol/suspicion de compromission, la panne ou le remplacement ;
- demander la révocation de l'appareil racine ;
- créer une demande de récupération cryptographique ;
- enregistrer la preuve de possession de la nouvelle racine ;
- enregistrer la vérification indépendante d'une empreinte par un contact ;
- finaliser ou refuser la transition racine.

Chaque commande devra contrôler côté serveur l'acteur authentifié, la session et l'appareil exacts, l'état courant du compte, l'époque racine attendue, les autorisations, l'expiration, l'idempotence, le débit et la concurrence. Les décisions finales doivent être prises dans une transaction atomique ou un mécanisme de sérialisation équivalent.

### 13.3 États de domaine proposés

- recovery_requested
- recovery_pending_review
- root_reestablished
- recovery_refused
- recovery_expired
- recovery_cancelled

Ces états ne sont pas des rôles ni des preuves de vérification humaine. root_reestablished n'implique pas que tous les contacts ont vérifié la nouvelle empreinte ; l'autorisation GPS reste évaluée par relation/contact.

### 13.4 Invariants serveur

- Une demande active par compte et par époque racine ; une répétition avec la même clé d'idempotence retourne le résultat existant.
- Toute transition compare l'époque racine attendue ; une demande périmée ne peut pas remplacer une racine plus récente.
- La création de la nouvelle racine et la révocation de l'ancienne sont atomiques : jamais deux racines actives pour la même époque.
- Un appareil secondaire peut initier une demande, mais ne peut jamais s'auto-promouvoir ni signer au nom de la racine.
- Une racine révoquée est refusée même si son jeton signé n'a pas expiré.
- Une cérémonie finale revérifie le statut actif de l'appareil, la révocation, l'expiration, le défi à usage unique, la version et l'époque.
- Une révocation qui commit avant une approbation fait échouer cette approbation ; une mutation validée avant révocation reste dans l'historique.
- Un timeout après commit doit être résolu par lecture de l'état de la demande ; le client ne crée pas une seconde racine à l'aveugle.
- Les notifications sont produites après commit et ne constituent jamais une preuve de livraison, de possession ou de vérification.
- Les événements sont append-only et séquencés côté serveur ; aucun secret, clé privée, jeton, OTP, transcript sensible ou GPS ne figure dans les logs.

### 13.5 Accès pendant root_recovery_required

Les opérations dépendant de la racine sont refusées : approbation d'appareils, rotation normale signée par l'ancienne racine et création/reprise de partage GPS. Les sessions secondaires encore actives peuvent continuer les fonctions indépendantes de la racine, selon leur propre autorisation. La liste exacte de ces fonctions reste à arbitrer ; aucune promotion secondaire n'est autorisée.

### 13.6 Préconditions avant conception détaillée des routes

- mécanisme d'authentification forte et de récupération d'accès choisi et évalué ;
- preuve de possession et cérémonie de création de nouvelle racine spécifiées ;
- politique de vérification indépendante des contacts et gestion des refus/absences décidées ;
- modèle de menace couvrant vol, hameçonnage, support abusif, appareil secondaire compromis et serveur compromis ;
- tests de concurrence et d'idempotence définis ;
- revue cryptographique indépendante réalisée.

Tant que ces conditions ne sont pas remplies, les contrats restent documentaires. Aucune route Pages Functions, migration D1, file d'attente ou notification réelle ne doit être ajoutée.


## 14. Contrôles conceptuels anti-fraude pour l'authentification — non routes implémentées

**Statut :** exigences proposées, à arbitrer et tester avant conception des routes. Aucun fournisseur SMS/e-mail, système anti-fraude ou mécanisme de détection SIM swap n'est intégré.

### 14.1 Contrat des défis OTP et liens de récupération

Tout défi d'authentification ou de récupération devra être :
- lié côté serveur à un compte, une finalité, une demande et un canal ;
- à usage unique, consommé atomiquement ;
- limité dans le temps, avec durée décidée avant implémentation ;
- protégé par des limites atomiques de tentatives, de renvois et de création ;
- stocké sous forme de vérificateur non réutilisable ; les OTP de faible entropie nécessitent un secret serveur de protection contre les attaques hors ligne ;
- invalidé après succès ou selon la règle de remplacement définie ;
- exclu des logs, analytics, traces, notifications et tickets support sous forme de code ou lien complet.

Les réponses externes ne doivent pas révéler si un compte, un numéro ou un e-mail existe. Le texte et le comportement des erreurs doivent être cohérents entre compte existant et inexistant.

### 14.2 Changement de numéro et SIM swap

Un OTP SMS ne prouve que la réception momentanée d'un message par le demandeur. Il ne prouve ni l'identité de la personne, ni la possession de l'ancienne racine, ni l'intégrité du téléphone. SAC ne peut prétendre détecter un SIM swap sans signal opérateur ou fournisseur réellement disponible et validé.

Le changement du numéro de récupération est une opération sensible séparée. Le nouveau numéro ne doit pas devenir immédiatement un facteur suffisant pour changer la racine ou reprendre le GPS. La notification à l'ancien canal et un délai de protection sont proposés, mais leurs modalités restent à décider.

### 14.3 Sessions et jetons

- Les sessions sont liées à un appareil et contrôlées côté serveur.
- Les jetons de renouvellement doivent être rotatifs et leur rejeu détectable.
- Un jeton d'un appareil révoqué est refusé même s'il n'a pas expiré.
- La récupération de mot de passe ne réactive jamais un appareil révoqué.
- Une simple révocation d'appareil ne révoque pas les autres appareils.
- L'effet d'une récupération de mot de passe sur les sessions existantes doit être défini explicitement ; aucun comportement implicite ne doit être codé.

### 14.4 Limites et disponibilité

Les limites doivent être atomiques et adaptées à chaque opération (OTP, renvoi, invitation, récupération, changement de numéro). Elles peuvent combiner compte, destination, appareil et signaux réseau ; une adresse IP seule ne doit pas être une base suffisante pour bloquer tous les utilisateurs d'un réseau partagé.

Les limites de récupération ne doivent pas devenir un verrouillage générique du SOS. Un SOS provenant d'une session valide ne doit pas être bloqué silencieusement par une limite OTP, un changement d'IP ou un signal de risque non confirmé. Une session réellement révoquée doit toutefois être refusée honnêtement.

### 14.5 Support et journalisation

Le support ne reçoit jamais de mot de passe, OTP, clé privée, jeton ou QR complet. Il ne peut pas modifier la racine, réactiver un certificat révoqué ni marquer une empreinte comme vérifiée. Toute action support sensible devra être autorisée, limitée, justifiée, séparée des rôles techniques et auditée.

Les événements de sécurité sont minimisés et append-only ; ils ne contiennent aucun secret, code, lien complet, clé privée, donnée GPS ni contenu d'alerte non nécessaire. Les durées de conservation et les rôles habilités restent à valider.

### 14.6 Invariants à tester

- OTP ou lien expiré, consommé, rejoué, détourné vers une autre finalité ou présenté en concurrence : refus.
- SIM swap ou contrôle du numéro seul : aucune récupération racine.
- Réinitialisation de mot de passe : aucune mutation de racine ou de clé GPS.
- Jeton de renouvellement rejoué : détection et réaction définie sur la famille concernée.
- Session appareil révoqué : refus côté serveur.
- Réponses de récupération : aucune énumération de compte.
- Support : aucune opération de substitution de racine.
- IP partagée ou réseau mobile changeant : pas de blocage global arbitraire.
- Limite OTP : pas de blocage silencieux d'un SOS valide.
- Changement de numéro : aucune autorité racine implicite.

Ces contrats restent documentaires jusqu'à validation des facteurs, seuils, durées, recours, fournisseur et modèle de menace. Aucun endpoint ni migration D1 n'est créé.
## Annexe — Changement sécurisé des coordonnées du compte (18 novembre 2026)

**Statut :** contrat documentaire proposé ; aucun endpoint, fournisseur ou schéma D1 n'est autorisé par cette annexe.

### A. Séparer les rôles des coordonnées

SAC doit distinguer dans son modèle logique, même si certaines valeurs sont identiques :
- l'identifiant de connexion du compte ;
- le numéro de téléphone vérifié ;
- l'adresse e-mail vérifiée ;
- les canaux autorisés pour la récupération d'accès ;
- les canaux de notification ;
- les coordonnées éventuellement visibles par les contacts, selon une règle de confidentialité distincte.

Une coordonnée ne reçoit pas automatiquement tous ces rôles. Le fait de vérifier un numéro ou une adresse e-mail ne lui confère pas un pouvoir de récupération racine. Le changement d'une coordonnée ne change ni l'identifiant interne immuable du compte, ni l'identité cryptographique racine, ni l'identité des appareils.

### B. Règle de preuve

Un code envoyé à une nouvelle destination prouve uniquement le contrôle ponctuel de cette destination. Il ne prouve :
- ni la continuité avec l'ancien titulaire d'un numéro réattribué ;
- ni la maîtrise de l'ancienne boîte e-mail ;
- ni l'identité historique du compte ;
- ni la possession de l'appareil racine ou de sa clé privée ;
- ni le droit d'approuver un nouvel appareil ou une nouvelle empreinte.

Aucun OTP SMS/e-mail, mot de passe réinitialisé ou intervention du support ne peut remplacer la racine cryptographique.

### C. Parcours conceptuels

1. **Changement volontaire, ancien canal encore disponible :** l'utilisateur authentifié demande le changement, confirme le nouveau canal, puis accomplit une preuve renforcée liée à une session/appareil déjà approuvé. Une notification de sécurité minimale peut être envoyée à l'ancien canal seulement si celui-ci est encore considéré sûr. L'ancien canal ne reçoit jamais le nouveau code ni un lien qui permettrait à lui seul de prendre le compte.
2. **Ancienne SIM perdue ou numéro devenu inaccessible :** aucun code n'est envoyé à l'ancien numéro comme condition impossible à satisfaire. La vérification du nouveau numéro reste nécessaire mais insuffisante. La continuité doit être établie par une session/appareil approuvé et une preuve forte indépendante du nouveau numéro, selon un facteur à arbitrer.
3. **Ancienne adresse e-mail perdue :** même principe ; le nouveau courriel est vérifié comme canal, mais ne prouve pas la continuité du compte. La voie de secours doit reposer sur une preuve indépendante préalablement approuvée.
4. **Ancien canal suspecté compromis :** ne pas lui envoyer de détail de sécurité ni lui accorder un droit de contestation privilégié. L'utilisateur doit pouvoir signaler le risque depuis un appareil/session sûr ; une vérification renforcée et une éventuelle révocation ciblée sont à définir.
5. **Perte simultanée du numéro et de l'e-mail :** aucun cumul de deux nouveaux OTP ne constitue une preuve suffisante. Sans appareil approuvé ou procédure de récupération forte déjà validée, le changement reste bloqué et suit la procédure de récupération de compte/racine, sans raccourci.
6. **Demande depuis une session ou un appareil suspect :** une session active n'est pas à elle seule une preuve de sécurité. L'état courant de l'appareil, sa révocation, l'époque de racine et les signaux de risque doivent être revérifiés côté serveur au moment de la validation finale.

### D. Activation et confidentialité

- Le nouveau canal reste « en attente de vérification » jusqu'à validation complète ; il ne reçoit aucune donnée privée ou notification de récupération avant activation.
- L'ancien canal ne reste pas une destination de notification indéfinie après remplacement. Dès que le changement est effectif, il est désactivé pour les usages retirés ; aucune donnée d'alerte future ne doit lui être envoyée.
- La notification de sécurité à l'ancien canal, si sûr, reste neutre : elle signale qu'une modification a eu lieu et indique un moyen de signaler une opération non reconnue, sans révéler les nouvelles coordonnées, les alertes, les contacts ou la localisation.
- Les contacts de confiance ne reçoivent pas automatiquement la nouvelle coordonnée privée. Sa visibilité éventuelle est une préférence distincte, explicite et révocable.
- Les invitations en attente adressées à une ancienne coordonnée ne sont ni transférées ni acceptées automatiquement vers la nouvelle. Elles doivent être annulées ou réémises avec vérification explicite.
- Les relations déjà acceptées restent liées aux identifiants de compte immuables. Le changement de canal ne transfère pas une relation à une autre personne et ne modifie pas l'empreinte de clé d'identité approuvée.
- Si l'identité racine change lors d'une récupération, les règles existantes de nouvelle empreinte et de vérification indépendante par les contacts s'appliquent séparément.

### E. Sessions, alertes et données existantes

- Le changement de numéro/e-mail ne modifie pas l'auteur, les destinataires figés, l'historique ni l'état d'une alerte en cours.
- Il ne modifie pas rétroactivement l'instantané des destinataires, les rappels push ou les tâches d'escalade SMS d'une alerte.
- Il ne réactive jamais un appareil révoqué et ne révoque pas implicitement tous les autres appareils.
- Le comportement des sessions déjà ouvertes doit être déterminé par une politique explicite de révocation ciblée ; aucune déconnexion globale arbitraire n'est présumée.
- Toute session utilisée pour une opération de changement doit être revalidée à la validation finale. Un appareil révoqué entre-temps ne peut pas terminer la demande.
- Les changements de coordonnées ne restaurent ni ne rendent accessibles les données GPS expirées.

### F. Concurrence et anti-rejeu

- Les changements de coordonnées sont sérialisés au niveau du compte et protégés par une version de coordonnées/une précondition de version.
- Un challenge est lié au compte, à la coordonnée exacte, au type d'opération, à la demande et à son contexte ; il est à usage unique.
- Deux demandes concurrentes ne peuvent pas chacune devenir la coordonnée principale. Une demande devenue obsolète est refusée et doit être recommencée.
- Un challenge consommé, expiré, annulé ou lié à une ancienne demande ne peut être réutilisé.
- Une contestation valide reçue avant le commit final peut suspendre la demande selon une procédure à définir ; après commit, elle déclenche une procédure de sécurité distincte, sans rollback silencieux.
- La vérification finale doit relire atomiquement l'état du compte, de la session, de l'appareil, de la racine, du challenge et de la version de coordonnées.
- Les opérations répétées avec la même clé d'idempotence et le même contenu retournent le résultat stable ; une clé réutilisée avec un contenu différent est refusée.
- Si une récupération racine est en cours, les modifications qui changent les canaux d'authentification/récupération sont bloquées, sauf parcours de récupération explicitement validé.

### G. Points non décidés

Aucune durée arbitraire n'est fixée ici. Restent à arbitrer : facteur fort de continuité si l'ancien canal est perdu ; délai de sécurité ; période de contestation ; critères de risque ; portée de révocation des sessions ; nombre de coordonnées vérifiées ; ordre de priorité entre numéro et e-mail ; gestion d'un numéro recyclé ; traitement des changements pendant une alerte active ; et fonctions autorisées pendant une récupération racine.

**NO-GO :** aucun parcours de changement de coordonnées ne doit être implémenté avant arbitrage de ces points, tests de concurrence et validation du contrat de récupération.


## Annexe — Politique OTP à priorité e-mail (18 novembre 2026)

**Statut :** décision produit validée ; politique documentaire uniquement. Aucun fournisseur, endpoint, secret, modèle D1 ou flux réel n'est créé.

### Canal retenu

- L'e-mail est le canal standard d'envoi des codes OTP SAC.
- Cette règle couvre la vérification initiale de l'adresse, les vérifications supplémentaires à la connexion, la réinitialisation du mot de passe, les changements de coordonnées et les procédures de récupération d'accès au compte, lorsque le parcours concerné exige un OTP.
- Pour un changement d'adresse e-mail, la preuve de contrôle de la nouvelle adresse peut être faite par un code envoyé à cette nouvelle adresse ; cette preuve ne suffit pas à autoriser le changement du compte. La demande doit aussi satisfaire la preuve de continuité exigée depuis une session/appareil déjà approuvé ou une procédure forte validée.
- Aucun OTP standard n'est envoyé par SMS. Le SMS reste un canal distinct réservé à l'escalade d'une alerte SOS selon le contrat de notifications, et non un canal de remplacement des OTP.
- Aucun basculement automatique vers SMS n'est permis en cas d'échec, retard, indisponibilité ou perte d'accès à l'e-mail. Une éventuelle voie exceptionnelle devra faire l'objet d'une décision explicite et d'une preuve indépendante.

### Limites de preuve

- Un OTP e-mail prouve uniquement le contrôle ponctuel de la boîte destinataire ; il ne prouve ni l'identité historique, ni la possession de l'ancienne racine, ni l'approbation d'un appareil.
- La récupération d'accès au compte par e-mail ne rétablit jamais l'identité cryptographique racine, ne réactive aucun appareil révoqué et ne restaure aucune clé GPS.
- La perte de l'adresse e-mail vérifiée ne peut pas être contournée en envoyant un code à une nouvelle adresse. Le nouveau canal doit être vérifié, mais la continuité du compte exige une preuve indépendante préalablement approuvée ou la procédure de récupération forte validée.
- La perte simultanée des canaux ne se résout pas par deux OTP reçus sur de nouvelles coordonnées.
- Le déclenchement d'un SOS ne doit pas dépendre de la réception d'un OTP par e-mail ; les contrôles de session et le parcours d'urgence restent séparés.

### Exigences opérationnelles avant toute implémentation

- Définir durée, tentatives, renvois, usage unique, invalidation et limites anti-abus propres à chaque finalité.
- Protéger les OTP de faible entropie par un vérificateur adapté avec secret serveur/HMAC ou mécanisme équivalent ; ne jamais stocker les codes en clair.
- Prévoir des réponses uniformes contre l'énumération, une délivrabilité vérifiable et un traitement des résultats fournisseur ambigus.
- Définir une expérience explicite lorsque l'utilisateur n'a plus accès à sa boîte e-mail ; ne pas inventer de secours SMS.
- Aucun fournisseur e-mail n'est choisi à ce stade. Coût, délivrabilité, disponibilité et protection des données devront être comparés avant intégration.

**Verrou :** cette décision ne vaut pas autorisation d'implémenter un fournisseur ou un parcours OTP. Les facteurs de continuité, délais, limites, sessions et recours restent à spécifier ; aucune récupération racine ne peut reposer sur l'e-mail seul.
