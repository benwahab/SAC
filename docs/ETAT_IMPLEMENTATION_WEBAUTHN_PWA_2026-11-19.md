# SAC — État d'implémentation WebAuthn PWA

- **Date :** 19 novembre 2026
- **Dépôt :** `benwahab/SAC`
- **Branche :** `main`
- **Statut vérifié le 20 novembre 2026 :** enrôlement racine et première session présents dans le code ; migration 0007 appliquée à D1 distante ; suite CI WebAuthn et build réussis sur le commit documentaire `0931949` (run `44806442041`) ; enrôlement toujours fermé par défaut ; aucun essai physique Android ni authentification WebAuthn par assertion complète ; pas autorisé pour la production.

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

**Décision d'intégration documentée :** `docs/DECISION_INTEGRATION_SIMPLEWEBAUTHN_WORKERS_V1.md` fixe la migration vers `@simplewebauthn/server@14.1.0`, la validation du challenge sans stocker sa valeur brute, les données COSE à persister et le futur parcours d'assertion. La compatibilité Cloudflare Workers est déclarée par la documentation de la bibliothèque et un smoke test Worker existe dans le dépôt. La dépendance n'est toutefois pas encore intégrée au manifeste/lockfile de production : aucune substitution du vérificateur ni connexion par assertion n'est déclarée terminée.

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

**Vérification CI du 20 novembre 2026 :** le run GitHub Actions `44806442041` est terminé avec succès. Les étapes SimpleWebAuthn Workers smoke, politique racine, adaptateur navigateur, options serveur, origine/RP ID, vérificateur cryptographique, endpoints d'enrôlement, client PWA, atomicité D1 locale, anti-rollback, `npm run typecheck`, tests D1 d'enrôlement et `npm run build` sont toutes en succès. Cette CI valide les tests automatisés dans l'environnement isolé ; elle ne remplace pas les essais physiques Android ni une revue cryptographique indépendante.

## 3. Verrouillage effectif avant tout essai réel

Les deux routes d'enrôlement vérifient désormais `WEBAUTHN_ROOT_ENROLLMENT_ENABLED === "true"` après validation minimale de la requête. Sans cette valeur exacte, elles répondent `503 root_enrollment_not_approved` et ne consultent pas D1. La variable `WEBAUTHN_ROOT_ENROLLMENT_ENABLED` n'apparaît pas dans la configuration de production observée et l'enrôlement reste fermé. Ne pas activer ce verrou avant revue cryptographique indépendante et essais physiques. Ce verrou est une protection supplémentaire, pas une approbation de sécurité : ne pas l'activer avant revue cryptographique indépendante, choix définitif du profil racine et essais physiques.

## 4. Configuration requise avant tout essai réel

Variables d'environnement Cloudflare à définir par environnement :
- `WEBAUTHN_RP_ID` : RP ID exact, en minuscules, sans schéma ni port ;
- `WEBAUTHN_RP_NAME` : nom d'affichage SAC ;
- `WEBAUTHN_ALLOWED_ORIGINS` : tableau JSON d'origines HTTPS canoniques exactes ;
- `EMAIL_OTP_HMAC_SECRET` : secret serveur existant d'au moins 32 caractères.

Aucune valeur de domaine de production n'est inventée ou inscrite dans le dépôt. Si ces variables ne sont pas configurées, les endpoints échouent fermé.

La migration 0007 est appliquée à la base D1 distante `sac-db` : le registre `d1_migrations` indique `0007_root_device_enrollment.sql` appliquée le 19 novembre 2026 à 17:04:42 UTC. Les sept tables de l'enrôlement racine et des sessions sont présentes et ont été relues dans `sqlite_master`. La migration 0009 est également appliquée. Le point de contrôle de disponibilité doit être testé via la route réellement exposée ; l'URL `/api/health` a renvoyé 404 lors de la vérification du 20 novembre et ne doit pas être considérée comme un endpoint disponible.

## 5. Limites restantes — ne pas annoncer SAC comme terminé

1. Essais physiques sur Android/Chrome : non réalisés ; compatibilité réelle de l'authenticator à confirmer.
2. `residentKey: discouraged` est le choix provisoire conservant le profil du smoke test ; le choix final doit être confirmé sur les appareils cibles.
3. L'authentification WebAuthn par assertion (`navigator.credentials.get`) pour les connexions suivantes n'est pas encore implémentée. Le présent lot crée uniquement la première credential racine et la première session.
4. Le contrôle de session est disponible via l'endpoint dédié, mais les futurs endpoints privés de contacts, SOS, GPS et données personnelles doivent encore être raccordés à ce contrôle avant exposition.
5. Le RP ID, le nom RP, la liste d'origines et le secret HMAC doivent encore être vérifiés dans l'environnement Cloudflare ; `WEBAUTHN_ROOT_ENROLLMENT_ENABLED` reste absent/fermé ; la migration 0007 est appliquée à D1 distante.
6. Tests CI et build non confirmés.

## 6. Conditions avant test utilisateur ou production

- Revue du code et exécution réussie des tests de l'enrôlement.
- Configuration des origines et du RP ID réels.
- Application contrôlée de la migration 0007 après validation de l'environnement D1.
- Essais réels sur plusieurs téléphones Android/versions Chrome, y compris annulation, perte réseau et répétition.
- Implémentation et tests du parcours d'assertion WebAuthn pour les connexions suivantes.
- Intégration obligatoire du contrôle de session à chaque route privée avant l'ouverture des fonctions métier.

Aucun changement de ressource Cloudflare ni migration distante n'a été effectué pendant la vérification du 20 novembre ; la migration 0007 était déjà appliquée. Le déploiement Pages `0931949` a terminé avec succès.


## Mise à jour corrective — 21 novembre 2026

Le parcours d'authentification a été raccordé après la constatation d'une rupture entre la connexion et l'enrôlement initial :

- Le client tente d'abord une reconnexion WebAuthn. Si le serveur confirme qu'aucune racine n'existe pour ce compte, il propose le parcours distinct d'enrôlement initial.
- Les comptes avec un appareil révoqué ou une credential manquante sont refusés ; ils ne sont pas redirigés silencieusement vers un nouvel enrôlement.
- L'assertion de reconnexion refuse désormais BE, BS, ED, AT et les bits réservés, en plus d'exiger UP et UV.
- La politique des flags est isolée dans `src/domain/webauthn-assertion-policy.ts`, couverte par des tests et appelée par l'endpoint.
- Les tests de routage premier appareil et de flags sont enregistrés dans `package.json` et le workflow CI.

**Limite de l'activation de production :** le parcours est raccordé dans le code, mais le verrou `WEBAUTHN_ROOT_ENROLLMENT_ENABLED` n'a pas été activé sur Cloudflare. La configuration de production observée ne contient pas `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ALLOWED_ORIGINS` ni `EMAIL_OTP_HMAC_SECRET`. En outre, l'inscription e-mail exige `BREVO_API_KEY`, `BREVO_FROM_EMAIL` et `BREVO_FROM_NAME`, tous absents/vides dans la configuration lue. Aucune inscription réelle ne peut donc être finalisée à ce stade. Ne pas déclarer la connexion activée en production.

La validation indépendante du vérificateur WebAuthn et un essai sur téléphone Android restent requis avant l'ouverture du verrou. L'attestation `none` vérifie le protocole et la possession ultérieure de la clé, mais ne constitue pas une attestation du fabricant ni une preuve de matériel certifié.

La CI la plus récente pour le code de connexion initiale (`44836242596`) a réussi typecheck, migration D1 locale, build et audit des dépendances. Le workflow contenant les nouveaux tests de routage et de flags (`44836513513`) est en attente/en cours et doit être vérifié avant toute déclaration finale.
