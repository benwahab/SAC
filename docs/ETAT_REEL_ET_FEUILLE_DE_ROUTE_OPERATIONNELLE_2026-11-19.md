# SAC — État réel du dépôt et feuille de route opérationnelle

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC` — branche `main`  
**Objet :** photographie du code, correction de suivi et ordre des prochains chantiers.  
**Statut :** audit de dépôt ; ne vaut ni homologation de sécurité, ni activation de service externe.

## 1. Conclusion

SAC possède désormais plus qu'une simple maquette : une PWA React/Vite, un formulaire d'inscription branché sur des routes réelles de vérification e-mail, une migration D1 initiale pour comptes/identités/défis OTP, plusieurs contrats métier TypeScript et une CI étendue.

Mais l'application n'est pas encore une plateforme d'alerte utilisable : la connexion privée et les sessions ne sont pas livrées, les proches/invitations ne disposent pas de backend, aucun SOS n'est créé côté serveur, aucun push/SMS n'est livré, aucun trajet n'est exécuté et aucun GPS réel ne doit être activé.

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
- Routes non présentes dans `functions/api/` : login, logout, renouvellement/révocation de session, récupération/réinitialisation de mot de passe, proches, invitations, SOS, notifications, trajets, paiements, administration professionnelle.

La présence d'un adaptateur Resend et de routes d'inscription ne prouve pas qu'un compte fournisseur ou des secrets sont configurés, ni qu'un e-mail réel a été délivré.

### 2.3 D1 et migrations
- Une migration applicative versionnée existe : `migrations/0001_account_email_otp.sql`.
- Elle porte sur les comptes, identités et défis OTP.
- Aucune migration de production pour appareils/racines/sessions, proches, invitations, alertes, destinataires, outbox, abonnements push, trajets, paiements ou console professionnelle n'est présente.
- La base D1 distante a été décrite comme vide dans le suivi ; aucune migration distante ne doit être présumée appliquée.
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
- Cloudflare Pages et le binding D1 Preview restent à vérifier selon le suivi.
- R2 n'est pas déclaré opérationnel.
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
