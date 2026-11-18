# SAC — Arbitrages techniques proposés pour comptes, OTP et sessions

**Date :** 18 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche unique `main`  
**Statut :** mode de connexion A validé par l'utilisateur le 18 novembre 2026 ; les valeurs techniques et fournisseurs encore ouverts restent des recommandations ou des points bloquants.  
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
| Durée session | Recommandation | 30 jours d'inactivité et 90 jours de durée absolue au maximum ; réauthentification renforcée pour les actions sensibles. Ces durées restent à confirmer. |
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

Les durées proposées (30 jours d'inactivité, 90 jours absolus) sont des valeurs de départ à confirmer, pas des décisions déjà validées.

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
2. Durées proposées des sessions : 30 jours d'inactivité / 90 jours absolus.
3. Seuils définitifs de renvoi et de limitation OTP après choix du fournisseur.
4. Choix du fournisseur e-mail et autorisation de le configurer.
5. Validation du parcours de changement d'adresse e-mail.
6. Validation du protocole cryptographique de récupération après revue indépendante.
7. Validation d'un protocole multi-appareils corrigé après revue indépendante.

Aucun SQL, code d'authentification, secret, fournisseur, ressource Cloudflare ou déploiement ne doit être créé sur la seule base de ces recommandations.

## 10. Prochaine séquence contrôlée

1. Faire valider les choix utilisateur listés ci-dessus.
2. Écrire une spécification cryptographique indépendante pour le kit de récupération et le jumelage.
3. Corriger les contrats purs et leurs tests pour refléter les états de compte retenus.
4. Produire un schéma D1 minimal avec contraintes et opérations atomiques documentées.
5. Faire une revue de sécurité du schéma et des tests d'intégration D1.
6. Demander une autorisation distincte avant toute migration ou route métier.

---
**Conclusion :** le mode de connexion e-mail + mot de passe est validé. Le socle compte/session peut être conçu sans fournisseur e-mail et sans activer la racine. En revanche, le SQL définitif et les parcours réels doivent attendre la clôture des décisions bloquantes ci-dessus.
