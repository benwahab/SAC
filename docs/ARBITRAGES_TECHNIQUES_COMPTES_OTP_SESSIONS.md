# SAC — Arbitrages techniques proposés pour comptes, OTP et sessions

**Date :** 18 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche unique `main`  
**Statut :** mode de connexion A et durées de session validés par l'utilisateur le 18 novembre 2026 ; les valeurs techniques et fournisseurs encore ouverts restent des recommandations ou des points bloquants.  
**Portée :** inscription, connexion, vérification e-mail, sessions web PWA et préparation des appareils natifs.

## 1. Règle de lecture

Ce document distingue :
- **Déjà validé :** règle explicitement décidée et présente dans les références SAC.
- **Recommandation :** valeur proposée pour avancer vers une conception cohérente ; elle nécessite confirmation avant migration ou code.
- **Bloquant :** aucun choix technique ne doit être fait silencieusement.

Le canal OTP du compte est l'e-mail. Aucun SMS OTP ni mécanisme de secours SMS n'est autorisé. L'OTP ne prouve que le contrôle temporaire de l'adresse e-mail : il ne valide jamais une identité cryptographique racine et n'approuve jamais un appareil secondaire.

## 2. Registre d'arbitrage

| Sujet | État | Recommandation / règle |
|---|---|---|
| Canal de vérification | Déjà validé | E-mail uniquement ; SMS réservé à l'escalade SOS. |
| Révélation d'un compte existant | Recommandation | Réponse publique identique pour inscription et connexion, sans confirmer l'existence d'une adresse. |
| Durée OTP | Recommandation | 10 minutes maximum, calculées par l'heure serveur. |
| Essais OTP | Recommandation | 6 essais maximum par défi ; consommation atomique au premier succès ; aucun rejeu. |
| Renvoi OTP | Recommandation | Délai minimal de 60 secondes ; nouveau défi invalide immédiatement le précédent pour la même finalité et identité. |
| Limites d'envoi | Recommandation | Limites combinées par identité, compte, appareil et fenêtres temporelles ; ne jamais dépendre uniquement de l'IP, qui change fréquemment sur les réseaux mobiles. Seuils précis à calibrer avec le fournisseur et les abus observés. |
| OTP en base | Déjà validé | Jamais de code brut. Un simple hash non salé d'un code court est insuffisant. |
| État d'envoi | Recommandation | Distinguer créé, envoi demandé, accepté par fournisseur, échec certain, résultat ambigu, consommé, expiré et invalidé. Un timeout fournisseur ne signifie pas que le message n'a pas été envoyé. |
| Sessions PWA | Recommandation | Identifiant opaque aléatoire d'au moins 256 bits ; cookie Secure, HttpOnly, SameSite=Lax ou Strict selon le parcours ; protection CSRF et vérification Origin sur les mutations. |
| Stockage session | Déjà validé | Jamais de jeton brut en D1, localStorage, URL, logs ou erreurs. Conserver uniquement une empreinte cryptographique adaptée. |
| Durée session | Recommandation | 30 jours consécutifs sans activité entraînent la déconnexion automatique ; 90 jours constituent la durée absolue maximale, même en cas d'utilisation régulière. Réauthentification renforcée pour les actions sensibles. Durées validées par l'utilisateur le 18 novembre 2026. |
| Rotation | Recommandation | Rotation du jeton de renouvellement à chaque renouvellement ; détection de réutilisation d'un ancien jeton et révocation de la famille concernée. |
| Révocation | Déjà validé | Vérifier l'état de la session, du compte, de l'appareil et sa auth_version côté serveur ; une révocation doit être effective à la requête suivante. |
| Réseau/IP | Déjà validé | Un changement d'adresse IP ou de réseau ne bloque jamais à lui seul un utilisateur. |
| Capacitor | Bloquant avant natif | Spécification séparée du stockage sécurisé natif, des jetons et de leur rotation. Ne pas réutiliser automatiquement le modèle cookie web. |
| Fournisseur e-mail | Bloquant | Aucun fournisseur n'est choisi. Aucun envoi réel ni secret fournisseur avant validation distincte. |
| Mode de connexion | Validé le 18-11-2026 | Option A : adresse e-mail + mot de passe. L'OTP e-mail vérifie l'adresse à l'inscription, sécurise certaines opérations et permet la réinitialisation du mot de passe ; il n'est pas requis à chaque connexion par défaut. |
| Appareil racine | Bloquant | Le certificat secondaire actuel est expérimental et ne lie pas encore défi serveur, nonce, identifiant de cérémonie et expiration dans un transcript signé canonique. |
| Kit de récupération | Bloquant | Le secret est généré localement, affiché une seule fois et à usage unique. Le protocole de preuve doit faire l'objet d'une spécification cryptographique et d'une revue indépendante avant code. |

## 3. Parcours compte recommandé

### 3.1 Inscription

1. Le client soumet l'adresse e-mail et les informations strictement nécessaires.
2. Le serveur normalise l'adresse selon une règle unique, versionnée et testée.
3. Le serveur répond avec un message générique identique, que l'adresse soit nouvelle ou déjà associée à un compte.
4. Pour une nouvelle identité, le serveur crée un défi OTP et demande l'envoi au fournisseur.
5. Le compte reste non actif tant que la vérification n'est pas confirmée côté serveur.
6. À validation, l'identité e-mail est marquée vérifiée et le compte devient actif selon la transition atomique retenue.
7. Aucun appareil secondaire, aucune racine cryptographique et aucune permission GPS ne sont créés implicitement par la vérification e-mail.

### 3.2 Connexion

Le mode de preuve principal validé est l'adresse e-mail + mot de passe. L'OTP e-mail n'est pas demandé à chaque connexion par défaut. Quel que soit le parcours :
- les réponses ne révèlent pas si l'adresse existe ;
- les tentatives et envois sont limités ;
- le serveur vérifie le compte et l'appareil avant d'émettre une session ;
- l'e-mail vérifié ne suffit pas à approuver un appareil secondaire ;
- aucune session n'est créée après un résultat fournisseur ambigu ou un défi non consommé.

### 3.3 Changement d'adresse e-mail

- Réauthentification récente obligatoire.
- Vérification de la nouvelle adresse avant qu'elle devienne principale.
- Ancienne adresse conservée comme identité principale jusqu'à confirmation, sauf procédure de récupération distincte.
- Notification de sécurité aux canaux déjà vérifiés lorsque cela est possible.
- Un changement d'e-mail ne modifie ni la racine cryptographique ni les contacts de confiance.

## 4. Sessions web PWA

La recommandation est une session opaque gérée côté serveur plutôt qu'un JWT autonome de longue durée.

- Générer un secret aléatoire cryptographiquement sûr côté serveur.
- N'envoyer le secret qu'au navigateur dans un cookie `Secure; HttpOnly`.
- Choisir `SameSite=Lax` ou `Strict` après vérification des parcours de navigation ; protéger les requêtes mutantes contre CSRF et contrôler l'origine.
- En D1, stocker uniquement le hash du secret, le compte, l'appareil, les dates, l'état et la version d'autorisation.
- Comparer expiration et état à l'heure serveur.
- Vérifier compte + appareil + session + `auth_version` sur chaque requête protégée ; aucun cache positif d'autorisation à ce stade.
- Ne pas lier rigidement la session à l'IP ou à une empreinte navigateur fragile.
- Ne jamais placer un secret de session dans le JavaScript accessible, les paramètres URL ou le stockage local persistant.

Les durées validées sont de 30 jours consécutifs sans activité et de 90 jours absolus au maximum, même en cas d'utilisation régulière.

## 5. OTP : garanties minimales

Le fournisseur doit être derrière un adaptateur indépendant. Le domaine métier ne doit pas dépendre de son SDK.

- Défi aléatoire avec identifiant opaque ; finalité liée à signup, login, changement d'identité ou récupération.
- Le code n'est jamais journalisé ni persisté en clair.
- La vérification et la consommation sont atomiques : un seul succès possible.
- Un défi expiré, consommé, remplacé ou invalidé ne peut plus réussir.
- Les limites s'appliquent à plusieurs dimensions, sans verrouillage permanent du compte ni blocage fondé uniquement sur l'IP.
- Les réponses publiques restent non énumérantes.
- Un timeout, une erreur réseau ou une réponse incomplète du fournisseur est un état ambigu : ne pas annoncer « envoyé » ou « non envoyé » sans preuve.
- Les métriques et journaux ne contiennent ni code, ni jeton, ni adresse complète inutile, ni contenu du message.

## 6. Appareils et racine cryptographique

La vérification e-mail, la session de compte et la confiance cryptographique doivent rester trois contrôles distincts.

Avant toute activation de jumelage secondaire, exiger :
1. transcript canonique versionné couvrant compte, appareil racine, nouvel appareil, clés publiques, défi, nonce, cérémonie, usages et expiration ;
2. signature de l'intégralité du transcript par la racine déjà ancrée indépendamment ;
3. validation effective des JWK ECDH P-256 par import WebCrypto, y compris rejet du point `(0,0)` ;
4. défi à usage unique, lié au compte et aux deux appareils, consommé atomiquement ;
5. protection anti-rejeu et tests adversariaux ;
6. revue cryptographique indépendante.

Le certificat secondaire présent dans le dépôt ne satisfait pas encore ces conditions. Il reste expérimental ; aucune API d'approbation ne doit l'utiliser.

## 7. Kit de récupération

Règles déjà validées :
- génération locale ;
- affichage unique ;
- usage unique ;
- aucun secret brut transmis ou stocké en clair côté serveur ;
- récupération de l'accès au compte uniquement, jamais restauration de la racine cryptographique.

Bloquant technique : ne pas choisir un simple hash d'un code humain court. La spécification doit déterminer l'entropie, le format imprimable, le mécanisme de preuve de possession, la résistance au rejeu, la consommation atomique et la gestion des tentatives. Le mécanisme sera relu indépendamment avant son implémentation.

Après récupération, si tous les appareils approuvés ont été perdus, une nouvelle racine doit être créée et les contacts doivent réancrer indépendamment son empreinte avant tout nouveau partage GPS.

## 8. Écarts à corriger avant le schéma SQL

L'audit du code a révélé un écart entre les états documentés et le contrat pur `src/domain/account-lifecycle.ts` :
- le contrat pur accepte actuellement `active`, `deletion_pending` et `deleted` ;
- le plan de compte évoque aussi un état d'inscription en attente et un compte suspendu ;
- il faut décider si ces états appartiennent au cycle du compte, à celui de l'identité ou à un mécanisme de sécurité séparé, puis aligner contrat, tests et schéma avant migration.

Autres contraintes :
- ne pas imposer une contrainte « un appareil racine actif » avant validation du protocole racine ;
- ne pas confondre session applicative SAC et sessions de cohérence D1 ;
- ne pas supposer qu'un batch D1 transforme une mise à jour de zéro ligne en erreur : les préconditions métier doivent être exprimées et testées explicitement dans le SQL ;
- les opérations sensibles doivent revalider l'autorisation dans l'écriture finale, pas seulement lors d'une lecture préalable.

## 9. Décisions utilisateur encore nécessaires

Les points suivants restent à confirmer explicitement :
1. **Clos :** connexion par adresse e-mail + mot de passe (option A). OTP e-mail pour vérification initiale, opérations sensibles définies et réinitialisation ; pas d'OTP systématique à chaque connexion.
2. **Clos :** durée des sessions : déconnexion après 30 jours consécutifs sans activité et réauthentification obligatoire au plus tard à 90 jours, même si le compte est utilisé régulièrement (validation utilisateur du 18-11-2026).
3. Seuils définitifs de renvoi et de limitation OTP après choix du fournisseur.
4. Choix du fournisseur e-mail et autorisation de le configurer.
5. Validation du parcours de changement d'adresse e-mail.
6. Validation du protocole cryptographique de récupération après revue indépendante.
7. Validation d'un protocole multi-appareils corrigé après revue indépendante.

Aucun SQL, code d'authentification, secret, fournisseur, ressource Cloudflare ou déploiement ne doit être créé sur la seule base de ces recommandations.

## 10. Prochaine séquence contrôlée

1. Conserver les décisions utilisateur validées ; faire arbitrer les choix encore ouverts.
2. Écrire une spécification cryptographique indépendante pour le kit de récupération et le jumelage.
3. Corriger les contrats purs et leurs tests pour refléter les états de compte retenus.
4. Produire un schéma D1 minimal avec contraintes et opérations atomiques documentées.
5. Faire une revue de sécurité du schéma et des tests d'intégration D1.
6. Demander une autorisation distincte avant toute migration ou route métier.

---
**Conclusion :** le mode de connexion e-mail + mot de passe est validé. Le socle compte/session peut être conçu sans fournisseur e-mail et sans activer la racine. En revanche, le SQL définitif et les parcours réels doivent attendre la clôture des décisions bloquantes ci-dessus.


## 11. Politique de mot de passe — proposition technique

**Statut : minimum de 12 caractères validé par l'utilisateur le 18 novembre 2026 ; les autres règles ci-dessous restent des recommandations techniques à valider.**

Pour le mode de connexion e-mail + mot de passe validé :
- **Longueur minimale validée par l'utilisateur le 18 novembre 2026 : 12 caractères.** Longueur maximale acceptée : au moins **128 caractères**, sans troncature silencieuse.
- Autoriser phrases de passe, espaces et Unicode ; ne pas imposer de règles artificielles de composition.
- Refuser les mots de passe manifestement communs ou compromis ; ne pas transmettre le mot de passe en clair à un service tiers.
- Ne pas imposer de changement périodique sans indice de compromission.
- Autoriser collage, gestionnaires de mots de passe et outils d'accessibilité.
- Messages de connexion génériques, sans révéler si l'adresse existe.

### Stockage et vérification
- Aucun mot de passe brut, réversible ou journalisé.
- Hachage lent, salé, paramétré par compte ; stocker algorithme et paramètres pour permettre leur évolution.
- Choisir un algorithme réellement compatible avec le runtime Cloudflare Workers et le valider par benchmark. Ne pas utiliser SHA-256 simple ni importer une bibliothèque native non compatible.
- N'ajouter un pepper que si son stockage et sa rotation hors D1 sont réellement opérationnels.
- Calibrer le coût de calcul et limiter les tentatives avant les opérations coûteuses.
- Aucun secret d'authentification dans les logs, traces ou analytics.

### Réinitialisation et changement
- Réinitialisation uniquement après un défi OTP e-mail valide, unique et non expiré.
- Réponse publique générique ; aucun indice sur l'existence d'un compte.
- Après changement ou réinitialisation, incrémenter la version d'autorisation et révoquer toutes les sessions ; reconnexion obligatoire.
- Notification de sécurité à l'adresse vérifiée, sans mot de passe.
- L'OTP ne peut ni approuver un appareil ni restaurer la racine cryptographique.

## 12. Sessions PWA — proposition de paramètres

**Statut : durées validées par l'utilisateur le 18 novembre 2026 ; les autres paramètres restent des recommandations à valider.**

| Paramètre | Règle validée / proposition |
|---|---|
| Inactivité maximale | **30 jours consécutifs sans activité : déconnexion automatique** |
| Durée absolue maximale | **90 jours : reconnexion obligatoire, même avec une utilisation régulière** |
| Cookie | `Secure; HttpOnly; SameSite=Lax`, chemin `/`, sans `Domain` si possible |
| Transport | HTTPS uniquement ; HSTS après vérification du domaine |
| CSRF | Jeton lié à la session et contrôle strict de `Origin` sur les mutations |
| Rotation | Rotation du jeton opaque au renouvellement et après réauthentification |
| Réutilisation d'un ancien jeton | Révoquer la famille de renouvellement et exiger une reconnexion |
| Révocation | Effet à la requête protégée suivante, vérifié côté serveur |
| Changement du mot de passe | Révoquer toutes les sessions et imposer une reconnexion |
| Déconnexion | Révocation serveur immédiate, puis suppression du cookie |

Conditions :
1. Jeton opaque généré par CSPRNG, entropie d'au moins 256 bits.
2. D1 ne conserve que l'empreinte du jeton, jamais le secret brut.
3. Expiration, révocation, version d'autorisation et rotation vérifiées atomiquement.
4. Ne pas lier l'identité à l'IP ou à une empreinte navigateur fragile.
5. Aucun jeton dans `localStorage`, `sessionStorage`, URL ou état React persistant.
6. Ne pas réutiliser automatiquement la session PWA dans Capacitor ; le natif exige un stockage sécurisé et un protocole distinct.
7. Configurer les attributs du cookie après confirmation du domaine et des flux de navigation ; ne pas les affaiblir pour contourner un problème de déploiement.

## 13. Tests obligatoires avant activation

- mots de passe longs, Unicode, espaces et caractères combinés ;
- absence de secrets dans D1, logs, erreurs, traces et analytics ;
- attaques par dictionnaire et tentatives répétées, sans verrouillage permanent exploitable ;
- OTP expiré, rejoué, remplacé, consommé deux fois en concurrence et résultat fournisseur ambigu ;
- fixation de session, CSRF, origine non autorisée, cookie absent ou altéré ;
- session expirée, révoquée, renouvelée et rejeu d'un ancien jeton ;
- révocation après changement/réinitialisation du mot de passe ;
- changement d'adresse e-mail et rejeu de défi ;
- changement d'IP/réseau mobile sans déconnexion injustifiée ;
- récupération du compte sans restauration de la racine ;
- essai Android PWA réel et réseau faible.

Aucun parcours n'est opérationnel avant vérification des tests automatisés, des tests D1 et des essais sur appareils.


## 12. Cycle de vie du compte — décision validée le 18 novembre 2026

Les cinq états fonctionnels suivants sont validés :

1. **En attente de vérification** (`pending_verification`) : inscription créée, adresse e-mail principale non vérifiée ; aucune fonction privée ni session utilisateur.
2. **Actif** (`active`) : adresse principale vérifiée ; accès selon les permissions, la session et l'état de l'appareil.
3. **Suspendu** (`suspended`) : connexion et nouvelles activités bloquées ; sessions révoquées ; données conservées.
4. **Suppression en attente** (`deletion_pending`) : aucune nouvelle activité ; les alertes/trajets déjà engagés doivent être traités avant suppression définitive.
5. **Supprimé** (`deleted`) : état terminal, sans connexion, restauration ni réactivation de l'ancien compte.

L'état de vérification de l'adresse e-mail est distinct de l'état du compte. Il ne constitue pas un sixième état. Le compte devient actif seulement après confirmation serveur de la vérification requise.

### Règles de suspension validées

- Seul le Super Admin peut imposer une suspension administrative.
- Un blocage automatique de sécurité visant une tentative ou une session à risque reste un mécanisme distinct et ne change pas, à lui seul, l'état administratif du compte.
- La suspension administrative conserve une trace de l'auteur, du motif, de la date, de l'éventuelle échéance et de la décision de réactivation.
- Elle révoque les sessions existantes, interdit les nouvelles connexions et les nouvelles activités, mais ne supprime pas les données.

### Point non arbitré : alerte déjà active

La suspension ne clôture ni n'annule automatiquement une alerte SOS déjà transmise. La manière dont le titulaire suspendu peut consulter, compléter ou clôturer une alerte en cours reste à décider. Les contacts et le système doivent pouvoir poursuivre le traitement déjà engagé selon le contrat SOS. Aucun accès général de contournement ne sera créé sans décision explicite.

### Suppression

La suppression en attente bloque les nouvelles activités. La suppression définitive attend la clôture des alertes/trajets déjà engagés et le respect des obligations de conservation applicables. L'état supprimé est terminal ; une nouvelle inscription éventuelle crée un nouveau compte.

### Écart technique et portée

Cette décision résout l'arbitrage produit sur les cinq états, mais ne modifie pas encore le contrat pur `src/domain/account-lifecycle.ts`, qui ne reconnaît actuellement que trois états. L'alignement du contrat et des tests doit faire l'objet d'une modification de code autorisée séparément. Le schéma D1, les routes d'authentification, les sessions actives et les ressources Cloudflare restent hors périmètre de cette mise à jour documentaire.

**Mise à jour du registre :** l'ancien point « décider si les états d'inscription en attente et de suspension appartiennent au cycle du compte » est clos. Les paramètres OTP, le fournisseur e-mail, le changement d'adresse, la récupération cryptographique et le jumelage multi-appareils restent ouverts.


## 13. Décision validée — alerte SOS déjà active pendant une suspension

**Statut : principe produit validé par l'utilisateur le 18 novembre 2026 ; détails de clôture et garde-fous anti-abus encore ouverts.** Cette validation documentaire n'autorise aucune implémentation.

La suspension ne doit pas annuler ni interrompre une alerte déjà transmise. Les destinataires initiaux continueraient à recevoir les rappels toutes les 5 minutes jusqu'à clôture, sans ajout automatique de contacts. Les actions de réception et de prise en charge restent disponibles ; le premier contact qui choisit « Je prends la situation en charge » devient responsable principal, les autres pouvant intervenir.

Pour le titulaire suspendu, le principe d'une capacité cryptographique d'urgence liée à une seule alerte et à l'appareil d'origine, distincte de toute session de compte, est validé. Elle sera limitée à la consultation de l'état minimal de cette alerte, à la transmission d'une mise à jour de sécurité et à la transmission d'une demande de clôture à l'administration SAC pour cette seule alerte. Le titulaire suspendu ne peut pas clôturer l'alerte. Le protocole et ses contrôles restent à spécifier. Aucun accès au compte, aux proches, aux paramètres, aux autres alertes, à la création d'une nouvelle alerte ou à la modification des destinataires ne serait permis. Chaque action serait vérifiée côté serveur, limitée à cette alerte, journalisée et anti-rejeu.

La clôture appartient exclusivement à l'administration SAC. Ni le titulaire suspendu ni les proches, y compris le responsable principal, ne peuvent clôturer l'alerte. Un proche peut signaler que la situation est terminée et demander une clôture administrative ; la décision et l'action de clôture restent réservées à l'administration SAC.

Points encore ouverts : procédure de vérification des informations, profil administratif habilité, conditions de décision et notifications ; garde-fous et conservation des éléments de preuve en cas de suspension pour abus lié à l'alerte. Le nombre de validations est tranché : un seul administrateur SAC habilité peut décider et clôturer ; aucune seconde validation n'est obligatoire.

### Vérification avant clôture — règle validée

L'administrateur consulte la référence et le statut de l'alerte, le signalement du responsable principal, les accusés de réception, les prises en charge et les dernières informations des proches. Il vérifie qu'aucun élément récent ne signale un danger persistant et applique les contrôles renforcés en cas de suspicion d'abus lié à l'alerte. Une seule décision d'un administrateur habilité suffit si la fin du danger est suffisamment confirmée.

Un signalement indiquant que le danger persiste, des informations contradictoires ou des informations insuffisantes empêchent la clôture tant que les vérifications ne sont pas concluantes. Si le responsable principal est injoignable, l'administration peut consulter les autres proches ; cette indisponibilité ne vaut pas confirmation. Le silence ou l'absence de réponse d'un proche ne constitue jamais une preuve de sécurité. Tant que la fin du danger ne peut pas être vérifiée, l'alerte reste active et les rappels continuent toutes les 5 minutes vers les seuls destinataires initiaux, sans ajout automatique.

La décision, son motif, l'administrateur et l'horodatage doivent être conservés dans la trace d'audit.

### Garde-fou validé contre l'abus de clôture

La distinction suivante est validée :

- Le titulaire suspendu peut toujours transmettre une **mise à jour de sécurité** indiquant qu'il est en sécurité. Cette action est horodatée et auditée, mais ne clôture pas l'alerte et n'efface aucun événement antérieur.
- Une **demande ou confirmation de clôture** du titulaire suspendu ne suffit pas, à elle seule, à clôturer automatiquement une alerte lorsque la suspension est liée à un abus potentiel sur cette alerte. Des contrôles supplémentaires côté serveur sont obligatoires avant toute clôture.
- Aucun événement, accusé de réception, prise en charge ou élément d'audit ne peut être supprimé ou réécrit par cette capacité. La continuité de l'assistance des contacts doit être préservée.

Les critères de déclenchement du contrôle renforcé, la procédure administrative de clôture et les notifications restent à spécifier. L'autorité finale est toutefois tranchée : administration SAC uniquement, avec une seule validation par un administrateur habilité ; aucune double validation n'est exigée. Cette décision ne crée aucune permission opérationnelle ni route API.

Règles validées : la suspension ne ferme ni n'annule l'alerte ; les rappels continuent toutes les 5 minutes vers les seuls destinataires initiaux, sans ajout automatique ; les actions de réception et de prise en charge restent disponibles ; la capacité du titulaire est limitée à l'alerte concernée et ne rétablit aucun accès général. La révocation générale des sessions reste immédiate.

Cette décision reste documentaire : aucune route API, permission serveur, capacité cryptographique opérationnelle, modification de session, migration D1 ou modification du code n'est autorisée à ce stade.


## Procédure de vérification administrative d'une alerte suspendue — décision validée le 18 novembre 2026

Pour une alerte SOS déjà transmise alors que le compte initiateur est suspendu, et lorsqu'un risque d'abus sur cette alerte est envisagé, la clôture est exclusivement administrative. Avant de décider, l'administration identifie l'alerte et son appareil d'origine, consulte les accusés de réception, interventions, mises à jour et signalements des contacts, puis tente si possible de joindre directement le titulaire. La réponse du titulaire est un élément à examiner, jamais une clôture automatique.

Les informations contradictoires ou insuffisantes, tout indice récent de danger persistant, ou l'impossibilité de vérifier la fin du danger imposent le maintien de l'alerte et des rappels aux seuls destinataires initiaux. Le silence d'un proche ou du titulaire ne constitue jamais une preuve de sécurité. Un proche peut signaler que la situation semble terminée et demander une clôture, mais ne peut pas l'exécuter. Seul un administrateur SAC habilité clôture ; un seul administrateur suffit, sans double validation obligatoire.

Cette décision ne vaut pas spécification technique ni autorisation de créer une API, une permission, une session spéciale ou une migration D1.


## Habilitation administrative de clôture — décision validée le 18 novembre 2026

Pour le cas précis d'une alerte SOS déjà transmise pendant la suspension du compte initiateur et présentant un risque d'abus, le Super Admin peut clôturer après vérification. Un administrateur sécurité ne peut le faire que si le Super Admin lui a attribué explicitement la permission dédiée ; aucun droit n'est accordé par défaut. Le support, l'auditeur, les proches et le titulaire suspendu n'ont pas ce droit.

La permission de clôture est indépendante des autres permissions. Seul le Super Admin peut l'attribuer, la modifier, la suspendre ou la retirer. Le délégataire ne peut ni déléguer ni transmettre son autorité. Une seule personne habilitée suffit, sans double validation.

Chaque clôture conserve une trace d'audit : identité de l'administrateur, référence de l'alerte, date/heure, motif et éléments vérifiés. L'espace d'administration est réservé à l'ordinateur et à la tablette ; l'accès administratif sur téléphone n'est pas prévu. Cette décision ne met en œuvre aucun rôle ou contrôle d'accès et n'autorise aucune migration D1.


## Séquence de contact du titulaire avant clôture — décision documentaire du 18 novembre 2026

Pour le scénario précis d'une alerte déjà transmise pendant la suspension du compte initiateur, l'administrateur habilité tente d'abord une notification privée via SAC. Si un numéro vérifié est disponible, il effectue jusqu'à trois appels : immédiatement, puis environ cinq minutes après, puis cinq minutes après le deuxième appel. Un message écrit privé est envoyé en complément par un canal de contact vérifié disponible. Il ne faut pas exposer les détails sensibles de l'alerte à un tiers.

Chaque tentative est journalisée avec date/heure, canal, résultat objectif et identité de l'administrateur. Un appel sans réponse, un message vocal, un échec technique ou un simple accusé d'envoi ne vaut pas réponse du titulaire. Si aucun canal direct n'est disponible ou si le titulaire ne répond pas, l'impossibilité est consignée et l'examen se poursuit avec les autres éléments fiables.

La séquence d'appels représente environ dix minutes entre la première et la troisième tentative ; ce n'est ni un délai maximal de danger ni une échéance de clôture. L'absence de réponse ne prouve jamais la sécurité et ne permet jamais une clôture automatique. Si la fin du danger demeure insuffisamment vérifiée ou si les informations sont contradictoires, l'alerte reste active et les rappels continuent aux seuls destinataires initiaux. Une réponse du titulaire reste un élément à examiner ; seul l'administrateur habilité décide de la clôture selon la procédure validée.

Cette règle ne présume pas qu'un numéro soit collecté, ne crée aucun canal ni envoi effectif et n'autorise aucune implémentation ou migration D1.
