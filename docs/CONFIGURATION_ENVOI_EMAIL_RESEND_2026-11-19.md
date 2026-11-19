# SAC — Configuration de l'envoi automatique des e-mails

**Date de vérification :** 19 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`  
**Périmètre :** vérification d'adresse e-mail à l'inscription et invitations de proches.

## Objectif fonctionnel

Une personne saisit son adresse pendant son inscription SAC. Le serveur génère automatiquement un code OTP, demande son envoi au fournisseur et n'active le compte qu'après validation du code. Aucun destinataire de démonstration ni aucune adresse personnelle à fournir manuellement ne fait partie du parcours normal d'inscription.

## État réellement vérifié

- Le module `functions/lib/email/resend.ts` appelle directement l'API serveur Resend. La clé reste côté Cloudflare et n'est jamais envoyée au navigateur.
- `POST /api/auth/register` et `POST /api/auth/resend-email` appellent le module pour envoyer le code de vérification.
- `POST /api/auth/verify-email` vérifie le code et déclenche l'activation prévue par le schéma D1.
- Le même fournisseur est utilisé par le parcours d'invitation des proches.
- Le secret `EMAIL_OTP_HMAC_SECRET` est présent dans les variables de production Pages.
- Le secret `RESEND_API_KEY` est présent dans les variables de production Pages.
- `RESEND_FROM_EMAIL` est présent dans Cloudflare. Sa valeur avait été renseignée comme `onboarding@resend.dev`; le tableau de bord le masque car il est actuellement stocké comme variable secrète.
- La liste des domaines Resend du compte connecté est vide au moment de la vérification du 19 novembre 2026.
- Le projet Pages `sac` est relié au dépôt `benwahab/SAC`, branche `main`. Les déploiements automatiques de production restent désactivés.
- La base D1 distante `sac-db` contient actuellement zéro table : les migrations versionnées ne sont pas appliquées à distance.

## Conséquence de la restriction Resend

L'expéditeur partagé `onboarding@resend.dev` est réservé aux envois limités à l'adresse propriétaire du compte Resend. Il ne permet pas d'envoyer librement des codes aux adresses des futurs utilisateurs SAC. Resend exige un domaine contrôlé par SAC, ajouté dans son tableau de bord et vérifié par les enregistrements DNS qu'il fournit, puis une adresse expéditrice appartenant à ce domaine.

Cette restriction est imposée par Resend ; elle ne signifie pas qu'il faut demander à chaque nouvel inscrit de fournir une adresse de démonstration. Le champ destinataire reste automatiquement l'adresse saisie par la personne dans le formulaire d'inscription.

Référence fournisseur : [Resend — guide officiel de vérification d'un domaine](https://resend.com/docs/dashboard/domains/introduction).

## Étapes restantes — sans changer le parcours utilisateur

1. Ajouter dans Resend un domaine que SAC est autorisé à utiliser.
2. Publier chez le gestionnaire DNS les enregistrements exacts affichés par Resend, sans les inventer ni les modifier.
3. Attendre que Resend confirme le domaine comme vérifié.
4. Remplacer `RESEND_FROM_EMAIL` par une adresse expéditrice de ce domaine, en conservant la clé API côté secret Cloudflare.
5. Lorsqu'une autorisation distincte sera donnée, appliquer les migrations D1 approuvées et effectuer un déploiement contrôlé. Tant que cela n'est pas autorisé, la production reste inactive.

## Garde-fous

- Ne jamais demander au citoyen une adresse de test ou l'adresse du propriétaire du compte Resend.
- Ne jamais mettre la clé API, le secret HMAC, un OTP ou un jeton d'invitation dans GitHub, le navigateur ou les journaux.
- Ne jamais afficher « e-mail envoyé » si Resend a refusé l'envoi ou si le résultat est ambigu.
- Un statut « accepté » par Resend ne prouve pas que le message a été remis, ouvert ou lu.
- Ne pas activer le déploiement de production ni appliquer une migration distante sans autorisation explicite.
- Ne pas remplacer l'authentification SAC par un autre fournisseur ou une autre architecture sans arbitrage explicite.

## Conclusion

Le mécanisme d'envoi automatique est déjà raccordé dans le code. La configuration de la clé est en place. Le seul prérequis fournisseur pour adresser librement les futurs inscrits est un domaine d'envoi vérifié et son adresse expéditrice correspondante. La mise en service reste également conditionnée aux migrations D1 approuvées et au déploiement contrôlé.
