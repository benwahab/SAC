# SAC — Consolidation générale de l'architecture

**Date de consolidation :** 18 novembre 2026  
**Statut :** référentiel de synthèse documentaire ; ne constitue ni une implémentation ni une autorisation de développement.  
**Dépôt :** `benwahab/SAC` — branche unique `main`.

## 1. Objet et règle de lecture

Ce document rassemble la vision d'ensemble de SAC et indique où se trouvent les spécifications détaillées. Il sert de point d'entrée commun à l'utilisateur, aux développeurs, à Claude, à Qwen et aux autres assistants autorisés.

Il faut toujours distinguer quatre états :
- **Décision validée** : choix explicitement accepté par l'utilisateur.
- **Proposition** : piste de conception qui nécessite encore validation.
- **Point ouvert** : arbitrage manquant.
- **État implémenté et vérifié** : fonctionnalité réellement présente dans le code et contrôlée par une preuve récente.

La présence d'une fonctionnalité dans ce document ou dans le cahier des charges ne signifie jamais qu'elle est implémentée.

### Ordre de référence en cas de divergence

1. Une validation explicite plus récente de l'utilisateur prévaut sur une ancienne décision.
2. Le registre des décisions et ses compléments datés précisent les décisions produit.
3. Le cahier des charges, l'architecture et les contrats détaillent leur application.
4. Les propositions restent des propositions tant qu'elles ne sont pas validées.
5. Le code et les tests décrivent l'état réellement construit ; ils ne peuvent pas modifier silencieusement une décision produit.
6. En cas de contradiction non résolue, suspendre l'action concernée, documenter le conflit et demander arbitrage.

Le document complémentaire [DECISIONS_COMPLEMENTAIRES_2026-11-18.md](DECISIONS_COMPLEMENTAIRES_2026-11-18.md) met notamment à jour l'identité visuelle et les langues de lancement.

## 2. Mission et périmètre

SAC signifie **Sécurité, Alerte, Citoyenne**.

SAC est une application privée de sécurité personnelle et familiale. Une personne prévient les proches de confiance qu'elle a choisis lorsqu'elle rencontre une situation de danger, une urgence ou souhaite sécuriser un déplacement.

SAC n'est pas :
- une plateforme publique de signalement ;
- un service de dispatch automatique vers la police, les pompiers, les hôpitaux ou une administration ;
- une garantie de fonctionnement lorsque le téléphone est éteint, sans batterie, hors couverture ou lorsque le système bloque l'application.

L'utilisateur conserve le contrôle de ses alertes, de ses contacts et des autorisations de partage de position.

## 3. Stack technique de référence — verrouillée

La stack déjà confirmée dans le dépôt reste la référence :

- Frontend : React, Vite, TypeScript, Tailwind CSS et Lucide React.
- API : API REST TypeScript avec Cloudflare Pages Functions dans `functions/api/`.
- Hébergement PWA : Cloudflare Pages.
- Base relationnelle : Cloudflare D1.
- Stockage objet privé : Cloudflare R2, uniquement après activation et autorisation sur le compte.
- Première livraison : PWA mobile-first.
- Préparation native : Capacitor pour Android/iOS, sans réécriture des écrans ni de la logique métier.
- Adaptateurs de capacités du terminal : `src/services/device/`.

**Ne pas migrer SAC vers Next.js, PostgreSQL, un autre framework ou un second backend sans décision explicite de l'utilisateur.** Les suggestions de Next.js/PostgreSQL évoquées dans certains blocs de conception conversationnels ne sont pas des décisions approuvées et ne remplacent pas la stack déjà verrouillée dans le dépôt.

Le frontend n'est jamais l'autorité pour les permissions, les destinataires, les paiements ou les transitions sensibles. Ces contrôles sont exécutés côté serveur.

## 4. Architecture fonctionnelle

### 4.1 Application citoyenne

Navigation fonctionnelle envisagée :
- Accueil.
- Mes proches.
- Mes alertes.
- Sécurité.
- Mon compte.

Fonctions prévues :
- inscription et vérification ;
- profil et préférences ;
- gestion des proches et invitations ;
- groupes privés ;
- SOS guidé et SOS critique immédiat ;
- suivi des alertes et coordination des proches ;
- Protection des trajets ;
- partage de localisation selon autorisation ;
- appareils et sécurité du compte ;
- abonnements et paiements ;
- centre d'aide et paramètres multilingues.

Les fonctions métier restent à développer ou à valider selon l'état décrit dans `TODO_SUPERVISION.md`.

### 4.2 Console professionnelle

La console professionnelle est une expérience séparée de l'application citoyenne. Elle est réservée à l'usage sur ordinateur et tablette selon les règles du document [CONSOLE_PROFESSIONNELLE_ET_SERVICES.md](CONSOLE_PROFESSIONNELLE_ET_SERVICES.md).

Le téléphone reste une expérience citoyenne, y compris pour les personnes qui disposent de permissions professionnelles. Les limites de détection d'appareil doivent être prises en compte ; aucun contrôle de type d'appareil ne doit être présenté comme infaillible.

### 4.3 Infrastructure

L'infrastructure regroupe :
- authentification et sessions ;
- API et autorisations serveur ;
- D1 et migrations versionnées ;
- stockage privé conditionnel ;
- tâches en arrière-plan et outbox ;
- notifications et intégrations externes ;
- journaux techniques et de sécurité ;
- sauvegardes, restauration et supervision.

Les fournisseurs OTP, push, SMS, paiement et cartographie ne sont pas réputés sélectionnés tant que leur choix n'est pas documenté et validé.

## 5. Identité visuelle, langues et expérience

Consulter [DECISIONS_COMPLEMENTAIRES_2026-11-18.md](DECISIONS_COMPLEMENTAIRES_2026-11-18.md) pour les décisions les plus récentes.

Direction visuelle actuelle :
- vert clair principal avec surfaces translucides et effet verre dépoli ;
- blanc ;
- rouge réservé aux alertes ;
- vert de confirmation distinct du vert principal ;
- aucun violet ni bleu nuit comme couleur principale ;
- sobriété, lisibilité, contrastes et interactions adaptées au mobile.

Langues de lancement retenues :
- français, langue par défaut ;
- anglais ;
- arabe avec prise en charge complète du RTL.

Hausa et Zarma sont des extensions ultérieures, pas des langues de lancement confirmées dans la décision la plus récente.

L'interface doit être mobile-first, légère sur réseau faible, accessible et compréhensible en situation de stress.

## 6. Comptes, contacts et appareils

Principes :
- toute inscription exige une adresse e-mail ; la vérification de cette adresse par OTP e-mail est une condition sine qua non de l'activation du compte ; aucun compte ne peut être créé ou activé par téléphone seul ;
- le téléphone reste obligatoire comme coordonnée déclarée, mais ne remplace jamais l'adresse e-mail ; aucun SMS OTP de compte n'est autorisé ;
- chaque compte possède ses propres données et moyens de contact vérifiés ;
- les invitations doivent être acceptées et vérifiées avant activation ;
- une invitation en attente ne donne aucun accès ;
- les relations de confiance sont directionnelles ;
- les groupes n'accordent aucun accès automatique aux alertes ou au GPS ;
- un utilisateur peut avoir plusieurs appareils ;
- chaque appareil possède ses propres sessions et clés privées ;
- le premier appareil racine approuvé est le seul autorisé à approuver de nouveaux appareils dans le modèle produit retenu ;
- un appareil secondaire ne peut pas s'autoproclamer racine ni approuver d'autres appareils ;
- la révocation serveur ne signifie pas effacement à distance d'un appareil hors ligne.

La récupération de l'accès au compte est distincte de la récupération de l'identité cryptographique. Voir le registre des décisions, le protocole multi-appareils et les documents de récupération déjà présents dans le dépôt.

## 7. SOS et coordination

Catégories :
- danger personnel ;
- accident ;
- intrusion au domicile ;
- urgence médicale ;
- personne perdue ou désorientée ;
- alerte personnalisée.

Niveaux :
- préventif ;
- urgent ;
- critique.

Deux parcours coexistent :
- SOS guidé : choix de la catégorie et du niveau ; possibilité de modifier ponctuellement les destinataires parmi les proches actifs, acceptés et vérifiés, sans modifier les préférences permanentes ;
- SOS critique immédiat : catégorie et destinataires préconfigurés, sans modification à la volée ni seconde confirmation générique.

La liste finale est vérifiée puis figée atomiquement au déclenchement.

Règles fondamentales :
- seul l'auteur peut annuler ou clôturer son alerte ;
- un accusé de réception est distinct d'une prise en charge ;
- le premier volontaire admissible devient responsable principal selon la transition serveur validée ;
- un seul responsable principal peut être actif à la fois ;
- un proche ne clôture jamais l'alerte de l'auteur ;
- la fin des rappels ne signifie pas que l'alerte est résolue ;
- aucune transmission n'est annoncée sans confirmation réelle du serveur.

Les détails transactionnels sont dans `docs/CONTRATS_OPERATIONS_ATOMIQUES_D1.md`, les machines à états dans `docs/MACHINES_ETATS_ET_CONSERVATION.md`, et le parcours dans `docs/PARCOURS_DECLENCHEMENT_SOS_V1.md`.

## 8. Notifications et escalade

- Les rappels push sont prévus toutes les cinq minutes.
- Le lanceur choisit de 1 à 5 rappels avant le seuil d'escalade SMS ; 2 rappels sont la valeur par défaut.
- Le seuil choisi concerne la bascule vers le SMS, pas la durée totale de l'alerte.
- L'accusé de réception et la candidature volontaire ne suffisent pas à arrêter les rappels.
- Une attribution effective du responsable principal peut arrêter l'escalade non encore engagée selon le contrat validé.
- Un SMS déjà accepté par le fournisseur peut encore être livré après annulation ou clôture.
- Accepté par le fournisseur, livré, lu et compris sont des états distincts.
- Le SMS n'est jamais garanti sans réseau cellulaire et fournisseur opérationnel.
- Les tâches doivent être côté serveur, récupérables et idempotentes ; elles ne dépendent pas de l'application ouverte.

Les fournisseurs et leurs contrats restent à choisir et à tester.

## 9. GPS et confidentialité — blocage absolu avant activation

L'exigence produit est ferme : les positions GPS précises doivent devenir irrécupérables au plus tard 30 jours après la fin du partage ; pour une position ponctuelle, le délai part de la collecte.

Après l'échéance, aucune restauration de sauvegarde, D1 Time Travel, snapshot, export, réplication, cache ou accès administratif ne doit rendre la position lisible.

État :
- aucun mécanisme de production ne prouve actuellement cette garantie ;
- aucun fournisseur KMS n'est approuvé ;
- les prototypes cryptographiques ne sont pas une preuve de destruction ;
- les scénarios GPS-01 à GPS-36 et les tests natifs restent à exécuter ;
- aucune collecte réelle de GPS précis ne doit être activée avant preuve.

Le relais éphémère de paquets chiffrés et l'historique local restent des pistes de conception, pas une autorisation de persister ou collecter des coordonnées réelles. Lire obligatoirement :
- `docs/PLAN_VALIDATION_DESTRUCTION_GPS_J30.md`
- `docs/SECURITE_GPS_DESTRUCTION_CRYPTO.md`

## 10. Déclencheur discret et Protection des trajets

Le Déclencheur discret est une fonction envisagée de déclenchement par trois pressions physiques rapides, sans écran SOS visible. Sa faisabilité dépend des capacités Android et probablement d'un composant natif. Une PWA seule ne garantit pas la détection lorsque le téléphone est verrouillé, arrêté ou bloqué en arrière-plan.

La Protection des trajets est organisée en trois modes, dont les règles et les délais détaillés doivent être vérifiés dans les documents existants. Les rappels de trajet sont distincts des rappels SOS.

Aucune promesse de fonctionnement universel ne doit être faite avant des tests réels sur appareils ciblés.

## 11. Abonnements

- Gratuit : jusqu'à deux proches.
- Premium : 5 000 FCFA par mois, jusqu'à dix proches.
- Le SOS essentiel et les fonctions fondamentales de sécurité restent gratuits.
- Les avantages Premium au-delà de la limite de contacts restent à préciser.
- Les moyens de paiement et fournisseurs restent à choisir.
- Aucun abonnement ne devient actif sans confirmation serveur fiable du fournisseur.
- Les simulations financières doivent être identifiées comme telles.

Le comportement complet à l'expiration, les remboursements et les périodes de grâce restent à arbitrer.

## 12. Console professionnelle et gouvernance

Le Super Admin conserve seul le pouvoir de créer, attribuer, modifier, suspendre et révoquer les missions, délégations et permissions.

Un collaborateur :
- possède un compte individuel ;
- n'accède qu'aux ressources de ses missions ;
- ne peut pas déléguer à son tour ;
- ne peut pas s'accorder des permissions ;
- ne peut pas créer un administrateur ;
- ne peut pas publier une communication institutionnelle sans autorisation.

La console comprend onze espaces principaux ; les services spécialisés sont regroupés dans ces espaces, pas ajoutés comme autant de menus indépendants. Voir `docs/CONSOLE_PROFESSIONNELLE_ET_SERVICES.md`.

Les accès administratifs ne constituent pas un droit général de lecture des données privées des citoyens.

## 13. Documents et archives

Tout document généré doit être automatiquement archivé dans sa rubrique d'origine avec :
- référence unique ;
- date ;
- auteur ;
- service ;
- version ;
- statut ;
- historique.

L'archivage intervient dès la génération, même si l'impression échoue. La génération, la validation, l'émission, la demande d'impression et la confirmation d'impression sont des événements distincts. Une boîte de dialogue d'impression ouverte ne prouve pas qu'une page est physiquement imprimée.

Le stockage des fichiers est séparé de la base relationnelle ; D1 conserve les métadonnées et références. Les politiques de conservation s'appliquent à tous les documents, et l'archive ne doit jamais contourner la destruction GPS J+30.

## 14. Données et modèle relationnel

La base cible est D1. Les tables décrites dans `docs/ARCHITECTURE_ET_MODELE_DONNEES.md`, `docs/SCHEMA_RELATIONNEL_D1_PROPOSITION.md` et les documents associés sont des propositions de conception tant qu'elles ne sont pas validées puis migrées.

Principes :
- une source de vérité par donnée ;
- pas de duplication d'une même opération dans plusieurs services ;
- contraintes relationnelles et opérations atomiques ;
- requêtes préparées ;
- contrôles d'accès par ressource et action ;
- index fondés sur les requêtes réelles ;
- séparation des journaux métier, techniques et de sécurité ;
- aucune donnée sensible ou secrète dans les logs.

Aucune migration D1 métier ne doit être créée avant validation du schéma, des états, des autorisations, de la conservation et des tests.

## 15. Services professionnels

La conception prévoit les fonctions RH, comptabilité, logistique, secrétariat, juridique et conformité, DSI, assistance, relations externes et pilotage. Leur détail est regroupé dans `docs/CONSOLE_PROFESSIONNELLE_ET_SERVICES.md`.

Les opérations entre services utilisent des références communes et des permissions distinctes. Exemple : un achat initié en logistique alimente la comptabilité via une référence commune ; il ne doit pas être saisi deux fois comme deux opérations indépendantes.

Aucun service supplémentaire de communication institutionnelle / relations publiques n'est ajouté.

## 16. Sécurité, tests et conditions de lancement

Le refus par défaut est la règle. Les permissions sont contrôlées côté serveur. Les secrets ne sont jamais enregistrés en clair ni exposés dans Git.

Les tests doivent couvrir :
- identité, sessions et appareils ;
- récupération de compte et identité racine ;
- invitations et relations ;
- création et cycle de vie SOS ;
- concurrence et idempotence ;
- notifications et escalade ;
- accès et révocation ;
- GPS J+30 ;
- paiements ;
- documents ;
- réseau faible ;
- Android/iOS et capacités natives ;
- sauvegardes et restaurations.

Un contrôle non exécuté n'est pas un contrôle réussi. Un point critique non vérifiable reste NO-GO.

## 17. État réel du dépôt au moment de la consolidation

Les documents du dépôt décrivent un socle technique initial déjà versionné : application React/Vite/TypeScript, interface mobile de démarrage, manifeste PWA, service worker minimal, interfaces d'adaptateurs Web, types partagés, route de santé Pages Functions contrôlant D1 et workflow CI. Des contrats TypeScript purs et des tests existent également pour certains cycles métier.

Cela ne signifie pas que les fonctions métier sont opérationnelles. Selon le README et le suivi de supervision :
- le SOS réel n'est pas implémenté ;
- l'authentification complète et les alertes métier ne sont pas implémentées ;
- les notifications réelles et fournisseurs SMS/push ne sont pas activés ;
- les paiements ne sont pas intégrés ;
- aucune migration métier D1 n'est validée ;
- le GPS réel est bloqué ;
- la console professionnelle n'est pas livrée.

L'état exact doit être vérifié à nouveau dans le code et la CI avant toute affirmation ultérieure.

## 18. Documents de référence existants

- `README.md` : point d'entrée du dépôt.
- `AGENTS.md` : consignes communes à Claude, Qwen et autres agents.
- `CLAUDE.md` : orientation Claude.
- `ARCHITECTURE.md` : stack et architecture de référence.
- `TODO_SUPERVISION.md` : suivi des tâches réellement vérifiées.
- `docs/CAHIER_DES_CHARGES_SAC.md` : exigences fonctionnelles et techniques.
- `docs/ARCHITECTURE_ET_MODELE_DONNEES.md` : architecture et modèle conceptuel.
- `docs/DECISIONS_ET_POINTS_A_VALIDER.md` : décisions et arbitrages ouverts.
- `docs/DECISIONS_PRODUIT_RESTANTES.md` : propositions restant à valider.
- `docs/MATRICE_AUTORISATION_ROLES.md` : matrice des permissions proposée.
- `docs/MACHINES_ETATS_ET_CONSERVATION.md` : transitions et conservation.
- `docs/CONTRATS_OPERATIONS_ATOMIQUES_D1.md` : opérations transactionnelles D1.
- `docs/PLAN_VALIDATION_DESTRUCTION_GPS_J30.md` : tests GPS obligatoires.
- `docs/SECURITE_GPS_DESTRUCTION_CRYPTO.md` : étude de destruction cryptographique.
- `docs/CONFORMITE_DONNEES_NIGER.md` et `docs/MISE_A_JOUR_JURIDIQUE_NIGER_NOV_2026.md` : analyse juridique à faire confirmer.
- `docs/AUDIT_DEPENDANCES_ET_REPRODUCTIBILITE.md` : audit des dépendances et reproductibilité.

## 19. Règle de maintenance de ce document

Toute nouvelle décision validée doit être ajoutée au registre correspondant et répercutée ici si elle modifie l'architecture générale. Toute modification doit préciser sa date, son statut et les documents affectés.

Ce document est un index de cohérence, pas un substitut aux contrats techniques détaillés.

## Gouvernance et sécurité administrative — complément du 18 novembre 2026

Les documents suivants détaillent le modèle cible de gouvernance et de sécurité :
- `docs/CATALOGUE_RESSOURCES_MATRICE_PERMISSIONS.md` : ressources et permissions par rôle.
- `docs/CLASSIFICATION_DONNEES_ET_ACCES_ADMIN.md` : sensibilité et minimisation des données.
- `docs/GOUVERNANCE_MISSIONS_ADMIN_ET_CYCLE_DE_VIE.md` : missions, suspension et révocation.
- `docs/MODELE_MENACES_ET_PLAN_SECURITE_ADMIN.md` : menaces, contrôles et critères de mise en production.

Ces documents sont des spécifications et analyses. Ils ne signifient pas que la console administrative ou ses contrôles sont opérationnels.


## Contrats transactionnels administratifs — complément du 18 novembre 2026

`docs/CONTRATS_OPERATIONS_ADMIN_ATOMIQUES.md` formalise les commandes sensibles : missions, permissions, suspension de compte, clôture administrative dans le scénario spécifique validé, consultations sensibles, exports et journal d'audit. Il décrit aussi les courses concurrentes, l'idempotence et les tests d'intégration. Il reste une conception non implémentée.


## Modèle de données administratif — complément du 18 novembre 2026

`docs/MODELE_DONNEES_ADMIN_ET_INTEGRATION_SAC.md` consolide les identités, rôles, missions, permissions, périmètres, sessions, dossiers de clôture administrative, consultations, exports et journaux. Il signale les contradictions à résoudre avant le schéma D1, notamment la différence entre clôture ordinaire par l'auteur et exception administrative dans le scénario spécifique du titulaire suspendu. Il reste conceptuel.


## Modèle global des données — consolidation du 18 novembre 2026

Le document `MODELE_GLOBAL_DONNEES_SAC.md` relie les domaines comptes, identités, appareils, proches, groupes, alertes, réponses, trajets, programmation SOS, notifications, abonnements/paiements et administration. Il fixe `accounts` comme identité canonique, documente les écarts entre le cahier des charges, la proposition D1 et le code, et maintient le statut NON PRÊT POUR MIGRATION. Les contrats spécialisés et les décisions produit restent les références détaillées.


## Revue finale de cohérence relationnelle — 18 novembre 2026

`docs/REVUE_FINALE_COHERENCE_MODELE_RELATIONNEL.md` examine les cardinalités, clés étrangères composites, suppressions, courses concurrentes, machines à états et domaines non spécifiés. Il classe les blocages P0/P1/P2 et confirme que le modèle n'est pas prêt pour migration D1.


## Arbitrage P0 — compte et preuve des proches

Le document `ARBITRAGE_P0_CYCLE_COMPTE_ET_PREUVE_PROCHES.md` consolide les cinq états validés, la matrice de transitions, les divergences de `account-lifecycle.ts` et la séparation entre coordonnée, preuve de destination et consentement. La règle d'activation par e-mail vérifié est désormais obligatoire pour tous les comptes. Le document `CONTRAT_CYCLE_VIE_PROCHES_ET_INVITATIONS.md` rassemble le parcours de bout en bout : invitation, acceptation, refus, expiration, retrait, révocation, réinvitation, contrôles anti-abus et tests. Les valeurs et comportements recommandés mais non approuvés sont détaillés dans `PROPOSITIONS_ARBITRAGE_INVITATIONS_ET_REVOCATION.md` : durée/relances, anti-abus, révocation symétrique et droits pendant une alerte active.

## Conservation des alertes et suppression GPS — décision confirmée du 18 novembre 2026

Le contrat de référence est docs/CONTRAT_CONSERVATION_ALERTES_ET_PURGE.md et prévaut sur les formulations plus anciennes de ce document concernant le GPS J+30 :

- à la clôture effective d'une alerte, ses positions GPS sont supprimées immédiatement ;
- seule la nature/catégorie de l'alerte reste dans l'historique pendant 30 jours ;
- à J+30 après clôture, l'alerte et sa catégorie sont supprimées définitivement ;
- sauvegardes et restaurations ne peuvent jamais faire réapparaître les positions ou alertes supprimées.

Les 30 jours ne sont pas une durée de conservation GPS. Le GPS réel reste NO-GO jusqu'à preuve technique indépendante de la suppression immédiate, de la purge J+30 et de la non-résurrection après restauration.

## Politique générale de conservation — proposition du 18 novembre 2026

Le document [PROPOSITION_POLITIQUE_GENERALE_CONSERVATION_DONNEES.md](PROPOSITION_POLITIQUE_GENERALE_CONSERVATION_DONNEES.md) propose une matrice non GPS couvrant les comptes, identités, appareils, sessions, invitations, relations, groupes, notifications, journaux, support, exports et données administratives/financières. Toutes les durées nouvelles restent à arbitrer et à faire examiner juridiquement. Le contrat spécialisé des alertes/GPS conserve sa priorité et ses règles validées ne sont pas modifiées.

## Appareils, sessions et récupération — référence transversale

Le document `CONSOLIDATION_APPAREILS_SESSIONS_ET_RECUPERATION.md` centralise les scénarios de perte/changement d'appareil, les sessions 30/90 jours validées, les règles de révocation, la séparation récupération du compte/enrôlement/racine, les divergences cryptographiques et les blocages V1. Les contrats spécialisés restent les références détaillées ; aucune récupération de racine n'est autorisée en V1.

## Sécurité des connexions et sessions

Le document `PROPOSITION_SECURITE_CONNEXIONS_ET_SESSIONS.md` formalise les menaces et contrôles à arbitrer concernant les tentatives frauduleuses, le vol/rejeu de session, les connexions multi-appareils, la révocation, les changements de mot de passe et les notifications. Il complète la consolidation appareils/sessions/récupération sans transformer ses recommandations en décisions validées.


## Protection des données et audit interne — complément du 18 novembre 2026

`docs/CONTRAT_PROTECTION_DONNEES_ACCES_INTERNES_ET_AUDIT.md` complète la matrice des permissions, la classification C0-C4, la gouvernance des missions, le modèle de menaces et les contrats transactionnels. Il détaille les consultations C3, la minimisation côté serveur, la séparation lecture/export, l'intégrité des journaux et les limites de contrôle du Super Admin. Les points ouverts restent à arbitrer ; aucune implémentation ou durée nouvelle n'est approuvée.


## Sécurité du cycle SOS — complément du 18 novembre 2026

`docs/CONTRAT_SECURITE_CYCLE_SOS_ET_INTEGRITE_ALERTES.md` complète le parcours de déclenchement, la matrice d'autorisation, les machines à états, les contrats transactionnels et le contrat de conservation. Il regroupe les menaces d'usurpation, de rejeu, de concurrence, de fuite entre destinataires, d'abus, de confusion entre états métier et transport, ainsi que les tests de restauration. Les décisions validées sont reprises sans modification ; les nouvelles options restent à arbitrer. Aucun code, fournisseur, mécanisme GPS ou service SOS réel n'est activé.


## Sécurité des notifications et communications — complément du 18 novembre 2026

`docs/CONTRAT_SECURITE_NOTIFICATIONS_ET_COMMUNICATIONS.md` complète les contrats SOS, invitations, sessions, confidentialité et conservation. Il formalise les frontières de confiance des canaux push/e-mail/SMS, la protection des abonnements, les webhooks, la distinction entre acceptation et livraison, les révocations, les pannes et la prévention des fuites. Le téléphone déclaré reste non vérifié et ne peut être considéré comme destination SMS fiable sans arbitrage/proof adaptée. Aucun fournisseur ou canal réel n'est activé.


## Sécurité des trajets et de la localisation — complément du 18 novembre 2026

`docs/CONTRAT_SECURITE_TRAJETS_ET_LOCALISATION.md` complète les propositions de trajets et les contrats SOS, GPS J+30, communications, invitations et confidentialité. Il formalise le consentement explicite, la sélection des proches, les trois modes, la révocation, la fraîcheur des positions, le réseau faible, les limites des copies externes et les tests de non-résurrection. Les valeurs de durée et la conservation GPS des trajets restent à arbitrer. Le GPS réel demeure NO-GO.


## Sécurité des comptes et appareils en situation d'urgence — complément du 18 novembre 2026

`docs/CONTRAT_SECURITE_COMPTES_ET_APPAREILS_EN_URGENCE.md` complète la consolidation comptes/sessions/appareils. Il formalise les scénarios de perte, vol, compromission, SIM swap, e-mail compromis et perte de tous les appareils. Il réaffirme la séparation stricte entre accès applicatif, appareil approuvé et racine cryptographique : en V1, aucune racine perdue ou compromise n'est remplaçable par OTP, mot de passe, SMS, support, Super Admin ou appareil secondaire. Les parcours d'urgence restent à arbitrer ; aucune implémentation n'est autorisée par ce document.


## Confidentialité familiale et isolation des données — complément du 18 novembre 2026

Lire `docs/CONTRAT_CONFIDENTIALITE_FAMILIALE_ET_ISOLATION_DONNEES.md` pour les règles de cloisonnement des comptes, relations de confiance, groupes, alertes, téléphones partagés, notifications, caches, recherches et exports. La famille ne constitue pas une autorité d'accès ; un proche ne reçoit pas le compte complet et un groupe n'hérite d'aucun droit SOS/GPS. Les mécanismes de verrouillage, de cache et les droits détaillés restent à arbitrer. Aucun changement applicatif n'est autorisé par ce document.


## Prévention des abus, usurpations et saturation — complément du 18 novembre 2026

`docs/CONTRAT_PREVENTION_ABUS_USURPATION_ET_SATURATION.md` complète les contrats SOS, communications, invitations, comptes/appareils, confidentialité et audit. Il traite le harcèlement, l'usurpation, les fausses alertes, les automatismes, le déni de service et les abus internes. Il réaffirme que l'anti-abus doit protéger la disponibilité du SOS : pas de blocage automatique fondé uniquement sur la fréquence des alertes, pas de CAPTCHA/paiement obligatoire par défaut et pas de dépendance externe dans le chemin critique. Les seuils et procédures restent à arbitrer ; aucune implémentation n'est autorisée.


## Résilience opérationnelle, continuité et reprise après incident — complément du 18 novembre 2026

`docs/CONTRAT_RESILIENCE_CONTINUITE_ET_REPRISE_INCIDENT.md` consolide les règles réseau faible/hors ligne, perte de réponse, pannes API/D1 et fournisseurs, outbox/worker, sauvegardes, restauration et exercices de reprise. Il rappelle que `/api/health` vérifie uniquement un accès D1 élémentaire et que le service worker PWA ne garantit aucun SOS hors ligne. La remise en service après restauration est conditionnée à la réconciliation des révocations et suppressions, et à la preuve de non-résurrection. RTO/RPO, SLA, fournisseurs et procédures opérationnelles restent à arbitrer ; aucune infrastructure n'a été modifiée.
