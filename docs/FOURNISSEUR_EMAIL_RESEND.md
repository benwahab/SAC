# SAC — Fournisseur d'e-mails transactionnels : Resend

Date de décision technique : 18 novembre 2026

## Choix

Le fournisseur retenu pour l'envoi des e-mails transactionnels SAC est **Resend**.

Documentation officielle :
- Tarifs : https://resend.com/pricing
- Intégration Cloudflare Workers : https://resend.com/cloudflare
- API d'envoi : https://resend.com/docs/api-reference/emails/send-email

Le plan gratuit permanent affiché à la date de vérification comprend 3 000 e-mails par mois, avec une limite de 100 e-mails par jour et jusqu'à trois domaines vérifiés. Les quotas peuvent évoluer ; ils doivent être revérifiés avant la mise en production.

## Prérequis indispensables pour un envoi réel

1. Créer le compte Resend SAC.
2. Disposer d'un domaine contrôlé par le projet et pouvoir modifier ses DNS.
3. Ajouter le domaine ou sous-domaine d'envoi dans Resend.
4. Publier les enregistrements DNS SPF/DKIM demandés par Resend et attendre la vérification.
5. Choisir une adresse d'expédition sur ce domaine vérifié, par exemple `verification@<domaine-SAC>`.
6. Créer une clé API Resend limitée au besoin d'envoi.
7. Enregistrer la clé dans les secrets Cloudflare Pages sous `RESEND_API_KEY`.
8. Enregistrer l'adresse expéditrice dans la variable d'environnement Cloudflare `RESEND_FROM_EMAIL`.
9. Effectuer un envoi réel vers une adresse de test contrôlée et vérifier la réception ainsi que les journaux de livraison Resend.

Le domaine `resend.dev` de test n'est pas un expéditeur de production permettant d'envoyer librement à tous les utilisateurs. Il ne doit pas être utilisé comme raccourci pour contourner la vérification du domaine SAC.

## Code livré

Le module `functions/lib/email/resend.ts` appelle réellement `https://api.resend.com/emails` avec la clé secrète côté serveur. Il ne contient aucun mode simulé, aucune boîte de réception fictive et aucun code OTP de démonstration.

Le message de vérification est disponible en français, anglais et arabe (RTL). Le module ne journalise ni le code OTP ni la réponse brute du fournisseur. Une réponse sans identifiant de message exploitable n'est pas considérée comme un succès.

## Limite actuelle — aucune fausse confirmation

Le module est intégré au dépôt, mais l'envoi n'est pas encore activé : aucun domaine d'envoi SAC vérifié, aucune clé Resend et aucune adresse expéditrice ne sont actuellement configurés dans les secrets Cloudflare. Tant que ces trois prérequis ne sont pas renseignés, la fonction retourne `provider_not_configured` et aucun e-mail n'est prétendu envoyé.

La réponse positive de l'API signifie que Resend a accepté le message, pas que le destinataire l'a lu ou que la boîte de réception l'a délivré. La livraison doit être confirmée via les événements/journaux du fournisseur si cette preuve est nécessaire.

## Sécurité et étapes restantes

- Ne jamais placer la clé API dans le frontend, Git, les fichiers de configuration suivis ou les logs.
- Ne jamais exposer le code OTP dans une réponse HTTP, un log ou une télémétrie.
- La persistance du challenge, son empreinte protégée, son expiration, ses tentatives, sa consommation unique, ses limites anti-abus et l'activation atomique du compte restent à implémenter selon le contrat SAC.
- Aucun SMS ne remplace la vérification e-mail.
- Aucun compte ne doit devenir actif et aucune session ne doit être créée avant validation serveur du code.
- Le module d'envoi seul ne constitue pas une authentification complète.

**Statut : fournisseur sélectionné et adaptateur réel intégré ; configuration du compte fournisseur/domaine et parcours OTP complet encore nécessaires.**
