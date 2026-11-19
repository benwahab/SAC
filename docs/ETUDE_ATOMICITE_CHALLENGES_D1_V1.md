# SAC — Étude de l'atomicité D1 des défis d'enrôlement V1

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** preuve technique locale réussie ; stratégie de production candidate, NON homologuée.  
**Périmètre :** consommation unique d'un défi, validation conditionnelle d'une cérémonie et rollback D1.  
**Hors périmètre :** migration de production, endpoint SAC, racine réelle, appareil réel, sessions et déploiement distant.

## 1. Résultat de l'expérience

Un Worker Cloudflare isolé, lié à une base D1 locale dédiée aux tests, a exécuté les scénarios suivants :

- huit demandes concurrentes tentent d'approuver la même cérémonie et de consommer le même défi ;
- une seule demande obtient l'approbation ; les sept autres sont refusées ;
- une nouvelle répétition après approbation est refusée et ne crée pas un second commit ;
- un mauvais digest ne consomme pas le défi et ne modifie pas la cérémonie ;
- un défi expiré ne peut pas être consommé ;
- une erreur SQL volontaire après la première écriture provoque le rollback de toute la transaction : le défi reste non consommé et la cérémonie reste pending.

**Résultat du test D1 dans GitHub Actions :** succès, étape `Test D1 enrollment challenge atomicity, rollback and concurrent replay`, workflow [44476260598](https://github.com/benwahab/SAC/actions/runs/44476260598).  
Le workflow complet était encore en cours au moment de la rédaction de cette mise à jour ; ce statut ne doit pas être confondu avec la réussite de toutes les étapes CI.

## 2. Ce que la documentation Cloudflare garantit

La documentation officielle de D1 précise que :

- `D1Database.batch()` exécute les requêtes préparées dans l'ordre, séquentiellement et non concurremment ;
- un batch constitue une transaction SQL ;
- si une instruction échoue, la séquence entière est annulée ;
- une session D1 avec `first-primary` commence sur la base primaire et maintient la cohérence séquentielle pour les lectures suivantes.

Cloudflare indique également qu'une base D1 individuelle traite les requêtes de manière mono-threadée. Cela sérialise l'exécution SQL d'une base, mais ne remplace pas les conditions de sécurité dans les requêtes : chaque opération sensible doit encore vérifier l'état courant au moment de l'écriture.

Références :
- D1 Database API : https://developers.cloudflare.com/d1/worker-api/d1-database/
- D1 FAQ — concurrence et débit : https://developers.cloudflare.com/d1/reference/faq/

## 3. Patron transactionnel candidat

Les vérifications cryptographiques lourdes sont exécutées avant le commit. Le résultat n'autorise pas à lui seul une écriture : le batch doit revalider les faits mutables au moment du commit.

Séquence logique candidate :

1. **Consommer le défi** avec un `UPDATE` conditionnel qui exige l'identifiant du défi, la cérémonie liée, le digest attendu, l'état non consommé et une expiration strictement postérieure à l'heure serveur.
2. **Approuver la cérémonie** avec un `UPDATE` conditionnel qui exige son état pending, son échéance, le compte actif, la racine toujours active et la génération de clé inchangée, ainsi que la consommation du défi de cette cérémonie au même instant.
3. **Activer le nouvel appareil** uniquement si la cérémonie vient d'être approuvée et si l'appareil est toujours réservé au bon compte et non révoqué.
4. **Enregistrer les résultats de preuve** et les références d'audit minimales, sans secrets.
5. **Contrôler chaque écriture conditionnelle** : une requête SQL qui modifie zéro ligne ne provoque pas automatiquement une erreur D1. Chaque étape conditionnelle doit donc être suivie d'un garde-fou SQL qui échoue si le nombre de lignes affectées n'est pas exactement celui attendu. L'échec doit être dans le même `batch()` pour déclencher le rollback.
6. **Créer une session seulement après** la réussite du commit d'approbation, dans un flux séparé et contrôlé.

Le test local utilise une table garde avec une contrainte `CHECK` sur `changes()` pour prouver le comportement : si la mise à jour précédente n'a pas modifié exactement une ligne, l'insertion du garde-fou échoue et le batch entier est annulé. Ce mécanisme est une démonstration de test, pas un schéma de production homologué.

## 4. Courses et rejeux

### Deux approbations simultanées

Les deux requêtes peuvent terminer leurs vérifications cryptographiques en parallèle. Le commit conditionnel est ensuite sérialisé par D1. La première consomme le défi et fait passer la cérémonie à approved. La suivante ne trouve plus un défi issued et une cérémonie pending ; son garde-fou échoue et aucun effet partiel n'est conservé.

### Révocation de la racine pendant l'approbation

Il ne faut pas se fier à une lecture antérieure du statut de la racine. La requête finale qui approuve la cérémonie doit relire dans ses prédicats SQL que la racine est toujours active, non révoquée et à la même génération/version. Si la révocation gagne avant le commit, l'approbation doit échouer et la consommation du défi doit être annulée avec elle.

### Réponse réseau perdue

Une répétition ne doit jamais consommer un second défi ni créer une deuxième activation. Le client doit pouvoir consulter l'état autoritaire de la cérémonie par un identifiant opaque. Si une lecture peut passer par une réplique, utiliser une session D1 démarrant par `first-primary` ou un bookmark approprié pour obtenir une lecture séquentiellement cohérente. Une réponse déjà approuvée doit être restituée comme état existant, jamais exécutée à nouveau.

### Challenge et secrets

Le Worker de test ne conserve que le digest du défi et ne journalise aucune valeur brute. Cela ne tranche pas la représentation finale du nonce/transcript : le protocole WebAuthn lié au transcript peut nécessiter de reconstruire un challenge à partir d'un nonce serveur. La représentation persistée doit être choisie avec le profil cryptographique final, sans supposer qu'un digest permet de reconstruire le nonce.

## 5. Fichiers de preuve isolés

Tous les artefacts suivants restent sous `tests/` et ne sont pas des migrations de production :

- `tests/d1-atomicity/migrations/0001_enrollment_challenge_test.sql`
- `tests/workers/d1-enrollment-atomicity-worker.ts`
- `tests/wrangler.d1-atomicity.toml`
- `tests/d1-enrollment-atomicity.test.ts`

La configuration utilise un identifiant D1 local dédié. Le workflow CI applique uniquement cette migration en mode `--local`. Aucune base D1 distante et aucune ressource Cloudflare de production n'ont été modifiées.

## 6. Limites — NO-GO production maintenu

Cette expérience prouve le comportement du patron dans le runtime Workers local avec une base D1 locale. Elle ne prouve pas encore :

- la transaction finale complète couvrant les vraies tables account/root/device/ceremony/challenge/proof ;
- l'intégration de la révocation de racine et de l'activation de l'appareil dans un schéma final ;
- les contraintes uniques et la stratégie de plusieurs cérémonies pending ;
- le traitement atomique des sessions et de leur révocation ;
- le protocole d'idempotence après réponse perdue dans les endpoints SAC ;
- les migrations D1 réelles, les restaurations/Time Travel et les scénarios de reprise ;
- la compatibilité des clés et preuves sur appareils physiques.

Les choix de TTL, quotas, conservation des preuves, modèle relationnel final et transcript restent à homologuer. Aucun endpoint d'enrôlement ni aucune table de production ne sont créés par cette étude.

**Conclusion :** `D1.batch()` avec écritures conditionnelles et garde-fous explicites est un patron viable à approfondir. L'atomicité ne doit jamais être déduite de `batch()` seul : les préconditions et le nombre de lignes affectées doivent être contrôlés dans la même transaction. Le GO production reste refusé jusqu'à la validation du modèle complet et des tests de course associés.
