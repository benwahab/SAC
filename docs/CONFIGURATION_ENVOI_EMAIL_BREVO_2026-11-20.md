# SAC — Configuration de l'envoi automatique des e-mails avec Brevo

**Dernière mise à jour :** 25 novembre 2026  
**Dépôt :** `benwahab/SAC`, branche `main`

## État du code et du service

L'envoi des codes OTP et des invitations est raccordé à l'API transactionnelle Brevo. Resend est retiré du code applicatif.

**État opérationnel confirmé par le propriétaire du projet :** le fournisseur Brevo est déjà configuré et l'envoi d'e-mails fonctionne. Les anciennes notes indiquant que l'expéditeur restait à configurer ne sont plus valables et ne doivent pas être utilisées comme blocage du chantier.

Cette confirmation opérationnelle est une information du propriétaire du projet ; elle ne constitue pas une nouvelle vérification indépendante de chaque parcours d'envoi dans cette mise à jour documentaire.

## Configuration et exploitation

Les noms de paramètres utilisés par le code sont `BREVO_API_KEY`, `BREVO_FROM_EMAIL` et `BREVO_FROM_NAME`. Les valeurs restent privées et ne doivent jamais être copiées dans la documentation, les journaux ou les commits.

`APP_BASE_URL` est également utilisé par les parcours qui génèrent des liens d'invitation. Toute vérification future doit porter sur l'environnement et le parcours concernés, sans conclure à une panne sur la seule base d'un affichage partiel des paramètres Cloudflare.

Ne pas demander une nouvelle configuration du fournisseur, ne pas remplacer Brevo et ne pas réactiver Resend comme solution de secours sans décision explicite du propriétaire.

## Sécurité

- La clé Brevo reste côté serveur.
- Délai HTTP de 8 secondes et redirections interdites.
- Réponse JSON limitée à 4 Ko.
- Aucune clé, OTP, jeton d'invitation ou réponse brute fournisseur n'est journalisé.
- Aucun basculement automatique vers un autre fournisseur.
- Un identifiant `messageId` confirme l'acceptation par le fournisseur, pas la remise en boîte de réception.
