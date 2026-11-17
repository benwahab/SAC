# SAC — Suivi et supervision

Ce fichier suit les étapes réelles du projet. Une tâche ne passe à « terminée » qu'après vérification observable.

## État général

- [x] Périmètre produit corrigé : sécurité personnelle et familiale, alertes privées aux proches.
- [x] Dépôt officiel confirmé : `benwahab/SAC`.
- [x] Branche unique confirmée : `main`.
- [x] Cahier des charges et documents de décisions présents.
- [x] Règle de rappels : toutes les 5 minutes vers les contacts initiaux jusqu'à clôture.
- [x] SOS discret, écran neutre, code de contrainte et protection contre désactivation forcée documentés.
- [x] Cible d'architecture corrigée : Pages, Pages Functions, D1, R2 sous condition d'activation.
- [ ] Audit du code/configuration du Worker Cloudflare existant nommé `sac`.
- [ ] Reconstituer l'environnement Cloudflare Pages de SAC, sans réutiliser les ressources de l'application erronée.
- [ ] Confirmer l'activation de R2 et la possibilité de créer un bucket privé.
- [ ] Finaliser les choix d'authentification, OTP, push, SMS et paiement.
- [ ] Finaliser les règles de conservation et suppression des positions.
- [ ] Finaliser les détails des rappels de Protection des trajets et les relances d'arrivée.
- [ ] Définir les avantages Premium au-delà des 10 contacts.
- [ ] Valider les limites et rôles des groupes familiaux.
- [ ] Préparer les tests de sécurité, de réseau faible et de non-livraison des notifications.
- [ ] Obtenir l'autorisation explicite de démarrer le développement.
- [ ] Créer le socle React/Vite/TypeScript et Pages Functions sur `main`.
- [ ] Créer les migrations D1 et les tests d'accès.
- [ ] Vérifier le build `npm run build` et les déploiements Preview/Production.
- [ ] Tester la préparation Capacitor sur Android puis iOS.

## Règles de mise à jour

- Ne pas cocher une tâche sur la base d'une intention ou d'une configuration supposée.
- Après chaque changement, indiquer le commit GitHub et la preuve de vérification.
- Ne jamais créer une branche secondaire.
- Ne pas supprimer une ressource Cloudflare avant audit de son contenu et de ses dépendances.
