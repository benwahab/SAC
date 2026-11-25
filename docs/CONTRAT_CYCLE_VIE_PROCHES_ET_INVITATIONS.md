# SAC — Contrat du cycle de vie des proches et des invitations

**Statut :** consolidation documentaire. Les invariants validés sont séparés des propositions qui restent à arbitrer. La présence d'une proposition dans ce document ne vaut pas approbation produit.
**Portée :** invitation, acceptation, relation de confiance, révocation et réinvitation.
**Limite :** aucun code, test, endpoint, fournisseur e-mail, schéma/migration D1 ou ressource Cloudflare n'est modifié.

## 1. Invariants validés

1. Une personne possède un seul compte SAC canonique.
2. Toute inscription exige une adresse e-mail et un numéro de téléphone avec indicatif international.
3. L'adresse e-mail doit être vérifiée par OTP e-mail avant activation. Aucun compte ne peut être créé/activé par téléphone seul.
4. Le téléphone est obligatoire mais déclaré non vérifié ; aucun SMS OTP de compte n'est autorisé.
5. Tout proche qui devient contact SAC actif doit avoir un compte SAC actif, donc une adresse e-mail vérifiée par OTP.
6. Une invitation n'est pas une relation active et ne donne aucun accès aux alertes, trajets ou positions.
7. L'acceptation explicite du proche est obligatoire ; l'invitant ne peut pas accepter à sa place.
8. La saisie d'une coordonnée, l'envoi d'un e-mail/SMS ou une réponse depuis un numéro déclaré ne prouvent ni identité ni consentement.
9. La relation est directionnelle : A désigne B ne crée pas B désignant A. La réciprocité exige une seconde invitation et un consentement distincts.
10. Un groupe privé ne remplace pas une relation de confiance et ne donne aucun accès implicite.
11. Les droits d'alerte, d'accusé, de prise en charge et de partage de position sont distincts ; aucun droit GPS ne découle automatiquement du statut de proche.

## 2. Parcours d'invitation

### 2.1 Création par l'invitant
1. L'invitant choisit « Ajouter un proche » et saisit l'adresse e-mail du destinataire. Le téléphone n'est pas une destination de preuve ni une solution alternative.
2. Le serveur normalise l'adresse selon une règle conservatrice et contrôle les limites de formule, les doublons et les relations déjà actives.
3. L'invitant voit les permissions proposées et leurs finalités. Aucune permission non définie n'est activée par défaut.
4. Le serveur crée un objet d'invitation distinct de la relation : identifiant, compte invitant, destination e-mail normalisée, compte destinataire nullable, permissions/version proposées, état, dates, idempotence et hash du jeton.
5. Le jeton est aléatoire, imprévisible, lié à l'invitation et à sa destination, à usage unique et expirant. Seul son hash est stocké ; le jeton brut ne figure jamais dans les logs.
6. L'invitation est envoyée à cette adresse. L'interface indique « en attente », jamais « proche ajouté ».

Les valeurs recommandées (validité, relances, limites anti-abus et approche fournisseur) sont regroupées dans `PROPOSITIONS_ARBITRAGE_INVITATIONS_ET_REVOCATION.md` ; elles restent à confirmer.

### 2.2 Ouverture et acceptation par le proche
1. Le lien ouvre SAC sans exposer de données privées avant authentification.
2. Le destinataire se connecte ou crée son compte. Une nouvelle inscription doit vérifier l'e-mail par OTP et activer le compte avant toute acceptation.
3. Le compte doit être actif et son adresse e-mail vérifiée doit correspondre à la destination normalisée de l'invitation. Une autre adresse vérifiée ne peut pas accepter ce lien.
4. SAC affiche l'identité minimale de l'invitant, la nature de la relation et les permissions proposées. Aucun détail d'alerte, trajet ou position n'est exposé.
5. Le proche accepte ou refuse explicitement. Ouvrir le lien, se connecter ou ne pas répondre ne vaut jamais consentement.
6. À l'acceptation, le serveur revalide atomiquement : compte actif, e-mail vérifié correspondant, invitation en attente, jeton valide, non expiré/non révoqué/non consommé, permissions/version présentées et absence de relation active incompatible.
7. La consommation du jeton, l'état accepté de l'invitation et la création de la relation sont atomiques. Aucune relation partielle n'est possible.
8. Le proche reçoit confirmation ; l'invitant reçoit le statut d'acceptation, sans données privées supplémentaires.

### 2.3 Refus
- Le destinataire peut refuser explicitement.
- Le refus consomme le jeton ; aucun lien ne peut ensuite être rejoué.
- Aucune relation n'est créée.
- L'invitant reçoit le statut « refusée », sans motif personnel obligatoire.
- Une éventuelle nouvelle invitation est un nouvel objet.

### 2.4 Expiration, livraison et retrait
- L'expiration rend le jeton inutilisable et clôt l'invitation comme expirée.
- Les états techniques d'envoi, livraison, rebond et erreur fournisseur sont distincts du consentement. Une livraison ne prouve ni lecture ni acceptation.
- L'invitant peut retirer une invitation encore en attente ; le serveur la marque révoquée et invalide immédiatement le jeton.
- En cas de course entre acceptation et retrait/expiration, une seule transition atomique gagne. Aucun état intermédiaire.
- Une invitation expirée, refusée ou révoquée n'est jamais réactivée avec son ancien jeton.

## 3. États logiques

### Invitation
| État | Sens | Transitions |
|---|---|---|
| `pending` | En attente de décision | `accepted`, `declined`, `revoked`, `expired` |
| `accepted` | Consentement enregistré et relation créée atomiquement | terminal |
| `declined` | Refus explicite | terminal |
| `revoked` | Retrait par l'invitant avant acceptation | terminal |
| `expired` | Échéance dépassée | terminal |

Les événements de livraison sont des événements techniques séparés, jamais des états de consentement.

### Relation
| État | Sens |
|---|---|
| `active` | Consentement explicite enregistré ; droits limités aux permissions actives |
| `revoked` | Relation terminée ; aucun nouveau droit futur par cette relation |

La relation et son historique ne sont pas effacés lors de la révocation. Les noms d'états sont conceptuels et doivent être alignés avec les contrats TypeScript avant D1.

## 4. Révocation d'une relation active

### Invariants
- Une révocation confirmée doit être effective côté serveur, horodatée et auditée.
- Elle ne réécrit ni les consentements, événements, notifications ni données déjà reçues.
- Elle empêche toute nouvelle alerte future au titre de cette relation et toute nouvelle autorisation de partage de position par cette relation.
- Elle ne clôture, n'annule ni ne met en pause une alerte déjà active.
- Elle ne donne jamais au contact un droit de clôture d'alerte.

### Qui peut révoquer ?
**Proposition à arbitrer :** adopter une révocation symétrique (propriétaire ou proche). Les causes, notifications et effets recommandés sont détaillés dans `PROPOSITIONS_ARBITRAGE_INVITATIONS_ET_REVOCATION.md`. Cette symétrie n'est pas encore une décision validée ; ne pas l'implémenter avant confirmation.

### Alerte déjà active
Les destinataires initiaux, l'instantané historique et les règles de rappel propres à l'alerte ne sont pas réécrits par la révocation. Les droits exacts après révocation — détail accessible, accusé de réception, volontariat, responsabilité principale, rappels et partage de position — restent non arbitrés. Voir `ARBITRAGES_CONTACT_REVOQUE_ET_ALERTE_ORPHELINE.md`. Les options A/B de ce document ne sont pas approuvées ici.

Une révocation serveur ne peut pas effacer à distance les informations déjà reçues, enregistrées ou capturées sur un appareil hors ligne. Ne jamais promettre cet effacement.

## 5. Réinvitation

**Règle de sécurité proposée :** toute réinvitation est un nouvel objet, un nouveau jeton et un nouveau consentement ; aucun ancien lien ne peut être réactivé. Les délais de refroidissement et seuils anti-abus proposés figurent dans `PROPOSITIONS_ARBITRAGE_INVITATIONS_ET_REVOCATION.md`.
- Après refus, expiration ou retrait : l'invitant peut créer une nouvelle invitation, sous réserve de limites anti-harcèlement à définir.
- Après révocation d'une relation active : une nouvelle relation ne peut être créée qu'après une nouvelle invitation et une nouvelle acceptation explicite. Aucun rétablissement unilatéral.
- Si une relation est déjà active, empêcher les invitations en double pour le même couple directionnel.
- Si une invitation est déjà en attente, proposer de la consulter ou de la retirer plutôt que créer un doublon.
- Un refus ne doit pas devenir une occasion de harcèlement : cadence, quotas, délai de refroidissement et blocage éventuel restent à arbitrer.

## 6. Modèle logique minimal

### `contact_invitations`
Identifiant ; compte propriétaire ; destination e-mail normalisée ; compte destinataire nullable ; hash du jeton ; état ; dates de création/expiration/décision ; permissions et version présentées ; acteur de décision ; idempotence ; événements de livraison séparés (fournisseur, date, résultat technique).

### `trusted_contacts`
Identifiant ; compte propriétaire ; compte proche ; invitation source ; état ; dates d'activation/révocation ; version des permissions et preuve de consentement ; acteur de révocation ; contrainte d'une seule relation active par couple directionnel ; interdiction de relation vers soi-même.

Ces noms sont conceptuels, pas un schéma SQL approuvé. Les contraintes et l'historisation nécessitent une revue avant D1. Pas de suppression en cascade aveugle.

## 7. Confidentialité et anti-abus

- Ne pas révéler, à une personne non authentifiée, si une adresse e-mail possède déjà un compte SAC.
- Ne pas exposer nom complet, téléphone, statut du compte ou activité avant authentification et consentement.
- Les pages de lien invalide/expiré/révoqué ne doivent pas divulguer l'existence d'un compte.
- Protéger contre énumération d'e-mails, spam, rejeu, substitution de destination, CSRF, acceptation par un autre compte et courses concurrentes.
- Limiter créations, renvois et essais par compte, destination et contexte ; valeurs à arbitrer.
- Le jeton n'apparaît jamais dans les logs, analytics, URLs référentes externes ou rapports d'erreur.
- Le consentement est explicite, horodaté et lié à une version des permissions ; son historique est non réinscriptible.
- L'ouverture d'un lien n'est jamais une preuve de consentement.

## 8. Tests obligatoires avant implémentation

1. Inscription sans e-mail ou téléphone seul refusés.
2. Compte inactif ou e-mail non vérifié incapable d'accepter.
3. E-mail vérifié différent de la destination incapable d'accepter.
4. Jeton incorrect, expiré, révoqué, consommé ou rejoué refusé.
5. Ouverture du lien/connexion sans action explicite ne crée aucune relation.
6. Refus explicite consomme le lien sans créer de relation.
7. Envoi/livraison e-mail ne vaut jamais acceptation.
8. Deux acceptations concurrentes créent au plus une relation.
9. Acceptation concurrente avec retrait/expiration produit un résultat atomique déterministe.
10. Invitation impossible à accepter depuis un autre compte ou une autre destination.
11. A vers B n'implique jamais B vers A.
12. Invitation en double bloquée pour relation active ou invitation déjà en attente.
13. Réinvitation après refus/expiration/révocation : nouveau jeton, nouvel objet et nouveau consentement.
14. Un ancien lien ne réactive jamais une relation.
15. Révocation bloque les usages futurs, sans réécrire les événements historiques.
16. Droits post-révocation pendant alerte active testés selon une décision produit distincte.
17. Pas de cascade supprimant l'historique de la relation.
18. Limites anti-abus empêchent renvois massifs et harcèlement.
19. Les réponses ne révèlent pas l'existence d'un compte pour une adresse arbitraire.
20. Aucun droit GPS/alerte n'est accordé sans permission explicite et contrat propre.

## 9. Propositions de valeurs par défaut

Consulter `PROPOSITIONS_ARBITRAGE_INVITATIONS_ET_REVOCATION.md` pour un paquet cohérent de valeurs proposées : validité 7 jours, relance à 48 heures, limites anti-abus, révocation symétrique et droits pendant une alerte active. Aucune de ces valeurs ou options n'est approuvée tant qu'une confirmation explicite n'a pas été donnée.

## 10. Points à arbitrer avant API et D1

1. Durée d'invitation et cadence/nombre de relances.
2. Fournisseur e-mail et gestion des rebonds/renvois.
3. Permissions exactes proposées et version du consentement.
4. Niveau d'information affiché avant connexion.
5. Révocation symétrique : droit du proche de quitter la relation.
6. Droits d'un contact révoqué pendant une alerte active.
7. Limites anti-abus, refroidissement après refus/révocation et blocage éventuel.
8. Rétention/anonymisation de l'historique hors GPS.
9. Destinataire externe sans compte : fonctionnalité non définie, qui ne doit pas contourner l'activation e-mail.

## 11. Critères de sortie

Pas d'implémentation avant arbitrage des points produit, alignement des contrats TypeScript et tests purs, tests de propriétés/concurrence, contrat API/D1 avec autorisation serveur/idempotence/vérification des lignes affectées, revue de sécurité e-mail/jeton/anti-abus et validation du modèle relationnel/conservation.

**État : DOCUMENTATION CONSOLIDÉE — NON PRÊT POUR API OU MIGRATION D1.**

## Référence complémentaire — anti-harcèlement et abus

Lire `CONTRAT_PREVENTION_ABUS_USURPATION_ET_SATURATION.md` avec `PROPOSITIONS_ARBITRAGE_INVITATIONS_ET_REVOCATION.md`. Les seuils d'invitation, refroidissements et relances restent des propositions à confirmer ; aucune valeur chiffrée n'est approuvée par le contrat de prévention. Préserver le refus, le consentement explicite, la révocation et l'impossibilité de contourner ces choix par de nouveaux comptes ou groupes.
## 12. Décision produit validée — retrait volontaire d'un proche (2026-11-25)

Le droit de rupture est **symétrique et validé** :
- le propriétaire du cercle peut retirer un proche actif ;
- le proche peut quitter lui-même la relation à tout moment, sans justification et sans autorisation du propriétaire ;
- la demande est authentifiée côté serveur et la rupture est effective immédiatement après confirmation atomique en D1 ;
- l'audit distingue les causes `owner_revoked` et `contact_withdrew` ;
- la relation et sa preuve historique de consentement sont conservées ; la relation terminée n'est jamais réactivée ;
- toute relation ultérieure exige un nouvel acte de mise en relation et une nouvelle acceptation explicite du proche.

Cette validation porte sur le droit de quitter la relation. Elle **ne valide pas automatiquement** les délais anti-abus proposés, le blocage de réinvitation de 90 jours, les notifications ni les droits détaillés pendant un SOS déjà actif. Ces éléments restent soumis à arbitrage séparé.

### Conséquence pendant un SOS déjà actif

Le retrait ne doit jamais clôturer ni suspendre le SOS de l'auteur. Les droits du proche sortant pendant cette alerte (rappels opaques, lecture, accusé, volontariat, coordination et positions) restent à arbitrer avant toute implémentation croisée avec le moteur SOS/GPS. En attendant, aucune nouvelle permission ne doit être accordée par simple hypothèse.

### Conséquence technique

Le code actuel ne fournit qu'une route de révocation par le propriétaire et le service n'enregistre pas encore l'acteur/cause de rupture. L'API de retrait volontaire, l'autorisation par l'identité du proche, l'audit `contact_withdrew`, les tests de concurrence et la migration éventuelle restent à réaliser après revue du modèle et des effets SOS. Aucun changement de code ou de D1 n'est inclus dans cette décision documentaire.
## 13. Décision produit validée — coupure totale immédiate après retrait volontaire (2026-11-25)

Lorsqu'un proche quitte volontairement le cercle de confiance, sa révocation d'accès est immédiate et totale, y compris si un SOS est déjà actif.

Dès que la rupture est confirmée côté serveur :
- aucun accès aux positions GPS, actuelles ou ultérieures ;
- aucun accès au contenu, à l'état ou à l'évolution du SOS ;
- aucun rappel, y compris les notifications neutres ;
- aucun accusé de réception, aucune action de volontariat et aucun accès à la coordination ;
- aucune nouvelle notification liée à ce SOS ;
- aucune consultation ou récupération ultérieure des données de l'alerte via les interfaces ou API du proche sortant.

Le SOS de la personne en détresse continue sans interruption. Le retrait du proche ne clôture pas l'alerte et ne modifie pas les droits des autres proches encore autorisés.

Cette règle doit être appliquée côté serveur à chaque lecture, livraison push, relais GPS, accusé et action, et pas uniquement en masquant l'interface ou en supprimant l'abonnement push. Les abonnements et tâches de livraison destinés au proche sortant doivent être invalidés ; les opérations déjà en file doivent recontrôler l'autorisation juste avant livraison. Les caches et sessions ne doivent pas permettre de conserver un accès après la rupture.

Cette décision porte sur le retrait volontaire du proche. Le traitement symétrique d'un retrait initié par le propriétaire devra être harmonisé et vérifié avant de considérer la révocation comme complète. Aucun changement de code ou de migration D1 n'est inclus dans cette mise à jour documentaire.

## 14. Mise en œuvre technique — retrait volontaire et coupure totale (2026-11-25)

Cette section précise et remplace les points techniques encore ouverts des sections 12 et 13.

La règle validée est implémentée dans le dépôt :
- `POST /api/contacts/withdraw` authentifie le proche par sa session serveur ; l'identifiant du propriétaire est uniquement la cible de la relation ;
- `trusted_contacts` conserve la relation terminée et enregistre `revocation_reason='contact_withdrew'` ainsi que l'acteur ;
- le proche sortant perd l'accès à toutes les alertes de ce propriétaire, y compris celles déjà actives : lecture, chronologie, responsabilité, accusé, volontariat et nouveaux tickets GPS ;
- les rappels SOS en attente ou en cours et les tâches SMS déjà mises en file sont annulés ; les tickets GPS non consommés sont supprimés ;
- le worker GPS vérifie encore l'autorisation de chaque participant avant le relais d'une trame, et ferme la connexion d'un participant devenu non autorisé ;
- un proche sortant qui assurait la responsabilité principale est retiré de cette responsabilité ; le prochain volontaire encore éligible peut prendre le relais ;
- le SOS de l'auteur reste actif et les autres proches autorisés ne sont pas affectés ;
- l'écran « Contacts d'alerte » expose les relations acceptées dont l'utilisateur est lui-même le proche, avec une action « Quitter ce cercle » en français, anglais et arabe.

Le snapshot `alert_recipients` n'est pas supprimé ni réécrit : il demeure une preuve historique du destinataire choisi au déclenchement. Il ne suffit plus à lui seul à autoriser le proche sortant.

**Distinction importante :** le retrait volontaire `contact_withdrew` coupe immédiatement tous les accès du proche sortant. La révocation initiée par le propriétaire `owner_revoked` conserve, pour le moment, le comportement historique des alertes déjà actives. Ce comportement reste un arbitrage produit distinct et n'est pas assimilé à la décision de retrait volontaire.

La migration `0026_trusted_contact_withdrawal_access_revocation.sql` ajoute la cause et l'acteur de révocation, les garde-fous D1 et les annulations atomiques associées. Les tests D1 SOS couvrent désormais le retrait pendant une alerte active et l'absence de nouveaux rappels. La migration distante ne doit être déclarée appliquée qu'après exécution de la suite locale/CI, application sur `sac-db`, puis vérification de `d1_migrations`, des colonnes/triggers et de `PRAGMA foreign_key_check`.

## 15. Historique des relations et nouvelle invitation après rupture

Le schéma D1 est ajusté pour qu'une relation ne soit plus identifiée uniquement par la paire propriétaire/proche. Chaque invitation acceptée crée une ligne d'historique distincte, identifiée par son invitation. Un index unique partiel garantit qu'une seule relation active existe pour une même paire à un instant donné.

Ainsi, après `owner_revoked` ou `contact_withdrew`, une nouvelle relation n'est possible qu'au moyen d'une nouvelle invitation et d'une nouvelle acceptation explicite. Les anciennes relations et leurs causes de rupture restent conservées ; aucune relation terminée n'est réactivée.

## 16. Isolation des SOS historiques après une nouvelle invitation

Le droit d'accès à un SOS repose sur une relation qui existait au déclenchement de l'alerte et qui n'a pas été suivie d'un retrait volontaire. Un retrait volontaire ultérieur invalide l'accès à toutes les alertes actives et historiques issues de ce cercle, même si une relation antérieure avait été révoquée par le propriétaire. Une nouvelle invitation acceptée ouvre uniquement les SOS futurs ; elle ne restaure jamais l'accès aux anciens SOS. Une révocation initiée par le propriétaire, sans retrait volontaire ultérieur, conserve le comportement historique des alertes déjà actives.


## 17. Décision produit validée — coupure totale symétrique après toute rupture (2026-11-25)

La règle de coupure totale immédiate s'applique à toute rupture de la relation, quel que soit l'initiateur :
- owner_revoked : le propriétaire retire le proche ;
- contact_withdrew : le proche quitte volontairement le cercle.

Dès que la rupture est confirmée atomiquement côté serveur, les deux personnes perdent immédiatement tout accès réciproque aux données et fonctions qui dépendaient de cette relation, y compris pendant un SOS actif : détail et état du SOS, chronologie et mises à jour, positions GPS actuelles et futures, rappels et notifications, accusés de réception, volontariat, coordination et responsabilité. Aucun accès ne peut être rétabli par une session, un cache, un abonnement push, une tâche déjà en file, un ticket GPS ou une nouvelle relation ultérieure.

Le SOS de l'auteur continue sans interruption. Les autres proches qui disposent encore d'une relation valide ne sont pas affectés. Les informations déjà reçues ou copiées localement avant la rupture ne peuvent pas être effacées à distance ; aucune promesse d'effacement rétroactif n'est faite.

L'historique de la relation est conservé avec la cause exacte et l'identité de l'initiateur. Toute nouvelle relation exige une nouvelle invitation et une nouvelle acceptation explicite. Une nouvelle relation n'accorde aucun accès aux SOS antérieurs.

Cette décision remplace toute disposition antérieure qui maintenait des droits après une révocation initiée par le propriétaire. Les gardes D1, les API de lecture/action, les workers push/SMS et le relais GPS doivent appliquer la même règle, avec vérification d'autorisation au dernier point d'accès ou de livraison.
