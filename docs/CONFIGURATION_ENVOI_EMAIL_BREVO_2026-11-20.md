# SAC — Configuration de l'envoi automatique des e-mails avec Brevo

**Date :** 20 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`

## État du code
L'envoi des codes OTP et des invitations est désormais raccordé à l'API transactionnelle Brevo. Resend est retiré du code applicatif. Aucun changement n'est apporté au cycle OTP ni aux transitions D1.

## Configuration à finaliser
La configuration Cloudflare Pages consultée contient le secret `BREVO_API_KEY`. Elle ne contient pas encore les variables `BREVO_FROM_EMAIL` et `BREVO_FROM_NAME`. Il faut renseigner une adresse déjà vérifiée dans Brevo et le nom expéditeur autorisé.

Tant que ces variables ne sont pas définies, les routes répondent avec un statut de service non configuré ; elles ne prétendent pas qu'un e-mail a été envoyé.

## Sécurité
- La clé Brevo reste côté serveur.
- Délai HTTP de 8 secondes et redirections interdites.
- Réponse JSON limitée à 4 Ko.
- Aucune clé, OTP, jeton d'invitation ou réponse brute fournisseur n'est journalisé.
- Aucun basculement automatique vers un autre fournisseur.
