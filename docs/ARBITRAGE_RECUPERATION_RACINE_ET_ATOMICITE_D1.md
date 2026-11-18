# SAC — Arbitrage de cohérence : récupération de racine et opérations atomiques

**Date :** 18 novembre 2026  
**Statut :** audit documentaire et garde-fous de conception ; aucune fonctionnalité approuvée ou implémentée.

## 1. Constat prioritaire : la transition de racine reste interdite en V1

`docs/MACHINES_ETATS_ET_CONSERVATION.md`, section 3, indique explicitement que la transition de racine n'est pas définie et doit rester interdite en V1 tant qu'une procédure distincte n'est pas validée.

`docs/RECUPERATION_COMPTE_ET_RACINE.md` décrit des états et transitions candidats (`root_recovery_required`, `root_replacement_pending`, `root_active_new_generation`). Ce sont des propositions d'étude, pas une autorisation de réaliser une récupération de racine en V1.

**Règle consolidée :** V1 ne remplace, ne restaure et ne transfère jamais une racine. Si la racine est perdue ou compromise, le compte ne peut pas rétablir une identité cryptographique via OTP, support ou appareil secondaire. Le parcours de récupération de racine reste indisponible jusqu'à arbitrage produit, spécification normative et revue indépendante.

Le texte de récupération doit être lu comme une analyse de menace et une proposition pour une version ultérieure. Il ne doit pas être interprété comme une transition d'état déjà approuvée.

## 2. Distinguer révocation d'appareil et révocation de racine

- La révocation ordinaire d'un appareil secondaire reste une capacité prévue par le contrat de gestion des appareils.
- La révocation de l'appareil racine ne crée pas une nouvelle racine et ne transfère aucun privilège.
- Si la racine est révoquée ou déclarée compromise, les opérations qui exigent son approbation sont bloquées. Aucun appareil secondaire ne devient racine par succession automatique.
- L'accès au compte et le SOS sans GPS ne doivent pas être confondus avec l'autorité cryptographique de la racine ; les parcours de secours restent à spécifier avant activation.

## 3. Point critique D1 : batch atomique n'est pas conditionnel au sens métier

Les contrats D1 sont cohérents sur une limite fondamentale : `DB.batch()` est transactionnel et séquentiel, mais un `UPDATE` qui affecte zéro ligne n'est pas une erreur SQL et n'annule pas automatiquement les instructions suivantes.

Par conséquent, le motif suivant est interdit pour une révocation ou une récupération :

1. tenter de passer le compte ou la racine à l'état révoqué avec un `UPDATE ... WHERE ...` ;
2. supposer que zéro ligne affectée arrêtera le batch ;
3. poursuivre en invalidant des sessions, certificats ou cérémonies sans avoir prouvé la transition attendue.

Une future implémentation devra choisir et démontrer sur le runtime D1 isolé une forme SQL qui rend toutes les écritures dépendantes de la précondition, ou un mécanisme explicite de rollback transactionnel. Le simple fait que `batch()` se résolve n'est jamais un succès métier.

## 4. Conditions de conception avant toute implémentation

Pour toute opération future de révocation / récupération, la spécification devra préciser :

1. **Autorité** : acteur déterminé par session authentifiée et état D1 courant, jamais par `accountId`, `deviceId`, `rootDeviceId` ou `authVersion` fournis par le client.
2. **Précondition de transition** : compte, racine, appareil et génération attendus doivent être actifs et correspondre exactement à l'état courant.
3. **Unicité** : contrainte de données empêchant deux racines actives pour le même compte et deux remplacements concurrents ; la forme exacte dépendra du schéma final.
4. **Effets liés** : révocation, invalidation des sessions, certificats, abonnements push et cérémonies en attente doivent avoir une sémantique atomique documentée.
5. **Course approbation/révocation** : l'approbation doit revalider l'état de la racine dans son écriture finale ; après commit de révocation, aucune approbation signée par l'ancienne racine ne doit réussir.
6. **Idempotence** : commande répétée avec la même clé et le même contenu retourne le résultat enregistré ; même clé avec contenu différent est refusée.
7. **Audit minimal** : événement append-only sans OTP, jeton brut, secret, clé privée ni GPS.
8. **Panne et retry** : préciser le résultat après perte de réponse avant/après commit et prouver qu'aucun effet partiel ou doublon n'apparaît.

Ne pas rédiger de SQL définitif ou de migration avant stabilisation du schéma relationnel et des invariants.

## 5. Matrice de tests D1 exigée

| Scénario | Résultat attendu |
|---|---|
| Révocation avec session valide | Toutes les conséquences prévues sont présentes, ou aucune |
| Révocation avec acteur non autorisé | Aucune écriture métier |
| Révocation répétée | Résultat idempotent, aucun nouvel effet |
| Révocation et approbation concurrentes | Aucun appareil ne devient actif sur une racine déjà révoquée |
| Deux remplacements concurrents (si version ultérieure approuvée) | Au plus une génération peut être créée/activée |
| Batch dont une précondition ne correspond à aucune ligne | Aucun effet secondaire ne doit être validé |
| Échec SQL intermédiaire | Rollback complet du batch |
| Réponse réseau perdue après commit | Retry retourne le résultat déjà établi |
| Restauration d'un état client antérieur | L'état serveur courant prévaut ; appareil révoqué toujours refusé |

Ces tests doivent tourner sur D1 local/Preview isolé avec commandes concurrentes réelles. Des tests unitaires du seul évaluateur TypeScript ne prouvent pas les garanties transactionnelles.

## 6. Décisions ouvertes à ne pas inventer

- Le parcours de récupération de compte après perte de tous les appareils.
- Le traitement spécifique d'une racine perdue ou compromise en V1, sans remplacement de racine.
- Le maintien exact du SOS non-GPS pendant un blocage de sécurité et le niveau d'authentification exigé.
- La règle de notification aux contacts et le délai de sécurité.
- La procédure de version ultérieure pour créer une nouvelle racine et ré-ancrer les contacts.

## 7. Garde-fous

- Ne pas créer d'endpoint, de migration D1 ou de code de récupération de racine sur la base de ces propositions.
- Ne pas promouvoir automatiquement un appareil secondaire au rang de racine.
- Ne pas assimiler OTP valide à preuve de possession d'une clé racine.
- Aucun GPS réel ou historique GPS tant que le GO de destruction irréversible J+30 n'est pas démontré, y compris hors ligne, appareil éteint et après restauration.
- Aucun fournisseur, compte tiers ou ressource Cloudflare ne doit être créé sans autorisation explicite.

**Conclusion :** les contrats documentaires doivent être interprétés ensemble. La gestion/révocation d'appareils est un sujet prévu ; le remplacement de la racine est explicitement hors V1. Les opérations D1 doivent prouver l'atomicité métier, pas seulement l'atomicité SQL.