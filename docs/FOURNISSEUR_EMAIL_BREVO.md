# SAC — Fournisseur d'e-mails transactionnels : Brevo

**Décision :** Brevo remplace intégralement Resend pour les messages transactionnels SAC.

## Parcours couverts
- Vérification de l'adresse e-mail à l'inscription et renvoi OTP.
- Invitations des proches de confiance.

Le code OTP, son empreinte HMAC, son expiration, le nombre de tentatives et sa consommation restent inchangés. Un message n'est accepté par SAC que si l'API Brevo répond avec un identifiant `messageId`. Cela ne prouve pas la remise en boîte de réception.

## Intégration technique
- API officielle : `POST https://api.brevo.com/v3/smtp/email`.
- Authentification par l'en-tête `api-key`.
- Module partagé : `functions/lib/email/brevo.ts`.
- Adaptateurs : `functions/lib/email/verification.ts` et `functions/lib/email/contact-invitation.ts`.
- Les clés restent exclusivement dans les secrets Cloudflare.
- Réponse fournisseur limitée à 4 Ko, délai maximal de 8 secondes, redirections refusées, aucune réponse brute ou code OTP journalisé.

## Configuration Cloudflare Pages requise
- Secret `BREVO_API_KEY` (déjà présent dans la configuration consultée).
- Variable `BREVO_FROM_EMAIL` : adresse d'expédition vérifiée dans Brevo.
- Variable `BREVO_FROM_NAME` : nom affiché, par exemple SAC.
- `APP_BASE_URL` reste requis pour les invitations.

Aucune adresse expéditrice n'est inventée. L'envoi réel reste indisponible tant que l'adresse expéditrice validée n'est pas configurée. Ne pas réactiver Resend comme solution de secours.

## Références officielles
- [Envoi d'un e-mail transactionnel](https://developers.brevo.com/docs/send-a-transactional-email)
- [Référence API](https://developers.brevo.com/reference/send-transac-email)
- [Authentification par clé API](https://developers.brevo.com/docs/api-key-authentication)
