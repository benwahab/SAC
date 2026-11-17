import assert from "node:assert/strict";
import test from "node:test";
import { transitionDevice, type DeviceRecord } from "../src/domain/device-management.ts";

const createdAt = "2026-11-17T10:00:00.000Z";
const verifiedAt = "2026-11-17T10:05:00.000Z";
const revokedAt = "2026-11-17T10:10:00.000Z";

function makeDevice(overrides: Partial<DeviceRecord> = {}): DeviceRecord {
  return {
    deviceId: "device-a",
    accountId: "account-a",
    displayName: "Téléphone principal",
    platform: "android",
    status: "pending_verification",
    createdAt,
    verifiedAt: null,
    lastSeenAt: null,
    revokedAt: null,
    ...overrides,
  };
}

test("un appareil en attente devient actif après approbation du même compte", () => {
  const result = transitionDevice(makeDevice(), {
    type: "approve",
    actorAccountId: "account-a",
    at: verifiedAt,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.device.status, "active");
  assert.equal(result.device.verifiedAt, verifiedAt);
  assert.equal(result.device.revokedAt, null);
});

test("la transition ne modifie pas l enregistrement initial", () => {
  const original = makeDevice();
  const result = transitionDevice(original, {
    type: "approve",
    actorAccountId: "account-a",
    at: verifiedAt,
  });

  assert.equal(result.ok, true);
  assert.equal(original.status, "pending_verification");
  assert.equal(original.verifiedAt, null);
});

test("un appareil en attente peut être révoqué sans avoir été approuvé", () => {
  const result = transitionDevice(makeDevice(), {
    type: "revoke",
    actorAccountId: "account-a",
    at: revokedAt,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.device.status, "revoked");
  assert.equal(result.device.verifiedAt, null);
  assert.equal(result.device.revokedAt, revokedAt);
});

test("un appareil actif peut être révoqué", () => {
  const result = transitionDevice(makeDevice({
    status: "active",
    verifiedAt,
  }), {
    type: "revoke",
    actorAccountId: "account-a",
    at: revokedAt,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.device.status, "revoked");
  assert.equal(result.device.verifiedAt, verifiedAt);
  assert.equal(result.device.revokedAt, revokedAt);
});

test("un appareil révoqué est terminal et ne peut pas être réactivé", () => {
  const revoked = makeDevice({ status: "revoked", revokedAt });
  const result = transitionDevice(revoked, {
    type: "approve",
    actorAccountId: "account-a",
    at: "2026-11-17T10:15:00.000Z",
  });

  assert.deepEqual(result, { ok: false, error: "device_already_revoked" });
});

test("un appareil actif ne peut pas être approuvé une seconde fois", () => {
  const result = transitionDevice(makeDevice({ status: "active", verifiedAt }), {
    type: "approve",
    actorAccountId: "account-a",
    at: "2026-11-17T10:15:00.000Z",
  });

  assert.deepEqual(result, { ok: false, error: "device_not_pending" });
});

test("un compte différent ne peut pas modifier le cycle de vie de l appareil", () => {
  const result = transitionDevice(makeDevice(), {
    type: "revoke",
    actorAccountId: "account-b",
    at: revokedAt,
  });

  assert.deepEqual(result, { ok: false, error: "account_mismatch" });
});

test("un horodatage non canonique ou invalide est refusé", () => {
  const result = transitionDevice(makeDevice(), {
    type: "approve",
    actorAccountId: "account-a",
    at: "not-a-date",
  });

  assert.deepEqual(result, { ok: false, error: "invalid_event_timestamp" });
});

test("une transition antérieure à la création est refusée", () => {
  const result = transitionDevice(makeDevice(), {
    type: "approve",
    actorAccountId: "account-a",
    at: "2026-11-17T09:59:59.000Z",
  });

  assert.deepEqual(result, { ok: false, error: "event_before_device_creation" });
});

test("un appareil actif ne peut pas être révoqué avant sa vérification", () => {
  const result = transitionDevice(makeDevice({ status: "active", verifiedAt }), {
    type: "revoke",
    actorAccountId: "account-a",
    at: "2026-11-17T10:04:59.000Z",
  });

  assert.deepEqual(result, { ok: false, error: "event_before_verification" });
});

test("un enregistrement incohérent est rejeté", () => {
  const result = transitionDevice(makeDevice({
    status: "active",
    verifiedAt: null,
  }), {
    type: "revoke",
    actorAccountId: "account-a",
    at: revokedAt,
  });

  assert.deepEqual(result, { ok: false, error: "invalid_device_record" });
});

test("la dernière activité ne peut pas précéder la création", () => {
  const result = transitionDevice(makeDevice({
    lastSeenAt: "2026-11-17T09:00:00.000Z",
  }), {
    type: "revoke",
    actorAccountId: "account-a",
    at: revokedAt,
  });

  assert.deepEqual(result, { ok: false, error: "invalid_device_record" });
});