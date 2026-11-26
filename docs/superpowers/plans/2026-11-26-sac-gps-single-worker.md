# SAC GPS Single-Worker Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the existing GPS relay and its existing `GpsRelayRoom` Durable Object namespace into `sac-app`, so SAC no longer deploys a separate GPS Worker.

**Architecture:** Reuse the current relay module and transfer its existing SQLite-backed Durable Object namespace through Cloudflare's coordinated cross-Worker transfer. Route the ticket endpoint and WebSocket path through the `sac-app` origin; retire the source Worker only after production checks.

**Tech Stack:** TypeScript, Cloudflare Workers, Wrangler, Durable Objects (SQLite), D1, WebSocketPair, Vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-26-sacs-gps-single-worker-design.md`

## Global Constraints

- Preserve the existing `GpsRelayRoom` class name, namespace identity, SQLite data and `idFromName(alertId)` mapping.
- Never create a replacement GPS namespace or deploy a `new_sqlite_classes` migration for the target class.
- Keep the existing D1 database, R2 buckets, secrets, app routes, notification schedules and GPS protocol unchanged.
- Keep `sac-gps-relay` available until the namespace handoff, target binding, new WebSocket path and production checks pass.
- Do not change unrelated SAC functionality or introduce a new branch.
- Keep GPS coordinates end-to-end encrypted; the relay must not receive plaintext coordinates.

## Review Focus

- Ticket issued before routing cutover still points at the source URL; query D1 for pre-cutover unexpired tickets and retire the source only when the count is zero. A 120-second wait is the fallback when ticket timestamps cannot be checked.
- The ticket endpoint must not return the target origin during `expecting-transfer`; the target has no local `GPS_ROOMS` binding until the fourth deploy.
- Missing target Durable Object binding during the pending-transfer phase must fail closed, not fall through to app/static routing.
- Invalid, expired, reused or unauthorized tickets must retain existing HTTP status and error semantics.
- Non-GPS routes and existing scheduled handlers must remain unchanged.
- Alert closure, session revocation and five-second Durable Object alarms must continue to close/reject stale participants.

---

### Task 1: Add regression coverage for same-origin GPS ticket URLs and app routing

**Files:**
- Modify: `functions/api/alerts/[alertId]/gps-ticket.ts`
- Modify: `workers/app/entry.ts`
- Test: existing GPS relay/ticket tests under `tests/`

**Interfaces:**
- Ticket handler derives `websocketUrl` from the incoming request origin, converting `https:` to `wss:` and `http:` to `ws:`.
- App entry dispatches only `/v1/alerts/:alertId/socket` to the relay handler; all other requests continue to `pagesFunctionsWorker.fetch`.

- [x] Add a pure helper test asserting that a GPS socket URL uses the incoming SAC app origin and the correct `ws:` / `wss:` scheme.
- [x] Run the focused GPS tests and confirm the new assertions fail against current behavior (the test-first commit failed as expected before the helper was implemented).
- [x] Add routing tests asserting the GPS socket path is dispatched to the relay and all other paths use the existing Pages Functions handler; also add `run_worker_first` for `/v1/alerts/*` so static assets cannot intercept the socket path.
- [x] Keep the ticket endpoint pointed at the current GPS Worker until Task 5 completed; then switch ticket responses to the same-origin `sac-app` URL.
- [x] Implement the smallest change that preserves the current error responses and existing app routing.
- [x] Run focused tests and typecheck; commit the code and tests.

### Task 2: Prepare the source Worker for namespace transfer

**Files:**
- Modify: `workers/gps-relay/wrangler.toml`
- Modify: `workers/gps-relay/index.ts` only if the deployed export surface requires it.
- Test/validation: Wrangler configuration validation for the GPS source.

**Interfaces:**
- Source class remains exported as `GpsRelayRoom`.
- Source lifecycle metadata transitions from legacy `migrations` to declarative `exports`, with a live SQLite class declaration before the transfer is requested.

- [x] Verify Cloudflare reports the existing SQLite `GpsRelayRoom` namespace; original namespace ID: `df9f8a54759b490c8ba07487650292f9`.
- [x] Confirm source and target are in the same Cloudflare account.
- [x] Convert the source config to declarative `exports` without changing the namespace or deploying a new-class migration.
- [x] Run source Wrangler dry-run/config validation; the existing namespace ID remained unchanged.
- [x] Commit and deploy the source preparation after confirming the existing-class reconciliation.

### Task 3: Deploy target in the expecting-transfer phase

**Files:**
- Modify: `workers/app/entry.ts`
- Modify: `workers/app/wrangler.toml`
- Test: GPS relay bundle and Worker typecheck tests.

**Interfaces:**
- `sac-app` imports and re-exports the existing `GpsRelayRoom` class and uses the existing relay fetch handler for the GPS socket route.
- During this phase, `sac-app` declares `GpsRelayRoom` as `expecting-transfer` from `sac-gps-relay`; do not add a self-binding yet.

- [x] Add tests for the relay route's fail-closed behavior while the target namespace binding is not yet active.
- [x] Add the class export and pending-transfer metadata to the target config without a `GPS_ROOMS` binding.
- [x] Run typecheck, GPS tests and Worker bundle dry-run.
- [x] Deploy the target and verify Cloudflare reports `Transfer pending: GpsRelayRoom ← sac-gps-relay`, not a new namespace.
- [x] Commit the target pending-transfer state.

### Task 4: Commit namespace ownership transfer

**Files:**
- Modify: `workers/gps-relay/wrangler.toml`

**Interfaces:**
- Source class remains in source code during the transfer deploy.
- Source export becomes a `transferred` tombstone with `transferred_to = "sac-app"`.

- [x] Change source metadata to the transfer tombstone and add `script_name = "sac-app"` to the source `GPS_ROOMS` binding so the old GPS URL could continue forwarding during the cutover window.
- [x] Deploy the source and verify Cloudflare reports `Transferred (committed): GpsRelayRoom → sac-app`.
- [x] Confirm no new namespace was created and the existing namespace is now owned by `sac-app`.
- [x] Cloudflare reconciliation explicitly confirmed the transfer.

### Task 5: Bind the transferred namespace in sac-app

**Files:**
- Modify: `workers/app/wrangler.toml`
- Modify: `workers/app/entry.ts`
- Test: GPS relay integration tests.

**Interfaces:**
- Target binding name is `GPS_ROOMS`, class name `GpsRelayRoom`.
- The target live export declares `GpsRelayRoom` with SQLite storage; it must refer to the transferred namespace, not provision a new one.

- [x] Add the `GPS_ROOMS` binding and live target export after source transfer had fully rolled out.
- [x] Deploy `sac-app` and verify Cloudflare reconciliation shows the transferred class as live with no namespace creation; target binding kept the same namespace ID.
- [ ] Complete a successful authorized author/recipient GPS exchange on real SAC devices. Automated tests and the invalid-ticket smoke test do not replace this final live acceptance check.
- [x] Verify the app's notification Cron and D1 binding remain unchanged.

### Task 6: Production verification and source Worker retirement

**Files:**
- Modify/Delete: `.github/workflows/deploy-gps-relay-worker.yml`
- Modify: documentation and deployment inventory.

**Interfaces:**
- Production GPS ticket URL uses `sac-app` origin.
- `sac-app` serves `/v1/alerts/:alertId/socket` through the transferred namespace.

- [ ] Verify a real authorized GPS client can obtain a ticket and connect to `sac-app` (manual device acceptance remains outstanding).
- [ ] Verify an authorized author/recipient pair can exchange encrypted GPS packets and that invalid/revoked participants are rejected (manual device acceptance remains outstanding).
- [x] Query D1 for pre-cutover unexpired tickets; the count was zero at source retirement, and there were no active alerts.
- [x] Verify the transferred namespace is bound by `sac-app`; the source Worker had only a cross-Worker binding to `sac-app`.
- [x] Delete the old GPS Worker Build configuration and `sac-gps-relay` Worker after confirming no active alerts or pre-cutover unexpired tickets. Remove its deployment workflow and standalone Wrangler config.
- [x] Confirm final SAC Worker inventory contains `sac-app` as the application/GPS Worker and the original Durable Object namespace remains under it.
- [x] Record deployment IDs, commit SHAs, test results and remaining runtime limitations in this document.

---

## Recorded execution result — 2026-11-26

- Existing SQLite Durable Object namespace preserved: `df9f8a54759b490c8ba07487650292f9`.
- Source-to-target transfer build: `35ff3bfe-32bf-4326-ab5b-0a2c5474d624`; Cloudflare confirmed `Transferred (committed)`.
- Target binding deployment: `0162f312-952b-4b36-a5c6-6206057e24a9`; the target binding reports the same namespace ID.
- Final `sac-app` deployment: build `17eef297-e149-445e-8941-b38d108830e6`, version `ac7f0356-d0e2-4a8e-a87f-42a964affff3`.
- Production smoke test passed: the `sac-app` GPS route returned HTTP 401 for a deliberately invalid one-time ticket, after the static-asset routing rule was corrected.
- GPS tickets now derive their WebSocket URL from the incoming SAC app origin. `GPS_RELAY_PUBLIC_URL` was removed from the app configuration.
- At source retirement, D1 reported zero active alerts and zero pre-cutover unexpired GPS tickets.
- The old `sac-gps-relay` Worker and its Worker Build configuration were deleted. The standalone GPS Worker workflow and Wrangler config are removed from the repository; the GPS relay module remains because `sac-app` imports it.
- The old `GPS_RELAY_HMAC_SECRET` binding had no references in the SAC repository code and was not required by the active relay implementation; it was retired with the old Worker.
- **Remaining manual acceptance:** no valid authenticated two-device GPS session was available for this deployment. A real author/recipient encrypted location exchange must still be tested from SAC devices. The invalid-ticket smoke test proves routing and fail-closed behavior, not a complete successful GPS session.

## Execution Notes

- **Ruling (sequencing correction):** The initial Task 1 wording would have changed GPS ticket URLs before the namespace was transferred and bound in `sac-app`, which would break newly issued GPS connections during the pending-transfer phase. Therefore, test and implement the same-origin URL helper in Task 1, but defer wiring it into the ticket endpoint until Task 5 after the target binding is confirmed. The current `GPS_RELAY_PUBLIC_URL` remains unchanged until that cutover.
- **Ruling (source continuity):** During the source transfer commit, retain the source Worker's `GPS_ROOMS` binding with `script_name = "sac-app"`. Cloudflare documents this cross-Worker binding form for a source Worker that must keep using the transferred namespace. This keeps the old GPS endpoint forwarding to the same namespace until the ticket endpoint is switched and old tickets expire.

- Use Cloudflare's documented four-deploy cross-Worker transfer sequence; never combine the target pending phase and source commit into one assumed atomic operation.
- A successful bundle build is not proof of live WebSocket behavior. Production connection and packet-forwarding checks are required before source retirement.
- If a transfer step fails, retain both Workers and stop; do not delete the source class or namespace.
