# SAC — Fournisseur d'e-mails transactionnels : Brevo

**Décision :** Brevo remplace intégralement Resend pour les messages transactionnels SAC.  
**État opérationnel :** le propriétaire du projet confirme le 25 novembre 2026 que Brevo est déjà configuré et fonctionne.

## Parcours couverts

- Vérification de l'adresse e-mail à l'inscription et renvoi OTP.
- Invitations des proches de confiance.
- Envoi des codes OTP des demandes d'assistance, selon le parcours correspondant.

Le code OTP, son empreinte HMAC, son expiration, le nombre de tentatives et sa consommation restent soumis à leurs contrats respectifs. Un message n'est accepté par SAC que si l'API Brevo répond avec un identifiant `messageId`. Cela ne prouve pas la remise en boîte de réception.

## Intégration technique

- API officielle : `POST https://api.brevo.com/v3/smtp/email`.
- Authentification par l'en-tête `api-key`.
- Module partagé : `functions/lib/email/brevo.ts`.
- Adaptateurs : `functions/lib/email/verification.ts` et `functions/lib/email/contact-invitation.ts`.
- Les clés restent exclusivement dans les secrets Cloudflare.
- Réponse fournisseur limitée à 4 Ko, délai maximal de 8 secondes, redirections refusées, aucune réponse brute ou code OTP journalisé.

## Configuration et règles d'exploitation

Le code utilise les paramètres `BREVO_API_KEY`, `BREVO_FROM_EMAIL` et `BREVO_FROM_NAME`. `APP_BASE_URL` est requis par les parcours qui construisent des liens d'invitation.

Les valeurs de configuration sont privées et ne doivent pas être inscrites dans le dépôt. L'état opérationnel de Brevo est confirmé par le propriétaire du projet ; les anciennes notes affirmant que l'expéditeur reste à configurer sont obsolètes.

Ne pas demander une nouvelle configuration, ne pas remplacer Brevo et ne pas réactiver Resend sans décision explicite du propriétaire. Une lecture partielle des paramètres Cloudflare ne suffit pas à conclure que l'envoi est indisponible.

## Références officielles

- [Envoi d'un e-mail transactionnel](https://developers.brevo.com/docs/send-a-transactional-email)
- [Référence API](https://developers.brevo.com/reference/send-transac-email)
- [Authentification par clé API](https://developers.brevo.com/docs/api-key-authentication)
