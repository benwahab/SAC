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
