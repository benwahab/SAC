import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { createSessionCookie } from "../functions/lib/security/session-cookie.ts";
import { createSessionToken } from "../functions/lib/security/session-token.ts";
import { requireAuthenticatedDeviceSession } from "../functions/lib/security/require-authenticated-device-session.ts";
import { getSessionExpiresAt } from "../src/domain/auth-policy.ts";

const cryptoProvider = webcrypto as unknown as Crypto;

class MockStatement {
  private readonly database: MockDatabase;

  constructor(database: MockDatabase) {
    this.database = database;
  }
  bind(..._values: unknown[]) { return this; }
  async first<T>() { return this.database.row as T | null; }
  async run() {
    this.database.updateCalls += 1;
    return { success: true, meta: { changes: 1 } };
  }
}

class MockDatabase {
  updateCalls = 0;
  readonly row: Record<string, unknown> | null;

  constructor(row: Record<string, unknown> | null) {
    this.row = row;
  }

  prepare(_sql: string) { return new MockStatement(this); }
}

function validSessionRow(tokenHash: string, now: number): Record<string, unknown> {
  const createdAt = now - 10_000;
  const lastActivityAt = now - 1_000;
  const createdIso = new Date(createdAt).toISOString();
  const lastActivityIso = new Date(lastActivityAt).toISOString();
  const expiresAt = getSessionExpiresAt({
    createdAt: createdIso,
    lastActivityAt: lastActivityIso,
  });
  assert.ok(expiresAt);
  return {
    session_id: "session-1",
    account_id: "account-1",
    device_id: "device-1",
    token_hash: tokenHash,
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

test("refuse une requête sans cookie de session sans toucher D1", async () => {
  const db = new MockDatabase(null);
  const response = await requireAuthenticatedDeviceSession(
    new Request("https://sac.example/api/contacts"),
    db as unknown as D1Database,
    Date.now(),
    cryptoProvider,
  );
  assert.deepEqual(response, { ok: false, status: 401 });
  assert.equal(db.updateCalls, 0);
});

test("autorise uniquement une session active liée à un compte et un appareil actifs", async () => {
  const now = Date.now();
  const issued = await createSessionToken(cryptoProvider);
  const db = new MockDatabase(validSessionRow(issued.tokenHash, now));
  const response = await requireAuthenticatedDeviceSession(
    new Request("https://sac.example/api/contacts", {
      headers: { Cookie: createSessionCookie(issued.token) },
    }),
    db as unknown as D1Database,
    now,
    cryptoProvider,
  );

  assert.equal(response.ok, true);
  if (!response.ok) return;
  assert.deepEqual(
    {
      accountId: response.value.accountId,
      deviceId: response.value.deviceId,
      sessionId: response.value.sessionId,
      token: response.value.token,
    },
    {
      accountId: "account-1",
      deviceId: "device-1",
      sessionId: "session-1",
      token: issued.token,
    },
  );
  assert.equal(db.updateCalls, 1);
});

test("tolère un léger décalage d'horloge entre requêtes parallèles", async () => {
  const now = Date.now();
  const issued = await createSessionToken(cryptoProvider);
  const row = validSessionRow(issued.tokenHash, now);
  row.last_activity_at = now + 2_000;
  row.expires_at = Date.parse(getSessionExpiresAt({
    createdAt: new Date(row.created_at as number).toISOString(),
    lastActivityAt: new Date(row.last_activity_at as number).toISOString(),
  }) as string);
  const db = new MockDatabase(row);
  const response = await requireAuthenticatedDeviceSession(
    new Request("https://sac.example/api/contacts", {
      headers: { Cookie: createSessionCookie(issued.token) },
    }),
    db as unknown as D1Database,
    now,
    cryptoProvider,
  );

  assert.equal(response.ok, true);
  assert.equal(db.updateCalls, 1);
});

test("refuse une activité future au-delà de la tolérance d'horloge", async () => {
  const now = Date.now();
  const issued = await createSessionToken(cryptoProvider);
  const row = validSessionRow(issued.tokenHash, now);
  row.last_activity_at = now + 61_000;
  const db = new MockDatabase(row);
  const response = await requireAuthenticatedDeviceSession(
    new Request("https://sac.example/api/contacts", {
      headers: { Cookie: createSessionCookie(issued.token) },
    }),
    db as unknown as D1Database,
    now,
    cryptoProvider,
  );

  assert.deepEqual(response, { ok: false, status: 401 });
  assert.equal(db.updateCalls, 0);
});

test("refuse un compte suspendu et ne renouvelle pas sa session", async () => {
  const now = Date.now();
  const issued = await createSessionToken(cryptoProvider);
  const row = validSessionRow(issued.tokenHash, now);
  row.account_status = "suspended";
  const db = new MockDatabase(row);
  const response = await requireAuthenticatedDeviceSession(
    new Request("https://sac.example/api/contacts", {
      headers: { Cookie: createSessionCookie(issued.token) },
    }),
    db as unknown as D1Database,
    now,
    cryptoProvider,
  );

  assert.deepEqual(response, { ok: false, status: 401 });
  assert.equal(db.updateCalls, 0);
});

test("renvoie une indisponibilité contrôlée lorsque D1 échoue", async () => {
  const failingDb = {
    prepare() {
      throw new Error("database unavailable");
    },
  };
  const issued = await createSessionToken(cryptoProvider);
  const response = await requireAuthenticatedDeviceSession(
    new Request("https://sac.example/api/contacts", {
      headers: { Cookie: createSessionCookie(issued.token) },
    }),
    failingDb as unknown as D1Database,
    Date.now(),
    cryptoProvider,
  );
  assert.deepEqual(response, { ok: false, status: 503 });
});
