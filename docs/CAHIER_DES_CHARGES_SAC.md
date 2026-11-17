# SAC — Cahier des charges fonctionnel et technique

**Projet :** SAC — Sécurité, Alerte, Citoyenne  
**Version :** 1.1 — Document de cadrage consolidé  
**Statut :** Référence fonctionnelle — socle technique initial commencé ; fonctions métier non encore implémentées  
**Périmètre initial :** population générale, lancement envisagé au Niger, conception extensible à d'autres pays.

---

## 1. Vision et objectif

SAC est une application qui permet à une personne de prévenir rapidement les proches qu'elle a elle-même choisis lorsqu'elle se sent en danger, rencontre une urgence ou souhaite sécuriser un déplacement.

Le principe central est simple : **la personne garde le contrôle de ses alertes, de ses contacts et du partage de sa localisation**. Les alertes sont envoyées aux contacts de confiance autorisés par l'utilisateur. Le périmètre initial ne prévoit pas de transmission automatique aux services de police, de secours ou à une administration publique.

SAC doit être compréhensible par le grand public, utilisable principalement sur téléphone et honnête sur ce que le système a réellement réussi à envoyer ou à transmettre.

### 1.1 Objectifs

- Déclencher une alerte en quelques gestes.
- Permettre de choisir les proches qui reçoivent chaque type d'alerte.
- Permettre aux proches de confirmer la réception et de se porter volontaires pour aider.
- Protéger les déplacements grâce à une confirmation d'arrivée, un accompagnement ou une protection complète.
- Maintenir les fonctions essentielles de sécurité accessibles gratuitement.
- Proposer une formule Premium sans rendre le SOS essentiel payant.
- Protéger fortement les données personnelles, les positions et les informations de sécurité.

### 1.2 Hors périmètre initial

- Pas de compte citoyen ou de tableau de bord institutionnel de type PCS.
- Pas de dispatch automatique vers la police, les pompiers, les hôpitaux ou une autorité publique.
- Pas de promesse de fonctionnement GPS permanent lorsque l'application est fermée ou suspendue.
- Pas de promesse de SMS automatique lorsque le téléphone, le réseau ou le fournisseur SMS ne le permet pas.
- Pas de logo imposé à ce stade.

## 2. Principes produit non négociables

1. L'utilisateur qui déclenche l'alerte reste la seule personne autorisée à la clôturer.
2. Un contact peut accuser réception ou prendre la situation en charge, mais ne peut pas clôturer l'alerte.
3. La fin des rappels ne signifie jamais que l'alerte est résolue.
4. Une position ancienne doit être affichée comme ancienne avec son horodatage ; elle ne doit jamais être présentée comme une position en direct.
5. Le niveau de gravité choisi par l'auteur ne peut pas être modifié par un contact.
6. Seuls les contacts ayant accepté l'invitation et disposant de l'autorisation correspondante peuvent recevoir les nouvelles alertes.
7. La liste des destinataires est figée au moment du déclenchement d'une alerte ; les modifications ultérieures ne réécrivent pas l'historique de cette alerte.
8. L'interface doit distinguer une tentative d'envoi, un envoi accepté par un fournisseur, une livraison confirmée, une lecture et un accusé de réception.
9. Une fonction qui dépend d'une permission ou d'une capacité du téléphone doit expliquer clairement son état et ses limites.
10. Le SOS essentiel et les fonctions fondamentales de sécurité restent accessibles dans l'offre gratuite.

## 3. Public, comptes et inscription

### 3.1 Public cible

Toute personne pouvant utiliser un smartphone ou un navigateur mobile. L'interface doit être simple, lisible et adaptée à une utilisation rapide en situation de stress.

### 3.2 Création de compte

- Inscription avec un numéro de téléphone ou une adresse e-mail.
- Vérification initiale par code à usage unique (OTP).
- Possibilité d'ajouter et de vérifier ultérieurement le second moyen de contact.
- Aucun mot de passe ou code OTP ne doit être stocké en clair.
- Les sessions et appareils connectés doivent pouvoir être consultés et révoqués.
- Les parcours de récupération de compte doivent être sécurisés et documentés avant lancement.

### 3.3 Profil et paramètres

Le profil comprend au minimum : identité d'affichage, téléphone et/ou e-mail vérifiés, langue, paramètres de notification, préférences de confidentialité, contacts de confiance, formule et appareils connectés.

L'utilisateur doit pouvoir modifier ses informations, gérer ses autorisations, exporter les informations prévues par la politique de données et demander la suppression de son compte selon une procédure définie.

## 4. Offres et abonnements

### 4.1 Offre gratuite

- Jusqu'à **2 contacts de confiance**.
- Accès aux fonctions essentielles d'alerte et de SOS.
- Accès aux fonctions fondamentales de protection des trajets.
- Les options précises de l'offre gratuite devront être décrites sans bloquer le déclenchement d'une alerte essentielle.

### 4.2 Offre Premium

- Prix retenu : **5 000 FCFA par mois**.
- Jusqu'à **10 contacts de confiance**.
- Options supplémentaires à définir et à afficher clairement avant souscription.

La liste finale des avantages Premium n'est pas encore arrêtée. Aucun avantage ne doit être inventé dans l'interface ou facturé avant validation.

### 4.3 Paiement

Le paiement devra être confirmé côté serveur par une preuve fiable du prestataire, et non par une simple capture d'écran ou une réponse fournie par le navigateur. Le renouvellement, l'expiration, les échecs, les remboursements et les changements de formule devront avoir des états explicites. Le ou les prestataires Mobile Money / paiement au Niger restent à choisir.

## 5. Contacts de confiance

### 5.1 Gestion

- L'utilisateur peut inviter des proches par téléphone ou e-mail.
- Le contact doit accepter l'invitation avant de devenir un destinataire autorisé.
- Chaque contact peut être classé : famille, ami, voisin, collègue ou autre.
- L'utilisateur peut retirer un contact ou révoquer ses autorisations.
- Un contact révoqué ne reçoit plus les nouvelles alertes.
- La révocation ne supprime pas rétroactivement les événements déjà associés à une alerte passée.

### 5.2 Préférences par type d'alerte

L'utilisateur choisit quels contacts reçoivent chaque catégorie d'alerte. L'application ne doit pas envoyer automatiquement toutes les alertes à tous les contacts si l'utilisateur a configuré des destinataires différents.

### 5.3 Groupes privés

Des groupes privés peuvent faciliter l'organisation de proches. L'appartenance à un groupe ne donne **aucun accès automatique** à la localisation ou aux alertes d'un membre. Les droits doivent être accordés explicitement par l'utilisateur. Les limites de taille, les rôles et les fonctions avancées restent à préciser.

## 6. Catégories d'alerte

Les catégories prévues sont :

1. **Danger personnel** : menace, agression, intimidation, personne suivie ou situation inquiétante.
2. **Accident** : accident de circulation, chute ou autre accident.
3. **Intrusion au domicile** : entrée non autorisée ou tentative d'intrusion.
4. **Urgence médicale** : malaise ou besoin d'assistance médicale.
5. **Personne perdue ou désorientée** : difficulté à retrouver son chemin ou à rejoindre un lieu sûr.
6. **Alerte personnalisée** : situation décrite librement par l'utilisateur.

Pour chaque catégorie, l'utilisateur peut définir les contacts destinataires et les préférences de partage autorisées.

## 7. Niveaux d'alerte

Trois niveaux sont prévus :

- **Préventif — « Je ne me sens pas en sécurité »** : informer les proches d'une situation inquiétante avant qu'elle ne devienne une urgence.
- **Urgent — « J'ai besoin d'aide rapidement »** : demander une aide rapide.
- **Critique — danger immédiat** : déclencher le SOS et avertir immédiatement les destinataires sélectionnés.

Le niveau est choisi par l'auteur et ne peut pas être modifié par les destinataires. Un contact peut demander un renfort, mais ne peut pas reclasser l'alerte.

## 8. Déclenchement d'une alerte et SOS

### 8.1 Parcours normal

1. L'utilisateur choisit le type et le niveau d'alerte, ou utilise le bouton SOS selon le parcours prévu.
2. L'application affiche clairement les destinataires sélectionnés.
3. Elle recueille la position disponible si l'utilisateur a accordé la permission et si une position est obtenue.
4. Le serveur enregistre l'alerte et fige la liste des destinataires.
5. Le système crée les tâches de notification et affiche l'état réel du traitement.
6. L'utilisateur peut consulter l'état de son alerte et la clôturer.

Le parcours critique doit limiter les étapes et éviter les confirmations superflues. Une éventuelle temporisation ou annulation configurable ne doit jamais empêcher l'envoi immédiat lorsque l'utilisateur choisit de déclencher le SOS immédiatement.

### 8.2 Informations d'une alerte

Selon les permissions et la disponibilité des données :
- identifiant et référence de l'alerte ;
- auteur et catégorie ;
- niveau choisi ;
- date et heure de déclenchement ;
- description facultative ;
- position disponible et heure de collecte ;
- état d'envoi des notifications ;
- destinataires sélectionnés ;
- réponses et prises en charge.

Une position indisponible ne doit pas empêcher une alerte d'être créée. L'interface doit signaler « position indisponible » plutôt que fabriquer une position.

### 8.3 SOS discret et code de contrainte

Le mode SOS discret est validé avec affichage d'un **écran neutre après le déclenchement**, sans indication visible d'urgence.

Deux contextes d'utilisation du code de contrainte sont retenus :
- saisie du code de contrainte dans SAC ;
- déclenchement via un mécanisme ou raccourci accessible depuis l'écran verrouillé, sous réserve de faisabilité réelle sur chaque plateforme.

Le code de contrainte déclenche discrètement une alerte aux contacts sélectionnés. Le code normal permet l'utilisation normale de l'application. La dernière position connue peut être partagée si l'utilisateur a accordé cette autorisation.

La protection contre une désactivation forcée est également validée : SAC doit tenter de déclencher une alerte discrète **avant la désactivation lorsque la plateforme le permet**. Il s'agit d'un mécanisme de meilleure intention, pas d'une garantie qu'une application peut empêcher un arrêt forcé, une extinction ou une désinstallation.

Les codes ne sont jamais conservés en clair. Ils doivent être protégés contre les essais répétés, les attaques par force brute et la consultation par les administrateurs. Le comportement exact doit être validé sur Android, iOS et PWA : les systèmes d'exploitation et navigateurs limitent certaines actions discrètes, l'exécution en arrière-plan et les notifications silencieuses. Aucune promesse technique ne doit être faite avant des essais réels.

### 8.4 SOS programmé / différé

L'utilisateur peut programmer une alerte à une échéance. Il peut la modifier ou l'annuler avant l'échéance. À l'heure prévue, le serveur tente de créer l'alerte et d'envoyer les notifications prévues.

Le traitement doit être exécuté côté serveur et être idempotent. Il faut préciser à l'utilisateur qu'une exécution ne peut pas être garantie en cas de panne serveur, de compte suspendu, de problème réseau ou d'indisponibilité du fournisseur.

## 9. Alerte préventive

L'utilisateur peut envoyer « Je ne me sens pas en sécurité » sans attendre une urgence critique.

- L'utilisateur sélectionne les contacts autorisés.
- Il peut joindre une explication facultative.
- Il choisit si sa position est partagée.
- Les contacts peuvent accuser réception et proposer leur aide.
- L'utilisateur peut clôturer l'alerte.
- Le niveau préventif reste distinct des niveaux urgent et critique.

## 10. Protection des trajets

Une seule fonctionnalité regroupe les scénarios d'accompagnement : **Protection des trajets**. L'utilisateur choisit lui-même le mode adapté.

### 10.1 Mode 1 — Vérification d'arrivée

- L'utilisateur indique son trajet ou sa destination et une heure d'arrivée estimée.
- Il choisit les contacts à prévenir.
- Il doit confirmer son arrivée.
- En l'absence de confirmation après le délai configuré, les contacts sélectionnés sont avertis.
- Le délai et le nombre de relances restent à définir.

### 10.2 Mode 2 — Accompagnement

- Un ou plusieurs contacts autorisés peuvent suivre la position pendant le trajet.
- L'utilisateur choisit les personnes et la durée du partage.
- Le partage s'arrête à l'échéance ou à la clôture du trajet, selon le mode choisi.
- La position affichée doit toujours porter son horodatage et son état de fraîcheur.

### 10.3 Mode 3 — Protection complète

Ce mode combine :
- partage de position ;
- destination et heure d'arrivée estimée ;
- détection d'un retard selon les règles configurées ;
- rappels à l'utilisateur ;
- confirmation d'arrivée ;
- notification des contacts en cas d'absence de confirmation.

### 10.4 Durée et limites

Les durées proposées pour le partage sont : ponctuelle, 15 minutes, 30 minutes, 1 heure ou jusqu'à la clôture de l'alerte/du trajet, selon le parcours.

Une PWA ne garantit pas un suivi GPS continu lorsque le navigateur ou l'application est suspendu ou fermé. Les applications natives peuvent améliorer certains scénarios, mais restent soumises aux permissions, à l'économie d'énergie et aux règles Android/iOS. L'interface doit afficher le dernier point reçu, sa date et l'état de connexion, sans présenter une donnée ancienne comme du direct.

## 11. Réception et prise en charge par les contacts

Deux actions distinctes sont obligatoires :

- **« J'ai reçu l'alerte »** : le contact confirme qu'il a vu l'alerte.
- **« Je prends la situation en charge »** : le contact s'engage à intervenir.

Le premier contact qui accepte de prendre la situation en charge devient le répondant principal. Les autres contacts peuvent également intervenir.

Le répondant principal peut :
- signaler qu'il est en route ;
- demander du renfort ;
- communiquer une mise à jour utile.

Si le répondant principal se retire, le contact volontaire suivant devient principal automatiquement. S'il n'y a aucun autre volontaire, l'alerte reste active sans répondant principal.

Les contacts ne peuvent pas clôturer l'alerte. Seul l'auteur de l'alerte peut le faire.

## 12. Rappels et clôture

- Les rappels sont envoyés toutes les **5 minutes** aux contacts initialement sélectionnés lors du déclenchement.
- Les rappels continuent jusqu'à la clôture de l'alerte par son auteur.
- Les rappels restent strictement limités à la liste initiale figée : aucun nouveau contact ne peut être ajouté automatiquement.
- Un accusé de réception ou une prise en charge est enregistré dans la chronologie, mais ne clôture pas l'alerte et ne retire pas le contact de la liste des destinataires des rappels tant que l'auteur n'a pas clôturé l'alerte.
- Les rappels cessent immédiatement lorsque l'auteur clôture l'alerte.
- L'arrêt des rappels résulte uniquement de la clôture par l'auteur ; aucune durée maximale ne les arrête avant cette clôture.

Les traitements de rappel doivent être fiables, idempotents et résistants aux doubles exécutions.

## 13. Notifications et états

### 13.1 Événements à notifier

- nouvelle alerte SOS ;
- alerte préventive ;
- invitation d'accompagnement ;
- absence de confirmation d'arrivée ;
- retard de trajet ;
- prise en charge principale ;
- retrait du répondant principal ;
- demande de renfort ;
- clôture de l'alerte ;
- invitation et acceptation d'un contact ;
- événements essentiels du compte et de l'abonnement.

### 13.2 Canaux envisagés

- notifications push Web ;
- notifications dans l'application ;
- SMS en complément si un fournisseur et les conditions techniques le permettent ;
- e-mail pour les événements de compte et les messages non urgents.

Le SMS n'est pas une garantie de fonctionnement hors réseau. Une notification envoyée n'est pas nécessairement livrée, lue ou comprise.

### 13.3 États à distinguer

Au minimum : créé, en attente, tentative en cours, accepté par le fournisseur, livré (si le canal le confirme), échec, lu (si la plateforme fournit cette information), accusé de réception, pris en charge.

L'application ne doit jamais afficher « reçu » si elle sait uniquement que la requête a été envoyée au fournisseur.

## 14. Interfaces frontend

Le frontend est mobile-first, clair, lisible et rapide. La palette retenue ne contient pas de violet :

- bleu nuit : `#142B45` ;
- rouge SOS : `#D9273F` ;
- blanc : `#FFFFFF` ;
- vert sécurité : `#15966B` ;
- gris clair : `#E9EEF3`.

### 14.1 Écrans publics et compte

- écran de bienvenue et présentation ;
- inscription ;
- vérification OTP ;
- connexion ;
- récupération de compte ;
- permissions et explications de confidentialité ;
- tableau d'accueil personnel ;
- profil et paramètres ;
- appareils et sessions.

### 14.2 Écrans de sécurité

- accès SOS clairement identifiable ;
- choix catégorie/niveau ;
- sélection et aperçu des destinataires ;
- confirmation de déclenchement adaptée au niveau ;
- alerte active et chronologie ;
- état des notifications ;
- position et horodatage ;
- réponses des contacts ;
- clôture par l'auteur ;
- configuration du SOS discret et du code de contrainte ;
- programmation d'une alerte.

### 14.3 Écrans contacts et groupes

- liste des contacts ;
- invitation, acceptation et révocation ;
- préférences de destinataires par catégorie ;
- détail des autorisations ;
- groupes privés et gestion des membres.

### 14.4 Écrans Protection des trajets

- création d'un trajet ;
- choix entre vérification d'arrivée, accompagnement et protection complète ;
- destination et heure estimée ;
- choix des contacts ;
- durée du partage de position ;
- suivi et rappels ;
- confirmation d'arrivée ;
- gestion d'un retard ou d'une absence de confirmation.

### 14.5 Écrans abonnement

- comparaison gratuite/Premium ;
- prix de 5 000 FCFA par mois ;
- avantages confirmés uniquement ;
- paiement et confirmation serveur ;
- historique et état de l'abonnement.

### 14.6 États UI obligatoires

Chaque fonction sensible doit présenter les états : chargement, succès confirmé, échec, permission refusée, hors ligne, données indisponibles, donnée ancienne, traitement en attente. Les erreurs doivent être compréhensibles et rédigées en français au lancement.

## 15. Backend et règles métier

Le backend est responsable de la validation des permissions, des destinataires, des transitions d'état, des rappels, des échéances et des notifications. Le navigateur ne peut pas être l'autorité pour :
- décider qui reçoit une alerte ;
- confirmer un paiement ;
- attribuer le rôle de répondant principal ;
- clôturer l'alerte au nom d'un contact ;
- exécuter une alerte programmée ;
- arrêter ou créer arbitrairement les rappels.

Les opérations sensibles doivent être atomiques lorsque nécessaire et protégées contre les doubles soumissions. Les actions importantes doivent produire un événement horodaté et traçable.

## 16. Sécurité, confidentialité et données

- Contrôle d'accès strict par utilisateur, relation de contact et alerte.
- Aucun accès implicite à la localisation par appartenance à un groupe.
- Secrets uniquement côté serveur et dans un gestionnaire de secrets.
- OTP, codes de sécurité et jetons protégés.
- Limitation de débit sur inscription, OTP, invitations, SOS discret et endpoints sensibles.
- Journalisation des actions de sécurité sans enregistrer inutilement des secrets ou des coordonnées détaillées.
- Chiffrement en transit et chiffrement au repos selon les capacités de l'infrastructure.
- Sauvegardes et procédure de restauration testées.
- Politique de conservation et de suppression des données GPS à définir avant production.
- Accès administratif limité, justifié et auditable.
- Aucun compte administrateur ne doit permettre de consulter librement toutes les localisations sans contrôle et justification.

## 17. Langues et accessibilité

L'application doit être conçue pour être multilingue dès le départ, sans texte métier dispersé directement dans les composants. Les langues de référence déjà prévues sont le français, le hausa, le zarma et l'anglais. La structure doit permettre d'ajouter d'autres langues sans réécrire les parcours ; la disponibilité effective de chaque traduction doit être vérifiée avant activation.

Les textes doivent être courts, les boutons suffisamment grands et les contrastes lisibles. Les messages critiques doivent éviter les ambiguïtés et employer des termes cohérents dans toutes les langues. Les parcours SOS doivent rester compréhensibles même lorsque l'utilisateur agit rapidement ou sous stress.

## 18. Performance et fiabilité

- Priorité aux réseaux mobiles irréguliers.
- Pages essentielles légères et chargement rapide.
- Ne pas bloquer la création d'une alerte si une carte ou un service secondaire ne répond pas.
- Mise en file côté serveur pour les notifications et rappels.
- Reprise contrôlée après erreur temporaire.
- Idempotence pour les alertes programmées, paiements et rappels.
- Horodatage serveur comme référence.
- Indication claire du dernier état connu lorsque le réseau est perdu.

## 19. Administration et exploitation

Un espace d'administration minimal pourra gérer les comptes, signalements techniques, états de paiement, paramètres généraux et journaux de sécurité. Il ne doit pas donner un accès illimité aux données sensibles. Les rôles, droits et procédures d'accès administrateur doivent être définis avant implémentation.

## 20. Critères d'acceptation fonctionnels

Le produit ne pourra pas être considéré comme prêt tant que les scénarios suivants ne sont pas vérifiés :

1. Un compte peut s'inscrire et vérifier un téléphone ou un e-mail.
2. Un utilisateur gratuit ne peut pas dépasser deux contacts actifs.
3. Un utilisateur Premium actif peut gérer jusqu'à dix contacts.
4. Un contact non accepté ne reçoit aucune nouvelle alerte.
5. La révocation empêche les prochaines alertes vers ce contact.
6. Les destinataires d'une alerte sont figés à son déclenchement.
7. Une alerte peut être créée même si la position est indisponible.
8. L'état réel de chaque notification est présenté sans fausse confirmation.
9. Un contact peut accuser réception sans prendre la situation en charge.
10. Le premier contact qui prend en charge devient répondant principal.
11. Le retrait du principal permet la promotion du volontaire suivant.
12. Un contact ne peut jamais clôturer l'alerte.
13. Seul l'auteur peut clôturer son alerte.
14. Les rappels ont lieu toutes les cinq minutes pendant la durée choisie.
15. L'expiration des rappels ne clôture pas l'alerte.
16. La protection de trajet propose les trois modes définis.
17. Une position ancienne est toujours identifiée comme ancienne.
18. Une alerte programmée est traitée côté serveur et ne se déclenche pas deux fois.
19. Un paiement n'active Premium qu'après confirmation serveur.
20. Les fonctions essentielles de SOS restent accessibles gratuitement.
21. Les permissions refusées et limites PWA sont expliquées clairement.
22. Les utilisateurs ne peuvent accéder ni aux alertes ni aux positions d'autres utilisateurs sans autorisation explicite.

## 21. Tests obligatoires

- Tests unitaires des règles de destinataires, niveaux, rôles et états.
- Tests d'intégration de création/clôture d'alerte.
- Tests de concurrence pour l'attribution du répondant principal.
- Tests d'idempotence des rappels et alertes programmées.
- Tests de sécurité des accès croisés et permissions.
- Tests de paiement avec notifications de prestataire authentifiées.
- Tests sur Android et iOS pour permissions, push, localisation et limites en arrière-plan.
- Tests de réseau lent, perte de réseau, retour réseau et fournisseur indisponible.
- Tests de révocation d'un contact et de changement d'abonnement.
- Tests d'accessibilité et de lisibilité en situation de stress.

## 22. Déploiement et exploitation

Le déploiement doit être progressif : environnement de développement, environnement de test, préproduction, puis production. Les secrets, sauvegardes, alertes de monitoring, journaux et procédures de restauration doivent être prêts avant lancement. Les migrations de base de données doivent être versionnées et réversibles lorsque c'est possible.

## 23. Points à décider avant la mise en production

Les éléments non tranchés sont consignés dans `DECISIONS_ET_POINTS_A_VALIDER.md`. Ils comprennent notamment : durées de rappel, délai de confirmation de trajet, avantages Premium détaillés, limites des groupes, prestataires SMS et paiement, conservation des positions, récupération/suppression de compte, capacités exactes du SOS discret selon plateforme et choix final d'infrastructure.

---

**Règle de lecture :** une exigence marquée comme décidée est obligatoire. Une proposition technique ou un point à valider ne doit pas être transformé en décision utilisateur sans validation explicite.


## 21. Préparation à une application mobile Android et iOS

La première version est une PWA mobile-first. Cependant, le projet doit être structuré dès le départ pour pouvoir être emballé ensuite en application Android et iOS avec Capacitor, sans reconstruire les écrans ni réécrire les règles métier.

Exigences obligatoires :
- conserver les écrans et la logique métier indépendants de la plateforme ;
- isoler les capacités du téléphone derrière des interfaces dédiées dans `src/services/device/` ;
- prévoir des adaptateurs Web pour la PWA et des adaptateurs Capacitor ultérieurs pour Android/iOS ;
- ne pas appeler directement des plugins natifs depuis les composants d'interface ;
- garder les contrats API et les validations sensibles côté serveur ;
- documenter séparément les capacités réellement disponibles sur navigateur, Android et iOS ;
- tester les permissions, notifications, géolocalisation, reprise après suspension et fonctionnement réseau sur de vrais appareils avant toute promesse fonctionnelle ;
- ne pas considérer Capacitor comme une garantie de GPS continu, de SMS silencieux ou d'exécution permanente en arrière-plan.

Le passage à l'application mobile devra être une étape d'emballage et d'adaptation des capacités du terminal, et non une réécriture du produit. Toute évolution qui rendrait cette portabilité impossible ou imposerait une réécriture devra être signalée avant d'être adoptée.

## 22. Stack technique et règles de collaboration

La stack de référence est verrouillée pour tous les intervenants :
- interface : React ;
- bundler et environnement frontend : Vite ;
- langage applicatif : TypeScript ;
- styles : Tailwind CSS ;
- icônes : Lucide React ;
- backend : API REST via Cloudflare Pages Functions (`functions/api/`), en TypeScript ;
- base de données : Cloudflare D1 ;
- stockage privé : Cloudflare R2 si activé et autorisé sur le compte ;
- première plateforme : PWA mobile-first ;
- préparation native : Capacitor, isolé derrière les adaptateurs de terminal ;
- scripts de base de données : SQL lorsque le fournisseur retenu le nécessitera.

Claude, Qwen et tout autre assistant autorisé peuvent auditer, documenter, corriger et développer dans le même dépôt. Ils doivent :
1. lire `AGENTS.md`, `README.md`, le présent cahier des charges, l'architecture, les décisions et les consignes permanentes avant toute intervention ;
2. conserver exactement la stack, les langages, les conventions et l'architecture validés ;
3. ne pas migrer vers un autre framework, langage, bundler, backend ou dépôt sans accord explicite de l'utilisateur ;
4. travailler uniquement dans `benwahab/SAC`, sur l'unique branche `main` ;
5. vérifier le dernier commit avant chaque écriture et ne pas écraser le travail d'un autre intervenant ;
6. annoncer les fichiers modifiés, les contrôles exécutés et les limites restantes ;
7. distinguer clairement une proposition technique d'une décision validée.

Aucun assistant ne doit créer une branche parallèle, un dépôt miroir, un prototype concurrent ou une deuxième version de l'application.

## 23. Vérification multi-plateforme et critères de livraison

Avant une mise en production, les scénarios critiques doivent être testés au minimum sur :
- PWA installée et PWA ouverte dans un navigateur mobile ;
- Android sur appareil réel ;
- iOS sur appareil réel lorsque la version native sera engagée ;
- réseau mobile stable, réseau lent, perte de connexion et retour de connexion ;
- permissions de localisation accordées, refusées puis révoquées ;
- notifications autorisées, refusées et indisponibles ;
- application en premier plan, en arrière-plan et suspendue, en documentant les limites propres à chaque système.

Les tests doivent notamment vérifier qu'une alerte enregistrée reste consultable même si un canal de notification échoue, qu'aucun état de livraison n'est inventé, que les destinataires sont corrects, que la clôture reste réservée à l'auteur et que les rappels ne se dupliquent pas.

La livraison ne peut être déclarée prête que sur la base de résultats observés et consignés. Une compilation réussie ne suffit pas à prouver la fiabilité du SOS, du GPS, des notifications ou des SMS.
