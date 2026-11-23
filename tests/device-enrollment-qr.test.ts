import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import {
  formatDeviceEnrollmentQr,
  parseDeviceEnrollmentQr,
  type DeviceEnrollmentQrPayload,
} from "../src/domain/device-enrollment-qr.ts";

function payload(overrides: Partial<DeviceEnrollmentQrPayload> = {}): DeviceEnrollmentQrPayload {
  return {
    mode: "retrieve",
    id: randomBytes(16).toString("base64url"),
    secret: randomBytes(32).toString("base64url"),
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

test("le QR se formate et se relit sans perte", () => {
  const input = payload();
  const qr = formatDeviceEnrollmentQr(input);
  assert.match(qr, /^sac-pair:\/\/v1\?m=retrieve&id=/);
  assert.deepEqual(parseDeviceEnrollmentQr(qr, Date.now()), { ok: true, payload: input });
});

test("le mode bootstrap est accepté mais reste un simple transport", () => {
  const input = payload({ mode: "bootstrap" });
  const qr = formatDeviceEnrollmentQr(input);
  const parsed = parseDeviceEnrollmentQr(qr, Date.now());
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.payload.mode, "bootstrap");
});

test("un QR expiré est refusé", () => {
  const input = payload({ expiresAt: Date.now() - 1 });
  const parsed = parseDeviceEnrollmentQr(formatDeviceEnrollmentQr(input), Date.now());
  assert.deepEqual(parsed, { ok: false, error: "qr_expired" });
});

test("un schéma, une version ou un chemin incorrect est refusé", () => {
  const input = payload();
  const qr = formatDeviceEnrollmentQr(input);
  assert.equal(parseDeviceEnrollmentQr(qr.replace("sac-pair:", "https:"), Date.now()).ok, false);
  assert.equal(parseDeviceEnrollmentQr(qr.replace("//v1?", "//v2?"), Date.now()).ok, false);
  assert.equal(parseDeviceEnrollmentQr(qr.replace("//v1?", "//v1/path?"), Date.now()).ok, false);
  assert.equal(parseDeviceEnrollmentQr(qr + "#fragment", Date.now()).ok, false);
});

test("les champs inconnus, manquants ou dupliqués sont refusés", () => {
  const input = payload();
  const qr = formatDeviceEnrollmentQr(input);
  assert.equal(parseDeviceEnrollmentQr(qr + "&x=1", Date.now()).ok, false);
  assert.equal(parseDeviceEnrollmentQr(qr.replace(/&e=[0-9]+/, ""), Date.now()).ok, false);
  assert.equal(parseDeviceEnrollmentQr(qr + "&m=retrieve", Date.now()).ok, false);
  assert.equal(parseDeviceEnrollmentQr(qr + "&m=other", Date.now()).ok, false);
});

test("les identifiants et secrets doivent être du base64url canonique de taille exacte", () => {
  const input = payload();
  const qr = formatDeviceEnrollmentQr(input);
  assert.equal(parseDeviceEnrollmentQr(qr.replace(input.id, input.id + "="), Date.now()).ok, false);
  assert.equal(parseDeviceEnrollmentQr(qr.replace(input.secret, input.secret.slice(0, -1)), Date.now()).ok, false);
  assert.equal(parseDeviceEnrollmentQr(qr.replace(input.secret, input.secret.slice(0, -1) + "B"), Date.now()).ok, false);
});

test("une expiration non entière ou trop longue est refusée", () => {
  const input = payload();
  const qr = formatDeviceEnrollmentQr(input);
  assert.equal(parseDeviceEnrollmentQr(qr.replace(/&e=[0-9]+/, "&e=1.5"), Date.now()).ok, false);
  assert.equal(parseDeviceEnrollmentQr(qr.replace(/&e=[0-9]+/, "&e=99999999999999999999"), Date.now()).ok, false);
  assert.equal(parseDeviceEnrollmentQr(qr.replace(/&e=[0-9]+/, "&e=0"), Date.now()).ok, false);
});

test("un QR trop long est refusé avant analyse", () => {
  assert.deepEqual(parseDeviceEnrollmentQr("x".repeat(513), Date.now()), { ok: false, error: "qr_too_long" });
});

test("le formateur refuse une charge invalide", () => {
  assert.throws(() => formatDeviceEnrollmentQr(payload({ id: "short" })), /device_enrollment_qr_invalid/);
  assert.throws(() => formatDeviceEnrollmentQr(payload({ secret: "short" })), /device_enrollment_qr_invalid/);
  assert.throws(() => formatDeviceEnrollmentQr(payload({ expiresAt: 0 })), /device_enrollment_qr_invalid/);
});
