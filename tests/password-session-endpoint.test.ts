import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import { onRequestPost as passwordSession } from "../functions/api/auth/password-session.ts";
import { hashAccountPassword } from "../functions/lib/security/password-hash.ts";

const origin = "https://sac.example";
const password = "phrase de passe de test SAC 2026";

type AccountRow = {
  id: string;
  status: string;
  password_hash: string;
  device_id: string | null;
  device_status: string | null;
  credential_id: string | null;
};

class MockDb {
  readonly sql: string[] = [];
  readonly account: AccountRow | null;

  constructor(account: AccountRow | null) {
    this.account = account;
  }

  prepare(sql: string) {
    this.sql.push(sql);
    return {
      bind: (..._values: unknown[]) => ({
        run: async () => ({ success: true, meta: { changes: 1 } }),
        first: async () => {
          if (sql.includes("SELECT attempt_count")) return { attempt_count: 1 };
          if (sql.includes("SELECT a.id")) return this.account;
          throw new Error("unexpected query: " + sql);
        },
      }),
    };
  }
}

function request(body: unknown, requestOrigin = origin) {
  return new Request(origin + "/api/auth/password-session", {
    method: "POST",
    headers: { Origin: requestOrigin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function account(overrides: Partial<AccountRow> = {}): Promise<AccountRow> {
  return {
    id: "123e4567-e89b-42d3-a456-426614174000",
    status: "active",
    password_hash: await hashAccountPassword(webcrypto as unknown as Crypto, password),
    device_id: null,
    device_status: null,
    credential_id: null,
    ...overrides,
  };
}

function env(db: unknown) {
  return { DB: db, EMAIL_OTP_HMAC_SECRET: "s".repeat(32) };
}

test("password session rejects cross-origin requests before D1", async () => {
  const db = new MockDb(null);
  const response = await passwordSession({
    request: request({ email: "root@example.test", password }, "https://attacker.example"),
    env: env(db),
  } as never);
  assert.equal(response.status, 403);
  assert.equal(db.sql.length, 0);
});

test("password session creates a provisional device and session without a security key", async () => {
  const db = new MockDb(await account());
  const response = await passwordSession({
    request: request({ email: "root@example.test", password }),
    env: env(db),
  } as never);
  assert.equal(response.status, 201);
  const payload = await response.json() as { authenticated: boolean; securityKeyConfigured: boolean; session: { id: string } };
  assert.equal(payload.authenticated, true);
  assert.equal(payload.securityKeyConfigured, false);
  assert.ok(payload.session.id);
  assert.match(response.headers.get("Set-Cookie") ?? "", /__Host-sac_session=/);
  assert.ok(db.sql.some((sql) => sql.includes("INSERT INTO devices")));
  assert.ok(db.sql.some((sql) => sql.includes("INSERT INTO device_sessions")));
});

test("password session reuses an existing provisional device", async () => {
  const db = new MockDb(await account({ device_id: "device-1", device_status: "active" }));
  const response = await passwordSession({
    request: request({ email: "root@example.test", password }),
    env: env(db),
  } as never);
  assert.equal(response.status, 201);
  assert.equal(db.sql.some((sql) => sql.includes("INSERT INTO devices")), false);
  assert.ok(db.sql.some((sql) => sql.includes("INSERT INTO device_sessions")));
});

test("password session refuses to bypass an existing security key", async () => {
  const db = new MockDb(await account({ device_id: "device-1", device_status: "active", credential_id: "credential-1" }));
  const response = await passwordSession({
    request: request({ email: "root@example.test", password }),
    env: env(db),
  } as never);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "security_key_required" });
  assert.equal(db.sql.some((sql) => sql.includes("INSERT INTO device_sessions")), false);
});

test("password session does not disclose account state for an invalid password", async () => {
  const db = new MockDb(await account());
  const response = await passwordSession({
    request: request({ email: "root@example.test", password: "wrong password" }),
    env: env(db),
  } as never);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "invalid_credentials" });
  assert.equal(db.sql.some((sql) => sql.includes("INSERT INTO device_sessions")), false);
});
