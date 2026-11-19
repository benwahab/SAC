# SAC — Étude d’intégration d’une autorité anti-retour-arrière avec Azure Confidential Ledger

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** étude d’architecture et protocole de preuve — fournisseur NON choisi, NON configuré, NON homologué en production.  
**Périmètre :** intégration depuis Cloudflare Workers, ordre des événements, idempotence, reçus, authentification, contrôle d’accès et localisation.  
**Aucune ressource Azure n’a été créée. Aucun secret, abonnement, compte de service ou déploiement externe n’a été configuré.**

## 1. Conclusion exécutive

Azure Confidential Ledger (ACL) reste un candidat pertinent pour une autorité indépendante de l’état de sécurité SAC, mais son API standard d’ajout seule ne prouve pas le compare-and-append dont SAC a besoin.

La documentation Microsoft révèle deux mécanismes de programmation côté registre :

- **UDF (User Defined Functions)** : fonctions JavaScript et hooks transactionnels associés à `POST /app/transactions`. Un hook peut lire/écrire des tables applicatives du registre dans la même transaction que l’ajout. L’échec d’un hook annule l’ensemble de la transaction. Les hooks doivent toutefois être explicitement mentionnés dans chaque requête ; ils ne s’exécutent pas automatiquement sur toutes les écritures.
- **UDE (User Defined Endpoints)** : API personnalisées exécutées dans le TEE du registre, avec RBAC personnalisé. UDE et UDF sont mutuellement exclusifs. UDE paraît mieux adapté à une API SAC unique qui contrôle elle-même les écritures, mais son contrat exact d’écriture du journal, d’atomicité, d’idempotence et de retour de reçu doit encore être prouvé.

**Orientation recommandée pour la prochaine preuve : étudier d’abord UDE comme porte d’entrée unique, avec une identité applicative qui n’a aucun droit d’écriture sur l’endpoint générique `POST /app/transactions`.** Ce n’est pas encore un choix fournisseur ou une décision de production. Si UDE ne permet pas de lier atomiquement la validation de séquence, l’idempotence, l’état de tête et l’écriture immuable, il faudra abandonner ACL ou introduire un service de sérialisation/écriture indépendant correctement isolé.

Ne pas considérer un appel UDF exécuté « normalement » comme une garantie : un autre appelant Contributor pourrait potentiellement envoyer une écriture directe sans le hook. Le contrôle d’accès doit rendre ce contournement impossible, et les documents actuels ne démontrent pas que les UDF offrent le RBAC personnalisé nécessaire.

## 2. Capacités ACL confirmées par Microsoft

### 2.1 Journal, transactions et reçus

- Chaque écriture produit un identifiant de transaction unique et croissant.
- Une entrée peut être retrouvée par son identifiant de transaction ou par collection.
- Une collection permet de regrouper logiquement les entrées ; elle ne doit pas être confondue avec un verrou ou une séquence conditionnelle par compte.
- Un reçu Merkle prouve cryptographiquement qu’une transaction donnée a été validée et ajoutée au registre.
- Le flux recommandé est : envoyer l’écriture, conserver le `transactionId` retourné dès acceptation, interroger son statut jusqu’à `Committed`, puis récupérer et vérifier le reçu.

**Réponse réseau perdue :** Microsoft avertit qu’une écriture peut avoir été validée même si la réponse se perd. Répéter aveuglément le POST peut créer un doublon. L’option preview `waitForCommit=true` ne résout pas ce problème : elle retarde le retour du transaction ID jusqu’au commit, donc une coupure avant réponse laisse le client sans identifiant alors que l’écriture peut avoir été effectuée. Ne pas utiliser cette option preview pour le protocole SAC.

Références :
- https://learn.microsoft.com/en-us/azure/confidential-ledger/data-organization
- https://learn.microsoft.com/en-us/azure/confidential-ledger/write-transaction-receipts
- https://learn.microsoft.com/en-us/rest/api/data-plane/confidentialledger/get-transaction-status/get-transaction-status

### 2.2 UDF : atomicité utile, mais risque de contournement

La documentation UDF indique que :
- les hooks pré/post s’exécutent dans le contexte de la requête `POST /app/transactions` ;
- leurs écritures dans les tables applicatives sont intégrées à la même transaction ;
- ils s’exécutent sur la réplique primaire pour conserver l’ordre et la cohérence forte ;
- si un hook échoue, toute la transaction est annulée ;
- ils peuvent accéder aux tables applicatives CCF, mais pas aux tables internes/gouvernance ; les tables de journal intégrées sont en lecture seule ;
- les hooks doivent être explicitement inclus dans le corps de chaque requête.

Un hook pourrait théoriquement lire la tête attendue d’un compte dans une table applicative, vérifier la séquence précédente et l’identifiant de commande, écrire la nouvelle tête et rejeter les doublons ou les séquences concurrentes dans la transaction d’ajout.

**Blocage :** puisque le hook est optionnel dans la requête, le protocole n’est sûr que si le rôle utilisé par SAC ne peut pas effectuer une écriture générique sans le hook. Les UDF ne proposent pas de RBAC personnalisé et ne doivent pas être considérés comme une barrière d’accès à eux seuls.

### 2.3 UDE : piste prioritaire à tester

Microsoft décrit les UDE comme des endpoints personnalisés exécutés dans le même TEE que le registre, avec authentification et RBAC personnalisés. L’application UDE est déployée comme un bundle TypeScript/JavaScript ; les rôles personnalisés autorisent des actions/chemins précis. Les UDE et UDF ne peuvent pas coexister sur la même instance.

Architecture candidate :
1. Exposer un endpoint applicatif dédié, par exemple `/sac/v1/security-events`.
2. Accorder à l’identité d’exécution SAC uniquement le rôle personnalisé autorisant cet endpoint.
3. Ne pas lui accorder l’action générique `POST /app/transactions`, ni les actions d’administration, de gestion des utilisateurs ou de déploiement.
4. Faire vérifier dans l’endpoint l’identité du compte SAC, le format strict, la séquence attendue, l’empreinte précédente et la clé d’idempotence.
5. Dans une seule transaction du registre, enregistrer l’événement immuable et faire avancer la tête applicative du compte, ou rejeter toute l’opération.
6. Retourner une réponse permettant de retrouver sans ambiguïté la transaction et son reçu, y compris après perte de réponse.

**Ce point 5 n’est pas encore prouvé par la seule documentation UDE consultée.** La preuve doit montrer précisément comment le code UDE ajoute une entrée au journal vérifiable par reçu, et que l’écriture de la tête et l’entrée append-only appartiennent à la même transaction de consensus. Une simple écriture dans une table applicative mutable ne suffit pas.

Références :
- https://learn.microsoft.com/en-us/azure/confidential-ledger/user-defined-endpoints
- https://learn.microsoft.com/en-us/azure/confidential-ledger/server-side-programming
- https://learn.microsoft.com/en-us/azure/confidential-ledger/secure-confidential-ledger

## 3. Contrat logique SAC à obtenir

### 3.1 Événement

Chaque commande d’écriture porte au minimum :
- `accountRef` : identifiant opaque, jamais adresse e-mail ou téléphone ;
- `operationId` : identifiant aléatoire unique et stable pour les répétitions d’une même commande ;
- `expectedSequence` : séquence que l’appelant croit être la tête courante ;
- `previousHash` : empreinte attendue de l’événement précédent ;
- `eventType` : enum fermé (root-created, root-revoked, device-activated, device-revoked, challenge-consumed, session-revoked, security-generation-changed, etc.) ;
- `objectRef` : référence opaque de l’objet ;
- `generation` : génération de sécurité applicable ;
- `schemaVersion` : version de contrat ;
- `eventHash` : empreinte calculée côté serveur selon une représentation canonique figée.

Aucun mot de passe, OTP, jeton, clé privée, assertion brute, challenge/nonce brut, position GPS, nom, e-mail, numéro de téléphone ou contenu de message ne doit être enregistré dans le registre.

Le hachage et l’identifiant idempotent ne remplacent pas le contrôle atomique de la tête. Le serveur doit vérifier l’état courant et le mettre à jour dans la même transaction que l’événement.

### 3.2 Append conditionnel

Pour un compte donné, le registre doit garantir :
- `expectedSequence == currentSequence` ;
- `previousHash == currentHeadHash` ;
- `operationId` n’a jamais été utilisé, sauf répétition strictement identique de la même commande déjà validée ;
- le nouvel événement porte `sequence = currentSequence + 1` ;
- la tête est avancée atomiquement avec l’événement ;
- deux commandes concurrentes avec la même tête ne peuvent pas toutes deux réussir ;
- une commande de révocation gagnante ne peut pas être suivie d’une approbation construite sur une ancienne génération.

La séquence par compte facilite la reconstruction ; l’identifiant de transaction ACL reste un ordre global du service. Les collections peuvent organiser les lectures, mais ne constituent pas une preuve de CAS.

### 3.3 Idempotence après réponse perdue

Le client SAC doit générer une seule fois un `operationId` pour une intention d’écriture et le réutiliser à chaque reprise.

L’endpoint doit traiter les cas ainsi :
- **commande inconnue** : vérifier la tête, valider et inscrire une fois ;
- **même operationId + même empreinte de commande déjà commise** : renvoyer le résultat existant et son transaction ID, sans nouvelle écriture ;
- **même operationId + contenu différent** : refuser comme conflit de sécurité ;
- **tête déjà avancée par une autre commande** : refuser la commande obsolète, relire l’état et reconstruire une nouvelle intention si elle reste valide.

Un journal de clés d’idempotence uniquement dans D1 est insuffisant : une restauration D1 pourrait effacer la preuve. La déduplication doit vivre dans l’autorité indépendante.

### 3.4 Confirmation au client

Le Worker SAC ne répond « succès » qu’après :
1. confirmation que la transaction ACL est commise ;
2. récupération du reçu ;
3. vérification cryptographique du reçu selon le protocole Microsoft ;
4. mise à jour de la projection D1 avec la même séquence et empreinte ;
5. vérification de la projection D1.

Si l’écriture ACL est commise mais que D1 échoue, l’opération est en état de reprise : aucun succès client, opérations sensibles bloquées pour le compte jusqu’à réconciliation. La répétition avec le même `operationId` doit retrouver l’écriture ACL existante et reprendre la projection sans ajouter un second événement.

Ne pas faire d’appel réseau ACL à l’intérieur d’un `D1.batch()` et ne pas parler de transaction distribuée ACID.

## 4. Intégration depuis Cloudflare Workers

### 4.1 Client REST ou SDK JavaScript

Microsoft publie `@azure-rest/confidential-ledger`. La documentation du client JavaScript montre les opérations REST de création, statut, lecture et collection, et l’authentification via une credential Azure. Elle décrit aussi une alternative par certificat client mTLS.

Pour le Worker SAC, ne pas supposer que le SDK Node complet ou son mécanisme d’authentification fonctionnera sans adaptation dans le runtime Workers. Première voie à évaluer : appels REST explicites avec `fetch`, JSON strict et authentification Entra obtenue côté serveur. Le SDK ne sera ajouté aux dépendances de production qu’après un test réel dans le runtime exact du Worker.

Le certificat d’identité TLS du registre doit être récupéré depuis le service d’identité Microsoft et utilisé comme ancre de confiance. Ne pas coder en dur définitivement ce certificat ni supposer qu’il ne changera jamais : prévoir une procédure contrôlée de renouvellement et de vérification de l’identité du registre.

### 4.2 Identité Entra et secrets

Microsoft recommande Microsoft Entra ID : le Worker obtient un jeton destiné spécifiquement au service ACL, puis présente ce jeton au registre. Pour une application sans utilisateur interactif, l’authentification applicative est le scénario correspondant.

Piste de conception :
- identité de service SAC dédiée, sans privilèges Azure de gestion de ressource ;
- privilégier une credential de certificat Entra plutôt qu’un secret client permanent si la compatibilité Worker est démontrée ;
- clé privée de signature conservée exclusivement dans les secrets serveur Cloudflare, jamais dans le navigateur, le dépôt, D1 ou les logs ;
- jeton d’accès court conservé uniquement en mémoire côté Worker, avec marge d’expiration ; jamais enregistré durablement ;
- TLS et vérification du certificat d’identité ACL ;
- identité d’administration ACL distincte de l’identité d’écriture SAC.

**À prouver :** flux OAuth client-credentials par assertion signée depuis Web Crypto Workers, format de clé, rotation, audience exacte, durée du jeton, validation de l’horloge et compatibilité du certificat de service avec le transport Worker. L’option mTLS du SDK ne doit pas être retenue tant que la capacité réelle de sortie TLS client du runtime Cloudflare n’a pas été testée.

Références :
- https://learn.microsoft.com/en-us/azure/confidential-ledger/authentication-azure-ad
- https://learn.microsoft.com/en-us/azure/confidential-ledger/register-application
- https://learn.microsoft.com/en-us/javascript/api/overview/azure/confidential-ledger-rest-readme

### 4.3 Séparation des privilèges

Trois identités distinctes au minimum :
- **Administrateur de contrôle Azure/ACL** : crée et supprime la ressource, gère les utilisateurs et déploie le code ; hors du Worker et hors des opérations ordinaires.
- **Identité de déploiement UDE** : déploie une version approuvée du bundle et gère les rôles ; non disponible à l’application en fonctionnement.
- **Identité d’exécution SAC** : appelle uniquement l’endpoint de journalisation ; aucune permission de suppression, administration, modification de code ou écriture générique.

La capacité de suppression administrative du registre est un risque majeur : Microsoft décrit la suppression comme définitive. Elle doit être protégée par un compte administratif séparé, MFA, droits minimaux, alertes et procédure contrôlée. ACL ne protège pas contre un attaquant qui contrôle également l’administration de la ressource.

## 5. Données, confidentialité et localisation

- Utiliser un registre **privé**, pas public.
- Stocker uniquement des références opaques, événements de sécurité minimaux, séquences et empreintes.
- Ne pas stocker de données personnelles, de contenu SOS, de GPS ou de données médicales.
- La confidentialité du registre privé ne dispense pas de minimisation : l’historique est durable et difficile à effacer sélectivement.
- ACL réplique automatiquement les données vers la région jumelée Azure ; cette réplication ne peut pas être désactivée et une résidence dans une seule région n’est pas proposée.
- Avant tout choix, identifier la région primaire et sa région jumelée, puis vérifier les deux pour les exigences de localisation et de souveraineté.
- La suppression de l’instance ACL est un hard delete : elle n’est pas une méthode de purge granulaire et détruit le registre.

Références :
- https://learn.microsoft.com/en-us/azure/confidential-ledger/data-residency
- https://learn.microsoft.com/en-us/azure/confidential-ledger/overview

## 6. Disponibilité, latence, coûts et dépendances

Les opérations sensibles de SAC dépendraient d’un service externe accessible depuis les Workers. Une panne, une latence excessive, une limite de débit ou une perte d’identité doit provoquer un état fail-closed pour l’enrôlement, les approbations, les révocations et les sessions, selon la politique de disponibilité qui reste à arbitrer pour le SOS.

À mesurer depuis le Niger, sans inventer de chiffres :
- latence p50/p95/p99 entre Cloudflare et chaque région candidate ;
- temps moyen d’acceptation, de commit, de statut et de reçu ;
- taux de timeout et de reprise ;
- limites de requêtes, tailles maximales, stockage et quotas ;
- coûts d’instance par heure, stockage, transfert, éventuelles opérations annexes et coût d’un environnement de secours ;
- effet de la réplication vers la région jumelée.

La page de tarification consultée n’expose pas un prix forfaitaire universel : le coût dépend de la région, de l’offre et de la configuration. Aucun budget ne doit être annoncé avant un devis/calculateur actualisé. Aucun essai payant ni ressource ne doit être créé sans accord explicite.

## 7. Plan de preuve sans ressource Azure

La prochaine étape peut être menée sans compte ni coût :
1. lire le code officiel Microsoft des exemples UDE et identifier les primitives CCF réellement disponibles ;
2. établir si un endpoint UDE peut effectuer un append journalisé avec reçu et mise à jour atomique de tête ;
3. écrire un contrat d’API et un modèle de données minimal, sans intégrer de SDK dans SAC ;
4. construire un faux transport strictement test-only pour tester les machines d’états Worker : perte de réponse avant/après commit, répétition, double append concurrent, tête obsolète, reçu indisponible, D1 en panne et reprise ;
5. préparer une checklist de preuve réelle à exécuter seulement si l’utilisateur choisit ACL et autorise explicitement une ressource de test.

Le faux transport ne pourra jamais prouver la sécurité, la disponibilité, l’atomicité ou la durabilité d’Azure. Il testera uniquement la logique SAC autour du contrat externe.

## 8. Critères GO / NO-GO

GO technique seulement si une preuve réelle démontre :
- endpoint UDE unique et accès générique d’écriture bloqué pour l’identité SAC ;
- validation de séquence et idempotence exécutées dans la transaction du registre ;
- append immuable et état de tête liés atomiquement ;
- transaction ID récupérable après réponse perdue sans doublon ;
- reçu Merkle vérifiable et lié au contenu exact ;
- ordre cohérent lors de deux commandes concurrentes ;
- révocation prioritaire sur une approbation fondée sur un état obsolète ;
- identité Entra Worker et TLS du registre validés ;
- panne, timeout, rotation, restauration D1 et réconciliation testés ;
- résidence région primaire + jumelée et coût acceptés ;
- séparation des identités administratives démontrée.

NO-GO immédiat si :
- l’identité SAC peut écrire directement sans passer par le contrôle conditionnel ;
- la tête peut être modifiée sans entrée append-only correspondante ;
- un timeout peut conduire à un double événement ;
- la réponse ne permet pas de retrouver une transaction commise ;
- le reçu n’est pas vérifiable indépendamment ;
- les permissions ou l’administration permettent un effacement non détecté ;
- les garanties de résidence ou de coût sont incompatibles.

## 9. Références officielles consultées

- ACL — présentation : https://learn.microsoft.com/en-us/azure/confidential-ledger/overview
- ACL — organisation des données : https://learn.microsoft.com/en-us/azure/confidential-ledger/data-organization
- ACL — UDF : https://learn.microsoft.com/en-us/azure/confidential-ledger/user-defined-functions
- ACL — UDE : https://learn.microsoft.com/en-us/azure/confidential-ledger/user-defined-endpoints
- ACL — programmation côté serveur : https://learn.microsoft.com/en-us/azure/confidential-ledger/server-side-programming
- ACL — reçus : https://learn.microsoft.com/en-us/azure/confidential-ledger/write-transaction-receipts
- ACL — authentification Entra : https://learn.microsoft.com/en-us/azure/confidential-ledger/authentication-azure-ad
- ACL — client JavaScript : https://learn.microsoft.com/en-us/javascript/api/overview/azure/confidential-ledger-rest-readme
- ACL — résidence : https://learn.microsoft.com/en-us/azure/confidential-ledger/data-residency
- ACL — tarifs : https://azure.microsoft.com/en-us/pricing/details/confidential-ledger/

**Décision finale de cette étude :** ACL n’est pas encore sélectionné. UDE est la piste de preuve prioritaire, pas une implémentation validée. Le NO-GO de production anti-retour-arrière reste en vigueur.
