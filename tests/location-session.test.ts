import assert from "node:assert/strict";
import test from "node:test";
import {
  createLocationSessionBundle,
  decodeLocationSessionBundle,
  encodeLocationSessionBundle,
  verifyLocationSessionBundle,
  deriveLocationSessionDirectionalKey,
} from "../src/services/location/location-session.ts";
import { fingerprintLocationIdentityKey } from "../src/services/location/key-exchange.ts";
import { pinTrustedLocationFingerprint } from "../src/services/location/identity-vault.ts";
import {
  type LocationIdentityKeyRecord,
  type LocationIdentityKeyStore,
} from "../src/services/location/identity-vault.ts";
import { encryptLocationPayload, decryptLocationPayload } from "../src/services/location/crypto.ts";

class MemoryIdentityStore implements LocationIdentityKeyStore {
  private readonly records = new Map<string, LocationIdentityKeyRecord>();
  async get(storageKey: string) { return this.records.get(storageKey) ?? null; }
  async add(record: LocationIdentityKeyRecord) {
    if (this.records.has(record.storageKey)) throw new Error("ConstraintError");
    this.records.set(record.storageKey, record);
  }
  async put(record: LocationIdentityKeyRecord) { this.records.set(record.storageKey, record); }
}

test("creates signed per-alert ECDH bundles bound to account, device, alert and session", async () => {
  const store = new MemoryIdentityStore();
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const expiresAt = Date.now() + 60 * 60 * 1000;
  const session = await createLocationSessionBundle(
    "author", "author-device", "alert-1", "session-1", salt, expiresAt, store,
  );
  assert.equal(session.bundle.ownerId, "author");
  assert.equal(session.bundle.deviceId, "author-device");
  assert.equal(session.bundle.alertId, "alert-1");
  assert.equal(session.bundle.sessionId, "session-1");
  assert.equal(session.bundle.salt.byteLength, 32);
  assert.equal(session.exchangePrivateKey.extractable, false);
  assert.equal(await verifyLocationSessionBundle(
    session.bundle, "author", "author-device", "alert-1", "session-1",
  ), true);
});

test("round-trips session bundles through the relay-safe opaque string format", async () => {
  const session = await createLocationSessionBundle(
    "author", "device-a", "alert-1", "session-1",
    crypto.getRandomValues(new Uint8Array(32)), Date.now() + 60_000,
    new MemoryIdentityStore(),
  );
  const encoded = encodeLocationSessionBundle(session.bundle);
  const decoded = decodeLocationSessionBundle(encoded);
  assert.ok(decoded);
  assert.equal(await verifyLocationSessionBundle(
    decoded!, "author", "device-a", "alert-1", "session-1",
  ), true);
  assert.equal(decodeLocationSessionBundle(encoded + "x"), null);
});

test("rejects a session bundle replayed into another alert or session", async () => {
  const session = await createLocationSessionBundle(
    "author", "device-a", "alert-1", "session-1",
    crypto.getRandomValues(new Uint8Array(32)), Date.now() + 60_000,
    new MemoryIdentityStore(),
  );
  assert.equal(await verifyLocationSessionBundle(
    session.bundle, "author", "device-a", "alert-2", "session-1",
  ), false);
  assert.equal(await verifyLocationSessionBundle(
    session.bundle, "author", "device-a", "alert-1", "session-2",
  ), false);
});

test("rejects expired and altered session bundles", async () => {
  const session = await createLocationSessionBundle(
    "author", "device-a", "alert-1", "session-1",
    crypto.getRandomValues(new Uint8Array(32)), Date.now() + 60_000,
    new MemoryIdentityStore(),
  );
  const expired = { ...session.bundle, expiresAt: Date.now() - 1 };
  assert.equal(await verifyLocationSessionBundle(
    expired, "author", "device-a", "alert-1", "session-1",
  ), false);
  const altered = { ...session.bundle, salt: crypto.getRandomValues(new Uint8Array(32)) };
  assert.equal(await verifyLocationSessionBundle(
    altered, "author", "device-a", "alert-1", "session-1",
  ), false);
});

test("author encrypts GPS for one recipient and only that recipient can decrypt", async () => {
  const authorStore = new MemoryIdentityStore();
  const recipientStore = new MemoryIdentityStore();
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const expiresAt = Date.now() + 60 * 60 * 1000;
  const author = await createLocationSessionBundle(
    "author", "author-device", "alert-1", "session-1", salt, expiresAt, authorStore,
  );
  const recipient = await createLocationSessionBundle(
    "recipient", "recipient-device", "alert-1", "session-1", salt, expiresAt, recipientStore,
  );
  await pinTrustedLocationFingerprint({
    accountId: "author",
    deviceId: "author-device",
    contactAccountId: "recipient",
    contactDeviceId: "recipient-device",
    fingerprint: await fingerprintLocationIdentityKey(recipient.bundle.identityPublicKey),
    confirmedByIndependentChannel: true,
  }, authorStore);
  await pinTrustedLocationFingerprint({
    accountId: "recipient",
    deviceId: "recipient-device",
    contactAccountId: "author",
    contactDeviceId: "author-device",
    fingerprint: await fingerprintLocationIdentityKey(author.bundle.identityPublicKey),
    confirmedByIndependentChannel: true,
  }, recipientStore);

  const authorSendKey = await deriveLocationSessionDirectionalKey({
    ownPrivateKey: author.exchangePrivateKey,
    remoteBundle: recipient.bundle,
    authorAccountId: "author",
    alertId: "alert-1",
    sessionId: "session-1",
    senderDeviceId: "author-device",
    recipientDeviceId: "recipient-device",
    ownDeviceId: "author-device",
    expectedSalt: salt,
  }, "author", authorStore);
  const recipientReceiveKey = await deriveLocationSessionDirectionalKey({
    ownPrivateKey: recipient.exchangePrivateKey,
    remoteBundle: author.bundle,
    authorAccountId: "author",
    alertId: "alert-1",
    sessionId: "session-1",
    senderDeviceId: "author-device",
    recipientDeviceId: "recipient-device",
    ownDeviceId: "recipient-device",
    expectedSalt: salt,
  }, "recipient", recipientStore);

  const location = JSON.stringify({ latitude: 13.5, longitude: 2.1, accuracy: 5, capturedAt: 123456 });
  const packet = await encryptLocationPayload(location, authorSendKey, "session-1");
  assert.equal(await decryptLocationPayload(packet, recipientReceiveKey, "session-1"), location);
});
