# SAC — Matrice d'autorisation et séparation des rôles

**Statut :** politique de sécurité proposée avant API métier.  
**Aucune permission n'est accordée par la simple connaissance d'un identifiant.**  
Cette matrice n'est pas une configuration D1 ou un RBAC déjà déployé.

## 1. Principes obligatoires

1. Refus par défaut : toute action non explicitement autorisée est refusée.
2. Le compte et l'appareil de l'acteur proviennent de la session authentifiée et vérifiée côté serveur.
3. Le client ne peut pas s'attribuer un rôle, un statut, une relation de confiance ou une qualité de destinataire.
4. Chaque lecture et chaque écriture est autorisée indépendamment ; protéger uniquement la route de détail ne suffit pas.
5. Une relation de confiance est directionnelle : A qui choisit B n'obtient pas automatiquement les droits de B.
6. L'appartenance à un groupe ne donne aucun accès à une alerte, à une position ou à un trajet.
7. Les destinataires d'une alerte sont déterminés par l'instantané créé au déclenchement. Aucun contact ne peut s'ajouter lui-même.
8. Les workers ont des permissions techniques limitées et ne disposent pas d'un accès général aux comptes.
9. Les opérateurs et administrateurs ne doivent pas disposer d'un accès permanent au contenu privé des alertes ou aux positions GPS.
10. Une autorisation positive est recalculée à partir de l'état courant, sans cache qui survivrait à une révocation.

## 2. Acteurs

### 2.1 Propriétaire du compte

Peut :
- consulter et modifier son profil et ses préférences ;
- créer et révoquer ses relations de confiance ;
- choisir les destinataires par catégorie ;
- consulter ses propres alertes et trajets ;
- déclencher, annuler avant dispatch ou clôturer ses alertes selon le cycle prévu ;
- consulter et révoquer ses propres appareils ;
- demander la suppression de son compte.

Ne peut pas :
- consulter les comptes privés des contacts au-delà des informations minimales nécessaires à la relation ;
- lire les alertes d'un contact simplement parce qu'il l'a invité ;
- approuver un appareil secondaire depuis un appareil qui n'est pas la racine active ;
- modifier l'historique append-only d'une alerte.

### 2.2 Contact destinataire

Peut uniquement, pour une alerte où son compte figure dans l'instantané :
- lire les informations minimales nécessaires à cette alerte, selon la politique d'accès après révocation à valider ;
- accuser réception ;
- se porter volontaire ;
- retirer sa candidature ou sa responsabilité ;
- demander du renfort si cette action est ultérieurement retenue et spécifiée.

Ne peut pas :
- clôturer ou annuler l'alerte de l'auteur ;
- changer la catégorie ou le niveau ;
- modifier ou supprimer les autres destinataires ;
- s'ajouter à l'instantané ;
- consulter le profil complet, les autres alertes, les autres trajets ou les appareils de l'auteur ;
- voir une position GPS si le partage n'est pas explicitement autorisé et actif.

Un contact qui n'est pas dans l'instantané ne peut pas accéder à l'alerte, même s'il connaît son identifiant ou appartient à un groupe commun.

### 2.3 Appareil

L'appareil n'est pas un rôle métier autonome. Il porte une identité de session et des clés propres.
- un appareil actif peut agir pour son compte dans les limites de ses autorisations ;
- un appareil en attente ne peut pas accéder aux fonctions protégées ;
- un appareil révoqué ne peut plus ouvrir de session, renouveler ses jetons ou initier un partage ;
- seul l'appareil racine actif approuve un appareil secondaire en V1 ;
- la révocation d'un appareil n'efface pas à distance ses données locales s'il est hors ligne.

### 2.4 Worker de notifications

Peut :
- acquérir un bail sur une tâche outbox ;
- lire les seules données minimales nécessaires pour envoyer le message ;
- vérifier l'état actif de l'alerte et la validité de l'abonnement push juste avant l'envoi ;
- écrire le résultat technique et le code d'erreur non sensible.

Ne peut pas :
- clôturer une alerte ;
- changer ses destinataires ;
- modifier une réponse ou une responsabilité ;
- consulter un historique GPS ;
- lire les secrets privés, OTP ou jetons bruts ;
- envoyer un rappel à un compte absent de l'instantané.

Le worker n'infère jamais qu'un message a été lu parce que le fournisseur a accepté la requête.

### 2.5 Support et opérateurs

Aucun rôle support/admin n'est actuellement validé comme ayant accès au contenu privé.

**Recommandation :** le support reçoit uniquement des métadonnées de diagnostic minimales : identifiant de compte opaque, état d'inscription, statut technique, code d'erreur borné et état d'abonnement. Il ne voit pas les descriptions d'alerte, les conversations privées, les positions, les clés, les jetons ou les pièces jointes.

Toute procédure exceptionnelle (récupération, suspension, fraude, demande légale) devra être spécifiée séparément avec finalité, autorisation, journal d'accès, durée et séparation des tâches. Aucun compte super-admin ne doit être créé avec un accès global implicite.

## 3. Matrice synthétique

| Ressource / action | Propriétaire | Contact dans l'instantané | Autre utilisateur | Worker | Support |
|---|---|---|---|---|---|
| Profil complet | Lire/écrire le sien | Non | Non | Non | Non par défaut |
| Relations de confiance | Gérer les siennes | Aucun droit automatique | Non | Non | Non |
| Appareils et sessions | Gérer les siens | Non | Non | Non | Métadonnées minimales seulement |
| Créer une alerte | Oui | Non | Non | Non | Non |
| Lire une alerte active | Oui | Oui, sous réserve de la règle de révocation | Non | Seulement champs d'envoi minimaux | Non |
| Accuser réception | Non | Oui | Non | Non | Non |
| Se porter volontaire / retirer | Non | Oui | Non | Non | Non |
| Clôturer une alerte | Auteur uniquement | Non | Non | Non | Non |
| Modifier les destinataires | Avant déclenchement seulement | Non | Non | Non | Non |
| Lire l'historique après clôture | Oui | Proposition : non après clôture | Non | Non | Non |
| Voir une position GPS | Auteur selon consentement | Uniquement partage actif autorisé | Non | Jamais en clair | Jamais |
| Envoyer une notification | Non | Non | Non | Oui, destinataires autorisés uniquement | Non |
| Modifier un résultat de notification | Non | Non | Non | Statut technique uniquement | Non |

Les droits après révocation et après clôture sont des propositions soumises au registre des décisions produit restantes.

## 4. Autorisation par ressource

### 4.1 Alertes
- détail, liste, événements, réponses, responsabilités et pièces jointes doivent appliquer le même contrôle d'accès ;
- la présence de l'identifiant d'alerte dans l'URL n'accorde aucun droit ;
- l'auteur est identifié par author_account_id chargé depuis la base ;
- le contact est identifié par une ligne de l'instantané ;
- le serveur ne fait pas confiance à un rôle, author_id ou recipient_id envoyé par le navigateur.

### 4.2 Positions et partage
- consentement explicite de l'auteur et durée active obligatoires ;
- destinataire exact et clé cryptographique vérifiés ;
- révocation de l'appareil ou du contact bloque les nouveaux partages selon la politique validée ;
- aucune position précise dans les journaux, traces, erreurs, analytics, D1 ou R2 tant que la garantie J+30 n'est pas prouvée ;
- un worker de notification n'a jamais besoin de déchiffrer une position.

### 4.3 Contacts et invitations
- seul le propriétaire gère ses invitations et relations sortantes ;
- le destinataire accepte sa propre invitation après vérification ;
- l'acceptation d'une invitation ne crée pas de relation inverse ;
- une invitation en attente n'accorde aucun accès ;
- révoquer une relation bloque les nouvelles alertes et les nouveaux trajets associés.

### 4.4 Trajets
- l'auteur crée, modifie, met en pause, termine ou annule son propre trajet ;
- les contacts choisis reçoivent uniquement les informations explicitement partagées ;
- un contact ne peut pas transformer une arrivée non confirmée en alerte critique ;
- un contact ne peut pas clôturer un SOS de l'auteur.

## 5. Règles techniques d'application

- Toute route sensible vérifie compte, appareil, session, statut, expiration et auth_version.
- Toute lecture SQL filtre par propriétaire ou instantané autorisé.
- Toute écriture inclut les préconditions d'autorisation dans l'instruction finale ou la transaction atomique.
- Les contrôles d'accès ne sont pas réalisés uniquement dans React ou dans un middleware qui ne revalide pas l'état courant.
- Les requêtes utilisent des paramètres préparés.
- Les erreurs publiques ne révèlent pas si un compte, une invitation ou une alerte existe lorsqu'une telle révélation facilite l'énumération.
- Les journaux consignent l'action, le résultat, l'acteur opaque et l'horodatage ; ils n'enregistrent pas le corps libre ni les secrets.
- Les exports, notifications, recherches, compteurs, listes paginées et endpoints secondaires appliquent les mêmes permissions.
- Les clés privées et secrets ne sont jamais accessibles au support ni au worker.

## 6. Tests d'accès obligatoires

1. Un compte A ne lit aucune alerte de B sans être destinataire.
2. Un contact non sélectionné ne lit pas l'alerte même s'il devine son identifiant.
3. Un contact sélectionné ne lit pas les autres alertes de l'auteur.
4. Un contact ne peut pas modifier le niveau, la description ou les destinataires.
5. Un contact ne peut jamais clôturer l'alerte.
6. L'auteur peut lire et clôturer uniquement ses propres alertes.
7. Une relation directionnelle n'autorise pas les lectures inverses.
8. L'adhésion à un groupe n'accorde aucun droit d'accès implicite.
9. Un appareil en attente ou révoqué ne peut pas utiliser les endpoints protégés.
10. Un worker ne peut lire que les données d'envoi nécessaires et ne peut pas clôturer une alerte.
11. Le support ne peut pas consulter le contenu d'une alerte ni une position.
12. Une révocation concurrente avec une lecture ou écriture est appliquée selon la règle d'ordre et les conditions SQL validées.
13. Les endpoints de liste, export, recherche, événements et pièces jointes ne contournent pas les règles du détail.
14. Aucun secret ni contenu GPS n'apparaît dans les logs et réponses d'erreur.

## 7. Points bloquants avant RBAC/API

- valider les droits d'un contact révoqué pendant une alerte active ;
- valider les droits de lecture après clôture ;
- définir le rôle exact du support et les procédures exceptionnelles ;
- fixer les autorisations des groupes privés ;
- définir les permissions de chaque mode de Protection des trajets ;
- prouver l'application des contrôles dans les transactions D1.

**Aucune matrice d'autorisation n'est considérée comme déployée tant que les contrôles serveur et les tests d'intégration D1 ne sont pas présents.**
