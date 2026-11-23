import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import { onRequestGet as getAccess } from "../functions/api/admin/access.ts";
import { onRequestGet as getMyMissions } from "../functions/api/admin/my-missions.ts";
import { createSessionToken } from "../functions/lib/security/session-token.ts";
import { SESSION_COOKIE_NAME } from "../functions/lib/security/session-cookie.ts";

const now = Date.now();

async function authenticatedRequest(path: string) {
  const token = await createSessionToken(webcrypto as unknown as Crypto);
  const request = new Request("https://sac.example" + path, {
    headers: { Cookie: SESSION_COOKIE_NAME + "=" + token.token },
  });
  const sessionRow = {
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
  return { request, sessionRow };
}

function database(sessionRow: Record<string, unknown> | null, options: {
  superAdmin?: boolean;
  activeMissions?: number;
  missionRows?: Record<string, unknown>[];
} = {}) {
  return {
    prepare(sql: string) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("FROM device_sessions")) return sessionRow;
              if (sql.includes("FROM account_roles")) return options.superAdmin ? { allowed: 1 } : null;
              if (sql.includes("FROM admin_missions")) return { count: options.activeMissions ?? 0 };
              throw new Error("Unexpected query: " + sql);
            },
            async all() {
              if (sql.includes("FROM admin_missions")) return { success: true, results: options.missionRows ?? [] };
              throw new Error("Unexpected query: " + sql);
            },
            async run() { return { success: true, meta: { changes: 1 } }; },
          };
        },
      };
    },
  } as never;
}

test("admin access requires an authenticated device session", async () => {
  const response = await getAccess({
    request: new Request("https://sac.example/api/admin/access"),
    env: { DB: database(null) },
  } as never);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "authentication_required" });
});

test("ordinary accounts do not receive admin access", async () => {
  const { request, sessionRow } = await authenticatedRequest("/api/admin/access");
  const response = await getAccess({ request, env: { DB: database(sessionRow) } } as never);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { canAccess: false, role: null, activeMissions: 0 });
});

test("super admins receive access without depending on a client role", async () => {
  const { request, sessionRow } = await authenticatedRequest("/api/admin/access");
  const response = await getAccess({ request, env: { DB: database(sessionRow, { superAdmin: true }) } } as never);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { canAccess: true, role: "super_admin", activeMissions: 0 });
});

test("an active mission gives a delegate access to their own admin space", async () => {
  const { request, sessionRow } = await authenticatedRequest("/api/admin/access");
  const response = await getAccess({ request, env: { DB: database(sessionRow, { activeMissions: 2 }) } } as never);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { canAccess: true, role: "delegate", activeMissions: 2 });
});

test("my-missions requires an authenticated device session", async () => {
  const response = await getMyMissions({
    request: new Request("https://sac.example/api/admin/my-missions"),
    env: { DB: database(null) },
  } as never);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "authentication_required" });
});

test("my-missions returns only the authenticated account mission rows", async () => {
  const { request, sessionRow } = await authenticatedRequest("/api/admin/my-missions");
  const response = await getMyMissions({
    request,
    env: { DB: database(sessionRow, { missionRows: [
      { id: "mission-a", scope_key: "zone:niamey", status: "active", due_at: null, created_at: now, updated_at: now, version: 1, permission: "read" },
      { id: "mission-a", scope_key: "zone:niamey", status: "active", due_at: null, created_at: now, updated_at: now, version: 1, permission: "update" },
    ] }) },
  } as never);
  assert.equal(response.status, 200);
  const payload = await response.json() as { missions: Array<{ id: string; permissions: string[] }> };
  assert.equal(payload.missions.length, 1);
  assert.equal(payload.missions[0].id, "mission-a");
  assert.deepEqual(payload.missions[0].permissions, ["read", "update"]);
});
