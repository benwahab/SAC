# SAC — Audit de l'exemple Microsoft UDE pour le journal anti-restauration

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** audit documentaire d'un exemple public — aucune implémentation SAC, aucune ressource Azure et aucun test sur un vrai registre.  
**Objectif :** déterminer ce qui peut être réutilisé de l'exemple Microsoft Code Transparency UDE et ce qui doit être renforcé pour le journal de sécurité SAC.

## 1. Sources examinées

Dépôt Microsoft officiel :  
https://github.com/microsoft/azureconfidentialledger-app-samples/tree/main/code-transparency

Fichiers examinés :
- `code-transparency/app.json`
- `code-transparency/src/endpoints/entries.ts`
- `code-transparency/src/models/schema.ts`

Documentation Microsoft :
- UDE : https://learn.microsoft.com/en-us/azure/confidential-ledger/user-defined-endpoints
- Programmation serveur et comparaison UDF/UDE : https://learn.microsoft.com/en-us/azure/confidential-ledger/server-side-programming
- Reçus : https://learn.microsoft.com/en-us/azure/confidential-ledger/write-transaction-receipts

## 2. Ce que l'exemple confirme

L'exemple constitue une preuve de faisabilité architecturale limitée :
- une application TypeScript peut être déployée sous forme de bundle JavaScript dans le TEE du registre ;
- les routes déclarent explicitement leur mode `readonly` ou `readwrite` ;
- les routes mutantes sont configurées avec `forwarding_required: "always"` et `redirection_strategy: "to_primary"` ;
- l'authentification des routes est déclarée dans `authn_policies` ;
- les rôles personnalisés UDE peuvent autoriser des actions précises sur des routes ;
- l'application maintient un compteur de séquence et des entrées dans des tables KV CCF.

La documentation Microsoft indique que les UDE s'exécutent dans le TEE, prennent en charge le RBAC personnalisé et que seuls les administrateurs peuvent déployer l'application et gérer ce RBAC. Elle distingue les rôles intégrés Administrator, Contributor et Reader des rôles personnalisés définis par l'application.

## 3. Limites de l'exemple pour SAC

Le code public est un exemple de transparence logicielle, pas un protocole anti-retour-arrière prêt à l'emploi.

### 3.1 Pas de compare-and-append fourni par l'appelant

La fonction `nextSeqNo` lit le compteur courant, ajoute un, puis écrit la nouvelle valeur. Le code ne reçoit pas de séquence précédente attendue ni d'empreinte précédente attendue depuis le client. Il ne démontre donc pas le contrat SAC où une commande doit être rejetée si sa tête attendue est périmée.

### 3.2 Pas de clé d'idempotence de commande

Le schéma ne comporte pas de registre d'idempotence liant une clé de commande à un digest canonique. Après une réponse perdue, un renvoi peut donc créer une seconde entrée. SAC doit distinguer :
- même clé + même digest : retrouver le résultat déjà commis sans nouvelle transition ;
- même clé + digest différent : rejet de sécurité ;
- clé inconnue : nouvelle commande candidate.

### 3.3 Les écritures KV utilisent `set`

Les entrées sont écrites par `entryTable.set(entryId, entry)`. Le code d'exemple construit une clé avec le compteur, mais n'établit pas à lui seul une règle générale empêchant le remplacement d'une clé existante. SAC devra vérifier l'absence de la clé avant insertion et faire échouer la transaction si elle existe déjà. Les événements historiques ne doivent jamais être modifiés par une opération métier.

### 3.4 Le compteur et les entrées ne sont pas un reçu de transaction

La réponse UDE renvoie un identifiant d'entrée et une séquence métier. L'exemple consulté ne démontre pas que cette réponse contient le transaction ID natif ACL ni le reçu cryptographique Merkle associé. Il ne démontre pas non plus comment retrouver ce reçu après une réponse réseau perdue.

### 3.5 Le modèle de lecture n'est pas un mécanisme de preuve complet

Les routes de lecture parcourent les tables applicatives et renvoient les entrées. Cela peut aider à reconstruire une projection métier, mais il faut encore définir et vérifier :
- l'ordre total du journal natif ;
- la liaison de chaque événement métier à la transaction ACL correspondante ;
- la validation indépendante des reçus ;
- la reconstruction après incident sans dépendre d'une seule tête mutable.

## 4. Architecture UDE SAC candidate

Une route métier unique pourrait être exposée, par exemple `POST /sac/security-events`. Elle doit être configurée pour transférer chaque écriture au primaire (`forwarding_required: "always"`, `redirection_strategy: "to_primary"`) et fonctionner en mode `readwrite`.

Dans une transaction CCF unique, cette route devrait :
1. valider strictement le schéma, la version et la taille du message ;
2. calculer ou vérifier le digest canonique côté serveur ;
3. lire la tête du compte opaque ;
4. comparer la séquence attendue et l'empreinte précédente ;
5. vérifier l'identifiant idempotent et son digest ;
6. refuser toute clé d'événement déjà présente ;
7. écrire l'événement sous une clé jamais réutilisée ;
8. mettre à jour la tête et le registre d'idempotence ;
9. renvoyer un identifiant de commande et des métadonnées de résultat dont la sémantique est précisément documentée.

Toute erreur avant la fin doit annuler toutes les modifications KV de cette transaction. Il ne faut pas effectuer de requête réseau externe depuis le code UDE ni présenter plusieurs fournisseurs comme une transaction ACID distribuée.

## 5. Modèle d'autorisations indispensable

L'identité d'exécution SAC ne doit recevoir ni le rôle intégré Contributor ni Administrator par commodité.

Un rôle personnalisé minimal doit autoriser uniquement l'action de la route métier d'écriture et les lectures strictement nécessaires. Les identités de déploiement et de gouvernance doivent être séparées de l'identité d'exécution.

Les tests de refus doivent prouver que l'identité d'exécution :
- peut appeler la route métier autorisée ;
- ne peut pas appeler directement `POST /app/transactions` ;
- ne peut pas créer, modifier ou supprimer l'application UDE ;
- ne peut pas modifier les rôles, utilisateurs, politiques ou paramètres du registre ;
- ne peut pas supprimer le registre ni accéder aux routes d'administration ;
- ne peut pas appeler une autre route UDE mutante non autorisée.

**Réserve bloquante :** les exemples de documentation montrent la déclaration des rôles personnalisés et des actions de route, mais ne prouvent pas que toutes les routes natives d'écriture sont effectivement refusées à ce rôle dans la configuration SAC. Seul un test négatif sur un vrai registre pourra le démontrer.

## 6. Contrat de test à réaliser avant un prototype réel

Sur un registre de test vide, sans données personnelles ni données réelles SAC :

| Scénario | Résultat exigé |
|---|---|
| Deux commandes concurrentes avec la même séquence attendue | Une seule transition validée |
| Séquence attendue périmée | Rejet, état inchangé |
| Empreinte précédente incorrecte | Rejet, état inchangé |
| Même clé idempotente et même digest | Résultat initial retrouvé, aucun doublon |
| Même clé idempotente et digest différent | Rejet de sécurité |
| Clé d'événement déjà existante | Rejet, historique inchangé |
| Erreur après écriture de l'événement mais avant mise à jour finale | Rollback complet |
| Erreur après mise à jour de la tête | Rollback complet |
| Appel sur un réplica secondaire | Redirection au primaire ou refus sûr |
| Appel direct à l'API native d'écriture par l'identité SAC | Refus d'autorisation |
| Appel des routes UDE/admin non autorisées | Refus d'autorisation |
| Réponse perdue après commit | Résultat retrouvé sans append aveugle |
| Reçu natif | Récupéré et vérifié indépendamment |

Un faux transport local peut vérifier le contrat du client et ses reprises, mais ne prouve ni les transactions CCF, ni le RBAC réel, ni les reçus ACL, ni la résistance à la concurrence du service.

## 7. Conclusion

L'exemple Microsoft valide la forme générale d'une API métier UDE et d'un compteur séquentiel dans les tables CCF. Il ne valide pas les garanties anti-rejeu, d'idempotence, d'immutabilité des clés, de reçu, ni le verrouillage des routes natives requis par SAC.

**Décision technique proposée :** poursuivre l'étude UDE, pas UDF pré-hook. Ne pas ajouter de code UDE de production, de dépendance Azure, de migration, de route SAC, de compte, de tunnel ou de secret tant que les tests réels du registre, du RBAC, du reçu et de la reprise après réponse perdue ne sont pas concluants et que le fournisseur/région/coût n'ont pas été approuvés.

Aucune décision utilisateur n'est présumée par ce document.
