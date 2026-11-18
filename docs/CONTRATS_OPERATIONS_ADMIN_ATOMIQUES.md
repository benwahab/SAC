# SAC — Contrats atomiques des opérations administratives

Date : 18 novembre 2026  
Statut : conception technique à valider — non implémentée.  
Prérequis : lire `CONTRATS_OPERATIONS_ATOMIQUES_D1.md`, `CATALOGUE_RESSOURCES_MATRICE_PERMISSIONS.md`, `GOUVERNANCE_MISSIONS_ADMIN_ET_CYCLE_DE_VIE.md`, `CLASSIFICATION_DONNEES_ET_ACCES_ADMIN.md` et `MODELE_MENACES_ET_PLAN_SECURITE_ADMIN.md`.

## 1. Objet et limites

Ce document décrit les contrats transactionnels attendus pour les opérations administratives sensibles : création et évolution d'une mission, attribution/retrait de permissions, suspension d'un compte, clôture administrative d'une alerte dans le scénario spécifique déjà défini, consultation sensible et export.

Il ne crée aucune API, permission active, table, migration, tâche planifiée, ressource Cloudflare ou interface. Les noms d'états et de colonnes sont conceptuels tant qu'un modèle D1 final n'est pas approuvé.

## 2. Invariants communs à chaque commande

Chaque commande sensible doit :
1. recevoir une identité de session, jamais un rôle ou une permission déclarés comme fiables par le navigateur ;
2. relire côté serveur l'état du compte acteur et de sa session ;
3. vérifier l'autorité Super Admin ou la permission administrative atomique explicitement accordée ;
4. vérifier la mission active, sa période, son périmètre et l'absence de suspension/révocation ;
5. vérifier l'état courant de la ressource cible ;
6. exiger une clé d'idempotence pour les commandes à effets externes ou transitions non répétables ;
7. exécuter les mutations métier et la création des événements d'audit dans une même frontière transactionnelle ;
8. produire les notifications via outbox après commit, jamais avant ;
9. retourner un résultat métier stable, sans secret ni donnée hors périmètre.

Une vérification TypeScript préalable améliore les messages d'erreur mais ne ferme pas une course. Les conditions critiques doivent être dans les prédicats SQL d'écriture ou dans une transaction dont les résultats sont explicitement contrôlés.

## 3. Sémantique transactionnelle D1

- Ne jamais supposer qu'un batch a échoué parce qu'une instruction valide a affecté zéro ligne.
- Pour chaque instruction conditionnelle, vérifier le nombre de lignes affectées et empêcher toute écriture dépendante si la précondition n'a pas été satisfaite.
- Préférer des commandes transactionnelles explicites ou une chaîne SQL conditionnelle dont chaque étape dépend du succès vérifiable de la précédente.
- Si une transaction multi-instructions ne peut pas exprimer un branchement sûr, scinder le flux en commandes courtes avec état intermédiaire explicite et idempotence ; ne pas simuler une atomicité inexistante.
- Utiliser des contraintes uniques et clés étrangères lorsque pertinentes, plus des contraintes CHECK pour les états et valeurs autorisés.
- Stocker les instants en UTC et utiliser l'heure serveur ; le client ne fournit jamais l'horodatage d'autorité.
- Les tests doivent provoquer des courses réelles avec plusieurs requêtes concurrentes, pas seulement tester des fonctions pures.

## 4. Contrat — créer une mission

**Acteur :** Super Admin uniquement.

**Préconditions :**
- session valide et compte actif ;
- acteur authentifié comme Super Admin par une source serveur ;
- bénéficiaire existant et éligible ;
- permissions atomiques reconnues, périmètre explicite, motif et échéance renseignés ;
- dates cohérentes et durée conforme aux limites finalement approuvées.

**Écritures atomiques :**
- créer la mission dans l'état brouillon ou dans l'état explicitement prévu par le parcours validé ;
- associer les permissions détaillées et leur périmètre ;
- enregistrer l'événement d'audit avec l'acteur, la référence, le motif et les changements ;
- créer, si nécessaire, une notification d'attribution dans l'outbox.

Aucun droit n'est actif avant une activation explicite conforme au cycle de vie. Un délégataire ne peut pas créer, copier, étendre ou transmettre une mission.

**Idempotence :** une répétition avec la même clé retourne la mission initialement créée et ne crée pas de doublon.

## 5. Contrat — activer, modifier, suspendre, reprendre ou révoquer une mission

Chaque transition est une commande distincte avec un état source attendu et un état cible autorisé.

**Contrôles :**
- seul le Super Admin peut effectuer ces transitions ;
- vérifier la version de mission attendue (optimistic concurrency) ;
- refuser toute transition depuis un état terminal non réactivable ;
- toute modification de périmètre/permissions crée une nouvelle version auditable ;
- suspension/révocation bloque immédiatement les nouvelles autorisations côté serveur ;
- les workers, exports, tâches longues et caches doivent revalider l'état avant chaque étape irréversible.

**Écritures atomiques :**
- mise à jour conditionnelle de l'état et de la version ;
- fermeture/invalidation des autorisations différées associées ;
- événement d'audit append-only ;
- notification outbox éventuelle.

Une opération qui ne modifie aucune ligne doit retourner un conflit ou un refus explicite, jamais annoncer un succès.

## 6. Contrat — suspension administrative d'un compte

**Acteur :** Super Admin, selon la politique approuvée.

**Préconditions :**
- compte cible existant et état compatible ;
- motif obligatoire ;
- référence de dossier si nécessaire ;
- session acteur valide.

**Écritures atomiques :**
- transition du compte vers `suspended` avec version ;
- révocation des sessions actives et invalidation des capacités administratives de cet utilisateur ;
- conservation des alertes SOS déjà transmises et de leur continuité selon les règles validées ;
- journal append-only contenant acteur, cible, motif, horodatage et corrélation ;
- notification outbox si la politique de notification le prévoit.

La suspension du compte ne clôture, n'efface ni ne met automatiquement en pause une alerte déjà transmise. Les règles spécifiques au titulaire suspendu et à la clôture par l'administration sont décrites dans les décisions dédiées.

## 7. Contrat — clôture administrative d'une alerte dans le scénario de titulaire suspendu

Ce contrat ne généralise pas la clôture administrative à toutes les alertes. Il couvre le scénario validé où le titulaire est suspendu et où une suspicion d'abus ou une perte de téléphone impose que l'administration garde la décision finale.

**Autorité :**
- Super Admin ;
- Administrateur sécurité uniquement si la permission nominative de clôture lui a été explicitement accordée ;
- Support, Auditeur, titulaire suspendu et contacts : aucun droit de clôture.

**Préconditions à revérifier au commit :**
- alerte active et référence exacte ;
- permission spéciale toujours valide ;
- acteur/session/mission autorisés ;
- vérifications administratives consignées ;
- décision motivée ;
- aucun événement concurrent n'a déjà clôturé l'alerte.

**Écritures atomiques :**
- transition conditionnelle de l'alerte active vers clôturée ;
- enregistrement de l'identité de l'administrateur, du motif, des éléments de vérification référencés et de l'heure serveur ;
- création des événements de clôture et de notification individuelle pour les destinataires initiaux dans l'outbox ;
- conservation de tous les accusés, interventions et mises à jour antérieurs.

Les notifications ne contiennent que la confirmation de clôture administrative et sa date/heure. Elles n'exposent ni notes internes, ni échanges privés, ni coordonnées d'autres contacts.

**Concurrence :** si deux administrateurs tentent de clôturer simultanément, une seule transition gagne. L'autre reçoit l'état final et ne génère ni deuxième clôture ni deuxième série de notifications. Un échec de livraison est tracé et ne réouvre pas automatiquement l'alerte.

## 8. Contrat — consultation sensible

Avant chaque lecture de données C2/C3 :
- authentifier l'acteur et vérifier son compte/session ;
- vérifier une mission active et la permission de lecture ;
- vérifier le dossier et le périmètre exacts ;
- appliquer masquage/minimisation selon la finalité ;
- écrire une trace de consultation sans recopier le contenu privé ;
- ne pas révéler l'existence d'une ressource à un acteur non autorisé.

La pagination, les pièces jointes et les appels secondaires doivent répéter le contrôle d'accès. Une autorisation obtenue sur la première page ne vaut pas autorisation permanente pour la suite.

## 9. Contrat — préparer et télécharger un export

Un export exige une permission distincte de lecture et une permission explicite d'export. Les deux ne se déduisent pas l'une de l'autre.

**Préparation :**
- vérifier acteur, mission, périmètre, motif, filtres et champs autorisés ;
- créer une demande d'export auditée ;
- générer uniquement les champs permis ;
- protéger le fichier en stockage privé et associer propriétaire, portée, expiration et état ;
- ne jamais intégrer de secrets, clés, OTP ou GPS précis.

**Téléchargement :**
- réauthentifier et revalider l'autorisation, la mission, le périmètre, le bénéficiaire et l'expiration ;
- refuser un lien expiré, révoqué ou transféré à un autre utilisateur ;
- tracer le téléchargement et son résultat ;
- supprimer ou rendre inaccessible le fichier à expiration selon une politique de conservation validée.

Une révocation doit bloquer un téléchargement ultérieur, même si le fichier a déjà été préparé. La durée d'expiration, le chiffrement et la purge restent à arbitrer avant implémentation.

## 10. Contrat — audit append-only

Toute mutation sensible et tout refus de sécurité pertinent produit un événement d'audit côté serveur.

Champs conceptuels :
- identifiant d'événement ;
- horodatage UTC serveur ;
- acteur, rôle et mission au moment de l'action ;
- action, résultat, ressource et périmètre ;
- motif et référence de corrélation ;
- version de l'objet avant/après ou empreintes non sensibles si nécessaires.

Ne jamais enregistrer les mots de passe, OTP, jetons bruts, clés privées, secrets de récupération, GPS précis ou corps complets de messages privés.

La mutation métier et son événement d'audit doivent réussir ensemble. Si l'audit obligatoire échoue, la mutation sensible ne doit pas être validée. Le mécanisme physique d'immutabilité, de scellement, de réplication et de conservation reste à concevoir.

## 11. Matrice des courses concurrentes

| Course | Résultat obligatoire |
|---|---|
| Suspension de mission / requête administrative | Si suspension commit en premier, requête refusée ; sinon action déjà validée reste auditée selon sa frontière de commit |
| Révocation / export | Aucun téléchargement autorisé après commit de révocation |
| Suspension compte / connexion | Une connexion ne peut créer une session valide après commit de suspension |
| Deux clôtures admin | Une seule clôture et une seule série d'événements de notification |
| Clôture / accusé ou intervention | Aucun événement antérieur supprimé ; transition finale cohérente et chronologie conservée |
| Modification de permission / ancienne session | Les droits sont recalculés côté serveur ; aucun cache ancien ne prolonge l'autorisation |
| Deux modifications de mission | Contrôle de version ; une seule mise à jour attendue gagne, l'autre doit relire et recommencer explicitement |
| Révocation / worker outbox | Aucun nouveau claim ni nouvel envoi si la politique et l'état de révocation l'interdisent |

La règle « qui gagne » doit être déterminée par l'ordre transactionnel confirmé au commit, pas par l'heure locale des appareils.

## 12. Idempotence, erreurs et observabilité

- Les commandes à effets doivent accepter une clé d'idempotence liée à l'acteur, à l'opération et à la ressource.
- Une même clé avec un contenu différent est rejetée.
- Les résultats initiaux sont conservés pour répondre aux répétitions sans refaire l'effet.
- Les erreurs exposées au client sont génériques lorsque détailler l'échec révélerait une ressource protégée.
- Les logs techniques contiennent un identifiant de corrélation, pas des secrets ni des copies de données privées.
- Distinguer refus d'autorisation, conflit d'état, répétition idempotente, indisponibilité et échec fournisseur.

## 13. Tests d'intégration et de concurrence

Tests minimums :
1. mission créée par un délégataire : refus ;
2. permission absente, expirée ou révoquée : refus ;
3. changement de périmètre et version obsolète : conflit ;
4. suspension mission pendant une requête : résultat conforme à l'ordre de commit ;
5. suspension compte contre connexion simultanée ;
6. clôture par Support/Auditeur/contact/titulaire suspendu : refus ;
7. clôture par Administrateur sécurité sans permission dédiée : refus ;
8. deux clôtures simultanées : une seule transition ;
9. échec de l'écriture audit : aucune mutation sensible validée ;
10. révocation après préparation d'export : téléchargement refusé ;
11. lien d'export utilisé par un autre compte : refus ;
12. pagination et pièce jointe hors périmètre : refus ;
13. rejeu d'une clé d'idempotence : aucun doublon ;
14. même clé avec payload différent : refus ;
15. worker après révocation : aucune tâche non autorisée ;
16. aucune donnée secrète dans réponses, erreurs et logs.

## 14. Points restant à arbitrer

- Modèle de données final et stratégie exacte de versionnement.
- Choix précis des primitives D1 pour transactions conditionnelles et vérification des lignes affectées.
- Expiration, chiffrement, stockage et purge des exports.
- Durée de conservation, scellement et réplication des audits.
- Sessions administratives et authentification renforcée pour actions critiques.
- Politique d'acceptation des missions et éventuelle notification du bénéficiaire.
- Revue indépendante sécurité, cryptographie et conformité.

## 15. Conditions d'implémentation

Avant tout code ou migration : valider les décisions ouvertes, établir le schéma D1, formaliser les requêtes conditionnelles, écrire les tests de concurrence, faire une revue indépendante, puis obtenir une autorisation explicite distincte pour l'implémentation.

Aucun élément de ce document ne rend une permission, une console, une API, un export ou un processus administratif opérationnel.
