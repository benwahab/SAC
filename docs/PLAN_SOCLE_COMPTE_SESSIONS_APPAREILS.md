# SAC — Plan d'exécution du socle compte, sessions et appareils

**Date :** 18 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche unique `main`  
**Statut :** plan de conception et de validation — aucune migration, route métier, intégration fournisseur ou ressource Cloudflare créée par ce document.

## 1. Objet et limites

Ce plan transforme les contrats existants en étapes d'exécution vérifiables pour le premier espace personnel SAC : inscription, connexion, profil, sessions, appareils et, dans une étape ultérieure, proches de confiance.

La stack reste React + Vite + TypeScript + Cloudflare Pages Functions + D1, PWA d'abord. Aucun second backend, aucune migration Next.js et aucune branche nouvelle.

Le dépôt contient actuellement des fonctions de domaine pures et des tests, mais pas de véritable authentification HTTP. La route `GET /api/health` ne prouve que l'accès à D1. La base `sac-db` a été observée vide lors de l'audit en lecture seule du 18 novembre 2026.

**Ce plan n'autorise pas** :
- une migration D1, même sur la base de production ;
- une route d'inscription, connexion, récupération ou gestion d'appareils ;
- l'envoi d'un OTP réel ou l'ajout de secrets fournisseur ;
- l'activation d'une racine cryptographique, d'un partage GPS ou d'un SOS réel ;
- une modification de ressources Cloudflare ou un déploiement.

Ces actions exigent une validation distincte après revue des contrats et tests.

## 2. Décisions à respecter

1. La vérification du compte et la confiance cryptographique sont deux autorités différentes.
2. Le canal OTP de compte retenu est l'e-mail. Aucun SMS OTP ni fallback SMS ne doit être ajouté. Le SMS est réservé à l'escalade d'urgence selon le contrat SOS.
3. Un OTP valide prouve uniquement le contrôle temporaire du canal e-mail. Il ne remplace jamais une racine, n'approuve jamais un appareil et ne restaure aucune clé privée.
4. Le kit de récupération personnel est généré localement, affiché une seule fois, à usage unique ; son secret brut ne transite pas et n'est jamais stocké en clair côté serveur. Son protocole de preuve doit être spécifié avant implémentation.
5. Le premier appareil approuvé établit l'autorité racine selon le protocole qui sera finalement homologué. Un appareil secondaire ne peut pas s'auto-approuver ni se promouvoir racine.
6. Un appareil révoqué ne peut plus ouvrir ou renouveler de session. La révocation ne supprime pas le compte, les proches, les alertes ou l'historique.
7. La récupération du compte ne restaure pas l'ancienne racine. Après perte de tous les appareils approuvés, toute nouvelle racine constitue une nouvelle identité et requiert un ré-ancrage indépendant des contacts.
8. Les changements de réseau ou d'adresse IP, fréquents sur les réseaux mobiles, ne doivent pas à eux seuls bloquer l'utilisateur.
9. Aucun GPS précis n'est collecté ou persisté tant que la destruction irréversible à J+30, y compris sauvegardes et restaurations, n'a pas été prouvée.

## 3. Ordre de réalisation

### Étape A — fermer les arbitrages avant le SQL

- Comparer les contrats de compte, récupération, appareil et schéma D1 ; résoudre les contradictions et marquer chaque choix comme décidé, proposé ou bloquant.
- Définir le cycle complet des états de compte : création en attente, actif, suspendu, suppression en attente et suppression terminée.
- Définir le comportement d'une adresse e-mail déjà utilisée sans révéler l'existence du compte.
- Fixer les règles OTP : durée, nombre d'essais, renvoi, invalidation, consommation unique, limites anti-abus et réponses fournisseur ambiguës.
- Fixer la durée, le renouvellement, la rotation et la révocation des sessions.
- Fixer le transport PWA et le transport Capacitor, sans supposer qu'un cookie web et un jeton natif ont les mêmes protections.
- Finaliser le protocole de récupération du compte et la preuve d'utilisation unique du kit de récupération.
- Faire relire indépendamment le protocole multi-appareils et la cérémonie racine. Les propositions cryptographiques existantes ne sont pas considérées homologuées.

**Sortie attendue :** registre des décisions fermé pour le périmètre compte/session/appareil. Tout point non tranché reste explicitement bloquant.

### Étape B — concevoir le schéma D1 minimal

Le schéma relationnel existant est une proposition utile, pas un SQL prêt à appliquer. Les familles suivantes sont candidates et doivent être normalisées avec la revue du schéma :

| Famille | Responsabilité | Données interdites |
|---|---|---|
| `accounts` | Identifiant opaque, état, langue, dates | Secrets d'authentification |
| `account_identities` | E-mail normalisé, statut de vérification, identité principale | OTP brut |
| `auth_challenges` | Finalité, empreinte protégée, essais, expiration, consommation | Code OTP en clair |
| `user_devices` | Plateforme, libellé, état, dates, version d'autorisation | Clé privée |
| `account_identity_keys` | Clé publique racine, empreinte, génération, état | Clé privée racine |
| `device_public_keys` | Clés publiques et usages versionnés | Clé privée appareil |
| `device_certificates` | Certificat, signature, transcript et preuve de cérémonie | Secret de cérémonie |
| `device_sessions` | Compte/appareil, empreinte de jeton, expiration, révocation | Jeton brut |
| `security_events` | Événements d'audit minimaux et append-only | OTP, jetons, clés, GPS |
| `idempotency_records` | Empreinte de commande et résultat stable | Corps privé complet |

Ne pas créer automatiquement toutes ces tables : certaines familles peuvent être fusionnées ou séparées selon les contraintes D1 et les opérations atomiques. Toute relation doit avoir ses clés étrangères, index, contraintes d'unicité, règles de suppression et politique de rétention explicites.

Les valeurs e-mail doivent être normalisées de manière documentée. Les identifiants sont opaques et générés avec un générateur cryptographiquement sûr. Les dates sont UTC, définies par le serveur.

**Règles SQL impératives :**
- requêtes préparées et paramètres liés ;
- unicité pour les identités normalisées selon la politique retenue ;
- un seul appareil racine actif par compte, si et seulement si le protocole racine est validé ;
- contraintes d'état et transitions conditionnelles ;
- index couvrant les recherches par compte, état et expiration ;
- aucune position GPS précise, clé privée, OTP brut, jeton brut ou secret de récupération ;
- aucune suppression en cascade qui effacerait les preuves d'une alerte ou d'un audit encore nécessaires.

### Étape C — spécifier le socle API serveur

Toutes les routes futures seront sous `/api/v1/`. La route de santé existante reste séparée.

Contrats candidats, non implémentés :
- démarrer l'inscription ;
- terminer la vérification e-mail ;
- ouvrir une session ;
- lire et modifier le profil autorisé ;
- lire les sessions/appareils du compte ;
- fermer une session ;
- révoquer un appareil ;
- demander une récupération de compte.

Chaque route doit avoir validation serveur stricte, authentification et autorisation propres, limite de taille, anti-abus, journalisation minimale, réponses non énumérantes, codes d'erreur stables et tests. Aucun succès ne doit être annoncé avant le commit D1 et la confirmation de l'effet métier.

Le contexte d'autorisation est construit côté serveur depuis la session et D1. Un identifiant, rôle, statut d'appareil ou `account_id` fourni par le client n'est jamais une preuve d'autorité.

Pour les sessions web, étudier un cookie `Secure`, `HttpOnly`, `SameSite` adapté avec protection CSRF et contrôle d'origine. Pour Capacitor, spécifier séparément le stockage sécurisé, la rotation et la révocation des jetons. Ne pas conserver de jeton dans localStorage, URL, logs ou messages d'erreur.

### Étape D — OTP e-mail sans fournisseur fictif

Avant le fournisseur :
- définir une interface d'adaptateur indépendante du fournisseur ;
- spécifier les états : créé, envoi demandé, accepté, échec certain, résultat ambigu, consommé, expiré, invalidé ;
- protéger les codes courts contre les attaques hors ligne : un simple hash non salé d'un code à faible entropie est insuffisant ;
- garantir consommation unique et résistance au rejeu ;
- limiter par compte, destination, appareil et fenêtre temporelle sans verrouillage global injustifié ;
- ne jamais révéler si une adresse est déjà inscrite.

Le fournisseur e-mail doit être choisi et configuré explicitement. Tant que l'envoi réel et les retours ambigus ne sont pas testés, l'inscription et la connexion ne doivent pas afficher de vérification réussie. Aucun code de démonstration ne doit être présenté comme un OTP réel.

### Étape E — sessions et appareils

- Chaque session est rattachée à un compte et à un appareil précis.
- Chaque requête protégée vérifie côté serveur la session, l'état du compte, l'état de l'appareil, la version d'autorisation et l'expiration.
- Révoquer un appareil invalide ses sessions, renouvellements et abonnements push associés, sans révoquer les autres appareils actifs.
- Une session révoquée ne peut pas être renouvelée à partir d'un ancien jeton.
- Les appareils en attente n'accèdent à aucune donnée privée.
- Les secondaires ne peuvent ni approuver un autre appareil ni se promouvoir racine.
- La révocation ne prétend jamais effacer les données ou clés déjà présentes hors ligne sur un téléphone.

Le protocole d'ajout secondaire doit être revu cryptographiquement avant toute route d'enrôlement. QR, code de jumelage et affichage d'empreinte ne suffisent pas sans transcript canonique, liaison au défi, protection anti-rejeu, vérification de signature et tests d'interopérabilité.

### Étape F — profil et proches

Le profil personnel est limité aux données nécessaires : nom d'affichage si retenu, langue, préférences et coordonnées vérifiées. Les coordonnées privées ne sont jamais renvoyées dans les réponses d'un autre compte.

La gestion des proches commence seulement après validation du socle compte/session. Une invitation en attente n'accorde aucun accès. Le destinataire accepte sa propre invitation après vérification ; l'acceptation ne crée pas de relation inverse. La révocation bloque les nouvelles autorisations. Les règles d'accès d'un contact révoqué pendant une alerte active doivent être arbitrées avant l'implémentation des routes de proches.

## 4. Tests obligatoires avant toute activation

### Tests de domaine et de validation
- OTP expiré, incorrect, consommé, rejoué, invalidé et trop d'essais ;
- adresse normalisée, collision d'identité, tentative d'énumération ;
- session expirée, révoquée, mauvais compte, mauvais appareil, version d'autorisation obsolète ;
- appareil en attente ou révoqué ;
- tentative de promotion secondaire ou d'approbation sans racine ;
- récupération d'accès sans restauration de racine ;
- kit de récupération réutilisé ou présenté sous forme invalide.

### Tests D1 et concurrence
- deux inscriptions simultanées avec la même identité ;
- consommation OTP simultanée par deux requêtes ;
- création et révocation de session concurrentes ;
- deux révocations du même appareil ;
- tentative de créer deux racines actives ;
- rejeu d'une même clé d'idempotence avec contenu identique puis différent ;
- rollback et état cohérent si une instruction conditionnelle affecte zéro ligne ;
- reprise après interruption entre commit métier et effet externe.

### Tests HTTP et sécurité
- absence de session, cookie invalide, CSRF, origine inconnue, CORS ;
- brute force et limites de renvoi ;
- réponses identiques contre l'énumération ;
- absence de secrets dans logs, traces, erreurs et réponses ;
- aucune confiance dans les champs d'autorisation envoyés par le client ;
- PWA et Android Capacitor testés séparément.

Les tests D1 doivent être exécutés sur une base locale/Preview isolée avant toute migration de production. Les tests de concurrence doivent prouver le comportement réel de D1 ; un batch n'est pas réputé atomique selon le métier simplement parce qu'il est groupé.

## 5. Portes de validation (GO / NO-GO)

| Porte | Conditions GO | Conditions NO-GO |
|---|---|---|
| G1 — décisions | Contrats sans contradiction et arbitrages clos | OTP, sessions ou racine encore ambigus |
| G2 — schéma | Revue SQL, contraintes et rétention approuvées | Schéma seulement conceptuel ou tables non justifiées |
| G3 — tests D1 | Intégration, concurrence, rollback et restauration testés en isolé | Course ou transaction non prouvée |
| G4 — fournisseur | Fournisseur choisi, secrets gérés, envoi réel et ambiguïtés testés | OTP simulé, clé absente ou livraison non vérifiée |
| G5 — sécurité | Revue indépendante, sessions et appareils vérifiés | Appareil secondaire auto-approuvable, secret exposé |
| G6 — activation | Déploiement explicitement autorisé et procédure de retour testée | Simple présence de code ou CI verte prise pour une validation produit |

La CI verte valide les contrôles automatisés exécutés ; elle ne vaut pas homologation cryptographique, validation humaine, test Android réel ou preuve d'envoi e-mail.

## 6. Décisions encore bloquantes à inscrire au registre

1. Politique exacte de mot de passe et d'authentification de connexion, en cohérence avec la vérification e-mail.
2. Durée OTP, nombre d'essais, délai de renvoi, durée de blocage ciblée et politique anti-abus.
3. Fournisseur e-mail et gestion des secrets par environnement.
4. Durée absolue et inactive des sessions, renouvellement et révocation globale.
5. Transport de session PWA et transport natif Capacitor.
6. Durée de conservation des challenges, sessions et événements de sécurité.
7. Protocole cryptographique final d'enrôlement et de révocation racine.
8. Preuve technique de validation à usage unique du kit de récupération.
9. Procédure de suppression de compte et traitement des alertes/historiques en cours.

## 7. Prochaine séquence de travail

1. Fermer les arbitrages ci-dessus sans toucher à D1.
2. Réviser la proposition de schéma relationnel et produire un diagramme de relations stable.
3. Produire les contrats de routes et types partagés, toujours sans endpoint actif.
4. Écrire les tests d'intégration D1 sur base isolée et vérifier les transactions conditionnelles.
5. Soumettre schéma, contrats et tests à revue de sécurité.
6. Demander une autorisation explicite avant de créer la première migration et le middleware.
7. Choisir/configurer le fournisseur e-mail seulement après approbation du parcours OTP.
8. Implémenter progressivement, puis tester en Preview avant toute activation de production.



## Sécurité de l'administration et traçabilité — cadre de conception du 18 novembre 2026

### 1. Autorité et délégations

Les règles produit déjà validées restent la référence :

- Le Super Admin est l'autorité suprême. Lui seul crée les délégations, attribue les missions et permissions, les modifie, les suspend ou les retire.
- Un délégataire ne peut jamais déléguer à son tour, créer un administrateur, modifier ses propres droits ou élargir le périmètre de sa mission.
- Les permissions sont individuelles, explicites et limitées à une action et à un périmètre définis. Tout droit non attribué est refusé par défaut.
- La permission de clôture administrative d'une alerte dans le scénario de compte suspendu reste distincte. Elle est réservée au Super Admin, ou à un administrateur sécurité auquel le Super Admin l'a explicitement attribuée. Support, auditeur, proches et titulaire suspendu n'ont pas ce droit.
- La délégation de clôture ne peut être transmise par son bénéficiaire. Une seule personne habilitée suffit ; aucune double validation n'est requise.
- L'administration SAC reste accessible sur ordinateur et tablette, pas sur téléphone.

### 2. Autorisation technique obligatoire

La visibilité d'un bouton ou d'une page ne constitue jamais une autorisation. Chaque opération administrative doit être autorisée côté serveur, au moment de l'action, à partir de l'identité de session et des droits enregistrés côté serveur.

Le contrôle doit vérifier au minimum : compte et session actifs, identité de l'acteur, rôle effectif, permission précise, périmètre de la ressource, état de la délégation et éventuelle révocation. Les rôles, permissions, identifiants d'acteur et périmètres envoyés par le navigateur ne sont jamais considérés comme une preuve.

Principes obligatoires :
- refus par défaut et liste explicite des opérations autorisées ;
- séparation entre lecture, modification, suspension, révocation, attribution de délégation et clôture d'alerte ;
- aucune auto-attribution, auto-élévation ou modification de ses propres droits par un délégataire ;
- contrôle serveur répété pour chaque requête, y compris les appels directs qui contournent l'interface ;
- révocation effective des droits et sessions administratives selon une règle serveur cohérente, sans attendre une reconnexion du navigateur ;
- opérations sensibles atomiques et protégées contre les doubles soumissions et le rejeu ;
- vérification du périmètre sur chaque objet afin d'empêcher l'accès à une autre région, équipe, mission ou alerte.

Une permission accordée pour une mission ne doit pas implicitement donner accès à toutes les fonctions du rôle. Le Super Admin doit pouvoir consulter les délégations et leurs traces, mais la consultation ne doit pas réécrire l'historique.

### 3. Journal d'audit non réinscriptible

Les événements de sécurité et d'administration doivent être conservés dans un journal append-only : une entrée enregistrée ne peut être ni modifiée ni supprimée par l'interface d'administration, y compris par le Super Admin. Une correction se fait par un nouvel événement explicatif qui référence l'événement initial ; elle ne remplace pas l'historique.

Chaque événement doit contenir, selon le type d'action et sans collecte excessive :
- identifiant unique de l'événement et horodatage UTC produit par le serveur ;
- identifiant de l'acteur, rôle effectif et permission utilisée ;
- type d'action, ressource cible et périmètre concerné ;
- résultat : autorisé, refusé, réussi, échoué ou résultat indéterminé ;
- motif obligatoire pour les décisions sensibles, notamment suspension, délégation et clôture d'alerte ;
- référence de corrélation de la requête et identifiant de session/appareil lorsque nécessaire ;
- référence à l'événement précédent ou à l'objet de décision, sans recopier les contenus privés ;
- pour une modification, empreintes ou références des valeurs avant/après lorsque cela est utile et sûr, plutôt que des secrets ou des données personnelles en clair.

Le journal doit notamment tracer les créations, changements, suspensions et retraits de délégations ; les tentatives d'élévation ou d'accès refusées ; les changements de permissions ; les consultations administratives sensibles ; les vérifications et décisions de clôture ; les notifications administratives et leurs échecs ; ainsi que les changements de configuration de sécurité.

Ne jamais écrire dans ces journaux : mots de passe, OTP, jetons de session, clés privées, secrets de récupération, contenu intégral de messages privés ou positions GPS précises. Les éléments de vérification d'une alerte doivent être référencés de manière minimale et protégée, sans transformer le journal en copie du dossier privé.

### 4. Intégrité, accès et conservation

L'accès au journal est en lecture seule pour les profils explicitement autorisés et limité au besoin d'en connaître. Un administrateur ne peut pas effacer ou masquer ses propres actions. Les consultations du journal et les exports doivent eux-mêmes être audités.

Une protection contre l'altération doit être conçue et testée : contrôle d'intégrité, détection des ruptures/suppressions et sauvegarde séparée avec droits restreints. Un chaînage cryptographique ou un stockage à rétention verrouillée peut être évalué, mais ne doit pas être déclaré inviolable sans preuve et revue indépendante. Le mécanisme exact ne sera choisi qu'après étude des capacités réelles de D1 et des solutions de conservation disponibles.

La durée de conservation, les obligations légales, la purge éventuelle et la séparation entre journal de sécurité et dossier métier restent à arbitrer. Aucune durée arbitraire n'est fixée ici. Une suppression de compte ne doit pas effacer les traces minimales dont la conservation est légalement et opérationnellement justifiée ; leur base, durée et accès doivent être documentés.

### 5. Renforcement des actions critiques — proposition à valider

À étudier avant implémentation : réauthentification ou confirmation OTP e-mail récente pour les opérations les plus sensibles (création/retrait d'une délégation, attribution d'une permission de clôture, clôture administrative d'une alerte, export massif). Cette mesure est une recommandation de sécurité, pas encore une décision produit validée. Elle ne doit jamais remplacer le contrôle d'autorisation serveur.

La durée et le renouvellement des sessions administratives, la protection contre le vol de session et les exigences de poste/appareil doivent faire l'objet d'une politique dédiée. Les limites utilisateur déjà validées (30 jours d'inactivité et 90 jours maximum) ne suffisent pas à elles seules à définir un niveau de sécurité adapté à l'administration.

### 6. Portée et portes avant réalisation

Ce cadre formalise les exigences et les points de conception. Il ne crée aucun rôle opérationnel, endpoint, middleware, journal D1, table, permission active, ressource Cloudflare ou écran d'administration. Avant toute implémentation : modèle de permissions formalisé, schéma d'audit revu, stratégie d'intégrité et de conservation arbitrée, tests d'accès négatifs et concurrence, puis revue de sécurité. Toute migration et tout changement de code exigent une autorisation distincte.


## 8. État de ce document

- **GO :** conception, audit, consolidation et préparation de tests isolés.
- **NO-GO :** migration D1, route d'authentification, fournisseur réel, session utilisateur active, enrôlement racine, GPS réel, SOS réel et déploiement.
- **Code applicatif modifié :** non.
- **Base Cloudflare modifiée :** non.
- **Branche créée :** non.


## 9. Cycle de vie du compte — décision validée le 18 novembre 2026

Le cycle de vie fonctionnel du compte comprend cinq états distincts :

| État | Signification | Accès et effets |
|---|---|---|
| `pending_verification` — En attente de vérification | Inscription créée, adresse e-mail principale pas encore vérifiée | Aucun accès aux fonctions privées ni création de session utilisateur. La vérification e-mail est une condition d'activation, pas une preuve de confiance cryptographique. |
| `active` — Actif | Adresse e-mail vérifiée et compte utilisable | Accès selon les permissions, l'état de l'appareil et la session. |
| `suspended` — Suspendu | Compte temporairement ou administrativement suspendu | Connexion et nouvelles activités bloquées ; sessions révoquées ; données conservées. Réactivation uniquement par une décision autorisée. |
| `deletion_pending` — Suppression en attente | Demande de suppression enregistrée | Aucune nouvelle activité ; les opérations déjà engagées et les alertes/trajets en cours doivent être traités selon les règles de clôture avant suppression définitive. |
| `deleted` — Supprimé | Suppression définitive terminée | État terminal : aucune connexion, restauration ou réactivation du compte supprimé. Les obligations de conservation de preuves minimales doivent être traitées séparément et documentées. |

### Séparation entre compte et identité e-mail

L'état de vérification de chaque identité e-mail est un attribut distinct. Une adresse peut être en attente de vérification sans que cela crée un sixième état du compte. Le compte ne passe à `active` qu'après confirmation serveur de l'adresse principale requise.

### Suspension et autorité

- Une suspension administrative ne peut être décidée que par le Super Admin.
- Un mécanisme de sécurité peut imposer un blocage technique temporaire d'une tentative ou d'une session à risque ; ce blocage n'est pas automatiquement une suspension administrative du compte.
- La suspension administrative doit conserver une trace : auteur, motif, date, éventuelle échéance et décision de réactivation.
- La suspension révoque les sessions existantes et interdit l'ouverture de nouvelles sessions ainsi que toute nouvelle activité métier.
- Les données du compte ne sont pas supprimées par la suspension.

### Point de sécurité encore bloquant : alertes déjà actives

Une suspension ne doit pas être interprétée comme une clôture ou une annulation automatique d'une alerte SOS déjà transmise. Le comportement précis permettant au titulaire suspendu de consulter, compléter ou clôturer une alerte existante reste à arbitrer. Les alertes déjà engagées doivent conserver leur continuité de traitement par les contacts et le système selon le contrat SOS. Aucun contournement de suspension ni session générale ne doit être ajouté pour résoudre ce cas sans décision explicite.

### Suppression en attente et suppression définitive

- L'entrée en suppression en attente bloque les nouvelles activités.
- Une alerte ou un trajet déjà engagé ne doit pas être abandonné par une suppression prématurée ; les conditions exactes de clôture doivent être vérifiées côté serveur.
- La suppression définitive n'est autorisée qu'après satisfaction des préconditions métier et de rétention applicables.
- `deleted` est terminal. Une éventuelle nouvelle inscription est un nouveau compte, jamais la restauration de l'ancien.

### Conséquences pour la suite technique

- Les cinq états sont validés au niveau produit et documentaire.
- Le contrat pur `src/domain/account-lifecycle.ts` n'est pas encore aligné : il n'accepte actuellement que `active`, `deletion_pending` et `deleted`. Son évolution et ses tests restent à faire dans une étape de code autorisée distinctement.
- La migration D1 doit attendre l'alignement des contrats, les règles de transition, les contraintes atomiques et la revue de sécurité.
- Cette décision documentaire n'autorise ni modification du code, ni migration D1, ni activation d'une route d'authentification.


## 10. Décision validée — continuité d'une alerte pendant la suspension

**Statut : principe produit validé par l'utilisateur le 18 novembre 2026.** Cette décision reste documentaire : elle n'autorise aucune route API, permission serveur, session, migration D1 ou modification du code.

### Principe de continuité

Une suspension administrative ne doit jamais annuler, masquer, mettre en pause ou interrompre automatiquement une alerte SOS déjà transmise. Le traitement de cette alerte devient indépendant de l'accès général au compte :

- les destinataires initialement sélectionnés conservent l'alerte ;
- les rappels continuent toutes les 5 minutes vers ces seuls destinataires jusqu'à la clôture ; aucun nouveau contact n'est ajouté automatiquement ;
- « J'ai reçu l'alerte » confirme la réception ; « Je prends la situation en charge » permet au premier répondant de devenir responsable principal, les autres pouvant également intervenir ;
- la suspension ne retire pas aux proches les informations et actions nécessaires au traitement de l'alerte déjà reçue.

### Accès du titulaire suspendu — principe validé

Le titulaire ne récupère pas son compte et ne reçoit aucune session générale. Pour éviter qu'une suspension empêche de mettre fin à une fausse alerte ou de confirmer sa sécurité, le principe d'une capacité d'urgence cryptographique strictement liée à cette seule alerte et à l'appareil d'origine est validé. Sa conception technique reste à spécifier et à faire examiner avant toute implémentation. Cette capacité ne pourra permettre que :

1. consulter l'état minimal de cette alerte précise ;
2. transmettre une mise à jour de sécurité ;
3. transmettre à l'administration SAC une demande de clôture de cette alerte précise, sans pouvoir la clôturer.

Elle ne permettrait jamais de se reconnecter, de consulter le profil ou les proches, de créer une alerte, de changer les destinataires, de modifier les paramètres du compte ou d'agir sur une autre alerte. Chaque action serait authentifiée côté serveur, limitée à l'identifiant de l'alerte, journalisée et protégée contre le rejeu. La révocation de session générale resterait immédiate.

### Garde-fou validé en cas d'abus lié à l'alerte

La capacité d'urgence ne doit pas donner au titulaire suspendu un pouvoir unilatéral de faire disparaître une alerte ou d'interrompre une assistance. La distinction suivante est validée :

- **Mise à jour de sécurité :** le titulaire conserve la possibilité de signaler qu'il est en sécurité, même si la suspension est liée à cette alerte. Cette mise à jour est horodatée, authentifiée et ajoutée à la trace ; elle ne clôture pas automatiquement l'alerte et n'efface aucun événement antérieur.
- **Clôture :** le titulaire suspendu peut signaler que l'alerte peut être clôturée et transmettre une demande à l'administration SAC, mais il ne clôture jamais lui-même l'alerte. Les proches, y compris le responsable principal, ne disposent pas non plus du pouvoir de clôture. Seule l'administration SAC décide et exécute la clôture, après vérifications adaptées, en préservant les preuves et en tenant compte de l'état de prise en charge.
- **Aucune suppression de preuve :** ni la mise à jour ni la demande de clôture ne peuvent supprimer, réécrire ou masquer les événements, accusés de réception, prises en charge ou éléments d'audit déjà enregistrés.

Les critères précis de contrôle, le profil administratif autorisé à clôturer et les notifications restent à spécifier. Une seule décision d'un administrateur SAC habilité suffit : aucune double validation ni approbation par un second administrateur n'est exigée.

### Vérification avant clôture — règle validée

L'administrateur habilité consulte la référence et le statut de l'alerte, le signalement du responsable principal, les accusés de réception, les prises en charge et les dernières mises à jour des proches. Il vérifie qu'aucune information récente ne signale un danger persistant et applique les contrôles renforcés en cas de suspicion d'abus lié à l'alerte.

- Si les informations fiables confirment que le danger est terminé et qu'aucun élément ne le contredit, un seul administrateur habilité peut clôturer l'alerte.
- Si un proche signale que le danger persiste, l'alerte n'est pas clôturée.
- Si les informations sont contradictoires ou insuffisantes, l'alerte reste active pendant les vérifications.
- Si le responsable principal est injoignable, l'administration peut vérifier auprès des autres proches ; son indisponibilité ne vaut pas confirmation.
- **Le silence ou l'absence de réponse d'un proche ne constitue jamais une preuve que la personne est en sécurité.** Si la fin du danger ne peut pas être vérifiée, l'alerte reste active et les rappels continuent toutes les 5 minutes vers les seuls destinataires initiaux, sans ajout automatique.

La décision de clôture, son motif, l'identité de l'administrateur et l'horodatage sont conservés dans la trace d'audit. Cette règle ne doit pas empêcher les contacts et les services d'urgence de poursuivre l'assistance.

### Limites et questions à arbitrer

- Définir la procédure administrative de clôture lorsque le titulaire n'a plus accès à son appareil, y compris la vérification des informations transmises par les proches ; une seule validation d'un administrateur habilité suffit.
- Définir les conditions de clôture, les notifications envoyées à tous les destinataires initiaux et la gestion des désaccords. Aucune double validation administrative n'est requise.
- Définir les garde-fous applicables si le compte est suspendu pour abus lié précisément à l'alerte en cours ; la capacité ne doit pas devenir un moyen de supprimer les preuves ou d'empêcher l'assistance.

**Principe validé :** une capacité d'urgence distincte, limitée à l'alerte existante, doit préserver la possibilité pour le titulaire de confirmer sa sécurité et de demander une clôture à l'administration SAC sans récupérer l'accès au compte. Seule l'administration SAC peut clôturer l'alerte ; aucun proche ni titulaire suspendu ne peut le faire. Les rappels continuent vers les seuls destinataires initiaux, toutes les 5 minutes, sans ajout automatique de contacts. Les permissions détaillées, les contrôles anti-abus et le protocole cryptographique restent à spécifier et à faire valider. Cette décision n'autorise ni code, ni route API, ni migration D1, ni changement de session.


## Procédure administrative de vérification avant clôture — décision validée le 18 novembre 2026

Dans le scénario précis d'un compte suspendu avec une alerte SOS déjà transmise et un risque d'abus associé, l'administration SAC suit cette procédure avant toute clôture :

1. Identifier l'alerte, sa référence, son statut et son appareil d'origine.
2. Examiner le signalement du responsable principal, les accusés de réception, les prises en charge et les dernières mises à jour des contacts.
3. Lorsque cela est possible, tenter de joindre directement le titulaire de l'alerte par un canal disponible. Cette tentative ne lui confère aucun pouvoir de clôture.
4. Comparer les informations reçues et rechercher tout indice récent de danger persistant ou toute contradiction.
5. Si les informations sont contradictoires, insuffisantes ou ne permettent pas de vérifier la fin du danger, maintenir l'alerte active et les rappels vers les seuls destinataires initiaux.
6. Ne jamais interpréter l'absence de réponse d'un proche ou du titulaire comme une confirmation de sécurité.
7. Après vérification suffisante, un seul administrateur SAC habilité peut décider et exécuter la clôture dans ce scénario ; aucune double validation n'est obligatoire.

La déclaration du titulaire indiquant qu'il est en sécurité est une information à examiner, pas une clôture automatique. Ni le titulaire suspendu ni un proche, y compris le responsable principal, ne clôture cette alerte. Un proche peut signaler la fin supposée de la situation et demander une clôture administrative.

Cette procédure est une règle produit/documentaire. Elle n'implémente aucune route, permission, notification, session spéciale ou migration D1.


## Habilitation à la clôture administrative d'une alerte suspendue — décision validée le 18 novembre 2026

Dans le scénario d'une alerte SOS déjà transmise pendant la suspension du compte initiateur, avec risque d'abus associé, les profils autorisés sont définis ainsi :

- Le Super Admin SAC peut clôturer après les vérifications prévues.
- Un administrateur sécurité ne peut clôturer que si le Super Admin lui a attribué explicitement et individuellement cette permission.
- Aucun droit de clôture n'est accordé par défaut à un administrateur délégué.
- Le support, l'auditeur, les proches et le titulaire suspendu ne peuvent pas clôturer cette alerte.

La permission de clôture est distincte des autres permissions administratives. Seul le Super Admin peut attribuer, modifier, suspendre ou retirer cette délégation. Le délégataire ne peut ni transmettre ce droit ni le déléguer à son tour. Une seule personne habilitée suffit pour décider et exécuter la clôture ; aucune double validation n'est exigée.

Chaque décision de clôture doit conserver une trace d'audit comprenant au minimum l'identité de l'administrateur, la référence de l'alerte, la date et l'heure, le motif et les éléments de vérification consultés. L'espace d'administration SAC est réservé à un usage sur ordinateur ou tablette ; son accès administratif depuis un téléphone n'est pas prévu.

Ces règles sont documentaires. Elles n'implémentent aucun rôle, permission, endpoint ou contrôle d'accès opérationnel et n'autorisent aucune migration D1.


## Tentatives de contact direct du titulaire avant clôture — règle documentaire du 18 novembre 2026

Dans le scénario précis d'une alerte déjà transmise pendant la suspension du compte initiateur, l'administrateur habilité suit une séquence de contact traçable :

1. À l'ouverture de l'examen, envoyer une notification privée via le canal SAC disponible, sans exposer les informations de l'alerte à un tiers.
2. Si le numéro déclaré à la création du compte est disponible, effectuer jusqu'à trois tentatives d'appel : première tentative immédiatement, deuxième environ cinq minutes après, troisième environ cinq minutes après la deuxième. Ne pas considérer une sonnerie, un message vocal ou un accusé technique comme une réponse du titulaire.
3. En complément, envoyer un message écrit privé au titulaire par un canal de contact disponible. Le message demande uniquement de confirmer sa situation et, si nécessaire, de fournir des éléments permettant de vérifier la fin du danger. Il ne contient pas de données sensibles inutiles.
4. Consigner chaque tentative : date et heure, canal, résultat objectif (appel abouti, sans réponse, occupé, échec technique, message envoyé) et identité de l'administrateur. Distinguer clairement un envoi technique d'une lecture ou d'une réponse réelle.
5. Si aucun canal direct n'est disponible ou si le titulaire ne répond pas, noter cette impossibilité et poursuivre l'examen avec les éléments fiables déjà disponibles. L'absence de réponse n'est jamais une preuve de sécurité et ne déclenche jamais une clôture automatique.

Le délai indicatif de cette séquence d'appels est d'environ dix minutes entre la première et la troisième tentative. Il ne constitue ni un délai maximal de danger ni une échéance automatique de clôture. Si les éléments restent insuffisants, contradictoires ou invérifiables, l'alerte demeure active et les rappels continuent vers les seuls destinataires initiaux. L'administrateur habilité peut poursuivre les vérifications ultérieurement.

Une réponse du titulaire est un élément à examiner, pas une autorisation de clôture. La clôture reste une décision de l'administrateur SAC habilité selon la procédure déjà validée. Aucun proche ni le titulaire suspendu ne peut clôturer cette alerte.

Cette séquence est une règle produit documentaire. Elle ne suppose pas qu'un numéro de téléphone soit vérifié, ne crée aucun nouveau canal, n'envoie actuellement aucun message et n'autorise aucune implémentation technique ou migration D1.


## Numéro de téléphone obligatoire à la création du compte — décision validée le 18 novembre 2026

Chaque utilisateur SAC doit obligatoirement renseigner un numéro de téléphone lors de la création de son compte. Ce champ est requis : la création du compte ne peut pas être finalisée sans numéro. Le numéro doit être enregistré avec son indicatif international afin de permettre son identification et son utilisation correcte, notamment si l'utilisateur change de pays.

Cette obligation de collecte ne signifie pas à elle seule que le numéro est vérifié. Les règles de changement et de mise à jour du numéro restent à spécifier. La vérification initiale du compte repose uniquement sur l'OTP e-mail.

Pour la procédure administrative de vérification d'une alerte suspendue, le numéro déclaré peut être utilisé comme coordonnée de contact sans vérification téléphonique indépendante. Une réponse provenant de ce numéro ne prouve pas à elle seule l'identité de l'interlocuteur ; elle doit être appréciée et recoupée. L'absence de réponse ne prouve jamais la sécurité et ne permet pas de clôture automatique.

Cette décision est documentaire et n'implémente aucun champ, validation, SMS, service externe, endpoint ou migration D1.


## Vérification du compte par OTP e-mail uniquement — clarification validée le 18 novembre 2026

La vérification du compte SAC se fait par OTP envoyé à l'adresse e-mail. Lorsque l'utilisateur saisit correctement l'OTP e-mail, son adresse e-mail est considérée comme vérifiée et le processus de création du compte peut être validé selon le parcours d'inscription.

Le numéro de téléphone reste obligatoire à la création du compte, mais SAC ne demande aucune vérification indépendante de ce numéro : pas de SMS OTP, pas d'appel automatisé de validation, pas de procédure supplémentaire destinée à prouver que l'utilisateur en est propriétaire. La vérification de l'e-mail suffit pour la vérification initiale du compte.

Le numéro fourni peut être utilisé comme coordonnée de contact déclarée, notamment pour les tentatives d'appel administratif. Toutefois, une réponse provenant de ce numéro ne prouve pas à elle seule l'identité de l'interlocuteur : l'administrateur doit apprécier les éléments de réponse et les recouper avec le contexte de l'alerte. Les tentatives sans réponse ne prouvent jamais que le titulaire est en sécurité.

Cette décision remplace toute formulation antérieure qui laissait entendre qu'une vérification du numéro de téléphone serait nécessaire avant son utilisation comme coordonnée de contact. Elle ne modifie pas la vérification OTP par e-mail et n'autorise aucun SMS OTP.


## Notification des proches après clôture administrative — règle de conception

Lorsque l'administrateur SAC habilité clôture cette alerte, chacun des destinataires initiaux doit être informé individuellement de la clôture par les canaux de notification SAC disponibles et activés pour son compte. La notification indique uniquement que l'alerte concernée a été clôturée par l'administration, avec la date et l'heure. Elle ne révèle ni les échanges privés avec le titulaire, ni les éléments d'enquête, ni les notes internes, ni les coordonnées d'autres personnes.

La clôture administrative met fin aux rappels de cette alerte pour tous les destinataires initiaux. Les accusés de réception, prises en charge, mises à jour et événements antérieurs restent conservés et consultables selon les droits applicables ; ils ne sont ni supprimés ni réécrits. L'échec d'une notification est journalisé et ne réouvre pas automatiquement l'alerte. L'administration doit pouvoir constater quels destinataires ont été notifiés et lesquels n'ont pas pu être joints par les canaux SAC.

Cette notification informe de la décision ; elle ne donne aucun pouvoir de clôture aux proches. La règle décrit le comportement attendu et n'implémente aucun service push, e-mail, SMS, endpoint ou migration D1.

## Modèle de rôles, permissions et missions — cadre de conception du 18 novembre 2026

### 1. Trois notions distinctes

- **Rôle :** catégorie fonctionnelle d'un compte administratif (Super Admin, administrateur sécurité, support, auditeur). Un rôle décrit une fonction générale ; il ne suffit jamais à autoriser une opération sensible.
- **Permission :** droit précis sur une action déterminée (par exemple consulter un dossier, examiner un événement, gérer une session ou clôturer une alerte dans le scénario expressément prévu). Une permission doit être accordée explicitement et ne se déduit pas d'un intitulé de rôle.
- **Mission :** délégation encadrée accordée par le Super Admin à une personne, pour un objectif, un périmètre, des actions, des limites et une période définis. La mission est le cadre d'exercice des permissions déléguées ; elle ne crée aucun pouvoir de délégation.

Un compte ne reçoit aucun droit par défaut du simple fait qu'il existe, qu'il appartient à une équipe ou qu'il connaît une URL administrative. Le principe est le refus par défaut.

### 2. Rôles fonctionnels et droits de base

| Rôle | Fonction | Droits de base et limites |
|---|---|---|
| Super Admin | Autorité suprême et gouvernance de SAC | Accès complet aux fonctions administratives prévues, gestion exclusive des délégations/missions, attribution et retrait des permissions, arbitrage des opérations réservées. Ses actions restent journalisées. |
| Administrateur sécurité | Traitement des incidents et contrôles de sécurité | Aucun pouvoir de délégation. Reçoit uniquement les permissions explicitement accordées par le Super Admin. La clôture administrative d'une alerte du scénario spécial n'est possible que si cette permission distincte lui a été attribuée. |
| Support | Assistance et traitement des demandes autorisées | Accès limité aux informations strictement nécessaires à l'assistance. Aucun droit de délégation, d'attribution de permissions, de clôture administrative d'alerte ou d'effacement de traces. |
| Auditeur | Contrôle et vérification | Lecture seule des éléments expressément inclus dans son périmètre. Aucun droit de modification, de suspension, de délégation, de clôture ou de suppression. Ses consultations et exports autorisés sont tracés. |

Les rôles Support et Auditeur ne donnent pas accès automatiquement à toutes les données des utilisateurs. Le Super Admin doit encore définir le périmètre utile et les données visibles. Les droits précis non expressément accordés restent refusés.

### 3. Familles de permissions séparées

Le catalogue doit distinguer au minimum les familles suivantes, sans les fusionner dans un droit général « administrateur » :

1. **Consultation :** voir une ressource ou un dossier déterminé, dans un périmètre défini.
2. **Assistance :** réaliser les seules opérations de support explicitement listées ; aucune modification sensible implicite.
3. **Sécurité :** examiner des événements, traiter un incident ou révoquer une session uniquement si le droit correspondant est attribué.
4. **Gestion des comptes :** consulter ou traiter un état de compte selon des permissions distinctes ; suspension administrative réservée au Super Admin, sauf arbitrage ultérieur explicite.
5. **Gestion des délégations :** créer, attribuer, modifier, suspendre et retirer une délégation ou mission ; ces actions sont réservées au Super Admin.
6. **Clôture administrative d'alerte :** permission isolée, accordée par le Super Admin à un administrateur sécurité nommé. Elle n'est pas incluse automatiquement dans le rôle Administrateur sécurité et ne peut pas être transmise.
7. **Audit et export :** consultation et export sont deux permissions différentes. Un droit de lecture n'autorise pas un export massif.
8. **Configuration :** chaque domaine de configuration doit avoir ses propres permissions ; aucune permission générale de configuration ne doit être implicite.

Une permission précise doit comporter une action, une ressource/type de ressource, un périmètre et, si nécessaire, des conditions. Les verbes « consulter », « créer », « modifier », « suspendre », « révoquer », « clôturer » et « exporter » ne sont jamais interchangeables.

### 4. Définition obligatoire d'une mission

Toute mission attribuée par le Super Admin doit préciser :

- l'identité unique du délégataire et le rôle fonctionnel sous lequel il agit ;
- l'objectif et la description compréhensible de la mission ;
- les permissions exactes accordées, action par action ;
- le périmètre des ressources : service, équipe, région, dossier ou alerte, selon le besoin ;
- les limites explicites et opérations interdites ;
- la date de début, la date de fin ou le caractère sans échéance, qui doit être exceptionnel et réexaminé ;
- les conditions de suspension, de révocation et de fin de mission ;
- le motif de l'attribution et la référence de décision du Super Admin.

Une mission est personnelle, non transférable et non sous-délégable. Le délégataire ne peut pas ajouter un bénéficiaire, inviter un autre administrateur, attribuer une tâche avec des droits administratifs ou modifier le périmètre. Il peut signaler un besoin au Super Admin, qui décide lui-même d'une éventuelle nouvelle délégation.

Aucune permission ne doit être plus large que la mission qui la porte. Si plusieurs missions existent, leurs périmètres ne fusionnent pas en un accès global : chaque action doit correspondre à une mission active et à une permission explicite. Une mission expirée, suspendue ou révoquée n'autorise plus aucune action.

### 5. Règles de calcul des droits et contrôles

Pour chaque requête, le serveur doit vérifier simultanément :

1. le compte et la session de l'acteur sont actifs ;
2. la mission concernée existe, est active et appartient à cet acteur ;
3. la permission précise autorise l'action demandée ;
4. la ressource appartient au périmètre de la mission ;
5. aucune suspension, révocation, expiration ou règle de sécurité ne bloque l'action ;
6. les conditions spécifiques à l'action sont satisfaites.

Si une condition manque, le serveur refuse l'action. L'interface peut masquer les fonctions non autorisées pour la clarté, mais ce masquage n'est jamais le contrôle de sécurité.

Les permissions ne sont pas héritées automatiquement entre rôles, équipes, missions ou utilisateurs. Aucun droit implicite par cumul de plusieurs rôles. En cas de conflit, la règle la plus restrictive prévaut et le refus est journalisé. Le Super Admin reste l'unique autorité d'attribution ; les délégataires ne peuvent modifier ni leur rôle effectif ni les permissions stockées.

### 6. Cycle de vie d'une mission et traçabilité

États de conception : brouillon non actif, active, suspendue, expirée, révoquée et terminée. Seul le Super Admin peut activer, modifier, suspendre, reprendre, révoquer ou terminer une délégation. Toute transition doit être auditée avec acteur, date/heure serveur, motif, ancienne et nouvelle portée, permissions concernées et résultat.

Une modification de mission ne doit jamais élargir rétroactivement les droits déjà utilisés. Les événements passés conservent le contexte et les permissions effectives au moment de l'action. La révocation doit être prise en compte côté serveur sans dépendre d'un rafraîchissement de l'interface.

### 7. Cas spécial : clôture administrative d'une alerte

La permission de clôture demeure séparée et réservée au Super Admin ou à l'administrateur sécurité expressément habilité par lui. Le droit est nominatif, non transférable, limité au scénario de clôture déjà documenté et contrôlé à chaque action. Le support, l'auditeur, les proches et le titulaire suspendu ne peuvent pas clôturer cette alerte. Une seule personne habilitée suffit ; aucune double validation n'est exigée. Les vérifications, le motif et la décision sont consignés dans le journal d'audit.

### 8. Éléments restant à spécifier avant implémentation

- le catalogue exhaustif des ressources SAC et des actions métier ;
- les périmètres disponibles (global, service, région, dossier, alerte) et leurs règles de combinaison ;
- les opérations exactes autorisées au Support et les champs visibles par ce rôle ;
- les vues et exports précis accessibles à l'Auditeur ;
- les durées par défaut des missions, alertes d'expiration et éventuel renouvellement par le Super Admin ;
- les conditions de suspension d'urgence d'une mission et les effets sur les sessions déjà ouvertes ;
- les éventuels conflits entre missions, ainsi que la procédure de demande d'extension au Super Admin.

Ces points ne doivent pas être résolus par des permissions trop larges. En attendant leur arbitrage, aucun droit supplémentaire n'est accordé par défaut.

### 9. Portée

Ce modèle est une spécification documentaire, pas un système actif. Il ne crée ni rôle opérationnel, ni compte administrateur, ni permission, ni mission, ni écran, ni endpoint, ni middleware, ni table ou migration D1. Le modèle doit être transformé en matrice testable, relu en sécurité et explicitement autorisé avant toute implémentation.



## Catalogue des ressources et matrice de permissions

La matrice de référence et le catalogue des ressources sont détaillés dans [docs/CATALOGUE_RESSOURCES_MATRICE_PERMISSIONS.md](CATALOGUE_RESSOURCES_MATRICE_PERMISSIONS.md). Ce document complète les principes de rôles, missions, moindre privilège et contrôle côté serveur. Il reste documentaire et n'autorise aucune implémentation.
