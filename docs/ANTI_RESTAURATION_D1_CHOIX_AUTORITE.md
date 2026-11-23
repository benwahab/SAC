# SAC — Anti-restauration D1 et choix de l'autorité d'ancrage

**Date :** 21 novembre 2026
**Statut :** preuve locale de détection de restauration ; choix de l'autorité de production **non tranché**. Aucune ressource Cloudflare, aucun fournisseur et aucune migration de production.
**Dépendances :** `MODELE_D1_ATOMIQUE_ENROLEMENT_SECOND_APPAREIL_V1.md`, `CONTRAT_RESILIENCE_CONTINUITE_ET_REPRISE_INCIDENT.md`, `CONTRAT_SECURITE_CYCLE_SOS_ET_INTEGRITE_ALERTES.md`.

## 1. Problème

Une sauvegarde D1 restaurée peut réactiver :

- un défi déjà consommé ;
- un appareil secondaire révoqué ;
- une cérémonie approuvée ou rejetée dans un état antérieur ;
- une session révoquée.

Le contrôle ne peut pas reposer uniquement sur D1 : une restauration remet aussi à zéro les marqueurs stockés dans D1. Il faut une tête d'ancrage hors D1, lue au démarrage et avant toute opération sensible.

## 2. Preuve locale réalisée

`npm run test:d1-restore-rehearsal` :

1. crée une projection D1 locale réelle ;
2. enregistre `ROOT_REGISTERED` puis `SECONDARY_ACTIVATED` ;
3. sauvegarde les fichiers SQLite locaux ;
4. ajoute `ROOT_REVOKED` ;
5. arrête le Worker, restaure réellement les fichiers SQLite sauvegardés et redémarre ;
6. constate que D1 est revenu à l'état actif ;
7. vérifie que `/ready` avec la tête attendue renvoie **503** ;
8. rejoue `ROOT_REVOKED`, puis vérifie que `/ready` renvoie **200**.

Le hash d'ancre est le contrat `src/domain/security-anchor.ts` :

```text
SHA-256(sequence || "\n" || previous_hash || "\n" || event)
```

Cette preuve démontre la détection et la réconciliation locales. Elle ne démontre pas la sécurité de la tête d'ancrage en production.

## 3. Options d'autorité

### Option A — Journal externe append-only / WORM

Écrire chaque tête dans un journal externe append-only, idéalement avec rétention WORM ou transparence vérifiable. C'est l'option la plus solide contre une restauration D1, mais elle exige un fournisseur, un contrat, une gestion de clés et une revue juridique. **Non autorisée à ce stade.**

### Option B — Domaine de confiance séparé

Utiliser un second compte ou projet Cloudflare avec un jeton restreint en écriture seule et une rétention d'objet. Ce n'est pas totalement indépendant du fournisseur, mais sépare les identités et les chemins d'administration. Cela crée une ressource Cloudflare et exige une autorisation explicite. **Non autorisée à ce stade.**

### Option C — Point de contrôle hors ligne signé

Conserver une tête signée sur un support hors ligne détenu par le propriétaire, avec vérification manuelle ou périodique. Cela ne prévient pas une restauration entre deux points de contrôle ; c'est une détection, pas une prévention continue. Utilisable seulement comme mesure temporaire avec un intervalle court et une procédure fail-closed. **Non approuvée.**

## 4. Exigences communes

Toute option retenue doit fournir :

- une tête `{sequence, hash}` non modifiable par le chemin D1 ;
- une lecture au démarrage et avant chaque approbation/révocation ;
- un refus fail-closed si l'ancre est indisponible, incohérente ou en retard ;
- une réconciliation explicite, jamais automatique vers un état antérieur ;
- la conservation des révocations et suppressions déjà intervenues ;
- un audit des lectures d'ancre et des réconciliations ;
- des tests de restauration réelle, pas seulement un modèle.

## 5. Recommandation

Ne pas activer l'enrôlement secondaire en production avec la seule preuve locale. La recommandation de sécurité est l'**option A**. Si la contrainte est l'absence de nouveau fournisseur, l'option C peut être étudiée comme détection temporaire, mais elle ne doit pas être présentée comme une prévention complète.

Le choix exige une validation explicite de l'utilisateur, une revue de sécurité et, pour A/B, une autorisation de ressource et de contrat.

## 6. Verdict

**Restauration locale détectée et réconciliée : oui.**
**Autorité anti-restauration de production : non choisie.**
**Migration D1, API, session et activation : NON AUTORISÉES.**
**Enrôlement secondaire réel : NON HOMOLOGUÉ POUR LA PRODUCTION.**
