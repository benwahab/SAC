# SAC — Décisions actées et points à valider

Ce document évite de confondre une décision de l'utilisateur avec une proposition technique. Il doit être mis à jour à chaque validation.

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
6. **SMS :** prestataire, coût, disponibilité et règles de bascule depuis les notifications push.
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
