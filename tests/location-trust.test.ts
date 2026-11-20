import assert from "node:assert/strict";
import test from "node:test";
import {
  createLocationExchangeKeyPair,
  createLocationIdentityKeyPair,
  fingerprintLocationIdentityKey,
  signLocationKeyBundleWithPublicKey,
  verifyTrustedLocationKeyBundle,
  verifyPinnedTrustedLocationKeyBundle,
} from "../src/services/location/key-exchange.ts";
import {
  pinTrustedLocationFingerprint,
  type LocationIdentityKeyRecord,
  type LocationIdentityKeyStore,
} from "../src/services/location/identity-vault.ts";

class MemoryPinStore implements LocationIdentityKeyStore {
  private readonly records = new Map<string, LocationIdentityKeyRecord>();
  async get(storageKey: string) { return this.records.get(storageKey) ?? null; }
  async add(record: LocationIdentityKeyRecord) {
    if (this.records.has(record.storageKey)) throw new Error("ConstraintError");
    this.records.set(record.storageKey, record);
  }
  async put(record: LocationIdentityKeyRecord) { this.records.set(record.storageKey, record); }
}

async function createBundle(ownerId = "trusted-contact", deviceId = "trusted-device") {
  const identity = await createLocationIdentityKeyPair();
  const exchange = await createLocationExchangeKeyPair();
  const bundle = await signLocationKeyBundleWithPublicKey(
    ownerId,
    deviceId,
    exchange.publicKey,
    identity.privateKey,
    identity.publicKey,
  );
  const fingerprint = await fingerprintLocationIdentityKey(bundle.identityPublicKey);
  return { bundle, fingerprint, deviceId };
}

test("accepts a signed contact key only when its independently pinned fingerprint matches", async () => {
  const { bundle, fingerprint, deviceId } = await createBundle();
  assert.equal(
    await verifyTrustedLocationKeyBundle(bundle, "trusted-contact", deviceId, fingerprint),
    true,
  );
});

test("rejects a valid self-signed key when the account identity does not match", async () => {
  const { bundle, fingerprint, deviceId } = await createBundle();
  assert.equal(
    await verifyTrustedLocationKeyBundle(bundle, "different-contact", deviceId, fingerprint),
    false,
  );
});

test("rejects a valid self-signed key when the independent fingerprint differs", async () => {
  const { bundle, deviceId } = await createBundle();
  const other = await createBundle();
  assert.equal(
    await verifyTrustedLocationKeyBundle(bundle, "trusted-contact", deviceId, other.fingerprint),
    false,
  );
});

test("rejects malformed fingerprints and altered signatures", async () => {
  const { bundle, fingerprint, deviceId } = await createBundle();
  assert.equal(await verifyTrustedLocationKeyBundle(bundle, "trusted-contact", deviceId, "not-a-fingerprint"), false);
  const altered = new Uint8Array(bundle.signature);
  altered[0] ^= 1;
  assert.equal(
    await verifyTrustedLocationKeyBundle({ ...bundle, signature: altered }, "trusted-contact", deviceId, fingerprint),
    false,
  );
});

test("rejects a key bundle from a different device of the same account", async () => {
  const { bundle, fingerprint } = await createBundle("trusted-contact", "device-a");
  assert.equal(
    await verifyTrustedLocationKeyBundle(bundle, "trusted-contact", "device-b", fingerprint),
    false,
  );
});

test("verifies a relayed key bundle only against the local device's pinned fingerprint", async () => {
  const { bundle, fingerprint } = await createBundle("trusted-contact", "contact-device");
  const store = new MemoryPinStore();
  await pinTrustedLocationFingerprint({
    accountId: "local-account",
    deviceId: "local-device",
    contactAccountId: "trusted-contact",
    contactDeviceId: "contact-device",
    fingerprint,
    confirmedByIndependentChannel: true,
  }, store);

  assert.equal(
    await verifyPinnedTrustedLocationKeyBundle(bundle, "local-account", "local-device", store),
    true,
  );
  assert.equal(
    await verifyPinnedTrustedLocationKeyBundle(bundle, "other-account", "local-device", store),
    false,
  );
});

test("refuses a relayed key bundle when no fingerprint has been pinned", async () => {
  const { bundle } = await createBundle("trusted-contact", "contact-device");
  assert.equal(
    await verifyPinnedTrustedLocationKeyBundle(bundle, "local-account", "local-device", new MemoryPinStore()),
    false,
  );
});
