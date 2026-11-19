# SAC — Étude d'intégration Azure Confidential Ledger depuis Cloudflare Workers

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** étude technique et architecture candidate — fournisseur NON choisi, intégration NON implémentée, production NO-GO.  
**Périmètre :** protection indépendante contre le retour arrière de D1 pour les événements de sécurité.  
**Aucune ressource Azure/Cloudflare, aucun abonnement, aucun secret et aucun coût n'ont été créés ou engagés.**

## 1. Conclusion exécutive

Azure Confidential Ledger (ACL) reste un candidat sérieux pour l'autorité externe anti-restauration de SAC. L'étude confirme quatre capacités utiles :

1. Le registre est append-only et tamper-evident ; les écritures reçoivent un identifiant de transaction et peuvent être vérifiées par reçu cryptographique/Merkle.
2. Les collections permettent de grouper les écritures, avec des identifiants de transaction ordonnés par le service.
3. Les fonctions UDF peuvent exécuter un contrôle préalable et mettre à jour une table applicative dans la même transaction que l'ajout du journal ; un échec de la fonction annule l'écriture.
4. Cloudflare Workers sait présenter un certificat client mTLS à un service externe. Une capacité Workers VPC plus récente permet aussi de configurer une CA personnalisée et un certificat client, mais son adéquation à l'endpoint public ACL n'est pas démontrée.

**Verdict :** l'architecture ACL peut potentiellement fournir un compare-and-append atomique via un UDF pré-hook, sans imposer un verrou Durable Object comme autorité. Mais ce mécanisme, le chemin TLS depuis Workers, la récupération idempotente après réponse perdue, les permissions qui empêchent le contournement du hook et les garanties de région/coût doivent être prouvés dans un vrai environnement isolé avant toute sélection.

## 2. Compare-and-append : découverte importante

### 2.1 Mécanisme candidat

L'API ACL `POST /app/transactions` accepte des `preHooks`. Un UDF peut lire et écrire une table applicative CCF. La documentation Microsoft indique que :

- les hooks sont exécutés dans le contexte de la requête d'écriture ;
- les opérations de table effectuées par le hook sont incluses dans la même transaction ;
- si le hook échoue, l'ensemble de la transaction est annulé et aucune entrée n'est ajoutée ;
- les UDF/hooks s'exécutent sur le réplica primaire afin de préserver l'ordre et la cohérence ;
- la documentation actuelle demande l'API stable `2026-02-23` ou ultérieure.

Cela fournit un mécanisme candidat pour implémenter le compare-and-append dans le registre lui-même, et non dans D1 ou dans un DO.

### 2.2 État de tête par compte

Modèle conceptuel à tester, sans schéma final :

- une seule collection ACL pour le journal de sécurité SAC ;
- une table applicative CCF contenant une tête par compte opaque ;
- pour chaque compte : dernière séquence, empreinte de l'événement courant, version de protocole ;
- chaque nouvel événement apporte : identifiant opaque du compte, séquence attendue, empreinte précédente attendue, identifiant de commande idempotent, type d'événement, identifiant opaque d'objet et nouvelle empreinte.

Le pré-hook :
1. parse strictement le contenu ;
2. refuse les champs inattendus et les tailles hors limites ;
3. lit la tête courante du compte ;
4. vérifie la séquence attendue et l'empreinte précédente ;
5. vérifie l'identifiant idempotent ;
6. écrit la nouvelle tête dans la table applicative ;
7. laisse l'ajout de l'entrée ACL se terminer dans la même transaction.

Deux requêtes concurrentes présentant la même séquence attendue doivent être sérialisées par le registre : la première peut avancer la tête ; la seconde doit alors constater un état différent et échouer. **Cette propriété doit être prouvée par des tests de concurrence sur un vrai registre ACL** ; la documentation transactionnelle est un fondement solide, mais ne remplace pas la preuve d'intégration.

### 2.3 Points qui empêchent encore de considérer le protocole comme homologué

- Vérifier le préfixe exact des tables applicatives privées sur un registre de type Private Ledger ; les exemples UDF publics utilisent `public:`, tandis que le journal interne d'un registre privé est `private:`.
- Vérifier le comportement réel des opérations CCF `get/set` sur une clé inexistante, les erreurs de parsing et les collisions de clés.
- Vérifier que le hook ne peut pas être omis par l'identité applicative autorisée à écrire.
- Vérifier les courses concurrentes et le rollback réel lorsque le hook modifie la tête puis échoue.
- Définir une stratégie de lecture/reconstruction de la tête après indisponibilité, restauration D1 ou perte de réponse.
- Les UDF simples et les User Defined Endpoints (UDE) sont mutuellement exclusifs. Les UDE proposent une logique d'API et du RBAC personnalisé ; le choix entre UDF avec hook et UDE doit faire l'objet d'une revue dédiée.

**Règle de sécurité :** ne jamais donner un accès ACL Contributor générique au navigateur, à un utilisateur SAC ou à plusieurs services non contrôlés. Le chemin d'écriture doit être unique, limité et audité. Une requête qui peut écrire sans passer par le contrôle de séquence invalide la garantie recherchée.

## 3. Collections, ordre et modèle de données

ACL attribue un identifiant de transaction à chaque écriture. Les entrées peuvent être lues par identifiant, par collection et par plage de transactions. Le service fournit aussi l'entrée courante ; la documentation précise toutefois qu'un nœud non primaire peut renvoyer une valeur plus ancienne.

Recommandation à tester :
- ne pas créer une collection par compte SAC sans étude de capacité ; le nombre de collections par registre est limité (la documentation de limites doit être vérifiée au moment du choix) ;
- utiliser une collection unique dédiée au journal SAC et une clé applicative par compte pour la tête de séquence ;
- ne pas confondre l'identifiant de transaction global ACL avec la séquence métier par compte ;
- vérifier les lectures de tête sur le primaire ou par une méthode qui garantit la fraîcheur requise ;
- paginer les lectures historiques et contrôler chaque lien de hachage pendant la réconciliation.

Le registre n'est pas une base relationnelle métier : D1 reste la projection opérationnelle, ACL conserve les événements de sécurité minimaux et l'autorité de séquence.

## 4. Idempotence et réponse réseau perdue

La documentation Microsoft décrit le risque suivant : si la connexion est interrompue après qu'un append a été accepté, le client peut ne pas connaître le résultat. Renvoyer aveuglément la même écriture peut créer un doublon.

### Protocole candidat

- Chaque commande porte un identifiant idempotent aléatoire et un digest du contenu canonique.
- Le pré-hook conserve cet identifiant dans une table applicative atomique avec la tête de compte.
- Même identifiant + même digest : ne pas créer une deuxième transition.
- Même identifiant + digest différent : rejet de sécurité.
- Après réponse normale, conserver le transaction ID retourné, attendre le statut `Committed`, puis récupérer le reçu.
- Après perte de réponse, interroger l'état idempotent et réconcilier les entrées depuis le dernier transaction ID connu jusqu'à la tête actuelle ; ne jamais renvoyer aveuglément une nouvelle écriture.

**Point ouvert :** la documentation UDF ne garantit pas que le contexte du hook expose le transaction ID de l'entrée qui est en cours d'écriture. Il faut donc prouver comment associer de manière fiable l'identifiant idempotent au transaction ID et au reçu après une réponse perdue. Une recherche paginée dans la collection est un mécanisme de secours possible, mais son coût et ses bornes doivent être mesurés.

### Reçus

Flux recommandé :
1. `POST /app/transactions` reçoit le transaction ID dès que le service accepte l'écriture ;
2. `GET /app/transactions/{transactionId}/status` est interrogé jusqu'à `Committed` ;
3. `GET /app/transactions/{transactionId}/receipt` récupère le reçu ;
4. un vérificateur indépendant valide le reçu Merkle et la chaîne de certificat du nœud.

Ne pas baser la production sur `waitForCommit=true` de l'API preview : la documentation signale qu'une coupure avant la réponse peut laisser l'écriture validée sans transaction ID reçu par le client.

## 5. Confidentialité et minimisation des données

SAC doit utiliser un **Private Ledger** si le fournisseur et les régions retenues le permettent, avec un nombre minimal d'identités autorisées.

Contenu autorisé à étudier :
- identifiants opaques non réversibles ;
- séquences et générations ;
- types d'événements codés ;
- empreintes SHA-256 ;
- versions de schéma et de protocole ;
- horodatages serveur strictement nécessaires.

Ne jamais envoyer à ACL :
- nom, adresse e-mail, numéro de téléphone ou carnet de contacts ;
- GPS, itinéraires, lieu ou données d'urgence ;
- mots de passe, OTP, cookies, jetons de session ;
- clés privées, secrets, challenge ou nonce bruts ;
- assertion WebAuthn brute ou contenu libre d'une alerte.

Les données inscrites dans le registre sont append-only : une erreur de conception ou une donnée personnelle envoyée ne pourra pas être simplement effacée entrée par entrée. Le contrôle de minimisation doit donc être effectué avant chaque écriture.

## 6. Authentification et intégration Cloudflare Workers

### 6.1 Options ACL documentées

La bibliothèque JavaScript officielle `@azure-rest/confidential-ledger` documente deux modes :
- Microsoft Entra ID avec une identité d'application ;
- certificat client mTLS avec certificat et clé privée.

La bibliothèque JavaScript documente Node.js 14+ ; cela ne prouve pas qu'elle fonctionne telle quelle dans le runtime Cloudflare Workers. Il ne faut pas ajouter cette dépendance à SAC avant un test d'exécution exact.

Microsoft recommande Entra ID pour l'accès applicatif. Pour une identité non interactive, l'application obtient un jeton destiné à la ressource de l'endpoint ACL puis l'envoie comme Bearer token. Les certificats sont préférables aux secrets partagés lorsque le flux d'application par certificat est retenu.

### 6.2 Capacités Cloudflare et blocage TLS

Cloudflare Workers propose un binding mTLS sortant qui présente un certificat client au service distant. Cela rend le mode certificat envisageable côté authentification client.

Mais ACL demande également de vérifier l'identité TLS du registre au moyen du certificat de service récupéré auprès de l'Identity Service. Le SDK JavaScript officiel accepte explicitement ce certificat comme racine de confiance. Le binding mTLS Workers documenté ne fournit pas, à lui seul, un paramètre de CA personnalisée pour le serveur distant.

Cloudflare Workers VPC documente désormais la configuration d'une CA personnalisée et d'un certificat client sur un VPC Service. Cette nouveauté est une piste, mais elle nécessite une configuration VPC/tunnel et **n'a pas été testée avec l'endpoint public ACL**. Ne pas contourner la validation TLS ni utiliser un mode de vérification désactivé.

### 6.3 Architecture d'intégration candidate

**Option A — connexion directe Worker → ACL :** à conserver comme objectif uniquement si un test prouve simultanément :
- authentification Entra ou mTLS ;
- validation TLS du certificat de service ACL ;
- appels REST nécessaires ;
- compatibilité avec le runtime Workers ;
- rotation sûre des identifiants.

**Option B — passerelle minimale dédiée :** option de repli la plus réaliste pour un premier test réel. Une Azure Function/API très limitée utiliserait une identité managée ou une identité applicative dédiée pour accéder à ACL ; elle validerait les commandes et n'exposerait jamais un proxy REST générique. Le Worker SAC appellerait uniquement cette opération métier avec authentification serveur-à-serveur.

Conditions impératives pour B :
- passerelle et registre administrés dans des périmètres et rôles distincts ;
- la passerelle n'a pas le droit d'administrer ou supprimer le registre ;
- identité applicative ACL limitée à l'écriture nécessaire ;
- aucune clé d'administration Azure dans Cloudflare ;
- authentification Worker → passerelle, rotation et anti-rejeu ;
- limitation de débit, validation de schéma et journalisation minimale ;
- la passerelle ne répond « succès » qu'après confirmation durable ACL et réconciliation D1 selon le protocole retenu.

Une passerelle Azure n'est pas l'autorité anti-retour-arrière : ACL le reste. La passerelle augmente cependant le coût, la latence et la surface d'exploitation.

## 7. Résidence, disponibilité, limites et coûts

### Résidence des données

ACL réplique automatiquement les données vers la région Azure jumelée de la région primaire. Cette réplication est obligatoire et ne peut pas être désactivée. Le choix de région doit donc vérifier **les deux régions**. Aucun choix n'est fait dans cette étude. L'acceptabilité de cette réplication pour les données de sécurité de SAC doit être décidée avant création d'une ressource.

### Disponibilité et limites

ACL est un service géré avec réplication et consensus ; il peut néanmoins être indisponible, lent ou temporairement incapable de fournir un reçu. SAC doit traiter explicitement :
- délai d'accès depuis le Niger ;
- perte de connexion après acceptation d'une écriture ;
- indisponibilité de la région primaire ;
- reprise et réconciliation après retour du service ;
- limites de taille des entrées, collections, débit et pagination.

La politique d'indisponibilité pour les fonctions SOS reste un arbitrage produit/sécurité séparé. Ne pas transformer une panne de l'autorité en faux « envoyé » ou « sécurisé ».

### Coûts

La page tarifaire publique indique une facturation par instance de registre à l'heure et par stockage au Go/mois ; le prix exact dépend de la région et du contrat. La page publique ne permet pas de produire ici un montant fiable. Il faut établir une estimation dans le calculateur Azure pour une région primaire et sa région jumelée, en tenant compte du coût fixe de l'instance, des trois nœuds et de la passerelle éventuelle. Aucun coût ne doit être engagé sans accord explicite.

## 8. Plan de preuve avant toute décision

Sur une ressource d'essai isolée, sans données réelles SAC :

1. Créer un registre privé dans une région et vérifier sa région jumelée.
2. Récupérer et épingler le certificat d'identité du registre ; tester la validation TLS.
3. Tester chaque mode d'authentification envisagé depuis le runtime exact du Worker ou depuis la passerelle retenue.
4. Déployer un UDF pré-hook minimal dans le registre d'essai ; confirmer la version API stable et le statut de disponibilité dans la région.
5. Tester les tables applicatives privées et les permissions ; vérifier qu'une identité de service ne peut pas modifier le code UDF ni administrer/supprimer le registre.
6. Envoyer deux cents écritures concurrentes avec la même séquence attendue : une seule doit réussir ; les autres doivent échouer sans modifier la tête.
7. Tester un hook qui met à jour la tête puis lève une exception : ni la tête ni l'entrée ne doivent être validées.
8. Tester omission du hook, altération de séquence, mauvaise empreinte, rejeu, identifiant idempotent réutilisé avec un autre digest et deux comptes distincts.
9. Couper la connexion à différents moments de l'append ; retrouver l'écriture sans doublon et obtenir son transaction ID/reçu.
10. Vérifier cryptographiquement les reçus avec un vérificateur indépendant.
11. Tester restauration D1 avant/après chaque événement, réconciliation et reprise du trafic.
12. Mesurer latence, disponibilité, limites et coût réel estimé.

Un test local avec faux transport ou une simulation en mémoire ne peut pas remplacer ces preuves fournisseur. Aucun test réel ACL n'a encore été exécuté.

## 9. Décisions et points ouverts

| Sujet | État |
|---|---|
| Azure Confidential Ledger | Candidat étudié, non choisi |
| Registre privé | Recommandation à confirmer selon régions et contrôle d'accès |
| UDF pré-hook compare-and-append | Mécanisme candidat ; preuve concurrente réelle requise |
| UDF ou UDE | À arbitrer après revue des permissions et du risque de contournement |
| Collection unique + tête par compte | Recommandation à tester |
| Auth Worker → ACL | Non prouvée ; custom TLS trust est le blocage principal |
| Passerelle dédiée | Option de repli candidate, non autorisée ni créée |
| Région et région jumelée | À choisir après analyse de résidence |
| Coût | À chiffrer ; aucun montant validé |
| Politique SOS si ACL indisponible | Ouverte |
| Récupération idempotente du transaction ID après réponse perdue | À prouver |
| Anti-restauration D1 | NO-GO production tant que l'ensemble du protocole n'est pas testé |

## 10. Références officielles

### Microsoft Azure
- [Présentation Azure Confidential Ledger](https://learn.microsoft.com/en-us/azure/confidential-ledger/overview)
- [Authentification Microsoft Entra ID](https://learn.microsoft.com/en-us/azure/confidential-ledger/authentication-azure-ad)
- [Bibliothèque REST JavaScript](https://learn.microsoft.com/en-us/javascript/api/overview/azure/confidential-ledger-rest-readme?view=azure-node-latest)
- [UDF et transaction hooks](https://learn.microsoft.com/en-us/azure/confidential-ledger/user-defined-functions)
- [UDE et RBAC personnalisé](https://learn.microsoft.com/en-us/azure/confidential-ledger/user-defined-endpoints)
- [Organisation et identifiants de transaction](https://learn.microsoft.com/en-us/azure/confidential-ledger/data-organization)
- [Statut et reçus de transaction](https://learn.microsoft.com/en-us/azure/confidential-ledger/write-transaction-receipts)
- [Résidence des données](https://learn.microsoft.com/en-us/azure/confidential-ledger/data-residency)
- [Tarification](https://azure.microsoft.com/en-us/pricing/details/confidential-ledger/)

### Cloudflare
- [Workers mTLS sortant](https://developers.cloudflare.com/workers/runtime-apis/bindings/mtls/)
- [Workers VPC — CA personnalisée et certificat client](https://developers.cloudflare.com/workers-vpc/configuration/vpc-services/)
- [Annonce du support CA personnalisée + mTLS dans Workers VPC, 18 novembre 2026](https://developers.cloudflare.com/changelog/post/2026-11-18-custom-ca-mtls/)

### Références SAC internes
- [Architecture de protection anti-restauration](ARCHITECTURE_PROTECTION_ANTI_RESTAURATION_V1.md)
- [Arbitrages techniques d'enrôlement des appareils](ARBITRAGES_TECHNIQUES_ENROLEMENT_APPAREILS_V1.md)

**Conclusion :** ACL reste le candidat prioritaire à tester, mais aucun service externe n'est choisi. Le compare-and-append via UDF est une piste technique prometteuse, pas encore une garantie homologuée pour SAC. Aucun endpoint, dépendance de production, migration, secret ou infrastructure réelle n'est autorisé par cette étude.
