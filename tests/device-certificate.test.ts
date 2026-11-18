import assert from "node:assert/strict";
import test from "node:test";
import {
  issueSecondaryDeviceCertificate,
  verifySecondaryDeviceCertificate,
} from "../src/services/device/device-certificate.ts";

async function rootKeys() {
  return globalThis.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"],
  );
}

async function deviceKeys() {
  const identity = await globalThis.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"],
  );
  const exchange = await globalThis.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"],
  );
  return { identity, exchange };
}

async function verify(certificate: Parameters<typeof verifySecondaryDeviceCertificate>[0], rootPublicKey: CryptoKey, accountId = "account-123", deviceId = "device-456") {
  return verifySecondaryDeviceCertificate(certificate, rootPublicKey, { accountId, deviceId });
}

async function issue(root?: CryptoKeyPair) {
  const signingRoot = root ?? await rootKeys();
  const device = await deviceKeys();
  const certificate = await issueSecondaryDeviceCertificate({
    accountId: "account-123",
    deviceId: "device-456",
    platform: "android",
    createdAt: "2026-11-17T12:00:00.000Z",
    identityPublicKey: device.identity.publicKey,
    exchangePublicKey: device.exchange.publicKey,
  }, signingRoot.privateKey, signingRoot.publicKey);
  return { root: signingRoot, device, certificate };
}

test("un certificat secondaire signé par la racine est vérifié", async () => {
  const { root, certificate } = await issue();
  assert.equal(await verify(certificate, root.publicKey), true);
  assert.equal(certificate.accountId, "account-123");
  assert.equal(certificate.deviceId, "device-456");
  assert.equal(certificate.rootFingerprint.length, 79);
});

test("un certificat ne peut pas être transféré vers un autre compte ou appareil", async () => {
  const { root, certificate } = await issue();
  assert.equal(await verify(certificate, root.publicKey, "account-other"), false);
  assert.equal(await verify(certificate, root.publicKey, "account-123", "device-other"), false);
});

test("une substitution de clé publique invalide le certificat", async () => {
  const { root, certificate } = await issue();
  const replacement = await deviceKeys();
  const replacementJwk = await globalThis.crypto.subtle.exportKey("jwk", replacement.exchange.publicKey);
  assert.equal(await verify({ ...certificate, exchangePublicKey: replacementJwk }, root.publicKey), false);
});

test("une autre racine ne peut pas valider le certificat", async () => {
  const { certificate } = await issue();
  const otherRoot = await rootKeys();
  assert.equal(await verify(certificate, otherRoot.publicKey), false);
});

test("une signature altérée est refusée", async () => {
  const { root, certificate } = await issue();
  const altered = new Uint8Array(certificate.signature);
  altered[0] ^= 1;
  assert.equal(await verify({ ...certificate, signature: altered }, root.publicKey), false);
});

test("un certificat mal formé est refusé sans exception", async () => {
  const root = await rootKeys();
  assert.equal(await verify(null as never, root.publicKey), false);
  assert.equal(await verify({
    version: 1, accountId: "", deviceId: "device", platform: "android",
    createdAt: "bad-date", rootFingerprint: "", identityPublicKey: {},
    exchangePublicKey: {}, signature: new Uint8Array(64),
  } as never, root.publicKey), false);
});

test("l'émission refuse une paire racine qui ne correspond pas", async () => {
  const rootA = await rootKeys();
  const rootB = await rootKeys();
  const device = await deviceKeys();
  await assert.rejects(issueSecondaryDeviceCertificate({
    accountId: "account-123",
    deviceId: "device-456",
    platform: "ios",
    createdAt: "2026-11-17T12:00:00.000Z",
    identityPublicKey: device.identity.publicKey,
    exchangePublicKey: device.exchange.publicKey,
  }, rootA.privateKey, rootB.publicKey), /ne correspond pas/);
});

test("un certificat correctement signé avec un point ECDH hors courbe est refusé", async () => {
  const { root, certificate } = await issue();
  const exchangePublicKey = {
    kty: "EC",
    crv: "P-256",
    x: "A".repeat(43),
    y: "A".repeat(43),
  } satisfies JsonWebKey;
  const unsigned = {
    version: certificate.version,
    accountId: certificate.accountId,
    deviceId: certificate.deviceId,
    platform: certificate.platform,
    createdAt: certificate.createdAt,
    rootFingerprint: certificate.rootFingerprint,
    identityPublicKey: certificate.identityPublicKey,
    exchangePublicKey,
  };
  const payload = new TextEncoder().encode(JSON.stringify([
    "SAC:secondary-device-certificate:v1",
    unsigned.version,
    unsigned.accountId,
    unsigned.deviceId,
    unsigned.platform,
    unsigned.createdAt,
    unsigned.rootFingerprint,
    unsigned.identityPublicKey.kty,
    unsigned.identityPublicKey.crv,
    unsigned.identityPublicKey.x,
    unsigned.identityPublicKey.y,
    unsigned.exchangePublicKey.kty,
    unsigned.exchangePublicKey.crv,
    unsigned.exchangePublicKey.x,
    unsigned.exchangePublicKey.y,
    ["location:send", "location:receive"],
  ]));
  const signature = new Uint8Array(await globalThis.crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    root.privateKey,
    payload,
  ));

  assert.equal(await verify({ ...unsigned, signature }, root.publicKey), false);
});
