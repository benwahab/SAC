# SAC — Décision d'architecture proposée : racine PWA, WebAuthn et clés natives

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** proposition d'architecture à valider ; aucune activation de racine, cérémonie, migration ou intégration native.  
**Objet :** choisir une approche réaliste qui conserve la PWA comme porte d'entrée sans prétendre qu'une clé logicielle de navigateur offre les garanties d'une clé matérielle.

## 1. Décision centrale proposée

Ne pas utiliser une clé privée Web Crypto stockée dans IndexedDB comme autorité racine SAC.

Pour une racine créée depuis la PWA, étudier **WebAuthn avec authenticator plateforme, vérification utilisateur obligatoire et credential non éligible à la sauvegarde/synchronisation**. Le serveur doit contrôler les indicateurs d'éligibilité à la sauvegarde et d'état de sauvegarde dans les données authenticator : `BE=0` et `BS=0`.

Cette règle permet de distinguer une credential single-device d'une credential multi-device selon WebAuthn. Elle ne permet pas d'affirmer, à elle seule, que la clé est dans un composant StrongBox, TEE ou Secure Enclave. Le niveau doit donc être nommé « authenticator lié à un appareil, non synchronisable selon les indicateurs WebAuthn vérifiés », et non « matériel certifié ».

Si le produit exige une preuve matérielle explicite, la PWA seule ne doit pas créer la racine : un parcours natif avec attestation validée par le serveur sera nécessaire.

## 2. Comparaison des quatre options

| Option | Ce que le serveur peut établir | Limite importante | Décision proposée |
|---|---|---|---|
| Web Crypto non extractible | L'API n'autorise pas l'export direct de la clé | Ne prouve ni authenticator dédié, ni anti-synchronisation, ni matériel | Refuser comme racine |
| WebAuthn plateforme, BE=0, BS=0, UV requis | Assertion signée par credential liée à son authenticator ; présence/vérification utilisateur selon flags | N'identifie pas à elle seule StrongBox/TEE/Secure Enclave | Candidat PWA, sous tests réels |
| Android Keystore avec attestation vérifiée | Clé et propriétés attestées ; niveau Software/TEE/StrongBox distinguable | Disponibilité, chaîne, révocation, état OS et politiques doivent être contrôlés | Candidat natif Android |
| iOS Secure Enclave + App Attest | Clé App Attest créée dans Secure Enclave et attestation de l'instance d'app validée par serveur | Native uniquement ; App Attest atteste une clé d'intégrité d'app, pas automatiquement la clé métier SAC | Candidat natif iOS |

## 3. Parcours PWA proposé : WebAuthn

### 3.1 Création de la racine

Le serveur initie l'enregistrement WebAuthn avec :
- challenge aléatoire à usage unique, lié au compte et à la cérémonie ;
- RP ID et origine SAC exacts ;
- authenticator plateforme exigé ;
- credential discoverable si nécessaire au parcours retenu ;
- `userVerification = required` ;
- politique d'attestation explicitement définie après étude de compatibilité et de confidentialité.

Le serveur vérifie notamment :
- challenge exact, non expiré et non consommé ;
- type de cérémonie, origine et RP ID ;
- signature et chaîne/format d'attestation selon la politique retenue ;
- flags UP et UV ;
- flag BE à zéro et flag BS à zéro ;
- algorithme et clé publique autorisés ;
- absence de réutilisation de l'identifiant credential dans un autre compte ;
- toute extension réellement utilisée, sans accepter d'extensions inconnues comme preuve.

Si BE vaut 1, la credential est multi-device et doit être refusée comme racine V1 dans cette proposition, même si BS vaut actuellement 0 : elle reste éligible à la sauvegarde. Si BE=0 et BS=0, le credential est single-device selon le modèle WebAuthn.

### 3.2 Approbation d'une cérémonie secondaire

Attention : une assertion WebAuthn ne signe pas directement les octets arbitraires du transcript comme une signature ECDSA P-256 classique. WebAuthn signe les données authenticator et le hash du clientDataJSON ; le challenge WebAuthn doit donc engager sans ambiguïté le hash du transcript SAC et le domaine d'approbation racine.

Le protocole doit définir un adaptateur WebAuthn :
1. calcul du hash du transcript canonique SAC ;
2. construction d'un challenge WebAuthn non ambigu et lié à la cérémonie ;
3. vérification serveur de l'assertion, de l'origine, du RP ID, du challenge, des flags UV/UP, du credential et de son état ;
4. conservation des octets utiles et du résultat de vérification dans la preuve d'approbation ;
5. invalidation atomique du challenge après succès.

Le nouvel appareil doit également pouvoir vérifier que la preuve racine correspond au transcript qu'il a affiché. Cette vérification hors serveur doit être spécifiée : données exactes signées, origine attendue, RP ID, format de clientDataJSON, flags et signature. Ne pas supposer que le simple retour « succès » du serveur suffit à l'appareil secondaire.

Les domaines de signature proposés dans l'annexe cryptographique doivent être adaptés à cette preuve WebAuthn ; ils ne peuvent pas être réutilisés tels quels sans spécification du challenge.

### 3.3 Politique d'attestation

L'attestation WebAuthn peut révéler des informations d'authenticator et créer des risques de corrélation. Pour une PWA grand public, commencer par évaluer une politique `attestation: none` et les garanties réellement vérifiables qui restent disponibles.

Si SAC exige une preuve d'authenticator précis, il faut une politique d'attestation plus stricte, des racines de confiance maintenues, des vérifications de révocation et une matrice de compatibilité. Cette exigence peut exclure des authenticator courants. Ne pas confondre authenticator plateforme, credential non synchronisable et preuve matérielle certifiée.

## 4. Android natif

Pour les appareils Android où la PWA/WebAuthn ne fournit pas le niveau de preuve souhaité, un futur client natif peut générer une clé de signature dans Android Keystore.

Le serveur doit vérifier l'attestation de clé, et pas accepter un simple champ client disant « StrongBox » ou « TEE ».

Contrôles minimums à spécifier :
- chaîne de certificats jusqu'à une racine de confiance connue ;
- challenge d'attestation égal au challenge serveur de la cérémonie ;
- correspondance entre clé attestée et clé publique enregistrée ;
- `attestationSecurityLevel` et `keyMintSecurityLevel` ;
- propriétés de la liste `hardwareEnforced` nécessaires ;
- état Verified Boot, verrouillage du bootloader, version OS et niveau de correctif selon politique ;
- vérification de révocation et gestion des changements de racines ;
- politique claire : StrongBox seulement, TEE accepté, ou refus ;
- restrictions d'usage et présence/vérification locale si exigées.

**Recommandation produit :** ne pas exiger StrongBox pour tous les Android en V1. Prévoir un profil minimum explicitement défini et attesté (par exemple TEE vérifié), et enregistrer StrongBox comme niveau supérieur lorsque disponible. La valeur exacte de la politique reste à valider avec une revue sécurité et une matrice d'appareils.

L'attestation Android doit être vérifiée côté serveur ; le client ne doit jamais s'auto-attribuer un niveau de confiance.

## 5. iOS natif

Deux éléments distincts doivent être traités :

**Clé métier SAC dans Secure Enclave**
- génération locale P-256 ;
- clé privée non exportable ;
- signature ou accord de clé selon l'usage ;
- disponibilité matérielle contrôlée ;
- la clé publique correspondante devient la clé d'identité SAC.

**App Attest**
- atteste une clé liée à l'instance de l'application et générée dans Secure Enclave ;
- le serveur vérifie l'objet d'attestation, le challenge, l'identité d'application, la clé publique et les assertions ultérieures ;
- fournit un signal de légitimité/intégrité de l'application et de son environnement.

Ne pas supposer qu'App Attest atteste automatiquement la clé métier SAC distincte générée via CryptoKit. Si SAC veut une attestation directe de cette clé métier, le mécanisme doit être conçu et prouvé séparément. App Attest reste un signal complémentaire d'intégrité d'app, pas un substitut implicite à la preuve de possession de la clé métier.

## 6. Modèle de confiance commun

Le serveur doit stocker un profil vérifié et versionné, par exemple :
- `credential_provider` : `webauthn_platform`, `android_keystore`, `ios_secure_enclave` ;
- `assurance_level` : valeurs contrôlées définies par la politique SAC ;
- `backup_eligible` et `backup_state` uniquement pour WebAuthn ;
- `hardware_security_level` uniquement si l'attestation le prouve ;
- `user_verification_required` et preuve correspondante ;
- `attestation_status`, version du validateur et date de vérification ;
- identifiant de credential/key et empreinte publique ;
- état de révocation.

Ces valeurs sont dérivées des preuves vérifiées côté serveur. Aucun champ envoyé par le navigateur ou l'application ne peut à lui seul établir le niveau.

La racine demeure unique par compte et irremplaçable en V1, conformément aux décisions produit existantes. Une credential révoquée ou perdue ne peut pas être restaurée par e-mail, OTP, mot de passe ou appareil secondaire.

## 7. UX et compatibilité

- Si le navigateur ne prend pas en charge le profil exigé, expliquer que cet appareil ne peut pas créer la racine ; ne pas rétrograder silencieusement vers Web Crypto.
- Si WebAuthn renvoie BE=1, refuser la racine PWA dans la politique proposée et expliquer que le credential est synchronisable.
- Si UV n'est pas fourni, refuser l'opération privilégiée.
- Les erreurs réseau ou indisponibilités d'attestation ne doivent jamais devenir des succès implicites.
- Les parcours natifs peuvent être proposés ultérieurement sans changer l'autorité métier : ils doivent produire un profil de preuve compris par le serveur.
- Les essais doivent couvrir les téléphones Android réellement utilisés au Niger, plusieurs navigateurs Android, iOS Safari/PWA et les parcours installés/non installés. Aucune compatibilité ne doit être présumée.

## 8. Essais et critères GO

Avant activation :
1. test WebAuthn sur chaque navigateur et appareil cible ;
2. vérifier BE/BS et UV avec authenticator réel, et vérifier que les valeurs ne viennent pas d'un champ client ;
3. confirmer que la credential single-device reste utilisable après fermeture/réouverture et redémarrage ;
4. tester suppression du credential, réinitialisation navigateur, restauration/synchronisation, changement de téléphone et perte de l'appareil ;
5. tester origine/RP ID incorrects, challenge expiré, challenge rejoué, signature altérée, mauvais compte et mauvais credential ;
6. tests Android de chaîne, challenge, niveau TEE/StrongBox, boot state, correctif et révocation sur appareils physiques ;
7. tests iOS App Attest et Secure Enclave sur appareils physiques, y compris réinstallation et restauration ;
8. vérifier l'approbation racine par le nouvel appareil sans faire confiance à une simple réponse serveur ;
9. revue indépendante de l'architecture et des vecteurs de preuve.

**NO-GO** si une plateforme ne fournit pas les propriétés exigées, si le serveur ne peut pas les vérifier, ou si l'appareil secondaire ne peut pas vérifier la preuve racine liée au transcript.

## 9. Conclusion et arbitrage à prendre

**Recommandation d'architecture :**
- PWA reste le produit et l'interface principale.
- La racine PWA utilise WebAuthn plateforme avec UV obligatoire et credential non synchronisable (BE=0, BS=0), si les essais réels confirment la compatibilité.
- Une clé Web Crypto non extractible seule n'est pas acceptée comme racine.
- Les clients natifs pourront offrir un profil de confiance attesté Android/iOS, sans prétendre que tous les appareils disposent de StrongBox ou d'une attestation équivalente.
- Aucun fallback logiciel silencieux.

Cette proposition conserve une voie PWA, mais ne promet pas une garantie matérielle uniforme sur tous les téléphones. Si le besoin produit est une preuve matérielle obligatoire sur chaque racine, alors la racine doit être native et attestée ; la PWA reste l'interface mais ne peut pas initialiser seule l'autorité.

**Arbitrage utilisateur requis avant le schéma définitif :** accepter le profil WebAuthn single-device (BE=0, BS=0, UV requis) comme niveau racine PWA, sans l'appeler matériellement certifié, ou exiger une attestation matérielle et réserver la création de racine aux clients natifs compatibles.

## 10. Références officielles

- W3C WebAuthn Level 3, recommandation 25 août 2026 : https://www.w3.org/TR/webauthn-3/
- W3C WebAuthn, credentials single-device / multi-device, BE et BS : https://www.w3.org/TR/webauthn/
- Android Key Attestation : https://source.android.com/docs/security/features/keystore/attestation
- Android Keystore hardware-backed attestation : https://developer.android.com/identity/digital-credentials/credential-issuer/keystore-attestation
- Apple Secure Enclave P-256 signing : https://developer.apple.com/documentation/cryptokit/secureenclave/p256/signing
- Apple App Attest : https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server
- Apple App Attest WWDC 2026 : https://developer.apple.com/videos/play/wwdc2026/201/

**Limite de preuve :** les références établissent les capacités documentées des standards et plateformes. Elles ne prouvent pas que les modèles de téléphones, navigateurs ou versions OS utilisés par les futurs testeurs SAC supportent le profil. Cette validation exige des essais physiques et un audit indépendant.
