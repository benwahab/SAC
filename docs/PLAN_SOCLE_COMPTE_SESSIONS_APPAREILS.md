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

## 8. État de ce document

- **GO :** conception, audit, consolidation et préparation de tests isolés.
- **NO-GO :** migration D1, route d'authentification, fournisseur réel, session utilisateur active, enrôlement racine, GPS réel, SOS réel et déploiement.
- **Code applicatif modifié :** non.
- **Base Cloudflare modifiée :** non.
- **Branche créée :** non.
