# SAC — Audit de l'état réel du code

**Date de l'audit :** 18 novembre 2026  
**Dépôt :** `benwahab/SAC`  
**Branche examinée :** `main`  
**Commit HEAD au début de l'audit :** `7b97035a22bd9d5bfa58c92ab4b6dbec9b4f5058`  
**Nature :** audit documentaire et lecture seule du dépôt ; aucun code applicatif ni ressource Cloudflare modifié pendant cet audit.

## 1. Résumé exécutif

SAC possède un socle technique initial réel, mais l'application métier n'est pas encore opérationnelle.

Éléments vérifiés dans le dépôt :
- application React/Vite/TypeScript ;
- page d'accueil publique de présentation ;
- PWA minimale avec manifeste et service worker ;
- API Pages Functions avec une route de santé D1 ;
- binding D1 déclaré dans `wrangler.toml` ;
- contrats TypeScript purs pour plusieurs règles métier ;
- tests automatisés de ces contrats ;
- workflow GitHub Actions pour typecheck, tests, build et audit des dépendances.

Éléments qui ne sont pas démontrés comme opérationnels :
- inscription, connexion et récupération de compte ;
- gestion réelle des proches et invitations ;
- déclenchement SOS et persistance des alertes ;
- notifications push et escalade SMS ;
- prise en charge transactionnelle par les proches ;
- collecte et partage GPS ;
- suppression irréversible GPS J+30 ;
- paiements et abonnements actifs ;
- application native Capacitor ;
- console professionnelle et services administratifs.

Le bouton SOS est explicitement désactivé et porte la mention « En préparation ». Il ne faut pas l'activer avant les validations de sécurité, de transmission réelle et de tests prévues.

## 2. Socle technique observé

### 2.1 Stack

Le fichier `package.json` confirme :
- React 19 ;
- Vite 6 ;
- TypeScript 5 ;
- Tailwind CSS 3 ;
- Lucide React ;
- Wrangler 4.

Le build est défini par `tsc -p tsconfig.app.json && vite build`. Le typecheck couvre l'application et les Pages Functions via deux configurations TypeScript.

La stack réelle correspond à la stack verrouillée dans `AGENTS.md` et `docs/CONSOLIDATION_GENERALE_SAC.md`. **Ne pas migrer vers Next.js ou PostgreSQL.**

### 2.2 Interface actuelle

`src/App.tsx` est une page de présentation :
- présente la mission de SAC ;
- affiche les formules gratuites et Premium ;
- affiche un indicateur de connexion à l'API ;
- garde le bouton SOS désactivé ;
- ne contient pas encore les parcours complets de compte, proches, alertes ou console.

### 2.3 PWA

Les fichiers `public/manifest.webmanifest`, `public/sw.js` et `src/main.tsx` confirment une préparation PWA :
- manifeste avec lancement en mode standalone ;
- enregistrement du service worker en production ;
- mise en cache limitée à la coquille de l'application et aux ressources statiques ;
- les requêtes `/api/` ne sont pas mises en cache.

Ce service worker ne fournit pas un SOS hors ligne et ne doit pas être présenté comme une garantie de transmission sans réseau.

## 3. Écarts entre les décisions produit et l'interface actuelle

### 3.1 Identité visuelle

**Décision la plus récente :** vert clair effet verre dépoli, blanc, rouge alerte, vert de confirmation distinct ; aucun violet et aucun bleu nuit principal.

**Code actuellement observé :**
- `tailwind.config.js` définit encore `navy: #142B45`, `green: #15966B`, `mist: #E9EEF3` ;
- `src/App.tsx` utilise `text-sac-navy`, des fonds gris/blancs et des accents bleu ciel/rose ;
- `index.html` et `public/manifest.webmanifest` utilisent encore `#142B45` comme couleur de thème.

**Conclusion :** la nouvelle identité vert clair Glassmorphism est documentée, mais pas encore appliquée au code.

### 3.2 Langues

La décision de lancement est français, anglais et arabe avec RTL complet. Le code examiné utilise actuellement `lang="fr"`, un manifeste en français et des textes directement écrits en français dans `src/App.tsx`.

**Conclusion :** aucune infrastructure de traduction ni interface arabe RTL n'a été confirmée dans les fichiers examinés.

### 3.3 Expérience professionnelle

Les onze espaces et les règles de la console sont documentés. Aucune console professionnelle opérationnelle n'a été confirmée dans les fichiers examinés. La page actuelle reste une page d'accueil de présentation.

## 4. API, D1 et stockage

### 4.1 Route API vérifiée

Le fichier `functions/api/health.ts` expose une route de santé qui exécute réellement `SELECT 1 AS ok` via le binding D1 et renvoie un état connecté ou indisponible.

C'est un contrôle de connectivité de base. Il ne prouve pas l'existence des tables métier, l'authentification, le fonctionnement du SOS ou la disponibilité des notifications.

Aucune route métier de compte, contacts, alertes, GPS, paiements ou console n'a été confirmée pendant cet audit. Cette formulation signifie « non vérifiée dans les fichiers consultés », et non une affirmation fondée sur une liste exhaustive de tout le dépôt.

### 4.2 D1

`wrangler.toml` déclare :
- binding : `DB` ;
- base : `sac-db` ;
- identifiant : `892ce876-f279-409c-8f9e-06b1dca66e9d`.

Le suivi `TODO_SUPERVISION.md` indique que la base officielle a été vérifiée vide le 17 novembre 2026 et que les migrations métier restent à créer après validation du schéma et des règles d'accès.

**Conclusion :** binding D1 déclaré dans la configuration ; aucune persistance métier opérationnelle n'est démontrée.

### 4.3 Cloudflare Pages et R2

Le suivi du projet indique que la connexion Cloudflare Pages au dépôt et le binding D1 de l'environnement Preview restent à configurer/vérifier. L'activation de R2 et la création du bucket privé restent également en attente.

Ne pas affirmer qu'un déploiement Preview/Production ou un stockage R2 fonctionne sans vérification directe.

## 5. Contrats métier et cryptographie expérimentale

Les fichiers suivants ont été vérifiés :
- `src/domain/sac.ts` : catégories, niveaux, états, durées de partage et limites des offres ;
- `src/domain/alert-lifecycle.ts` : contrat pur de clôture par l'auteur et d'éligibilité des rappels ;
- `src/domain/alert-responses.ts` : accusés de réception, volontariat et responsabilité principale ;
- `src/domain/trip-protection.ts` : transitions pures des trois modes de protection de trajet ;
- `src/domain/account-lifecycle.ts` : transitions logiques de demande et finalisation de suppression ;
- `src/domain/device-management.ts` : transitions pures d'approbation/révocation d'appareil ;
- `src/domain/session-authorization.ts` : vérification d'un contexte de session lié à un appareil ;
- `src/services/device/device-certificate.ts` : certificat secondaire expérimental ;
- `src/services/location/crypto.ts` et `key-exchange.ts` : primitives expérimentales AES-GCM/ECDH/HKDF.

Les commentaires du code précisent que ces modules ne remplacent pas l'authentification serveur, la persistance, les transactions D1, l'ordonnancement ou les contrôles d'autorisation. Les primitives de localisation ne sont pas branchées à l'application et ne mettent pas en œuvre la destruction J+30.

**Conclusion :** ce sont des contrats et prototypes testables, pas des fonctionnalités métier livrées.

## 6. Tests et CI

### 6.1 Workflow actuel

`.github/workflows/ci.yml` prévoit :
1. installation des dépendances ;
2. typecheck ;
3. tests de cryptographie de localisation ;
4. tests de cycle de vie des appareils ;
5. tests des certificats secondaires ;
6. tests d'autorisation des sessions ;
7. tests du cycle de vie des alertes ;
8. tests des réponses et de la responsabilité ;
9. tests de Protection des trajets ;
10. tests de cycle de vie de suppression de compte ;
11. build ;
12. audit bloquant des dépendances de production ;
13. audit des dépendances de développement non bloquant.

### 6.2 Dernier run dont les étapes ont été vérifiées pendant cet audit

Run GitHub Actions : `44261699221` — job `validate` — conclusion `success`.

Étapes visibles dans ce run : typecheck, six suites de tests (crypto, appareils, certificats, sessions, cycle d'alerte, réponses), build et audits de dépendances.

Les tests Protection des trajets et suppression de compte apparaissent dans le workflow actuel, mais n'apparaissent pas dans les étapes de ce run précis. Il ne faut donc pas prétendre qu'ils ont été exécutés avec succès dans ce run.

Le commit HEAD actuel est un commit documentaire. Aucun statut de vérification attaché à ce commit n'a été retourné pendant l'audit. Le succès d'un run antérieur ne prouve pas le succès d'un commit plus récent.

### 6.3 Reproductibilité

`package-lock.json` n'a pas été trouvé à la racine lors de la vérification. Le workflow utilise `npm install`, pas `npm ci`.

**Écart à traiter :** versionner un fichier de verrouillage après une installation contrôlée et basculer vers une installation reproductible, après audit de dépendances et validation.

Le document `AGENTS.md` signale par ailleurs une vulnérabilité Picomatch sans version corrigée publiée vérifiée. Ce point doit rester suivi ; ne pas improviser un correctif ou un override non validé.

## 7. Tableau d'état

| Domaine | État constaté |
|---|---|
| Stack React/Vite/TypeScript | Présente |
| Page d'accueil | Présente |
| PWA de base | Présente |
| Route de santé D1 | Présente |
| Binding D1 dans Wrangler | Déclaré |
| Base D1 métier | Vide selon le suivi du 17/11 |
| Migrations métier | En attente |
| Contrats métier TypeScript | Plusieurs présents |
| Tests unitaires de contrats | Présents |
| Authentification réelle | Non démontrée |
| Proches et invitations réels | Non démontrés |
| SOS réel | Non implémenté ; bouton désactivé |
| Push et SMS réels | Non démontrés |
| GPS réel | Non activé ; NO-GO J+30 |
| Paiements réels | Non démontrés |
| Console professionnelle | Documentée, non démontrée |
| RH, comptabilité, logistique, juridique, DSI | Documentés, non démontrés |
| Identité vert clair Glassmorphism | Documentée, non appliquée |
| Français/anglais/arabe RTL | Français seulement dans l'interface examinée |
| Capacitor natif | Prévu, non démontré |

## 8. Ordre recommandé des corrections

### P0 — Sécurité et vérité fonctionnelle
- Maintenir le SOS désactivé tant que l'envoi réel, la persistance, les destinataires, les transactions et les tests ne sont pas validés.
- Maintenir le GPS précis bloqué jusqu'à preuve irréversible J+30, y compris après restauration.
- Ne pas présenter les contrats TypeScript purs comme des contrôles serveur déjà actifs.
- Ne pas présenter l'état de santé D1 comme une preuve que l'application métier est opérationnelle.

### P1 — Alignement de l'application citoyenne
- Appliquer l'identité vert clair effet verre dépoli à l'application, au manifeste et aux métadonnées navigateur.
- Mettre en place l'architecture de traduction français/anglais/arabe et le RTL complet.
- Construire les parcours compte, appareils, proches et alertes après validation des contrats serveur et du schéma D1.

### P1 — Persistance et intégration
- Finaliser le schéma D1, les autorisations et les migrations après arbitrage.
- Construire les opérations API côté serveur et leurs tests d'intégration.
- Vérifier Pages Preview, le binding D1 et le stockage privé R2 avant d'annoncer leur disponibilité.

### P2 — Fiabilité du développement
- Ajouter et versionner le lockfile.
- Vérifier le workflow CI sur le code le plus récent, y compris les suites Protection des trajets et suppression de compte.
- Continuer le suivi de la vulnérabilité Picomatch sans correctif artisanal.

### P3 — Console et services professionnels
- Ne commencer la console et les modules RH/finances/logistique/juridique/DSI qu'après stabilisation du socle citoyen, de l'authentification et du modèle d'autorisation.
- Réutiliser le modèle documentaire et les références centrales ; ne pas générer automatiquement toutes les tables proposées dans l'annexe.

## 9. Limites de cet audit

Cet audit a été effectué par lecture des fichiers GitHub et des métadonnées GitHub Actions disponibles. Aucun clone local, installation npm, exécution locale de tests, requête directe à Cloudflare, vérification de déploiement, test sur appareil Android/iOS, audit d'intrusion ou test de restauration D1 n'a été effectué.

Les absences mentionnées signifient que la fonction n'a pas été démontrée dans les fichiers et preuves examinés. Toute affirmation plus forte exige un inventaire exhaustif ou un test réel.

## 10. Règle de mise à jour

Toute nouvelle vérification doit mentionner :
- commit exact examiné ;
- chemins et SHAs des fichiers ;
- commandes ou tests réellement exécutés ;
- identifiants de runs et conclusions ;
- état Cloudflare observé directement ;
- écarts corrigés et écarts restants.

Ne jamais transformer un élément « documenté », « prototype », « déclaré dans Wrangler » ou « testé en isolation » en fonctionnalité « opérationnelle ».

## 11. Vérification de suivi — identité visuelle et i18n

À la suite de l'audit, une première mise à jour de l'interface citoyenne a été enregistrée sur `main` le 18 novembre 2026.

Fichiers concernés :
- `src/App.tsx` : sélecteur de langue, dictionnaires utilisés, changement de `lang` et `dir`, interface d'accueil traduite en français/anglais/arabe ;
- `src/i18n/translations.ts` : catalogue central des textes ;
- `src/index.css` : fonds verts clairs, surfaces translucides, flous, ombres et adaptations RTL ;
- `tailwind.config.js` : tokens de couleur vert clair, confirmation, alerte et surfaces ;
- `index.html` et `public/manifest.webmanifest` : thème PWA vert clair.

Cette mise à jour ne traduit que la page actuellement présente. Elle ne prouve pas la traduction de futurs parcours, ni la validation humaine des formulations sensibles. Les valeurs hexadécimales sont des tokens initiaux de réalisation, non une charte finale irrévocable.

**État de validation :** fichiers écrits sur GitHub ; build, typecheck et tests du nouveau commit doivent encore être confirmés par un run CI correspondant. Aucun test visuel sur appareil Android n'a été exécuté dans le cadre de cette modification.
