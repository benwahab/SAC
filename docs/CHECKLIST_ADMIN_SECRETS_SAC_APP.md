# Checklist administrateur — paramètres du Worker SAC

**Cible :** Worker applicatif `sac-app`  
**État :** préparation uniquement. Aucun secret n'est inscrit dans ce fichier ou dans GitHub.

## Avant de commencer

- [ ] Vérifier que le projet Cloudflare est bien le compte SAC, sans toucher à UPK.
- [ ] Garder Pages `sac` actif et inchangé.
- [ ] Récupérer les valeurs historiques depuis le coffre de secrets ou la source de confiance.
- [ ] Ne jamais coller une valeur secrète dans GitHub, un ticket, un journal ou une conversation.
- [ ] Ne jamais générer une nouvelle clé pour remplacer une clé historique encore utilisée.

## Paramètres à créer sur `sac-app`

Ajouter les paramètres dans **Cloudflare Dashboard → Workers & Pages → sac-app → Settings → Variables and Secrets**. Pour chaque secret, utiliser le type **Secret**.

| Nom | Type cible | Source / règle |
|---|---|---|
| `BREVO_API_KEY` | Secret | Clé API Brevo historique |
| `BREVO_FROM_EMAIL` | Secret (conserver le niveau actuel) | Adresse expéditrice historique |
| `BREVO_FROM_NAME` | Secret (conserver le niveau actuel) | Nom expéditeur historique |
| `EMAIL_OTP_HMAC_SECRET` | Secret | Valeur historique exacte, indispensable à la vérification OTP |
| `INTERNAL_DISPATCH_TOKEN` | Secret | Même valeur que celle du Worker `sac-ordinary-notification-delivery` |
| `PUSH_SUBSCRIPTION_ENCRYPTION_KEY` | Secret critique | Même valeur historique que le Worker SOS ; ne pas régénérer |
| `PUSH_VAPID_PRIVATE_JWK` | Secret critique | Clé privée historique du Worker SOS |
| `PUSH_VAPID_PUBLIC_KEY` | Secret (par prudence, comme actuellement) | Clé publique correspondant exactement à la clé privée historique |
| `PUSH_VAPID_SUBJECT` | Secret (par prudence, comme actuellement) | Valeur historique du Worker SOS |
| `WEBAUTHN_ALLOWED_ORIGINS` | Secret (conserver le niveau actuel) | À renseigner après choix du domaine final ; JSON des origines HTTPS exactes |
| `WEBAUTHN_ROOT_ENROLLMENT_ENABLED` | Secret | Mettre `false` pour la première validation |
| `WEBAUTHN_RP_ID` | Secret (conserver le niveau actuel) | Domaine final uniquement, sans protocole ni chemin |
| `WEBAUTHN_RP_NAME` | Secret (conserver le niveau actuel) | Nom RP validé |
| `MULTI_DEVICE_PASSWORD_LOGIN_ENABLED` | Secret (conserver le niveau actuel) | Reprendre la valeur de production connue |

## Variables non secrètes déjà prévues

La configuration versionnée de `workers/app/wrangler.toml` contient déjà :

- `GPS_RELAY_PUBLIC_URL`
- `GPS_RELAY_E2EE_READY`

Ne pas modifier ces valeurs pendant cette étape sans raison vérifiée.

## Paramètres à ne pas transférer

- `GPS_RELAY_HMAC_SECRET` reste exclusivement sur `sac-gps-relay`.
- `PAGES_DISPATCH_URL` reste sur `sac-ordinary-notification-delivery` et continue de pointer vers Pages tant que la migration n'est pas validée.
- Ne pas modifier les secrets ni les variables des Workers auxiliaires pendant cette phase.

## À clarifier avant de saisir les paramètres de domaine

- [ ] Choisir l'URL/domaine final de `sac-app`.
- [ ] Définir `APP_BASE_URL` selon son consommateur réel et l'URL retenue. Ne pas recopier aveuglément l'ancienne URL Pages.
- [ ] Définir `WEBAUTHN_ALLOWED_ORIGINS` et `WEBAUTHN_RP_ID` à partir du domaine final.
- [ ] Garder l'enrôlement racine WebAuthn désactivé pendant les tests initiaux.

## Vérification après saisie

Vérifier uniquement la présence des noms et les bindings, jamais afficher ou journaliser les valeurs.

- [ ] Les paramètres requis sont présents sur `sac-app`.
- [ ] La liaison D1 `DB` cible la base SAC existante `sac-db`.
- [ ] Les quatre paramètres Push de `sac-app` correspondent aux valeurs historiques du Worker SOS.
- [ ] `INTERNAL_DISPATCH_TOKEN` correspond au token du Worker de dispatch ordinaire.
- [ ] `GPS_RELAY_HMAC_SECRET` n'a pas été déplacé du Worker GPS.
- [ ] Les tests e-mail, OTP, sessions, WebAuthn, Push et dispatch passent en préproduction.
- [ ] Pages reste disponible pour le retour arrière.

## Interdiction de bascule

Ne pas déployer en production, changer de domaine, modifier `PAGES_DISPATCH_URL` ou supprimer Pages avant la validation complète et un test de retour arrière.
