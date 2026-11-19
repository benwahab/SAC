# SAC — Worker de livraison Web Push

Ce Worker est séparé du projet Pages afin que les tâches SOS puissent être traitées par un déclencheur Cron sans dépendre d'une visite de la PWA.

## Fonctionnement

- Le déclencheur Cron appelle le dispatcher de l'outbox chaque minute.
- Le dispatcher acquiert les tâches dues avec les baux D1 existants.
- Le transport recharge les abonnements actifs du destinataire, en joignant les comptes et appareils encore actifs.
- Chaque endpoint est déchiffré en mémoire uniquement.
- Les endpoints sont acceptés uniquement si leur hôte correspond exactement à la liste autorisée du code. HTTPS et le port standard sont obligatoires. Les redirections ne sont jamais suivies.
- Le message transmis est générique ; aucun GPS, description libre, nom de proche ou détail de l'alerte n'est envoyé dans le payload.
- Une réponse 404/410 supprime l'abonnement devenu invalide.
- Une réponse positive du fournisseur signifie uniquement « accepté par le fournisseur », jamais « affiché » ou « lu ».

## Variables et secrets requis

Le Worker a besoin des mêmes valeurs cryptographiques que Pages pour déchiffrer les abonnements :

- `PUSH_SUBSCRIPTION_ENCRYPTION_KEY` — secret base64url de 32 octets ; doit être identique à celui utilisé par `POST /api/push/subscriptions` dans Pages.
- `PUSH_VAPID_PRIVATE_JWK` — secret contenant le JWK privé P-256 complet.
- `PUSH_VAPID_PUBLIC_KEY` — clé publique P-256 non compressée, encodée en base64url ; la même clé publique est fournie à la PWA par `GET /api/push/vapid-public-key`.
- `PUSH_VAPID_SUBJECT` — URI de contact VAPID valide, ici l'origine HTTPS SAC déclarée dans la configuration.

Les secrets Cloudflare sont en écriture seule : une valeur existante ne peut pas être récupérée pour la copier vers ce Worker. Avant son activation, il faudra générer une nouvelle clé de chiffrement commune et la configurer simultanément dans Pages et dans ce Worker, puis créer la paire VAPID et configurer ses valeurs publiques/privées dans les environnements appropriés. Comme aucun abonnement PWA n'est encore activé, cette rotation préparatoire n'entraîne pas de perte d'abonnements existants.

## Déploiement

Le fichier `wrangler.toml` lie le Worker à la base `sac-db` et programme le Cron `* * * * *`. Le Worker n'est pas encore créé ni déployé sur Cloudflare.

Toute configuration des secrets, création du Worker, activation du Cron ou déploiement exige une autorisation distincte. Ne pas lancer de livraison réelle depuis un environnement de prévisualisation.

## Limites connues

- La tâche outbox est agrégée par destinataire, alors qu'un compte peut avoir plusieurs appareils. Si certains appareils acceptent l'envoi et qu'un autre échoue temporairement, la reprise peut répéter un envoi déjà accepté. Aucune garantie exactly-once n'est annoncée.
- Le Worker utilise la politique de retry bornée déjà présente dans le service SOS. Un endpoint absent ou bloqué n'est jamais traité comme une livraison réussie.
- Les notifications SMS ne sont pas envoyées par ce Worker.
- L'activation de ce Worker ne prouve pas la livraison au terminal ni la lecture par le proche.
