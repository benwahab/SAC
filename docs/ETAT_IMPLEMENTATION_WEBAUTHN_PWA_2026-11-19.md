# SAC — État d'implémentation WebAuthn PWA

- **Date :** 19 novembre 2026
- **Dépôt :** `benwahab/SAC`
- **Branche :** `main`
- **Statut :** parcours serveur d'enrôlement racine et première session implémenté dans le code ; validation CI et essais physiques non confirmés ; pas encore autorisé pour la production.

## 1. Parcours désormais raccordé

### 1.1 Préparation authentifiée
Endpoint : `POST /api/auth/root-enrollment-options`

- Vérifie une adresse e-mail principale déjà vérifiée et un compte actif.
- Vérifie le mot de passe avec le vérificateur PBKDF2-HMAC-SHA-256 existant.
- Limite les tentatives à cinq par fenêtre de quinze minutes, via une empreinte HMAC de l'adresse.
- Refuse une origine absente, HTTP, non canonique, hors RP ID ou non inscrite dans la liste blanche serveur.
- Génère un challenge CSPRNG de 32 octets.
- Crée une cérémonie de cinq minutes et conserve uniquement le SHA-256 du challenge.
- Lie l'origine exacte à la cérémonie ; l'origine de la réponse doit être identique.
- Retourne les options serveur : plateforme, UV obligatoire, ES256 unique, attestation none et residentKey discouraged.
- Ne délivre aucune session à ce stade.

### 1.2 Réponse navigateur
Fichiers :
- `src/services/device/webauthn.ts`
- `src/services/device/root-enrollment.ts`

- La page de connexion demande le mot de passe puis prépare la cérémonie.
- Un second clic déclenche `navigator.credentials.create()` directement depuis une action utilisateur, sans requête réseau préalable à l'ouverture de l'authenticator.
- L'adaptateur refuse les contextes non HTTPS, les navigateurs non compatibles, les options non conformes et les réponses mal formées.
- Le client transmet au serveur l'identifiant, clientDataJSON, attestationObject et authenticatorAttachment.
- Le flux est raccordé à l'écran de connexion en français, anglais et arabe.

### 1.3 Vérification serveur
Fichiers :
- `functions/lib/security/webauthn-cbor.ts`
- `functions/lib/security/webauthn-root-verifier.ts`
- `functions/lib/security/webauthn-origin.ts`
- `src/domain/webauthn-root-policy.ts`

Endpoint : `POST /api/auth/complete-root-enrollment`

Le serveur :
- vérifie le type de credential, l'ID et le rawId ;
- vérifie le type client `webauthn.create`, le challenge par empreinte SHA-256, l'origine exacte liée à la cérémonie et la liste blanche ;
- vérifie le hash RP ID dans authenticatorData ;
- exige UP=1 et UV=1 ;
- exige AT=1 et refuse les extensions non prises en charge ;
- refuse BE=1, BS=1 et les bits réservés ;
- accepte uniquement une attestation `none` avec attStmt vide ;
- décode le COSE et accepte uniquement EC2/P-256/ES256 avec coordonnées de 32 octets ;
- importe la clé publique via WebCrypto pour vérifier sa validité ;
- refuse les credentials non attachées à un authenticator de plateforme ;
- applique la politique racine singleDevice, non sauvegardée et userVerified.

Le décodeur CBOR est borné en taille/profondeur et refuse les longueurs non canoniques, les valeurs non prises en charge et les données résiduelles.

**Choix de vérificateur à revoir :** le smoke test SimpleWebAuthn 14.1.0 reste une dépendance installée uniquement dans le job CI. L'endpoint d'enrôlement utilise actuellement un vérificateur natif restreint au profil `none`/ES256, sans dépendance runtime supplémentaire. Cette implémentation n'est pas homologuée par une revue WebAuthn indépendante. Il faut comparer/remplacer cette voie par SimpleWebAuthn comme dépendance de production dès que le verrouillage package/lockfile et la compatibilité Workers sont résolus. Ne pas ouvrir le parcours en production avant cette revue.

**Limite du profil none :** l'attestation ne fournit pas de signature de fabricant ou de preuve matérielle d'authenticité. Le serveur valide la structure, le challenge, l'origine, le RP ID et la clé publique ; la preuve de possession de la clé privée doit être apportée lors d'une authentification WebAuthn ultérieure.

### 1.4 Persistance D1 et première session

Migration : `migrations/0007_root_device_enrollment.sql`

Tables :
- `root_enrollment_ceremonies`
- `root_enrollment_challenges`
- `root_enrollment_rate_limits`
- `devices`
- `device_root_credentials`
- `device_sessions`
- `device_enrollment_events`

La validation et l'enregistrement s'effectuent dans un seul batch D1 :
1. consommation conditionnelle du challenge ;
2. création de l'appareil racine ;
3. stockage de l'identifiant et de la clé publique ;
4. création de la session et de son empreinte de jeton ;
5. clôture de la cérémonie ;
6. écriture de l'événement d'audit.

Un trigger d'audit fait échouer le batch si le parcours n'est pas complet. La transaction D1 annule alors les écritures précédentes. Une seule racine est autorisée par compte. Le challenge expire après cinq minutes et cinq échecs de validation au maximum sont admis.

Le jeton brut n'est jamais stocké dans D1. Il est remis dans le cookie `__Host-sac_session`, Secure, HttpOnly, SameSite=Strict, Path=/, sans Domain. Les sessions ont une limite d'inactivité de 30 jours et une limite absolue de 90 jours.

### 1.5 Contrôle de session et déconnexion

- `GET /api/auth/session` relit la session dans D1, vérifie l'état du compte et de l'appareil, le statut de révocation, la version d'autorisation, l'expiration absolue et l'inactivité. L'activité valide renouvelle l'échéance et le cookie.
- `POST /api/auth/logout` révoque la session dans D1 et efface le cookie.
- Les transitions des credentials, appareils, sessions et événements d'enrôlement sont protégées par des triggers D1.

## 2. Tests ajoutés

- `tests/webauthn-root-options.test.ts`
- `tests/webauthn-origin.test.ts`
- `tests/webauthn-root-verifier.test.ts`
- `tests/root-enrollment-endpoints.test.ts`
- `tests/root-enrollment-client.test.ts`
- `tests/d1_root_device_enrollment_schema.test.py`

Commandes ajoutées dans `package.json` et étapes correspondantes dans `.github/workflows/ci.yml` :
- `npm run test:webauthn-root-options`
- `npm run test:webauthn-origin`
- `npm run test:webauthn-root-verifier`
- `npm run test:root-enrollment-endpoints`
- `npm run test:root-enrollment-client`
- `npm run test:d1-root-device-enrollment`

**Ces tests ont été écrits et raccordés, mais leur réussite n'est pas affirmée.** Aucune exécution locale de la suite ou compilation n'a été effectuée dans cet environnement. Le problème CI déjà signalé est laissé de côté à la demande du propriétaire.

## 3. Configuration requise avant tout essai réel

Variables d'environnement Cloudflare à définir par environnement :
- `WEBAUTHN_RP_ID` : RP ID exact, en minuscules, sans schéma ni port ;
- `WEBAUTHN_RP_NAME` : nom d'affichage SAC ;
- `WEBAUTHN_ALLOWED_ORIGINS` : tableau JSON d'origines HTTPS canoniques exactes ;
- `EMAIL_OTP_HMAC_SECRET` : secret serveur existant d'au moins 32 caractères.

Aucune valeur de domaine de production n'est inventée ou inscrite dans le dépôt. Si ces variables ne sont pas configurées, les endpoints échouent fermé.

La migration 0007 est versionnée dans Git mais **n'a pas été appliquée à la base D1 distante**.

## 4. Limites restantes — ne pas annoncer SAC comme terminé

1. Essais physiques sur Android/Chrome : non réalisés ; compatibilité réelle de l'authenticator à confirmer.
2. `residentKey: discouraged` est le choix provisoire conservant le profil du smoke test ; le choix final doit être confirmé sur les appareils cibles.
3. L'authentification WebAuthn par assertion (`navigator.credentials.get`) pour les connexions suivantes n'est pas encore implémentée. Le présent lot crée uniquement la première credential racine et la première session.
4. Le contrôle de session est disponible via l'endpoint dédié, mais les futurs endpoints privés de contacts, SOS, GPS et données personnelles doivent encore être raccordés à ce contrôle avant exposition.
5. Les variables Cloudflare réelles ne sont pas configurées et la migration distante n'est pas appliquée.
6. Tests CI et build non confirmés.

## 5. Conditions avant test utilisateur ou production

- Revue du code et exécution réussie des tests de l'enrôlement.
- Configuration des origines et du RP ID réels.
- Application contrôlée de la migration 0007 après validation de l'environnement D1.
- Essais réels sur plusieurs téléphones Android/versions Chrome, y compris annulation, perte réseau et répétition.
- Implémentation et tests du parcours d'assertion WebAuthn pour les connexions suivantes.
- Intégration obligatoire du contrôle de session à chaque route privée avant l'ouverture des fonctions métier.

Aucun déploiement, changement de ressources Cloudflare ou migration distante n'a été exécuté dans ce lot.
