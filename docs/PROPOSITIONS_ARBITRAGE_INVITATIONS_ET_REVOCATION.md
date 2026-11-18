# SAC — Recommandations d'arbitrage : invitations et révocation des proches

**Statut : PROPOSITIONS À VALIDER PAR LE PRODUIT.** Ce document propose un paquet cohérent de valeurs et de comportements afin de faciliter l'arbitrage. Il ne transforme aucune proposition en décision approuvée et n'autorise aucune implémentation.

## 1. Invitations : durée et relances

### Recommandation
- Validité d'une invitation : **7 jours calendaires** à partir de sa création serveur.
- Une seule relance automatique, **48 heures après l'envoi initial**, uniquement si l'invitation est toujours en attente et si le fournisseur n'a pas signalé un rebond définitif.
- L'invitant peut déclencher au plus **une relance manuelle** pendant la période de validité ; cette action ne prolonge pas l'échéance.
- À expiration, le lien est invalidé définitivement. Il faut créer une nouvelle invitation avec un nouveau jeton.
- Aucun renvoi automatique après expiration.

### Pourquoi
Sept jours laissent le temps au destinataire de créer son compte et de vérifier son e-mail sans maintenir indéfiniment un lien actif. Une seule relance limite le bruit et la pression sociale.

### Limites anti-abus proposées
- Au plus 3 invitations créées vers la même adresse e-mail sur une fenêtre glissante de 30 jours, tous comptes invitants confondus.
- Au plus 10 invitations créées par compte invitant sur 24 heures.
- Une invitation en attente unique par couple invitant/destination.
- Après refus, imposer un délai de refroidissement de **30 jours** avant une nouvelle invitation du même invitant vers la même adresse.
- Après révocation d'une relation active par le destinataire, aucun nouvel envoi de la part de l'ancien propriétaire pendant **90 jours**, sauf si le destinataire initie lui-même une nouvelle demande de mise en relation.
- Dépasser une limite renvoie un message générique et n'expose pas l'existence d'un compte. Les seuils doivent être ajustables côté serveur après observation des abus, sans exposer les seuils exacts à un utilisateur malveillant.

Ces valeurs sont des seuils initiaux proposés, à calibrer après tests et retour d'expérience. Elles ne doivent jamais empêcher un destinataire de bloquer les invitations d'un compte.

## 2. Fournisseur e-mail

### Recommandation
Ne pas figer un fournisseur dans le modèle métier. Créer une couche d'envoi transactionnel interchangeable avec :
- authentification forte du domaine d'envoi (SPF, DKIM, DMARC) ;
- API et webhooks signés ;
- suivi des rebonds, plaintes et suppressions ;
- région de traitement et sous-traitants documentés ;
- absence de jetons, secrets ou données sensibles dans les logs ;
- clés idempotentes et reprise contrôlée ;
- tests de délivrabilité sur les domaines grand public utilisés au Niger.

Le choix commercial du fournisseur doit intervenir après vérification de la disponibilité au Niger, de la conformité, de la localisation/retention des données et du coût. Un envoi déclaré « délivré » ne constitue jamais une preuve de lecture ou de consentement.

## 3. Révocation : droit des deux parties

### Recommandation
Adopter une révocation **symétrique** :
- le propriétaire peut retirer le proche ;
- le proche peut quitter la relation à tout moment ;
- chaque action est immédiate côté serveur, horodatée, auditée et non réversible ;
- les deux causes sont distinctes dans l'audit : `owner_revoked` et `contact_withdrew` ;
- la personne qui révoque n'a pas à fournir de justification ;
- l'autre partie reçoit une notification neutre, sans motif privé ;
- la relation reste dans l'historique et ne peut être réactivée ;
- une nouvelle relation nécessite une nouvelle invitation et une nouvelle acceptation explicite.

**Justification :** le consentement à être proche doit rester volontaire et révocable par chacune des deux personnes. L'invitant ne possède pas la personne invitée.

## 4. Révocation pendant une alerte déjà active

### Contraintes préexistantes à respecter
- L'instantané initial des destinataires reste immuable.
- Les rappels SOS toutes les cinq minutes continuent vers les destinataires initiaux jusqu'à la clôture par l'auteur, selon les règles déjà établies.
- La révocation ne clôture, n'annule ni ne met en pause l'alerte.
- Aucun proche ne peut clôturer à la place de l'auteur.
- Les événements et preuves historiques ne sont pas effacés.
- Les nouvelles positions ne doivent pas être transmises à un contact dont la relation a été révoquée.

### Recommandation de comportement
1. **Rappels :** continuer les rappels initiaux jusqu'à la clôture, mais sous forme minimale et opaque après révocation (notification de rappel sans détail sensible). Cela préserve la règle des rappels sans maintenir l'accès au dossier.
2. **Lecture du dossier :** couper immédiatement l'accès au détail dès le commit de révocation, y compris pour l'alerte déjà active. Toute ouverture du lien ou notification refait un contrôle serveur ; aucune donnée en cache ne doit être présentée comme fraîche.
3. **Positions GPS :** arrêter immédiatement toute nouvelle émission vers ce contact. Les paquets déjà reçus ne peuvent pas être effacés à distance. Une émission en cours doit être arbitrée atomiquement avec la révocation au dernier point d'envoi.
4. **Accusé de réception :** autoriser un simple accusé technique de réception du rappel, sans accès au dossier, sans droit de coordination et sans arrêt des rappels.
5. **Volontariat et coordination :** interdire toute nouvelle candidature, intervention ou action de coordination après révocation.
6. **Responsable principal déjà désigné :** terminer atomiquement sa responsabilité à l'instant de la révocation. Promouvoir le volontaire admissible suivant selon l'ordre d'arrivée, uniquement si sa relation est encore active au moment du commit. À défaut, l'alerte reste active sans responsable principal. Cette transition ne clôt jamais l'alerte.
7. **Après clôture :** aucun accès au détail ni à l'historique pour le contact révoqué. L'auteur conserve son historique selon la politique de conservation.
8. **Réinvitation :** une nouvelle relation n'ouvre jamais l'accès aux alertes anciennes.

### Pourquoi cette option
Elle respecte la continuité des rappels déjà décidés, mais traite la révocation comme une fin immédiate de l'autorisation de consulter et d'agir. Le rappel opaque ne doit contenir ni position, ni identité de tiers, ni description de l'urgence, ni détail d'intervention.

## 5. Cas distinct : réinvitation après retrait volontaire

Si le proche quitte lui-même la relation, le propriétaire ne peut pas contourner ce choix en envoyant une série d'invitations. La recommandation est un blocage de 90 jours pour cet ancien propriétaire, avec possibilité pour le proche de réinitier lui-même une relation. Le proche peut aussi bloquer définitivement les invitations de cet ancien propriétaire. Ce blocage doit être révocable par le destinataire.

## 6. Décisions à confirmer explicitement

1. Confirmer ou modifier : expiration à 7 jours, une relance automatique à 48 h, une relance manuelle maximum.
2. Confirmer ou modifier les seuils anti-abus initiaux (3/30 jours par adresse, 10/24 h par compte, refroidissement de 30 jours après refus et 90 jours après retrait).
3. Confirmer le choix d'une couche e-mail interchangeable sans choisir le fournisseur avant la revue régionale et juridique.
4. Confirmer la révocation symétrique.
5. Confirmer les rappels opaques maintenus jusqu'à clôture, mais sans accès au dossier.
6. Confirmer l'arrêt immédiat de nouvelles positions, de la lecture du détail, des actions de coordination et de l'accès post-clôture.
7. Confirmer la fin de responsabilité du principal révoqué et la promotion du volontaire actif admissible suivant.

## 7. Garde-fous de mise en œuvre

Même après validation produit, ces règles ne sont pas prêtes à être codées avant :
- définition des permissions et textes de consentement ;
- revue de sécurité des jetons, des webhooks, de l'anti-abus et des courses concurrentes ;
- mise à jour des contrats TypeScript et tests purs ;
- définition des transactions D1 et des autorisations serveur ;
- tests de bout en bout des rappels et des émissions GPS avec révocation concurrente ;
- revue cryptographique et validation des règles de conservation.

**Aucune modification de code, de D1, de fournisseur e-mail, de GPS, de notification ou de ressource Cloudflare n'est autorisée par ce document.**