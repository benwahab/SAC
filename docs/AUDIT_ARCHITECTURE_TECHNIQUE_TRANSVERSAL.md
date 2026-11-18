# SAC — Audit transversal de l'architecture technique

**Date :** 18 novembre 2026  
**Dépôt :** `benwahab/SAC`  
**Branche :** `main`  
**Commit de référence :** `e1020c0a363031622839308e6127ddc9d5250803`  
**Statut :** audit documentaire et lecture du code existant. Aucune API métier, migration, ressource Cloudflare, intégration fournisseur ou fonctionnalité SOS n'est créée par cet audit.

## 1. Conclusion exécutive

**Architecture de départ cohérente, mais application non prête pour une ouverture publique ni pour un SOS réel.**

Le socle choisi est cohérent avec la cible : React, Vite, TypeScript, Tailwind, Pages Functions, D1, PWA mobile-first et préparation Capacitor par adaptateurs. Le dépôt est encore petit, lisible et ne comporte pas de backend métier prématurément construit.

En revanche, l'état réellement présent est très éloigné de l'architecture cible :
- l'interface est une landing page ; le bouton SOS est désactivé ;
- une seule route backend existe : `GET /api/health` ;
- aucune authentification serveur, session persistée, route d'alerte, relation de confiance, outbox, scheduler ou notification réelle n'est implémenté ;
- D1 est référencée dans la configuration, mais aucune migration ni table métier n'existe ;
- aucun adaptateur Capacitor natif n'existe ;
- les contrats métier et tests sont principalement purs/in-memory, pas des tests d'intégration avec D1 ou Pages Functions.

C'est une bonne décision de ne pas avoir activé le SOS avant ces fondations. Il faut maintenant transformer les documents en contrats implémentables, par ordre de dépendance, et non ajouter directement des écrans ou des fournisseurs.

## 2. Périmètre vérifié

Arborescence GitHub complète de `main` examinée (arbre non tronqué). Fichiers principaux relus :
- `ARCHITECTURE.md`
- `package.json`
- `src/App.tsx`, `src/main.tsx`
- `functions/api/health.ts`
- `src/domain/sac.ts`
- `src/domain/session-authorization.ts`
- `src/domain/device-management.ts`
- `src/services/device/contracts.ts`
- `src/services/device/web.ts`
- `src/services/device/device-certificate.ts`
- `src/services/location/crypto.ts`
- `src/services/location/key-exchange.ts`
- `wrangler.toml`, `vite.config.ts`
- `tsconfig.app.json`, `tsconfig.functions.json`
- `.github/workflows/ci.yml`
- `public/sw.js`, `public/manifest.webmanifest`
- `migrations/README.md`
- `docs/ARCHITECTURE_ET_MODELE_DONNEES.md`
- `docs/MATRICE_AUTORISATION_ROLES.md`
- `docs/CONTRATS_OPERATIONS_ATOMIQUES_D1.md`
- `docs/DECISIONS_PRODUIT_RESTANTES.md`
- `AGENTS.md`, `CLAUDE.md`, `QWEN.md`

La vérification GitHub a retourné une seule branche : `main`. Cet audit ne constitue pas une revue ligne par ligne de chaque document et chaque test.

## 3. Constats techniques

### A-01 — Le backend métier n'existe pas encore

**Niveau : CRITIQUE / BLOQUANT AVANT SOS**

L'arborescence `functions/api/` ne contient que `health.ts`. Cette route vérifie l'accès à D1 avec `SELECT 1`, mais ne fournit aucune authentification, autorisation, gestion de compte, relation, alerte ou notification.

Les domaines TypeScript présents décrivent des règles métier, mais leurs commentaires précisent qu'ils ne persistent rien et ne remplacent pas les contrôles serveur.

**Conséquence :** le statut « API et base de données accessibles » affiché sur la landing page signifie seulement que la route de santé a réussi son test SQL. Il ne signifie pas que le backend SAC est prêt, sécurisé ou capable d'envoyer une alerte.

**Suite obligatoire :** construire d'abord une couche serveur commune d'identité/session, de validation, de contrôle d'accès et d'erreurs ; chaque route métier devra utiliser ces contrats sans faire confiance aux identifiants ou rôles envoyés par le navigateur.

### A-02 — Aucune persistance métier D1 n'est installée

**Niveau : CRITIQUE / BLOQUANT AVANT DONNÉES RÉELLES**

`wrangler.toml` déclare le binding D1 `DB` et la base `sac-db`. `migrations/README.md` confirme qu'aucune table métier n'a été créée. La matrice D1 indique elle-même que le schéma n'est pas prêt.

**Suite obligatoire :**
1. terminer les arbitrages de conservation, révocation et suppression ;
2. figer un schéma minimal avec FK, contraintes, index et règles `ON DELETE` ;
3. écrire des migrations versionnées et réversibilité/rollback documentés ;
4. tester D1 local, puis Preview isolée ;
5. autorisation distincte avant toute application distante.

Ne pas créer toutes les tables conceptuelles d'un seul coup. Implémenter les domaines par incréments testables.

### A-03 — Contradiction documentaire sur le GPS à corriger

**Niveau : CRITIQUE**

Le document `docs/ARCHITECTURE_ET_MODELE_DONNEES.md` contient encore une proposition historique de tables `alert_locations` et `trip_locations`, de conservation GPS 30 jours et de purge D1. D'autres sections plus récentes, `AGENTS.md`, `docs/SECURITE_GPS_DESTRUCTION_CRYPTO.md` et les audits récents imposent au contraire : aucun GPS réel/historique tant que la destruction irréversible à J+30 n'est pas démontrée ; aucune position précise dans D1/R2/logs/sauvegardes.

La section historique présente aussi D1 Time Travel et une purge de rattrapage, alors que les règles les plus récentes disent explicitement qu'une purge SQL et une restauration suivie de purge ne suffisent pas à la garantie exigée.

**Décision :** les règles NO-GO les plus récentes prévalent. La section historique ne doit pas être utilisée comme instruction de développement. Il faudra corriger/annoter le document source avant de commencer le schéma SQL. Aucun stockage GPS n'est autorisé par le présent audit.

### A-04 — L'authentification et les sessions sont seulement des contrats purs

**Niveau : CRITIQUE**

`session-authorization.ts` évalue un enregistrement de session fourni par l'appelant et précise que les valeurs doivent venir de la session authentifiée et de D1. Il n'y a pas de route, de cookie/session token, de hash persistant, de rotation, de révocation ou de vérification D1 à chaque requête dans le backend actuel.

Le certificat d'appareil et le protocole multi-appareils restent expérimentaux. `AGENTS.md` signale des lacunes non résolues dans le transcript de cérémonie et la liaison du défi serveur.

**Suite obligatoire :** définir le contrat de transport de session, CSRF si cookie, rotation/expiration, stockage de hash, invalidation par appareil et tests de concurrence. Ne pas traiter la fonction pure comme une authentification déployée.

### A-05 — Les adaptateurs de terminal ne couvrent qu'une partie des capacités

**Niveau : ÉLEVÉ / BLOQUANT AVANT PARCOURS NATIFS**

`contracts.ts` définit actuellement :
- un adaptateur de géolocalisation ;
- un adaptateur de permission notifications ;
- un adaptateur de partage.

`web.ts` fournit les implémentations navigateur. Il n'y a pas de stockage sécurisé, de tâche d'arrière-plan, de canal SMS, de gestion de liens profonds, de biométrie, de réveil, de détection de désactivation, de synchronisation ou d'adaptateur Capacitor.

Ce n'est pas un défaut pour une première landing page, mais le contrat actuel ne suffit pas encore à la promesse « Capacitor sans réécriture ».

**Suite obligatoire :** définir uniquement les abstractions réellement nécessaires aux parcours approuvés, documenter le comportement Web vs natif et ajouter les adaptateurs natifs au moment où la cible native sera autorisée. Ne pas ajouter une interface abstraite pour chaque fonctionnalité hypothétique.

### A-06 — Les capacités PWA sont limitées et le service worker est minimal

**Niveau : ÉLEVÉ**

Le service worker met en cache l'app shell et les assets, exclut explicitement `/api/` et utilise le réseau en premier pour les navigations. C'est une base prudente : les réponses API privées ne sont pas mises en cache par ce worker.

Limites observées :
- pas de synchronisation en arrière-plan ;
- pas de file locale fiable pour SOS ;
- pas de stratégie de reprise de commandes API ;
- pas de notification push ni gestion de subscription ;
- pas de versionnement complet des assets ou stratégie explicite de mise à jour au-delà du cache shell ;
- le manifest ne déclare pas d'icônes PWA.

Une PWA ne peut pas garantir un envoi SOS quand le navigateur est fermé, suspendu, privé de réseau ou empêché d'exécuter du code. Le cache de l'app shell ne change pas cette limite.

**Suite obligatoire :** définir précisément les garanties en ligne/hors ligne. Une alerte ne doit jamais être affichée comme envoyée si le serveur n'a pas confirmé son enregistrement. Ajouter les icônes validées quand l'identité visuelle sera approuvée. Tester sur appareils réels et réseaux faibles.

### A-07 — La chaîne CI existe, mais son résultat actuel n'est pas établi

**Niveau : ÉLEVÉ**

Le workflow `.github/workflows/ci.yml` exécute Node 22, installation npm, typecheck, suites unitaires ciblées, build et audits npm. L'audit complet des dépendances est configuré `continue-on-error: true`, donc un problème de dépendance de développement peut être signalé sans faire échouer le job. Le workflow utilise `npm install`, et non `npm ci` avec lockfile reproductible.

Le dépôt contient un audit antérieur qui mentionne un lockfile manquant et une vulnérabilité picomatch non corrigée vérifiée. Il faut résoudre cela sans patch artisanal ou version non publiée.

Pour le commit de référence, l'API GitHub interrogée n'a retourné aucun workflow run. Cela ne prouve ni réussite ni échec : **CI non vérifiable pour ce commit dans les résultats consultés**.

**Suite obligatoire :** confirmer la présence et le statut du lockfile, rendre l'installation reproductible, décider explicitement du seuil d'échec des audits, puis vérifier un vrai run CI. Ne pas modifier les dépendances vulnérables à l'aveugle.

### A-08 — Les tests ne couvrent pas encore l'intégration serveur

**Niveau : CRITIQUE / BLOQUANT AVANT SOS**

Les scripts testent des contrats de domaine et des primitives crypto. Aucun test d'intégration D1 n'est présent, aucune migration métier n'existe, et les routes Pages Functions métier n'existent pas.

Il manque notamment :
- test de deux comptes et isolation inter-comptes ;
- test d'autorisation SQL par auteur/destinataire ;
- test révocation concurrente à la lecture et à l'envoi ;
- création atomique alerte + destinataires + événements + outbox ;
- double worker, retries et réponse fournisseur ambiguë ;
- restauration/suppression de compte ;
- tests de contrat API et de sécurité HTTP ;
- tests E2E sur mobile et réseau faible.

**Suite obligatoire :** chaque fonctionnalité serveur doit avoir tests unitaires, intégration D1 local, tests API et tests E2E adaptés. Les tests purs actuels restent utiles mais ne suffisent pas.

### A-09 — Les dépendances fournisseurs et canaux ne sont pas encore abstraites en code

**Niveau : ÉLEVÉ**

L'architecture décrit OTP, push, SMS, paiement et cartographie comme fournisseurs futurs, sans choix validé ni adaptateurs opérationnels. Le `package.json` ne montre pas de SDK fournisseur ou de dépendance Capacitor.

**Suite obligatoire :** ne choisir aucun fournisseur dans l'audit. Définir des interfaces minimales, les contrats de résultat (accepté/livré/lu), les limites, idempotence, erreurs et coûts. Sélection et intégration feront l'objet d'une décision séparée. Pas de SMS simulé ni de succès artificiel.

### A-10 — La configuration Pages/D1 est déclarative, pas une preuve de déploiement sûr

**Niveau : ÉLEVÉ**

Le binding D1 est présent dans `wrangler.toml`, mais ce fichier ne prouve pas que les environnements Production et Preview sont isolés, que les secrets sont configurés correctement, ni qu'une politique de déploiement/rollback est opérationnelle.

**Suite obligatoire :**
- documenter les environnements Preview/Production et leurs IDs D1 distincts ;
- vérifier que les secrets sont configurés hors Git ;
- protéger les migrations distantes par revue et autorisation ;
- définir le rollback applicatif et la reprise des données ;
- tester que Preview ne peut jamais écrire dans Production.

Aucune commande de déploiement ou modification Cloudflare n'a été exécutée.

### A-11 — La santé serveur est présentée avec une portée trop large

**Niveau : MOYEN**

La landing page affiche « API et base de données accessibles » quand `GET /api/health` répond `ok` et `database=connected`. Le contrôle exécute uniquement `SELECT 1`.

Ce statut ne vérifie ni authentification, ni migrations, ni outbox, ni notification, ni stockage objet, ni intégrité du schéma métier.

**Suite recommandée :** garder un endpoint de santé minimal, mais employer un libellé qui décrit exactement le contrôle effectué (API + accès SQL D1), sans laisser croire que toutes les fonctions SAC sont prêtes. Ne pas exposer d'information sensible dans la réponse publique.

### A-12 — La conception native doit être pilotée par des limites de plateforme réelles

**Niveau : ÉLEVÉ**

Le cahier des charges prévoit une PWA puis Capacitor. Les comportements de géolocalisation en arrière-plan, SMS, notifications, exécution après force-stop, permissions et sauvegardes diffèrent selon Android/iOS et versions/OEM.

**Suite obligatoire :** une matrice de capacités et un prototype technique non sensible seront nécessaires avant toute promesse native. Les tests doivent inclure appareils physiques, app en premier plan/arrière-plan/suspendue/fermée, permissions refusées/révoquées, perte réseau, redémarrage et économie d'énergie. Aucun OS ne doit être présenté comme garantissant un comportement qu'il ne promet pas.

## 4. Évaluation par couche

| Couche | Présence réelle | Évaluation |
|---|---|---|
| Interface React/Vite | Landing page responsive | Socle présent, produit métier absent |
| TypeScript/domaines | Contrats purs et tests unitaires | Bonne séparation initiale, pas de persistance |
| Pages Functions | Route santé uniquement | Backend métier absent |
| D1 | Binding configuré, pas de tables | Pas prêt pour données réelles |
| R2 | Non configuré / non utilisé | À ne pas activer sans besoin et autorisation |
| Auth/session | Contrats et audits documentés | Pas d'authentification opérationnelle |
| Notifications | Contrats documentés seulement | Aucun envoi réel |
| Service worker | App shell + assets, API exclue | PWA minimale, pas de SOS hors ligne |
| Capacitor | Prévu, non installé | Portabilité native non démontrée |
| CI | Workflow versionné | Aucun run confirmé pour le commit examiné |
| GPS | Primitives crypto expérimentales | NO-GO, pas de collecte réelle |

## 5. Ordre recommandé de construction

L'ordre ci-dessous minimise les reprises et garde chaque étape vérifiable.

### Étape 1 — Assainir et unifier les contrats
- corriger la contradiction GPS dans le document d'architecture et marquer les anciennes tables GPS comme interdites/non approuvées ;
- établir un contrat API commun : version, validation, erreurs, identifiants, horodatages ;
- clarifier les états de compte, session, appareil, relation et suppression ;
- verrouiller la matrice de conservation et les décisions de révocation.

### Étape 2 — Fondations serveur non-GPS
- middleware de session et authentification ;
- D1 minimal : comptes, identités/challenges, appareils, sessions ;
- contrôle d'accès serveur ;
- tests D1 d'isolation, concurrence et révocation ;
- aucune position GPS ni clé de localisation.

### Étape 3 — Contacts de confiance
- invitations, vérification, acceptation, révocation ;
- relations directionnelles ;
- limites Free/Premium recalculées côté serveur ;
- tests d'invitation en attente et d'accès interdit.

### Étape 4 — Alertes sans localisation
- création atomique d'alerte et instantané destinataires ;
- réponses, volontariat, transfert de responsabilité ;
- clôture réservée à l'auteur ;
- outbox, idempotence, worker et rappels ;
- canal de notification réel choisi et testé avant activation.

### Étape 5 — PWA de production
- parcours compte/contacts/alerte ;
- états de livraison exacts ;
- gestion réseau lent, reprise et erreurs ;
- service worker et mises à jour ;
- accessibilité, langues et tests Android navigateur.

### Étape 6 — Protection des trajets sans historique GPS
- arbitrer ce qui est possible sans stocker de coordonnées ;
- arrivée non confirmée sans fausse déclaration d'urgence ;
- tests de permissions et d'expiration ;
- GPS précis toujours bloqué tant que J+30 n'est pas prouvé.

### Étape 7 — Capacitor et capacités natives
- seulement après stabilisation des contrats API ;
- adaptateurs Android/iOS testés ;
- permissions, notifications, liens profonds, stockage sécurisé ;
- tests appareil réel par OEM/versions ;
- limites OS affichées honnêtement.

### Étape 8 — Services commerciaux et conformité
- paiement, Premium, reçus et webhooks idempotents ;
- SMS de secours uniquement avec fournisseur réel ;
- conformité juridique et contrats fournisseurs ;
- tests de charge, incident et reprise.

## 6. Critères de passage à la production

Aucun lancement public ni activation SOS ne doit avoir lieu avant :
- authentification et sessions côté serveur vérifiées ;
- contrôle d'accès D1 pour chaque ressource ;
- migrations et sauvegardes testées ;
- outbox et scheduler fiables, sans doublon ;
- notification réelle avec états non trompeurs ;
- protection anti-abus sans blocage arbitraire d'un SOS légitime ;
- tests D1/API/E2E et revue sécurité indépendante ;
- plan incident, support et suppression de compte ;
- conformité juridique validée ;
- preuve de CI verte sur le commit livré ;
- décision explicite sur les limites PWA/native ;
- GPS précis toujours désactivé tant que la preuve J+30 reste NO-GO.

## 7. Décision finale

**GO pour continuer le développement du socle non-GPS, par étapes contrôlées.**  
**NO-GO pour SOS opérationnel, données personnelles réelles à grande échelle, GPS réel/historique, notifications prétendument fiables et lancement public.**

Le dépôt dispose d'une bonne base de séparation et d'une discipline documentaire utile. Le prochain travail technique le plus rentable n'est pas d'ajouter de nouvelles fonctionnalités visuelles : c'est d'aligner les contrats, corriger les contradictions documentaires, fiabiliser la CI, puis construire l'authentification et la persistance non-GPS avec des tests D1.

Aucun changement de stack n'est recommandé. React + Vite + TypeScript + Tailwind + Lucide, Pages Functions, D1, PWA puis Capacitor restent la direction de référence.
