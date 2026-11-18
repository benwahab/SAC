# SAC — Décisions actées et points à valider

Ce document évite de confondre une décision de l'utilisateur avec une proposition technique. Il doit être mis à jour à chaque validation.\n\nLa spécification de travail des transitions métier et de la conservation est centralisée dans [docs/MACHINES_ETATS_ET_CONSERVATION.md](MACHINES_ETATS_ET_CONSERVATION.md). Le registre des arbitrages non encore validés est dans [docs/DECISIONS_PRODUIT_RESTANTES.md](DECISIONS_PRODUIT_RESTANTES.md). La matrice des droits par acteur et ressource est dans [docs/MATRICE_AUTORISATION_ROLES.md](MATRICE_AUTORISATION_ROLES.md). Les contrats des opérations transactionnelles sont détaillés dans [docs/CONTRATS_OPERATIONS_ATOMIQUES_D1.md](CONTRATS_OPERATIONS_ATOMIQUES_D1.md). Les points marqués ouverts dans ces documents ne sont pas des décisions acquises.

## 1. Décisions actées

| Sujet | Décision |
|---|---|
| Nom | SAC — Sécurité, Alerte, Citoyenne |
| Logo | Aucun logo pour le moment |
| Couleurs | Pas de violet ; bleu nuit `#142B45`, rouge SOS `#D9273F`, blanc `#FFFFFF`, vert `#15966B`, gris clair `#E9EEF3` |
| Plateforme | PWA mobile-first en premier |
| Stack frontend | React + Vite + TypeScript + Tailwind CSS + Lucide React |
| Public | Toute la population |
| Destinataires | Les proches choisis et autorisés par l'utilisateur |
| Gratuit | Jusqu'à 2 contacts de confiance |
| Premium | 5 000 FCFA/mois, jusqu'à 10 contacts et options supplémentaires à définir |
| SOS essentiel | Reste gratuit |
| Catégories | Danger personnel, accident, intrusion au domicile, urgence médicale, personne perdue/désorientée, alerte personnalisée |
| Niveaux | Préventif, urgent, critique |
| SOS discret | Écran neutre après déclenchement ; code de contrainte dans SAC ou via raccourci écran verrouillé si faisable |
| Protection contre désactivation forcée | Tentative d'alerte discrète avant désactivation lorsque la plateforme le permet, sans garantie d'empêcher l'arrêt |
| Protection des trajets | Une fonction regroupée avec trois modes : vérification d'arrivée, accompagnement, protection complète |
| Rappels | Toutes les 5 minutes vers les contacts initiaux, jusqu'à la clôture par l'auteur ; aucun ajout automatique de contacts |
| Clôture | Seul l'auteur de l'alerte peut clôturer |
| Expiration des rappels | Ne clôture pas l'alerte |
| Répondant principal | Premier contact qui accepte la prise en charge ; promotion du volontaire suivant si retrait |
| Contacts | Invitation par téléphone ou e-mail, acceptation et vérification obligatoires ; invitation en attente sans accès ; révocation pour les nouvelles alertes |
| Destinataires | Instantané figé au déclenchement |
| Localisation | Partage soumis à autorisation ; fenêtres prévues : position ponctuelle, 15 minutes, 30 minutes, 1 heure ou jusqu'à clôture selon le parcours ; une position ancienne doit être datée et identifiée ; positions GPS précises conservées 30 jours après la fin du partage sous le contrôle de SAC ; les destinataires sont des proches de confiance et SAC ne cherche pas à effacer leurs copies locales |
| Backend / API | API REST séparée via Cloudflare Pages Functions (`functions/api/`), en TypeScript |
| Portabilité mobile | PWA d'abord ; préparation Capacitor pour Android/iOS sans réécriture |
| Adaptateurs appareil | Interfaces isolées dans `src/services/device/` |
| Collaboration IA | Claude et Qwen peuvent intervenir via les consignes partagées, sans changer la stack ni les conventions |
| Langues prévues | Français, Hausa, Zarma et anglais |
| SMS de secours | Prévoir un mécanisme SMS de secours lorsque l'accès Internet est indisponible, sous réserve des capacités réelles du terminal et du fournisseur |
| Notifications SOS | Push dans l'application en canal principal ; rappels toutes les 5 minutes ; SMS de secours après le nombre de rappels choisi par le lanceur pour chaque alerte, si aucun responsable principal n'est attribué |
| Groupes familiaux | Disponibles avec limites selon l'offre gratuite/Premium ; plafonds précis à valider |
| Base de données | Cloudflare D1 comme base relationnelle cible |
| Stockage fichiers | Cloudflare R2 si le service est activé et autorisé ; sinon préparer les interfaces/configurations sans prétendre qu'il est opérationnel |
| Phase actuelle | Socle technique initial créé ; fonctionnalités métier à implémenter progressivement après validation de leur conception |
| Dépôt | `benwahab/SAC` |
| Branche | Une seule branche : `main` |
| Méthode | Tout le travail directement sur GitHub |

## 2. Règles confirmées sur les alertes

- L'accusé de réception (« J'ai reçu l'alerte ») est différent de la prise en charge (« Je prends la situation en charge »).
- Le premier volontaire devient répondant principal.
- Les autres contacts peuvent également intervenir.
- Si le principal se retire, le prochain volontaire devient principal.
- Si aucun autre contact ne se porte volontaire, l'alerte reste active sans répondant principal.
- Les contacts ne clôturent jamais l'alerte.
- Une annulation avant ou après transmission est tracée dans l'historique ; elle ne doit pas effacer les événements déjà survenus.
- Les rappels s'arrêtent uniquement à la clôture par l'auteur.
- L'arrêt des rappels n'est pas une preuve de résolution.
- Aucun nouveau destinataire n'est ajouté automatiquement après déclenchement.

## 3. Propositions techniques — non encore validées comme choix définitifs

- Définir le schéma D1, les migrations versionnées et les règles d'accès côté Pages Functions.
- Définir le mécanisme d'authentification compatible avec l'architecture Cloudflare, sans fournisseur choisi à ce stade.
- Utiliser Web Push pour la PWA, puis étudier FCM/APNs pour des applications natives.
- Étudier OpenStreetMap ou un fournisseur cartographique équivalent.
- Utiliser une file de tâches côté serveur pour rappels et alertes différées.
- Mettre en place un modèle outbox/idempotence pour les notifications.
- Isoler les prestataires SMS et paiement derrière des adaptateurs.

Ces éléments sont des recommandations d'architecture, pas des engagements de fournisseur.

## 3.1 Étude de sécurité GPS — état au 17 novembre 2026

L'étude comparative est versionnée dans [SECURITE_GPS_DESTRUCTION_CRYPTO.md](SECURITE_GPS_DESTRUCTION_CRYPTO.md). Elle écarte Durable Objects comme coffre de clés indépendant en raison de sa propre restauration temporelle. Google Cloud KMS et AWS KMS restent des candidats non sélectionnés ; leurs délais de destruction réversible doivent être démontrés compatibles avec l'échéance J+30.

Aucun fournisseur, compte externe, coût, intégration ou calendrier de destruction n'est validé à ce stade. La prochaine validation technique porte sur la preuve qu'une clé GPS arrivée à échéance ne peut être réactivée par une sauvegarde ou une restauration administrative. Le stockage des coordonnées reste bloqué tant que cette preuve n'existe pas.

## 4. Points à valider avant développement ou lancement

1. **Rappels :** confirmer les détails d'interface sans modifier la règle actée de répétition toutes les 5 minutes jusqu'à clôture.
2. **Protection des trajets :** délai avant alerte en cas d'absence de confirmation et nombre de relances.
3. **Premium :** liste précise des options supplémentaires incluses dans les 5 000 FCFA/mois.
4. **Groupes :** nombre maximal de groupes, membres, rôles et règles d'invitation.
5. **Paiement :** prestataire(s) acceptés au Niger, frais, renouvellement, remboursement et gestion des paiements échoués.
6. **SMS :** prestataire, coût et disponibilité restent à valider. La règle de bascule est actée : après le seuil de rappels push choisi par le lanceur. **Plage validée le 18 novembre 2026 : 1 à 5 rappels, avec 2 rappels (10 minutes) par défaut.**
7. **Données GPS :** fréquence d'échantillonnage et conception du chiffrement/destruction indépendante des clés ; la règle est décidée : aucune restauration ne doit rendre les positions expirées lisibles après 30 jours.
8. **Compte :** récupération après perte du téléphone, changement de numéro/e-mail et suppression du compte.
9. **SOS discret :** scénarios techniquement réalisables sur Android, iOS et PWA ; limites de permissions et de fonctionnement en arrière-plan.
10. **Base et hébergement :** choix définitif de l'infrastructure et localisation des données.
11. **Notifications :** politique de consentement, permissions, canaux de secours et affichage des échecs.
12. **Langues :** langues disponibles au lancement après le français.
13. **Administration :** rôles, support, accès exceptionnel aux données et audit.
14. **Cadre légal :** obligations de protection des données et conditions d'exploitation au Niger et dans les pays futurs.

## 5. Questions à ne pas trancher automatiquement

- Ne pas rendre le SOS essentiel payant.
- Ne pas promettre que le GPS fonctionne en continu lorsque la PWA est fermée.
- Ne pas promettre qu'un SMS sera envoyé ou reçu sans confirmation du fournisseur.
- Ne pas faire croire qu'une notification acceptée par un fournisseur a été lue.
- Ne pas permettre à un contact ou administrateur de clôturer arbitrairement l'alerte.
- Ne pas considérer la fin des rappels comme une résolution.
- Ne pas donner à un membre d'un groupe un accès automatique aux positions.
- Ne pas choisir un fournisseur de paiement, SMS ou base de données sans validation.

## 6. Historique des validations

| Version | Événement |
|---|---|
| 1.0 | Consolidation des décisions connues et des points ouverts dans le cadre du dépôt initial de la documentation. |
| 1.1 | Cahier des charges complété sur la portabilité Android/iOS, la stack TypeScript et la collaboration Claude/Qwen ; langues de référence harmonisées. |
| 1.2 | Rappels alignés sur la validation utilisateur : toutes les 5 minutes vers les contacts initiaux jusqu'à clôture ; détails du SOS discret et de la protection contre désactivation forcée consignés. |
| 1.3 | Architecture Cloudflare rétablie conformément au cahier des charges : Pages, Pages Functions, D1 et R2 sous réserve d'activation/autorisation. |
| 1.4 | Catégories d'alerte, vérification des contacts invités et fenêtres de partage de localisation harmonisées avec les décisions récupérées. |
| 1.5 | Conservation des positions GPS précises validée à 30 jours après la fin du partage, avec purge automatique définitive des données actives. |
| 1.6 | Exigence ferme : après 30 jours, aucune restauration de sauvegarde, D1 Time Travel, snapshot, export ou réplication ne doit permettre de récupérer ou rendre lisibles les coordonnées GPS expirées ; destruction cryptographique indépendante et non restaurable obligatoire. |
| 1.7 | Seuil d'escalade SMS validé : le lanceur choisit de 1 à 5 rappels push par alerte ; 2 rappels (10 minutes) sont présélectionnés. |

| 1.8 | Cadre de sécurité du changement de numéro/e-mail : séparation des canaux, OTP non assimilé à une preuve d'identité, continuité des relations et arbitrages de récupération consignés. |
| 1.9 | Politique OTP validée : e-mail comme canal standard pour les OTP SAC ; SMS réservé à l'escalade SOS ; aucun basculement OTP automatique vers SMS ; OTP e-mail ne remplace jamais la preuve de continuité ou la racine. |

Mettre à jour ce tableau à chaque nouvelle validation importante.


## 3.2 Décision de sécurité complémentaire — aucun KMS approuvé

L'étude complémentaire (voir [SECURITE_GPS_DESTRUCTION_CRYPTO.md](SECURITE_GPS_DESTRUCTION_CRYPTO.md)) ne valide aucun des candidats évalués pour garantir l'irréversibilité stricte au jour J+30. Les périodes réversibles Google/AWS KMS et les sauvegardes restaurables AWS CloudHSM sont incompatibles avec une affirmation non démontrée de destruction immédiate à l'échéance. Les secrets Workers ne sont pas un coffre de clés GPS prouvé. La sélection du fournisseur reste bloquée ; l'application devra néanmoins refuser côté serveur tout accès GPS à l'échéance, sans confondre ce verrou avec l'effacement irréversible.


## 3.3 Résultats de recherche supplémentaires — aucun fournisseur approuvé

L'évaluation documentaire a également examiné Fortanix DSM, HashiCorp Vault Transit et AWS External Key Store. Fortanix documente une restauration de cluster depuis sauvegarde ; Vault documente la sauvegarde/restauration de clés Transit ainsi que la restauration de snapshots Raft. Ces deux pistes ne prouvent donc pas l'impossibilité de réintroduire un état antérieur contenant une clé.

AWS XKS est une piste conditionnelle : AWS exécute les opérations avec une clé détenue par un gestionnaire externe et indique que la perte/suppression de cette clé rend le ciphertext irrécupérable. Cependant, AWS ne gère pas les clés externes ; toute la garantie dépend du gestionnaire choisi, de ses sauvegardes et de ses administrateurs. Aucun gestionnaire précis n'est validé.

Références détaillées et liens officiels : [SECURITE_GPS_DESTRUCTION_CRYPTO.md](SECURITE_GPS_DESTRUCTION_CRYPTO.md), section 9. Aucun fournisseur, compte ou intégration n'est autorisé par cette étude.


## 3.4 Audit ciblé des gestionnaires AWS XKS — aucun fournisseur approuvé

L'étude a examiné les caractéristiques documentées d'AWS XKS ainsi que les options Entrust nShield et Thales CipherTrust/CCKM.

- AWS XKS sépare le matériel de clé du stockage AWS, mais AWS laisse la disponibilité, la durabilité et la gestion des copies au gestionnaire externe ; les exigences de redondance impliquent des instances liées partageant les clés.
- Entrust nShield documente que la suppression logique d'une clé peut être annulée par restauration d'une sauvegarde. La destruction permanente implique la destruction de l'OCS protégeant la clé ou du Security World entier ; les cartes opérateur et sauvegardes doivent être neutralisées. La granularité individuelle et l'exploitation de ce modèle pour SAC ne sont pas prouvées.
- Thales CipherTrust documente des sauvegardes système restaurables qui contiennent les clés. La liaison à un HSM Root of Trust protège la restauration globale mais ne prouve pas l'effacement individuel à J+30.

Aucun produit n'est approuvé. Voir la section 10 de [SECURITE_GPS_DESTRUCTION_CRYPTO.md](SECURITE_GPS_DESTRUCTION_CRYPTO.md). Aucune ressource ni intégration externe n'a été créée.


## 3.5 Orientation utilisateur confirmée — périmètre de la rétention GPS

L'utilisateur confirme que les destinataires des alertes sont des personnes de confiance. L'exigence de protection et de rétention de 30 jours porte sur les données et clés sous le contrôle de SAC. Il n'est pas demandé à SAC de supprimer les copies éventuellement conservées par les contacts autorisés sur leurs propres téléphones.

Cette décision ne dispense pas SAC de chiffrer les échanges, de vérifier les destinataires, de respecter le consentement de localisation ni de retirer les autorisations pour les nouvelles alertes après révocation d'un contact.

L'architecture proposée est désormais : aucun historique GPS persistant côté serveur ; chiffrement local et clés natives liées à l'appareil ; relais chiffré vers les contacts autorisés. La suppression exacte à J+30 reste à démontrer lorsque le téléphone est éteint ou que le système suspend l'application. Cette proposition ne doit pas être présentée comme une garantie déjà acquise.


## 3.6 Prototype AES-GCM — validation technique limitée, non décision produit

Un module expérimental isolé `src/services/location/crypto.ts` et des tests automatisés ont été ajoutés pour vérifier le chiffrement authentifié AES-256-GCM des paquets, l'association cryptographique à un identifiant de session, le rejet d'un paquet altéré et la génération d'IV distincts.

Cette étape ne valide ni le stockage des clés sur Android/iOS, ni leur échange avec plusieurs contacts, ni le relais WebSocket, ni la conservation GPS, ni la destruction à J+30. Le module n'est pas relié à l'application et ne doit pas être utilisé avec de vraies coordonnées. Aucune ressource Cloudflare ni intégration fournisseur n'a été créée.

Le choix du protocole complet et de la politique J+30 reste ouvert jusqu'aux tests natifs et à la validation de l'échange de clés.

## 3.7 Prototype expérimental d'identité des clés de contact — 17 novembre 2026

Le module `src/services/location/key-exchange.ts` contient désormais :
- une paire ECDH P-256 non exportable pour l'accord de clé ;
- une dérivation de clé AES-GCM par destinataire via HKDF-SHA-256 ;
- une paire de signature ECDSA P-256 distincte ;
- un paquet liant l'identifiant du propriétaire à sa clé publique ECDH, signé par sa clé d'identité ;
- une vérification de signature et des tests contre la modification de l'identité ou la substitution de la clé ECDH ;
- une fonction d'empreinte SHA-256 de la clé publique d'identité, présentée en groupes lisibles pour comparaison indépendante.

**Cérémonie de vérification proposée (à valider avant intégration produit) :**
1. Après acceptation d'une invitation et vérification du numéro/e-mail, chaque appareil crée sa paire de signature d'identité et sa paire ECDH ; les clés privées restent locales et non exportables.
2. Le paquet public signé est transmis au contact. L'application affiche l'empreinte de la clé d'identité, mais ne la considère pas vérifiée simplement parce qu'elle vient du serveur.
3. Les deux proches comparent leurs empreintes par un canal indépendant : idéalement en personne, ou par appel vocal/vidéo où chacun lit les groupes de chiffres/lettres. Un QR affiché sur un appareil et scanné par l'autre est pratique en personne, mais le QR seul ne suffit pas si son origine n'est pas authentifiée.
4. Chaque côté confirme explicitement la correspondance. L'application enregistre localement et côté serveur l'état de vérification, l'empreinte approuvée, la version de clé et la date ; le serveur ne peut pas fabriquer une signature valide ni remplacer silencieusement une empreinte déjà approuvée.
5. Toute nouvelle clé, réinstallation ou récupération de compte déclenche un état « identité à revérifier » : pas de remplacement silencieux de la clé de confiance. Les contacts reçoivent une notification de changement et doivent revérifier avant un nouvel échange de position chiffrée.

**Règles de cycle de vie proposées :** rotation = nouvelle clé ECDH signée par la clé d'identité déjà approuvée ; révocation = invalidation serveur immédiate des anciennes clés pour les nouveaux partages et notification aux contacts ; perte de la clé d'identité = réauthentification forte et nouvelle vérification indépendante par les contacts. La récupération ne doit jamais reconstituer une confiance cryptographique à partir d'un simple SMS ou e-mail. Les alertes SOS restent indépendantes de la disponibilité du chiffrement GPS : une erreur de clé ne doit pas bloquer l'alerte essentielle.

**Limite fondamentale :** la signature vérifie que le paquet a été signé par la clé d'identité qu'il contient ; elle ne prouve pas que cette clé appartient réellement au contact attendu. L'empreinte doit être comparée indépendamment puis épinglée comme référence de confiance. Les procédures de récupération, rotation, révocation multi-appareils et gestion des conflits restent à spécifier et tester.

Le prototype n'est pas connecté à l'application, n'échange aucune vraie position et ne constitue pas un protocole de production. Le commit `0c6dd00` a passé typecheck, les 15 tests crypto, build et audit des dépendances de production. L'audit complet reste signalé : 11 vulnérabilités élevées dans des dépendances de développement (notamment picomatch et sa chaîne de dépendances). Les nouveaux tests d'empreinte du commit `0f83c11` sont validés : 18 tests réussis, 0 échec, typecheck et build réussis (CI run `44189940721`). L'audit complet des dépendances reste non bloquant dans le workflow, mais signale 11 vulnérabilités élevées dans des dépendances de développement ; elles restent à traiter sans mise à niveau forcée ni migration majeure non validée.


## 3.8 Décision produit — plusieurs appareils autorisés pour un même compte

**Décision produit validée :** un utilisateur SAC peut enregistrer et utiliser plusieurs appareils sous un seul compte. Un appareil supplémentaire n'est pas un nouvel utilisateur et ne crée pas une nouvelle relation de contact. Aucun plafond numérique arbitraire n'est fixé dans cette première décision ; une limite éventuelle devra être justifiée par la sécurité, les coûts et l'expérience utilisateur.

### Règles obligatoires

1. Chaque téléphone, tablette ou installation native/PWA possède un identifiant d'appareil opaque, une session propre et un statut individuel : en attente de vérification, actif ou révoqué.
2. Chaque appareil génère localement ses propres clés privées de signature et d'échange. Les clés privées ne sont jamais copiées depuis un autre appareil, envoyées au serveur, incluses dans une sauvegarde SAC ou transférées par simple synchronisation de compte.
3. Le serveur conserve uniquement les métadonnées nécessaires : identifiant opaque, type de plateforme, libellé choisi par l'utilisateur, dates d'enregistrement/dernière activité, statut, empreintes et clés publiques, version de clé et informations de révocation. Aucun secret privé.
4. L'ajout d'un appareil exige une authentification forte et une approbation explicite. Si un appareil déjà approuvé est disponible, il autorise le nouvel appareil par une procédure de jumelage cryptographique vérifiée ; un OTP seul ne suffit pas à restaurer la confiance GPS.
5. Une nouvelle installation, une réinitialisation ou une récupération de compte ne récupère jamais silencieusement les clés privées de l'ancien appareil. Si aucun appareil approuvé n'est disponible, le compte peut être récupéré selon la procédure d'authentification qui sera retenue, mais la nouvelle identité cryptographique doit être réapprouvée indépendamment par les contacts avant tout nouveau partage GPS.
6. L'utilisateur peut consulter ses appareils, renommer un appareil et révoquer un appareil perdu ou inutilisé. La révocation côté serveur invalide immédiatement les sessions et autorisations serveur de cet appareil et interdit les nouveaux partages utilisant ses clés révoquées.
7. Un appareil révoqué qui est hors ligne ne peut pas recevoir un ordre d'effacement à distance. La révocation serveur ne doit donc jamais être présentée comme la preuve que les données ou clés déjà présentes physiquement sur cet appareil ont été effacées.
8. Les alertes SOS et leur transmission restent indépendantes de la disponibilité du chiffrement GPS. Une erreur de jumelage ou de clé ne doit pas empêcher l'envoi d'une alerte essentielle par un appareil encore authentifié et autorisé.
9. Les alertes et actions restent attribuées au compte utilisateur, mais les événements de sécurité et les sessions identifient précisément l'appareil qui a réalisé l'action.
10. Les notifications push sont enregistrées par appareil et leur révocation/désinscription est indépendante des autres appareils du compte.

### Modèle cryptographique à concevoir avant intégration

La piste à étudier est une identité de compte racine distincte des clés opérationnelles de chaque appareil. En V1, seul le premier appareil racine approuve les clés publiques propres aux appareils secondaires ; aucun appareil secondaire ne peut certifier l'ajout d'un autre appareil. Chaque appareil garde ses clés privées localement. Si la clé racine et tous les appareils approuvés sont perdus, une récupération de compte ne restaure pas cette confiance : une nouvelle identité doit être créée et les contacts doivent la vérifier à nouveau par un canal indépendant.

Ce modèle est une proposition de protocole, pas une implémentation approuvée. Il faut spécifier les formats de certificats, l'authentification de l'appareil approbateur, le rejeu, la révocation, la rotation, les appareils simultanément hors ligne, les conflits d'ajout et la récupération avant de connecter le prototype ECDH/ECDSA à l'application.

### Comportement fonctionnel attendu

- Écran « Mes appareils » dans les paramètres de sécurité.
- Pour chaque appareil : nom, type, date d'ajout, dernière activité, statut et action de révocation.
- Confirmation renforcée avant révocation ; afficher clairement que l'appareil hors ligne ne sera pas effacé à distance.
- À la connexion d'un nouvel appareil : parcours « Ajouter un appareil » ou « Récupérer mon compte », sans confusion entre récupération d'accès au compte et récupération des clés GPS.
- Aucun partage automatique de l'historique GPS local d'un appareil vers un autre.
- Un nouvel appareil ne voit les anciennes archives GPS que si un mécanisme explicite, compatible avec la règle stricte J+30, est ultérieurement conçu et validé. Par défaut, les anciennes clés et archives restent liées à leur appareil d'origine.

**État :** décision produit multi-appareils validée par l'utilisateur le 17 novembre 2026 ; protocole cryptographique, UX, API, stockage et tests restent à concevoir. Aucun écran, endpoint ou migration n'est déclaré implémenté par cette décision.


## 3.9 Protocole multi-appareils — proposition technique à valider

La proposition détaillée est consignée dans [PROTOCOLE_MULTI_APPAREILS.md](PROTOCOLE_MULTI_APPAREILS.md). Elle étudie une clé d'identité racine conservée sur le premier appareil, qui signe les certificats des appareils secondaires ; les clés privées propres aux appareils restent locales. Dans cette première piste, seul l'appareil racine approuve les ajouts. La perte de la racine sans appareil approuvé impose une nouvelle identité et une revérification indépendante par les contacts.

**Décision validée par l'utilisateur le 17 novembre 2026 :** le premier appareil approuvé est l'unique appareil racine autorisé à approuver les nouveaux appareils. Les appareils secondaires ne peuvent pas approuver d'autres appareils dans la première version. En cas de perte de tous les appareils approuvés, la récupération du compte ne restaure pas l'ancienne identité cryptographique : une nouvelle identité est créée et les contacts doivent vérifier indépendamment sa nouvelle empreinte avant tout nouveau partage GPS. La conséquence acceptée est un point unique d'approbation et une dépendance à l'appareil racine. Cette validation produit ne vaut pas validation cryptographique indépendante et n'autorise pas encore à connecter les clés au GPS réel ; le transcript signé, l'UX de jumelage, les API et les tests adversariaux restent à spécifier.


### Révocation multi-appareils — contrat à implémenter

La proposition de contrôle transactionnel est détaillée dans [PROTOCOLE_MULTI_APPAREILS.md, section 19](PROTOCOLE_MULTI_APPAREILS.md). La révocation doit invalider les sessions, jetons de rafraîchissement, push, défis de jumelage et partages GPS liés à l'appareil, avec contrôle de statut courant à chaque requête protégée. La révocation du root bloque les nouvelles approbations et les partages GPS jusqu'à une nouvelle identité racine et la revérification indépendante des contacts.

**État :** exigences de sécurité consignées ; aucun endpoint, schéma D1, mécanisme de session ou tâche de notification n'est encore implémenté. Les appareils hors ligne ne peuvent pas être effacés à distance.


## 7. Parcours de déclenchement SOS — deux accès validés

La proposition détaillée est consignée dans [PARCOURS_DECLENCHEMENT_SOS_V1.md](PARCOURS_DECLENCHEMENT_SOS_V1.md). Elle reprend les catégories, niveaux, préférences de contacts, l'autorisation de localisation facultative et le réglage validé de 1 à 5 rappels (2 par défaut).

**Décision validée le 18 novembre 2026 : les deux parcours coexistent.**
- SOS principal guidé : écran compact pour choisir la catégorie et le niveau avant l'envoi.
- SOS critique immédiat : accès distinct déclenchant une alerte critique avec catégorie et destinataires préconfigurés, sans seconde confirmation générique. Il nécessite une configuration préalable valide.

**Décision validée le 18 novembre 2026 — destinataires ponctuels :** dans le parcours guidé, l'auteur peut retirer des destinataires préconfigurés et ajouter, pour cette alerte seulement, d'autres contacts de confiance dont la relation est active, l'invitation acceptée et le moyen de contact vérifié. Cette sélection ponctuelle peut déroger aux préférences habituelles de catégorie sans les modifier. Les limites de l'offre restent applicables. Le raccourci SOS critique immédiat conserve sa liste préconfigurée et ne propose pas de modification à la volée. La liste finale est vérifiée puis figée atomiquement à la création ; aucune modification ultérieure ne réécrit les destinataires ou les rappels de l'alerte.

Restent à arbitrer : le comportement lorsqu'aucun contact éligible n'est configuré et le comportement du seuil SMS lorsque le fournisseur n'est pas opérationnel. Dans les deux parcours, aucune transmission ne doit être annoncée sans confirmation réelle du serveur. Le blocage GPS J+30 reste absolu ; aucune position réelle ne doit être collectée ou persistée avant preuve de destruction irréversible.


### 7.1 Continuité du responsable principal — proposition à valider

- La perte de connexion, l'extinction du téléphone, la suspension de la PWA ou le silence ne déclenchent pas de retrait automatique. SAC affiche uniquement la dernière activité confirmée côté serveur ; il ne prétend pas connaître la disponibilité réelle.
- Le responsable principal se retire explicitement. Le serveur termine sa période et promeut atomiquement le volontaire admissible le plus ancien selon l'ordre serveur.
- Sans volontaire disponible, l'alerte reste active sans responsable principal ; les rappels continuent vers les destinataires initiaux.
- L'ancien responsable ne récupère pas automatiquement son rôle à la reconnexion.
- Aucun délai d'abandon automatique ni présence temps réel n'est prévu dans la V1.

**Statut :** proposition de conception, pas encore décision produit validée. Voir `docs/PARCOURS_DECLENCHEMENT_SOS_V1.md` et `docs/CONTRATS_OPERATIONS_ATOMIQUES_D1.md`.


### 7.2 Interventions simultanées de plusieurs contacts — proposition à valider

Les règles suivantes complètent les décisions déjà actées (un seul responsable principal à la fois, rappels maintenus après prise en charge, clôture réservée à l'auteur). Elles ne deviennent pas des décisions produit tant qu'elles ne sont pas explicitement approuvées.

- Plusieurs contacts peuvent candidater. Le serveur attribue une séquence monotone aux candidatures acceptées ; une seule transition atomique peut créer le responsable principal. Les autres candidatures sont conservées comme non retenues et reçoivent un état explicite.
- Plusieurs proches peuvent déclarer leur arrivée sur place. Cette déclaration reste informative et ne donne pas automatiquement la responsabilité.
- Un contact peut signaler qu'il estime la situation résolue. Ce signalement ne clôture pas l'alerte, ne stoppe pas les rappels et ne bloque pas l'escalade SMS.
- Le responsable principal peut transmettre un compte rendu ou se retirer, mais ne peut pas clôturer à la place de l'auteur.
- La clôture par l'auteur et les commandes des contacts sont arbitrées sur l'état serveur courant. Après commit de la clôture, toute nouvelle commande de coordination est refusée ; les événements validés avant restent dans l'historique.
- Le journal métier est append-only, horodaté et séquencé côté serveur ; les commandes sont idempotentes. Les notifications de responsable sont émises uniquement après attribution confirmée.
- Les autres contacts voient les informations de coordination nécessaires, sans exposition de numéros, e-mails ou coordonnées privées.

**Arbitrages encore nécessaires avant implémentation :**
1. Valider les libellés finaux et les informations visibles aux autres destinataires (notamment prénom/nom choisi et statut).
2. Définir si un contact ayant signalé son arrivée peut également candidater immédiatement, ou si l'action « Je peux aider » reste séparée.
3. Définir la durée de conservation des comptes rendus et déclarations de résolution, ainsi que les limites de texte et la possibilité d'ajouter une pièce jointe (aucune pièce jointe proposée en V1 à ce stade).
4. Définir la règle d'admissibilité d'un volontaire lorsque sa relation est révoquée au même instant que sa candidature ou sa promotion.

**Garde-fou non négociable :** aucun contact, volontaire ou responsable principal ne peut clôturer l'alerte à la place de son auteur. Une déclaration « situation résolue » reste une déclaration humaine, pas une preuve vérifiée par SAC.


### 7.3 Révocation pendant une alerte active — proposition à valider

- La révocation prend effet selon l'ordre de commit serveur, jamais selon l'heure du téléphone ou une lecture préalable.
- Une candidature enregistrée avant la révocation reste dans l'historique mais ne peut plus être promue après celle-ci.
- Un contact révoqué ne peut plus recevoir une nouvelle attribution. Si la révocation intervient après son attribution comme responsable principal, sa période de responsabilité prend fin atomiquement et SAC cherche le volontaire actif admissible suivant.
- Une promotion concurrente doit revérifier la relation active dans la transaction finale. Si aucun volontaire admissible ne reste, l'alerte demeure active sans responsable principal.
- Les événements antérieurs valablement enregistrés ne sont pas supprimés ; la révocation et la fin éventuelle de responsabilité ajoutent des événements au journal.
- Après révocation, les nouvelles actions de coordination de ce contact sont refusées.

**Arbitrages à valider avant implémentation :**
1. Le contact révoqué conserve-t-il un accès en lecture au détail d'une alerte déjà active jusqu'à sa clôture, ou cet accès est-il coupé immédiatement ?
2. Les rappels push initialement prévus continuent-ils à être transmis à ce contact jusqu'à la clôture, ou la révocation bloque-t-elle les prochaines transmissions ? Les notifications déjà acceptées peuvent rester livrables.
3. Si le contact révoqué est responsable principal, la promotion automatique du volontaire admissible suivant est-elle approuvée, ou faut-il laisser l'alerte sans responsable jusqu'à une nouvelle candidature explicite ?
4. Les règles sont-elles identiques lorsque la relation est révoquée par son propriétaire et lorsqu'un contact retire lui-même son acceptation ?

**Statut :** proposition de sécurité et de coordination, non décision produit acquise. L'instantané initial n'est jamais réécrit et seul l'auteur conserve le droit de clôture.


### 7.4 Accès et notifications après révocation — recommandation à arbitrer

Le choix le plus protecteur proposé est une coupure immédiate des nouvelles autorisations du contact révoqué, y compris pour une alerte déjà active, sans effacer l'instantané historique.

**Comportement recommandé (non validé) :**
- aucune nouvelle lecture des détails de l'alerte après commit de révocation ;
- aucune nouvelle action de coordination ;
- aucune nouvelle tâche push/rappel réclamée par un worker après la révocation ;
- une notification déjà acceptée par le fournisseur peut encore arriver ; son ouverture refait obligatoirement un contrôle d'accès ;
- l'auteur conserve l'historique complet ; le contact révoqué ne reçoit pas les événements de coordination postérieurs ;
- une réinvitation crée une nouvelle relation et ne rouvre pas l'accès aux anciennes alertes.

La révocation par le propriétaire et le retrait d'acceptation par le contact doivent être tracés comme deux causes distinctes, mais il est proposé qu'ils aient le même effet immédiat sur les autorisations futures.

**Pourquoi cette proposition :** elle évite qu'un ancien proche conserve un accès actif simplement parce que son identifiant figure dans l'instantané initial, tout en préservant la chronologie et les preuves d'envoi déjà confiées au fournisseur.

**Décisions explicites encore nécessaires :**
1. Approuver ou refuser la coupure immédiate de lecture sur les alertes déjà actives.
2. Approuver ou refuser l'arrêt des futurs rappels push à ce contact après révocation.
3. Confirmer que retrait d'acceptation par le contact et révocation par le propriétaire ont le même effet d'accès, malgré des causes d'audit différentes.
4. Confirmer la promotion automatique du volontaire admissible suivant lorsque le responsable principal est révoqué ; cette promotion ne doit jamais être effectuée si la relation du candidat n'est plus active au commit.

Aucune de ces propositions ne modifie l'instantané historique, les règles SMS déjà acceptées par le fournisseur ou le droit exclusif de l'auteur à clôturer.

### 3.10 Révocation d'un appareil — distinction avec le compte et les alertes (proposition à valider)

**Règle recommandée :** révoquer un téléphone révoque ce téléphone, pas la personne ni son compte.

- Révoquer un appareil secondaire invalide ses sessions, jetons et abonnements push uniquement. Les autres appareils actifs restent utilisables.
- Les contacts de confiance, l'abonnement, les alertes et les historiques du compte ne sont pas supprimés.
- L'instantané initial des destinataires d'une alerte active n'est jamais réécrit par une révocation d'appareil.
- Les notifications destinées au compte peuvent continuer sur les autres appareils actifs ; l'abonnement de l'appareil révoqué est exclu.
- Une notification déjà acceptée par le fournisseur peut encore arriver sur le téléphone révoqué ; l'accès au contenu est alors refusé par le contrôle serveur.
- Aucun effacement à distance des données/clés locales n'est garanti, surtout si l'appareil est hors ligne.

**Cas du premier appareil racine :** sa révocation bloque les nouvelles approbations et le partage GPS qui dépend de cette racine. Elle ne supprime pas le compte et ne révoque pas automatiquement les sessions des secondaires. Aucun secondaire ne devient racine automatiquement. Une nouvelle identité racine et une revérification indépendante des contacts sont nécessaires avant de rétablir la confiance GPS.

**Arbitrages à valider :**
1. Confirmer que les fonctions ordinaires non liées au GPS restent disponibles sur les secondaires actifs pendant la récupération de la racine.
2. Confirmer qu'une notification de compte reste distribuable aux autres appareils actifs après révocation d'un seul abonnement.
3. Confirmer que la réinscription du même téléphone exige toujours une nouvelle cérémonie et de nouvelles clés, sans réactivation de l'ancien certificat.
4. Définir les fonctions exactes bloquées pendant root_recovery_required, au-delà des approbations et du partage GPS.

Aucune décision ici ne permet d'effacer les données locales à distance, de contourner la racine ou de restaurer les anciennes clés GPS par une simple récupération de mot de passe.


### 3.11 Perte, vol et remplacement de l'appareil racine — proposition à arbitrer

**Décision déjà acquise :** la récupération de l'accès au compte ne restaure jamais l'ancienne identité cryptographique. Le premier appareil approuvé reste l'unique racine dans la première version ; un secondaire ne peut pas se promouvoir.

**Parcours proposé, non encore validé dans tous ses détails :**
- distinguer perte temporaire, vol/suspicion de compromission, panne/destruction et remplacement volontaire ;
- séparer récupération d'accès au compte et récupération cryptographique de la racine ;
- permettre à un secondaire actif d'initier une demande, sans auto-promotion, signature racine ni reprise GPS ;
- générer une nouvelle racine localement sur le nouvel appareil ; ne jamais restaurer ou transférer l'ancienne clé privée ;
- révoquer l'ancienne racine côté serveur lorsque la révocation est demandée et autorisée ; son retour en ligne ne peut pas annuler une révocation commitée ;
- demander aux contacts concernés de vérifier indépendamment la nouvelle empreinte avant toute reprise de partage GPS avec chacun ;
- conserver le compte, les contacts, les alertes, l'abonnement et l'historique ; ne pas révoquer automatiquement les sessions secondaires actives ;
- ne jamais prétendre effacer à distance les données d'un téléphone hors ligne ;
- préserver strictement la règle GPS J+30 : aucune récupération de compte ou de racine ne restaure une clé ou une archive GPS expirée.

**États proposés :** recovery_requested, recovery_pending_review, root_reestablished, recovery_refused, recovery_expired, recovery_cancelled. root_reestablished ne signifie pas que tous les contacts ont vérifié la nouvelle empreinte ; l'autorisation GPS reste distincte pour chaque relation.

**Courses proposées :** sérialisation par compte et époque racine ; une demande active par époque ; idempotence ; contrôle final de l'appareil et de la révocation dans la transaction ; une ancienne racine révoquée reste révoquée ; un secondaire révoqué pendant la procédure perd ses droits futurs ; notifications seulement après commit ; journal append-only sans secrets ni GPS.

**Arbitrages à prendre avant implémentation :**
1. Quels facteurs d'authentification renforcée autorisent la récupération d'accès et la demande de révocation urgente ? Aucun fournisseur ni facteur n'est choisi dans cette proposition.
2. La demande de récupération exige-t-elle une période d'attente, une validation humaine ou une combinaison ? Définir les délais et les protections anti-hameçonnage.
3. Quels contacts doivent confirmer la nouvelle empreinte : tous les contacts actifs, uniquement ceux avec lesquels le partage GPS doit reprendre, ou une règle par relation ? La proposition privilégie une vérification par contact et un GPS bloqué pour chaque contact non vérifié.
4. Que peut encore faire un appareil secondaire pendant root_recovery_required ? La proposition maintient les fonctions ordinaires indépendantes de la racine, mais bloque approbations et GPS.
5. Comment annuler une demande avant révocation, et que faire si la racine est déjà révoquée ? Une racine révoquée ne doit jamais être réactivée automatiquement.
6. Quelle durée d'expiration appliquer aux demandes et cérémonies ? Aucune durée n'est fixée sans validation.
7. Quelle procédure s'applique si tous les contacts concernés sont injoignables ou refusent la nouvelle empreinte ? Aucun contournement par support ou OTP n'est proposé.

**Verrou non négociable :** mot de passe, OTP, e-mail, session secondaire ou support ne peuvent pas se substituer à une signature de l'ancienne racine ni valider seuls la nouvelle identité. Aucune route API, migration D1, ressource Cloudflare ou intégration GPS/SMS n'est autorisée par cette section.


### 3.12 Protection contre la récupération frauduleuse du compte — proposition à arbitrer

**Règle ferme :** récupérer le mot de passe, recevoir un OTP SMS ou contrôler la boîte e-mail ne donne jamais l'autorité cryptographique racine. Aucun de ces facteurs ne peut réactiver une racine révoquée, approuver un appareil ou reprendre le partage GPS.

**Menaces couvertes dans la proposition :**
- échange frauduleux de SIM ou portage du numéro ;
- boîte e-mail compromise et détournement de lien de récupération ;
- vol, rejeu, devinette ou renvoi massif d'OTP ;
- vol de session ou rejeu d'un jeton de renouvellement ;
- hameçonnage et usurpation du support ;
- changement frauduleux du numéro de récupération ;
- énumération de comptes ;
- déni de service par épuisement de limites OTP ;
- tentative de récupération pendant une alerte active.

**Protections recommandées, non implémentées :**
1. Défis OTP/liens liés au compte, à la finalité et à une demande ; usage unique et consommation atomique.
2. Expiration et limites de tentatives/renvois à fixer après analyse, sans seuil arbitraire.
3. Stockage des vérificateurs non réutilisables ; protection serveur spécifique pour les OTP de faible entropie.
4. Réponses uniformes pour compte existant/inexistant afin d'éviter l'énumération.
5. Jetons de renouvellement rotatifs, détection du rejeu et sessions liées à un appareil.
6. Changement de numéro traité séparément, avec notification à l'ancien canal sûr et délai de protection à décider.
7. Le support ne reçoit jamais de secrets et ne peut jamais changer la racine, réactiver un certificat ou valider l'empreinte d'un contact.
8. Limites OTP distinctes du chemin SOS : IP partagée ou changement de réseau ne doit pas bloquer arbitrairement une vraie urgence depuis une session valide.
9. Journaux minimisés, sans OTP, liens complets, jetons, clés, QR complet ou GPS.

**Limite explicite :** SAC ne peut pas prétendre détecter un SIM swap sans signal fiable d'un opérateur ou d'un fournisseur effectivement intégré. Un OTP SMS prouve uniquement la réception du message à cet instant ; il ne prouve pas l'identité de la personne ni la possession de l'ancienne racine.

**Arbitrages nécessaires :**
1. Quels facteurs de récupération d'accès au compte sont acceptables et lesquels sont disponibles au Niger dans les conditions réelles d'usage ?
2. L'accès au compte récupéré révoque-t-il toutes les sessions, seulement la session suspecte ou aucune session tant qu'une revue n'a pas eu lieu ?
3. Quel délai de protection appliquer après changement de numéro, d'e-mail ou de mot de passe ?
4. Quels canaux de notification de sécurité sont considérés comme encore sûrs si l'e-mail ou le numéro est compromis ?
5. Quelle voie de recours proposer après épuisement des tentatives sans permettre au support de contourner la racine ?
6. Quels seuils OTP, renvois et limites par compte/destination/appareil fixer après essais réels et analyse anti-abus ?
7. Quelle durée de conservation et quels rôles d'accès appliquer aux événements anti-fraude ?

**Verrous :**
- Aucun SMS seul, e-mail seul, mot de passe seul ou support seul ne récupère la racine.
- Aucun signal de risque non confirmé ne doit bloquer silencieusement le SOS valide.
- Aucune détection SIM swap n'est annoncée sans intégration et preuve réelles.
- Aucun fournisseur, endpoint, quota chiffré, mécanisme de verrouillage, migration D1 ou intégration n'est autorisé par cette proposition.
## 3.8 Changement de numéro et d'adresse e-mail — cadre de sécurité (18 novembre 2026)

**Statut :** invariants de sécurité retenus pour la conception ; parcours détaillé et facteurs de récupération encore à arbitrer. Aucun fournisseur ni endpoint n'est autorisé.

### Invariants à respecter

- Le compte SAC conserve un identifiant interne immuable ; modifier le numéro ou l'e-mail ne crée pas un nouveau compte et ne transfère pas l'ancien compte au titulaire ultérieur d'une SIM réattribuée.
- Un OTP envoyé au nouveau numéro ou au nouvel e-mail prouve seulement le contrôle ponctuel de ce canal. Il ne prouve pas l'identité historique, la possession de l'ancienne SIM/boîte, ni la possession de la racine.
- Un OTP SMS/e-mail, une réinitialisation de mot de passe ou une action du support ne peut jamais remplacer ou recréer silencieusement la racine cryptographique.
- La perte de l'ancien canal n'autorise pas à envoyer des codes à l'ancienne destination ni à considérer deux nouveaux OTP comme une preuve suffisante.
- Les appareils révoqués restent révoqués ; un changement de coordonnées ne les réactive pas.
- Les relations de confiance existantes restent liées aux identifiants de compte, pas à la chaîne du numéro ou à l'adresse e-mail. Une invitation en attente vers l'ancienne coordonnée n'est jamais transférée ou acceptée automatiquement.
- Les coordonnées privées ne sont pas communiquées automatiquement aux contacts de confiance.
- Une modification de coordonnées ne réécrit pas les alertes actives, leurs destinataires figés, leur historique, les rappels push ou l'escalade SMS.
- Toute validation finale doit revérifier côté serveur la session, l'appareil, la racine, le challenge et la version de coordonnées courante.
- Le changement de racine et le changement de coordonnées sont deux procédures séparées. Si la récupération racine est en cours, les changements des canaux d'authentification/récupération sont bloqués jusqu'à une voie explicitement validée.

### Scénarios à spécifier

1. Changement volontaire avec accès à l'ancien numéro/e-mail et appareil approuvé.
2. Ancienne SIM perdue, détruite ou numéro devenu inaccessible.
3. Ancienne adresse e-mail inaccessible ou boîte compromise.
4. Soupçon de SIM swap ou de réattribution du numéro.
5. Perte simultanée du numéro et de l'e-mail.
6. Demande initiée depuis un appareil secondaire, une session volée ou un appareil dont la révocation est concurrente.
7. Changement pendant une alerte active ou une récupération racine.
8. Deux demandes concurrentes, contestation avant/après validation, challenge rejoué ou changement de destination pendant la vérification.

### Arbitrages obligatoires avant développement

- Facteur indépendant requis lorsque l'ancien canal est perdu : appareil racine, autre facteur fort préenregistré ou procédure de récupération déjà validée.
- Si l'ancien canal est disponible, déterminer s'il s'agit d'une simple notification ou d'une preuve supplémentaire, sans en faire une condition inaccessible en cas de perte.
- Délai de sécurité et période de contestation ; aucune durée n'est fixée arbitrairement.
- Conditions permettant de considérer l'ancien canal comme sûr ou compromis.
- Politique de révocation ciblée des sessions et appareils après un changement volontaire ou suspect.
- Ordre de priorité et nombre de numéros/e-mails vérifiés autorisés.
- Effet sur les préférences de notification, les coordonnées visibles aux contacts et les invitations en attente.
- Procédure en cas de numéro réattribué ; aucune détection automatique de SIM swap ne doit être prétendue sans signal fiable.
- Actions autorisées pendant une récupération racine et traitement d'une alerte active.

**NO-GO :** pas de changement autonome fondé uniquement sur un OTP du nouveau canal ; pas de récupération racine par SMS/e-mail ; pas d'implémentation avant résolution des arbitrages critiques.


## 3.9 Politique OTP à priorité e-mail (18 novembre 2026)

**Décision validée :** les codes OTP SAC sont envoyés par e-mail comme canal standard, y compris pour les vérifications liées à la connexion, à la réinitialisation du mot de passe, au changement de coordonnées et à la récupération d'accès lorsque le parcours utilise un OTP.

- Le SMS n'est pas un canal OTP standard. Il reste réservé à l'escalade SOS selon le seuil choisi par le lanceur.
- Aucun basculement automatique d'un OTP vers SMS n'est autorisé en cas d'échec ou d'indisponibilité de l'e-mail. Toute voie de secours doit être arbitrée séparément.
- Un OTP e-mail prouve uniquement le contrôle ponctuel de la boîte ; il ne prouve pas la continuité historique du compte, la possession de la racine ou l'approbation d'un appareil.
- Un changement d'e-mail exige la vérification de la nouvelle adresse et une preuve de continuité indépendante ; un nouveau canal seul ne peut pas prendre le contrôle du compte.
- La récupération d'accès au compte et la récupération cryptographique racine restent deux procédures séparées. L'e-mail seul ne rétablit jamais la racine.
- Le SOS ne dépend jamais de la réception d'un OTP e-mail.
- Aucun fournisseur, tarif contractuel, endpoint, quota, migration ou envoi réel n'est choisi ou autorisé par cette décision.

**À préciser avant implémentation :** facteurs de continuité lorsque l'ancien e-mail est inaccessible, délais et limites OTP, stratégie de délivrabilité, gestion des résultats fournisseur ambigus et procédure de secours sans SMS automatique.

**NO-GO :** aucun OTP réel ni fournisseur ne doit être activé avant spécification et tests ; aucune récupération racine ne peut reposer sur un OTP e-mail seul.


## 3.10 Perte d'accès à l'e-mail — parcours de récupération proposé (18 novembre 2026)

**Statut :** principes de sécurité proposés ; les facteurs de récupération, délais, recours et privilèges temporaires restent à arbitrer. Aucun fournisseur ni flux réel n'est autorisé.

### Principes retenus pour la conception

- Si un appareil approuvé encore sûr est disponible, privilégier une preuve cryptographique liée à cet appareil, puis vérifier la nouvelle adresse par OTP e-mail. La session seule et le nouvel OTP ne suffisent pas.
- Si aucun appareil approuvé n'est disponible, la possession d'une nouvelle adresse e-mail ou d'un numéro ne suffit pas à reprendre le compte historique. Il faut une méthode indépendante préalablement approuvée et testée.
- Une demande de récupération en attente n'est pas une récupération réussie et ne donne pas accès automatiquement aux données privées.
- Une boîte suspectée compromise ne reçoit aucun pouvoir de veto ni de validation privilégiée.
- Récupération d'accès au compte et récupération de la racine restent séparées. Aucune récupération d'accès ne restaure l'ancienne racine ou les clés GPS.
- Si aucune méthode indépendante n'est définie, le parcours doit refuser la prise de contrôle plutôt que prétendre vérifier l'identité.
- Aucun basculement automatique OTP vers SMS ; le SMS reste réservé à l'escalade SOS.

### Arbitrages ouverts

1. Quels facteurs indépendants sont acceptables si tous les appareils approuvés sont perdus ?
2. Les contacts de confiance peuvent-ils contribuer à la récupération d'accès, avec quelle preuve indépendante et quelles protections contre la collusion ou la coercition ?
3. Quel délai de sécurité, quelle période de contestation et quelle expiration des demandes ?
4. Quelles fonctions restent accessibles pendant l'attente ?
5. Quelles sessions/appareils sont révoqués après récupération et comment informer les appareils encore sûrs sans exposer les données ?
6. Que faire si tous les facteurs et appareils sont perdus et qu'aucune preuve indépendante n'est disponible ?

**NO-GO :** aucune récupération complète sur la seule base d'un nouvel e-mail, d'un OTP, d'un SMS, d'un mot de passe ou du support ; aucune récupération racine via ce parcours.


## 3.11 Rôle des contacts de confiance dans une récupération (18 novembre 2026)

**Recommandation de sécurité proposée :** les contacts de confiance ne doivent pas pouvoir récupérer directement le compte, remplacer l'adresse e-mail, réinitialiser le mot de passe, approuver un appareil ou restaurer la racine cryptographique à la place du titulaire.

Leur rôle est limité à une fonction distincte déjà prévue : vérifier indépendamment la nouvelle empreinte d'une identité cryptographique racine créée après perte de l'ancienne. Cette vérification s'applique relation par relation et ne donne pas au contact un pouvoir général sur le compte.

### Frontière proposée

- Un contact ne peut ni ouvrir une session au nom du titulaire, ni recevoir un code de récupération, ni choisir une nouvelle adresse e-mail, ni modifier les coordonnées du titulaire.
- Une déclaration « je reconnais cette personne » peut éventuellement être étudiée comme signal humain complémentaire, mais ne constitue jamais seule une preuve suffisante de continuité du compte.
- Les contacts ne doivent pas recevoir de secret, code OTP, clé privée, code de récupération ou accès temporaire au compte.
- Un contact ne peut pas approuver une nouvelle racine à la place d'un autre contact : chaque relation effectue sa propre vérification indépendante de l'empreinte avant reprise du partage GPS avec elle.
- La confirmation d'un contact ne réactive aucun appareil, ne retire aucune révocation et ne permet pas d'accéder aux alertes, historiques ou données privées du titulaire.
- Les contacts retenus doivent être ceux dont la relation était active avant l'ouverture de la récupération ; aucune relation ajoutée pendant la récupération ne peut renforcer la preuve.
- Les refus, silences, indisponibilités ou désaccords des contacts ne doivent pas être interprétés comme une preuve automatique de fraude ou comme une autorisation de contourner les contrôles.
- SAC ne doit pas révéler aux contacts les nouvelles coordonnées privées, les facteurs de récupération ou les réponses des autres contacts.

### Pourquoi cette séparation

Les proches peuvent reconnaître une personne, mais une relation sociale n'est pas une preuve technique de propriété du compte. Des contacts peuvent être injoignables, compromis, contraints, victimes d'ingénierie sociale ou agir de concert. Leur donner le pouvoir de récupérer le compte créerait un chemin de prise de contrôle par collusion ou coercition. Leur rôle le plus sûr reste la vérification indépendante de la nouvelle identité cryptographique, sans pouvoir de connexion ou de gestion du compte.

### Arbitrages restant ouverts

1. Faut-il autoriser une confirmation humaine facultative des contacts comme signal secondaire, sans effet autonome sur l'accès ?
2. Combien de contacts doivent vérifier la nouvelle empreinte pour chaque relation GPS, et quelle méthode indépendante est acceptable ?
3. Comment gérer les contacts injoignables, les refus, les conflits d'identité, les changements de numéro et les risques de coercition ?
4. Une procédure de récupération d'accès sans aucun appareil approuvé doit-elle reposer sur un facteur de récupération préenregistré ou une autre méthode indépendante, à définir et tester ?

**NO-GO :** aucune récupération de compte, changement de coordonnées, approbation d'appareil ou restauration racine ne peut être autorisée par un vote, un quorum ou une simple déclaration des contacts. Aucun quorum chiffré n'est adopté à ce stade.


## 3.12 Facteur indépendant préenregistré — kit de récupération hors ligne (18 novembre 2026)

**Statut :** proposition de conception à valider ; aucune génération, API, migration, interface ou récupération réelle n'est implémentée ou autorisée.

### Proposition recommandée

Prévoir un kit de récupération personnel créé pendant que le titulaire dispose encore d'un accès normal et vérifié à son compte. Le kit contient un secret aléatoire à forte entropie, généré avec un générateur cryptographiquement sûr sur l'appareil, présenté une seule fois et conservé hors de SAC. Il ne dépend ni du numéro de téléphone, ni de l'adresse e-mail, ni d'un appareil encore connecté.

- Le secret doit être généré localement ; il ne doit jamais être envoyé par e-mail/SMS, affiché de nouveau par le serveur ou conservé en clair dans la base.
- La représentation destinée à l'utilisateur doit être copiables et imprimable, avec checksum/détection d'erreur ; format et longueur restent à spécifier et à tester avec les utilisateurs.
- Recommander une conservation hors ligne dans un endroit privé et sûr, distinct du téléphone et de la boîte e-mail habituels. Une copie dans un gestionnaire de mots de passe indépendant peut être une option, mais ne doit pas être l'unique conseil.
- Le titulaire doit pouvoir régénérer le kit depuis une session et un appareil encore autorisés ; la régénération invalide atomiquement l'ancien secret et ne doit jamais être proposée pendant une récupération non authentifiée.
- Le serveur ne conserve qu'un vérificateur robuste du secret, jamais le secret brut. La méthode de dérivation/stockage, les paramètres et la protection des secrets serveur doivent être validés par revue sécurité avant implémentation.
- Le secret est à usage unique. Sa consommation doit être atomique, liée à une demande et à une version du compte, avec protection contre rejeu et demandes concurrentes.
- Après usage, le kit est invalidé ; le titulaire doit en créer un nouveau après avoir repris le contrôle du compte.

### Portée exacte

Le kit pourrait autoriser uniquement une procédure de récupération d'accès au compte : établir une nouvelle adresse e-mail par OTP, définir un nouveau mot de passe et appliquer une politique de révocation/réauthentification des sessions qui reste à arbitrer. Il ne doit jamais :

- restaurer l'ancienne racine cryptographique ou une clé privée perdue ;
- approuver un appareil ou promouvoir un appareil en racine ;
- annuler une révocation d'appareil ou de racine ;
- rétablir le partage GPS, accéder aux anciennes archives GPS ou contourner la destruction J+30 ;
- permettre à un contact, au support ou à un autre utilisateur d'utiliser le secret à la place du titulaire.

Si la racine est perdue, la procédure séparée de nouvelle identité demeure obligatoire. Chaque relation GPS concernée reste bloquée jusqu'à vérification indépendante de la nouvelle empreinte par le contact correspondant.

### Menaces et limites

Le kit est un facteur de possession : toute personne qui obtient une copie lisible peut tenter de l'utiliser. Un secret hors ligne réduit la dépendance aux canaux perdus, mais ne prouve pas à lui seul l'identité civile du titulaire et n'est pas résistant au vol, à la photographie ou à la coercition. Le chiffrement du téléphone, la sécurité du stockage, la confidentialité de l'impression et la non-divulgation à un tiers sont essentiels.

Contrôles proposés : secret à forte entropie, affichage unique, vérificateur serveur sans secret brut, consommation unique atomique, limitation stricte des tentatives, détection d'abus, réponses anti-énumération, journal sans secret ni nouvelle coordonnée, notification de sécurité aux anciens canaux encore sûrs et aux contacts ayant accepté ces alertes, et invalidation de l'ancien kit après usage ou régénération. Une notification n'est ni une preuve ni un veto des contacts.

### Arbitrages à valider avant implémentation

1. Valider le principe du kit hors ligne comme facteur indépendant préenregistré.
2. Choisir le format : une clé unique de forte entropie ou plusieurs codes à usage unique ; tester lisibilité, copie, saisie mobile et risque de perte.
3. Définir le délai de sécurité après présentation du kit et les possibilités de contestation depuis un appareil qui serait encore sûr ; le délai ne doit pas être présenté comme un facteur d'identité.
4. Définir les notifications possibles si l'ancien e-mail est inaccessible, sans révéler de nouvelle coordonnée ni déléguer une décision aux contacts.
5. Définir la révocation des sessions, jetons et appareils après récupération et la procédure de création d'un nouveau kit.
6. Définir les limites de tentatives, les délais de blocage et la récupération après perte du kit lui-même.
7. Faire examiner le format, l'entropie, le stockage du vérificateur et les scénarios de vol/copie par une revue sécurité indépendante.

**NO-GO :** aucun facteur n'est encore adopté ; aucune récupération complète ne doit être activée sur cette proposition seule. Sans appareil approuvé, e-mail accessible ou facteur indépendant validé, SAC doit refuser la récupération plutôt que promettre une solution non vérifiable. La récupération du compte ne rétablit jamais la racine cryptographique.


### Décision utilisateur — format du kit (18 novembre 2026)

**Option A validée : une seule clé personnelle de récupération hors ligne.** L'utilisateur a explicitement choisi une clé unique plutôt qu'une série de codes à usage unique.

- Le kit contiendra une seule clé aléatoire de forte entropie, générée localement et affichée une seule fois.
- Cette clé sera à usage unique : après une récupération réussie, elle sera invalidée et devra être remplacée depuis une session redevenue authentifiée.
- Le serveur ne conservera jamais la clé en clair ; il ne conservera qu'un vérificateur protégé selon une méthode cryptographique à valider.
- La clé sera conservée hors ligne par le titulaire ; une copie imprimée est envisageable. Le format lisible, la longueur, l'encodage et le checksum restent à définir par tests.
- Cette décision choisit le format à clé unique ; elle ne valide pas encore l'algorithme, l'entropie exacte, la durée d'attente, la politique de sessions, ni l'activation du parcours.

**Rappel de portée :** la clé ne récupère que l'accès au compte selon une procédure restant à spécifier. Elle ne restaure jamais l'ancienne racine, n'approuve aucun appareil, ne réactive aucune révocation et ne déverrouille pas le GPS.


### Proposition technique — représentation de la clé unique (18 novembre 2026)

**Statut : proposition à tester, pas une validation cryptographique définitive.**

- Cible proposée : 256 bits d'entropie, soit 32 octets tirés localement d'un générateur cryptographiquement sûr fourni par la plateforme.
- Représentation candidate : Base32 Crockford, sans séparateurs dans la valeur canonique. 256 bits nécessitent 52 caractères Base32 ; le dernier symbole ne transporte que les bits utiles et doit être encodé/décodé de façon canonique.
- Affichage : groupes visuels réguliers pour faciliter lecture, copie et impression. Les espaces et séparateurs sont ignorés lors de la normalisation ; aucune conversion approximative d'un caractère inconnu n'est acceptée silencieusement.
- Le checksum n'est pas encore retenu. Il pourra être ajouté uniquement selon une spécification standard et après tests de saisie ; il ne remplace jamais la vérification cryptographique.
- L'application doit expliquer que la clé est montrée une seule fois, ne peut pas être récupérée par e-mail/SMS et doit être conservée hors ligne. Une confirmation locale de copie ou de transcription peut être étudiée sans réafficher la clé depuis le serveur.
- Ne pas promettre qu'une capture d'écran ou une photographie peut être empêchée. Prévenir l'utilisateur qu'une copie lisible équivaut à la possession du facteur.

**Vérification serveur — orientation à faire auditer :** comme la clé serait uniformément aléatoire sur 256 bits, un SHA-256 correctement domain-separé du secret normalisé et lié à l'identifiant immuable du compte offre déjà une résistance théorique considérable à une attaque hors ligne après fuite du vérificateur. Un HMAC-SHA-256 avec secret serveur séparé peut ajouter une défense en profondeur, mais introduit une dépendance de gestion/rotation du secret serveur. Le choix final doit être examiné par un spécialiste ; ne pas appliquer une KDF de mot de passe à faible entropie comme substitut à une génération aléatoire forte.

**Contrôles obligatoires à spécifier avant code :** normalisation canonique, validation stricte des 52 caractères et des bits de bourrage, liaison au compte et à la version du kit, consommation atomique unique, limites anti-essais distribuées, réponses uniformes, absence du secret dans logs/analytics/crash reports, et tests sur claviers Android réels.

Cette proposition ne modifie pas la décision utilisateur déjà actée (une seule clé hors ligne). Elle ne fixe pas encore définitivement l'encodage, le checksum, le vérificateur, les limites chiffrées ou les délais, et n'autorise aucun code, endpoint ni schéma D1.


## 3.8 Parcours proposé — téléphone perdu, ancienne adresse inaccessible, clé hors ligne disponible (18 novembre 2026)

**Statut : proposition de conception à valider ; aucune récupération réelle n'est activée.**

### Scénario couvert
Le titulaire a perdu son téléphone, ne peut plus accéder à son ancienne adresse e-mail, mais possède toujours l'unique clé personnelle de récupération hors ligne. Il dispose d'un nouvel appareil et peut fournir une nouvelle adresse e-mail qu'il contrôle.

### Séquence proposée
1. Depuis le nouvel appareil, le titulaire choisit explicitement « J'ai perdu mon téléphone et je n'ai plus accès à mon ancienne adresse e-mail ».
2. SAC crée une demande de récupération en attente, avec un identifiant opaque, une finalité unique et une expiration. La réponse ne révèle pas si le compte existe.
3. Le titulaire saisit sa clé hors ligne. Le serveur vérifie le vérificateur protégé ; la clé brute ne transite jamais et n'est jamais journalisée.
4. Le titulaire indique une nouvelle adresse et la vérifie par OTP e-mail. Cet OTP prouve uniquement le contrôle ponctuel de cette nouvelle boîte ; il ne prouve ni l'identité historique, ni la possession de l'ancienne racine.
5. La demande ne devient pas immédiatement une session complète. Une période de sécurité, les contestations possibles et les privilèges temporaires doivent être arbitrés avant toute activation.
6. Après satisfaction de la politique validée, le compte peut retrouver un accès limité depuis le nouvel appareil. Cet appareil reste non approuvé cryptographiquement tant qu'une cérémonie d'approbation distincte n'a pas eu lieu.
7. L'ancien téléphone est traité comme perdu/à révoquer. La politique de révocation de ses sessions, jetons et abonnements push doit être exécutée atomiquement selon la décision de session qui reste à prendre.
8. La clé est consommée une seule fois, atomiquement, uniquement lorsque la récupération atteint son état de succès défini. Toutes les demandes concurrentes liées à cette version deviennent invalides.

### Limites non négociables
- La clé ne restaure pas l'ancienne racine, ne certifie pas le nouvel appareil, ne réactive aucun appareil révoqué et ne débloque pas le GPS.
- Le nouvel OTP e-mail ne remplace jamais la clé et ne constitue pas une preuve d'identité à lui seul.
- Aucun contact de confiance, administrateur ou support ne peut approuver la récupération du compte par vote, reconnaissance humaine ou intervention manuelle.
- Aucune nouvelle coordonnée privée n'est communiquée aux contacts.
- Aucun accès GPS précis, historique GPS ou clé GPS n'est restauré.
- Une demande en attente n'accorde aucun privilège privé implicite et ne doit pas être présentée comme une récupération réussie.
- Le SOS essentiel ne doit pas être bloqué par une vérification e-mail lorsqu'il est déclenché depuis une session encore autorisée.

### Arbitrages encore ouverts
1. La combinaison « clé hors ligne + OTP sur nouvelle adresse » suffit-elle pour récupérer l'accès au compte, ou faut-il un contrôle indépendant supplémentaire ?
2. Quel délai de sécurité s'applique avant l'accès rétabli ? Faut-il une notification neutre aux anciens canaux ou aux contacts, sans leur donner de droit de veto ?
3. Quels droits précis sont accordés pendant l'attente puis après succès : simple reprise de connexion, consultation du compte, modification des coordonnées, gestion des contacts ?
4. Au succès, faut-il révoquer toutes les sessions et tous les jetons existants, ou seulement ceux de l'appareil perdu et les sessions à risque ? Comment traiter les autres appareils encore actifs ?
5. Le nouvel appareil reste-t-il dans un état « récupération limitée / non approuvé » jusqu'à une cérémonie distincte ? Quelles opérations lui sont interdites ?
6. Quelle durée de validité, quel nombre d'essais, quelle temporisation et quelle procédure en cas de demande interrompue ou de résultat réseau ambigu ?
7. Comment traiter une clé perdue, volée, photographiée, déjà utilisée ou soupçonnée compromise ? Aucune récupération alternative n'est présumée.

**NO-GO :** pas d'implémentation avant validation explicite des facteurs, délais, contestations, droits temporaires, politique de sessions, états et tests adversariaux. La récupération du compte reste distincte de la récupération de la racine.



## 3.9 Orientation recommandée — arbitrages du parcours de récupération (18 novembre 2026)

**Statut : recommandation structurée à soumettre à validation utilisateur ; aucune de ces valeurs n'est encore une décision approuvée.**

| Sujet | Orientation recommandée | Motif / limite |
|---|---|---|
| Preuves | Clé hors ligne valide + OTP sur nouvelle adresse | Deux preuves de contrôle distinctes. Le nouvel OTP ne prouve jamais l'identité historique. Si la clé est suspectée copiée, suspendre et refuser le parcours standard ; aucun contournement par support ou contacts. |
| Délai | Délai de sécurité candidat de 24 heures après validation des deux preuves | Laisser le temps à une session encore active de signaler une activité suspecte. Ce délai n'est pas une preuve supplémentaire et ne doit pas devenir un veto d'une ancienne boîte inaccessible. |
| Contestation | Notification neutre aux sessions déjà actives et à l'ancien e-mail seulement s'il n'est pas signalé compromis ; aucune donnée sensible, aucun lien d'approbation ; aucun vote de contacts | Informer sans divulguer la nouvelle adresse ni donner une autorité de récupération à un canal potentiellement compromis. |
| Session | Après délai et validation atomique : une session de récupération limitée sur le nouvel appareil | Elle ne vaut pas approbation cryptographique de l'appareil et ne donne pas accès aux fonctions racine/GPS. |
| Révocation | À la réussite, révoquer les sessions actives et jetons de session existants ; marquer l'appareil perdu comme révoqué ; invalider ses abonnements push. Préserver séparément les enregistrements d'approbation des autres appareils, mais exiger une nouvelle authentification et une preuve de possession avant réouverture de session | Fermer les sessions potentiellement volées sans détruire les clés d'appareils secondaires encore légitimes. La révocation de session ne doit pas être confondue avec la révocation cryptographique de tous les appareils. |
| Nouvel appareil | État « récupération limitée / non approuvé » jusqu'à une cérémonie distincte | Aucun accès racine, aucune approbation d'autre appareil, aucune opération GPS. |
| Données | Aucun accès aux données privées pendant l'attente ; après récupération limitée, accès limité aux paramètres de sécurité nécessaires au rétablissement | Éviter qu'une clé volée donne accès aux données personnelles pendant la fenêtre de récupération. |
| SOS | Ne jamais faire dépendre un SOS valide d'un OTP e-mail ; définir séparément si une session limitée peut déclencher un SOS sans GPS | Préserver l'urgence sans accorder implicitement toutes les permissions de l'appareil récupéré. |

### Conditions et limites
- Le délai candidat de 24 heures commence seulement après validation de la clé et de la nouvelle adresse ; une demande incomplète ne démarre pas le compte à rebours.
- Une notification ou l'absence de notification ne prouve ni l'identité ni la livraison. Une notification n'est jamais un vote ou un veto.
- Une contestation provenant d'une session authentifiée encore active peut suspendre temporairement la demande pour examen de sécurité ; ses critères, sa durée maximale et les recours doivent être définis afin d'éviter un déni de service par un appareil compromis.
- Si une compromission de la clé est plausible, ne pas traiter le délai comme une compensation suffisante : refuser le parcours standard et appliquer une procédure indépendante qui reste à concevoir.
- La session limitée ne doit pas pouvoir consulter les alertes privées, l'historique sensible, les coordonnées des contacts ou la localisation précise.
- Les appareils secondaires déjà approuvés ne sont pas automatiquement effacés ou rétrogradés cryptographiquement ; leurs sessions sont fermées et leur reprise exige une preuve fraîche.
- Le nouvel appareil ne récupère jamais l'ancienne clé racine. Une nouvelle racine doit être générée localement et vérifiée séparément par relation avant tout GPS.
- Le traitement des demandes répétées, du délai maximal, des erreurs réseau et des limites d'essais reste à spécifier.

**Validation utilisateur requise :** confirmer ou modifier le seuil de preuve, le délai candidat de 24 h, la notification/contestation, les droits de session limitée et la politique de révocation. Tant que cette validation n'est pas obtenue, toutes ces orientations restent des propositions et le NO-GO implémentation est maintenu.



## 3.10 Périmètre candidat de la session limitée après récupération (18 novembre 2026)

**Statut : proposition à valider.** La session limitée ne doit pas être un compte complet déguisé.

| Fonction | Proposition |
|---|---|
| Consulter l'état de récupération et les consignes de sécurité | Autorisé |
| Se déconnecter et fermer la session | Autorisé |
| Définir un nouveau mot de passe après succès du parcours | Autorisé, avec preuve fraîche liée à la session |
| Confirmer la nouvelle adresse déjà vérifiée | Autorisé ; ne pas permettre de la remplacer à nouveau sans procédure renforcée |
| Demander la cérémonie de création d'une nouvelle racine | Autorisé ; la demande n'approuve pas l'appareil |
| Créer immédiatement une nouvelle clé de récupération | Non, tant que l'appareil n'a pas passé la cérémonie de confiance requise |
| Voir alertes privées, historique, détails des incidents | Interdit |
| Voir coordonnées privées ou listes complètes des contacts | Interdit |
| Voir ou partager GPS précis | Interdit |
| Modifier contacts, groupes ou relations de confiance | Interdit |
| Approuver un appareil secondaire ou modifier l'autorité racine | Interdit |
| Modifier abonnement, paiements ou paramètres à fort impact | Interdit jusqu'à réauthentification sur appareil approuvé |
| Déclencher un SOS depuis cette session | À arbitrer séparément ; ne pas le considérer comme automatiquement autorisé ou interdit |

**Arbitrage SOS :** préserver l'accès à l'urgence est important, mais une session récupérée peut être détenue par un attaquant. Il faut définir si un SOS sans GPS est possible depuis cette session, quelles limites anti-abus s'appliquent et comment les contacts sont informés de l'état de confiance du terminal, sans retarder un SOS depuis une session déjà autorisée.

**Verrou :** cette matrice est une proposition de moindre privilège ; aucune permission n'est encore implémentée ou activée.



## 3.11 SOS depuis une session de récupération limitée — politique candidate (18 novembre 2026)

**Statut : recommandation à valider ; aucun droit SOS n'est activé par cette annexe.**

### Recommandation
Autoriser un **SOS de secours sans GPS**, depuis une session de récupération limitée achevée, mais seulement vers les contacts déjà préconfigurés avant la récupération et toujours éligibles au moment du déclenchement.

Ce droit exceptionnel ne transforme pas le nouvel appareil en appareil approuvé et ne lui ouvre aucun accès aux données privées.

### Conditions proposées
- La récupération du compte est entièrement achevée ; une demande encore en attente ne peut pas lancer de SOS.
- La session limitée est valide, non expirée, non révoquée et liée au nouvel appareil et à la récupération achevée.
- Le serveur vérifie à nouveau les états de compte, de session, de récupération et de révocation au moment du déclenchement.
- Destinataires : uniquement l'instantané de contacts SOS préconfiguré avant la récupération, sans affichage de la liste privée et sans ajout/retrait ponctuel.
- L'instantané est revalidé selon les règles dynamiques de relation : relation active, contact éligible et canal utilisable. Aucun contact révoqué ou relation terminée ne reçoit le SOS.
- Aucune position GPS, adresse, historique ou donnée de localisation n'est collectée ou jointe.
- L'alerte indique clairement aux destinataires : « SOS envoyé depuis un appareil en récupération limitée ; appareil non encore approuvé ; localisation non disponible ».
- Le titulaire peut choisir une catégorie et un niveau d'urgence parmi les valeurs SAC déjà définies. Pas de texte libre ni de pièce jointe dans ce mode candidat.
- Le déclenchement ne demande aucun OTP e-mail et ne dépend pas de la réception d'un e-mail.
- Le SMS d'escalade SOS, s'il fait partie du mécanisme validé, reste distinct de l'OTP et suit les règles d'escalade déjà définies. Aucune escalade ne doit être inventée pour ce mode sans décision spécifique.

### Restrictions supplémentaires
- Pas de SOS critique immédiat vers une liste modifiable ; seuls les destinataires SOS préconfigurés avant la récupération sont utilisés.
- Pas de partage GPS même si une permission système est déjà accordée.
- Pas d'accès à l'historique ou aux réponses privées des contacts via cette session.
- Pas de modification de l'alerte après déclenchement, sauf les actions strictement nécessaires de l'auteur prévues par le cycle SAC ; les contacts ne peuvent pas clôturer.
- Le serveur doit empêcher doublons, rejeu et déclenchements concurrents non intentionnels.
- Prévoir un contrôle anti-abus proportionné. Ne pas imposer une limite arbitraire qui pourrait empêcher une nouvelle alerte en situation réellement distincte ; définir une politique de répétition et de détection à tester.
- Si aucun contact préconfiguré n'est éligible, expliquer avant le déclenchement qu'aucun destinataire ne peut être notifié ; ne jamais afficher une confirmation de succès mensongère.

### Comportement en cas de panne
- Si le réseau est indisponible, afficher que l'alerte n'a pas été confirmée par le serveur ; ne pas prétendre qu'un SMS ou un push est parti.
- Si le serveur a accepté la demande mais que la réponse est perdue, retrouver l'état avec une référence idempotente sans créer une deuxième alerte.
- Ne pas promettre un fonctionnement hors ligne ou un SMS direct depuis le téléphone dans ce mode.

### Après la cérémonie de confiance
Quand le nouvel appareil est devenu approuvé selon la procédure cryptographique distincte, les fonctions SOS normales peuvent être réévaluées selon les permissions habituelles. L'approbation ne restaure jamais les anciennes données GPS expirées ni une racine révoquée.

### Validation utilisateur requise
Confirmer :
1. autoriser ou non ce SOS de secours sans GPS ;
2. conserver uniquement les contacts SOS préconfigurés avant récupération ;
3. interdire l'ajout/retrait de destinataires, le texte libre et les pièces jointes ;
4. afficher explicitement aux destinataires que l'appareil est encore non approuvé ;
5. maintenir les règles d'escalade SOS existantes sans créer de raccourci SMS.

**NO-GO :** aucune permission SOS depuis la session limitée n'est implémentée avant validation explicite de ces cinq points et tests de sécurité/disponibilité.



### Décision utilisateur — visibilité des réponses au SOS de secours (18 novembre 2026)

L'utilisateur valide que, depuis une session de récupération limitée, le titulaire peut consulter uniquement l'état de son propre SOS de secours et savoir si un proche l'a pris en charge.

Cette visibilité est limitée à des états fonctionnels minimaux :
- demande reçue/acceptée par SAC, si cet état est confirmé côté serveur ;
- notification en attente, acceptée par le fournisseur, livrée ou échec, uniquement lorsque le niveau de preuve est disponible et clairement distingué ;
- alerte reçue par un contact, seulement si un accusé humain explicite existe ;
- prise en charge confirmée, si la transition du répondant principal a été validée côté serveur ;
- alerte clôturée par son auteur, si cette transition a été confirmée.

Aucune réponse libre, conversation, identité ou coordonnées des contacts, contenu privé, position, historique GPS ou détail d'une autre alerte ne devient accessible à travers cette session. Ne pas confondre notification acceptée par un fournisseur, livraison technique, lecture humaine et prise en charge.

Les états visibles doivent être agrégés et limités à l'alerte concernée. Les horodatages affichés ne doivent pas révéler inutilement l'activité individuelle des contacts. Aucun accès aux données privées des contacts n'est accordé.

Cette validation ne rend pas à elle seule le SOS de secours exécutable : les autres préconditions, permissions, délais et tests de sécurité documentés restent applicables. Aucun code ou endpoint n'est autorisé.


## Annexe — perte simultanée du téléphone, de l'ancien e-mail et de la clé hors ligne (18 novembre 2026)

**Statut :** politique de sécurité proposée ; aucun parcours supplémentaire n'est activé par cette annexe.

### Scénario A — un autre appareil approuvé reste disponible
Le titulaire peut engager la procédure normale depuis cet appareil, sous réserve d'une session valide, d'une preuve cryptographique fraîche et de la vérification de l'état de révocation. La perte de la clé hors ligne ne doit pas bloquer une authentification forte déjà possible depuis un appareil approuvé. Après validation du changement d'adresse e-mail selon la procédure dédiée, un nouveau kit peut être généré depuis une session et un appareil autorisés. L'ancien kit doit être déclaré perdu et invalidé atomiquement ; il ne peut pas être réémis.

### Scénario B — aucun appareil approuvé, mais un facteur indépendant préenregistré existe
Une voie de récupération ne peut être étudiée que si un facteur indépendant a été configuré et vérifié avant l'incident, avec une procédure documentée, résistante au rejeu et distincte de l'e-mail nouvellement fourni. Aucun facteur de ce type n'est actuellement choisi ni approuvé. L'OTP de la nouvelle adresse ne constitue qu'une preuve de contrôle de boîte. L'existence d'un facteur ne vaut pas autorisation automatique : sa robustesse, sa révocation, ses limites et les conséquences sur les sessions doivent être arbitrées et testées.

### Scénario C — aucun appareil approuvé et aucun facteur indépendant disponible
La récupération du compte historique doit être refusée. Le support, un contact de confiance, un nouvel OTP e-mail/SMS, une pièce d'identité envoyée par formulaire ou la connaissance d'informations personnelles ne doivent pas devenir un contournement improvisé. La personne peut créer un nouveau compte distinct si les règles produit le permettent, mais SAC ne doit pas rattacher automatiquement l'ancien historique, les anciennes relations, les alertes, les abonnements ou les droits. Aucun accès à l'ancien compte, à ses données ou à sa racine ne doit être accordé.

### Invariants
- Perdre le kit ne permet jamais de reconstituer la clé privée racine, d'approuver un appareil ou de déverrouiller le GPS.
- Aucun contact ne vote, ne confirme l'identité historique ou ne récupère le compte.
- Aucun administrateur/support ne peut remplacer les preuves cryptographiques par une décision manuelle.
- Aucun OTP envoyé à une nouvelle adresse ou à un nouveau numéro ne prouve la continuité du compte.
- La clé perdue est invalidée dès que le titulaire peut authentifier le compte par une voie déjà autorisée ; elle n'est jamais affichée à nouveau.
- Les demandes échouées, expirées ou refusées ne doivent pas révéler si un compte, une clé ou un facteur existe.
- Une impossibilité de récupération doit être expliquée honnêtement, sans promesse de récupération ultérieure non conçue.

### Arbitrages encore ouverts
Nature d'un éventuel facteur indépendant préenregistré ; preuve de récupération en son absence ; délais et contestation ; politique de sessions ; conditions de création d'un nouveau compte sans rattachement à l'ancien. NO-GO maintenu pour tout développement de récupération additionnelle.
