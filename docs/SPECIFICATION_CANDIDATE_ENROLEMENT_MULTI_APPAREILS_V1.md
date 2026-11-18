# SAC — Spécification consolidée candidate : enrôlement multi-appareils V1

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** spécification de travail consolidée — non homologuée, non implémentée.  
**Portée :** enrôlement d'un appareil secondaire sous l'autorité de l'appareil racine unique. Ce document ne permet aucune activation réelle, création de session, migration D1, ressource Cloudflare ou utilisation GPS.

## 1. Hiérarchie et décisions fermées

Ce document rassemble les exigences communes de `PROTOCOLE_MULTI_APPAREILS.md`, `TRANSCRIPT_CEREMONIE_MULTI_APPAREILS.md`, `REVUE_COHERENCE_PROTOCOLE_MULTI_APPAREILS.md` et `CONSOLIDATION_APPAREILS_SESSIONS_ET_RECUPERATION.md`.

Décisions produit déjà validées :
- Un compte possède un seul appareil racine actif en V1.
- Seul cet appareil racine, s'il est encore actif et non révoqué, peut approuver un nouvel appareil secondaire.
- Un appareil secondaire ne peut ni s'approuver lui-même, ni approuver un autre appareil, ni devenir racine.
- La perte ou la révocation de la racine ne transfère jamais son autorité à un secondaire.
- Le remplacement/récupération de racine est interdit en V1.
- Mot de passe, OTP e-mail/SMS, changement de coordonnées, support ou session secondaire ne remplacent jamais une preuve cryptographique racine.

Ces règles d'autorité sont fermées. Les détails cryptographiques ci-dessous restent soumis à arbitrage et revue indépendante.

## 2. Objectifs de sécurité obligatoires

L'enrôlement doit démontrer simultanément :
1. l'autorisation explicite de la demande par la racine actuellement enregistrée ;
2. la possession effective par le nouvel appareil de chaque clé privée correspondant aux clés publiques proposées ;
3. l'accord des deux appareils sur les mêmes octets exacts du transcript ;
4. la fraîcheur de la demande et du défi serveur, leur liaison au compte et aux appareils, et leur consommation unique ;
5. la validité de l'état compte/racine/demande au moment précis du commit serveur ;
6. l'absence de double activation en cas de concurrence, de rejeu ou de perte réseau.

Un appareil en attente n'accède à aucune donnée privée et ne possède aucune capacité de session protégée.

## 3. Modèle cryptographique et séparation des usages

Chaque appareil génère localement ses clés. Les clés privées ne sont jamais envoyées au serveur, à l'autre appareil ou dans un QR.

Les usages restent séparés :
- clé d'identité/signature de l'appareil ;
- clé d'échange ECDH de l'appareil ;
- clé d'identité racine ;
- clés de chiffrement/partage GPS, qui relèvent d'un sous-protocole séparé.

La piste existante mentionne ECDSA P-256/SHA-256 pour les signatures et ECDH P-256 pour l'échange. Cette piste ne devient pas homologuée par sa répétition dans ce document. Les formats exacts de clés, encodages, signatures et contrôles de points doivent être fixés dans l'annexe cryptographique après revue.

## 4. Transcript unique : contenu requis

Une seule structure versionnée doit être construite et les mêmes octets doivent être signés, comparés et vérifiés par Web, Android, iOS et le serveur.

Champs requis :
- domaine fixe et version du protocole ;
- identifiant du compte déterminé côté serveur ;
- identifiant de la racine active et version de sa clé ;
- empreinte de la clé publique racine calculée selon une règle unique ;
- identifiant aléatoire de cérémonie ;
- identifiant opaque du défi serveur ;
- défi serveur imprévisible d'au moins 32 octets ;
- identifiant opaque du nouvel appareil ;
- nonce du nouvel appareil d'au moins 32 octets ;
- nonce de la racine d'au moins 32 octets, généré localement pour cette cérémonie ;
- plateforme dans une énumération fermée (web, android, ios) ;
- clés publiques d'identité et d'échange du nouvel appareil ;
- usages autorisés dans un ordre fixe et une énumération fermée ;
- horodatage d'émission et expiration décidés par le serveur.

Les identifiants de compte, racine et appareil faisant autorité sont lus depuis la session et l'état serveur. Le serveur ne fait pas confiance à des rôles, versions ou identifiants d'autorité déclarés par le client.

Ne jamais inclure : clé privée, mot de passe, OTP, jeton de session brut, secret de récupération, coordonnées GPS ou contenu privé.

## 5. Encodage canonique — arbitrage non clos

Deux propositions incompatibles existent dans les documents historiques :
- JSON Canonicalization Scheme (RFC 8785) ;
- CBOR déterministe (RFC 8949).

Le prototype qui utilise `JSON.stringify` ne prouve pas la conformité à RFC 8785. Il est interdit de traiter ces deux formats comme interchangeables.

Avant tout code de production, l'équipe doit choisir un seul format et une seule version, puis publier :
- le schéma exact et les types ;
- les règles d'encodage des clés publiques et octets (représentation base64url stricte si retenue) ;
- les règles de normalisation et limites de taille ;
- le traitement des champs inconnus, doublons, valeurs nulles, ordre et encodages alternatifs ;
- des vecteurs d'octets canoniques communs aux quatre environnements.

**Aucune implémentation de signature du transcript n'est autorisée avant cet arbitrage.** La recommandation technique à examiner est de privilégier un format standard disposant de bibliothèques maintenues et de tests de conformité sur les quatre plateformes ; la simplicité apparente de JSON.stringify n'est pas un critère suffisant.

## 6. Preuves cryptographiques requises

Deux preuves distinctes sont obligatoires et portent sur le transcript complet :
- **preuve de possession du nouvel appareil :** signature du transcript par la clé privée d'identité du nouvel appareil ;
- **approbation racine :** signature des mêmes octets exacts par la clé privée racine.

La signature racine ne remplace pas la preuve de possession du nouvel appareil. L'authentification par mot de passe ou OTP ne remplace aucune de ces signatures.

L'annexe cryptographique doit encore fixer sans ambiguïté :
- algorithmes et paramètres exacts ;
- représentation binaire des signatures sur les trois clients et le Worker ;
- canonicalisation des signatures, y compris traitement low-S si ECDSA est conservé ;

L’évaluation des formats raw/DER, du vecteur RFC 6979 P-256 et de la malléabilité low-S est consignée dans `ANNEXE_EVALUATION_ECDSA_P256_INTEROPERABILITE.md`. Cette annexe rapporte des tests Node.js et Workers locaux réussis, mais ne ferme aucun arbitrage et ne remplace pas les essais réels Android/iOS.
- identifiants/empreintes des clés et règles de validation des clés publiques ;
- domaines de signature distincts pour éviter la confusion d'usage ;
- vecteurs positifs et négatifs interopérables.

Le nouvel appareil vérifie la signature racine avec l'ancre racine déjà épinglée localement. La racine vérifie la preuve du nouvel appareil. Le serveur vérifie les deux signatures à partir des clés publiques liées à la demande.

## 7. Défi, nonces et anti-rejeu

- Le serveur génère le défi avec un CSPRNG du runtime, jamais le client.
- Le nouvel appareil et la racine génèrent chacun leur nonce avec un CSPRNG local.
- Chaque valeur est liée au même identifiant de cérémonie et au hash du transcript.
- Les défis sont à usage unique, expirent selon une durée fixée dans la politique versionnée et sont invalidés à l'annulation, l'expiration ou la révocation.
- L'heure serveur est seule autorité pour émission et expiration.
- Toute modification du compte, de la racine, du nouvel appareil, des clés, des usages ou de la version invalide la cérémonie.
- Un défi consommé, expiré, annulé ou rattaché à une autre demande ne peut jamais être réutilisé.

Les tailles minimales de nonces et de défi sont des exigences. La durée exacte du défi et les limites de débit restent à fixer avant implémentation.

## 8. Valeur de comparaison indépendante (SAS)

Les deux appareils doivent afficher une même valeur de comparaison dérivée des octets canoniques exacts du transcript et d'un domaine dédié. Elle est comparée par un canal réellement indépendant du serveur et du QR (présence physique ou appel vocal initié par un canal déjà connu).

La proposition historique de six mots et d'au moins 66 bits doit être spécifiée complètement avant code :
- fonction de hachage et domaine exacts ;
- octets exacts en entrée et ordre ;
- troncature et calcul exact du nombre de bits ;
- liste de mots versionnée, taille et indexation ;
- vecteurs de test identiques sur Web, Android, iOS et serveur ;
- affichage accessible et confirmation explicite sur les deux appareils.

Le QR, un écran fourni uniquement par le serveur ou une notification SAC ne constitue pas à lui seul un canal indépendant. Une différence de SAS, une impossibilité de comparer ou un refus annule la cérémonie ; aucune validation par défaut.

## 9. Séquence d'enrôlement candidate

1. Le nouvel appareil authentifie le compte selon le parcours de compte normal, génère localement ses clés et son nonce, puis demande une cérémonie.
2. Le serveur vérifie l'état du compte et de la racine, crée une demande en attente et émet le défi.
3. Le serveur construit ou valide le transcript à partir de ses propres données autoritaires et lie la demande au hash exact de ce transcript.
4. Le nouvel appareil vérifie que le transcript correspond à sa demande locale, calcule et affiche le SAS.
5. La racine récupère la demande via sa session et son statut d'appareil actif, vérifie le nouvel appareil, calcule le même SAS et affiche les informations nécessaires à l'utilisateur.
6. Les utilisateurs comparent le SAS par canal indépendant et confirment explicitement sur les deux appareils.
7. Le nouvel appareil signe le transcript complet ; la racine signe exactement les mêmes octets.
8. Chaque appareil vérifie localement la preuve de l'autre avant transmission des signatures.
9. Le serveur vérifie les signatures, le défi, les nonces, le hash, les dates, les usages, l'état courant du compte et de la racine.
10. Le serveur effectue une seule transition atomique conditionnelle : défi consommé, demande approuvée et appareil activé ensemble. Sinon, aucun de ces effets ne doit être validé.
11. Le nouvel appareil ne reçoit une capacité de session qu'après confirmation serveur de l'activation ; cette session doit être liée à l'appareil.

Cette séquence est une cible de conception, pas une fonctionnalité disponible.

## 10. Autorité et contrôle serveur au commit

L'acteur racine est déterminé par la session authentifiée et l'état serveur. Le serveur vérifie au commit que :
- le compte est toujours actif ;
- l'appareil racine est toujours l'unique racine active et non révoquée ;
- la session racine est toujours active et liée à cette racine ;
- la demande est toujours en attente et non expirée/annulée ;
- le défi est encore valide et non consommé ;
- le transcript soumis correspond octet pour octet au hash stocké ;
- les deux signatures sont valides ;
- le nouvel appareil n'est pas déjà actif, révoqué ou rattaché à une autre cérémonie incompatible.

Une révocation racine qui gagne la course fait échouer l'approbation. Un appareil secondaire ne peut jamais appeler une opération d'approbation avec succès, même s'il forge un champ de rôle.

## 11. Atomicité D1, concurrence et idempotence

Un simple `DB.batch()` n'est pas une preuve suffisante : un `UPDATE` à zéro ligne ne provoque pas automatiquement l'annulation des instructions suivantes.

Le futur contrat D1 doit prouver sur le runtime isolé que la consommation du défi, l'approbation de la demande et l'activation de l'appareil sont toutes conditionnées aux mêmes préconditions et qu'aucun effet partiel n'est possible. La révocation de la racine doit être sérialisée contre cette transition.

L'idempotence doit utiliser une clé de commande et un hash de contenu :
- même clé + même contenu après commit : retourner le résultat déjà établi ;
- même clé + contenu différent : refuser ;
- timeout avant commit : permettre une reprise strictement identique si le défi est encore valide ;
- timeout après commit : retrouver le résultat établi sans nouvelle activation ;
- défi expiré/consommé sans résultat récupérable : terminer la cérémonie et en exiger une nouvelle.

Aucun SQL définitif ne doit être écrit avant que le schéma relationnel soit stabilisé et que les tests D1 démontrent ces garanties.

## 12. États et effets

États de demande à définir dans le schéma final : pending, approved, rejected/cancelled, expired. Les transitions doivent être monotones et conditionnelles.

États d'appareil : pending_verification, active, revoked. Le client ne choisit jamais son état.

Une révocation d'appareil invalide ses sessions, capacités de renouvellement et abonnements push ; les autres appareils restent inchangés. La révocation de la racine bloque les approbations et opérations exigeant la racine, sans promouvoir un secondaire et sans remplacer la racine en V1.

## 13. Tests de sécurité bloquants

- altération de chaque champ après signature ;
- substitution du compte, de la racine, de sa version, du nouvel appareil ou des clés ;
- signature absente, incorrecte, malformée ou issue d'une autre clé ;
- clé publique invalide/hors courbe ;
- défi d'une autre demande/compte/racine, expiré, consommé ou rejoué ;
- nonce trop court, réutilisé ou remplacé ;
- champ inconnu, dupliqué, réordonné ou encodage alternatif ;
- SAS différent, mauvais ordre de mots ou mauvaise version de liste ;
- appareil secondaire qui tente d'approuver ;
- révocation racine concurrente avec approbation ;
- deux approbations simultanées d'une même demande ;
- perte réseau avant et après commit ;
- restauration d'un snapshot antérieur ;
- interopérabilité réelle Web/Android/iOS/Cloudflare Worker ;
- absence de secrets, jetons, OTP, données GPS et contenu privé dans les journaux.

Les tests unitaires d'un évaluateur TypeScript ne prouvent ni la cryptographie interopérable ni l'atomicité D1.

## 14. Conditions de levée du NO-GO

Aucune approbation réelle ni session liée à un nouvel appareil avant :
1. arbitrage et versionnage du format canonique ;
2. annexe cryptographique complète et vecteurs de test ;
3. revue indépendante du modèle de menace et du protocole ;
4. tests interopérables sur les environnements cibles ;
5. tests D1 de concurrence, rollback, idempotence et révocation ;
6. contrat de session et de révocation complet ;
7. revue de sécurité des parcours UI et anti-hameçonnage.

La récupération/remplacement de racine demeure interdite en V1. Le GPS reste NO-GO tant que les garanties de suppression immédiate et de purge irréversible J+30, y compris sauvegardes et restaurations, ne sont pas démontrées.

## 15. Questions techniques encore ouvertes — aucune décision implicite

- RFC 8785/JCS ou CBOR déterministe, avec bibliothèque maintenue commune aux environnements.
- Algorithmes exacts, formats des signatures, règles ECDSA low-S et encodage des clés.
- Domaines cryptographiques et construction exacte du SAS.
- Durée du défi, taille finale des identifiants, quotas et limites de tentatives.
- UX de comparaison indépendante, annulation et assistance d'accessibilité.
- Transport de session et renouvellement après activation.
- Schéma D1 et preuve d'atomicité sur le runtime réel.
- Notifications de sécurité et politique d'audit.

**Règle finale :** aucun agent ne doit combler ces points par intuition, choisir silencieusement une primitive, ou raccorder le certificat expérimental à une API. Une décision technique devra être inscrite ici, testée et revue avant que le statut passe à « approuvé ».
