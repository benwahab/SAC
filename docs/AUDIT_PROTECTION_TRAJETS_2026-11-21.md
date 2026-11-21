# SAC — Audit de la Protection des trajets

**Date : 21 novembre 2026**  
**Dépôt :** `benwahab/SAC` — branche `main`  
**Statut :** audit du code existant et des décisions produit.

## 1. Décision produit déjà validée

La Protection des trajets doit proposer trois modes sélectionnables par l'utilisateur :

1. **Vérification d'arrivée** : l'utilisateur confirme personnellement son arrivée.
2. **Accompagnement par un proche** : les proches autorisés peuvent accompagner le trajet.
3. **Protection complète** : suivi, gestion du retard et confirmation d'arrivée.

La position GPS précise est soumise à une règle ferme : à la clôture, les positions GPS doivent être supprimées automatiquement et irréversiblement. L'historique de l'alerte peut rester conservé 30 jours après clôture, mais les coordonnées GPS ne doivent pas attendre ce délai.

## 2. Code existant vérifié

- `src/domain/trip-protection.ts` définit un contrat métier pur pour les trois modes, la confirmation d'arrivée, le marquage d'une arrivée non confirmée et la clôture par l'auteur.
- `tests/trip-protection.test.ts` teste les transitions de ce modèle.
- Le module précise lui-même qu'il ne stocke pas les coordonnées GPS et ne planifie aucun rappel.
- `src/private/types.ts` ne déclare aucun écran de trajet.
- `src/PrivateSpacePage.tsx` ne route vers aucun écran Protection des trajets.
- `src/private/usePrivateData.ts` ne charge aucune donnée de trajet.
- Les chemins API de trajets examinés ne contiennent pas d'endpoint de création, lecture, clôture ou suivi.
- Aucun écran de création ou de suivi de trajet n'a été trouvé dans les écrans privés examinés.

**Conclusion : la logique métier existe sous forme isolée, mais la Protection des trajets n'est pas une fonctionnalité opérationnelle de l'application.** Elle n'est ni persistée dans D1 ni accessible dans l'interface.

## 3. Travaux nécessaires

1. Définir le parcours utilisateur de création et de suivi pour chacun des trois modes.
2. Ajouter un schéma D1 pour les trajets, les destinataires autorisés, les échéances, les états et les événements.
3. Créer les endpoints authentifiés de création, lecture, confirmation d'arrivée et clôture.
4. Implémenter les rappels et transitions automatiques uniquement après validation des délais et règles de relance.
5. Construire les écrans mobiles de création, liste et suivi des trajets.
6. Préserver l'instantané des destinataires au démarrage du trajet et les règles de révocation qui seront validées.
7. Ajouter les tests D1 d'atomicité, d'expiration, de concurrence, de révocation et d'isolation des comptes.

## 4. Points non validés à ne pas inventer

Les valeurs proposées antérieurement pour le délai de grâce, les durées d'accompagnement, les plafonds de partage GPS, les relances et le comportement d'une alerte sans responsable n'ont pas été confirmées. Elles ne doivent pas devenir des constantes de production par défaut.

Le GPS reste hors du périmètre de cet audit et aucune nouvelle activation ou transmission de coordonnées n'est autorisée par ce document.

## 5. Règles de confidentialité à préserver

- La clôture d'un trajet déclenche la suppression irréversible des coordonnées GPS précises liées à ce trajet.
- Les coordonnées ne doivent pas être copiées dans l'historique, les journaux applicatifs ou les événements métier.
- La conservation de l'historique d'alerte pendant 30 jours ne prolonge jamais la conservation des coordonnées GPS.
- Aucun proche ne reçoit un droit de suivi par simple appartenance à un groupe : seuls les destinataires explicitement autorisés pour ce trajet peuvent participer.
- Aucun trajet de test ne doit envoyer de notification réelle ni partager une position réelle.

## 6. État de cet audit

Aucun code applicatif, aucune migration D1 et aucune ressource Cloudflare n'ont été modifiés pour les trajets par cet audit. Les tests métier existants ne prouvent pas la persistance ni le fonctionnement de bout en bout.
