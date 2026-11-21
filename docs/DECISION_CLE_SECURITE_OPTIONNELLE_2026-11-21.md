# SAC — Décision : clé de sécurité facultative à la première connexion

- **Date :** 21 novembre 2026
- **Dépôt :** benwahab/SAC
- **Branche :** main
- **Statut :** décision produit demandée explicitement par l’utilisateur ; implémentée et testée en production.

## Décision

La clé de sécurité WebAuthn n’est plus exigée pour créer un compte ni pour ouvrir la première session.

- Un compte activé par e-mail peut se connecter avec son adresse et son mot de passe.
- Une session provisoire est créée sans credential WebAuthn.
- La clé de sécurité reste fortement recommandée et se configure depuis les réglages du compte.
- Un badge de notification et une carte explicative rappellent l’intérêt de la clé sans bloquer l’utilisateur.
- Une fois la clé configurée, les connexions suivantes exigent l’authentification WebAuthn. Le mot de passe seul ne permet plus d’ouvrir une session.

Cette décision modifie uniquement le **moment** et le caractère obligatoire de l’enrôlement. Elle ne modifie pas le profil WebAuthn validé : authenticator de plateforme, vérification utilisateur obligatoire, credential single-device, BE=0/BS=0, un seul appareil racine par compte.

## Conséquence de sécurité assumée

Une session ouverte avec le seul mot de passe peut accéder aux fonctions de l’application, y compris le déclenchement d’une alerte SOS. La clé de sécurité n’est donc plus une condition d’accès aux fonctions sensibles tant qu’elle n’est pas configurée.

Ce choix est volontaire : il évite de bloquer les utilisateurs dont l’appareil ou le navigateur ne prend pas en charge WebAuthn. Il doit être documenté comme une limite résiduelle et ne doit pas être présenté comme une protection équivalente à l’enrôlement obligatoire.

## Implémentation

- `POST /api/auth/password-session` : vérifie l’adresse et le mot de passe, crée ou réutilise un appareil provisoire sans credential, puis ouvre une session.
- `POST /api/auth/start-root-enrollment` : authentifié par la session, crée une cérémonie d’enrôlement pour un appareil provisoire.
- `POST /api/auth/complete-root-enrollment` : attache le credential à l’appareil provisoire, révoque les anciennes sessions et ouvre une nouvelle session.
- `GET /api/auth/session` : expose `securityKeyConfigured`.
- `migrations/0016_optional_root_enrollment.sql` : autorise une cérémonie lorsqu’un appareil existe sans credential, tout en refusant un second credential racine.
- Interface : carte « Clé de sécurité » dans les réglages, badge sur l’onglet Réglages et carte de rappel sur le tableau de bord.

## Preuves exécutées

- Tests unitaires des endpoints de session mot de passe et d’enrôlement facultatif.
- Test de schéma D1 de la migration `0016`.
- `npm run typecheck` et `npm run build` réussis.
- Test réel en production avec un compte temporaire :
  1. inscription et vérification OTP ;
  2. `login-options` retourne `root_enrollment_required` ;
  3. `password-session` retourne `201` avec `securityKeyConfigured:false` ;
  4. `session` retourne `securityKeyConfigured:false` ;
  5. `start-root-enrollment` retourne `200` avec les options ;
  6. `complete-root-enrollment` retourne `201` et conserve le même appareil ;
  7. `session` retourne `securityKeyConfigured:true` ;
  8. `login-options` retourne ensuite un défi WebAuthn.
- Le compte temporaire, ses appareils, sessions, cérémonies et le mailbox de test ont été supprimés après vérification.

## Limites

- Aucun test avec un authentificateur physique réel n’a été exécuté dans cette session. Le test de production a utilisé une credential WebAuthn synthétique valide pour vérifier le parcours serveur.
- Le blocage des fonctions sensibles sans clé n’est pas implémenté.
- Les appareils secondaires et le remplacement de racine restent hors périmètre V1.
