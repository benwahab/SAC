# SAC — Décision de pilotage : OTP e-mail hors chemin critique du développement

- **Date :** 19 novembre 2026
- **Dépôt :** `benwahab/SAC`
- **Branche :** `main`
- **Statut :** décision de pilotage validée par le propriétaire du projet.

## Décision

L'intégration et la configuration du fournisseur d'e-mail OTP ne doivent plus retarder les autres chantiers SAC.

Le travail est séparé en deux pistes indépendantes :

1. **Piste identité / e-mail** : conserver l'inscription avec adresse e-mail vérifiée, les défis OTP à durée limitée, leur empreinte HMAC, les limites de tentatives, le renvoi contrôlé et les états exacts de livraison. Finaliser le fournisseur Resend et son domaine d'envoi lorsqu'ils sont prêts.
2. **Piste produit / plateforme** : poursuivre immédiatement les modules qui ne dépendent pas de l'envoi OTP : authentification par assertion WebAuthn, sessions et autorisations, proches et invitations, moteur SOS, journal d'événements, interface, accessibilité, PWA et documentation.

## Invariants de sécurité non négociables

- Ne jamais marquer une adresse e-mail comme vérifiée sans preuve valable.
- Ne jamais activer un compte en attente en contournant l'OTP.
- Ne jamais exposer, afficher ou journaliser le code OTP, le secret HMAC ou la clé Resend.
- Un échec d'envoi doit rester explicite et récupérable ; il ne doit pas être présenté comme une livraison réussie.
- Aucun compte opérationnel, destinataire ou événement métier fictif ne doit être créé pour contourner une dépendance externe.
- Le fournisseur e-mail ne doit pas être appelé depuis les modules qui n'en ont pas besoin.

## Règle d'architecture

Les services métier doivent dépendre d'interfaces de capacité (par exemple identité vérifiée, session authentifiée, autorisation), et non de l'implémentation Resend. Les modules non liés à l'inscription ne doivent pas importer directement le client Resend.

Le parcours d'inscription peut rester indisponible tant que l'envoi OTP n'est pas réellement opérationnel ; cela ne doit pas empêcher de développer, documenter et intégrer les autres modules. Aucun mode de contournement OTP ou compte de démonstration n'est autorisé.

## Ordre de travail

1. Continuer les tranches fonctionnelles indépendantes de l'OTP.
2. Terminer le flux de connexion WebAuthn par assertion et le contrôle de session commun avant d'exposer les API privées.
3. Consolider les routes proches/invitations et le cycle SOS derrière les gardes d'authentification et d'autorisation.
4. Garder Resend comme adaptateur isolé, configurable et remplaçable.
5. Finaliser la délivrabilité e-mail séparément, avec un domaine d'envoi vérifié avant toute ouverture réelle à des destinataires arbitraires.

## Limites opérationnelles

Cette décision n'autorise ni migration distante D1, ni activation R2, ni déploiement de production, ni dépense, ni activation du parcours WebAuthn racine. Ces actions restent soumises à leurs validations propres.

