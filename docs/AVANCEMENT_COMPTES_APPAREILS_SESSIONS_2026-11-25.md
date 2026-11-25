# SAC — Avancement comptes, appareils et sessions

**Date :** 25 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche unique `main`  
**Statut :** amélioration incrémentale livrée sur la gestion des sessions ; récupération de compte et révocation complète d'appareil toujours bloquées par les arbitrages de sécurité.

## 1. Ce qui existe déjà

- Connexion e-mail vérifié + mot de passe.
- Session opaque, cookie hôte `HttpOnly`, `Secure`, `SameSite` et empreinte du jeton stockée en D1.
- Contrôle serveur de la session, du compte, de l'appareil et de la version d'autorisation à chaque requête protégée.
- Expiration après 30 jours d'inactivité et limite absolue de 90 jours.
- Liste des sessions actives du compte : `GET /api/auth/sessions`.
- Fermeture individuelle d'une autre session : `POST /api/auth/revoke-session`.
- Déconnexion de la session courante : `POST /api/auth/logout`.
- Changement de mot de passe avec le mot de passe actuel : `POST /api/account/password`.
- La console Réglages affiche les sessions et permet de fermer une session non reconnue.

## 2. Amélioration livrée le 25 novembre

La liste des sessions expose maintenant, pour chaque session active, des métadonnées non secrètes de l'appareil associé :

- identifiant interne de l'appareil (utilisé uniquement pour le regroupement et le diagnostic) ;
- date d'enregistrement de l'appareil ;
- présence ou absence d'une credential racine enregistrée sur cet appareil ;
- dates d'ouverture, de dernière activité et d'expiration de la session.

L'interface Réglages affiche ces informations en français, anglais et arabe. Les sessions restent fermables individuellement. Aucun jeton, hash de jeton, secret, adresse IP ou donnée GPS n'est renvoyé.

Le statut « credential racine enregistrée » décrit uniquement la présence d'une ligne D1 associée. Il ne constitue pas une preuve cryptographique récente, ne prouve pas que la clé est disponible et ne confère pas à lui seul une autorité de révocation.

## 3. Amélioration complémentaire — regroupement par appareil

La console Réglages regroupe maintenant les sessions par identifiant d'appareil, au lieu de présenter chaque session comme un appareil distinct. Pour chaque appareil, l'interface affiche une seule fois ses métadonnées et le nombre de sessions actives ; les détails et la fermeture restent propres à chaque session. Les libellés sont disponibles en français, anglais et arabe.

Cette présentation évite de faire croire qu'un même téléphone ayant plusieurs sessions correspond à plusieurs appareils. Elle ne permet toujours pas de révoquer l'appareil entier.

## 4. Limites importantes — ne pas contourner

- Fermer une session ne révoque pas l'appareil entier.
- La révocation d'un appareil doit invalider atomiquement toutes ses sessions et ses abonnements push ; le trigger D1 de révocation des appareils supprime déjà les abonnements push associés.
- La révocation d'un appareil racine, le remplacement d'une racine, le ré-ancrage des proches et la récupération cryptographique restent interdits en V1 sans protocole approuvé et revue indépendante.
- Une session secondaire ne doit jamais être élevée au rang d'appareil racine.
- Le mot de passe et l'OTP e-mail ne remplacent pas la preuve cryptographique de la racine.
- La réinitialisation du mot de passe sans appareil fiable n'est pas encore implémentée : les facteurs, la réauthentification, les notifications et les effets sur les sessions doivent être arbitrés avant code.
- La récupération de compte sans appareil fiable ne peut pas créer une nouvelle racine ni approuver un nouvel appareil.
- Aucune migration D1 n'est requise pour cette amélioration de métadonnées.

## 5. Migrations et vérifications

Les migrations `0024_root_authentication_session_claim.sql` et `0025_sos_sms_acknowledgement_gate.sql` sont inscrites dans `d1_migrations` de la base distante `sac-db`. La tranche de métadonnées appareil/session ne crée aucune migration.

Le test `tests/session-management-endpoints.test.ts` couvre désormais la réponse de liste authentifiée, l'absence de secrets, la révocation limitée au compte de la session authentifiée, le refus de révoquer la session courante et les gardes same-origin. Le workflow CI exécute ce test via `npm run test:session-management`. La tranche a été validée sur le commit `15bf6b130db78b604cbddd7ddee2870639caa2d5` : CI complète réussie et déploiement Pages réussi.

## 6. Prochaines étapes, dans l'ordre sûr

1. Terminer les tests CI et vérifier le déploiement Pages du commit correspondant.
2. Spécifier et faire approuver la révocation complète d'un appareil secondaire depuis une preuve de confiance appropriée.
3. Ajouter le parcours de révocation uniquement après définition de l'autorité, de la transaction D1, des effets sur sessions/push et des tests de concurrence.
4. Faire arbitrer la réinitialisation renforcée du mot de passe, le changement d'e-mail compromis et les notifications de sécurité.
5. Concevoir séparément la récupération d'accès au compte et la récupération de la racine ; ne jamais les fusionner.
6. Maintenir désactivés les parcours non homologués et ne pas activer le GPS précis tant que la destruction irréversible J+30 n'est pas prouvée.

## 7. Fournisseur e-mail

Le fournisseur e-mail SAC est **Brevo**. L'utilisateur a confirmé le 25 novembre 2026 que la configuration existante fonctionne. Ne pas demander une nouvelle configuration, ne pas remplacer le fournisseur et ne pas bloquer cette tranche sur ce sujet.
