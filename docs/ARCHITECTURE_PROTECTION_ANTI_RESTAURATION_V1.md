# SAC — Protection anti-retour-arrière de l'état de sécurité

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** architecture candidate et modèle de test isolé — NON homologués pour la production.  
**Aucune ressource Cloudflare ou externe n'a été créée. Aucun secret ni compte fournisseur n'a été configuré.**

## 1. Problème démontré par la documentation fournisseur

D1 Time Travel peut remplacer la base par un état antérieur et les bookmarks précédents restent utilisables après une restauration. La fenêtre annoncée est de 30 jours sur Workers Paid et 7 jours sur Workers Free. Référence : https://developers.cloudflare.com/d1/reference/time-travel/

Le stockage SQLite des Durable Objects possède lui aussi un mécanisme PITR qui restaure l'ensemble de son contenu jusqu'à 30 jours en arrière. La documentation Cloudflare précise que le PITR DO n'est pas pris en charge en développement local. Référence : https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/

**Conséquence :** ni D1, ni un Durable Object SQLite placé dans le même périmètre de restauration, ne constituent seuls une autorité anti-retour-arrière.

Le stockage Durable Object historique basé sur KV n'est pas retenu comme raccourci : Cloudflare indique que la création de nouveaux namespaces KV-backed n'est plus prise en charge pour les comptes ne disposant pas déjà d'un namespace de ce type. Cela ne fournit de toute façon pas la preuve d'une autorité indépendante, durable et administrativement séparée.

## 2. Architecture candidate

### 2.1 Deux plans séparés

- **D1 = projection opérationnelle** : comptes, appareils, racines, cérémonies, sessions et état courant utile à l'application.
- **Autorité indépendante = journal monotone de sécurité** : séquence par compte, événements de sécurité immuables, chaîne de hachage et tête courante.

L'autorité indépendante ne doit pas être une autre copie D1/DO soumise au même mécanisme de restauration. Elle doit satisfaire, preuves fournisseur à l'appui :
- écriture conditionnelle/append-only avec séquence monotone ;
- lecture fortement cohérente de la tête ;
- immutabilité des événements déjà confirmés ;
- impossibilité pour le rôle applicatif de modifier/supprimer l'historique ;
- protection de rétention/immutabilité administrativement séparée ;
- contrôle d'accès et identité d'administration séparés de l'environnement D1 ;
- comportement documenté en cas de panne, reprise, export et restauration.

Aucun fournisseur n'est sélectionné dans ce document. Le choix exige une étude de sécurité, disponibilité, localisation, coût, dépendance, et test de restauration. Un stockage externe simplement « différent » ne suffit pas si les mêmes administrateurs peuvent effacer ou réécrire les deux côtés.

### 2.2 Événements minimaux

Le journal doit pouvoir reconstruire ou invalider les autorités restaurables :
- création/activation d'une racine et sa génération ;
- révocation de racine et génération ;
- activation/révocation d'un appareil ;
- consommation d'un défi d'enrôlement (identifiant opaque ou empreinte, jamais le secret du défi) ;
- changement de génération de sécurité ;
- événements nécessaires à la révocation des sessions.

Chaque entrée contient au minimum : compte opaque, séquence, identifiant de commande idempotent, type d'événement, identifiant d'objet opaque, génération concernée, empreinte de l'entrée précédente, empreinte de l'entrée courante, version de schéma et horodatage serveur. Pas de mot de passe, OTP, jeton de session, clé privée, assertion brute, nonce brut ni GPS.

Une chaîne de hachage détecte les modifications et ruptures de séquence ; elle ne rend pas à elle seule le stockage immuable. L'immutabilité dépend du fournisseur, des permissions et de la séparation des rôles.

### 2.3 Ordre d'écriture impératif

Pour toute transition qui modifie une autorité ou un état anti-rejeu :

1. Vérifier la tête indépendante et l'état courant attendu.
2. Ajouter l'événement à l'autorité indépendante avec compare-and-append sur la séquence précédente et un identifiant idempotent.
3. Attendre la confirmation durable du fournisseur.
4. Appliquer la projection correspondante à D1 dans une transaction atomique, avec la nouvelle séquence et la nouvelle empreinte.
5. Vérifier le résultat D1.
6. Répondre succès uniquement après les deux confirmations.

**Ne jamais écrire D1 d'abord puis espérer enregistrer l'événement externe ensuite.** Si le journal indépendant avance mais que D1 échoue, l'opération n'est pas confirmée au client : SAC détecte le décalage et reste bloqué sur les opérations sensibles jusqu'à réconciliation. C'est une panne sûre, pas un succès partiel.

Les appels réseau externes ne doivent pas être insérés dans un `D1.batch()` ni présentés comme une transaction distribuée. Le protocole est une machine d'états à deux phases avec reprise idempotente, pas une transaction ACID entre deux fournisseurs.

### 2.4 Vérification à chaque opération sensible

Avant toute opération qui dépend de la racine, d'un appareil, d'une session ou d'un défi :
- lire la tête indépendante ;
- vérifier l'intégrité de la chaîne et la séquence ;
- comparer séquence + empreinte de D1 à la tête indépendante ;
- vérifier l'état de l'objet concerné ;
- refuser si l'autorité est indisponible, illisible, en retard, en avance, incohérente ou si la vérification échoue.

Une réponse du cache, une ancienne session locale ou un état en mémoire ne doit jamais contourner cette vérification.

La politique de disponibilité pour les fonctions SOS en cas d'indisponibilité de l'autorité reste un point produit/sécurité à arbitrer : ne pas supposer que tous les parcours d'urgence doivent être bloqués ou autorisés sans validation dédiée. La règle anti-retour-arrière s'applique au minimum aux opérations d'authentification, d'enrôlement, d'approbation, de révocation et de renouvellement de session.

### 2.5 Détection et reprise après restauration D1

Si D1 est restaurée avant une révocation ou une consommation de défi, sa séquence/empreinte devient inférieure à la tête indépendante.

- Les opérations sensibles sont refusées immédiatement.
- La réconciliation lit les événements indépendants manquants et les rejoue dans l'ordre, avec validation de chaque lien de hachage et de chaque précondition.
- Les racines/appareils révoqués et défis consommés sont réappliqués ; les sessions touchées sont invalidées.
- La séquence et l'empreinte de la projection D1 ne sont avancées qu'après chaque application confirmée.
- Le service ne rouvre qu'après égalité exacte des têtes et vérification de l'état reconstruit.

Si D1 est en avance sur l'autorité, si l'empreinte de jonction ne correspond pas, si l'historique indépendant manque, ou si une transition ne peut pas être rejouée sans ambiguïté : **blocage durable et intervention contrôlée**. Aucun retour automatique à un état antérieur n'est permis.

La procédure administrative de reprise doit être auditée, à double contrôle organisationnel si la revue de menace le requiert, et séparée des rôles d'exploitation ordinaires. Les droits exacts restent à concevoir.

### 2.6 Limite de la garantie

Cette architecture protège contre une restauration D1 isolée si l'autorité indépendante reste intacte et inaccessible à la même opération de restauration.

Elle ne protège pas contre un adversaire qui contrôle simultanément D1, l'autorité indépendante, ses clés d'administration et ses politiques de rétention. La séparation des fournisseurs/comptes, des identités et des privilèges est donc une condition de sécurité, pas une option décorative.

Elle ne doit pas être présentée comme « irréversible » avant validation du contrat de service, des permissions, des sauvegardes, des exports, de la suppression, des restaurations et de l'ensemble du chemin de reprise.

## 3. Modèle de test isolé ajouté au dépôt

Fichier : `tests/anti-rollback-model.test.ts`  
Commande : `npm run test:anti-rollback-model`

Le modèle contient deux objets distincts en mémoire :
- une autorité simulée, append-only, avec séquence, idempotence et chaîne de hachage ;
- une projection D1 simulée, avec snapshots et restauration volontaire.

Scénarios couverts :
1. restaurer D1 avant la révocation d'une racine : détection, blocage, rejeu de la révocation ;
2. autorité avancée mais projection D1 non écrite : blocage puis réconciliation ;
3. restaurer D1 avant consommation d'un défi : le défi reste consommé après rejeu ;
4. répétition d'une commande : pas de deuxième événement ;
5. altération d'un événement du journal : chaîne rejetée ;
6. indisponibilité de l'autorité : refus ;
7. projection D1 en avance sur l'autorité : pas de correction automatique.

**Limite essentielle :** c'est un test de logique et de machine d'états, pas un test d'un vrai fournisseur indépendant, ni de sa durabilité, ni de sa résistance à la restauration administrative. Le modèle utilise la mémoire du processus et ne prouve aucune garantie de stockage externe. Le test Cloudflare local ne peut pas simuler le PITR DO, puisque Cloudflare indique que ce PITR n'est pas pris en charge en local.

## 4. Conditions GO avant toute implémentation réelle

- Choisir un service externe après comparaison des garanties et de la localisation.
- Vérifier les garanties de lecture cohérente, append-only, CAS, rétention, restauration et suppression.
- Séparer comptes, identités, permissions et chemins d'administration.
- Tester les pannes entre chaque étape du protocole.
- Tester restauration D1 avant/après chaque type d'événement, restauration répétée et reprise du trafic.
- Tester la perte de réponse après append externe et après commit D1.
- Tester les courses entre révocation racine et approbation secondaire.
- Vérifier que toutes les routes sensibles appellent l'autorité et qu'aucun cache/session ne contourne la règle.
- Faire une revue indépendante du protocole et du runbook.

**NO-GO maintenu :** pas de migration d'enrôlement de production, pas de route réelle, pas de ressource Cloudflare, pas de secret externe, pas de déploiement avant ces validations.

## 5. Références officielles

- D1 Time Travel : https://developers.cloudflare.com/d1/reference/time-travel/
- SQLite-backed Durable Object Storage et PITR : https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- Cloudflare D1 restore API : https://developers.cloudflare.com/api/resources/d1/subresources/database/subresources/time_travel/methods/restore/


## 6. Fournisseur candidat à étudier — Azure Confidential Ledger

**Candidat de présélection, non choisi et non configuré : Microsoft Azure Confidential Ledger (ACL).** Il présente un meilleur alignement fonctionnel que D1/DO pour le journal externe : Microsoft le décrit comme un registre append-only et tamper-evident, fondé sur CCF et des enclaves matérielles, avec des reçus cryptographiques/Merkle permettant de vérifier qu'une entrée a été validée. Le service expose une API REST et des bibliothèques JavaScript, ce qui mérite un prototype d'intégration avec un Worker Cloudflare.

Sources Microsoft :
- Présentation, append-only, sécurité, gestion des identités, réplication et suppression : https://learn.microsoft.com/en-us/azure/confidential-ledger/overview
- Reçus cryptographiques : https://learn.microsoft.com/en-us/azure/confidential-ledger/write-transaction-receipts
- Vérification des reçus : https://learn.microsoft.com/en-us/azure/confidential-ledger/verify-write-transaction-receipts
- Résidence des données et région jumelée : https://learn.microsoft.com/en-us/azure/confidential-ledger/data-residency

**Points de vigilance à vérifier avant choix :**
- ACL est un service à créer dans un abonnement Azure ; sa suppression administrative est un hard delete et les données ne sont pas récupérables. Le rôle de contrôle qui peut supprimer la ressource doit donc être séparé des identités applicatives SAC, fortement restreint et surveillé.
- Les données sont automatiquement répliquées vers une région Azure jumelée ; la région primaire et sa région jumelée doivent être acceptables pour SAC.
- L'authentification du Worker, le mode privé/chiffré, les droits data-plane minimaux, l'authenticité des nœuds, les limites, la disponibilité, les coûts et la latence depuis le Niger restent à mesurer.
- La documentation de reçu précise qu'une connexion interrompue peut laisser incertain le résultat d'un append ; le protocole SAC devra retrouver le commit via transaction ID/état plutôt que renvoyer aveuglément un événement et créer un doublon.
- Il faut tester comment lire la tête de séquence et retrouver une commande idempotente, comment paginer/rejouer les entrées et vérifier les reçus, et comment réagir à la suppression/recréation du registre.

ACL est donc un **candidat à un prototype non-production**, pas une décision de fournisseur, pas une promesse de gratuité et pas une garantie absolue contre un administrateur qui contrôle aussi l'abonnement et peut supprimer la ressource. Le compte/abonnement ACL devrait être séparé du tenant Cloudflare et administré par une identité distincte. Aucun abonnement, registre ou secret n'a été créé.

## 7. Alternative de comparaison — S3 Object Lock

Amazon S3 Object Lock en mode Compliance peut empêcher l'écrasement ou la suppression d'une version protégée pendant sa période de rétention, même par le root AWS ; il exige le versioning et les nouvelles versions / delete markers restent des considérations à gérer. Cette solution est une archive WORM, pas à elle seule un journal séquencé avec compare-and-append et lecture cohérente de la tête. Elle demanderait un protocole additionnel et une séparation d'administration. Source : https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html

Le choix final doit comparer ACL à un assemblage AWS, sans déployer l'un ou l'autre avant validation.
