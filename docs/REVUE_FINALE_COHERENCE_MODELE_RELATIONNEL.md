# SAC — Revue finale de cohérence du modèle relationnel

Date : 18 novembre 2026  
Statut : revue documentaire du modèle conceptuel ; **non validé pour migration SQL**.  
Référentiel : `MODELE_GLOBAL_DONNEES_SAC.md`, proposition D1, revue critique, matrice de traçabilité, machines à états et contrats atomiques.  
Périmètre : intégrité référentielle, isolation entre comptes, cardinalités, suppression, concurrence, états, audit et domaines manquants.

## 1. Conclusion exécutive

Le modèle global est cohérent comme carte des domaines, mais il n'est pas encore un schéma relationnel final. Il reste des décisions produit ouvertes, des divergences entre contrats TypeScript et documentation, et des garanties qui ne peuvent pas être obtenues par de simples clés étrangères.

**Décision de cette revue : NON PRÊT POUR MIGRATION.**

Cette conclusion ne signifie pas que l'architecture est à recommencer. Elle signifie que la structure actuelle doit être normalisée et que les blocages listés ici doivent être résolus avant d'écrire du SQL.

Constats techniques :
- le répertoire `migrations/` ne contient actuellement qu'un README ; aucun schéma métier versionné n'a été trouvé lors de cette revue ;
- D1 `sac-db` est documentée comme vide dans le dernier audit connu ;
- le code de cycle de vie du compte accepte trois états alors que cinq états de compte sont validés ;
- les contrats d'alerte et de trajet ne sont pas encore alignés sur tous les scénarios documentés ;
- les domaines groupes, programmation SOS, SOS discret et paiements ne sont pas suffisamment spécifiés pour entrer dans une première migration ;
- les durées de conservation hors GPS ne sont pas décidées ;
- la destruction irréversible GPS J+30 n'est pas démontrée : GPS reste NO-GO.

## 2. Décisions de modélisation à retenir comme conventions

Ces conventions sont des recommandations de cohérence structurelle, pas une autorisation de migration :

1. **Une seule identité SAC :** `accounts` est la référence conceptuelle pour citoyens, proches et collaborateurs administratifs. Ne pas créer une seconde identité maîtresse `users`.
2. **Séparer identité et preuve :** le compte, ses coordonnées, leur vérification, ses appareils et ses sessions sont des objets distincts.
3. **Séparer relation et instantané :** une relation de confiance active autorise une sélection future ; l'instantané d'une alerte prouve qui a été sélectionné au déclenchement.
4. **Séparer réponse et responsabilité :** accusé, candidature, responsabilité effective et retrait ne sont pas un seul statut.
5. **Séparer état métier et livraison :** alerte active/clôturée, tâche outbox, tentative fournisseur, livraison et lecture ne sont pas interchangeables.
6. **Séparer rôle, permission et mission :** un rôle ne confère aucun droit implicite ; les missions sont créées et gérées par le Super Admin.
7. **Séparer état courant et historique :** les tables d'état courant ne remplacent jamais les événements nécessaires à la traçabilité.
8. **Aucune cascade destructive par défaut :** chaque FK reçoit une politique de suppression justifiée ; les alertes, décisions et événements ne sont jamais supprimés en cascade par simple suppression de compte.
9. **Aucune position GPS précise dans D1/R2/logs/analytics** tant que la preuve de destruction irréversible à J+30 n'est pas concluante.

## 3. Revue relation par relation

### 3.1 Compte, identité, défi, appareil, certificat et session

| Relation | Cardinalité attendue | Contrainte structurelle à exiger | Blocage |
|---|---|---|---|
| `accounts → account_identities` | 1:N | FK compte ; unicité du couple canal/valeur normalisée selon politique de vérification ; une seule identité primaire par canal si retenu | preuve téléphone/e-mail à préciser |
| `account_identities → auth_challenges` | 1:N | FK identité ; défi lié à sa finalité, expiration et consommation unique | anti-abus et stockage du vérificateur OTP à arbitrer |
| `accounts → user_devices` | 1:N | FK compte ; unicité d'un appareil racine actif par compte, sans transition implicite | procédure de remplacement de racine non définie |
| `user_devices → device_certificates` | 1:N | FK composite compte/appareil ; rotation versionnée ; statut révoqué/supplanté terminal | revue cryptographique indépendante requise |
| `user_devices → device_sessions` | 1:N | FK composite compte/appareil ; unicité du hash de jeton ; contrôle auth_version | politique transport/expiration admin à préciser |
| `user_devices → push_subscriptions` | 1:N | FK composite compte/appareil ; endpoint protégé et empreinte de déduplication | fournisseur et protection du endpoint à choisir |
| `device_pairing_challenges → appareils` | deux références au même compte | FK composites vers root et appareil en attente ; root actif au moment de la consommation | transcript cryptographique et transition racine ouverts |

**Point bloquant compte :** les états validés sont `pending_verification`, `active`, `suspended`, `deletion_pending`, `deleted`. `src/domain/account-lifecycle.ts` n'accepte actuellement que `active`, `deletion_pending`, `deleted`. Il ne faut pas migrer une contrainte SQL sur cinq états tant que le domaine TypeScript, les transitions suspension/réactivation et les tests n'ont pas été alignés.

La vérification e-mail est un fait séparé de l'état du compte. Le téléphone est obligatoire et conservé avec indicatif international, mais il n'est pas vérifié indépendamment. La proposition D1 ne doit donc pas marquer automatiquement le téléphone comme vérifié. L'acceptation d'un proche exige une preuve de destination ; le moyen exact reste un arbitrage, sans ajouter de SMS OTP par défaut.

### 3.2 Invitations, relations de confiance, préférences et groupes

| Relation | Cardinalité attendue | Contrainte structurelle à exiger | Blocage |
|---|---|---|---|
| `accounts → contact_invitations` | 1:N comme propriétaire | FK propriétaire ; jeton hashé unique ; expiration et statut terminal | preuve de destination et acceptation à harmoniser |
| `contact_invitations → trusted_contacts` | 0:1 relation créée à acceptation | création atomique après consentement et preuve validée | moyen de vérification non arbitré |
| `accounts → trusted_contacts` | N:N directionnelle via table | deux FK comptes ; propriétaire différent du proche ; unicité propriétaire/proche | conservation après révocation à définir |
| `trusted_contacts → contact_alert_preferences` | 1:N | FK relation ; unicité relation/catégorie | valeurs de catégories contrôlées |
| `groups → group_members` | 1:N | FK groupe et compte ; unicité groupe/compte ; invitation/consentement distincts | modèle de groupes absent de la proposition D1 |
| `accounts → groups` | 1:N propriétaire | FK propriétaire ; droits du propriétaire définis séparément | limites et cycle de vie à spécifier |

Un groupe n'est jamais une relation de confiance et ne donne jamais automatiquement accès à une alerte, une position, un dossier ou un compte. L'appartenance à un groupe ne doit pas servir de raccourci d'autorisation.

Les tables groupes ne sont pas prêtes à migrer : il manque les règles d'invitation, d'acceptation, de retrait, de transfert de propriété, de suppression, de limite par formule et d'effet sur les alertes déjà actives.

### 3.3 Alertes, destinataires, réponses et responsabilité

| Relation | Cardinalité attendue | Contrainte structurelle à exiger | Blocage |
|---|---|---|---|
| `accounts → alerts` | 1:N auteur | FK auteur ; état et version attendue | état et clôture administrative à aligner |
| `alerts → alert_recipients` | 1:N, instantané immuable | unicité alerte/compte ; destinataire différent de l'auteur ; FK composite de référence | politique de conservation et accès après révocation |
| `alert_recipients → alert_responses` | 1:N ou historique d'actions | chaque réponse doit appartenir à un destinataire figé de cette alerte | politique de réponse après révocation à arbitrer |
| `alerts → alert_events` | 1:N append-only | FK alerte ; séquence monotone ; acteur et type contrôlés | immutabilité technique et conservation à définir |
| `alerts → alert_responsibility_history` | 1:N périodes | une seule période courante par alerte ; historique sans chevauchement | priorité entre volontaires à confirmer |
| `alerts → admin_alert_reviews` | 1:N examens | FK alerte ; motif et autorité spécifiques | exception de clôture strictement bornée |

Les clés étrangères ne peuvent pas, à elles seules, prouver qu'une réponse provient d'un destinataire autorisé : il faut une FK composite vers l'instantané et un contrôle d'autorisation serveur. L'auteur ne peut pas être son propre destinataire.

La responsabilité principale est une projection de l'historique : une seule personne peut être responsable à la fois. L'accusé ne devient pas une candidature ; la candidature ne devient pas une responsabilité avant confirmation serveur. La course entre deux volontaires, retrait, révocation et clôture doit être réglée par opérations atomiques idempotentes.

**Clôture :**
- règle ordinaire : l'auteur clôture ;
- exception déjà validée : dans le scénario spécifique du titulaire suspendu et d'une suspicion d'abus/perte de téléphone, seul le Super Admin ou l'Administrateur sécurité ayant la permission nominative dédiée clôture après vérification ;
- cette exception ne crée aucun droit général de clôture pour l'administration ou les contacts.

Le contrat `src/domain/alert-lifecycle.ts` représente actuellement seulement `active` et `closed_by_author`. Il n'intègre pas encore l'exception administrative. Le modèle devra distinguer l'autorité de clôture, le motif et l'événement d'audit, sans permettre à un administrateur de clôturer toute alerte.

### 3.4 Notifications, push, outbox et rappels

| Relation | Cardinalité attendue | Contrainte structurelle à exiger | Blocage |
|---|---|---|---|
| `accounts/devices → push_subscriptions` | 1:N | FK composite compte/appareil ; abonnement révocable indépendamment | fournisseur et format |
| `alerts → notification_outbox` | 1:N | référence métier, destinataire initial, canal, occurrence et clé d'idempotence | reprise et sémantique fournisseur |
| `notification_outbox → notification_attempts` | 1:N | tentative horodatée, résultat distinct du statut de tâche | conservation et purge à définir |

Les règles SOS validées restent : push prioritaire ; rappels toutes les cinq minutes ; le lanceur choisit de 1 à 5 rappels avant escalade SMS, valeur présélectionnée 2 ; le SMS ne part au seuil que si aucun responsable principal n'est effectivement attribué ; seuls les destinataires initiaux sont concernés ; les rappels push continuent jusqu'à clôture par l'auteur.

L'outbox doit supporter :
- clé de déduplication unique par alerte/destinataire/canal/occurrence ;
- compteur d'essais et prochaine échéance ;
- bail worker avec propriétaire et expiration ;
- reprise après bail expiré ;
- résultat fournisseur distinct de la livraison et de la lecture ;
- annulation des tâches non envoyées après clôture ;
- revalidation de l'état de l'alerte, du destinataire et de l'abonnement juste avant envoi.

Un batch D1 qui réussit syntaxiquement mais ne modifie aucune ligne ne prouve pas qu'une transition conditionnelle a réussi. Chaque opération doit contrôler les lignes affectées de chaque instruction ; les écritures secondaires ne doivent pas être appliquées si la transition principale n'a pas eu lieu. Les opérations conditionnelles doivent être conçues pour rendre les états invalides impossibles dans la transaction, puis testées avec concurrence et rejeu.

### 3.5 Trajets et contrôles d'arrivée

| Relation | Cardinalité attendue | Contrainte structurelle à exiger | Blocage |
|---|---|---|---|
| `accounts → trips` | 1:N auteur | FK auteur ; mode et état contrôlés | états code/doc divergents |
| `trips → trip_participants` | 1:N instantané | unicité trajet/compte ; destinataire différent de l'auteur | droits après révocation à préciser |
| `trips → arrival_checks` | 0:1 ou 1:1 selon mode | contrainte conditionnelle liée au mode | détails de relance non finalisés |
| `trips → trip_events` | 1:N | chronologie append-only, événements autorisés selon mode | choix entre table dédiée et événement typé |

Le code `src/domain/trip-protection.ts` utilise `active` et `closed_by_author`. La documentation décrit aussi `completed`, `cancelled`, `expired`. Avant SQL, il faut choisir une représentation unique : état terminal générique avec motif/acteur, ou états terminaux distincts. Il faut également préciser si l'expiration système arrête seulement le contrôle d'arrivée ou clôture le trajet entier.

Aucune coordonnée GPS, géohash, adresse préremplie ou payload de position ne doit être persisté dans D1/R2/logs. Les champs libres ne doivent pas être alimentés automatiquement par la localisation.

### 3.6 Abonnements, paiements et droits Premium

| Relation | Cardinalité attendue | Contrainte structurelle à exiger | Blocage |
|---|---|---|---|
| `accounts → subscriptions` | 1:N historique | FK compte ; une seule souscription effective selon règle commerciale | cycle de facturation à arbitrer |
| `plans → subscriptions` | 1:N | plan versionné et limites historisées | catalogue final non arrêté |
| `subscriptions → payment_transactions` | 1:N | référence prestataire unique dans son périmètre ; montant et devise immuables | fournisseur, renouvellement, remboursement |
| `payment_transactions → payment_provider_events` | 1:N | identifiant événement prestataire unique ; signature et rejeu vérifiés | contrat webhook à concevoir |
| `accounts → entitlements` | 1:N ou calcul serveur | droits calculés depuis preuves serveur ; aucune confiance au client | matérialisation ou calcul à décider |

Règles produit actuellement documentées : gratuit jusqu'à 2 proches ; Premium jusqu'à 10 proches ; référence tarifaire 5 000 FCFA/mois. Les autres avantages et le cycle financier restent à confirmer. Les objets financiers sont absents de la première proposition D1 ; ils ne doivent pas être ajoutés avant le sous-modèle, le choix du prestataire et la revue anti-fraude.

### 3.7 Administration, missions et audit

Les objets administratifs doivent référencer `accounts` comme identité canonique. Les affectations de rôles, missions, permissions, périmètres, dossiers d'accès, décisions de clôture, exports et audits sont des relations distinctes.

Une mission doit être liée à un bénéficiaire, au Super Admin créateur, à une période, un périmètre et des permissions explicites. Aucun délégataire ne peut en créer ou modifier une autre. Les exports nécessitent une permission séparée de la lecture. Le Super Admin et les administrateurs ne peuvent pas réécrire les événements historiques.

Le journal append-only applicatif n'est pas une preuve d'immutabilité absolue : sauvegardes, restauration, accès opérateur et mécanisme de scellement restent à auditer. Les durées de conservation et les mécanismes d'intégrité ne sont pas définis.

## 4. Politique de suppression et références historiques

La règle globale est **pas de ON DELETE CASCADE aveugle**. La politique par défaut à examiner est :
- compte vers sessions, défis, appareils : révocation/expiration explicite, puis purge selon politique ;
- compte vers alertes/trajets : conservation des activités ouvertes ; aucune suppression en cascade ;
- alerte vers destinataires, réponses, événements, décisions : conservation selon durée validée et minimisation ;
- relation de confiance vers préférences : fermeture/révocation, sans effacer les instantanés déjà créés ;
- mission vers permissions de mission : fermeture de mission et conservation des événements d'audit ;
- transaction vers événements prestataire : conservation selon obligations financières ;
- notifications : conservation de métadonnées minimales, sans payload sensible.

Cette liste est une orientation, pas une politique de rétention approuvée. Il reste à déterminer les durées, le droit applicable, les finalités, la pseudonymisation, les sauvegardes et la preuve de purge. Une FK restrictive peut préserver l'intégrité mais bloquer la suppression physique ; une anonymisation peut être nécessaire, mais ne doit pas être inventée avant arbitrage.

La finalisation de suppression de compte doit être atomique et recalculer côté serveur l'absence d'alertes/trajets actifs. Les compteurs fournis par le client ne sont jamais une preuve. Le traitement d'un compte suspendu, d'un compte supprimé présent dans l'historique et d'une alerte orpheline hors scénario spécial reste à définir.

## 5. Concurrence et opérations qui exigent un contrat atomique

| Opération | Course à traiter | Garantie attendue |
|---|---|---|
| Création compte / identité | deux inscriptions revendiquent la même identité | unicité transactionnelle, aucun compte partiellement créé |
| OTP | deux consommations ou changement d'objectif | une consommation, finalité liée, limite d'essais |
| Approbation appareil | deux appareils en attente / root révoqué | root valide à la consommation, une cérémonie unique |
| Création alerte | révocation relation/contact simultanée | destinataires validés et instantané créé ensemble |
| Réponse SOS | deux accusés/candidatures simultanés | historique conservé, pas de réponse hors instantané |
| Prise de responsabilité | deux volontaires ou retrait concurrent | un seul principal courant |
| Escalade SMS | attribution principale au moment du seuil | aucun SMS si un principal est attribué avant la décision atomique |
| Worker outbox | deux workers / bail expiré / timeout fournisseur | traitement idempotent, résultat ambigu réconcilié |
| Clôture | clôture auteur vs rappel/transfert | un seul état final, aucune nouvelle tâche après clôture |
| Révocation | retrait de relation/appareil pendant action sensible | ordre serveur défini, autorisation relue dans l'écriture finale |
| Suppression compte | suppression vs alerte/trajet/notification | aucune activité orpheline par course transactionnelle |
| Clôture administrative | deux demandes ou révocation mission concurrente | autorisation spéciale active à la décision, une clôture effective |
| Paiement | webhook répété, inversé ou hors ordre | vérification signature, idempotence et état financier cohérent |

Les contrats D1 doivent utiliser des conditions d'écriture atomiques et vérifier les résultats de chaque instruction. Une transaction batch annule les erreurs SQL, mais une mise à jour conditionnelle à zéro ligne peut ne pas produire d'erreur SQL. Aucun contrôleur ne doit interpréter une réponse sans exception comme preuve de succès métier.

## 6. Incohérences bloquantes classées

### P0 — à résoudre avant toute migration

1. États compte : cinq états validés, trois états dans le domaine TypeScript.
2. Identité de contact : téléphone déclaré non vérifié, alors que l'acceptation du proche demande une destination vérifiée.
3. Clôture administrative : exception validée absente du contrat pur d'alerte ; l'autorité doit être explicitement modélisée.
4. Droits après révocation : rappels initiaux validés, mais lecture du détail et réponse/prise en charge après révocation encore ouverts.
5. Suppression et conservation : durées hors GPS, anonymisation, audit, historiques et alertes orphelines non arbitrés.
6. Trajets : états TypeScript et documentation divergents.
7. GPS J+30 : destruction irréversible non démontrée, donc aucun stockage GPS précis.
8. Atomicité D1 : chaque contrat doit vérifier les lignes affectées et couvrir les courses multi-table.

### P1 — sous-modèles nécessaires avant le périmètre fonctionnel correspondant

1. Groupes privés et invitations.
2. SOS programmé et SOS discret.
3. Abonnements, paiements, webhooks et droits Premium.
4. Sessions administratives et step-up.
5. Journal d'audit : scellement, rétention, restauration et séparation des opérateurs.
6. Outbox complète : baux, tentatives, déduplication et résultats fournisseur.

### P2 — optimisation après stabilisation

1. Index fondés sur les requêtes réellement utilisées et leurs plans.
2. Partitionnement logique ou archivage si les volumes le nécessitent.
3. Agrégats de tableau de bord recalculables, jamais sources de vérité.
4. Purges par lots et mécanismes de reprise audités.

## 7. Décisions à ne pas prendre implicitement

Cette revue ne tranche pas :
- le moyen de vérification de destination des proches ;
- les droits exacts après révocation pendant une alerte ;
- la gestion d'une alerte orpheline hors exception administrative validée ;
- le modèle final des groupes ;
- les états et durées des trajets ;
- le cycle commercial Premium et le prestataire de paiement ;
- les durées de conservation hors GPS ;
- la stratégie de pseudonymisation et d'intégrité de l'audit ;
- le remplacement de l'appareil racine ;
- les sessions et contrôles renforcés des administrateurs.

## 8. Ordre de fermeture des blocages

1. Réconcilier les cinq états du compte avec les contrats TypeScript et les tests.
2. Décider le parcours de preuve d'identité d'un proche sans ajouter d'OTP SMS de compte par défaut.
3. Décider les droits lecture/réponse/prise en charge après révocation.
4. Harmoniser les états d'alerte et de trajet, en conservant motif et autorité de clôture distincts.
5. Finaliser suppression, conservation et politique des alertes orphelines.
6. Faire valider les modèles groupes, programmation/SOS discret et finance.
7. Finaliser les contraintes composites, les FK et la politique `ON DELETE` table par table.
8. Compléter les contrats atomiques et tests D1 de concurrence/idempotence.
9. Faire une revue indépendante sécurité, cryptographie, confidentialité et paiements.
10. Autoriser séparément la création de migrations.

## 9. Conditions d'acceptation d'un futur schéma SQL

Aucun schéma ne sera déclaré prêt tant que :
- chaque table a une finalité, un propriétaire, une classe de données et un cycle de vie ;
- chaque relation a une cardinalité, une FK, une politique de suppression et un test d'intégrité ;
- chaque donnée multi-compte est isolée par des références composites ou des contrôles serveur prouvés ;
- chaque transition sensible a une condition d'état/version et une preuve de lignes affectées ;
- chaque opération multi-table a un contrat transactionnel, une clé d'idempotence et des tests de course ;
- les cinq états de compte sont cohérents dans produit, code, contrats et SQL ;
- les droits de chaque destinataire après révocation sont décidés ;
- les groupes, SOS programmés/discrets et paiements sont spécifiés avant leur migration ;
- la conservation hors GPS et les règles de suppression/anonymisation sont approuvées ;
- le GPS reste absent tant que la preuve J+30 n'est pas indépendante et concluante ;
- Preview est prouvé isolé de Production ;
- une autorisation explicite distincte est donnée pour créer/appliquer les migrations.

## 10. Périmètre de cette intervention

Travail documentaire uniquement. Aucun fichier applicatif, test, API, migration, base D1, ressource Cloudflare ou déploiement n'a été modifié. Les recommandations de cette revue ne constituent pas des décisions produit nouvelles.

**Verdict : le modèle est suffisamment cartographié pour fermer les arbitrages, mais pas prêt pour migration D1.**


## 11. Détail du premier blocage P0

Le document `ARBITRAGE_P0_CYCLE_COMPTE_ET_PREUVE_PROCHES.md` détaille les transitions de compte, l'écart TypeScript, les invariants d'OTP, le modèle logique des invitations et la preuve de consentement. Le blocage reste ouvert tant que les transitions non arbitrées et le parcours des proches ne sont pas décidés et que le contrat de domaine n'est pas aligné dans une intervention de code autorisée.
