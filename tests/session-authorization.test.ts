import assert from "node:assert/strict";
import test from "node:test";
import { authorizeDeviceSession, type DeviceSessionRecord, type SessionAuthorizationContext } from "../src/domain/session-authorization.ts";

const now = "2026-11-17T12:00:00.000Z";
const sessionExpiry = "2026-11-17T13:00:00.000Z";

function makeSession(overrides: Partial<DeviceSessionRecord> = {}): DeviceSessionRecord {
  return {
    sessionId: "session-a",
    accountId: "account-a",
    deviceId: "device-a",
    tokenHash: "a".repeat(64),
    status: "active",
    authVersion: 3,
    createdAt: "2026-11-17T11:00:00.000Z",
    lastActivityAt: "2026-11-17T11:00:00.000Z",
    expiresAt: sessionExpiry,
    revokedAt: null,
    ...overrides,
  };
}

function makeContext(overrides: Partial<SessionAuthorizationContext> = {}): SessionAuthorizationContext {
  return {
    expectedAccountId: "account-a",
    expectedDeviceId: "device-a",
    accountStatus: "active",
    currentDeviceAuthVersion: 3,
    deviceStatus: "active",
    now,
    ...overrides,
  };
}

test("autorise une session active liée au bon compte et au bon appareil", () => {
  assert.deepEqual(authorizeDeviceSession(makeSession(), makeContext()), {
    ok: true, sessionId: "session-a", accountId: "account-a", deviceId: "device-a",
  });
});

test("refuse une session révoquée", () => {
  assert.deepEqual(authorizeDeviceSession(makeSession({
    status: "revoked", revokedAt: now,
  }), makeContext()), { ok: false, error: "session_revoked" });
});

test("refuse une session expirée à la seconde exacte de son échéance", () => {
  assert.deepEqual(authorizeDeviceSession(makeSession(), makeContext({
    now: sessionExpiry,
  })), { ok: false, error: "session_expired" });
});

test("refuse une session d'un autre compte", () => {
  assert.deepEqual(authorizeDeviceSession(makeSession(), makeContext({
    expectedAccountId: "account-b",
  })), { ok: false, error: "account_mismatch" });
});

test("refuse une session présentée depuis un autre appareil", () => {
  assert.deepEqual(authorizeDeviceSession(makeSession(), makeContext({
    expectedDeviceId: "device-b",
  })), { ok: false, error: "device_mismatch" });
});

test("refuse un appareil en attente ou révoqué", () => {
  for (const deviceStatus of ["pending_verification", "revoked"] as const) {
    assert.deepEqual(authorizeDeviceSession(makeSession(), makeContext({
      deviceStatus,
    })), { ok: false, error: "device_not_active" });
  }
});

test("l'incrément de auth_version invalide les anciennes sessions de l'appareil", () => {
  assert.deepEqual(authorizeDeviceSession(makeSession(), makeContext({
    currentDeviceAuthVersion: 4,
  })), { ok: false, error: "session_version_mismatch" });
});

test("une session d'un autre appareil du même compte reste indépendante", () => {
  const otherDeviceSession = makeSession({
    sessionId: "session-b",
    deviceId: "device-b",
    authVersion: 1,
  });
  assert.equal(authorizeDeviceSession(otherDeviceSession, makeContext({
    expectedDeviceId: "device-b",
    currentDeviceAuthVersion: 1,
  })).ok, true);
  assert.deepEqual(authorizeDeviceSession(otherDeviceSession, makeContext({
    expectedDeviceId: "device-b",
    currentDeviceAuthVersion: 2,
  })), { ok: false, error: "session_version_mismatch" });
});

test("refuse un hash de jeton mal formé", () => {
  assert.deepEqual(authorizeDeviceSession(makeSession({
    tokenHash: "not-a-hash",
  }), makeContext()), { ok: false, error: "invalid_session_record" });
});

test("refuse une session active portant une date de révocation", () => {
  assert.deepEqual(authorizeDeviceSession(makeSession({
    revokedAt: now,
  }), makeContext()), { ok: false, error: "invalid_session_record" });
});

test("refuse un contexte incomplet", () => {
  assert.deepEqual(authorizeDeviceSession(makeSession(), makeContext({
    currentDeviceAuthVersion: -1,
  })), { ok: false, error: "invalid_authorization_context" });
});


test("refuse une session après 30 jours consécutifs sans activité", () => {
  const session = makeSession({
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActivityAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-04-01T00:00:00.000Z",
  });
  assert.deepEqual(authorizeDeviceSession(session, makeContext({
    now: "2026-01-31T00:00:00.000Z",
  })), { ok: false, error: "session_expired" });
});

test("refuse une session après 90 jours absolus même si elle est récemment active", () => {
  const session = makeSession({
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActivityAt: "2026-03-30T23:59:00.000Z",
    expiresAt: "2026-04-01T00:00:00.000Z",
  });
  assert.deepEqual(authorizeDeviceSession(session, makeContext({
    now: "2026-04-01T00:00:00.000Z",
  })), { ok: false, error: "session_expired" });
});

test("refuse une dernière activité postérieure à l'heure serveur", () => {
  const session = makeSession({ lastActivityAt: "2026-11-17T12:01:00.000Z" });
  assert.deepEqual(authorizeDeviceSession(session, makeContext()), {
    ok: false, error: "invalid_session_record",
  });
});


test("refuse tout accès de session si le compte n'est pas actif", () => {
  for (const accountStatus of ["pending_verification", "suspended", "deletion_pending", "deleted"] as const) {
    assert.deepEqual(authorizeDeviceSession(makeSession(), makeContext({
      accountStatus,
    })), { ok: false, error: "account_not_active" });
  }
});


test("refuse les champs malformés du registre de session sans exception", () => {
  for (const overrides of [
    { sessionId: null as never },
    { accountId: 12 as never },
    { deviceId: null as never },
    { tokenHash: null as never },
    { status: null as never },
    { createdAt: null as never },
    { lastActivityAt: 12 as never },
    { expiresAt: null as never },
    { revokedAt: 12 as never },
  ]) {
    assert.deepEqual(
      authorizeDeviceSession(makeSession(overrides), makeContext()),
      { ok: false, error: "invalid_session_record" },
    );
  }
});

test("refuse une révocation antérieure à la dernière activité enregistrée", () => {
  assert.deepEqual(authorizeDeviceSession(makeSession({
    status: "revoked",
    lastActivityAt: "2026-11-17T11:30:00.000Z",
    revokedAt: "2026-11-17T11:20:00.000Z",
  }), makeContext()), { ok: false, error: "invalid_session_record" });
});

test("refuse un contexte d'autorisation malformé sans exception", () => {
  for (const overrides of [
    { expectedAccountId: null as never },
    { expectedDeviceId: 12 as never },
    { accountStatus: null as never },
    { deviceStatus: "unknown" as never },
    { now: null as never },
  ]) {
    assert.deepEqual(
      authorizeDeviceSession(makeSession(), makeContext(overrides)),
      { ok: false, error: "invalid_authorization_context" },
    );
  }
});


test("refuse une date d'expiration stockée au-delà des 30 jours d'inactivité", () => {
  assert.deepEqual(authorizeDeviceSession(makeSession({
    expiresAt: "2026-12-18T11:00:00.000Z",
  }), makeContext()), { ok: false, error: "invalid_session_record" });
});

test("refuse une date d'expiration stockée au-delà des 90 jours absolus", () => {
  assert.deepEqual(authorizeDeviceSession(makeSession({
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActivityAt: "2026-03-30T00:00:00.000Z",
    expiresAt: "2026-04-02T00:00:00.000Z",
  }), makeContext({
    now: "2026-03-30T12:00:00.000Z",
  })), { ok: false, error: "invalid_session_record" });
});
