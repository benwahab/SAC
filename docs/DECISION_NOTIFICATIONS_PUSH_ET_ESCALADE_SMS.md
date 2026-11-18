# SAC — Décision produit : push prioritaire et escalade SMS

**Date :** 18 novembre 2026  
**Statut :** décision produit validée par le porteur du projet.  
**Périmètre :** alertes SOS et contacts de confiance.  
**Implémentation :** non réalisée ; ce document fixe le comportement attendu.

## Décision

Les notifications push dans l'application sont le canal normal et prioritaire des alertes SAC. Le SMS intervient comme canal secondaire d'escalade lorsque plusieurs rappels push ont été effectués sans qu'aucun contact n'ait réellement pris la responsabilité principale de l'alerte.

Le lanceur d'alerte choisit lui-même, pour chaque alerte, le nombre de rappels push à effectuer avant le déclenchement du SMS de secours.

## Séquence

1. Au déclenchement, SAC crée les tâches de notification push destinées aux contacts de confiance sélectionnés.
2. La notification initiale est envoyée ; elle ne compte pas comme un rappel.
3. Tant que l'alerte est active, les rappels push sont planifiés toutes les cinq minutes.
4. Le serveur compte les occurrences de rappels push et compare ce compteur au seuil choisi par le lanceur.
5. Au seuil atteint, le serveur vérifie si un responsable principal a été effectivement attribué.
6. Si personne n'a pris la responsabilité, SAC crée les tâches SMS de secours à destination des contacts de l'instantané initial.
7. Si un responsable principal est attribué avant la création des tâches SMS, l'escalade SMS est annulée.
8. Les rappels push continuent selon la règle existante jusqu'à la clôture de l'alerte par son auteur. Une prise en charge ne les arrête pas.
9. La clôture par l'auteur annule les tâches push/SMS non encore envoyées. Un message déjà accepté par un fournisseur peut néanmoins être livré.

## Ce qui constitue une prise en charge

- **Accusé de réception :** confirme que le contact déclare avoir vu/reçu l'alerte ; ne bloque pas l'escalade SMS.
- **Ouverture de la notification :** ne bloque pas l'escalade SMS.
- **Candidature volontaire :** exprime une volonté d'aider ; ne bloque pas l'escalade tant qu'aucun responsable principal n'est attribué.
- **Prise en charge effective :** attribution serveur de la responsabilité principale à un contact éligible ; bloque les SMS de secours qui ne sont pas encore créés.

## Destinataires

Les SMS de secours ne peuvent viser que les contacts figurant dans l'instantané initial de l'alerte. Aucun nouveau destinataire n'est ajouté automatiquement.

## Réglages restant à préciser

Le seuil est bien choisi par le lanceur pour chaque alerte. La plage autorisée, la valeur par défaut, l'éventuelle option « aucun SMS » et la manière de traiter une configuration absente restent à définir avant l'interface et l'API. Aucun exemple de curseur ou de plage numérique présenté en maquette ne constitue une décision approuvée.

## Garanties et limites

- Une occurrence de rappel planifiée ne garantit pas qu'une notification push a été livrée ou affichée.
- Le compteur est calculé et persisté côté serveur ; l'heure du téléphone ne commande pas l'escalade.
- Les opérations de seuil, attribution du responsable et création des tâches SMS doivent être idempotentes et testées en concurrence.
- Le système distingue tentative, acceptation fournisseur, livraison confirmée et accusé de réception humain.
- Aucun SMS ne doit être annoncé comme envoyé ou livré sans preuve correspondante du fournisseur.
- Aucun fournisseur SMS, worker, scheduler, migration D1, endpoint ou envoi réel n'est créé par cette décision.

## Références techniques

- `docs/CONTRAT_API_ET_AUTHENTIFICATION_V1.md`, section 12.
- `docs/CONTRATS_OPERATIONS_ATOMIQUES_D1.md`, section 13.
- `docs/AUDIT_NOTIFICATION_OUTBOX_ET_LIVRAISON.md` pour les prérequis de scheduler, outbox, reprise et preuve de livraison.
