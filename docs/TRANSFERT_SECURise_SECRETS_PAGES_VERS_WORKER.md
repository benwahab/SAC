# Transfert sécurisé des paramètres SAC de Pages vers Workers

**Statut : préparation documentaire uniquement — aucun secret n'a été lu, copié, régénéré ou modifié. Aucun Worker n'a été déployé.**

## Objectif et périmètre

Préparer le Worker applicatif `sac-app` pour qu'il reprenne les paramètres nécessaires de Pages SAC, tout en conservant l'ancien Pages comme solution de retour arrière.

- Projet source : `benwahab/SAC`, branche `main`.
- Ancien service à préserver : Pages `sac`.
- Nouveau service cible : Worker `sac-app`.
- Base D1 : liaison existante `DB` vers `sac-db` ; ne pas créer, cloner, réinitialiser ni migrer la base de production dans cette phase.
- UPK est hors périmètre.
- Les buckets R2 privés ne sont pas liés à Pages production et ne sont pas à ajouter au Worker sans audit fonctionnel dédié.

## Règles de sécurité impératives

1. Ne jamais demander, coller ou enregistrer une valeur secrète dans une conversation, issue GitHub, fichier du dépôt, variable de build, capture d'écran ou journal.
2. Les valeurs des secrets Pages ne sont pas récupérables via l'API Cloudflare. Les noms seulement sont visibles.
3. Ne jamais remplacer une clé de chiffrement ou une clé VAPID par une valeur aléatoire « pour faire fonctionner » le Worker.
4. Ne pas activer le nouveau Worker en production tant que les secrets et les origines WebAuthn n'ont pas été configurés et contrôlés.
5. Garder Pages actif et son ancien jeu de paramètres intact jusqu'à la fin de la période de validation et du test de retour arrière.
6. Les paramètres partagés par plusieurs Workers doivent être strictement identiques lorsque leur fonction l'exige.
7. Configurer les secrets directement dans le tableau de bord Cloudflare, dans les paramètres du Worker concerné, ou par une commande Wrangler exécutée dans un terminal de confiance. Ne pas passer par GitHub Actions avec des valeurs en clair.

## Inventaire vérifié du code et destination

### Worker applicatif `sac-app`

| Paramètre | Nature recommandée | Preuve / usage constaté | Action |
|---|---|---|---|
| `BREVO_API_KEY` | Secret | Authentification à l'API Brevo pour les e-mails transactionnels | Reprendre la valeur existante depuis le coffre de secrets |
| `BREVO_FROM_EMAIL` | Variable | Adresse expéditrice Brevo | Reprendre exactement la valeur actuelle ; le paramètre Pages est actuellement typé secret |
| `BREVO_FROM_NAME` | Variable | Nom expéditeur Brevo | Reprendre exactement la valeur actuelle ; le paramètre Pages est actuellement typé secret |
| `EMAIL_OTP_HMAC_SECRET` | Secret | HMAC des codes OTP, challenge WebAuthn et politique de connexion | Réutiliser exactement la clé existante ; la changer invaliderait les défis OTP en cours et pourrait affecter les contrôles liés |
| `INTERNAL_DISPATCH_TOKEN` | Secret | Authentifie les appels au point d'entrée `/api/internal/ordinary-notification-dispatch` | Doit correspondre au secret du Worker de dispatch ordinaire pendant la transition |
| `PUSH_SUBSCRIPTION_ENCRYPTION_KEY` | Secret critique | Chiffre/déchiffre les abonnements Push conservés dans D1 | Réutiliser exactement la clé existante. Une nouvelle clé rendrait les abonnements déjà stockés illisibles ; aucune rotation sans procédure de rechiffrement/réabonnement |
| `PUSH_VAPID_PUBLIC_KEY` | Variable | Clé publique publiée aux navigateurs et utilisée pour l'autorisation VAPID | Réutiliser la clé correspondant à la clé privée existante |
| `PUSH_VAPID_PRIVATE_JWK` | Secret critique | Clé privée EC P-256 utilisée pour signer les autorisations VAPID | Réutiliser la clé privée existante ; vérifier que sa partie publique correspond exactement à `PUSH_VAPID_PUBLIC_KEY` |
| `PUSH_VAPID_SUBJECT` | Variable | Sujet VAPID, généralement une adresse de contact `mailto:` ou URL | Reprendre la valeur actuelle |
| `WEBAUTHN_RP_ID` | Variable de sécurité | Identifiant RP WebAuthn ; doit correspondre au domaine de l'origine finale | Définir après décision du domaine final, pas à partir d'une URL temporaire |
| `WEBAUTHN_RP_NAME` | Variable | Nom affiché du RP dans les options d'enrôlement | Reprendre le nom produit validé |
| `WEBAUTHN_ALLOWED_ORIGINS` | Variable de sécurité | Tableau JSON d'origines HTTPS exactes autorisées (le code utilise JSON, pas une liste séparée par virgules) | Construire uniquement à partir des origines finales et des origines de prévisualisation explicitement nécessaires |
| `WEBAUTHN_ROOT_ENROLLMENT_ENABLED` | Variable de sécurité | L'enrôlement de la clé racine n'est accepté que si la valeur vaut exactement `true` | Garder `false` pour le premier démarrage de validation ; n'activer qu'après contrôle des origines et approbation explicite |
| `MULTI_DEVICE_PASSWORD_LOGIN_ENABLED` | Variable fonctionnelle | Le flux de connexion multi-appareils lit cette variable et compare à la chaîne `true` | Reporter la valeur de production connue ; ne pas déduire sa valeur du type « secret » affiché par Pages |
| `GPS_RELAY_PUBLIC_URL` | Variable | URL publique du relais GPS utilisée pour construire les connexions WebSocket | Conserver l'URL du Worker GPS SAC existant |
| `GPS_RELAY_E2EE_READY` | Variable | Drapeau de préparation E2EE du relais GPS | Conserver la valeur déjà validée, sans la modifier dans le cadre du transfert |
| Liaison `DB` | Binding D1, pas un secret | Les routes API utilisent `env.DB` | Utiliser la base SAC existante uniquement |

### Workers auxiliaires — ne pas mélanger leurs paramètres avec ceux de `sac-app`

| Worker | Paramètres nécessaires constatés | Consigne |
|---|---|---|
| `sac-ordinary-notification-delivery` | `PAGES_DISPATCH_URL`, `INTERNAL_DISPATCH_TOKEN` | Le token doit être identique à celui attendu par le Worker applicatif après bascule. Garder l'URL Pages tant que Pages est le service actif ; ne la changer qu'après validation du Worker cible. |
| `sac-sos-notification-delivery` | `PUSH_SUBSCRIPTION_ENCRYPTION_KEY`, `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_JWK`, `PUSH_VAPID_SUBJECT`, liaison D1 `DB` | Les clés Push doivent être identiques à celles utilisées par l'application qui chiffre les abonnements et envoie les notifications. Ne pas les régénérer. |
| `sac-gps-relay` | `GPS_RELAY_E2EE_READY`, liaison D1 `DB`, binding Durable Object `GPS_ROOMS` | Le code actuel du relais valide des tickets à usage unique stockés dans D1 ; l'interface Worker inspectée ne déclare pas `GPS_RELAY_HMAC_SECRET`. Ne pas transférer ce secret à ce Worker sans preuve d'un consommateur actif. |
| `sac-notification-retention-purge` | Liaison D1 `DB` | Aucun secret applicatif supplémentaire n'est déclaré dans sa configuration inspectée. |

## Paramètres Pages recensés mais non à recopier aveuglément

- `APP_BASE_URL` : le paramètre existe dans Pages mais son consommateur actif n'a pas été établi pendant cet audit ciblé. Ne pas le transférer avant d'avoir identifié le code qui le lit et l'URL attendue.
- `GPS_RELAY_HMAC_SECRET` : le paramètre existe dans Pages, mais il n'est pas déclaré par le Worker `sac-gps-relay` actuellement inspecté ni par la route GPS actuelle qui émet les tickets D1 à usage unique. Ne pas le copier dans `sac-app` ni le supprimer de Pages avant un audit complet des références et de l'historique.
- `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME`, `MULTI_DEVICE_PASSWORD_LOGIN_ENABLED` et les paramètres WebAuthn apparaissent actuellement dans Pages avec le type `secret_text`. Cela ne les rend pas automatiquement confidentiels : leur type cible doit être choisi selon leur usage, sans afficher leurs valeurs.

## Risques de rotation à traiter avant tout changement

- **Clé de chiffrement Push** : les abonnements déjà stockés en D1 sont chiffrés avec cette clé. Une valeur différente empêche leur déchiffrement. Exiger la valeur historique ou concevoir une rotation avec double lecture/rechiffrement et tests de restauration.
- **Clés VAPID** : une nouvelle paire rend l'ancienne identité Push incompatible et peut imposer une nouvelle souscription sur les appareils.
- **Secret HMAC OTP** : une nouvelle valeur empêche de vérifier les défis qui ont été créés avec l'ancienne. Prévoir l'expiration naturelle des défis ou une migration contrôlée.
- **Token de dispatch interne** : il peut être renouvelé, mais uniquement en coordonnant Pages, `sac-app` et `sac-ordinary-notification-delivery` afin de ne pas interrompre les tâches planifiées.
- **WebAuthn** : changer le RP ID ou l'origine peut empêcher l'utilisation des credentials déjà enregistrées. Le domaine final doit être décidé avant de configurer ces paramètres.

## Procédure de transfert contrôlée

### Phase A — récupérer les valeurs dans un coffre de confiance

1. Le propriétaire récupère les valeurs masquées depuis son coffre de secrets, son gestionnaire de mots de passe ou les documents sécurisés d'origine.
2. Ne pas tenter de lire les valeurs depuis Pages : Cloudflare les masque volontairement.
3. Vérifier en particulier la disponibilité de la clé de chiffrement Push, de la paire VAPID, du secret OTP et du token de dispatch.
4. Si une valeur critique est introuvable, arrêter le transfert de cette famille de paramètres et planifier sa rotation spécifique. Ne pas inventer de valeur de remplacement.

### Phase B — préparer la configuration cible sans trafic public

1. Décider du domaine final de `sac-app` et des origines HTTPS autorisées.
2. Créer/configurer les variables non secrètes et les secrets sur `sac-app` sans les inscrire dans le dépôt.
3. Commencer avec `WEBAUTHN_ROOT_ENROLLMENT_ENABLED=false`.
4. Configurer les mêmes clés Push sur `sac-app` et `sac-sos-notification-delivery`.
5. Garder `sac-ordinary-notification-delivery` pointé vers Pages jusqu'à la validation du nouveau point de dispatch.
6. Vérifier la présence des noms de paramètres et bindings par API Cloudflare, sans jamais journaliser les valeurs.

### Phase C — tests de préproduction

1. Tester le health check et les routes sans effet de bord.
2. Tester l'authentification et les sessions, les flux WebAuthn sur le domaine prévu, l'envoi d'e-mails Brevo, l'enregistrement et le déchiffrement d'un abonnement Push de test.
3. Tester une notification SOS et une notification ordinaire en environnement isolé, sans contacter de vrais destinataires.
4. Vérifier que les tâches planifiées et les appels internes sont authentifiés.
5. Vérifier les journaux : aucune valeur secrète, aucun code OTP, aucune donnée sensible.

### Phase D — bascule et retour arrière

1. Déployer `sac-app` seulement après approbation de la matrice finale et des tests.
2. Conserver Pages et ses secrets intacts pendant la période de surveillance.
3. Basculer les domaines et `PAGES_DISPATCH_URL` dans une fenêtre contrôlée, après vérification de l'URL du Worker.
4. Si un test critique échoue, remettre le routage et le dispatch vers Pages ; ne pas supprimer Pages.
5. Supprimer l'ancien Pages uniquement après décision explicite et période de stabilité confirmée.

## État de préparation au 26 novembre 2026

- CI SAC : 107/107 étapes réussies, dont compilation Worker, migrations D1 locales, smoke test local, dry-run Wrangler et audits de dépendances.
- Cloudflare : le Worker `sac-app` n'est pas encore déployé ; Pages SAC reste actif.
- Les valeurs secrètes Pages ne sont pas exportables via l'API et n'ont pas été copiées.
- La préparation documentaire est faite ; la configuration réelle des secrets et la validation sur une préproduction Cloudflare restent à effectuer.
