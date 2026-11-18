# SAC — Parcours de déclenchement d'une alerte SOS

**Date :** 18 novembre 2026  
**Statut :** proposition UX de travail ; les décisions déjà validées sont reprises, les nouveaux choix sont explicitement signalés comme propositions.  
**Périmètre :** déclenchement d'une alerte personnelle et notification des contacts de confiance.  
**Implémentation :** aucune interface métier ni transmission réelle n'est créée par ce document.

## 1. Objectif du parcours

Permettre à une personne de prévenir rapidement les proches qu'elle a choisis, avec le minimum d'actions possible dans une situation stressante. Le parcours doit rester compréhensible sur un téléphone, avec un écran étroit et une connexion faible.

SAC est un outil privé de mise en relation avec les proches de confiance. Le parcours ne promet pas l'intervention de la police, des secours ou d'une institution.

## 2. Décisions validées intégrées

- Six catégories : danger personnel, accident, intrusion au domicile, urgence médicale, personne perdue ou désorientée, alerte personnalisée.
- Trois niveaux : préventif, urgent et critique.
- L'utilisateur définit les contacts autorisés pour chaque catégorie. Seuls les contacts actifs, ayant accepté l'invitation et vérifié leur moyen de contact, peuvent être destinataires.
- L'utilisateur voit les destinataires avant le déclenchement. La liste est figée côté serveur au moment de la création de l'alerte ; aucun contact n'est ajouté automatiquement ensuite.
- L'alerte peut être créée sans position GPS. L'absence de position ne doit jamais bloquer le SOS.
- Le partage de position nécessite une autorisation explicite. Une position ancienne doit être clairement datée.
- **Blocage GPS actuel :** aucune coordonnée GPS réelle ne doit être collectée ou persistée par le backend SAC tant que la destruction irréversible J+30 n'est pas démontrée. Le présent parcours ne doit donc pas afficher une position comme partagée ou disponible en production.
- Le push initial est le canal normal ; il ne compte pas comme rappel.
- Le lanceur choisit de 1 à 5 rappels push par alerte, espacés de cinq minutes ; 2 rappels (10 minutes) sont présélectionnés.
- Au seuil choisi, le serveur peut créer l'escalade SMS uniquement si aucun responsable principal n'a été effectivement attribué. Un accusé de réception, l'ouverture d'une notification ou une candidature volontaire seule ne bloquent pas l'escalade.
- Les rappels push continuent toutes les cinq minutes jusqu'à la clôture par l'auteur, même après prise en charge. Seul l'auteur clôture l'alerte.
- L'écran neutre après déclenchement du SOS discret est une décision validée. Les limites Android, iOS et PWA doivent être testées ; aucun arrêt forcé ne peut être empêché de manière garantie.

## 3. Parcours proposé sur téléphone

### Écran A — Deux accès SOS complémentaires

Deux entrées distinctes sont prévues et coexistent :

- **SOS principal guidé** : un bouton SOS rouge, immédiatement identifiable depuis l'accueil, ouvre un parcours compact. L'utilisateur choisit la catégorie et le niveau (préventif, urgent ou critique), vérifie les destinataires, puis déclenche l'alerte. Ce parcours est le point d'entrée général.
- **SOS critique immédiat** : un accès distinct, clairement identifié et visuellement différencié, permet de déclencher directement une alerte de niveau critique. Il utilise la catégorie et les destinataires préconfigurés par l'utilisateur pour ce raccourci. Il ne demande pas une seconde confirmation générique qui ralentirait l'action.

Le raccourci critique immédiat ne doit être activable que si sa catégorie et au moins un destinataire éligible ont été configurés et vérifiés au préalable. Si cette configuration manque, SAC explique ce qui doit être configuré et ne prétend pas avoir transmis une alerte.

Pour les deux entrées :
- Aucun écran de connexion supplémentaire ne doit apparaître si la session est déjà valide.
- Une erreur de permission GPS ne doit jamais interrompre l'ouverture du parcours.
- Le résultat affiché doit refléter exclusivement la réponse confirmée du serveur ; aucune transmission ne peut être annoncée sans preuve.

### Écran B — Type et niveau

Présenter les six catégories sous forme de grandes cartes tactiles, avec un libellé court et une explication d'une ligne au maximum.

Présenter ensuite les trois niveaux, avec leur signification sans jargon :

| Niveau | Texte utilisateur | Intention |
|---|---|---|
| Préventif | Je ne me sens pas en sécurité | Prévenir les proches avant une urgence |
| Urgent | J'ai besoin d'aide rapidement | Demander une aide rapide |
| Critique | Danger immédiat | Déclencher le SOS critique |

Le niveau critique doit être visuellement distinct, mais la couleur rouge ne doit pas être utilisée pour les autres niveaux de façon à banaliser le SOS.

Pour « Alerte personnalisée », une description peut être saisie. Elle reste facultative et ne doit pas retarder l'envoi d'une alerte urgente ou critique.

### Écran C — Destinataires et seuil de rappel

Afficher les contacts préconfigurés pour la catégorie choisie. Chaque contact est identifiable par son nom et un moyen de contact masqué ou partiellement masqué.

- La sélection initiale reprend les contacts préconfigurés pour la catégorie choisie.
- **Décision validée :** dans le parcours SOS principal guidé, le lanceur peut, avant l'envoi, retirer un contact préselectionné et ajouter un autre contact parmi ses relations de confiance actives, ayant accepté l'invitation et vérifié leur moyen de contact. Cette sélection ponctuelle peut donc déroger à ses préférences habituelles de catégorie pour cette seule alerte.
- Cette modification ne change jamais les préférences permanentes ni la configuration des autres catégories ou alertes.
- Les invitations en attente, relations révoquées ou contacts non vérifiés ne sont jamais proposés ; les limites de l'offre (2 contacts gratuits, jusqu'à 10 en Premium) restent applicables.
- Le raccourci SOS critique immédiat n'ouvre pas cet écran de modification : il utilise exactement sa liste de destinataires préconfigurée et vérifiée, afin de rester immédiat.
- Avant l'envoi, l'écran affiche la liste finale et le nombre de contacts retenus. Le lanceur doit pouvoir vérifier cette liste.
- Aucun destinataire n'est ajouté automatiquement par SAC. Après création, la liste est figée côté serveur ; toute modification ultérieure des contacts ou préférences n'altère pas cette alerte.

**Réglage des rappels SMS, validé :** afficher cinq boutons larges et accessibles :

| Choix | Libellé affiché |
|---:|---|
| 1 | 1 rappel · SMS après 5 min |
| 2 | 2 rappels · SMS après 10 min |
| 3 | 3 rappels · SMS après 15 min |
| 4 | 4 rappels · SMS après 20 min |
| 5 | 5 rappels · SMS après 25 min |

Le choix « 2 rappels · 10 min » est présélectionné. Le seuil concerne l'escalade SMS ; il ne retarde jamais la notification push initiale. Le push initial ne compte pas dans le nombre de rappels.

L'interface ne doit pas promettre un SMS disponible tant qu'un fournisseur réel n'est pas sélectionné, intégré et testé. Un SMS accepté par un fournisseur n'est pas nécessairement livré ni lu.

### Écran D — Autorisation de localisation et envoi

- La localisation est une option séparée et facultative ; elle n'est jamais une condition pour envoyer l'alerte.
- Le consentement doit préciser les destinataires et la durée de partage.
- Si la position est indisponible, afficher « Position indisponible » ; ne jamais inventer ou réutiliser une position ancienne sans son horodatage.
- Tant que le blocage GPS J+30 est en vigueur, aucun partage réel de coordonnées ne peut être présenté comme opérationnel.
- Le texte libre est facultatif.
- Le bouton final indique clairement l'action et le niveau : « Envoyer l'alerte », « Demander de l'aide » ou « Déclencher le SOS critique ».
- Après ce bouton, ne pas ajouter une seconde confirmation générique : elle ralentirait le parcours critique.

### Écran E — Résultat réel

Après réponse du serveur, afficher uniquement les faits confirmés :

- alerte créée ou échec de création ;
- nombre et identité des destinataires retenus ;
- tâches push créées, puis état de transport disponible ;
- position partagée uniquement si le consentement, le service et la preuve technique l'autorisent ;
- seuil d'escalade choisi.

Ne pas afficher « envoyé », « reçu », « livré » ou « pris en charge » sur la seule base d'une tâche planifiée. Si la connexion est interrompue ou la réponse serveur ambiguë, afficher un état non confirmé et permettre une reprise idempotente ; ne pas créer une seconde alerte par simple nouvelle tentative.

## 4. Après le déclenchement

L'écran de suivi de l'alerte doit distinguer visuellement :

1. **Alerte créée** : état métier confirmé par le serveur.
2. **Notification en traitement** : tâche créée, livraison non prouvée.
3. **Notification acceptée** : le fournisseur a accepté la demande, sans preuve de lecture.
4. **Réception déclarée** : le contact a explicitement accusé réception.
5. **Volontaire** : un contact a proposé son aide.
6. **Responsable principal** : attribution effective côté serveur.
7. **SMS de secours** : non dû, dû, en attente, accepté, livré si confirmé, échoué, ambigu ou annulé.
8. **Clôture** : seul l'auteur peut clôturer ; la fin des rappels ne signifie pas que la situation est résolue.

L'action « Annuler l'alerte » après déclenchement est une clôture explicite par l'auteur, horodatée dans l'historique. Un message déjà accepté par un fournisseur peut encore arriver après la clôture.

## 5. Règles de rapidité et d'accessibilité

- Grandes zones tactiles, textes courts, contraste élevé et boutons éloignés les uns des autres.
- Pas de curseur pour le seuil SMS : cinq choix explicites, faciles à toucher.
- Pas de saisie obligatoire d'un texte libre.
- Pas de permission GPS demandée au lancement de l'application ; uniquement au moment où l'utilisateur choisit une fonction qui en a réellement besoin.
- Pas de dépendance à une carte ou à un chargement d'image pour déclencher une alerte.
- Les erreurs sont formulées en français simple et indiquent l'action possible.
- Les étapes facultatives ne doivent jamais bloquer l'alerte essentielle.
- Prévoir une protection contre les doubles appuis et les reprises réseau par une clé d'idempotence créée côté client et contrôlée côté serveur.

## 6. États d'échec à prévoir

| Situation | Comportement UX exigé |
|---|---|
| Session expirée | Expliquer que l'alerte n'a pas été créée ; proposer la réauthentification la plus courte compatible avec la sécurité |
| Aucun contact éligible | Ne jamais afficher une alerte envoyée ; guider vers la configuration des contacts, selon la règle produit à valider |
| Internet indisponible | Ne pas prétendre qu'une alerte serveur ou un SMS a été envoyé ; afficher clairement l'absence de confirmation |
| Push non disponible | Montrer l'état réel ; ne pas transformer une tâche créée en livraison confirmée |
| Fournisseur SMS non configuré | Indiquer que l'escalade SMS n'est pas opérationnelle ; ne pas afficher de faux statut |
| Position refusée ou indisponible | Continuer sans position ; afficher « Position non partagée » ou « Position indisponible » |
| Double appui / réponse réseau perdue | Reprendre la même commande idempotente et retrouver la même alerte, sans doublon |
| Alerte clôturée pendant une tâche de rappel | Empêcher les nouvelles tâches non envoyées ; conserver le statut des envois déjà acceptés |

## 7. Décisions actées et points encore ouverts

### Décision validée — deux parcours SOS complémentaires

Le propriétaire produit a validé le 18 novembre 2026 la coexistence des deux accès :

1. **SOS principal guidé** : ouvre un écran compact où l'utilisateur choisit la catégorie et le niveau d'urgence avant l'envoi.
2. **SOS critique immédiat** : accès distinct qui déclenche directement une alerte critique avec la catégorie et les destinataires préconfigurés.

Le raccourci critique immédiat suppose une configuration préalable valide (catégorie et destinataires éligibles). Il ne doit pas ajouter une seconde confirmation générique. Dans les deux parcours, SAC ne doit jamais afficher une transmission comme réussie sans confirmation réelle du serveur.

### Points restant à arbitrer

1. **Aucun contact éligible :** faut-il bloquer la création de l'alerte, permettre une alerte locale non transmise ou proposer une autre solution ? Aucun comportement n'est choisi ; ne jamais afficher une fausse confirmation d'envoi.
3. **Seuil SMS sans fournisseur opérationnel :** le choix 1–5 reste enregistré dans la commande, mais l'interface doit expliquer que le canal SMS n'est pas disponible. Le comportement de lancement avant sélection du fournisseur reste à valider.

## 8. Limites d'implémentation actuelles

Le dépôt contient actuellement une page d'accueil et un bouton SOS désactivé « En préparation ». Les catégories et niveaux existent comme constantes de domaine, mais il n'existe pas encore de parcours SOS connecté, d'authentification métier, de création d'alerte, de destinataires persistés, de notification push, de fournisseur SMS ou de suivi réel.

Ce document ne constitue ni une activation du bouton, ni une API, ni une migration D1, ni un déploiement. Aucune coordonnée GPS réelle ne doit être collectée ou persistée dans le cadre de cette étape.

## Références

- `docs/CAHIER_DES_CHARGES_SAC.md`, sections 5 à 9.
- `docs/DECISION_NOTIFICATIONS_PUSH_ET_ESCALADE_SMS.md`.
- `docs/CONTRAT_API_ET_AUTHENTIFICATION_V1.md`.
- `docs/CONTRATS_OPERATIONS_ATOMIQUES_D1.md`, sections 3, 4, 5, 6 et 13.
- `docs/MACHINES_ETATS_ET_CONSERVATION.md`.
- `docs/PLAN_VALIDATION_DESTRUCTION_GPS_J30.md`.
- `docs/SECURITE_GPS_DESTRUCTION_CRYPTO.md`.
