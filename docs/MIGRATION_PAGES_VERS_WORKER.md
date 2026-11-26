# Préparation de migration SAC Pages vers Workers

## État de départ confirmé

- Dépôt source : `benwahab/SAC`, branche `main`.
- Pages actuel : `sac` (`sac-3xh.pages.dev`), connecté au même dépôt.
- Base D1 existante : `sac-db`, ID `892ce876-f279-409c-8f9e-06b1dca66e9d`.
- Les paramètres Pages de production exposent une liaison D1 `DB` vers cette base.
- Le code source conserve 81 fichiers de routes API sous `functions/api/`.
- Le projet Pages ne déclare actuellement aucune liaison R2 dans ses paramètres de production.
- Les Workers auxiliaires SAC restent des ressources séparées.
- Les Workers UPK et leurs bases/buckets ne font pas partie de cette migration.

## Séparation des fichiers mise en place

- `workers/app/wrangler.toml` : configuration indépendante du Worker applicatif `sac-app`.
- `workers/app/README.md` : consignes d’exploitation et garde-fous.
- `vite.config.worker.ts` : sortie frontend dédiée dans `dist/client/`.
- `dist/worker/` : bundle des routes Pages Functions généré au build, non versionné.
- `package.json` : commandes `build:worker`, `dev:worker` et `deploy:worker`.
- CI : compilation Worker ajoutée comme contrôle, sans déploiement.

Le fichier racine `wrangler.toml` et la commande de build Pages existante sont conservés pour ne pas interrompre l’hébergement actuel.

## Ressources réutilisées

Le Worker cible réutilise la base D1 de production existante via la liaison `DB`. Aucun schéma, aucune donnée et aucune migration D1 ne sont modifiés par la configuration.

Les buckets R2 `sac-private-documents` et `sac-private-documents-preview` ne sont pas déclarés comme liaisons dans l’environnement Pages de production actuellement inspecté. Ils ne sont donc pas ajoutés arbitrairement au Worker. Leur usage doit être confirmé dans le code avant de les lier.

## Secrets

Les noms des variables secrètes de Pages ont été recensés, mais Cloudflare ne permet pas de lire leur valeur. Les valeurs ne sont ni exportées ni copiées dans GitHub. Elles devront être configurées de façon sécurisée pour `sac-app` avant son déploiement de production.

## Points à valider avant bascule

1. Exécuter `npm run build:worker` dans CI et confirmer la présence de `dist/worker/index.js` et des assets dans `dist/client/`.
2. Vérifier les routes API, l’authentification, les sessions, WebAuthn, l’envoi d’e-mails, les notifications et les réponses statiques SPA sur un déploiement de prévisualisation.
3. Configurer les secrets sur le Worker sans les exposer dans Git.
4. Confirmer l’usage effectif des deux buckets R2.
5. Mettre à jour l’URL d’appel du Worker de notifications ordinaires seulement après validation du nouveau Worker.
6. Préparer et tester le retour arrière.

## Interdictions pendant la préparation

- Ne pas supprimer ni désactiver le projet Pages `sac`.
- Ne pas modifier la base `sac-db`, ses migrations ou ses données.
- Ne pas modifier les ressources UPK.
- Ne pas modifier les domaines ou le routage de production.
- Ne pas déployer en production avant validation complète.

## Commandes

```sh
npm run build:worker
npm run dev:worker
```

La commande suivante est réservée à la bascule après validation :

```sh
npm run deploy:worker
```

## Référence Cloudflare

La méthode suit la documentation officielle Pages → Workers : compiler les Pages Functions avec `wrangler pages functions build`, puis configurer le script compilé et les assets statiques dans un Worker Static Assets.


## Inventaire des paramètres Pages à reprendre

Les noms suivants ont été observés dans la configuration de Pages SAC. Cet inventaire décrit les entrées présentes dans l'ancien environnement ; il ne signifie pas que chaque entrée doit être copiée telle quelle ni que toutes sont des secrets.

| Groupe | Noms observés | Traitement avant migration |
|---|---|---|
| URL applicative | `APP_BASE_URL` | Adapter à l'URL réelle du Worker uniquement après validation de son domaine et des parcours d'invitation. |
| E-mail Brevo | `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME` | Reprendre les trois paramètres nécessaires au service Brevo ; clé API uniquement comme secret. |
| OTP e-mail | `EMAIL_OTP_HMAC_SECRET` | Secret serveur obligatoire pour signer/vérifier les codes OTP ; ne jamais le journaliser. |
| Relais GPS | `GPS_RELAY_HMAC_SECRET` | Secret serveur utilisé pour signer les tickets du relais GPS ; conserver la même confiance entre services. |
| Dispatch interne | `INTERNAL_DISPATCH_TOKEN` | Secret d'authentification des appels internes de dispatch. |
| Connexion multi-appareils | `MULTI_DEVICE_PASSWORD_LOGIN_ENABLED` | Paramètre fonctionnel à vérifier selon le type Cloudflare et le code qui le lit. |
| Web Push | `PUSH_SUBSCRIPTION_ENCRYPTION_KEY`, `PUSH_VAPID_PRIVATE_JWK`, `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_SUBJECT` | Vérifier la configuration réelle et la cohérence de la paire VAPID. La clé de chiffrement existante masquée n'est pas récupérable en clair ; ne pas supposer qu'elle peut être copiée. Suivre la procédure de rotation commune Pages/Worker avant d'activer le stockage ou l'envoi Push. |
| WebAuthn | `WEBAUTHN_ALLOWED_ORIGINS`, `WEBAUTHN_ROOT_ENROLLMENT_ENABLED`, `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME` | Adapter les origines et le RP à l'URL finale ; garder l'enrôlement racine désactivé tant que la procédure n'est pas validée. |

Cloudflare masque les valeurs des secrets existants. L'assistant ne peut donc ni les exporter depuis Pages, ni vérifier leur contenu, ni les transférer automatiquement. Les valeurs doivent être ajoutées au Worker par une opération sécurisée dans Cloudflare, sans les écrire dans GitHub, les fichiers de configuration, les journaux ou cette documentation.

Avant le premier déploiement public, établir une matrice finale code → paramètre → type (secret/variable) → service consommateur → validation. En particulier, vérifier que le Worker applicatif et les Workers auxiliaires reçoivent uniquement les secrets dont ils ont besoin.


## Procédure détaillée de transfert sécurisé

La matrice opérationnelle et les étapes de transfert sont désormais détaillées dans [`docs/TRANSFERT_SECURise_SECRETS_PAGES_VERS_WORKER.md`](./TRANSFERT_SECURise_SECRETS_PAGES_VERS_WORKER.md). Ce document plus récent fait foi pour la répartition des paramètres entre `sac-app` et les Workers auxiliaires, les risques de rotation et la séquence de bascule. Les paramètres `APP_BASE_URL` et `GPS_RELAY_HMAC_SECRET` restent à confirmer avant toute copie ; ne pas les transférer automatiquement.
