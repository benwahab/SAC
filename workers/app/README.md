# SAC application Worker

This directory contains the dedicated Cloudflare Worker configuration for the SAC application.

- Worker name: `sac-app`
- Existing production D1: `sac-db` (same database ID as the current Pages project)
- Existing Pages project: `sac` remains unchanged during preparation.
- Static assets: `../../dist/client/`
- Compiled Pages Functions: `../../dist/worker/index.js`

## Build separation

The existing Pages build remains unchanged:

```sh
npm run build
npm run pages:dev
```

The Worker build uses its own Vite output directory and compiles the existing `functions/` routes without rewriting them:

```sh
npm run build:worker
```

Local Worker preview:

```sh
npm run dev:worker
```

Production deployment is a separate, deliberate action:

```sh
npm run deploy:worker
```

Do not run the production deployment until the Worker has been built and validated, all required secrets have been added to `sac-app`, and the API/PWA smoke tests have passed.

## Important safeguards

- Do not change or delete the existing Pages project as part of this preparation.
- Do not create, clone, reset, or migrate the `sac-db` database.
- Do not bind UPK resources here.
- The two SAC R2 buckets are not currently configured as bindings on the existing Pages production environment; this Worker config does not invent or add R2 bindings.
- Pages secrets are not exportable through the Cloudflare API. Configure the existing secret values on `sac-app` through the secure Cloudflare secret interface before production use. Never commit secret values.
- The current Pages environment has the following secret names; verify which are still required by code before configuring them: `APP_BASE_URL`, `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME`, `EMAIL_OTP_HMAC_SECRET`, `GPS_RELAY_HMAC_SECRET`, `INTERNAL_DISPATCH_TOKEN`, `MULTI_DEVICE_PASSWORD_LOGIN_ENABLED`, `PUSH_SUBSCRIPTION_ENCRYPTION_KEY`, `PUSH_VAPID_PRIVATE_JWK`, `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_SUBJECT`, `WEBAUTHN_ALLOWED_ORIGINS`, `WEBAUTHN_ROOT_ENROLLMENT_ENABLED`, `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`.
- The notification delivery Worker currently targets the Pages URL for ordinary dispatch. Update that endpoint only after the new Worker is validated and its production URL is known.
