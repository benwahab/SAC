# SAC — Audit de la gestion des appareils et des sessions

**Date : 21 novembre 2026**  
**Branche :** `main`  
**Périmètre :** dépôt `benwahab/SAC` uniquement.  
**Aucune modification de schéma D1 distant ni aucun déploiement n'est effectué par cet audit.**

## 1. État vérifié du code

### Appareil racine

Le parcours d'enrôlement initial existe déjà :

- `functions/api/auth/root-enrollment-options.ts`
- `functions/api/auth/complete-root-enrollment.ts`
- `functions/api/auth/login-options.ts`
- `functions/api/auth/session.ts`
- `functions/api/auth/logout.ts`

L'enrôlement utilise une credential WebAuthn non sauvegardée, liée au compte, et crée une session liée à l'appareil racine.

### Limite structurelle actuelle

La migration `0007_root_device_enrollment.sql` impose explicitement un seul enregistrement dans `devices` par compte avec l'index unique :

```sql
CREATE UNIQUE INDEX devices_one_root_per_account ON devices(account_id);
```

La table `devices` ne distingue actuellement que les états `active` et `revoked`. La table `device_root_credentials` impose une credential racine unique par appareil. Il n'existe pas de parcours serveur complet pour enrôler, approuver ou révoquer des appareils secondaires.

Le module `src/domain/device-management.ts` contient une transition métier pure qui mentionne `pending_verification`, mais cette valeur n'est pas autorisée par le CHECK de la table `devices`. Ce module ne constitue pas une API et ne persiste aucune transition.

**Conclusion : la prise en charge de plusieurs appareils secondaires n'est pas opérationnelle.** Il ne faut pas présenter l'appareil racine actuel comme une gestion multi-appareils achevée.

## 2. Gestion des sessions ajoutée

Les sessions disposent déjà d'un identifiant propre, d'un hash de jeton, d'un état, d'une date de création, d'une dernière activité, d'une expiration et d'un lien vers le compte et l'appareil.

Les ajouts sur `main` sont :

- `GET /api/auth/sessions` : retourne uniquement les sessions actives du compte authentifié, avec leurs dates et l'indication de la session courante.
- `POST /api/auth/revoke-session` : révoque une autre session appartenant au compte authentifié ; la session courante ne peut pas être révoquée par cette action.
- `src/private/screens/Settings.tsx` : affiche les sessions ouvertes et permet de fermer individuellement une autre session.
- Les libellés sont disponibles en français, anglais et arabe.
- `tests/session-management-endpoints.test.ts` couvre les frontières d'authentification et le rejet des requêtes cross-origin.

Les endpoints ne retournent jamais les jetons ni leurs empreintes. Le serveur dérive le compte depuis la session authentifiée ; aucun identifiant de compte fourni par le navigateur n'est utilisé pour choisir les sessions à modifier.

## 3. Ce qui reste à construire pour les appareils secondaires

1. Séparer explicitement l'appareil racine des appareils secondaires dans le modèle de données.
2. Préparer une migration additive qui remplace la contrainte « un seul appareil par compte » sans réécrire une migration déjà appliquée.
3. Définir une cérémonie d'ajout d'appareil secondaire : demande depuis le nouvel appareil, approbation explicite par l'appareil racine, preuve cryptographique liée à la demande et expiration courte.
4. Enrôler une credential propre à chaque appareil secondaire et créer une session qui lui est liée.
5. Ajouter les endpoints authentifiés pour lister les appareils, approuver une demande, refuser une demande et révoquer un appareil.
6. Lors de la révocation d'un appareil, invalider atomiquement toutes ses sessions et ses autorisations futures, sans révoquer les autres appareils du compte.
7. Ajouter les tests D1 de concurrence, rejeu, approbation par un appareil non racine, révocation individuelle et isolation entre comptes.
8. Ajouter l'interface d'approbation et de révocation des appareils secondaires dans les réglages.

La révocation d'un appareil et la révocation d'une session doivent rester deux opérations distinctes : la première invalide toutes les sessions de l'appareil ; la seconde ne ferme qu'une session.

## 4. Contraintes à préserver

- Plusieurs sessions peuvent coexister sans qu'une session invalide automatiquement les autres.
- Un appareil secondaire ne peut jamais approuver un autre appareil ni devenir appareil racine.
- Seul l'appareil racine déjà authentifié peut approuver un nouvel appareil secondaire.
- Une révocation est individuelle, immédiate côté serveur et irréversible pour l'identifiant révoqué.
- Aucun jeton de session, secret, credential privée ou donnée GPS ne doit apparaître dans les listes ou journaux d'interface.
- Ne pas activer GPS, envoyer de vrais SOS, push ou SMS pendant les tests.
- Ne pas modifier une migration déjà appliquée à distance ; préparer une migration suivante après vérification de l'état D1.

## 5. Vérification et limites de cet ajout

- Les fichiers et migrations cités ont été relus sur `main`.
- Les nouveaux endpoints et l'interface ont été enregistrés sur `main`.
- Les tests de frontières ont été ajoutés.
- Les statuts CI consultés ne retournent aucun statut de vérification ; les tests et le build ne sont donc pas déclarés verts.
- Aucun appareil secondaire n'a été enrôlé, aucune session réelle n'a été révoquée et aucune donnée de production n'a été modifiée.
