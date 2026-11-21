import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import { createSessionToken } from "../functions/lib/security/session-token.ts";
import { SESSION_COOKIE_NAME } from "../functions/lib/security/session-cookie.ts";
import { requireSuperAdminSession } from "../functions/lib/security/require-super-admin-session.ts";

const now = Date.now();

async function makeRequest() {
  const token = await createSessionToken(webcrypto as unknown as Crypto);
  const request = new Request("https://sac.example/api/admin/test", {
    headers: { Cookie: SESSION_COOKIE_NAME + "=" + token.token },
  });
  const row = {
    session_id: "session-a",
    account_id: "account-a",
    device_id: "device-a",
    token_hash: token.tokenHash,
    session_status: "active",
    session_auth_version: 1,
    created_at: now - 1000,
    last_activity_at: now - 1000,
    expires_at: now + 100000,
    revoked_at: null,
    account_status: "active",
    device_status: "active",
    current_device_auth_version: 1,
  };
  return { request, row };
}

function database(row: Record<string, unknown>, role: { allowed: number } | null = null, failRole = false) {
  return {
    prepare(sql: string) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("FROM device_sessions")) return row;
              if (sql.includes("FROM account_roles")) {
                if (failRole) throw new Error("D1 unavailable");
                return role;
              }
              throw new Error("Unexpected query");
            },
            async run() { return { success: true, meta: { changes: 1 } }; },
          };
        },
      };
    },
  } as never;
}

test("Super Admin guard refuses unauthenticated requests", async () => {
  const result = await requireSuperAdminSession(
    new Request("https://sac.example/api/admin/test"),
    database({}),
  );
  assert.deepEqual(result, { ok: false, status: 401 });
});

test("Super Admin guard refuses a normal authenticated account", async () => {
  const { request, row } = await makeRequest();
  const result = await requireSuperAdminSession(request, database(row, null));
  assert.deepEqual(result, { ok: false, status: 403 });
});

test("Super Admin guard accepts only the persistent D1 role", async () => {
  const { request, row } = await makeRequest();
  const result = await requireSuperAdminSession(request, database(row, { allowed: 1 }));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.accountId, "account-a");
    assert.equal(result.value.deviceId, "device-a");
  }
});

test("Super Admin guard fails closed when the role store is unavailable", async () => {
  const { request, row } = await makeRequest();
  const result = await requireSuperAdminSession(request, database(row, null, true));
  assert.deepEqual(result, { ok: false, status: 503 });
});
