# SAC — Machines à états métier et transitions

**Statut :** spécification de travail à relire avant toute migration D1.  
**Portée :** comptes, identités, appareils, invitations, contacts, alertes, responsabilités, notifications et trajets.  
**Ce document n'est pas du SQL et n'autorise aucun déploiement.** Les états proposés doivent être traduits en contrats de domaine puis testés avant la création des tables.

## 1. Règles transversales

1. Toute transition est exécutée côté serveur après authentification et autorisation de l'acteur.
2. Le client demande une action ; il ne choisit jamais directement le nouvel état en envoyant `status: ...`.
3. Chaque transition sensible produit un événement d'audit non sensible et horodaté.
4. Une transition conditionnelle doit vérifier l'état précédent attendu. Deux demandes concurrentes ne peuvent pas toutes deux réussir si une seule transition est autorisée.
5. Les répétitions réseau doivent être idempotentes : une même commande ne doit pas créer deux alertes, deux prises en charge ou deux rappels pour la même occurrence.
6. Une erreur de notification ne modifie jamais l'état métier de l'alerte.
7. Aucune coordonnée GPS précise, clé privée, OTP, jeton brut ou secret de cérémonie ne doit être placé dans les événements ou les journaux.
8. Les statuts de transport (notification) ne sont pas confondus avec les statuts métier (alerte, invitation, appareil).
9. Toute transition non listée est refusée par défaut.
10. Les heures sont produites par le serveur et conservées en UTC.

## 2. Compte et identités de contact

### 2.1 Compte

États conceptuels :
- `active`
- `suspended`
- `deletion_pending`
- `deleted` (état terminal logique, si la politique de suppression le retient)

Transitions proposées :

| État courant | Commande / acteur | État suivant | Conditions |
|---|---|---|---|
| absent | créer compte / visiteur vérifié | active | identité vérifiée, anti-abus et création atomique |
| active | suspendre / système autorisé | suspended | motif interne, audit |
| suspended | réactiver / support habilité ou procédure définie | active | identité et contrôle de sécurité vérifiés |
| active | demander suppression / propriétaire | deletion_pending | authentification forte, alerte active traitée selon politique |
| deletion_pending | finaliser / système | deleted | délais et conservation légale/métier validés |
| deletion_pending | annuler / propriétaire | active | seulement avant finalisation et après réauthentification |

La suppression d'un compte ne doit pas supprimer en cascade les alertes en cours ou l'historique nécessaire à la sécurité. Les données conservées doivent être minimisées ou pseudonymisées selon une matrice validée. La durée de conservation hors GPS reste à décider.

### 2.2 Identité (téléphone ou e-mail)

États :
- `unverified`
- `verified`
- `change_pending`
- `revoked`

Règles :
- seule une validation serveur du défi permet `unverified → verified` ;
- changement d'identité : vérifier la nouvelle valeur avant de la rendre primaire ;
- une identité primaire ne peut pas être remplacée par une valeur non vérifiée ;
- une identité déjà attribuée à un autre compte ne peut pas être revendiquée ;
- limitation d'essais et d'envois, réponses anti-énumération et consommation atomique du défi obligatoires ;
- récupération de compte et réinitialisation de l'authentification ne rétablissent jamais la confiance cryptographique GPS perdue.

Les transitions exactes d'une identité en cours de changement et les délais de grâce restent à définir avec le mécanisme OTP choisi.

## 3. Appareils, certificats et sessions

### 3.1 Appareil

États :
- `pending_verification`
- `active`
- `revoked` (terminal pour cette identité d'appareil)

Transitions :
- `absent → pending_verification` : enrôlement demandé et authentification acceptée ;
- `pending_verification → active` : approbation par l'appareil racine actif, certificat vérifié et cérémonie de jumelage achevée ;
- `pending_verification → revoked` : refus, expiration, annulation ou échec définitif ;
- `active → revoked` : révocation explicite autorisée ou incident de sécurité ;
- `revoked` ne revient jamais à `active`. Une réinstallation ou un nouvel enrôlement crée un nouvel identifiant d'appareil.

Décisions déjà actées :
- un compte peut avoir plusieurs appareils ;
- le premier appareil approuvé est la racine ;
- seul l'appareil racine approuve les appareils secondaires en V1 ;
- un appareil secondaire ne peut pas approuver un autre appareil ;
- perte de tous les appareils approuvés : nouvelle identité cryptographique et vérification indépendante de l'empreinte par les contacts ;
- aucun OTP seul ne restaure l'identité racine.

La transition de racine n'est pas définie et doit rester interdite dans la V1 tant qu'une procédure distincte n'est pas validée.

### 3.2 Certificat d'appareil

États :
- `active`
- `revoked`
- `superseded`

Règles :
- un certificat ne devient actif qu'après signature racine vérifiée, contexte compte/appareil attendu, cérémonie achevée et contrôle serveur ;
- certificat révoqué ou remplacé : aucune nouvelle opération cryptographique ;
- une rotation crée un nouveau certificat et conserve une trace non secrète de l'ancien ;
- la révocation d'un appareil invalide tous ses certificats actifs et ses autorisations ;
- la vérification du certificat et de son statut doit précéder toute dérivation de clé ou échange.

Le format final du transcript, la cérémonie de comparaison indépendante et la rotation sont encore à valider par revue cryptographique indépendante.

### 3.3 Défi de jumelage

États :
- `pending`
- `consumed`
- `expired`
- `rejected`
- `cancelled`

Transitions :
- création → `pending`, avec expiration courte et contexte immuable ;
- `pending → consumed` uniquement une fois, dans la transaction qui active l'appareil après toutes les validations ;
- `pending → expired` lorsque l'échéance serveur est atteinte ;
- `pending → rejected` si le root refuse ou si la vérification échoue ;
- `pending → cancelled` si l'une des parties annule ;
- aucun état terminal ne peut revenir à `pending`.

La consommation doit être anti-rejeu et résister à deux validations simultanées. Une interruption réseau ambiguë ne doit pas être interprétée côté client comme une activation réussie.

### 3.4 Session par appareil

États :
- `active`
- `revoked`
- `expired`

Règles :
- session créée seulement pour un appareil actif et une authentification valide ;
- chaque session appartient à un seul compte et appareil ;
- expiration contrôlée à chaque requête protégée ;
- révocation d'appareil incrémente `auth_version` et invalide toutes les sessions de cet appareil ;
- les autres appareils du même compte restent actifs ;
- aucune session d'un appareil révoqué ne peut être renouvelée ;
- le jeton brut n'est jamais persisté.

Le transport du jeton, la durée de session et le mécanisme OTP restent des décisions ouvertes.

## 4. Invitations et contacts de confiance

### 4.1 Invitation

États :
- `pending`
- `accepted`
- `declined`
- `revoked`
- `expired`

Transitions :
- création → `pending`, sans aucun droit accordé au destinataire ;
- `pending → accepted` : destinataire authentifié, moyen de contact vérifié, consentement explicite et association au bon compte ;
- `pending → declined` : destinataire refuse ;
- `pending → revoked` : propriétaire retire l'invitation ;
- `pending → expired` : expiration serveur ;
- états terminaux immuables.

Une invitation acceptée crée une relation directionnelle de confiance. Elle ne donne pas automatiquement au propriétaire les droits symétriques chez le contact.

### 4.2 Relation de confiance

États :
- `active`
- `revoked`

Transitions :
- création après acceptation vérifiée → `active` ;
- propriétaire révoque → `revoked` ;
- relation révoquée ne peut pas être réactivée par simple changement de statut ; une nouvelle invitation et une nouvelle acceptation sont nécessaires.

Effets de révocation :
- aucune nouvelle alerte ni nouveau partage ne peut utiliser cette relation ;
- les destinataires d'une alerte déjà déclenchée restent figés selon la règle produit ;
- la révocation ne supprime pas rétroactivement un événement de sécurité ;
- l'accès aux alertes déjà en cours et aux données historiques doit suivre une politique d'accès dédiée à valider ; ne pas l'inférer automatiquement de la liste figée des destinataires.

### 4.3 Préférences d'alertes

Les préférences activent/désactivent une catégorie pour une relation active. Elles déterminent la sélection initiale du parcours guidé et les destinataires du raccourci SOS critique immédiat.

**Exception ponctuelle validée pour le parcours guidé :** avant le déclenchement, l'auteur peut modifier la sélection initiale en retirant ou en ajoutant des contacts de confiance dont la relation est active, l'invitation acceptée et le moyen de contact vérifié. Cette sélection explicite pour une alerte peut déroger aux préférences habituelles de catégorie, sans les modifier. Les limites de l'offre restent appliquées. Le raccourci critique immédiat n'autorise pas cette modification et utilise la liste préconfigurée.

La sélection finale est figée dans l'instantané atomique de l'alerte. Une modification ultérieure des préférences ou de la relation ne réécrit jamais cet instantané. Les règles exactes du cas où aucun contact n'est sélectionné restent à valider ; le système ne doit pas prétendre qu'une alerte a été transmise si aucun destinataire n'a été retenu.

## 5. Alerte SOS

Le contrat TypeScript pur de clôture et d'éligibilité des rappels est prototypé dans `src/domain/alert-lifecycle.ts` avec tests dans `tests/alert-lifecycle.test.ts`. Il ne persiste rien, n'authentifie pas l'acteur et ne remplace pas les conditions SQL atomiques décrites dans les contrats D1.

### 5.1 États métier

États proposés pour une alerte déjà déclenchée :
- `active`
- `closed`

L'état `active` signifie que l'alerte est ouverte, pas que tous les messages ont été livrés ni qu'un proche a pris en charge.

Transitions :
- absence → `active` : action volontaire de l'auteur, validation des paramètres et création atomique de l'alerte, instantané des destinataires, événement initial et notifications à envoyer ;
- `active → closed` : action explicite de l'auteur. Elle peut être présentée dans l'interface comme « Clôturer » ou « Annuler l'alerte » selon le contexte, mais dans les deux cas elle clôt l'alerte et conserve le motif/événement correspondant.

L'annulation d'un SOS programmé avant son déclenchement est un état distinct du programme planifié : elle empêche la création de l'alerte. Après déclenchement, une annulation demandée par l'auteur est une clôture avec motif « annulée », pas un état qui maintient l'alerte ouverte.

Seul l'auteur peut mettre fin à l'alerte. Les contacts ne peuvent jamais fermer l'alerte de l'auteur. Un contact qui se retire de la prise en charge ne modifie pas l'état de l'alerte.

Les événements distinguent au minimum déclenchement, transmission tentée, annulation, clôture et horodatage. L'annulation ne supprime jamais l'historique. L'interface doit distinguer clairement « demande reçue par SAC », « notification acceptée par fournisseur » et « accusé de réception du proche ».

### 5.2 Destinataires figés

Avant le déclenchement :
1. le parcours guidé présente les contacts préconfigurés pour la catégorie et permet à l'auteur d'ajuster explicitement la sélection pour cette alerte ; le raccourci critique immédiat utilise la liste préconfigurée sans édition ;
2. le serveur reçoit la sélection finale explicite et vérifie que chaque relation est active, que l'invitation a été acceptée, que le moyen de contact est vérifié et que la limite de l'offre est respectée ;
3. le serveur ne complète jamais la liste par ajout automatique ;
4. il crée l'alerte, l'instantané final des destinataires, l'événement initial et les tâches de notification dans la même opération métier ;
5. il fige cette liste pour toute la durée de cette alerte.

Les rappels toutes les cinq minutes vont aux destinataires initiaux jusqu'à la clôture explicite par l'auteur. Si l'auteur choisit « Annuler l'alerte » après son déclenchement, cette action constitue une clôture avec motif « annulée ». Une relation révoquée après déclenchement ne réécrit pas l'instantané. L'accès aux contenus et la livraison après révocation restent à spécifier explicitement avant API.

### 5.3 Réponse des proches

Les réponses et la responsabilité sont également représentées par un contrat TypeScript pur dans `src/domain/alert-responses.ts`, avec tests dédiés dans `tests/alert-responses.test.ts`. L'ordre des candidatures utilise une séquence monotone fournie par le serveur ; le prototype ne remplace pas l'attribution atomique D1. Les 12 tests de ce contrat sont exécutés dans la CI (run 44261699221, succès).

Les réponses sont des actions distinctes :
- `acknowledge` : le proche confirme avoir vu l'alerte ;
- `volunteer` : le proche se propose pour prendre la responsabilité ;
- `withdraw` : le proche retire sa candidature ou sa responsabilité.

Un accusé de réception n'arrête pas les rappels. Un volontaire n'est pas responsable principal tant que l'attribution atomique n'a pas réussi.

### 5.4 Responsabilité principale

États conceptuels :
- `unassigned`
- `assigned`
- `handover_pending` (si un transfert explicite est retenu)

Règles actées :
- le premier proche volontaire qui obtient la transition atomique devient responsable principal ;
- une seule personne est responsable principale à un instant donné ;
- si le responsable se retire, un autre proche volontaire peut prendre la relève ;
- l'historique des périodes de responsabilité est conservé ;
- la prise en charge ne clôture pas l'alerte et ne stoppe pas les rappels ;
- seul l'auteur clôture l'alerte.

Règles de transfert et de continuité proposées (à valider) :
- une perte de connexion, un téléphone éteint, une PWA suspendue ou un silence ne provoquent jamais à eux seuls le retrait automatique du responsable ;
- SAC ne déduit pas un état « hors ligne » d'une simple absence d'événement ; il expose seulement la dernière activité confirmée par le serveur et son horodatage ;
- le retrait est une commande explicite du responsable courant ;
- dans la même opération atomique, le serveur termine sa période et attribue la responsabilité au volontaire admissible le plus ancien selon la séquence serveur ;
- si aucun volontaire admissible n'existe, l'alerte reste active avec l'état conceptuel unassigned ; les rappels continuent vers l'instantané initial ;
- si le responsable précédent revient, il ne récupère pas automatiquement son rôle ;
- aucun compteur de présence temps réel ni délai automatique d'abandon n'est prévu dans la V1.

La règle exacte en cas de retrait simultané et de plusieurs volontaires déjà présents doit être déterministe : priorité au premier volontariat accepté côté serveur, puis ordre monotone serveur (séquence/horodatage + identifiant comme départage). Un simple horodatage client n'est jamais utilisé.

Le détail UX et la proposition de continuité sont consignés dans docs/PARCOURS_DECLENCHEMENT_SOS_V1.md.

### 5.5 Annulation et clôture

À la clôture explicite par l'auteur (y compris une clôture dont le motif est « annulée ») :
- l'état change conditionnellement uniquement si l'alerte est encore active ;
- aucun nouveau rappel ne peut être planifié ;
- les rappels non envoyés sont annulés ;
- les tentatives déjà acceptées par un fournisseur peuvent encore être livrées ;
- la responsabilité principale est terminée avec un motif correspondant ;
- l'événement de fin est ajouté dans la même opération atomique ;
- toute répétition de la même commande est idempotente et retourne l'état final existant sans créer de nouvel événement de transition.

Une annulation après déclenchement n'est pas effacée : elle reste visible dans l'historique avec son heure réelle.

## 6. Notifications et rappels

### 6.1 États d'une tâche outbox

États :
- `pending`
- `processing`
- `sent` (acceptée par le fournisseur, pas nécessairement lue)
- `retry_wait`
- `failed_terminal`
- `cancelled`

Transitions :
- création → `pending` ;
- `pending → processing` : acquisition atomique d'un bail par un worker ;
- `processing → sent` : acceptation confirmée par le fournisseur ;
- `processing → retry_wait` : erreur temporaire, avec prochaine tentative ;
- `retry_wait → processing` : nouvelle acquisition après échéance ;
- `processing → failed_terminal` : erreur permanente ou budget de tentatives épuisé ;
- `pending/retry_wait → cancelled` : alerte terminée avant envoi ;
- `processing` avec bail expiré peut être repris après vérification de l'idempotence fournisseur.

Un worker ne doit pas tenir un verrou pendant un appel réseau. Le système doit assumer qu'une réponse fournisseur peut être perdue après acceptation : l'idempotence ou la réconciliation fournisseur doit éviter les doubles envois autant que possible. Si le fournisseur ne supporte pas l'idempotence, la limite doit être explicitée.

### 6.2 Rappels périodiques

- intervalle produit : cinq minutes ;
- destinataires : instantané initial ;
- arrêt de la création des rappels : clôture explicite par l'auteur ; une annulation après déclenchement est une clôture avec motif « annulée » ;
- accusé de réception ou prise en charge : ne stoppe pas les rappels ;
- erreur push/SMS : ne ferme pas l'alerte ;
- un rappel doit avoir une clé de déduplication stable par alerte, destinataire, canal et numéro d'occurrence.

La disponibilité réelle des tâches planifiées, les limites d'arrière-plan PWA et le choix du fournisseur ne sont pas validés. Aucun délai de livraison garanti ne doit être promis.

### 6.3 Abonnement push

États :
- `active`
- `revoked`
- `expired`

L'abonnement appartient à un appareil précis. Un abonnement invalide ou lié à un appareil révoqué ne peut être utilisé. Les endpoints et secrets push ne figurent jamais dans les logs ni dans les réponses publiques.

## 7. Protection des trajets et arrivée

Modes produit regroupés :
- `arrival_check` : vérification d'arrivée ;
- `accompaniment` : accompagnement ;
- `full_protection` : protection complète.

États de trajet proposés :
- `active`
- `completed`
- `cancelled`
- `expired`

Transitions :
- création → `active` après consentement explicite ;
- `active → completed` : auteur termine le trajet ou le parcours défini est terminé ;
- `active → cancelled` : auteur annule ;
- `active → expired` : échéance métier atteinte et traitée côté serveur.

États d'un contrôle d'arrivée :
- `pending`
- `confirmed`
- `not_confirmed`
- `cancelled`

Règles :
- l'auteur peut confirmer son arrivée ;
- à l'échéance sans confirmation, SAC notifie « arrivée non confirmée » ;
- cette absence n'est jamais présentée comme une preuve d'accident ou de danger ;
- les contacts peuvent intervenir selon le mode choisi, sans s'approprier le compte ni clôturer une alerte SOS ;
- les relances et leurs délais restent à finaliser ;
- aucune coordonnée GPS n'est incluse dans ces états ou événements D1 tant que la solution J+30 n'est pas démontrée.

Les détails des trois modes (déclencheurs, destinataires, fréquence de contrôle, fin et annulation) nécessitent encore une spécification produit avant endpoints.

## 8. Matrice de conservation — état des décisions

La durée exacte hors GPS n'est pas décidée. Ne pas inventer de durée par défaut et ne pas conserver indéfiniment par commodité.

| Donnée | Règle déjà connue | Durée / suppression à valider |
|---|---|---|
| Coordonnées GPS précises | 30 jours après fin du partage, puis destruction irréversible de toute possibilité de lecture/restauration | preuve technique J+30 encore bloquante ; aucune coordonnée dans D1 |
| Clés GPS et matériel de déchiffrement | aucune clé privée côté serveur ; clé de partage sous contrôle de l'appareil selon architecture retenue | cycle de vie et preuve de destruction J+30 non validés |
| Comptes et identités | minimisation ; suppression de compte à traiter sans effacer l'historique nécessaire | délais, anonymisation et obligations à définir |
| Invitations expirées/refusées | aucune permission résiduelle | durée de trace minimale à définir |
| Relations révoquées | plus de nouvelle alerte/partage via cette relation | historique et accès aux alertes existantes à définir |
| Appareils, certificats, sessions | révocation bloque les futures autorisations ; sessions expirées/révoquées inutilisables | durée des traces de sécurité à définir |
| Alertes, destinataires, événements | historique conservé après annulation/clôture ; destinataires figés | durée de conservation et pseudonymisation à définir |
| Réponses et responsabilités | historique nécessaire pour reconstituer les prises en charge | durée à définir |
| Notifications et tentatives | pas de secret ni de GPS ; identifiants fournisseur minimisés | durée, purge et erreurs à définir |
| Trajets et confirmations | absence de confirmation ≠ danger confirmé | durée à définir |
| Journaux techniques | aucune coordonnée, token, OTP, clé, secret ou corps libre par défaut | rétention minimale à définir |

### 8.1 Suppression et anonymisation

Avant migration, définir pour chaque table :
- finalité précise ;
- propriétaire de la donnée ;
- rôle autorisé à lire et modifier ;
- événement qui déclenche la purge ;
- durée et échéance calculées par le serveur ;
- suppression physique ou anonymisation ;
- dépendances et clés étrangères ;
- effet sur une alerte ou un trajet en cours ;
- traitement des exports, sauvegardes et restaurations.

Les durées doivent être fixées selon la nécessité opérationnelle, les attentes des utilisateurs et les obligations applicables. La règle GPS J+30 est une exigence distincte et plus stricte : une simple purge logique ne la satisfait pas.

## 9. Tests de transitions obligatoires

### Comptes et identités
- compte suspendu ne peut pas créer une alerte ni utiliser des fonctions protégées ;
- identité non vérifiée ne peut pas devenir primaire ;
- identité déjà attribuée ne peut pas être revendiquée ;
- défi OTP expiré, consommé ou trop essayé est refusé ;
- deux validations concurrentes du même défi ne produisent qu'un seul effet.

### Appareils
- appareil secondaire ne peut pas approuver un autre appareil ;
- deux appareils ne peuvent pas être racines actives ;
- certificat expiré/révoqué/substitué est refusé ;
- défi de jumelage ne peut être consommé qu'une fois ;
- révocation incrémente auth_version et invalide les sessions du seul appareil visé ;
- révocation d'un appareil ne révoque pas les autres appareils du compte ;
- appareil révoqué ne peut pas réactiver son ancien identifiant.

### Contacts
- invitation en attente ne confère aucun accès ;
- invitation acceptée sans vérification du destinataire est impossible ;
- relation révoquée ne peut pas être utilisée pour une nouvelle alerte ;
- une relation directionnelle n'accorde pas de droit réciproque implicite ;
- la révocation ne réécrit pas les destinataires d'une alerte déjà déclenchée.

### Alertes
- déclenchement crée une seule alerte et un instantané cohérent des destinataires ;
- destinataire absent de l'instantané ne peut ni lire ni répondre ;
- seul l'auteur annule/clôture ;
- accusé de réception ne stoppe pas les rappels ;
- prise en charge ne stoppe pas les rappels ;
- un seul responsable principal à la fois, même en concurrence ;
- retrait du principal permet une relève atomique sans trou incohérent ni double principal ;
- clôture/annulation empêche les rappels futurs et annule les tâches non envoyées ;
- répétition d'une commande réseau ne double pas les effets.

### Notifications
- deux workers ne détiennent pas le même bail actif ;
- reprise après bail expiré ;
- déduplication d'une même occurrence ;
- échec temporaire, permanent et réponse fournisseur perdue ;
- aucun message ne prétend être lu lorsque seul l'envoi fournisseur est accepté ;
- abonnement d'un appareil révoqué inutilisable.

### Trajets
- absence de confirmation déclenche seulement « arrivée non confirmée » ;
- confirmation tardive est traitée selon une règle explicite et auditée ;
- annulation empêche les relances futures ;
- aucun GPS précis ne se retrouve dans D1, événements, logs ou traces.

## 10. Conditions avant conversion en SQL

Ne pas créer de migration avant :
1. validation produit des transitions et des règles encore ouvertes ;
2. validation de la matrice de conservation/suppression hors GPS ;
3. validation des accès à l'historique après révocation d'un contact ;
4. spécification détaillée des trois modes de Protection des trajets ;
5. choix et contrat d'idempotence du fournisseur notification/OTP, ou abstraction testable sans fournisseur ;
6. schéma relationnel corrigé avec contraintes composites et index ;
7. opérations D1 atomiques conçues pour chaque transition sensible ;
8. tests d'intégration locaux démontrant concurrence, rollback et isolation inter-comptes ;
9. validation de l'isolation Preview/Production ;
10. solution GPS J+30 prouvée séparément avant toute donnée de localisation réelle.

**État final : les machines à états sont documentées comme contrat de travail. Plusieurs règles restent ouvertes ; aucune migration ni API métier n'est autorisée par ce document.**


### 5.4.1 Événements concurrents de coordination — proposition à valider

Les événements suivants sont distincts et ne doivent pas être fusionnés dans un statut générique « pris en charge » :

- `volunteer_submitted` : candidature d'un contact ;
- `primary_assigned` : attribution effective du responsable principal ;
- `primary_withdrawn` : retrait explicite du responsable courant ;
- `arrival_reported` : déclaration d'arrivée sur place ;
- `resolution_reported` : déclaration d'un contact estimant la situation résolue ;
- `author_closed` : clôture par l'auteur uniquement.

**Invariants métier**
1. Au plus une attribution principale active par alerte ; au plus une période de responsabilité ouverte.
2. Une candidature, une arrivée déclarée et un signalement de résolution ne donnent jamais le rôle principal par eux-mêmes.
3. `arrival_reported` et `resolution_reported` sont informatifs : ils ne changent pas l'état actif/clôturé, ne stoppent pas les rappels et ne bloquent pas l'escalade SMS.
4. Seul `author_closed`, émis par l'auteur authentifié, peut faire passer une alerte active à clôturée.
5. Après clôture, aucune nouvelle candidature, attribution, arrivée ou déclaration de résolution n'est acceptée comme transition métier. Les événements acceptés avant la clôture restent dans l'historique.
6. Un responsable peut produire un compte rendu ou se retirer ; il ne peut jamais clôturer au nom de l'auteur.

**Arbitrage des courses**
- Toute commande de coordination vérifie dans une même transaction que l'alerte est encore active et que l'acteur a le rôle/droit requis.
- L'attribution utilise une transition conditionnelle depuis `unassigned`. Une seule transaction peut réussir ; les autres obtiennent un conflit métier « responsable déjà attribué » et ne créent pas de deuxième période.
- Les candidatures sont ordonnées par séquence serveur monotone attribuée lors de leur acceptation. En cas d'égalité technique exceptionnelle, l'identifiant stable de candidature sert de dernier départage. Les horloges client ne sont jamais une source d'ordre.
- Le retrait et la promotion du prochain volontaire admissible sont atomiques : clôture de l'ancienne période et ouverture de la nouvelle dans la même transaction. Si aucun volontaire n'est disponible, l'état devient `unassigned`.
- La clôture auteur et les opérations contact partagent le même contrôle conditionnel de l'état actif. L'ordre de commit serveur détermine l'ordre des événements ; aucun état intermédiaire contradictoire ne doit être visible.
- Chaque commande porte une clé d'idempotence liée à l'acteur, l'alerte et l'action. Un rejeu retourne le résultat initial sans répéter l'effet métier.

**Journal**
- Le journal métier est append-only : les événements acceptés ne sont ni réécrits ni supprimés pour masquer une course.
- Chaque événement contient au minimum l'identifiant d'alerte, l'acteur, le type d'action, l'horodatage serveur, la séquence serveur, la clé d'idempotence ou son empreinte, et le résultat métier.
- Les événements de transport (push/SMS) restent séparés des événements humains.
- Les notifications aux destinataires sont produites après commit via outbox idempotente. Elles annoncent uniquement un responsable confirmé ou un événement informatif confirmé ; aucune donnée privée d'un autre contact n'est incluse.

**Statut : proposition de machine d'états et de persistance à valider.** Aucun schéma D1, endpoint ou code métier n'est créé par cette spécification.


### 4.2.1 Révocation concurrente à une candidature ou une responsabilité — proposition à valider

La révocation prend effet à l'instant de son commit serveur. Une lecture préalable du statut de relation ne suffit jamais à autoriser une mutation ultérieure.

**Règle d'éligibilité proposée**
- Une relation doit être active au moment exact où la candidature est acceptée et au moment exact où une responsabilité est attribuée ou transférée.
- Si la révocation commit avant la candidature, celle-ci est refusée ; aucun événement de candidature admissible ni aucune notification de candidature n'est créé.
- Si la candidature commit avant la révocation, l'événement historique est conservé, mais la candidature devient inadmissible à toute attribution postérieure à la révocation.
- Si l'attribution principale commit avant la révocation, l'attribution a existé valablement dans l'ordre serveur. La révocation suivante doit toutefois mettre fin à cette responsabilité dans une opération atomique et déclencher la recherche du prochain volontaire encore admissible. Il ne doit exister aucun intervalle où le contact révoqué reste responsable après le commit de révocation.
- Si révocation et attribution arrivent simultanément, les transactions sont sérialisées : révocation gagnante = aucune attribution au contact révoqué ; attribution gagnante = attribution enregistrée puis responsabilité terminée par la révocation dans l'ordre serveur. Le résultat final est identique : le contact révoqué n'est plus responsable.
- Un volontaire révoqué est ignoré lors d'une promotion, même s'il est le plus ancien dans l'ordre des candidatures.
- Si aucun volontaire actif et admissible ne reste, l'alerte reste active sans responsable principal ; les rappels continuent selon les règles existantes.

**Historique et droits**
- Ne pas supprimer ni réécrire les événements valablement acceptés avant la révocation. Ajouter un événement de révocation et, si nécessaire, un événement de fin de responsabilité avec cause `relationship_revoked`.
- Après le commit de révocation, refuser toute nouvelle candidature, arrivée déclarée, déclaration de résolution, accusé ou retrait initié par le contact révoqué.
- Le droit de lecture du détail d'une alerte déjà active et le traitement des rappels destinés à ce contact restent soumis à la politique d'accès post-révocation à valider ; la révocation ne réécrit pas l'instantané initial.
- Une révocation ne doit pas effacer les preuves de notifications déjà acceptées par un fournisseur.

**Statut : proposition de sécurité à valider.** Elle ne tranche pas à elle seule le maintien de l'accès en lecture ni la livraison des rappels à un destinataire révoqué.


### 4.2.2 Portée de la révocation sur les lectures et notifications — proposition à valider

Ne pas confondre trois éléments : l'instantané historique, l'autorisation d'accès courante et une notification déjà confiée au transport.

- L'instantané initial reste immuable : une révocation ne supprime pas le destinataire de l'historique de l'alerte.
- L'autorisation est dynamique : l'appartenance à l'instantané ne suffit plus après révocation pour lire les détails ou envoyer une nouvelle action.
- Une tâche de notification non encore acceptée par le transport peut être supprimée ou marquée supprimée pour cause de révocation, après contrôle transactionnel de la relation.
- Une notification déjà acceptée par le fournisseur peut encore être livrée ; SAC ne peut pas garantir son rappel.
- Les payloads push doivent rester minimaux et ne jamais contenir de détails sensibles de l'alerte ou de coordonnées GPS. L'ouverture de la notification doit refaire un contrôle d'accès serveur.
- Les événements antérieurs à la révocation restent visibles dans l'historique de l'auteur. Le contact révoqué ne reçoit pas les événements postérieurs si la politique de coupure immédiate est validée.

**Causes de fin de relation :** distinguer au minimum la révocation par le propriétaire et le retrait d'acceptation par le contact. La proposition est que les deux invalident immédiatement les autorisations futures, tout en conservant leur cause distincte dans le journal. Une réinvitation ultérieure crée une nouvelle relation/version ; elle ne réactive pas rétroactivement l'ancienne relation ni ne donne accès à une ancienne alerte.

**Statut : proposition de confidentialité et de livraison à valider.** Les règles de transport déjà acceptées et les limites techniques du fournisseur doivent être documentées ; aucune promesse de suppression d'une notification déjà distribuée.

### 4.3 Révocation d'appareil — effets distincts de la révocation de compte (proposition à valider)

Modéliser au minimum le statut de chaque appareil séparément du statut du compte : appareil pending/active/revoked ; confiance racine du compte root_active/root_recovery_required (états conceptuels à confirmer).

**Révocation d'un secondaire**
- termine les sessions et désactive les abonnements push de cet appareil uniquement ;
- n'invalide pas les sessions des autres appareils du même compte ;
- n'altère ni relations de confiance, ni abonnements, ni alertes, ni instantanés de destinataires ;
- exclut cet appareil des futurs claims de notifications et opérations protégées ;
- ne prouve pas la suppression des clés/données locales.

**Révocation du root**
- révoque ses propres sessions et abonnements ;
- place la confiance racine du compte en récupération requise ;
- bloque approbations et partage GPS dépendant de la racine ;
- ne promeut aucun secondaire en root et ne révoque pas implicitement les sessions secondaires ;
- laisse les fonctions ordinaires sans dépendance racine accessibles aux appareils secondaires encore actifs, si leurs autorisations propres le permettent.

**Séparation notification logique / abonnement appareil**
Une alerte produit une intention de notification vers un destinataire. Le service de livraison peut avoir plusieurs abonnements appareils pour ce compte. Révoquer un appareil supprime uniquement l'éligibilité de son abonnement ; ne pas marquer la notification du destinataire comme globalement annulée si d'autres appareils actifs doivent encore la recevoir. Dédupliquer les envois par couple événement/abonnement.

**Transitions concurrentes**
- Une action d'appareil et sa révocation sont arbitrées par statut et auth_version dans la même transaction ou condition D1 atomique.
- Révocation gagnante : aucune nouvelle mutation ni aucun claim par cet appareil.
- Action gagnante : l'événement reste valide dans l'historique ; la révocation bloque les suivantes.
- La révocation du root et l'approbation secondaire sont sérialisées ; aucune approbation ne peut commit après le passage à root_recovery_required.
- Une réinscription utilise une nouvelle identité de session et une cérémonie neuve ; un ancien appareil révoqué ne redevient pas actif par rejeu.

**Statut : proposition à valider.** La disponibilité exacte des fonctions non GPS pendant root_recovery_required doit être cartographiée avant de figer les contrôles d'accès.
