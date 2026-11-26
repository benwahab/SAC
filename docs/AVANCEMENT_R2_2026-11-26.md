# SAC — Avancement R2 et état des migrations D1

**Date de vérification :** 26 novembre 2026  
**Dépôt :** `benwahab/SAC` — branche `main`  
**Périmètre :** activation R2, buckets privés et état réel de D1.  
**Aucune donnée utilisateur n'a été copiée ni déplacée.**

## 1. Compte Cloudflare et R2

R2 répond désormais correctement sur le compte Cloudflare relié au projet SAC. Deux buckets dédiés ont été créés :

| Environnement | Bucket | État |
|---|---|---|
| Production | `sac-private-documents` | Créé, vide |
| Preview | `sac-private-documents-preview` | Créé, vide |

Vérifications Cloudflare :
- stockage Standard ;
- localisation attribuée par Cloudflare : `WEUR` ;
- juridiction : `default` ;
- domaine public géré `r2.dev` : désactivé pour les deux buckets ;
- aucun domaine personnalisé ;
- les buckets `upk-photos` et `upk-photos-staging` appartiennent à un autre usage et n'ont pas été touchés.

La localisation WEUR est un constat renvoyé par Cloudflare, pas une décision juridique sur les transferts ou la conformité.

## 2. Liaison applicative — volontairement non activée

Le code des pièces jointes administratives attend le binding Pages Functions `DOCUMENTS` (`R2Bucket`). Le binding n'est pas encore configuré dans `wrangler.toml` ni activé sur Pages.

**Ne pas activer les routes d'upload/téléchargement avant validation et tests des exigences documentaires existantes**, notamment :
- limites de taille et liste de types autorisés ;
- validation MIME côté serveur ;
- analyse anti-malware avant publication ;
- chiffrement et gestion des clés ;
- accès serveur après contrôle des permissions ;
- versions immuables et journal d'accès ;
- conservation, sauvegarde, restauration et destruction ;
- tests d'isolation entre Production et Preview.

Le code actuel des pièces jointes ne prouve pas à lui seul que ces exigences sont satisfaites. Le binding activerait effectivement le chemin de stockage ; il ne doit donc pas être ajouté comme simple formalité.

## 3. Migrations D1

La base Cloudflare `sac-db` (`892ce876-f279-409c-8f9e-06b1dca66e9d`) a été vérifiée directement :
- `GET database` confirme 75 tables ;
- interrogation de `sqlite_master` confirme les tables et index ;
- `d1_migrations` contient les 39 entrées `0001` à `0039` ;
- les noms correspondent aux 39 fichiers présents dans `migrations/`.

Les 39 migrations D1 sont donc enregistrées comme appliquées. **Ne pas les rejouer.** La première réponse de l'API de liste D1 affichait un compteur obsolète de zéro table ; la lecture détaillée et la requête SQL directe ont confirmé l'état réel.

Aucune migration D1 supplémentaire n'est requise pour créer un bucket R2 : R2 est un stockage objet séparé.

## 4. État final de ce lot

- [x] R2 activé sur le compte.
- [x] Bucket privé Production créé.
- [x] Bucket privé Preview créé.
- [x] Accès public `r2.dev` désactivé.
- [x] Aucun bucket UPK modifié.
- [x] 39 migrations D1 vérifiées comme appliquées.
- [ ] Binding `DOCUMENTS` ajouté à Pages Functions.
- [ ] Tests d'upload/téléchargement authentifiés et d'isolation.
- [ ] Contrôles de taille, type, MIME et anti-malware homologués.
- [ ] Politique de chiffrement, rétention, sauvegarde et restauration validée.
- [ ] Déploiement et validation runtime après fermeture des prérequis.

**Conclusion :** l'infrastructure R2 de base existe et reste privée. Le stockage documentaire SAC n'est pas déclaré opérationnel tant que le binding et les contrôles de sécurité ne sont pas activés et testés.
