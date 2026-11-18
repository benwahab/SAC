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

L'adresse e-mail est obligatoire pour toute inscription SAC et constitue une condition sine qua non de l'activation du compte. Le compte ne peut pas être créé/activé par téléphone seul ni par une voie de contournement. L'activation exige la saisie correcte d'un OTP envoyé à cette adresse. Le téléphone reste obligatoire comme coordonnée déclarée, mais ne remplace jamais l'e-mail. Aucun SMS OTP ni mécanisme de secours SMS n'est autorisé pour l'inscription ou l'activation du compte. L'OTP e-mail ne prouve que le contrôle temporaire de l'adresse : il ne valide jamais une identité cryptographique racine et n'approuve jamais un appareil secondaire.

## 2. Registre d'arbitrage

| Sujet | État | Recommandation / règle |
|---|---|---|
| Canal de vérification initiale | Décision confirmée le 18-11-2026 | Adresse e-mail obligatoire ; activation uniquement après OTP e-mail valide. Aucun compte sans e-mail, aucune activation par téléphone seul et aucun SMS OTP de compte. SMS réservé aux usages SOS déjà prévus. |
| Révélation d'un compte existant | Recommandation | Réponse publique identique pour inscription et connexion, sans confirmer l'existence d'une adresse. |
| Durée OTP | **Validé le 18-11-2026** | **10 minutes maximum**, calculées par l'heure serveur. |
| Essais OTP | **Validé le 18-11-2026** | **6 tentatives maximum par défi** ; consommation atomique au premier succès ; aucun rejeu. |
| Renvoi OTP | **Validé le 18-11-2026** | **60 secondes minimum** entre deux demandes ; tout nouveau défi invalide immédiatement le précédent pour la même finalité et identité. |
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
| Fournisseur e-mail | Choisi, configuration bloquée | Resend est le fournisseur retenu ; domaine vérifié, compte fournisseur et secret restent à configurer avant tout envoi réel. |
| Mode de connexion | Validé le 18-11-2026 | Option A : adresse e-mail + mot de passe. L'OTP e-mail vérifie l'adresse à l'inscription, sécurise certaines opérations et permet la réinitialisation du mot de passe ; il n'est pas requis à chaque connexion par défaut. |
| Appareil racine | Bloquant | Le certificat secondaire actuel est expérimental et ne lie pas encore défi serveur, nonce, identifiant de cérémonie et expiration dans un transcript signé canonique. |
| Kit de récupération | Bloquant | Le secret est généré localement, affiché une seule fois et à usage unique. Le protocole de preuve doit faire l'objet d'une spécification cryptographique et d'une revue indépendante avant code. |

## 3. Parcours compte recommandé

### 3.1 Inscription

1. L'adresse e-mail est obligatoire : le client soumet une adresse e-mail et les informations strictement nécessaires. Une inscription sans adresse e-mail n'est pas proposée et ne peut pas être finalisée.
2. Le serveur normalise l'adresse selon une règle unique, versionnée et testée.
3. Le serveur répond avec un message générique identique, que l'adresse soit nouvelle ou déjà associée à un compte.
4. Pour une nouvelle identité, le serveur crée un défi OTP et demande l'envoi au fournisseur.
5. Le compte reste `pending_verification` tant que la vérification OTP e-mail n'est pas confirmée côté serveur ; aucun accès privé ni session utilisateur n'est possible.
6. À validation, l'identité e-mail est marquée vérifiée et le compte peut passer à `active` selon la transition atomique retenue. Cette vérification est une condition obligatoire, non une option.
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
3. **Clos le 18-11-2026 :** durée 10 minutes, maximum 6 tentatives, renvoi après 60 secondes et invalidation immédiate de l'ancien défi.
4. Configuration effective de Resend après disponibilité d'un domaine d'envoi vérifié et autorisation de configurer les secrets.
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

Pour le scénario précis d'une alerte déjà transmise pendant la suspension du compte initiateur, l'administrateur habilité tente d'abord une notification privée via SAC. Si le numéro déclaré est disponible, il effectue jusqu'à trois appels : immédiatement, puis environ cinq minutes après, puis cinq minutes après le deuxième appel. Un message écrit privé est envoyé en complément par un canal de contact disponible. Il ne faut pas exposer les détails sensibles de l'alerte à un tiers.

Chaque tentative est journalisée avec date/heure, canal, résultat objectif et identité de l'administrateur. Un appel sans réponse, un message vocal, un échec technique ou un simple accusé d'envoi ne vaut pas réponse du titulaire. Si aucun canal direct n'est disponible ou si le titulaire ne répond pas, l'impossibilité est consignée et l'examen se poursuit avec les autres éléments fiables.

La séquence d'appels représente environ dix minutes entre la première et la troisième tentative ; ce n'est ni un délai maximal de danger ni une échéance de clôture. L'absence de réponse ne prouve jamais la sécurité et ne permet jamais une clôture automatique. Si la fin du danger demeure insuffisamment vérifiée ou si les informations sont contradictoires, l'alerte reste active et les rappels continuent aux seuls destinataires initiaux. Une réponse du titulaire reste un élément à examiner ; seul l'administrateur habilité décide de la clôture selon la procédure validée.

Cette règle ne présume pas qu'un numéro soit collecté, ne crée aucun canal ni envoi effectif et n'autorise aucune implémentation ou migration D1.


## Numéro de téléphone obligatoire à l'inscription — décision validée le 18 novembre 2026

Chaque utilisateur doit obligatoirement fournir un numéro de téléphone lors de la création de son compte SAC ; le compte ne peut pas être créé si ce champ est absent. Le numéro est conservé avec son indicatif international.

La collecte obligatoire ne vaut pas vérification du numéro. La méthode de vérification, ainsi que les règles de changement et de mise à jour, restent à définir. La décision déjà prise de ne pas utiliser de SMS OTP pour l'authentification des comptes reste en vigueur : aucun SMS OTP ni mécanisme de vérification par SMS n'est autorisé implicitement.

Le numéro déclaré peut être utilisé comme coordonnée de contact dans la procédure administrative de clôture sans vérification téléphonique indépendante. Une réponse provenant de ce numéro ne prouve pas à elle seule l'identité de l'interlocuteur et doit être appréciée et recoupée. Le silence ne constitue jamais une preuve de sécurité et ne permet aucune clôture automatique.

Décision documentaire uniquement : aucun champ, validation, envoi SMS, service externe, endpoint ou migration D1 n'est implémenté ici.


## Vérification du compte par OTP e-mail uniquement — clarification validée le 18 novembre 2026

L'adresse e-mail est obligatoire dès l'inscription et constitue une condition sine qua non de l'activation. Aucun compte SAC ne peut être créé ou activé sans adresse e-mail ; le téléphone seul ne constitue jamais une voie d'inscription ou de remplacement. La vérification initiale est effectuée par OTP envoyé à cette adresse. La saisie correcte de cet OTP valide l'adresse e-mail et est indispensable pour que le compte puisse passer de `pending_verification` à `active`.

Le numéro de téléphone demeure obligatoire à l'inscription, mais ne fait l'objet d'aucune vérification indépendante : aucun SMS OTP, appel automatisé de validation ou autre procédure de preuve de propriété. Cette règle ne dispense jamais de fournir et vérifier l'adresse e-mail obligatoire. Le numéro déclaré peut être utilisé comme coordonnée de contact, y compris pour les tentatives d'appel de l'administration. Une réponse reçue depuis ce numéro ne prouve cependant pas à elle seule l'identité de l'interlocuteur et doit être appréciée et recoupée dans le contexte de l'alerte. Le silence ne constitue jamais une preuve de sécurité.

Cette clarification remplace toute exigence antérieure de vérification du numéro avant son utilisation comme coordonnée de contact. Aucun SMS OTP n'est autorisé pour l'inscription, la vérification ou l'activation d'un compte SAC.


## Notification des destinataires après clôture administrative

Après la clôture par un administrateur SAC habilité, chaque destinataire initial reçoit une notification individuelle via les canaux SAC disponibles et activés. Le message indique que l'alerte concernée a été clôturée par l'administration, avec date et heure, sans divulguer les échanges privés, les éléments d'enquête, les notes internes ou les coordonnées d'autres personnes.

La clôture arrête les rappels de cette alerte pour tous les destinataires initiaux. L'historique des accusés de réception, interventions, mises à jour et autres événements est conservé sans suppression ni réécriture. Les échecs de notification sont journalisés et visibles de l'administration ; ils ne réouvrent pas automatiquement l'alerte. La notification n'accorde aucun droit de clôture aux proches.

Règle documentaire uniquement : aucun service de notification, push, e-mail, SMS, endpoint ou migration D1 n'est implémenté.

## 14. Sécurité de l'administration et traçabilité — cadre documentaire du 18 novembre 2026

Les règles de gouvernance confirmées sont les suivantes : le Super Admin est seul habilité à créer, attribuer, modifier, suspendre et retirer les délégations et missions. Un délégataire ne peut pas déléguer, attribuer des tâches à autrui, modifier ses propres droits ou étendre son périmètre. La permission de clôture administrative dans le scénario spécifique d'une alerte déjà transmise pendant la suspension du compte initiateur est séparée des autres droits : Super Admin, ou administrateur sécurité explicitement habilité par le Super Admin ; aucun droit par défaut ; support, auditeur, proches et titulaire suspendu exclus. Une seule personne habilitée suffit. L'espace administratif est réservé à l'ordinateur et à la tablette.

Le contrôle d'accès doit être appliqué côté serveur pour chaque action, et non déduit de l'affichage de l'interface. Le serveur reconstruit l'identité, le rôle, la permission et le périmètre à partir de la session et des données d'autorité persistées. Toute permission absente, périmètre invalide, délégation suspendue ou session révoquée entraîne un refus. Les valeurs de rôle ou de permission envoyées par le client ne sont jamais fiables. Les droits de lecture, modification, suspension, délégation, export et clôture sont séparés. Les délégataires ne peuvent jamais s'auto-attribuer des droits ni en transmettre.

Le journal de sécurité et d'administration doit être append-only. Une entrée validée ne peut être modifiée ou supprimée par aucun profil administratif ; une correction produit un nouvel événement lié à l'entrée initiale. Les événements comprennent au minimum l'acteur, le rôle et la permission effectifs, l'action, la cible et son périmètre, le résultat, l'heure UTC serveur, un identifiant de corrélation et le motif des décisions sensibles. Les valeurs avant/après sont référencées ou empreintées lorsque cela est pertinent, sans copier les secrets.

Le journal couvre notamment les délégations et changements de droits, refus d'accès et tentatives d'élévation, consultations sensibles, suspensions, décisions de clôture, vérifications et résultats de notification. Il ne contient jamais de mot de passe, OTP, jeton brut, clé privée, secret de récupération, contenu intégral de message privé ou GPS précis. L'accès au journal est en lecture seule et limité aux profils autorisés ; les consultations et exports sont eux-mêmes audités.

L'intégrité doit être détectable et vérifiable. Le chaînage cryptographique et/ou un stockage à rétention verrouillée sont des pistes à évaluer, pas des garanties acquises. Le mécanisme doit être choisi après examen des capacités réelles de D1 et des options de stockage, puis soumis à revue indépendante. La durée de conservation, la purge, la base légale et le traitement des traces après suppression d'un compte restent à arbitrer ; aucune durée n'est inventée.

**Proposition non encore approuvée :** exiger une réauthentification ou un OTP e-mail récent pour certaines opérations critiques (attribution/retrait d'une délégation, permission de clôture, clôture d'alerte, export massif). Définir aussi une politique de session administrative plus stricte que la seule règle générale 30 jours d'inactivité / 90 jours maximum. Ces mesures restent des recommandations à arbitrer.

Aucune implémentation n'est autorisée par cette section : aucun rôle ou droit opérationnel, middleware, endpoint, table ou migration D1, journal effectif, ressource Cloudflare ou écran administratif n'est créé. Le modèle détaillé, les tests négatifs, l'intégrité, la conservation et la revue de sécurité précèdent toute autorisation de code.


## 15. Modèle des rôles, permissions et missions — 18 novembre 2026

Trois notions sont séparées : le rôle décrit une fonction générale ; la permission autorise une action précise sur une ressource et un périmètre ; la mission est une délégation personnelle et encadrée, accordée par le Super Admin pour un objectif, une liste de permissions, un périmètre et une période. Aucun droit ne découle implicitement d'une équipe, d'une URL ou de la simple existence d'un compte administratif.

| Rôle | Cadre retenu |
|---|---|
| Super Admin | Autorité suprême ; seul à créer, attribuer, modifier, suspendre, reprendre, révoquer ou terminer les délégations et missions. Ses actions sont auditées. |
| Administrateur sécurité | Aucun pouvoir de délégation. Droits supplémentaires uniquement sur attribution explicite du Super Admin. La permission spéciale de clôture d'alerte doit être attribuée séparément et nominativement. |
| Support | Assistance limitée aux informations et opérations explicitement autorisées ; aucun droit de délégation, d'attribution de permissions, de clôture d'alerte ou d'effacement des traces. |
| Auditeur | Lecture seule dans un périmètre autorisé ; aucun droit de modification, suspension, délégation, clôture ou suppression. Consultation et export sont séparés et tracés. |

Le catalogue distingue les permissions de consultation, assistance, sécurité, gestion des comptes, délégations, clôture administrative, audit/export et configuration. Les actions consulter, créer, modifier, suspendre, révoquer, clôturer et exporter constituent des droits distincts. Le rôle seul ne suffit pas à les accorder.

Chaque mission doit identifier le délégataire, son objectif, les permissions exactes, le périmètre des ressources, les limites et interdictions, la date de début et de fin (ou une absence d'échéance exceptionnelle à réexaminer), les conditions de suspension/révocation et le motif de décision du Super Admin. Elle est personnelle, non transférable et non sous-délégable. Le délégataire ne peut pas inviter un autre administrateur, attribuer des droits ou étendre sa mission. Il peut seulement demander au Super Admin une extension ou une nouvelle délégation.

À chaque requête, le serveur vérifie l'état du compte et de la session, l'acteur, l'existence et l'état de la mission, la permission précise, le périmètre de la ressource, les éventuelles révocations et les conditions de l'action. Le refus par défaut s'applique. Aucun héritage automatique entre rôles, équipes, utilisateurs ou missions ; aucun cumul ne doit créer un accès global. En cas de conflit, la règle la plus restrictive prévaut.

Cycle de vie de conception : brouillon non actif, active, suspendue, expirée, révoquée, terminée. Seul le Super Admin gère ces transitions ; elles sont auditées. Une modification n'élargit pas rétroactivement les droits ; les événements passés gardent le contexte effectif au moment de l'action. La révocation est appliquée côté serveur sans attendre le rafraîchissement de l'interface.

La clôture administrative d'une alerte dans le scénario spécial demeure une permission distincte, nominative, non transférable et attribuée uniquement par le Super Admin à lui-même ou à un administrateur sécurité explicitement habilité. Support, auditeur, proches et titulaire suspendu en sont exclus. Une seule personne habilitée suffit, sans double validation.

Restent à spécifier avant implémentation : catalogue exhaustif des ressources/actions, périmètres disponibles et combinaisons, données visibles par Support, vues et exports de l'Auditeur, durées par défaut et renouvellement des missions, suspension d'urgence et effets sur sessions ouvertes, conflits et demandes d'extension. En attendant, aucun droit supplémentaire n'est implicite.

Aucune implémentation n'est créée par ce document : aucun rôle actif, compte, droit, mission, écran, endpoint, middleware ou schéma/migration D1. Une matrice exhaustive testable, une revue sécurité et une autorisation explicite sont nécessaires avant le code.



## Gouvernance opérationnelle des missions administratives

Le cycle de vie, les transitions autorisées, la suspension d'urgence, la révocation immédiate côté serveur, les conflits de missions, les contrôles d'export et les tests de sécurité sont spécifiés dans [GOUVERNANCE_MISSIONS_ADMIN_ET_CYCLE_DE_VIE.md](GOUVERNANCE_MISSIONS_ADMIN_ET_CYCLE_DE_VIE.md).

Les durées maximales proposées (30 jours standard, 7 jours sensible), la revue mensuelle, les alertes d'échéance et l'OTP e-mail récent pour opérations critiques restent explicitement à valider. La règle de session générale 30 jours d'inactivité / 90 jours maximum reste inchangée. Aucun code ou schéma n'est créé.


## 16. Politique OTP e-mail — décisions validées le 18 novembre 2026

Les paramètres suivants sont des décisions utilisateur validées et remplacent les recommandations antérieures :

- **Validité :** 10 minutes maximum à partir de la création du défi, selon l'horloge UTC du serveur.
- **Tentatives :** 6 tentatives de vérification maximum pour un défi. À la sixième tentative échouée, le défi est épuisé et ne peut plus être présenté.
- **Renvoi :** attendre au moins 60 secondes entre deux demandes d'envoi pour la même identité et la même finalité.
- **Remplacement :** dès qu'un nouveau défi est créé pour la même identité et la même finalité, le précédent est immédiatement invalidé ; il ne peut plus être accepté, même s'il n'a pas expiré.

Les quatre règles sont indépendantes des quotas anti-abus globaux. Les seuils supplémentaires par compte, adresse IP, appareil et fenêtre temporelle ne sont pas définis par cette validation et ne doivent pas être inventés.

La validation doit utiliser l'heure serveur. L'épuisement, l'expiration, la consommation et l'invalidation sont des états terminaux pour un défi. Une vérification réussie et sa consommation doivent être atomiques afin d'empêcher deux succès concurrents.

Le contrat pur `src/domain/email-otp-policy.ts` encode les durées, le nombre d'essais, les états consommé/invalide/expiré et le délai de renvoi. Les tests correspondants sont dans `tests/email-otp-policy.test.ts` et exécutés par la CI. Ce contrat pur ne constitue pas encore une persistance D1, un endpoint, un générateur de code, un mécanisme de hachage/HMAC, un envoi réel ni une activation de compte.

**Statut :** paramètres métier validés ; contrat pur, schéma D1 versionné et premiers endpoints serveur implémentés. L'application distante et les tests sur le runtime D1 Cloudflare restent à faire.


## 17. Contrat de validation des données d'inscription

Le contrat pur `src/domain/registration-policy.ts` et ses tests définissent les contrôles d'entrée suivants, avant toute écriture D1 :

- **E-mail :** suppression des espaces périphériques, normalisation en minuscules, contrôle de longueur et de structure. Aucune transformation spécifique à un fournisseur (suppression des points ou des suffixes `+`) n'est effectuée.
- **Téléphone :** indicatif international obligatoire sous forme `+` suivie de 8 à 15 chiffres au format E.164. Les espaces, parenthèses, points et tirets de présentation sont retirés. Un numéro local sans indicatif est refusé.
- **Mot de passe :** application de la règle déjà validée (minimum 12 points de code Unicode). La valeur n'est jamais rognée ni normalisée : espaces et Unicode sont conservés exactement.
- **Langue :** seules les valeurs `fr`, `en` et `ar` sont acceptées.

Ce validateur ne prouve pas la propriété de l'adresse e-mail ou du téléphone. Le parcours serveur crée le compte en attente et conserve le téléphone comme identité déclarée/non vérifiée ; seule la validation du défi e-mail autorise l'activation du compte. Le hachage du mot de passe est exécuté côté serveur avant persistance.

La validation des e-mails internationaux/IDN devra être complétée si SAC décide de les accepter ; le contrat actuel prend en charge les domaines ASCII (les domaines internationalisés doivent être présentés sous forme IDNA/Punycode). Le format E.164 est la représentation canonique persistée prévue.

**Statut :** contrat d'entrée codé et testé ; utilisé par les routes serveur d'inscription, de renvoi et de vérification.


## 18. Format et primitives cryptographiques du code OTP e-mail

**Décision validée par l'utilisateur : code numérique de 6 chiffres.**

Le contrat OTP retient désormais :
- 6 chiffres décimaux, zéros initiaux autorisés ;
- durée de validité de 10 minutes ;
- 6 tentatives maximum par défi ;
- renvoi après 60 secondes minimum ;
- tout nouveau défi invalide immédiatement le précédent.

Le module serveur `functions/lib/security/email-otp-code.ts` :
- génère le code avec `crypto.getRandomValues` ;
- utilise un échantillonnage par rejet pour éviter le biais de modulo ;
- calcule une empreinte HMAC-SHA-256 liée à l'identifiant unique du défi et à son usage ;
- vérifie le code avec `SubtleCrypto.verify` plutôt qu'une comparaison applicative de chaînes ;
- refuse de calculer l'empreinte si le secret serveur n'est pas configuré ou trop court ;
- ne persiste ni ne journalise le code brut.

Le secret HMAC doit être un secret Cloudflare aléatoire d'au moins 32 caractères, distinct de D1. Il n'est pas créé ni configuré par le code du dépôt. La rotation et le versionnement du secret devront être conçus avant activation réelle.

**Statut :** primitives utilisées par les routes serveur et le schéma D1 versionné. La configuration des secrets et du fournisseur reste absente ; aucune migration distante n'a été appliquée.


## 19. Première tranche serveur : inscription et vérification e-mail

### Schéma D1 versionné

La migration `migrations/0001_account_email_otp.sql` crée :
- `accounts` avec les cinq états déjà validés ;
- `account_identities` pour les adresses e-mail et téléphones, avec unicité par canal et identité principale ;
- `email_otp_challenges` avec empreinte HMAC, compteur, maximum, création, expiration, consommation et invalidation ;
- des clés étrangères composites liant chaque défi à l'identité du même compte.

Les horodatages de ces tables sont des millisecondes Unix UTC. Le téléphone est enregistré avec `verified_at = NULL` et n'est jamais utilisé pour activer le compte.

### Garanties SQL

Les triggers de la migration :
1. refusent un défi si le compte n'est pas en attente ou si la cible n'est pas l'adresse e-mail principale non vérifiée ;
2. refusent un nouveau défi avant 60 secondes ;
3. invalident le défi précédent dans la même transaction que l'insertion du nouveau ;
4. rendent immuables l'identité, l'empreinte et les paramètres du défi ;
5. n'autorisent qu'une transition de tentative à la fois, avec incrément exact de un ;
6. épuisent le défi à la sixième tentative échouée ;
7. empêchent la modification silencieuse des identités et toute vérification téléphonique dans ce parcours ;
8. interdisent l'activation d'un compte ou la vérification d'une adresse sans défi OTP consommé ;
9. lors d'une consommation correcte, vérifient l'adresse et activent le compte dans les triggers de la même instruction SQLite.

Le endpoint de vérification réalise une seule instruction `UPDATE ... RETURNING` conditionnelle. Deux vérifications concurrentes du même défi ne peuvent donc pas le consommer deux fois. Les erreurs de code, d'expiration, de consommation et d'invalidation ne révèlent pas le code attendu.

### Routes créées

- `POST /api/auth/register` : valide les entrées, hache le mot de passe, crée le compte `pending_verification`, les identités et le premier défi, puis demande l'envoi par Resend.
- `POST /api/auth/resend-email` : crée un nouveau défi seulement pour un compte en attente ; le trigger D1 applique le délai de 60 secondes et invalide l'ancien défi.
- `POST /api/auth/verify-email` : vérifie et consomme le défi, puis active le compte par trigger D1.

Aucune route ne crée de session. L'activation du compte ne vaut ni approbation d'un appareil secondaire ni restauration d'une racine cryptographique.

### Mot de passe

`functions/lib/security/password-hash.ts` utilise PBKDF2-HMAC-SHA-256 avec 600 000 itérations et un sel aléatoire unique de 16 octets. La clé dérivée sert à produire un vérificateur HMAC de contexte ; ni mot de passe ni clé dérivée ne sont persistés. Le format stocké contient l'algorithme, le coût, le sel et le vérificateur.

Ce choix utilise WebCrypto natif des Workers et doit encore faire l'objet d'une mesure de latence sur le runtime Cloudflare ainsi que d'une revue sécurité indépendante. OWASP recommande Argon2id en premier choix et indique PBKDF2-HMAC-SHA-256 à 600 000 itérations dans les contextes où PBKDF2/FIPS est requis : https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html.

### Tests et limites

- `tests/d1_email_otp_schema.test.py` exécute la migration réelle avec SQLite et teste le cooldown, l'invalidation, l'épuisement, l'activation atomique et les contraintes d'identité.
- Les tests unitaires du générateur OTP, du HMAC, du hachage et des politiques sont ajoutés à la CI.
- Ces tests SQLite ne remplacent pas encore les tests d'intégration sur le runtime D1 Cloudflare ni les tests de concurrence Preview isolés.
- Les limites globales anti-abus par IP, compte et appareil ne sont pas définies ; aucune valeur supplémentaire n'a été inventée.
- Le secret `EMAIL_OTP_HMAC_SECRET`, `RESEND_API_KEY` et `RESEND_FROM_EMAIL` ne sont pas configurés. Sans eux, les routes échouent fermées et aucun e-mail n'est prétendu envoyé.
- La migration est versionnée mais n'a pas été appliquée à la base distante `sac-db`.
- Aucun login, cookie de session, appareil racine ou accès privé n'est encore créé par ce lot.
