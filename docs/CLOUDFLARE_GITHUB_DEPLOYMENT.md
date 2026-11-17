# SAC — Connexion GitHub et préparation Cloudflare

**État vérifié le 17 novembre 2026.**  
**Statut :** connexion configurée ; chaîne de compilation non encore validée.  
**Périmètre :** configuration et documentation uniquement. Aucun code applicatif n'est créé ni déployé par ce document.

## 1. Dépôt source officiel

- Dépôt GitHub : `benwahab/SAC`
- Branche surveillée : `main`
- Source de contrôle : GitHub
- Règle de projet : une seule branche, aucun développement sur une branche secondaire.

Cloudflare Workers Builds référence le dépôt GitHub SAC et surveille la branche `main`. La compilation automatique est activée et les déploiements Preview sont activés.

## 2. Worker Cloudflare existant

Un Worker nommé `sac` est présent dans le compte Cloudflare connecté.

Configuration lue :
- dépôt lié : `benwahab/SAC` ;
- branche : `main` ;
- répertoire racine : `/` ;
- compilation automatique : activée ;
- aperçus Preview : activés ;
- commande de compilation : vide ;
- commande de déploiement de production : `npx wrangler deploy` ;
- commande Preview : `npx wrangler preview` ;
- filtrage de branche : `main` ;
- déclencheur Workers Builds : présent.

Aucun projet Cloudflare Pages n'a été trouvé dans le compte lors de la vérification. SAC est donc préparé comme un Worker Cloudflare avec Workers Builds, et non comme un projet Pages.

## 3. Ce que cette vérification prouve — et ne prouve pas

La liaison technique GitHub–Cloudflare et le déclencheur de build sur `main` sont configurés.

En revanche, cela ne prouve pas qu'une compilation de l'application SAC a déjà réussi ni qu'une version applicative est en production. Le Worker existant a été créé depuis un modèle du tableau de bord (`dash_template`) et ne constitue pas, à lui seul, la preuve que le produit SAC est déployé.

## 4. Pourquoi aucune commande de build n'est renseignée

Le dépôt contient actuellement la documentation du projet, pas encore le code de l'application. Il ne contient donc pas de manifeste de dépendances ni de configuration de build permettant de choisir une commande correcte.

Il serait incorrect d'inventer maintenant une commande telle que `npm run build` ou de lancer `npx wrangler deploy` sans application et sans configuration Wrangler validées.

## 5. Préparation requise avant le premier déploiement applicatif

Avant d'activer une véritable chaîne de déploiement :

1. Confirmer l'architecture d'exécution Cloudflare compatible avec le framework frontend retenu.
2. Définir et valider la structure du projet et les versions des outils.
3. Ajouter les fichiers de configuration requis (dont la configuration Wrangler adaptée au projet).
4. Définir les commandes exactes de compilation et de déploiement à partir des scripts réellement présents.
5. Définir les variables d'environnement et secrets côté Cloudflare, sans jamais les committer dans Git.
6. Vérifier les bindings et services nécessaires (base de données, stockage, files/queues, tâches planifiées, notifications) avant leur utilisation.
7. Exécuter un premier build contrôlé, examiner les logs, puis vérifier le résultat du déploiement.
8. Confirmer explicitement le comportement de production avant de considérer SAC comme publié.

Les choix de base de données, d'authentification, de SMS, de paiement et de cartographie restent à valider dans les documents de décisions. Leur configuration Cloudflare ne doit pas être inventée.

## 6. Règles de travail Cloudflare

- GitHub `benwahab/SAC`, branche `main`, reste l'unique source de vérité.
- Les modifications de code et de configuration sont enregistrées directement sur `main`.
- Cloudflare construit et héberge les composants retenus ; il ne remplace pas GitHub comme dépôt source.
- Aucun projet Lovable n'est utilisé.
- Ne pas créer de deuxième branche, de dépôt miroir ou de pipeline parallèle.
- Ne pas déployer une configuration vide ou un Worker modèle en prétendant qu'il s'agit de l'application fonctionnelle.
- Ne jamais exposer de secrets dans le dépôt.
- Avant chaque changement Cloudflare, inspecter la configuration actuelle et mesurer l'impact.
- Après chaque changement, vérifier la configuration enregistrée et les résultats réels des builds.

## 7. Prochaine étape

La prochaine étape technique, après autorisation de commencer le développement, sera de choisir et valider l'architecture d'application compatible avec Cloudflare, puis d'ajouter les fichiers de projet et de configurer les commandes de build à partir de ceux-ci. Cette étape ne doit pas être remplacée par une commande générique supposée.
