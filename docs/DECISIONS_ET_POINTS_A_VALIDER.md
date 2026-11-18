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
