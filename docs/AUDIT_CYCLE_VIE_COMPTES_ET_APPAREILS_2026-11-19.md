# SAC — Audit du cycle de vie des comptes et appareils

**Date :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Statut :** constat d'audit documentaire et statique du code ; aucune modification applicative, migration, activation Cloudflare ou déploiement.

## 1. Périmètre consulté

- `docs/CONSOLIDATION_APPAREILS_SESSIONS_ET_RECUPERATION.md`
- `docs/AUDIT_CYCLE_VIE_SESSIONS_ET_RENOUVELLEMENT.md`
- `docs/DECISION_VALIDEE_CONNEXIONS_SIMULTANEES_MULTI_APPAREILS_2026-11-19.md`
- `src/domain/device-management.ts`
- `src/domain/session-authorization.ts`
- `functions/api/auth/logout.ts`
- `functions/api/auth/session.ts`
- `functions/lib/security/require-authenticated-device-session.ts`
- `migrations/0007_root_device_enrollment.sql`

L'audit est limité aux éléments visibles dans ces fichiers. Il ne constitue pas une preuve de comportement en production.

## 2. Constat bloquant P0 — le schéma D1 interdit actuellement plusieurs appareils par compte

La migration `0007_root_device_enrollment.sql` crée l'index :

```sql
CREATE UNIQUE INDEX devices_one_root_per_account ON devices(account_id);
```

Cet index impose une seule ligne dans `devices` par compte, quelle que soit la nature de l'appareil. Or le même modèle et la décision utilisateur du 19 novembre prévoient :
- un appareil racine ;
- plusieurs appareils secondaires approuvés ;
- une session indépendante par appareil ;
- la révocation d'un appareil sans affecter les autres.

Le nom de l'index suggère qu'il vise à garantir une racine unique, mais sa contrainte réelle garantit une seule ligne `devices` totale par compte. Il ne distingue pas la racine des appareils secondaires.

**Conséquence :** si la table `devices` est utilisée pour enregistrer les appareils secondaires comme le prévoient les contrats, le deuxième appareil du même compte est rejeté par la base. La décision multi-appareils est donc validée côté produit, mais le schéma actuel ne la permet pas.

**Correction à concevoir, pas à appliquer dans cet audit :** la règle d'unicité doit porter uniquement sur l'appareil racine, au moyen d'une représentation explicite et vérifiable du rôle/type racine, puis d'un index unique partiel adapté. Il faut d'abord confirmer le modèle canonique des appareils secondaires, leurs clés et la cérémonie d'approbation. Ne pas simplement supprimer l'index : cela pourrait autoriser plusieurs racines.

Aucune migration corrective n'est créée ici.

## 3. Sessions : séparation par appareil cohérente dans le contrat, mais cycle incomplet

Les tables et contrats lient chaque session à `account_id` et `device_id`. Le contrôle serveur relit la session, le compte et l'appareil dans D1, puis compare l'état, la version d'autorisation et les dates. La déconnexion vise le jeton de la session courante et n'a pas pour cible toutes les sessions du compte.

Les limites produit validées restent :
- expiration après 30 jours consécutifs sans activité ;
- réauthentification au plus tard après 90 jours ;
- une session par appareil connecté, sans partage de session.

Le mécanisme de renouvellement silencieux / refresh token reste non arbitré. Il ne doit pas être ajouté implicitement.

## 4. Révocation : exigences connues, parcours opérationnel absent

Les contrats exigent qu'une révocation :
- invalide toutes les sessions et capacités de renouvellement de l'appareil concerné ;
- invalide ses certificats et abonnements Push selon le contrat final ;
- laisse les autres appareils actifs ;
- soit vérifiée à nouveau au moment de l'écriture finale afin d'empêcher une course avec une requête concurrente.

Dans les fichiers consultés, le point d'entrée `logout.ts` révoque uniquement la session correspondant au cookie. Cela correspond à une déconnexion locale, pas à une révocation de l'appareil.

Aucun parcours complet de révocation individuelle d'un appareil perdu/inutilisé (API, interface, opération transactionnelle D1 et invalidation des abonnements liés) n'a été identifié dans le périmètre consulté. Ne pas présenter la déconnexion comme une révocation d'appareil.

## 5. Gestion des appareils et racine

Le module `src/domain/device-management.ts` est un évaluateur métier pur. Il vérifie qu'une approbation provient de l'identifiant racine fourni par l'appelant et interdit qu'un appareil secondaire soit racine. Il ne charge pas lui-même la racine depuis D1, ne vérifie pas de signature et ne persiste aucune transition.

La migration 0007 contient des structures de cérémonie d'enrôlement racine et de sessions. Elle ne constitue pas à elle seule une cérémonie complète d'approbation secondaire. Le protocole secondaire reste soumis à la spécification cryptographique non homologuée décrite dans les documents de consolidation.

**Règle de sécurité :** ne pas brancher directement le résultat du module pur sur une permission réelle avant que le serveur ait authentifié l'acteur, chargé la racine active depuis D1, vérifié les preuves cryptographiques et appliqué la transition atomiquement.

## 6. Effets sur SOS et Push

La décision multi-appareils prévoit un abonnement Push distinct par appareil et la révocation des abonnements de l'appareil révoqué. Tant que l'enrôlement et la révocation secondaires ne sont pas opérationnels, il ne faut pas annoncer une livraison multi-appareils complète.

L'audit antérieur de livraison Push a déjà relevé qu'une tâche agrégée par destinataire peut être rejouée après une acceptation partielle. Le suivi durable par appareil reste une proposition non homologuée. Aucun push ni SMS réel n'est envoyé par ce constat.

## 7. Décisions et travaux nécessaires avant implémentation

1. Définir explicitement comment distinguer la racine et les appareils secondaires dans le modèle D1.
2. Corriger la contrainte d'unicité pour garantir exactement une racine active/canonique par compte sans interdire les secondaires.
3. Finaliser et faire revoir indépendamment la cérémonie cryptographique d'approbation secondaire.
4. Définir l'opération transactionnelle de révocation d'un appareil, y compris sessions, certificats, abonnements Push et concurrence.
5. Créer le parcours de consultation et de révocation individuelle des appareils après validation des contrats.
6. Garder les durées de session 30/90 jours ; ne pas choisir implicitement un refresh token.
7. Ajouter des tests de schéma et d'intégration démontrant : un compte peut avoir une racine et plusieurs secondaires ; une seconde racine est refusée ; révoquer un secondaire ne touche ni la racine ni les autres appareils.

## 8. Statut de préparation

| Domaine | Constat | Statut |
|---|---|---|
| Connexions simultanées | Décision produit validée, mais index D1 actuel interdit plusieurs lignes appareil par compte | **Bloquant P0** |
| Session locale / logout | La route cible la session courante | Partiel |
| Révocation d'appareil | Exigence documentée, parcours transactionnel non établi dans le périmètre | À concevoir |
| Approbation secondaire | Module pur présent, cérémonie cryptographique non homologuée | Bloqué |
| Récupération de racine | Interdite en V1 | Verrou maintenu |
| Push multi-appareils | Dépend de l'enrôlement, de la révocation et de l'outbox par appareil | Non prêt |

## 9. Limites et protections maintenues

Cet audit ne modifie aucun code ni schéma. Il n'applique aucune migration distante, ne crée aucune ressource Cloudflare, n'active aucun fournisseur, n'envoie aucune notification et ne déclenche aucun déploiement. La production reste désactivée.

**Conclusion :** le point le plus urgent n'est pas un nouvel écran : c'est une contradiction entre la décision multi-appareils validée et l'index unique de la table `devices`. Il faut résoudre ce modèle avant toute implémentation de gestion multi-appareils.
