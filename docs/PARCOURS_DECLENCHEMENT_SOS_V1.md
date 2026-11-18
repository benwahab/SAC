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

### Proposition UX détaillée — écran de suivi après déclenchement (à valider)

Le suivi doit répondre à quatre questions en un regard : **l'alerte existe-t-elle ? quels proches ont réagi ? quelqu'un est-il responsable ? l'alerte est-elle toujours ouverte ?** Il ne doit jamais transformer un état technique en preuve d'aide humaine.

#### Vue de l'auteur de l'alerte

1. **En-tête persistant :** afficher la catégorie, le niveau, l'heure de création confirmée par SAC et l'état métier « Alerte active » ou « Alerte clôturée ». Une alerte active reste active même si un proche l'a accusée réception ou a pris la responsabilité.
2. **Résumé des proches :** une ligne par destinataire de l'instantané initial, avec son nom et des états distincts : « Notification en cours », « Notification acceptée par le service », « Réception confirmée », « Se propose pour aider », « Responsable principal », ou « Aucun retour enregistré ». Afficher l'heure des actions humaines confirmées. Ne pas afficher une absence de réponse comme un refus.
3. **Responsable principal :** lorsqu'il existe, afficher clairement son nom et l'heure de prise en charge. En cas de retrait, montrer que la responsabilité est de nouveau à attribuer, puis afficher le nouveau responsable dès que l'attribution serveur est confirmée. Conserver l'historique des relais sans présenter deux responsables simultanés.
4. **Rappels :** afficher le nombre de rappels push déjà traités et le prochain rappel uniquement si son échéance est connue du serveur. Préciser que les rappels continuent toutes les cinq minutes jusqu'à la clôture par l'auteur, même après prise en charge.
5. **Escalade SMS :** présenter séparément le seuil choisi et l'état réel : « seuil non atteint », « escalade due », « en attente », « acceptée par le fournisseur », « livraison confirmée par le fournisseur », « échec », « résultat ambigu », « annulée » ou « indisponible — fournisseur non configuré » si cette proposition est validée. Un SMS accepté n'est pas une preuve de lecture.
6. **Action de l'auteur :** proposer « Clôturer l'alerte » avec une confirmation qui explique que les rappels non envoyés seront arrêtés et que les messages déjà acceptés par un fournisseur peuvent encore arriver. La clôture enregistre l'heure et, si l'auteur le souhaite, un motif facultatif. Ce motif facultatif est une proposition UX, pas une décision métier.
7. **Après clôture :** remplacer l'état actif par « Alerte clôturée par son auteur », conserver une chronologie consultable et ne plus proposer d'action de prise en charge. Les statuts de transport déjà obtenus restent visibles et ne sont pas réécrits.

#### Vue d'un contact destinataire

1. Afficher l'identité de l'auteur selon les règles de confidentialité, la catégorie, le niveau, l'heure de déclenchement et les informations réellement partagées avec ce contact.
2. Proposer deux actions humaines distinctes : « J'ai vu l'alerte » (accusé de réception) et « Je peux prendre en charge » (candidature). Elles ne doivent pas être fusionnées en un seul bouton.
3. Après candidature, afficher « Candidature envoyée — en attente d'attribution » jusqu'à la confirmation serveur. Seule l'attribution effective permet d'afficher « Vous êtes le responsable principal ».
4. Si un autre proche devient responsable principal, l'indiquer clairement sans retirer au contact son statut de destinataire initial. Il peut consulter le suivi autorisé, mais ne peut ni clôturer l'alerte ni modifier ses destinataires.
5. Le responsable principal peut choisir « Me retirer » ; l'écran explique que la responsabilité redeviendra disponible pour un autre volontaire. Le retrait ne clôture pas l'alerte et ne stoppe pas les rappels. Le résultat doit attendre la confirmation serveur.
6. Après clôture par l'auteur, afficher « Alerte clôturée par son auteur ». Les actions de réception, candidature et retrait deviennent indisponibles.

#### Chronologie commune

La chronologie est ordonnée par horodatage serveur et distingue les événements métier des événements de transport :

- alerte créée par SAC ;
- notification planifiée / tentative de transmission ;
- notification acceptée par le fournisseur, si confirmé ;
- réception déclarée par un proche ;
- candidature volontaire ;
- attribution ou retrait du responsable principal ;
- rappel push suivant ;
- seuil d'escalade SMS atteint et résultat réel de l'escalade ;
- clôture par l'auteur.

Une action reçue deux fois par répétition réseau n'apparaît qu'une fois dans la chronologie métier. Les événements de transport ne sont pas présentés comme des actions humaines. Une absence d'événement ne permet pas de déduire qu'une personne a ignoré ou refusé l'alerte.

#### États à ne jamais confondre

| Ce que l'utilisateur voit | Ce que SAC peut réellement affirmer |
|---|---|
| Alerte créée | SAC a confirmé la création métier de l'alerte |
| Notification en traitement | Une tâche ou tentative existe ; aucune livraison n'est prouvée |
| Notification acceptée | Le fournisseur a accepté la demande ; lecture non prouvée |
| Réception confirmée | Le contact a explicitement effectué l'action d'accusé de réception |
| Candidature envoyée | Le contact a proposé son aide ; il n'est pas encore responsable |
| Responsable principal | L'attribution atomique a été confirmée par le serveur |
| SMS accepté | Le fournisseur a accepté le SMS ; réception sur le téléphone non garantie |
| SMS livré | Seulement si un accusé de livraison fiable du fournisseur est disponible |
| Alerte clôturée | L'auteur a clôturé l'alerte ; cela ne prouve pas à lui seul que le danger est résolu |

**Limites :** aucun indicateur « secours en route », « danger résolu » ou « personne en sécurité » ne doit être déduit automatiquement d'un accusé, d'une candidature, d'une prise en charge ou de la clôture. SAC ne suit pas l'intervention des services publics. L'interface doit rester lisible sur petit écran et en connexion faible ; le dernier état confirmé est horodaté et signalé comme potentiellement ancien si la synchronisation est interrompue.

**Statut : proposition UX de travail à valider.** Elle ne crée aucune interface, API, table D1, notification réelle, intégration SMS ou logique métier.

### Proposition UX détaillée — suivi après déclenchement (à valider)

Le suivi est une chronologie horodatée, lisible sur téléphone. Il ne doit pas réduire l'ensemble de l'alerte à un seul badge « envoyé » ou « reçu » : les états sont propres à chaque destinataire et à chaque canal.

#### Vue de l'auteur de l'alerte

En haut de l'écran, afficher :
- catégorie, niveau d'urgence et heure de création confirmée par le serveur ;
- état général de l'alerte : **active**, **clôturée par vous** ou **échec de création** ;
- responsable principal, s'il existe, et heure de son attribution ;
- action « Clôturer l'alerte », disponible uniquement tant que l'alerte est active.

Puis afficher une ligne par contact de l'instantané initial, sans mélanger les événements :
- **En attente** : aucune action humaine confirmée ;
- **Notification en cours** : tâche de notification créée ou en traitement, sans preuve de livraison ;
- **Notification acceptée par le service** : le fournisseur a accepté la demande, cela ne prouve ni livraison sur le téléphone ni lecture ;
- **A accusé réception** : le contact a explicitement confirmé avoir vu l'alerte ;
- **Propose son aide** : candidature volontaire enregistrée, sans responsabilité principale tant que l'attribution n'est pas confirmée ;
- **Responsable principal** : attribution unique confirmée par le serveur ;
- **Échec / résultat inconnu** : distinguer un échec confirmé d'une réponse technique ambiguë.

Pour chaque canal, montrer l'heure du dernier événement vérifiable. Une notification push et un SMS ont des lignes d'état distinctes. Le statut d'un contact ne doit pas être déduit de celui d'un autre contact.

#### Vue d'un contact destinataire

Le contact voit la catégorie, le niveau, l'heure de déclenchement et les informations que l'auteur a effectivement partagées et autorisées. Il dispose d'actions distinctes :
- « J'ai vu l'alerte » pour l'accusé de réception ;
- « Je peux aider » pour proposer sa disponibilité ;
- « Prendre la responsabilité » pour demander à devenir responsable principal, sous réserve de confirmation atomique du serveur ;
- « Je ne peux pas aider » pour signaler son indisponibilité sans clôturer l'alerte.

Après attribution, tous les destinataires autorisés voient clairement qui est responsable principal. Une candidature ou un accusé de réception ne doit jamais être présenté comme une prise en charge. Les contacts ne disposent d'aucune action de clôture.

**Confidentialité proposée :** chaque destinataire voit son propre état de notification et les informations nécessaires à la coordination. L'écran peut afficher le prénom/nom choisi des autres destinataires et le statut de coordination, mais jamais leurs numéros, adresses e-mail ou coordonnées privées. Cette visibilité de groupe reste à valider ; par défaut, ne pas révéler de données de contact entre proches.

#### Prise en charge et coordination

- Une seule personne peut être responsable principale à un instant donné.
- Deux demandes simultanées sont arbitrées côté serveur ; une seule attribution réussit. L'autre personne reçoit un message clair indiquant qu'un responsable est déjà désigné.
- Le responsable principal peut indiquer qu'il se retire. Le rôle n'est transféré qu'après acceptation effective d'un autre volontaire par le serveur ; sinon l'alerte reste active sans responsable principal.
- L'accusé de réception, la candidature, le refus d'aider ou la notification reçue ne stoppent pas les rappels push et ne bloquent pas à eux seuls l'escalade SMS.
- Seule l'attribution effective du responsable principal bloque l'escalade SMS non encore engagée. Les règles déjà validées sur les SMS acceptés par le fournisseur restent applicables.

#### Perte de connexion, silence et transfert du responsable principal

**Principe de sécurité : une absence de signal réseau n'est pas une preuve d'abandon.** Une PWA peut être suspendue, le téléphone éteint, le réseau coupé ou les notifications retardées. SAC ne doit donc jamais retirer automatiquement la responsabilité sur la seule base d'un délai sans activité, d'une absence de réponse ou d'un statut « hors ligne ».

Comportements proposés :

1. **Perte de connexion du responsable :** conserver l'attribution actuelle. Afficher « Dernière activité connue » avec l'heure du dernier événement confirmé par le serveur, et préciser que la disponibilité actuelle n'est pas connue. Ne jamais afficher « hors ligne » comme un fait certain si le serveur ne peut pas le vérifier.
2. **Silence ou absence d'action :** ne pas transférer automatiquement la responsabilité. Les autres contacts continuent à voir l'alerte et peuvent proposer leur aide ; le responsable principal reste celui enregistré jusqu'à son retrait, la clôture par l'auteur ou une règle de remplacement explicitement validée.
3. **Retrait volontaire du responsable :** le responsable demande à se retirer. Dans la même opération atomique, le serveur termine sa période de responsabilité et attribue le rôle au volontaire admissible le plus ancien selon l'ordre serveur déterministe. Si aucun volontaire admissible n'existe, l'alerte reste active et repasse à « Aucun responsable principal » ; les rappels continuent vers l'instantané initial.
4. **Volontaire qui se propose pendant le retrait :** les demandes concurrentes sont sérialisées. Une seule personne reçoit le rôle. La candidature la plus ancienne déjà acceptée côté serveur est prioritaire ; les horodatages fournis par les téléphones ne départagent jamais les demandes.
5. **Reconnexion du responsable précédent :** il retrouve l'historique et voit le responsable actuellement attribué. Il ne récupère pas automatiquement le rôle. Il peut proposer à nouveau son aide uniquement si les règles de candidature l'autorisent et si aucun responsable n'est déjà attribué.
6. **Transfert sans volontaire disponible :** ne pas inventer un responsable de remplacement. L'alerte reste active sans responsable principal ; l'auteur peut contacter directement ses proches par un autre moyen ou clôturer l'alerte lorsqu'il le juge approprié.
7. **Rappels et escalade :** la perte de connexion ou le silence du responsable ne modifient pas le seuil SMS à eux seuls. Seule une attribution effective bloque l'escalade non encore engagée ; un retrait qui laisse l'alerte sans responsable permet à nouveau l'escalade selon le seuil et l'état serveur courant. Les rappels push continuent jusqu'à clôture par l'auteur.

L'interface doit distinguer « responsable principal attribué », « dernière activité connue à… », « retrait demandé », « transfert en cours » et « aucun responsable principal ». Ne pas afficher de compteur de présence ou de disponibilité en temps réel dans la V1.

**Statut : proposition UX et métier à valider.** Elle précise la continuité sans modifier les décisions déjà actées : seul l'auteur clôture, la prise en charge ne stoppe pas les rappels, et un volontaire ne devient responsable qu'après attribution serveur effective.

#### Clôture et notion de résolution

La clôture est une action de l'auteur, distincte de la prise en charge par un proche. Au moment de clôturer, proposer des motifs simples : **Situation résolue**, **Aide devenue inutile**, **Fausse alerte** ou **Autre raison** (commentaire facultatif). Le choix du motif est une déclaration de l'auteur, pas une preuve indépendante qu'une intervention a eu lieu.

Après clôture :
- l'alerte passe à l'état clôturé avec auteur, motif et horodatage serveur ;
- les nouveaux rappels et tâches non envoyées sont annulés selon les règles du serveur ;
- les notifications déjà acceptées par un fournisseur peuvent encore arriver ;
- les destinataires voient que l'auteur a clôturé l'alerte et le motif partagé ;
- aucune personne ne peut rouvrir cette alerte clôturée. Si un nouveau danger survient, l'auteur crée une nouvelle alerte.

Ne jamais afficher « secours intervenus », « personne secourue » ou « danger éliminé » sur la seule base d'une prise en charge ou du motif de clôture. SAC ne vérifie pas matériellement l'intervention.

#### États vides et incidents

- Aucun accusé de réception : afficher « Aucun proche n'a encore confirmé avoir vu l'alerte », sans conclure que personne ne l'a reçue.
- Notifications en attente : afficher « Transmission en cours de vérification », jamais « envoyé ».
- Responsable absent : afficher « Aucun responsable principal pour le moment ».
- Perte de connexion : afficher la dernière synchronisation connue avec son heure et signaler que les informations peuvent être anciennes ; les actions non confirmées restent en attente de confirmation serveur.
- Alerte clôturée : afficher l'historique en lecture seule et la personne qui l'a clôturée.

**Statut : proposition UX à valider.** Cette spécification ne crée aucun écran, endpoint, statut SQL, notification ou mécanisme réel. Les noms définitifs des états métier devront rester cohérents avec les machines à états et les contrats API avant toute implémentation.

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

### Proposition UX — aucun contact éligible (à valider)

Lorsqu'aucun contact éligible n'est disponible, SAC ne doit ni fabriquer un destinataire, ni créer une alerte présentée comme transmise, ni laisser croire qu'un proche a été prévenu.

Comportement proposé :

1. Dans le parcours guidé, après vérification de la liste finale, si elle est vide, le bouton d'envoi est remplacé par un état explicite : **« Aucun contact ne peut recevoir cette alerte »**.
2. SAC explique brièvement pourquoi : aucun contact actif, accepté et vérifié n'est disponible. Il propose de revenir à la gestion des contacts ou de quitter le parcours.
3. Pour un SOS critique, le raccourci immédiat reste indisponible tant qu'une catégorie et au moins un destinataire éligible ne sont pas configurés. L'écran de configuration doit être accessible sans prétendre qu'une alerte a été déclenchée.
4. Aucun enregistrement serveur d'alerte, aucune tâche push et aucune escalade SMS ne sont créés tant que la liste finale est vide. Un brouillon local éventuel ne doit jamais apparaître dans l'historique comme une alerte envoyée ou active.
5. En situation de danger immédiat, l'écran rappelle de contacter directement les services d'urgence locaux ou une personne à proximité. SAC ne doit afficher un numéro d'urgence cliquable que si ce numéro a été vérifié et validé pour le pays concerné ; aucun numéro ne doit être deviné.
6. Si le problème est une absence de connexion plutôt qu'une absence de contact éligible, appliquer séparément le comportement « Internet indisponible » : ne pas confondre les deux situations et ne jamais promettre une transmission hors ligne non implémentée.

**Statut : proposition de conception uniquement.** Cette règle ne devient une décision produit qu'après validation explicite. Elle n'autorise aucune implémentation, API, migration, intégration téléphonique ou notification réelle.

### Proposition technique et UX — seuil SMS sans fournisseur opérationnel (à valider)

Le choix de 1 à 5 rappels reste un paramètre de l'alerte, mais il ne constitue jamais une preuve qu'un SMS pourra être envoyé. Tant qu'aucun fournisseur réel n'est configuré, vérifié et opérationnel :

1. Avant le déclenchement, l'interface conserve le réglage choisi mais indique clairement : **« SMS de secours indisponible pour le moment ; les notifications push restent le seul canal prévu »**. Ne pas laisser entendre qu'un SMS sera envoyé.
2. Le push initial et les rappels push continuent selon les règles déjà validées, sous réserve de disponibilité réelle du service push.
3. À l'échéance du seuil choisi, si aucun responsable principal n'est attribué et qu'aucun fournisseur SMS opérationnel n'existe, le serveur enregistre un résultat métier explicite « escalade SMS impossible — fournisseur non configuré ». Il ne crée pas une tâche d'envoi fictive et ne simule aucune livraison.
4. **Proposition :** ne pas envoyer rétroactivement le SMS si un fournisseur est ajouté ou rétabli après le seuil de cette alerte. Cette alerte conserve son résultat « impossible au moment du seuil » ; les nouvelles alertes pourront bénéficier du fournisseur après vérification. Cela évite l'arrivée tardive et inattendue d'un SMS de détresse.
5. Si un fournisseur était configuré au déclenchement mais devient indisponible au moment de l'escalade, enregistrer « échec/indisponibilité fournisseur » selon le résultat vérifiable. Toute nouvelle tentative éventuelle doit être bornée, idempotente et soumise à une politique de délai validée ; ne jamais multiplier les SMS en cas de réponse ambiguë.
6. Si le fournisseur accepte le SMS puis que la réponse réseau est perdue, l'état doit rester « résultat ambigu » jusqu'à réconciliation. Ne pas réenvoyer aveuglément : un SMS accepté peut arriver même si SAC n'a pas reçu l'accusé technique.
7. Le tableau de suivi doit distinguer « SMS non configuré », « non dû », « dû », « en attente », « accepté », « livré si confirmé », « échec », « ambigu » et « annulé ». Une tâche planifiée n'est pas une livraison.

**Statut : proposition à valider.** Elle ne choisit aucun fournisseur, ne crée aucune intégration, aucun secret, aucun compte externe, aucune API, aucun scheduler et aucun envoi SMS réel.

## 7. Décisions actées et points encore ouverts

### Décision validée — deux parcours SOS complémentaires

Le propriétaire produit a validé le 18 novembre 2026 la coexistence des deux accès :

1. **SOS principal guidé** : ouvre un écran compact où l'utilisateur choisit la catégorie et le niveau d'urgence avant l'envoi.
2. **SOS critique immédiat** : accès distinct qui déclenche directement une alerte critique avec la catégorie et les destinataires préconfigurés.

Le raccourci critique immédiat suppose une configuration préalable valide (catégorie et destinataires éligibles). Il ne doit pas ajouter une seconde confirmation générique. Dans les deux parcours, SAC ne doit jamais afficher une transmission comme réussie sans confirmation réelle du serveur.

### Points restant à arbitrer

1. **Aucun contact éligible :** point toujours ouvert. La proposition de travail est de ne créer aucune alerte serveur ni tâche de notification avec une liste vide, de guider vers la configuration des contacts et de rappeler le recours direct aux services d'urgence locaux ou à une personne à proximité. Le propriétaire produit doit encore valider ce comportement.
2. **Seuil SMS sans fournisseur opérationnel :** point toujours ouvert. La proposition de travail est de maintenir les push, d'enregistrer l'impossibilité d'escalade au seuil et de ne pas envoyer de SMS rétroactif si un fournisseur devient disponible plus tard. Le propriétaire produit doit encore valider cette règle.

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
