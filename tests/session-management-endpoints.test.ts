import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { createSessionCookie } from "../functions/lib/security/session-cookie.ts";
import { createSessionToken } from "../functions/lib/security/session-token.ts";
import { getSessionExpiresAt } from "../src/domain/auth-policy.ts";
import { onRequestGet as listSessions } from "../functions/api/auth/sessions.ts";
import { onRequestPost as revokeSession } from "../functions/api/auth/revoke-session.ts";

const env = {
  DB: { prepare() { throw new Error("database_must_not_be_accessed"); } } as never,
};

test("session list requires an authenticated device session", async () => {
  const response = await listSessions({
    request: new Request("https://sac.example/api/auth/sessions"),
    env,
  } as never);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "authentication_required" });
});

test("session revocation rejects a cross-origin request before database access", async () => {
  const response = await revokeSession({
    request: new Request("https://sac.example/api/auth/revoke-session", {
      method: "POST",
      headers: {
        Origin: "https://attacker.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId: "123e4567-e89b-42d3-a456-426614174000" }),
    }),
    env,
  } as never);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "cross_origin_request" });
});

test("session revocation requires same-origin JSON and an authenticated session", async () => {
  const response = await revokeSession({
    request: new Request("https://sac.example/api/auth/revoke-session", {
      method: "POST",
      headers: {
        Origin: "https://sac.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId: "123e4567-e89b-42d3-a456-426614174000" }),
    }),
    env,
  } as never);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "authentication_required" });
});


test("session list returns only safe device metadata for the authenticated account", async () => {
  const now = Date.now();
  const issued = await createSessionToken(webcrypto as unknown as Crypto);
  const createdAt = now - 10_000;
  const lastActivityAt = now - 1_000;
  const expiresAt = Date.parse(getSessionExpiresAt({
    createdAt: new Date(createdAt).toISOString(),
    lastActivityAt: new Date(lastActivityAt).toISOString(),
  }) as string);
  const authRow = {
    session_id: "session-current",
    account_id: "account-current",
    device_id: "device-root",
    token_hash: issued.tokenHash,
    session_status: "active",
    session_auth_version: 1,
    created_at: createdAt,
    last_activity_at: lastActivityAt,
    expires_at: expiresAt,
    revoked_at: null,
    account_status: "active",
    device_status: "active",
    current_device_auth_version: 1,
  };
  const sessionRows = [{
    id: "session-current",
    device_id: "device-root",
    created_at: createdAt,
    last_activity_at: lastActivityAt,
    expires_at: expiresAt,
    device_created_at: createdAt - 5_000,
    root_credential_configured: 1,
  }];
  const db = {
    prepare(sql: string) {
      return {
        bind() { return this; },
        async first() { return authRow; },
        async run() { return { success: true, meta: { changes: 1 } }; },
        async all() { return { success: true, results: sessionRows }; },
      };
    },
  };
  const response = await listSessions({
    request: new Request("https://sac.example/api/auth/sessions", {
      headers: { Cookie: createSessionCookie(issued.token) },
    }),
    env: { DB: db as never },
  } as never);

  assert.equal(response.status, 200);
  const payload = await response.json() as {
    currentSessionId: string;
    sessions: Array<{
      id: string; deviceId: string; deviceCreatedAt: number;
      rootCredentialConfigured: boolean; current: boolean;
    }>;
  };
  assert.equal(payload.currentSessionId, "session-current");
  assert.deepEqual(payload.sessions, [{
    id: "session-current",
    deviceId: "device-root",
    deviceCreatedAt: createdAt - 5_000,
    rootCredentialConfigured: true,
    createdAt,
    lastActivityAt,
    expiresAt,
    current: true,
  }]);
  assert.equal(JSON.stringify(payload).includes(issued.token), false);
});


test("session revocation is scoped to the authenticated account and active sessions", async () => {
  const now = Date.now();
  const issued = await createSessionToken(webcrypto as unknown as Crypto);
  const createdAt = now - 20_000;
  const lastActivityAt = now - 1_000;
  const expiresAt = Date.parse(getSessionExpiresAt({
    createdAt: new Date(createdAt).toISOString(),
    lastActivityAt: new Date(lastActivityAt).toISOString(),
  }) as string);
  const authRow = {
    session_id: "session-current",
    account_id: "account-current",
    device_id: "device-root",
    token_hash: issued.tokenHash,
    session_status: "active",
    session_auth_version: 1,
    created_at: createdAt,
    last_activity_at: lastActivityAt,
    expires_at: expiresAt,
    revoked_at: null,
    account_status: "active",
    device_status: "active",
    current_device_auth_version: 1,
  };
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];
      statements.push({ sql, values });
      return {
        bind(...args: unknown[]) { values = args; statements[statements.length - 1].values = args; return this; },
        async first() { return authRow; },
        async run() { return { success: true, meta: { changes: 1 } }; },
        async all() { return { success: true, results: [] }; },
      };
    },
  };
  const targetSessionId = "123e4567-e89b-42d3-a456-426614174000";
  const response = await revokeSession({
    request: new Request("https://sac.example/api/auth/revoke-session", {
      method: "POST",
      headers: {
        Cookie: createSessionCookie(issued.token),
        Origin: "https://sac.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId: targetSessionId }),
    }),
    env: { DB: db as never },
  } as never);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { revoked: true, sessionId: targetSessionId });
  const revoke = statements.find((item) => item.sql.includes("SET status = 'revoked'"));
  assert.ok(revoke);
  assert.match(revoke.sql, /account_id = \?/);
  assert.match(revoke.sql, /status = 'active'/);
  assert.match(revoke.sql, /expires_at > \?/);
  assert.deepEqual(revoke.values.slice(1, 3), [targetSessionId, "account-current"]);
});

test("session revocation cannot revoke the current session through the other-session endpoint", async () => {
  const now = Date.now();
  const issued = await createSessionToken(webcrypto as unknown as Crypto);
  const createdAt = now - 20_000;
  const lastActivityAt = now - 1_000;
  const expiresAt = Date.parse(getSessionExpiresAt({
    createdAt: new Date(createdAt).toISOString(),
    lastActivityAt: new Date(lastActivityAt).toISOString(),
  }) as string);
  const authRow = {
    session_id: "123e4567-e89b-42d3-a456-426614174000",
    account_id: "account-current",
    device_id: "device-root",
    token_hash: issued.tokenHash,
    session_status: "active",
    session_auth_version: 1,
    created_at: createdAt,
    last_activity_at: lastActivityAt,
    expires_at: expiresAt,
    revoked_at: null,
    account_status: "active",
    device_status: "active",
    current_device_auth_version: 1,
  };
  const executed: string[] = [];
  const db = {
    prepare(sql: string) {
      executed.push(sql);
      return {
        bind() { return this; },
        async first() { return authRow; },
        async run() { return { success: true, meta: { changes: 1 } }; },
      };
    },
  };
  const response = await revokeSession({
    request: new Request("https://sac.example/api/auth/revoke-session", {
      method: "POST",
      headers: {
        Cookie: createSessionCookie(issued.token),
        Origin: "https://sac.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId: authRow.session_id }),
    }),
    env: { DB: db as never },
  } as never);

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "cannot_revoke_current_session" });
  assert.equal(executed.some((sql) => sql.includes("SET status = 'revoked'")), false);
});
