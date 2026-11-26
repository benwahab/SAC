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

- Ticket issued immediately before routing cutover still points at the source URL; wait at least the 120-second ticket lifetime before source retirement.
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

- [ ] Add a pure helper test asserting that a GPS socket URL uses the incoming SAC app origin and the correct `ws:` / `wss:` scheme.
- [ ] Run the focused GPS tests and confirm the new assertions fail against current behavior.
- [ ] Add routing tests asserting the GPS socket path is dispatched to the relay and all other paths use the existing Pages Functions handler.
- [ ] Keep the ticket endpoint pointed at the current GPS Worker until Task 5 has completed the namespace transfer and the target binding is live; only then switch ticket responses to the same-origin `sac-app` URL.
- [ ] Implement the smallest change that preserves the current error responses and existing app routing.
- [ ] Run focused tests and typecheck; commit the code and tests.

### Task 2: Prepare the source Worker for namespace transfer

**Files:**
- Modify: `workers/gps-relay/wrangler.toml`
- Modify: `workers/gps-relay/index.ts` only if the deployed export surface requires it.
- Test/validation: Wrangler configuration validation for the GPS source.

**Interfaces:**
- Source class remains exported as `GpsRelayRoom`.
- Source lifecycle metadata transitions from legacy `migrations` to declarative `exports`, with a live SQLite class declaration before the transfer is requested.

- [ ] Verify Cloudflare reports the existing `GpsRelayRoom` namespace and its storage backend; record the exact current namespace identity.
- [ ] Confirm the source and target are outside dispatch namespaces and in the same account.
- [ ] Convert the source config to declarative `exports` without changing the namespace or deploying a new-class migration.
- [ ] Run source Wrangler dry-run/config validation; inspect reconciliation output and stop if Cloudflare proposes creating or deleting the namespace.
- [ ] Commit the source preparation only after the expected existing-class reconciliation is confirmed.

### Task 3: Deploy target in the expecting-transfer phase

**Files:**
- Modify: `workers/app/entry.ts`
- Modify: `workers/app/wrangler.toml`
- Test: GPS relay bundle and Worker typecheck tests.

**Interfaces:**
- `sac-app` imports and re-exports the existing `GpsRelayRoom` class and uses the existing relay fetch handler for the GPS socket route.
- During this phase, `sac-app` declares `GpsRelayRoom` as `expecting-transfer` from `sac-gps-relay`; do not add a self-binding yet.

- [ ] Add tests for the relay route's fail-closed behavior while the target namespace binding is not yet active.
- [ ] Add the class export and pending-transfer metadata to the target config without a `GPS_ROOMS` binding.
- [ ] Run typecheck, GPS tests and Worker bundle dry-run.
- [ ] Deploy the target and verify Cloudflare reports `Transfer pending: GpsRelayRoom ← sac-gps-relay`, not a new namespace.
- [ ] Commit the target pending-transfer state.

### Task 4: Commit namespace ownership transfer

**Files:**
- Modify: `workers/gps-relay/wrangler.toml`

**Interfaces:**
- Source class remains in source code during the transfer deploy.
- Source export becomes a `transferred` tombstone with `transferred_to = "sac-app"`.

- [ ] Change source metadata to the transfer tombstone and add `script_name = "sac-app"` to the source `GPS_ROOMS` binding so the old GPS URL can continue forwarding to the transferred namespace during the cutover window.
- [ ] Deploy the source and verify Cloudflare reports `Transferred (committed): GpsRelayRoom → sac-app`.
- [ ] Confirm no new namespace was created and the existing namespace is now owned by `sac-app`.
- [ ] Stop immediately if Cloudflare reconciliation does not explicitly confirm the transfer.

### Task 5: Bind the transferred namespace in sac-app

**Files:**
- Modify: `workers/app/wrangler.toml`
- Modify: `workers/app/entry.ts`
- Test: GPS relay integration tests.

**Interfaces:**
- Target binding name is `GPS_ROOMS`, class name `GpsRelayRoom`.
- The target live export declares `GpsRelayRoom` with SQLite storage; it must refer to the transferred namespace, not provision a new one.

- [ ] Add the `GPS_ROOMS` binding and live target export after source transfer has fully rolled out.
- [ ] Deploy `sac-app` and verify Cloudflare reconciliation shows the transferred class as live with no namespace creation.
- [ ] Run local tests for ticket consumption, active participant authorization, author/recipient routing, encrypted message forwarding, revocation and alarm behavior.
- [ ] Verify the app's notification Cron and D1 binding remain unchanged.

### Task 6: Production verification and source Worker retirement

**Files:**
- Modify/Delete: `.github/workflows/deploy-gps-relay-worker.yml`
- Modify: documentation and deployment inventory.

**Interfaces:**
- Production GPS ticket URL uses `sac-app` origin.
- `sac-app` serves `/v1/alerts/:alertId/socket` through the transferred namespace.

- [ ] Verify a real authorized GPS client can obtain a ticket and connect to `sac-app`.
- [ ] Verify an authorized author/recipient pair can exchange encrypted GPS packets and that invalid/revoked participants are rejected.
- [ ] Wait longer than the 120-second ticket expiry window after routing cutover; confirm no new requests rely on the source URL.
- [ ] Verify no other Worker still binds to the source namespace.
- [ ] Remove the old GPS deployment workflow and delete `sac-gps-relay` only after every acceptance check passes.
- [ ] Confirm final Cloudflare inventory has `sac-app` as the sole application/GPS Worker and that the Durable Object namespace still exists under it.
- [ ] Record deployment IDs, commit SHAs, test results and any remaining runtime limitations in the migration docs.

---

## Execution Notes

- **Ruling (sequencing correction):** The initial Task 1 wording would have changed GPS ticket URLs before the namespace was transferred and bound in `sac-app`, which would break newly issued GPS connections during the pending-transfer phase. Therefore, test and implement the same-origin URL helper in Task 1, but defer wiring it into the ticket endpoint until Task 5 after the target binding is confirmed. The current `GPS_RELAY_PUBLIC_URL` remains unchanged until that cutover.
- **Ruling (source continuity):** During the source transfer commit, retain the source Worker's `GPS_ROOMS` binding with `script_name = "sac-app"`. Cloudflare documents this cross-Worker binding form for a source Worker that must keep using the transferred namespace. This keeps the old GPS endpoint forwarding to the same namespace until the ticket endpoint is switched and old tickets expire.

- Use Cloudflare's documented four-deploy cross-Worker transfer sequence; never combine the target pending phase and source commit into one assumed atomic operation.
- A successful bundle build is not proof of live WebSocket behavior. Production connection and packet-forwarding checks are required before source retirement.
- If a transfer step fails, retain both Workers and stop; do not delete the source class or namespace.
