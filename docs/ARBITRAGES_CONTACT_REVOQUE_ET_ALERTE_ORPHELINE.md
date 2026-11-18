# SAC — Arbitrages de sécurité : contact révoqué et alerte sans réponse de l'auteur

**Statut :** analyse et options à valider ; aucune nouvelle règle produit n'est considérée comme approuvée par ce document.  
**Règles existantes non modifiées :** les destinataires initiaux sont figés ; les rappels SOS sont prévus toutes les cinq minutes jusqu'à la clôture par l'auteur ; seul l'auteur clôture ou annule une alerte déclenchée.

## 1. Révocation d'un contact pendant une alerte active

### 1.1 Ne pas confondre quatre droits

La relation de confiance, l'appartenance à l'instantané initial, la réception de rappels et le droit de recevoir de nouvelles positions sont des notions différentes.

| Droit | Situation actuelle / proposition |
|---|---|
| Rester dans l'instantané initial | Règle établie : l'historique ne change pas |
| Recevoir les rappels initiaux | Règle établie : continue jusqu'à clôture |
| Recevoir de nouvelles positions | Arrêt à la révocation proposé, à confirmer |
| Lire le détail de l'alerte active | Non tranché |
| Accuser réception après révocation | Non tranché |
| Se porter volontaire après révocation | Non tranché |
| Conserver la responsabilité principale après révocation | Non tranché |
| Lire l'historique après clôture | Retrait proposé, à confirmer |

### 1.2 Options pour l'accès au détail de l'alerte active

**Option A — accès limité jusqu'à clôture (recommandation de continuité)**
- le contact continue de recevoir les rappels prévus ;
- il voit uniquement les informations minimales de l'alerte initiale et son état ;
- aucune nouvelle position ni mise à jour de trajet ne lui est envoyée ;
- après clôture, l'accès au détail est retiré ;
- les preuves et événements restent conservés selon la matrice légale, mais ne sont pas consultables par ce contact.

Avantage : le contact comprend pourquoi les rappels continuent et peut apporter une aide liée à l'alerte initiale. Risque : il conserve un accès limité malgré la révocation.

**Option B — rappel minimal sans accès au détail**
- les rappels initiaux continuent, mais ne contiennent qu'un identifiant opaque et un message minimal ;
- le contact ne peut plus ouvrir l'alerte ni voir les informations initiales ;
- aucune position n'est transmise.

Avantage : réduction maximale de l'accès après révocation. Risque : le contact peut recevoir des rappels qu'il ne peut pas contextualiser.

**Recommandation proposée :** Option B si la révocation représente une rupture de confiance ou une mesure de sécurité ; Option A uniquement si l'utilisateur veut préserver une capacité d'assistance pendant l'alerte. Le produit doit décider si la révocation est toujours immédiate et sans motif, ou si elle peut être déclenchée par mesure de protection.

### 1.3 Réponses et responsabilité

- **Accusé de réception :** autoriser après révocation n'accorde aucun accès GPS ; cela confirme seulement la réception du rappel.
- **Nouveau volontariat :** proposition de le bloquer après révocation.
- **Responsable principal déjà en fonction :** proposition de considérer la révocation comme un retrait de responsabilité, puis de transférer au prochain volontaire éligible selon l'ordre de prise en charge.
- **Aucun autre volontaire :** l'alerte reste active ; le système ne prétend pas qu'une personne est encore en charge.

Ces règles doivent être décidées ensemble : interdire le volontariat sans traiter le cas du responsable actuel créerait une responsabilité fantôme.

### 1.4 Exigences techniques indépendantes de l'arbitrage

Quelle que soit l'option :
- une révocation effective interdit les nouvelles émissions de position vers le contact ;
- l'ordre entre révocation et émission doit être déterminé par une autorisation atomique au dernier point d'envoi ;
- les paquets déjà reçus ne peuvent pas être effacés à distance ;
- le worker de rappel SOS ne doit pas interpréter la révocation comme une clôture ;
- l'interface doit afficher clairement que les positions ne sont plus partagées ;
- les événements de révocation, d'accusé, de retrait et de transfert doivent être horodatés et audités sans coordonnées GPS.

## 2. Alerte active dont l'auteur ne revient jamais

### 2.1 Le conflit à résoudre

Deux règles se rencontrent :
- seul l'auteur peut clôturer ou annuler une alerte déclenchée ;
- les rappels SOS continuent toutes les cinq minutes jusqu'à cette clôture.

Si l'auteur perd son téléphone, devient incapable de répondre ou désinstalle l'application, le système ne possède actuellement aucune règle autorisée pour terminer l'alerte. La suppression de compte reste donc en attente. Il ne faut pas inventer une clôture automatique ou un pouvoir de clôture pour les contacts.

### 2.2 Scénarios possibles

**Option 1 — maintien strict**
- l'alerte reste active ;
- les rappels continuent selon la règle toutes les cinq minutes ;
- les contacts peuvent accuser réception, se porter volontaires selon leurs droits et transférer la responsabilité ;
- aucun contact ne clôture l'alerte ;
- la suppression du compte reste en attente.

Risque : rappels sans fin, fatigue des contacts et coûts de notification.

**Option 2 — suspension des rappels après une échéance**
- l'alerte reste active et visible ;
- après un délai à décider, les rappels périodiques sont suspendus ;
- l'état est explicitement « auteur injoignable / alerte non clôturée », jamais « résolue » ;
- la réception d'un signal fiable peut relancer les rappels.

Risque : modifie la règle approuvée des rappels toutes les cinq minutes jusqu'à clôture. Nécessite une nouvelle validation explicite.

**Option 3 — signalement de résolution par les contacts, sans clôture**
- un contact peut déclarer « je pense que la situation est terminée » ;
- cette déclaration est une information, pas une clôture ;
- l'alerte reste active et l'auteur conserve le droit exclusif de clôture ;
- les autres contacts et l'auteur reçoivent le signalement.

Risque : n'arrête pas les rappels et ne règle pas le cas d'un auteur durablement indisponible.

**Option 4 — procédure exceptionnelle de clôture**
- définir une procédure exceptionnelle, par exemple une confirmation renforcée par plusieurs contacts ;
- elle serait distincte de la clôture ordinaire par l'auteur et auditée ;
- elle nécessiterait des règles de quorum, de preuve, de contestation et de protection contre la collusion.

Risque : changement majeur du principe « seul l'auteur clôture » ; à exclure sans décision explicite et étude juridique.

### 2.3 Recommandation provisoire

Ne pas activer une clôture automatique, une clôture par contact ou une suspension des rappels sans décision utilisateur.

Pour protéger la confidentialité et limiter les conséquences d'une alerte orpheline, il faut néanmoins distinguer la durée de vie de l'alerte de la durée de partage de localisation :
- une alerte peut rester ouverte dans l'historique ;
- un partage de position doit avoir une durée maximale explicite et indépendante ;
- l'expiration d'un partage arrête les nouvelles positions, sans fermer ni déclarer résolue l'alerte ;
- les positions précises déjà collectées restent soumises à la règle irréversible J+30 après fin effective du partage ;
- aucun stockage GPS persistant côté serveur n'est autorisé tant que la destruction J+30 n'est pas prouvée.

**Cette séparation est une recommandation à valider :** elle n'ajoute pas encore de durée maximale, car aucune valeur n'a été approuvée.

## 3. Effets sur la suppression de compte

Tant qu'une alerte ou un trajet reste actif :
- le compte reste en `deletion_pending` ;
- les nouvelles activités restent bloquées ;
- l'utilisateur conserve uniquement les moyens nécessaires à la clôture de ses activités ;
- aucune donnée n'est effacée au détriment de l'intégrité de l'alerte ;
- aucune durée de conservation n'est prolongée sans fondement ; la matrice légale doit distinguer l'alerte active des données qui peuvent être supprimées ou minimisées.

Le compte ne doit pas être déclaré supprimé si les obligations de sécurité et les tâches actives ne sont pas résolues.

## 4. Tests d'intégration D1 et de concurrence requis

1. révocation pendant émission GPS ;
2. révocation simultanée à l'échéance d'un rappel SOS ;
3. révocation du responsable principal avec plusieurs volontaires ;
4. révocation du responsable principal sans volontaire suivant ;
5. auteur hors ligne et rappels répétés ;
6. auteur désinstallant l'application sans clôture ;
7. expiration du partage de position alors que l'alerte reste active ;
8. demande de suppression pendant alerte orpheline ;
9. reprise de l'auteur après longue indisponibilité ;
10. vérification qu'aucun statut « résolu » n'est déduit d'une simple absence de réponse.

**Aucune migration D1 ni API n'est autorisée par cette note.**
