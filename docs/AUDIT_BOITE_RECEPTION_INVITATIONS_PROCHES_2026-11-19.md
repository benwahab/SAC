# SAC — Audit de la boîte de réception des invitations de proches

**Date : 19 novembre 2026**  
**Branche examinée :** `main`  
**Statut :** audit du code existant ; aucune implémentation ni migration réalisée.

## 1. Périmètre examiné

Fichiers relus :
- `functions/api/contacts/index.ts`
- `functions/api/contacts/invitations/index.ts`
- `functions/api/contacts/invitations/accept.ts`
- `functions/api/contacts/invitations/decline.ts`
- `functions/lib/trusted-contacts/service.ts`
- `src/PrivateSpacePage.tsx`
- `src/InvitationAcceptancePage.tsx`
- `src/domain/contact-invitations.ts`
- `migrations/0002_contact_invitations.sql`
- `docs/CONTRAT_CYCLE_VIE_PROCHES_ET_INVITATIONS.md`
- `docs/ETAT_ARBITRAGES_INVITATIONS_2026-11-18.md`

## 2. Constat fonctionnel

Le parcours d'invitation par lien existe déjà :
- un membre connecté peut inviter une adresse e-mail ;
- le serveur crée une invitation en attente et envoie le lien par e-mail ;
- le destinataire doit être connecté avec un compte actif dont l'adresse e-mail principale vérifiée correspond à la destination ;
- le lien permet de consulter l'invitation puis d'accepter ou de refuser explicitement ;
- l'acceptation et la création de la relation directionnelle sont effectuées côté serveur ;
- les proches actifs sont listés dans l'espace privé et peuvent être révoqués par leur propriétaire.

En revanche, l'espace privé ne présente actuellement aucune liste des invitations reçues ou envoyées en attente. L'API `GET /api/contacts/invitations` n'est pas une boîte de réception : elle exige l'identifiant et le jeton d'un lien précis et ne renvoie que cette invitation après contrôle du compte destinataire.

La migration contient déjà un index sur `destination_email, status, created_at`, compatible avec une future recherche des invitations reçues. Cet index ne constitue pas à lui seul une API ni une interface.

## 3. Point bloquant pour une vraie boîte de réception

Les endpoints d'acceptation et de refus exigent actuellement le jeton secret présent dans le lien reçu par e-mail. Le jeton brut n'est pas conservé en base ; seul son condensat est stocké.

Conséquence : une liste d'invitations reçues pourrait afficher les invitations en attente, mais ne pourrait pas fournir des boutons Accepter/Refuser fonctionnels sans revoir le mécanisme de preuve. Il ne faut ni stocker le jeton brut en base, ni supprimer son exigence sans remplacer cette preuve par un mécanisme équivalent.

Deux parcours techniques sont envisageables, mais aucun n'est approuvé par ce document :
1. **Conserver le lien e-mail comme preuve :** la boîte de réception liste les invitations et renvoie vers le parcours sécurisé du lien reçu ; l'utilisateur doit retrouver/ouvrir son e-mail pour répondre.
2. **Créer une preuve authentifiée liée au compte destinataire :** après vérification de l'identité e-mail du compte connecté, un mécanisme serveur dédié autorise la réponse depuis la boîte SAC, avec protections anti-CSRF, anti-rejeu, expiration, contrôle de destination et transition atomique.

Le choix doit être validé avant d'ajouter des actions dans la boîte de réception.

## 4. Éléments à préserver impérativement

- Une invitation en attente ne crée aucun lien de confiance et ne donne aucun accès aux alertes, trajets ou positions.
- L'acceptation reste explicite et réservée au compte actif dont l'e-mail vérifié correspond exactement à la destination.
- Le refus ne crée aucune relation.
- Une invitation ne peut être consommée qu'une seule fois ; expiration, révocation et décisions terminales restent irréversibles.
- Une relation reste directionnelle ; aucune réciprocité implicite.
- Ne jamais exposer à un compte non autorisé si une adresse e-mail possède un compte SAC.
- Le jeton brut ne doit pas être stocké ni journalisé.
- Ne pas afficher les détails privés d'une alerte dans la boîte de réception des invitations.

## 5. État des arbitrages à ne pas considérer comme validés

La durée d'expiration, les relances, les quotas anti-abus, les délais de refroidissement, la révocation symétrique et les droits pendant une alerte en cours restent à arbitrer selon `docs/ETAT_ARBITRAGES_INVITATIONS_2026-11-18.md`.

Cet audit ne valide aucune de ces propositions et ne choisit pas de fournisseur e-mail.

## 6. Travaux nécessaires avant implémentation

1. Faire valider le mode de réponse depuis la boîte SAC (lien e-mail seulement ou preuve authentifiée liée au compte).
2. Définir séparément les vues « reçues » et « envoyées », les champs minimaux exposés et les états visibles.
3. Définir le retrait d'une invitation envoyée encore en attente, sans réactiver d'ancien jeton.
4. Spécifier les limites anti-abus et l'expiration avant d'automatiser les transitions.
5. Ajouter les tests d'autorisation, de correspondance d'e-mail, d'expiration, de rejeu, de concurrence acceptation/retrait et de non-divulgation.
6. Implémenter seulement après validation, avec revue des endpoints et des requêtes D1.

## 7. Actions effectuées

- Lecture des fichiers et contrats cités ci-dessus sur `main`.
- Aucun fichier applicatif modifié.
- Aucune migration exécutée ou créée.
- Aucune ressource Cloudflare modifiée.
- Aucun e-mail, push ou SMS envoyé.
- Aucun déploiement déclenché.


## Mise à jour d'implémentation — 21 novembre 2026

Une première boîte de suivi des invitations en attente a été ajoutée :

- `GET /api/contacts/invitations/inbox` exige une session d'appareil authentifiée et retourne séparément les invitations reçues et envoyées encore en attente et non expirées.
- Les invitations reçues sont recherchées uniquement via l'adresse e-mail principale vérifiée du compte connecté.
- Les invitations envoyées sont limitées au compte invitant connecté.
- Aucun jeton secret n'est exposé dans la réponse ; le jeton brut reste uniquement dans le lien e-mail.
- L'écran « Mes proches » affiche les deux listes et les dates d'expiration.

La réponse aux invitations reçues reste volontairement effectuée via le lien sécurisé envoyé par e-mail. La boîte SAC indique cette règle et ne crée pas de boutons Accepter/Refuser sans preuve de possession du jeton. Le parcours sécurisé existant reste inchangé.

Aucune migration supplémentaire n'est nécessaire : la migration 0002 contient déjà l'index de recherche par adresse destinataire, statut et date de création. Aucun jeton ni contenu sensible n'est ajouté en base.
