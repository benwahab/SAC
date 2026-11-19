# SAC — État réel du dépôt et feuille de route opérationnelle

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC` — branche `main`  
**Objet :** photographie du code, correction de suivi et ordre des prochains chantiers.  
**Statut :** audit de dépôt ; ne vaut ni homologation de sécurité, ni activation de service externe.

## 1. Conclusion

SAC possède désormais plus qu'une simple maquette : une PWA React/Vite, un formulaire d'inscription branché sur des routes réelles de vérification e-mail, une migration D1 initiale pour comptes/identités/défis OTP, plusieurs contrats métier TypeScript et une CI étendue.

Mais l'application n'est pas encore une plateforme d'alerte utilisable : la connexion privée n'est pas livrée, les sessions ne sont pas encore émises par un parcours de connexion, les invitations n'ont pas encore leurs routes de création/acceptation, aucun endpoint SOS n'est encore exposé, aucun push/SMS n'est livré, aucun trajet n'est exécuté et aucun GPS réel ne doit être activé. Des endpoints authentifiés de consultation et de révocation des proches viennent d'être ajoutés ; ils restent inutilisables tant que le parcours de session et le schéma D1 ne sont pas activés.

Le dépôt contient beaucoup de conception ; le travail doit maintenant se déplacer progressivement vers des tranches fonctionnelles verticales, sans créer des écrans qui prétendent fonctionner sans API.

## 2. Inventaire vérifié au 19 novembre

### 2.1 Interface et PWA
- `src/App.tsx` contient la page d'accueil de présentation et un parcours `/connexion` avec création de compte, saisie OTP e-mail et écran de confirmation.
- La connexion est explicitement indisponible dans l'interface : aucune route `/api/auth/login` n'existe.
- La page de confirmation indique que l'espace privé reste fermé en attendant la finalisation des appareils et sessions.
- Le service worker et le manifeste PWA sont présents ; le cache ne constitue pas un mécanisme SOS hors ligne.
- La traduction FR/EN/AR existe pour l'interface actuelle, mais ne prouve pas que tous les futurs écrans sont traduits.
- L'identité vert clair Glassmorphism doit être contrôlée sur l'ensemble des écrans ; ne pas supposer que tous les écrans futurs existent.

### 2.2 Routes API réellement présentes
- `GET /api/health` : requête de connectivité D1 élémentaire.
- `POST /api/auth/register` : création de compte en attente, identité e-mail/téléphone, hash du mot de passe, défi OTP et envoi via Resend si les secrets sont configurés.
- `POST /api/auth/resend-email` : nouveau défi e-mail pour un compte en attente.
- `POST /api/auth/verify-email` : vérification OTP et activation via trigger D1.
- `GET /api/auth/session` : vérification et renouvellement d'une session liée à un appareil déjà existante ; elle ne crée pas de session.
- `POST /api/auth/logout` : révocation de la session courante.
- `POST /api/auth/root-enrollment-options` et `POST /api/auth/complete-root-enrollment` : préparation et finalisation de l'enrôlement racine, actuellement protégées par un interrupteur de fonctionnalité et non homologuées pour production.
- `GET /api/contacts` : liste les proches actifs du compte authentifié.
- `POST /api/contacts/revoke` : révoque une relation directionnelle dont le compte courant est propriétaire.
- `POST /api/contacts/invitations` : crée une invitation à usage unique et déclenche l'e-mail via Resend lorsque les paramètres de durée, version de permission et fournisseur sont configurés.
- `POST /api/contacts/invitations/accept` et `POST /api/contacts/invitations/decline` : acceptation/refus par le compte authentifié dont l'adresse e-mail vérifiée correspond à la destination.
- `POST /api/alerts` : création authentifiée d'un SOS avec instantané de proches choisis et seuil de rappels push.
- `GET /api/alerts/:alertId` : lecture du SOS réservée à son auteur ou à un destinataire de l'instantané initial.
- `POST /api/alerts/:alertId/respond` : accusé de réception, volontariat ou retrait du volontariat pour un destinataire autorisé.
- `POST /api/alerts/:alertId/close` : clôture réservée à l'auteur, avec motif validé.
- `GET /api/alerts/:alertId/events` : chronologie accessible uniquement à l'auteur ou à un destinataire initial ; l'API masque les identifiants de comptes et ne renvoie que « self » ou « participant » pour l'acteur.
- Routes toujours absentes : connexion par assertion WebAuthn pour un appareil déjà enrôlé, récupération/réinitialisation de compte, notifications push réellement livrées, SMS réellement livrés, trajets, paiements et administration professionnelle.

La présence d'un adaptateur Resend et de routes d'inscription ne prouve pas qu'un compte fournisseur ou des secrets sont configurés, ni qu'un e-mail réel a été délivré.

### 2.3 D1 et migrations
- Sept migrations sont versionnées : `0001_account_email_otp.sql`, `0002_contact_invitations.sql`, `0003_alerts_sos.sql`, `0004_sos_reminder_leases.sql`, `0005_sos_sms_escalation.sql`, `0006_email_otp_delivery_state.sql` et `0007_root_device_enrollment.sql`.
- Elles définissent les comptes/OTP, invitations et relations directionnelles de proches, alertes/destinataires/événements/rappels, leases de rappels, files d'escalade SMS, état de livraison OTP, appareils racines et sessions.
- Elles ne couvrent pas encore les abonnements push, les trajets, les paiements ni la console professionnelle.
- Vérification en lecture seule du compte Cloudflare connecté le 19 novembre : une base D1 nommée `sac-db` existe (UUID `892ce876-f279-409c-8f9e-06b1dca66e9d`, version `production`) mais elle contient actuellement **0 table**. Aucune migration distante n'est donc appliquée.
- La liste Cloudflare Pages renvoie actuellement **aucun projet** dans le compte connecté. Aucun déploiement SAC n'est donc établi par cette vérification.
- Le schéma relationnel général reste non prêt à migration selon sa revue de cohérence.

### 2.4 Contrats métier et tests
Des contrats purs et suites de tests existent notamment pour :
- politique d'authentification et inscription ;
- cycle de vie du compte et suppression ;
- cycle d'alerte et rappels ;
- réponses, volontariat et responsabilité principale ;
- appareils et certificats expérimentaux ;
- autorisation de session ;
- protection des trajets ;
- cryptographie expérimentale de localisation ;
- canonicalisation JSON, ECDSA et formats P-256.

Ces modules et tests n'établissent pas à eux seuls la persistance D1, les autorisations serveur, la livraison des notifications ou une expérience de bout en bout.

### 2.5 Infrastructure
- L'accès API Cloudflare est connecté et a permis une vérification en lecture seule.
- Aucun projet Cloudflare Pages n'est présent dans le compte connecté au moment de la vérification.
- La base D1 `sac-db` existe, mais contient 0 table ; elle n'est pas prête à servir l'application.
- R2 n'a pas été vérifié dans cette passe et n'est pas déclaré opérationnel.
- Aucun fournisseur push/SMS/paiement n'est intégré comme service opérationnel.
- Aucun registre Azure externe n'a été choisi ni créé.
- Les coordonnées GPS réelles restent NO-GO.

## 3. Correction de l'écart sur le cycle de vie du compte

Le contrat `src/domain/account-lifecycle.ts` reconnaît bien les cinq états approuvés :
`pending_verification`, `active`, `suspended`, `deletion_pending`, `deleted`.

Le 19 novembre, le contrat pur a été étendu pour :
- autoriser la suspension administrative d'un compte actif uniquement avec un rôle `super_admin` ;
- autoriser le rétablissement d'un compte suspendu uniquement avec ce même rôle ;
- refuser la suspension d'un compte en attente de vérification, en suppression ou supprimé ;
- conserver le verrouillage technique de risque comme une dimension distincte, pas comme un nouvel état administratif.

Des tests ont été ajoutés pour les autorisations, les états non suspendables et le rétablissement.

**Limite :** cela reste un contrat métier pur. Il n'existe pas encore de route d'administration, d'identité Super Admin persistée, de journal d'audit D1 ni de transaction serveur qui applique cette suspension. Les alertes déjà actives et leurs rappels ne doivent pas être annulés par une suspension de compte ; les permissions d'urgence restent régies par leurs contrats spécialisés.

## 4. Défaut CI détecté et correction

Le nouveau test local du contrat UDE a d'abord échoué parce que Node.js 22 en mode `--experimental-strip-types` ne prend pas en charge les propriétés de paramètre TypeScript dans un constructeur. Le test a été corrigé en déclarant la propriété explicitement.

La suite UDE corrigée a été observée réussie dans le run `44480627845` à l'étape dédiée. Cela ne prouve que le modèle local. Le workflow complet et les tests du dernier commit doivent encore être vérifiés séparément avant de déclarer `main` entièrement vert.

## 5. Ordre des prochains chantiers — éviter les reprises

### P0 — Fermer le socle compte et appareils
1. Finir l'audit de la vérification e-mail, des renvois, des erreurs fournisseur et des cas de concurrence.
2. Finaliser les arbitrages de session et de récupération.
3. Terminer le protocole de racine WebAuthn et les preuves indépendantes sur appareils physiques.
4. Construire ensuite seulement les routes de connexion, session, déconnexion, révocation et récupération.
5. Ajouter les migrations après validation du modèle relationnel et des invariants de sécurité.

### P0 — Construire les proches et invitations
1. Modèle D1 relationnel et contraintes composites.
2. Invitation à usage unique, acceptation explicite et vérification de l'adresse destinataire.
3. Révocation et règles d'accès pendant un SOS actif.
4. API et tests d'isolation entre comptes.
5. Interface réelle connectée à ces API.

### P0 — Construire le moteur SOS essentiel
1. Création serveur atomique avec instantané immuable des destinataires.
2. Historique d'événements et idempotence.
3. Accusés de réception et candidatures.
4. Attribution/transfert du responsable principal sans double attribution.
5. Clôture par l'auteur et exception administrative étroite déjà spécifiée.
6. Tests d'intégration D1, concurrence, reprise et autorisations.

### P1 — Communications et notifications
- Outbox récupérable, abonnements push par appareil, rappels toutes les cinq minutes, seuil d'escalade SMS choisi, webhooks, déduplication, états exacts de livraison.
- Aucun fournisseur ni canal n'est annoncé actif avant sélection, secrets, essais et autorisation.

### P1 — Protection des trajets et GPS
- Implémenter d'abord les flux sans coordonnées précises et les règles d'arrivée.
- Définir les arbitrages de durée/fraîcheur et la conservation hors GPS.
- Maintenir la collecte GPS précise bloquée tant que la destruction irréversible et la non-résurrection ne sont pas prouvées.

### P1/P2 — Application et services complémentaires
- Finaliser toutes les vues citoyennes FR/EN/AR, accessibilité, PWA et réseau faible.
- Abonnements/paiements après sécurisation du SOS essentiel.
- Console professionnelle, rôles, missions et services selon le plan directeur ; ne pas confondre ce chantier avec la V1 SOS citoyenne.

## 6. Règle de pilotage

Pour chaque tranche fonctionnelle :
1. vérifier les décisions et contrats déjà validés ;
2. auditer les fichiers concernés ;
3. écrire le code côté serveur et l'interface seulement lorsque l'API existe ;
4. ajouter tests unitaires, intégration et tests négatifs ;
5. vérifier CI, typecheck et build ;
6. actualiser le présent état réel ;
7. ne déclarer livré que ce qui a été exécuté et prouvé.

Ne pas répéter les études déjà terminées. Ne pas créer des écrans factices. Ne pas transformer un test en mémoire en preuve d'intégration réelle. Ne pas ouvrir de service externe, déployer ou créer de dépense sans l'autorisation correspondante.

**Priorité de reprise après cet audit :** terminer la tranche compte/appareils sans contourner WebAuthn, puis passer aux proches/invitations et au moteur SOS. L'anti-restauration reste un sous-chantier transversal et ne doit pas monopoliser la feuille de route.


## 7. Tranches métier ajoutées après l'inventaire

### 7.1 Suspension administrative du compte
Le contrat `src/domain/account-lifecycle.ts` accepte maintenant les commandes de suspension et de rétablissement réservées au rôle `super_admin`. Les tests correspondants sont dans `tests/account-lifecycle.test.ts`. Le run `44480715548` a confirmé avec succès le test UDE corrigé, le typecheck, les tests du cycle de suppression de compte et le build pour le commit `665393b2`. Ce résultat ne valide pas encore une API ou une persistance de suspension.

### 7.2 Invitations de proches
Un contrat métier pur a été ajouté dans `src/domain/contact-invitations.ts`, avec tests dans `tests/contact-invitations.test.ts`. Il couvre l'acceptation explicite par un compte actif avec adresse vérifiée correspondant à la destination, la vérification du hash présenté, la version de permissions, le refus, le retrait par l'invitant, l'expiration et la direction unique de la relation.

Les durées, quotas, relances, permissions concrètes, révocation symétrique et droits après révocation pendant un SOS actif restent ouverts. Le contrat ne crée pas d'invitation, n'envoie aucun e-mail, ne persiste aucune relation et ne remplace pas une transaction D1 atomique. Les API et migrations restent bloquées jusqu'à résolution des arbitrages produit et du modèle relationnel.


## 8. Cohérence clôture SOS / responsabilité du proche

L'audit du contrat de réponses a identifié un écart : la transition de clôture de l'alerte existait dans `alert-lifecycle.ts`, tandis que l'historique du responsable principal était géré séparément dans `alert-responses.ts`. Rien ne garantissait qu'une alerte clôturée ne conserve pas une période de responsabilité ouverte.

Correction ajoutée :
- `closeAlertResponderState()` synchronise un état d'alerte clôturé (issu de `transitionAlert()`) avec la fin de l'unique période de responsabilité ouverte ;
- la fin est horodatée exactement à `closedAt`, avec le motif `alert_closed` ;
- le helper vérifie l'identité de l'alerte, l'auteur, sa date de création et l'instantané immuable des destinataires ;
- il refuse une clôture antérieure au début de la responsabilité ;
- un état d'alerte clôturé qui conserve une responsabilité ouverte est désormais invalide.

Tests ajoutés dans `tests/alert-responses.test.ts` : clôture avec responsable, sans responsable, mauvais instantané, horodatage antérieur et état terminal incohérent.

**Limite :** cette correction porte sur le contrat métier pur. La clôture, l'historique de responsabilité, l'événement d'audit et l'arrêt des rappels devront être persistés dans une seule transaction D1 lors de la future implémentation SOS. Aucun endpoint SOS ni envoi de notification n'est créé ici.


## 9. Tranche technique ajoutée — garde de session et API des proches

Sur `main`, les changements suivants ont été ajoutés :
- `functions/lib/security/require-authenticated-device-session.ts` centralise la vérification du cookie opaque, de son empreinte D1, de l'état du compte, de l'appareil, de la version d'autorisation, de l'expiration et du renouvellement d'activité.
- `GET /api/auth/session` réutilise désormais cette garde commune au lieu de dupliquer la vérification.
- `GET /api/contacts` retourne uniquement les relations directionnelles actives du compte authentifié ; aucun identifiant de compte fourni par le client n'est utilisé comme autorité.
- `POST /api/contacts/revoke` permet au propriétaire authentifié de révoquer sa relation, avec contrôle same-origin et lecture JSON bornée.
- `POST /api/contacts/invitations` crée une invitation avec jeton aléatoire, empreinte stockée en D1 et e-mail de livraison ; le jeton brut n'est jamais renvoyé au navigateur ni stocké en base.
- `POST /api/contacts/invitations/accept` vérifie l'identité e-mail du compte connecté et consomme l'invitation avec création de la relation directionnelle dans le service D1 existant.
- `POST /api/contacts/invitations/decline` permet au destinataire vérifié de refuser l'invitation.
- Les endpoints appliquent le contrôle same-origin, la lecture JSON bornée et l'authentification par session ; l'acceptation conserve la limite gratuite actuelle de deux proches. Les droits Premium ne sont pas activés.
- `tests/require-authenticated-device-session.test.ts` couvre l'absence de cookie, l'autorisation d'une session valide, le refus d'un compte suspendu et l'indisponibilité D1 ; commande dédiée `npm run test:session-guard`.

**Limites explicites :** cette tranche ne crée pas encore les sessions et ne résout donc pas l'absence de route de connexion. Le parcours visuel `/invitation/accept` et son intégration dans l'interface ne sont pas encore livrés. Les routes refusent l'accès tant que les tables D1 et une session valide ne sont pas disponibles. La création d'invitation exige les variables `CONTACT_INVITATION_TTL_MS`, `CONTACT_PERMISSION_VERSION`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` et `APP_BASE_URL` ; elles ne sont pas configurées ici. Les migrations distantes n'ont pas été appliquées et aucun projet Pages n'a été créé ou déployé. Aucun secret ni fournisseur n'a été configuré.


## 10. Tranche SOS serveur ajoutée

Les routes suivantes sont maintenant présentes dans `functions/api/alerts/` :
- `POST /api/alerts` crée une alerte par le compte de la session, valide la liste des proches via le service SOS, fige les destinataires et crée les entrées de rappels dans la même opération D1.
- `GET /api/alerts/:alertId` ne retourne le détail qu'à l'auteur ou à un destinataire figurant dans l'instantané immuable.
- `POST /api/alerts/:alertId/respond` expose les actions `acknowledge`, `volunteer` et `withdraw` du service métier, sans accepter d'identité d'acteur depuis le client.
- `POST /api/alerts/:alertId/close` applique la clôture par l'auteur uniquement ; le motif est limité à `completed` ou `cancelled`.

Le nombre de rappels choisi est validé par le service existant (1 à 5) et les échéances restent espacées de cinq minutes. La création SOS ne demande aucune coordonnée GPS. La limite de destinataires appliquée par l'API est actuellement celle de l'offre gratuite (2), les droits Premium n'étant pas encore activés.

**Limites :** ces routes exigent une session appareil authentifiée et les tables des migrations D1 0001 à 0007. Le compte Cloudflare connecté montre toujours `sac-db` avec 0 table et aucun projet Pages. Il n'existe pas encore de route de connexion pour émettre les sessions ; par conséquent ces API ne sont pas encore utilisables en production. Les files D1 de rappels et SMS ne constituent pas une livraison push/SMS : aucun adaptateur fournisseur ni worker de dispatch opérationnel n'est encore configuré. La chronologie des événements n'a pas encore son endpoint de lecture.

## 11. Audit de correspondance : ne pas reconstruire les services métier déjà présents

Une vérification ciblée du code et de l'interface a été effectuée après les tranches API précédentes.

| Domaine | Ce qui existe réellement | Ce qui manque encore |
|---|---|---|
| Comptes | Inscription, hash du mot de passe, OTP e-mail, activation, renvoi OTP | Connexion d'un appareil déjà enrôlé, récupération du compte, interface privée après connexion |
| Appareil racine | Préparation et finalisation d'un premier enrôlement WebAuthn ; création d'une première session | Vérification indépendante du protocole actuel, bibliothèque WebAuthn de production, assertion de connexion et tests physiques |
| Sessions | Cookie opaque, hash D1, vérification/renouvellement et déconnexion ; garde partagée ajoutée aux routes contacts/SOS | Émission de session lors d'une connexion ultérieure, intégration systématique de la garde à toutes les routes privées |
| Proches | Services métier, invitation à usage unique, acceptation/refus, révocation, liste ; routes API ajoutées | Écrans de gestion des proches, boîte de réception des invitations, route d'acceptation web et raccordement UI |
| SOS | Service métier D1 : création, instantané des destinataires, réponses, volontariat, responsabilité, clôture, rappels/outbox, évaluation d'escalade SMS ; routes de création/lecture/réponse/clôture ajoutées | Interface SOS et suivi, worker de livraison push/SMS, lecture de la chronologie désormais exposée par API mais non affichée |
| Protection de trajet | Contrat métier pur et tests | Persistance D1, API, interface, communications et règles de confidentialité en production |
| GPS | Modules cryptographiques expérimentaux | Parcours utilisateur complet et preuve vérifiable de destruction irréversible à J+30 ; activation interdite tant que la preuve manque |
| Administration | Contrats et documentation de gouvernance/permissions | Comptes et rôles persistés, API, audit D1 et interfaces |
| Abonnements | Règles d'offre et limites documentées | Paiement, vérification de droits Premium et activation réelle des quotas |
| Documents | Décision d'archivage et contrats de traçabilité documentés | Génération, impression, indexation et archivage opérationnels dans les rubriques sources |
| Interface globale | Page de présentation, PWA, inscription, vérification e-mail et préparation du premier appareil | Tableau de bord privé, écrans métier, navigation connectée et parcours de bout en bout |

### Constat d'interface confirmé

La page `src/App.tsx` contient une page d'accueil de présentation et une page `/connexion` qui permet actuellement l'inscription, la vérification e-mail et le lancement de l'enrôlement initial. Le formulaire présenté comme « Connexion » déclenche en réalité la préparation du premier enrôlement racine ; il ne permet pas à un utilisateur déjà enrôlé de se reconnecter. Il n'existe pas encore d'écran opérationnel pour les proches, les SOS, les trajets ou l'administration.

### Tranche réellement ajoutée après cet audit

- `GET /api/alerts/:alertId/events` appelle le service métier de chronologie déjà présent, applique la garde de session et vérifie l'appartenance à l'alerte. Les identifiants de comptes des autres participants ne sont pas exposés à l'interface.
- Commit : `b3c89b81b3b4ccd8d8f3be155285a1b99664d35e`.

### Ordre de travail corrigé

1. Terminer le parcours de connexion WebAuthn existant sans réécrire les contrats SOS/proches déjà développés.
2. Construire l'interface privée et raccorder les écrans proches + invitations + SOS aux API existantes.
3. Implémenter les workers et adaptateurs de livraison push/SMS en distinguant systématiquement « accepté par le fournisseur » de « livré ».
4. Ajouter la persistance et l'interface des trajets, puis seulement les communications associées.
5. Fermer les preuves de destruction GPS J+30, l'administration, les droits Premium et l'archivage documentaire.
6. Vérifier les migrations et la CI dans un environnement de build ; aucune migration distante ni aucun déploiement n'est autorisé par cet audit.

Aucun écran ou service métier déjà présent ne doit être réécrit au seul motif qu'il ne dispose pas encore de route ou d'interface.

## Mise à jour — interface de l'espace privé (19 novembre 2026)

Une première interface réellement raccordée aux API existantes a été ajoutée sur `/espace-prive` :

- vérification de la session active via `GET /api/auth/session` avant le chargement ;
- lecture du cercle de confiance via `GET /api/contacts` ;
- envoi d'invitation via `POST /api/contacts/invitations` ;
- révocation unilatérale d'un proche via `POST /api/contacts/revoke` ;
- déconnexion via `POST /api/auth/logout` ;
- états de chargement, erreurs et confirmation affichés sans présenter une invitation comme acceptée.

Le parcours est volontairement limité aux capacités réellement exposées par les API. La page ne prétend pas fournir l'historique des invitations, le statut de livraison push/SMS, ni un tableau de bord SOS complet. L'accès reste conditionné à une session valide ; le parcours d'authentification WebAuthn de connexion reste à finaliser.

Fichiers concernés : `src/PrivateSpacePage.tsx`, `src/App.tsx`.

Cette interface n'est pas considérée comme validée en production : D1 distante reste non initialisée (zéro table lors du dernier contrôle) et aucun projet Pages n'a été observé dans le compte Cloudflare connecté. Aucun déploiement ni changement distant n'a été effectué.
