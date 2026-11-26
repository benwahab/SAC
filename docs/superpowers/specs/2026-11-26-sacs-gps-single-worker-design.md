# SAC GPS single-Worker migration design

Date: 2026-11-26
Status: approved direction from the user; implementation is staged and must be validated before cutover.

## Intent

Consolidate the GPS WebSocket relay into the existing production Worker `sac-app`, so SAC has one application Worker while preserving the existing `GpsRelayRoom` Durable Object namespace and its stored state. The GPS relay remains a distinct module/class inside the same Worker bundle; it is not a second deployed Worker.

## Current implementation

- `workers/gps-relay/index.ts` validates one-time GPS tickets against the existing D1 `DB`, checks active alert/device/session membership, then routes WebSocket requests to `env.GPS_ROOMS`.
- `GpsRelayRoom` maintains live WebSocket peers, revalidates participant access, broadcasts presence and encrypted payloads, and schedules five-second alarms.
- `functions/api/alerts/[alertId]/gps-ticket.ts` currently constructs the WebSocket URL from `GPS_RELAY_PUBLIC_URL`, which points to `sac-gps-relay`.
- `workers/gps-relay/wrangler.toml` owns the existing SQLite-backed namespace through legacy Wrangler migrations (`new_sqlite_classes = ["GpsRelayRoom"]`).
- `workers/app/entry.ts` currently routes HTTP through the generated Pages Functions worker and schedules ordinary notifications, SOS dispatch and retention purge.

## Goals

1. Route the GPS WebSocket endpoint through `sac-app` at the same-origin path `/v1/alerts/:alertId/socket`.
2. Transfer the existing `GpsRelayRoom` namespace from `sac-gps-relay` to `sac-app` using Cloudflare's supported cross-Worker Durable Object namespace transfer.
3. Preserve the class name, deterministic `idFromName(alertId)` mapping, SQLite state, alarms, WebSocket protocol, D1 ticket checks, session authorization and end-to-end encrypted location payloads.
4. Keep the existing app routes, scheduled notification dispatch, retention purge, D1 database, R2 buckets, secrets and GPS behavior intact.
5. Retire the separate GPS Worker only after the namespace transfer, app routing and production checks are confirmed.

## Non-goals

- No redesign of the GPS protocol or cryptography.
- No changes to alert recipients, GPS retention policy, D1 schema or R2.
- No WebSocket hibernation refactor or automatic reconnect feature in this migration.
- No creation of a replacement Durable Object namespace.
- No deletion or recreation of the existing GPS namespace.

## Approaches considered

1. **Keep two Workers:** least migration risk, but does not meet the user's one-Worker goal.
2. **Copy the Durable Object into a new namespace in `sac-app`:** rejected because it would create a different namespace and risk losing existing per-alert room state.
3. **Transfer the existing namespace into `sac-app`:** selected. Cloudflare supports a coordinated multi-deploy transfer between Workers in the same account, preserving the namespace. It requires careful coordination of the source and target configurations.

## Migration design

- Keep `GpsRelayRoom` implementation in `workers/gps-relay/index.ts` initially and import/re-export it from the `sac-app` entrypoint. This avoids changing class behavior during ownership transfer.
- Convert the source Worker from legacy `migrations` metadata to Cloudflare's declarative Durable Object `exports` lifecycle only after verifying the existing namespace is recognized as SQLite-backed.
- Deploy `sac-app` with the class exported and an `expecting-transfer` entry for `GpsRelayRoom` from `sac-gps-relay`. Do not bind the target Worker to its own class during this pending phase.
- Deploy the source Worker with a `transferred` tombstone targeting `sac-app`; this commits the namespace handoff.
- After the source deploy has fully rolled out, deploy `sac-app` with the `GPS_ROOMS` binding and live class export.
- Change the GPS ticket endpoint to return a same-origin WebSocket URL, and route the GPS socket path to the imported relay handler in `sac-app`.
- Observe production and test ticket issuance, WebSocket authorization, author/recipient pairing, encrypted payload forwarding, alarm-based revalidation and alert closure.
- Remove the old Worker deployment workflow and GPS Worker only after the new path is verified and the old Worker has no required bindings. Preserve the namespace in `sac-app`.

## Constraints and safety

- Both Workers are in the same Cloudflare account; cross-account transfer is not involved.
- Cloudflare requires a coordinated transfer: target `expecting-transfer`, then source `transferred`, then target binding after source rollout.
- A namespace deletion is forbidden in this plan. The target must receive the existing namespace, not create a fresh one.
- Keep `sac-gps-relay` and the existing GPS route available until the transfer commit and target binding are confirmed. Existing short-lived tickets may refer to the old host for up to 120 seconds; allow them to expire before retiring the old endpoint.
- Do not touch `sac-db`, R2 buckets, push secrets, `INTERNAL_DISPATCH_TOKEN`, the notification cron or unrelated SAC modules.
- If any transfer reconciliation, typecheck, test or production check fails, stop before deleting the source Worker and restore routing to the still-existing source where Cloudflare's transfer state permits.

## Acceptance criteria

- Cloudflare confirms `GpsRelayRoom` was transferred from `sac-gps-relay` to `sac-app` (not created anew).
- `sac-app` owns the `GPS_ROOMS` binding and class export.
- GPS tickets return a WebSocket URL on the `sac-app` origin.
- The `/v1/alerts/:alertId/socket` path is served by the relay module inside `sac-app`.
- Automated tests cover routing, ticket URL origin, invalid tickets, authorization, protocol parsing, message routing and alarms.
- Production checks confirm authorized WebSocket connections and encrypted payload forwarding before the old Worker is retired.
- Final Cloudflare inventory contains `sac-app` and the existing notification-free SAC resources, with no separate `sac-gps-relay` Worker.
