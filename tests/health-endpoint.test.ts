import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/health.ts";

const TABLES = [
  "accounts",
  "account_identities",
  "email_otp_challenges",
  "contact_invitations",
  "trusted_contacts",
  "alerts",
  "alert_recipients",
  "alert_events",
  "alert_responsibility_periods",
  "alert_reminder_outbox",
  "alert_sms_escalations",
  "alert_sms_outbox",
  "root_enrollment_rate_limits",
  "root_enrollment_ceremonies",
  "root_enrollment_challenges",
  "devices",
  "device_root_credentials",
  "device_sessions",
  "device_enrollment_events",
  "push_subscriptions",
];

function makeContext(options: {
  readonly names?: readonly string[];
  readonly success?: boolean;
  readonly throwOnAll?: boolean;
} = {}) {
  let query = "";
  let bindings: unknown[] = [];
  const db = {
    prepare(sql: string) {
      query = sql;
      return {
        bind(...values: unknown[]) {
          bindings = values;
          return {
            async all() {
              if (options.throwOnAll) throw new Error("database unavailable");
              return {
                success: options.success ?? true,
                results: (options.names ?? TABLES).map((name) => ({ name })),
              };
            },
          };
        },
      };
    },
  };
  return {
    context: { env: { DB: db } } as unknown as Parameters<typeof onRequestGet>[0],
    inspect: () => ({ query, bindings }),
  };
}

test("health is ready only when every required SAC table exists", async () => {
  const { context, inspect } = makeContext();
  const response = await onRequestGet(context);
  const body = await response.json() as { ok: boolean; database: string };

  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true, service: "sac-api", database: "connected" });
  assert.deepEqual(inspect().bindings, TABLES);
  assert.match(inspect().query, /sqlite_master/);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("health refuses readiness when even one required table is missing", async () => {
  const { context } = makeContext({ names: TABLES.slice(0, -1) });
  const response = await onRequestGet(context);
  const body = await response.json() as { ok: boolean; database: string };

  assert.equal(response.status, 503);
  assert.deepEqual(body, { ok: false, service: "sac-api", database: "schema_incomplete" });
});

test("health reports database query failures without exposing database details", async () => {
  const { context } = makeContext({ throwOnAll: true });
  const response = await onRequestGet(context);
  const body = await response.json() as Record<string, unknown>;

  assert.equal(response.status, 503);
  assert.deepEqual(body, { ok: false, service: "sac-api", database: "unavailable" });
  assert.equal(JSON.stringify(body).includes("database unavailable"), false);
});

test("health reports unsuccessful D1 results as unavailable", async () => {
  const { context } = makeContext({ success: false });
  const response = await onRequestGet(context);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    ok: false,
    service: "sac-api",
    database: "unavailable",
  });
});
