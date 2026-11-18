# SAC — Modèle de menaces et plan de sécurité de l'administration

Date : 18 novembre 2026  
Statut : analyse de conception à réviser lors de l'architecture technique ; aucune mesure n'est réputée implémentée par ce document.

## 1. Périmètre et objectifs

Ce modèle couvre les comptes administratifs, rôles, missions, permissions, sessions, accès aux données, clôtures administratives, exports et journaux d'audit. Il complète la matrice des permissions, la classification des données et la gouvernance des missions.

Objectifs de sécurité :
- empêcher toute élévation de privilèges et toute délégation non autorisée ;
- empêcher l'accès hors mission et hors périmètre ;
- protéger les données personnelles et les alertes ;
- garantir qu'une révocation bloque les actions futures ;
- préserver l'intégrité et la traçabilité des décisions ;
- éviter qu'une compromission d'un compte administratif permette d'effacer ses traces.

## 2. Actifs et frontières de confiance

Actifs critiques :
1. identité et état des comptes administratifs ;
2. secrets d'authentification, sessions et mécanismes de récupération ;
3. rôles, permissions, missions et délégations ;
4. alertes SOS, proches, réponses, interventions et décisions de clôture ;
5. données personnelles, exports et pièces jointes ;
6. journaux d'audit et preuves d'intégrité ;
7. clés cryptographiques et secrets d'infrastructure.

Frontières de confiance à imposer dans l'architecture :
- navigateur administratif / API serveur ;
- utilisateur connecté / service d'autorisation ;
- service applicatif / D1 ;
- application / stockage d'exports et pièces jointes ;
- application / fournisseur e-mail et notifications ;
- opérateurs techniques / données métier ;
- journal opérationnel / journal d'audit protégé.

Le navigateur, les champs envoyés par le client, les rôles affichés dans l'interface et les identifiants fournis par l'utilisateur ne sont jamais des sources d'autorité. Le serveur recalcule l'identité, l'état, les droits, la mission et le périmètre pour chaque action.

## 3. Adversaires et erreurs à considérer

- compte administratif compromis par hameçonnage, mot de passe réutilisé ou appareil perdu ;
- délégataire malveillant ou agissant hors de sa mission ;
- utilisateur ordinaire tentant d'appeler directement une API administrative ;
- attaquant externe exploitant une faille applicative ;
- agent de support consultant des données sans motif ;
- erreur de configuration accordant un droit trop large ;
- tâche asynchrone ou export achevé après révocation ;
- administrateur tentant d'altérer ou d'effacer ses propres traces ;
- fuite par sauvegarde, journal technique, fichier exporté ou fournisseur tiers ;
- erreur humaine lors d'une clôture d'alerte ou d'une suspension.

## 4. Scénarios de menace et contrôles requis

| Menace | Exemple | Contrôles requis |
|---|---|---|
| Élévation de privilèges | Un délégataire modifie son rôle via une requête HTTP | Autorisation serveur, refus par défaut, aucune confiance dans les champs client, tests négatifs |
| Délégation illicite | Un administrateur sécurité crée un autre administrateur | Gestion des délégations réservée au Super Admin ; API séparée et protégée |
| Accès hors périmètre | Une mission sur une alerte permet de lire les autres | Vérification ressource + action + périmètre à chaque requête |
| Session volée | Un attaquant réutilise un cookie ou jeton | Cookies sécurisés si utilisés, protection CSRF adaptée, révocation centrale, durée limitée, détection d'anomalies |
| Mission révoquée mais cache actif | Un ancien droit reste accepté | Vérification serveur de la version/état de mission ; invalidation et revalidation des tâches longues |
| Export après révocation | Un fichier préparé reste téléchargeable | Recontrôle à la génération et au téléchargement ; liens courts, révocables et liés au bénéficiaire |
| Abus d'accès Support | Consultation de proches sans dossier | Vue minimisée, dossier obligatoire, permission ponctuelle, journalisation |
| Falsification de clôture | Un acteur non habilité ferme une alerte | Permission dédiée, contrôle serveur, preuve de vérification, journal append-only |
| Altération d'audit | Suppression d'un événement gênant | Stockage séparé/protégé, droits d'écriture restreints, chaînage ou scellement vérifiable, copies de contrôle |
| Fuite de secrets | OTP ou jeton écrit dans les logs | Filtrage central, tests de non-divulgation, secrets jamais sérialisés |
| Fuite par sauvegarde | Données supprimées encore récupérables | Politique de sauvegarde et de purge cohérente ; exigence GPS J30 testée séparément |
| Compromission fournisseur | E-mail ou stockage tiers exposé | Minimisation, secrets dédiés, scopes minimaux, rotation, revue contractuelle et procédure d'incident |

Ces contrôles sont des exigences cibles. Ils ne constituent pas la preuve de leur présence dans le code.

## 5. Exigences techniques transversales

### Autorisation
- Appliquer deny-by-default.
- Contrôler côté serveur chaque opération de lecture, écriture, recherche, téléchargement et export.
- Évaluer ensemble identité, état du compte, session, rôle, mission active, permission atomique, ressource, périmètre et contexte.
- Ne jamais utiliser la seule visibilité d'un bouton ou d'une route front-end comme contrôle de sécurité.
- Ne pas permettre qu'un cumul de missions élargisse implicitement les droits.
- Vérifier de nouveau les droits au moment de finaliser toute opération différée.

### Authentification et session
- Ne jamais stocker de mot de passe en clair ; utiliser une fonction de hachage de mot de passe adaptée et paramétrée selon les recommandations actuelles.
- Ne jamais journaliser mot de passe, OTP, secret de récupération, clé privée ou jeton brut.
- Séparer authentification, vérification e-mail, autorisation et approbation d'un nouvel appareil.
- La validation OTP e-mail ne confère aucun rôle ni permission.
- Appliquer la règle générale approuvée : 30 jours d'inactivité et 90 jours maximum absolus.
- Les contrôles supplémentaires spécifiques aux administrateurs restent à arbitrer.

### Journal d'audit
- Écrire les événements côté serveur ; ne jamais accepter du client le contenu faisant autorité.
- Séparer les traces de diagnostic technique des événements métier et du journal de sécurité.
- Rendre les événements append-only, horodatés en UTC, corrélés et protégés contre les modifications.
- Prévoir une vérification indépendante d'intégrité et une alerte sur rupture de séquence ou d'empreinte.
- Restreindre l'accès au journal et journaliser les consultations et exports du journal lui-même.
- Définir la conservation, la purge et les obligations légales avant implémentation.

### Données et exports
- Minimiser les champs affichés et exportés.
- Masquer par défaut les identifiants et coordonnées non nécessaires.
- Ne pas exposer les secrets ni les données GPS précises dans les outils administratifs.
- Protéger les fichiers exportés au repos et en transit ; contrôler chaque téléchargement et supprimer les fichiers temporaires selon une politique validée.
- Ne pas créer d'export global par défaut.

## 6. Gestion des incidents administratifs

Flux cible :
1. détecter ou recevoir un signalement ;
2. ouvrir un dossier d'incident avec identifiant et heure UTC ;
3. limiter l'exposition des données et préserver les éléments utiles ;
4. le Super Admin suspend la mission ou révoque les sessions concernées selon le périmètre ;
5. analyser les actions, consultations et exports pertinents ;
6. corriger la cause et renouveler les secrets compromis si nécessaire ;
7. notifier les personnes ou autorités compétentes lorsque les obligations applicables le requièrent ;
8. documenter la résolution, les décisions et les mesures préventives.

La réponse à incident ne doit jamais effacer les traces ni interrompre arbitrairement une alerte SOS déjà transmise. Les règles spécifiques de continuité d'alerte et de clôture administrative déjà documentées restent applicables.

## 7. Tests de sécurité obligatoires

- appels directs API sans permission ;
- falsification de rôle, mission, identifiant de ressource et périmètre ;
- accès croisé entre deux alertes et deux comptes ;
- réutilisation d'un OTP, défi, nonce ou jeton ;
- révocation pendant une session et pendant une opération asynchrone ;
- accès à un export après expiration ou révocation ;
- CSRF, XSS, injection et contrôle d'accès objet (IDOR) ;
- fuite de secrets dans réponses, erreurs, traces et outils de diagnostic ;
- tentative de modification/suppression des événements d'audit ;
- vérification de restauration et purge des données soumises à suppression irréversible ;
- tests de concurrence sur les opérations critiques ;
- tests de sauvegarde, restauration et reprise après incident.

Les tests doivent inclure des cas autorisés et refusés et être exécutés sur l'environnement de test, avec données synthétiques.

## 8. Conditions de passage en production

Aucune console administrative sensible ne doit être déclarée prête avant :
1. matrice de permissions approuvée et testée côté serveur ;
2. cycle de vie des missions implémenté et révocation vérifiée ;
3. authentification et récupération revues indépendamment ;
4. journal d'audit protégé et intégrité vérifiable ;
5. stratégie de sauvegarde, conservation et purge testée ;
6. tests de sécurité et de concurrence réussis ;
7. revue indépendante des flux sensibles et des dépendances ;
8. procédures d'incident, de restauration et de notification prêtes ;
9. conformité juridique vérifiée pour les données et traitements concernés ;
10. preuve de CI verte et de déploiement contrôlé, sans secrets dans les artefacts.

## 9. Risques bloquants connus

- Le GPS précis demeure NO-GO tant que la destruction irréversible après 30 jours, y compris sauvegardes et mécanismes de restauration, n'est pas démontrée.
- Les protocoles cryptographiques d'approbation d'appareils et de récupération de racine exigent une revue cryptographique indépendante.
- Le SOS réel, les notifications réelles et l'authentification complète ne doivent pas être présentés comme opérationnels avant implémentation et tests.
- Les durées de conservation des journaux et exports, ainsi que les exigences légales, restent à déterminer.

## 10. Portée

Analyse et exigences de conception uniquement. Aucun code, rôle actif, permission, endpoint, middleware, secret, fournisseur, table, migration D1, ressource Cloudflare ou déploiement n'est créé ou modifié par ce document.
