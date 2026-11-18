# SAC — Propositions d'arbitrage pour les groupes privés

**Date :** 18 novembre 2026  
**Statut :** propositions de conception à confirmer ; aucune règle ci-dessous n'est réputée approuvée par le seul fait de ce document.  
**Périmètre :** groupes privés de proches dans l'application citoyenne.

## 1. Principes déjà établis

- Les groupes sont privés et servent à organiser les proches.
- L'appartenance à un groupe ne donne aucun accès automatique à une alerte, à une position GPS, à un trajet ou aux données du compte d'un membre.
- La sélection des destinataires d'une alerte reste explicite et vérifiée côté serveur.
- Une relation de confiance A → B est directionnelle ; un groupe ne rend pas cette relation réciproque.
- Un compte SAC actif exige une adresse e-mail vérifiée par OTP. Un numéro de téléphone déclaré ou un SMS ne remplace pas cette exigence.

## 2. Proposition de séparation des objets

Conserver trois objets indépendants :

1. **Compte SAC** : identité canonique d'une personne.
2. **Relation de confiance** : autorisation directionnelle entre deux comptes, issue d'une invitation et d'une acceptation explicites.
3. **Adhésion à un groupe** : appartenance organisationnelle privée, sans droit de confiance ni droit d'accès aux alertes.

Conséquence : ajouter quelqu'un à un groupe ne l'ajoute pas automatiquement aux contacts de confiance ; retirer quelqu'un d'un groupe ne révoque pas automatiquement une relation de confiance distincte. Les deux opérations doivent être clairement séparées dans l'interface.

## 3. Cycle proposé d'un groupe

### Création
- Un utilisateur SAC actif crée un groupe privé et en devient propriétaire.
- Le groupe possède un identifiant, un nom, une date de création, un propriétaire et un état.
- Les groupes imbriqués et les groupes publics sont exclus de cette proposition.

### Invitation et adhésion
- Le propriétaire envoie une invitation à une personne disposant déjà d'un compte SAC actif, ou l'invite à créer un compte sans lui accorder d'accès avant activation et acceptation.
- L'invitation est liée à une destination et à un groupe précis ; elle ne donne aucun accès avant acceptation explicite.
- L'acceptation est enregistrée côté serveur avec la version des conditions présentées.
- Une invitation refusée, expirée ou révoquée ne peut pas être réutilisée.
- L'adhésion ne crée ni relation de confiance ni droit d'être destinataire d'un SOS.

### Rôles

**Proposition simple :** deux rôles uniquement : propriétaire et membre.
- Le propriétaire gère le nom du groupe, les invitations, les adhésions et la suppression du groupe.
- Un membre peut consulter les informations organisationnelles du groupe et quitter le groupe.
- Aucun rôle d'administrateur délégué, aucune sous-délégation et aucune permission d'accès aux alertes ne sont créés par le groupe.
- Le transfert de propriété doit être une action explicite acceptée par le nouveau propriétaire.

### Sortie et révocation
- Un membre peut quitter le groupe à tout moment ; l'accès lié à l'adhésion cesse immédiatement.
- Le propriétaire peut retirer un membre ; l'accès lié à l'adhésion cesse immédiatement.
- Le retrait d'un membre ne clôture pas ses alertes, ne modifie pas les destinataires figés d'une alerte déjà déclenchée et ne révoque pas une relation de confiance indépendante.
- Une réinvitation crée une nouvelle invitation et une nouvelle adhésion ; elle ne restaure aucun droit historique.

### Suppression du groupe
- La suppression du groupe révoque toutes les adhésions et invitations encore actives.
- Elle ne supprime pas les comptes des membres ni leurs relations de confiance indépendantes.
- Elle ne modifie pas rétroactivement les alertes déjà déclenchées.
- Une suppression de groupe ne doit pas servir à contourner les règles de conservation des alertes ou de suppression GPS.

## 4. Confidentialité et sécurité

- Les listes de membres ne sont visibles qu'aux personnes autorisées selon l'adhésion active.
- Les invitations ne révèlent pas si une adresse ou un numéro appartient déjà à un compte SAC ; appliquer une réponse anti-énumération.
- Toute action sensible vérifie le propriétaire ou le membre autorisé côté serveur, jamais uniquement dans l'interface.
- Les identifiants de groupe ne sont pas des secrets d'accès.
- Les notifications de groupe ne doivent pas contenir de détail SOS, de position ou de contenu privé d'un membre.
- Aucun membre ne peut consulter les alertes, trajets ou positions d'un autre membre du seul fait de l'appartenance au groupe.
- Les journaux doivent enregistrer les événements de gestion nécessaires sans conserver inutilement le contenu d'invitation ou des données personnelles.

## 5. Limites d'offre et règles encore ouvertes

Ne pas déduire automatiquement la taille maximale d'un groupe des limites de contacts de confiance (Gratuit : 2 ; Premium : 10). Ce sont deux notions distinctes tant que l'utilisateur ne les a pas explicitement liées.

À arbitrer avant schéma D1 et interface :
1. nombre de groupes autorisés par compte et éventuelle différence Gratuit/Premium ;
2. nombre maximal de membres par groupe ;
3. possibilité pour un compte d'appartenir à plusieurs groupes ;
4. possibilité d'inviter un membre qui n'est pas déjà un contact de confiance ;
5. visibilité du nom et de la liste des membres avant acceptation ;
6. canal d'invitation, expiration, relances et limites anti-abus ;
7. conditions et parcours de transfert de propriété ;
8. suppression ou archivage du groupe lorsque le propriétaire supprime son compte ;
9. durée de conservation des événements d'adhésion et des invitations.

## 6. Modèle conceptuel minimal proposé

| Objet | Responsabilité | État de décision |
|---|---|---|
| `groups` | Identité privée, nom, propriétaire, état et dates | À ajouter au modèle après arbitrage |
| `group_invitations` | Destination, jeton/proof, expiration, acceptation/refus/révocation | Cycle à définir |
| `group_members` | Groupe, compte, rôle, date d'entrée et sortie | À ajouter au modèle après arbitrage |
| `group_events` | Création, transfert, adhésion, sortie, retrait, suppression | Rétention à définir |

Ces noms sont conceptuels et ne constituent pas une décision de schéma SQL. Les opérations multi-objets devront être atomiques et idempotentes.

## 7. Tests obligatoires avant activation

- invitation en attente : aucun accès à la liste privée ;
- adhésion acceptée : accès limité aux seules informations du groupe ;
- appartenance au groupe sans relation de confiance : aucun accès SOS/GPS ;
- relation de confiance sans appartenance au groupe : les droits de confiance restent inchangés ;
- sortie et retrait concurrents : une seule transition effective ;
- transfert de propriété concurrent à une suppression : résultat atomique et déterministe ;
- suppression du groupe : révocation de toutes les adhésions sans suppression des comptes ;
- ancienne invitation ou ancienne adhésion rejouée : aucun accès rétabli ;
- accès croisé par identifiant deviné : refus serveur ;
- absence de fuite dans les notifications, journaux et exports.

## 8. Décision attendue

Les principes de confidentialité de la section 1 sont déjà établis et ne sont pas remis en question. Les règles de cycle de vie, les rôles, le modèle minimal et les valeurs chiffrées restent des propositions à arbitrer. Aucun groupe, endpoint, table, migration, notification ou écran n'est créé par ce document.
