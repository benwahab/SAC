import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import { onRequestPost as startRootEnrollment } from "../functions/api/auth/start-root-enrollment.ts";
import { createSessionCookie } from "../functions/lib/security/session-cookie.ts";
import { createSessionToken } from "../functions/lib/security/session-token.ts";
import { getSessionExpiresAt } from "../src/domain/auth-policy.ts";

const cryptoProvider = webcrypto as unknown as Crypto;
const origin = "https://sac.example";

class MockDb {
  readonly sql: string[] = [];
  readonly configured: boolean;
  batchCalls = 0;

  constructor(configured: boolean) {
    this.configured = configured;
  }

  prepare(sql: string) {
    this.sql.push(sql);
    return {
      bind: (..._values: unknown[]) => ({
        run: async () => ({ success: true, meta: { changes: 1 } }),
        first: async () => {
          if (sql.includes("SELECT s.id AS session_id")) return sessionRow();
          if (sql.includes("SELECT 1 AS configured")) return this.configured ? { configured: 1 } : null;
          throw new Error("unexpected query: " + sql);
        },
      }),
    };
  }

  async batch(statements: unknown[]) {
    this.batchCalls += 1;
    return statements.map(() => ({ success: true, meta: { changes: 1 } }));
  }
}

function sessionRow() {
  const now = Date.now();
  const createdAt = now - 10_000;
  const lastActivityAt = now - 1_000;
  const expiresAt = getSessionExpiresAt({
    createdAt: new Date(createdAt).toISOString(),
    lastActivityAt: new Date(lastActivityAt).toISOString(),
  });
  assert.ok(expiresAt);
  return {
    session_id: "session-1",
    account_id: "123e4567-e89b-42d3-a456-426614174000",
    device_id: "223e4567-e89b-42d3-a456-426614174000",
    token_hash: "a".repeat(64),
    session_status: "active",
    session_auth_version: 1,
    created_at: createdAt,
    last_activity_at: lastActivityAt,
    expires_at: Date.parse(expiresAt),
    revoked_at: null,
    account_status: "active",
    device_status: "active",
    current_device_auth_version: 1,
  };
}

async function request(cookie: string, requestOrigin = origin) {
  return new Request(origin + "/api/auth/start-root-enrollment", {
    method: "POST",
    headers: {
      Origin: requestOrigin,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: "{}",
  });
}

function env(db: unknown) {
  return {
    DB: db,
    WEBAUTHN_RP_ID: "sac.example",
    WEBAUTHN_RP_NAME: "SAC",
    WEBAUTHN_ALLOWED_ORIGINS: JSON.stringify([origin]),
    WEBAUTHN_ROOT_ENROLLMENT_ENABLED: "true",
  };
}

test("session enrollment rejects an untrusted origin before D1", async () => {
  const issued = await createSessionToken(cryptoProvider);
  const db = new MockDb(false);
  const response = await startRootEnrollment({
    request: await request(createSessionCookie(issued.token), "https://attacker.example"),
    env: env(db),
  } as never);
  assert.equal(response.status, 403);
  assert.equal(db.sql.length, 0);
});

test("session enrollment creates a ceremony for a provisional device", async () => {
  const issued = await createSessionToken(cryptoProvider);
  const db = new MockDb(false);
  const response = await startRootEnrollment({
    request: await request(createSessionCookie(issued.token)),
    env: env(db),
  } as never);
  assert.equal(response.status, 200);
  const payload = await response.json() as { ceremonyId: string; expiresAt: number; options: { challenge: string; authenticatorSelection: { authenticatorAttachment: string } } };
  assert.match(payload.ceremonyId, /^[0-9a-f-]{36}$/);
  assert.ok(payload.expiresAt > Date.now());
  assert.equal(payload.options.authenticatorSelection.authenticatorAttachment, "platform");
  assert.equal(db.batchCalls, 1);
});

test("session enrollment refuses an account that already has a root credential", async () => {
  const issued = await createSessionToken(cryptoProvider);
  const db = new MockDb(true);
  const response = await startRootEnrollment({
    request: await request(createSessionCookie(issued.token)),
    env: env(db),
  } as never);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "security_key_already_configured" });
  assert.equal(db.batchCalls, 0);
});
