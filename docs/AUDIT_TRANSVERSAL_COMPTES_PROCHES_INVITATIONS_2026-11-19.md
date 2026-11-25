# Audit transversal des comptes, proches et invitations — 2026-11-19

## Périmètre

Lecture du code de `main` :
- `functions/api/auth/register.ts`
- `functions/api/auth/session.ts`
- `functions/api/auth/logout.ts`
- `functions/api/auth/verify-email.ts`
- `functions/api/auth/resend-email.ts`
- `functions/api/contacts/index.ts`
- `functions/api/contacts/invitations/index.ts`
- `functions/api/contacts/invitations/accept.ts`
- `functions/api/contacts/invitations/decline.ts`
- `functions/api/contacts/revoke.ts`
- `functions/lib/trusted-contacts/service.ts`
- `functions/lib/trusted-contacts/invitation-delivery.ts`
- `src/domain/account-lifecycle.ts`
- `src/domain/contact-invitations.ts`
- `migrations/0001_account_email_otp.sql`
- `migrations/0002_contact_invitations.sql`
- tests de domaine et d'intégration des invitations.

Audit en lecture seule. Aucun compte n'a été créé ou modifié, aucune invitation ni aucun e-mail n'a été envoyé, aucune migration distante et aucun changement applicatif n'ont été effectués.

## Synthèse

Le socle de sécurité des comptes et invitations est cohérent sur plusieurs points : vérification e-mail obligatoire, session liée à un appareil, invitation à usage unique, identité du destinataire vérifiée, relation directionnelle, révocation non réversible et snapshot des proches pour une alerte déjà déclenchée.

Des écarts restent à traiter avant de considérer le cycle complet comme prêt :
1. Le parcours d'acceptation fixe actuellement la limite à **2 proches** (`maxActiveContacts: 2`), alors que le besoin produit général prévoit jusqu'à **10**. Le contrat applicable (offre/quotas) doit être harmonisé partout.
2. Le cycle de suppression et de suspension est défini dans un module de domaine pur, mais aucun endpoint serveur de demande, annulation, suspension, rétablissement ou finalisation n'a été identifié dans l'arborescence auditée.
3. La création d'invitation envoie un e-mail immédiatement après l'insertion D1. Si l'envoi réussit côté fournisseur mais que la réponse réseau est perdue, le serveur peut traiter la livraison comme échouée et révoquer l'invitation alors que le message a peut-être été délivré.
4. Il n'existe pas de boîte de réception listant les invitations en attente dans l'API auditée : la route GET exige l'identifiant et le token d'une invitation précise.
5. Le traitement des comptes suspendus/supprimés et des liens de proches doit être spécifié pour les alertes déjà actives et les invitations déjà émises.

## 1. Inscription et activation d'un compte

- L'inscription crée le compte en état `pending_verification`.
- Les identités e-mail et téléphone sont enregistrées, mais seule l'identité e-mail peut être vérifiée dans le parcours présent.
- Le mot de passe est haché avant stockage.
- Le code OTP est conservé sous forme d'empreinte HMAC, avec expiration de dix minutes et six tentatives maximum.
- Le message de réponse à l'inscription est générique afin de ne pas révéler si une adresse ou un numéro existe déjà.
- Le défi n'est vérifiable qu'après acceptation de la livraison par le fournisseur.
- La migration impose l'activation du compte uniquement après consommation d'un défi e-mail valide.

**À noter :** l'activation de compte et la vérification d'identité ne sont pas équivalentes à la création d'une relation de confiance. Un compte actif ne devient proche d'un autre compte qu'après acceptation explicite d'une invitation.

## 2. Invitations de proches

### Création

- L'invitation est créée par un compte actif disposant d'une identité e-mail principale vérifiée.
- L'adresse destinataire est normalisée.
- L'auto-invitation et une relation déjà active vers cette adresse sont refusées.
- Le token aléatoire n'est pas stocké en clair : seule son empreinte est persistée.
- Une seule invitation pending par propriétaire et adresse destinataire est autorisée.
- Le délai d'expiration dépend d'une configuration fournie au service ; la migration ne fixe pas elle-même de durée par défaut.
- Le token brut est transmis au composant d'e-mail, jamais renvoyé au navigateur par la route de création.

### Lecture et acceptation

- La personne doit avoir un compte actif et une adresse e-mail principale vérifiée correspondant exactement à l'adresse destinataire.
- Le token, l'identifiant d'invitation, l'état pending et l'expiration sont vérifiés.
- L'acceptation est une transition conditionnelle atomique dans D1, suivie de la création de la relation directionnelle correspondante dans un batch.
- Une invitation acceptée ne peut pas être rejouée.
- L'acceptation crée uniquement la relation propriétaire → proche ; elle ne crée pas automatiquement la relation inverse.
- Le refus ne crée aucune relation.
- L'acceptation et le refus exigent tous deux une session authentifiée et la preuve du token.

### Révocation d'une invitation en attente

Si le fournisseur rejette la livraison, le service tente de révoquer l'invitation pending. Le token brut n'est pas persisté. En cas d'échec de cette révocation, le résultat est signalé comme erreur et la ligne peut nécessiter une surveillance/réconciliation.

**Risque de livraison ambiguë :** un timeout ou une perte de réponse après acceptation par le fournisseur peut être interprété comme un échec. Le système peut alors révoquer une invitation dont le message a potentiellement été délivré. Pour une robustesse complète, il faudra une outbox d'e-mails avec identifiant d'idempotence, états de livraison et réconciliation plutôt qu'une transaction applicative supposant que l'appel réseau est certain.

## 3. Limite de proches

- Le service d'acceptation accepte techniquement une limite de 2 ou 10.
- La route `accept.ts` passe actuellement la valeur `2` en dur.
- Les tests d'intégration décrivent le quota de deux contacts comme celui de l'offre gratuite.
- La route de création d'invitation ne vérifie pas de quota avant l'envoi ; le quota est contrôlé au moment de l'acceptation.

**Décision nécessaire :** définir la matrice de quotas par offre et l'appliquer de manière cohérente à l'interface, à la création, à l'acceptation et aux contrôles SQL. Ne pas simplement remplacer 2 par 10 sans intégrer les règles d'offre. Le besoin général de dix contacts maximum doit être distingué du quota éventuellement inférieur d'une offre.

## 4. Relation directionnelle, révocation et réinvitation

- La table `trusted_contacts` utilise la paire propriétaire/proche comme clé primaire.
- La relation n'existe qu'après une invitation acceptée qui correspond exactement au propriétaire, au destinataire, à la version de permission et à la date de décision.
- Seul le propriétaire de la relation peut la révoquer par la route auditée.
- Une relation révoquée est terminale : elle ne peut pas être réactivée par UPDATE.
- Une nouvelle relation nécessite une nouvelle invitation acceptée.
- Le proche ne peut pas révoquer à la place du propriétaire via cette route.
- La liste de proches est limitée aux relations actives du compte authentifié.

La directionnalité est importante : être le proche d'une personne ne signifie pas automatiquement que cette personne est votre proche.

## 5. Effet d'une révocation sur les alertes SOS existantes

La migration SOS impose un snapshot immuable des destinataires au déclenchement. La révocation ultérieure d'une relation ne supprime ni ne réécrit les destinataires d'une alerte déjà déclenchée.

Conséquences :
- une personne révoquée ne doit plus être sélectionnable pour un nouveau SOS ;
- une révocation ne doit pas réécrire l'historique d'une alerte déjà partie ;
- les règles de réponse à une alerte en cours doivent être explicites : le snapshot reste historique, mais le compte révoqué peut-il encore accuser réception, se porter volontaire ou consulter les détails jusqu'à clôture ?

Le code SOS vérifie actuellement l'appartenance au snapshot pour les lectures et réponses ; il ne revalide pas le lien de confiance courant. Cela correspond à la conservation du snapshot, mais la règle produit sur les droits après révocation doit être confirmée et documentée. Une révocation du lien ne devrait pas, à elle seule, effacer les événements déjà consignés.

## 6. Suspension et suppression de compte

Le module `src/domain/account-lifecycle.ts` définit des transitions métier :
- demande de suppression par le propriétaire ;
- annulation de la demande par le propriétaire ;
- finalisation par le système uniquement ;
- suspension et rétablissement par un acteur ayant le rôle `super_admin` dans le contrat pur ;
- blocage de la finalisation tant qu'il reste des alertes ou trajets actifs.

Cependant, ce module est un évaluateur de domaine : il ne charge pas lui-même l'identité de l'acteur, ne vérifie pas son rôle depuis une source serveur, n'écrit pas dans D1 et ne révoque pas les sessions.

Aucun endpoint serveur de cycle de suppression, suspension ou rétablissement n'a été trouvé dans le périmètre de routes actuel. Aucun mécanisme complet de purge/anonymisation des identités, invitations, relations, sessions et données associées n'est donc prouvé par cet audit.

Le garde d'authentification des sessions exige un compte actif ; un compte suspendu ou supprimé ne satisfait donc pas le contrôle d'accès lors de la validation de session. Cela constitue une protection à l'authentification, mais ne remplace pas une procédure administrative atomique et traçable qui révoque les sessions/appareils et traite les tâches déjà planifiées.

**Point de gouvernance :** le rôle `super_admin` présent dans un objet de commande de domaine n'est pas une preuve d'autorisation. Une future route doit charger l'identité et les permissions depuis une session authentifiée et une source serveur fiable ; aucun rôle envoyé par le navigateur ne doit suffire.

## 7. Invitations entrantes et expérience utilisateur

L'API GET des invitations exige un `id` et un `token` précis et retourne les informations d'une invitation correspondante. Aucune route de liste des invitations pending par compte destinataire n'a été trouvée dans ce périmètre.

L'audit antérieur de la boîte de réception avait déjà constaté l'absence d'une boîte de réception complète. La sécurité de l'acceptation actuelle (token + identité e-mail vérifiée) doit être conservée ; l'ajout d'une boîte de réception ne doit pas transformer la seule connaissance d'un identifiant d'invitation en preuve d'autorisation.

## 8. Matrice des constats

| Domaine | Constat | Priorité |
|---|---|---|
| Activation du compte | OTP e-mail et activation protégés par D1 | Socle en place |
| Session | Session liée au compte et à l'appareil ; compte doit être actif | Socle en place |
| Invitation | Token non stocké en clair, destinataire vérifié | Socle en place |
| Acceptation | Usage unique et relation directionnelle | Socle en place |
| Révocation | Propriétaire seulement, état terminal | Socle en place |
| Quota proches | Route d'acceptation fixée à 2, besoin général jusqu'à 10 | P0 décision |
| Boîte de réception | Pas de liste API des invitations pending | P1 |
| Livraison e-mail | Risque de résultat ambigu et révocation après livraison incertaine | P1 |
| Suppression compte | Contrat pur, pas de workflow serveur complet identifié | P0 |
| Suspension/rétablissement | Contrat pur, pas de workflow serveur complet identifié | P0 |
| Alertes actives après révocation | Snapshot conservé, droits après révocation à formaliser | P0 décision |
| Effacement des données | Purge/anonymisation globale non prouvée ici | P0 |

## 9. Plan recommandé

### P0 — décisions et sécurité avant mise en service
1. Fixer la matrice officielle des quotas de proches et harmoniser les routes/services/tests.
2. Définir précisément l'effet d'une révocation sur les actions d'un proche dans une alerte déjà active.
3. Concevoir les workflows serveur de suspension et de suppression, avec révocation des sessions et traitement atomique des activités et tâches en attente.
4. Définir la purge/anonymisation des données du compte et vérifier ses dépendances avec la conservation légale, la traçabilité SOS et la règle GPS de suppression irréversible à 30 jours.

### P1 — complétude opérationnelle
1. Ajouter une boîte de réception des invitations pending qui conserve la vérification du token et de l'identité destinataire.
2. Remplacer l'envoi e-mail synchrone fragile par une outbox avec état et réconciliation.
3. Ajouter une politique explicite de relance, expiration et annulation d'invitation.
4. Rendre les réponses API minimales : l'acceptation renvoie actuellement les identifiants internes propriétaire et proche ; vérifier si le client en a réellement besoin ou retourner un simple statut.

## Conclusion

Les mécanismes d'invitation et de relation de confiance ont de bonnes protections de base. Le modèle directionnel, la preuve d'identité du destinataire, le token à usage unique et la révocation terminale sont des fondations solides. Le système n'est toutefois pas complet sur la gouvernance du compte, les quotas et la gestion des invitations entrantes. Les prochaines modifications devront commencer par les décisions P0 et un audit de l'ensemble des sessions/appareils, sans déployer ni appliquer de migration distante.

## 10. Re-vérification des routes de production — 2026-11-25

Cette section complète l'audit initial après lecture du code actuel sur `main`. Elle ne transforme pas les propositions produit en décisions.

### Contrôles confirmés

- Les routes de liste des proches, création d'invitation, lecture d'une invitation, acceptation, refus, boîte de réception et révocation utilisent `requireAuthenticatedDeviceSession`.
- Les routes POST de création, acceptation, refus et révocation appliquent également `guardSameOriginJsonPost`.
- Les identifiants propriétaire/destinataire transmis au service proviennent de la session authentifiée ; la route de révocation ne fait pas confiance à un propriétaire fourni par le navigateur.
- L'acceptation revalide dans D1 le compte actif, l'e-mail principal vérifié correspondant à la destination, le token, l'état pending, l'expiration et la version de permission. La transition et la création de relation sont groupées dans un batch D1.
- L'acceptation concurrente ou le rejeu ne doit pas créer une seconde relation : la mise à jour conditionnelle exige `status = 'pending'`.
- La boîte de réception existe désormais : `GET /api/contacts/invitations/inbox`. Elle renvoie les invitations reçues et envoyées, uniquement pour le compte de la session, avec une limite de 50 par liste. Elle n'expose pas les tokens.
- Les réponses des routes portent `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` et `Referrer-Policy: no-referrer`.

### Écarts et risques qui restent ouverts

1. **Deux familles de parcours coexistent.** Le code contient les routes `/api/contacts/invitations/*` et `/api/proximity/invitations/*`, avec des écrans et contrats distincts. Il faut cartographier leur usage effectif avant d'en retirer une ou de fusionner les modèles.
2. **Quota codé en dur à 2** dans `functions/api/contacts/invitations/accept.ts`. Le service supporte 2 ou 10, mais la route force 2. Aucun changement à 10 ne doit être fait sans matrice d'offres confirmée.
3. **Révocation unilatérale seulement.** `POST /api/contacts/revoke` autorise le propriétaire à retirer son proche. Le droit du proche de quitter la relation reste une proposition non approuvée ; ne pas l'activer par supposition.
4. **Effet sur une alerte déjà active non arbitré.** Le snapshot SOS historique et les droits futurs de lecture, d'accusé, de volontariat, de coordination et de rappel après révocation doivent être décidés avant toute modification croisée du moteur SOS ou du GPS.
5. **Acceptation et consentement des permissions.** La route lit la version de permission depuis D1 au moment de l'acceptation et la transmet au service. Le parcours d'acceptation présente actuellement un consentement général à rejoindre le cercle, pas une liste de permissions détaillées. La définition et l'affichage des permissions restent à consolider avant d'élargir les droits.
6. **Réponse API minimale.** La route d'acceptation renvoie encore les identifiants internes des deux comptes. Aucun besoin client démontré n'a été établi dans cet audit ; vérifier les consommateurs avant de réduire la réponse à un simple booléen.
7. **Livraison e-mail synchrone.** Le risque de résultat fournisseur ambigu décrit plus haut reste présent ; l'outbox/réconciliation est une amélioration technique indépendante des règles produit, mais elle doit préserver le comportement Brevo déjà opérationnel.

### Décision de sécurité pour la suite

Les contrôles d'identité de session, d'origine, d'e-mail vérifié, de token à usage unique et de transition conditionnelle sont présents. La suite peut renforcer les tests de routes et la fiabilité de livraison sans modifier les permissions métier. En revanche, la révocation symétrique, les quotas, les droits pendant une alerte active et les délais anti-abus restent des arbitrages explicites : aucun de ces comportements ne doit être activé par défaut.
## 11. Analyse technique de la livraison Brevo — 2026-11-25

### Chemin effectivement exécuté

Le parcours de création suit actuellement cette séquence synchrone :

1. `createContactInvitation` crée une invitation D1 avec un condensat du token ; le token brut reste uniquement en mémoire.
2. `sendContactInvitationEmail` construit le lien HTTPS et appelle le module partagé `sendBrevoTransactionalEmail`.
3. Si l'envoi retourne `ok: false`, `createAndSendContactInvitation` appelle `cancelPendingContactInvitation`, qui passe l'invitation de `pending` à `revoked`.
4. La route renvoie une erreur HTTP et ne restitue pas au client un état de livraison exploitable.

### Défauts confirmés

- Aucun journal/outbox d'e-mails ni registre des tentatives n'apparaît dans les migrations actuelles (0001–0025) ou dans le chemin d'invitation inspecté.
- L'identifiant Brevo `messageId` n'est conservé que dans le résultat en mémoire ; la route ne le persiste pas.
- Le code traite de la même manière une réponse HTTP non-2xx, une erreur réseau/timeout et une réponse 2xx dont le JSON est illisible ou ne contient pas de `messageId`.
- Une exception réseau après acceptation côté Brevo, un timeout après traitement, ou une réponse 2xx illisible peuvent donc conduire à la révocation d'un lien qui a peut-être déjà été envoyé.
- Aucun mécanisme de relance ou de réconciliation n'est présent dans ce parcours.
- Le code ne fournit pas de garantie d'idempotence côté Brevo. Ne pas ajouter un en-tête ou prétendre à une déduplication fournisseur sans preuve explicite que l'API Brevo utilisée le prend en charge.

### Conséquence de sécurité et d'expérience

Le risque principal n'est pas une fuite du token : celui-ci n'est pas persisté en clair et n'est pas journalisé par ce chemin. Le risque est l'incohérence entre l'e-mail potentiellement reçu et l'état D1 : le destinataire clique sur un lien qui a été révoqué automatiquement. À l'inverse, relancer aveuglément après un timeout peut envoyer plusieurs invitations valides ou plusieurs e-mails.

### Architecture nécessaire avant une correction complète

Une outbox fiable doit enregistrer l'événement de livraison dans D1 et permettre de distinguer au minimum :
- `queued` : demande enregistrée, aucun appel fournisseur commencé ;
- `sending` : tentative réservée par un bail atomique ;
- `accepted` : Brevo a répondu avec un `messageId` valide ;
- `rejected` : rejet explicite et non ambigu du fournisseur ;
- `uncertain` : l'appel a pu être traité, mais SAC ne peut pas prouver son résultat ;
- `retryable` : échec transitoire dont la non-acceptation est suffisamment établie.

Le token brut nécessaire à une relance ne peut pas être récupéré à partir de son condensat. Il ne faut donc ni le stocker en clair ni créer une relance automatique qui ne peut pas reconstruire exactement le même lien. Une conception de relance doit prévoir un secret de chiffrement dédié, une durée de conservation limitée, une protection stricte des données chiffrées et une procédure de rotation ; à défaut, la relance doit créer explicitement un nouveau token et invalider l'ancien selon une règle produit documentée.

Les baux doivent empêcher deux workers de traiter simultanément la même tentative. Les transitions d'état doivent être conditionnelles et atomiques. Les réponses API et l'interface doivent différencier un refus certain d'un résultat incertain, sans prétendre qu'un e-mail est livré lorsque seule l'acceptation API est connue.

### Périmètre de décision

Aucune modification de quota, de durée d'invitation, de permissions des proches, de révocation ou de comportement SOS n'est requise pour traiter ce défaut. En revanche, le stockage chiffré du token, sa durée de conservation, la stratégie de relance et la conduite à tenir après un état `uncertain` sont des choix de sécurité/produit qui doivent être définis avant une migration et une mise en production.

**Décision de cette tranche :** conserver le fournisseur Brevo et son intégration actuelle ; ne pas introduire de relance aveugle ni de nouvelle table incomplète. Le défaut est documenté précisément afin que la future outbox soit conçue avec une stratégie de secret et de résultat ambigu cohérente.

### Vérification supplémentaire — boîte de réception des invitations (25 novembre 2026)

Un test de route dédié a été ajouté dans `tests/contact-invitation-inbox-endpoint.test.ts` :

- l'accès sans session authentifiée est refusé avant toute lecture des invitations ;
- les requêtes reçues et envoyées utilisent exclusivement l'identifiant du compte issu de la session ;
- la boîte reçue exige que l'e-mail principal du destinataire soit vérifié et corresponde exactement à l'adresse de destination ;
- la réponse n'expose ni token, ni digest de token ;
- les réponses restent `no-store` et portent les en-têtes de protection attendus.

Le test est lancé par `npm run test:contact-invitation-inbox` et inscrit dans le workflow CI. Il ne modifie aucune permission, aucun quota et aucun comportement de révocation. Aucune migration D1 n'est requise.
## 12. Décision produit confirmée — droit du proche de quitter la relation (2026-11-25)

Le propriétaire et le proche disposent tous deux du droit de mettre fin à une relation active. Le proche peut se retirer de son propre gré, à tout moment, sans justification ni approbation du propriétaire. La cause d'audit devra distinguer `owner_revoked` de `contact_withdrew`.

Cette décision corrige le point ouvert « révocation unilatérale seulement » ci-dessus : le droit symétrique est désormais validé au niveau produit, mais **pas encore implémenté**. Le code inspecté contient toujours uniquement `POST /api/contacts/revoke` pour l'action du propriétaire.

La validation ne tranche pas les droits post-retrait pendant un SOS déjà actif, les rappels opaques, les positions, l'accusé de réception, la coordination, la notification de l'autre partie ni le délai anti-abus de réinvitation proposé. Le SOS de l'auteur doit rester actif ; aucune modification de son état ne découle du départ du proche. Ces règles doivent être précisées avant toute modification API/D1/SOS/GPS.