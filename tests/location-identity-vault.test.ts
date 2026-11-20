import assert from "node:assert/strict";
import test from "node:test";
import {
  getOrCreateLocationIdentityKeyPair,
  getPinnedTrustedLocationFingerprint,
  pinTrustedLocationFingerprint,
  type LocationIdentityKeyRecord,
  type LocationIdentityKeyStore,
} from "../src/services/location/identity-vault.ts";

class MemoryLocationIdentityKeyStore implements LocationIdentityKeyStore {
  private readonly records = new Map<string, LocationIdentityKeyRecord>();

  async get(storageKey: string): Promise<LocationIdentityKeyRecord | null> {
    return this.records.get(storageKey) ?? null;
  }

  async add(record: LocationIdentityKeyRecord): Promise<void> {
    if (this.records.has(record.storageKey)) {
      throw new Error("ConstraintError");
    }
    this.records.set(record.storageKey, record);
  }

  async put(record: LocationIdentityKeyRecord): Promise<void> {
    this.records.set(record.storageKey, record);
  }
}

test("creates and reuses a non-exportable signing identity key for one account", async () => {
  const store = new MemoryLocationIdentityKeyStore();
  const first = await getOrCreateLocationIdentityKeyPair("account-a", "device-a", store);
  const second = await getOrCreateLocationIdentityKeyPair("account-a", "device-a", store);

  assert.equal(first.privateKey.type, "private");
  assert.equal(first.privateKey.extractable, false);
  assert.equal(first.privateKey.algorithm.name, "ECDSA");
  assert.equal((first.privateKey.algorithm as EcKeyAlgorithm).namedCurve, "P-256");
  assert.deepEqual(first.privateKey.usages, ["sign"]);
  assert.equal(first.publicKey.type, "public");
  assert.deepEqual(first.publicKey.usages, ["verify"]);
  assert.equal(first.publicJwk.kty, "EC");
  assert.equal(first.publicJwk.crv, "P-256");
  assert.equal(first.accountId, "account-a");
  assert.equal(first.deviceId, "device-a");
  assert.equal(second.privateKey, first.privateKey);
  assert.equal(second.publicKey, first.publicKey);
});

test("keeps identity keys isolated between accounts", async () => {
  const store = new MemoryLocationIdentityKeyStore();
  const a = await getOrCreateLocationIdentityKeyPair("account-a", "device-a", store);
  const b = await getOrCreateLocationIdentityKeyPair("account-b", "device-a", store);

  assert.notDeepEqual(a.publicJwk, b.publicJwk);
  assert.notEqual(a.privateKey, b.privateKey);
});

test("handles concurrent first-use races by returning the one stored key", async () => {
  const store = new MemoryLocationIdentityKeyStore();
  const [a, b] = await Promise.all([
    getOrCreateLocationIdentityKeyPair("account-race", "device-a", store),
    getOrCreateLocationIdentityKeyPair("account-race", "device-a", store),
  ]);

  assert.deepEqual(a.publicJwk, b.publicJwk);
  assert.equal(a.privateKey, b.privateKey);
});

test("rejects an invalid account identifier before touching storage", async () => {
  let called = false;
  const store: LocationIdentityKeyStore = {
    async get() { called = true; return null; },
    async add() { called = true; },
  };

  await assert.rejects(
    getOrCreateLocationIdentityKeyPair(" ", "device-a", store),
    /identifiant du compte/,
  );
  assert.equal(called, false);
});

test("does not silently replace a corrupt stored key record", async () => {
  const store = new MemoryLocationIdentityKeyStore();
  await store.add({
    version: 1,
    accountId: "account-corrupt",
    deviceId: "device-corrupt",
    storageKey: "account-corrupt:device-corrupt",
    privateKey: {} as CryptoKey,
    publicKey: {} as CryptoKey,
    publicJwk: {},
    pinnedContactFingerprints: {},
    createdAt: Date.now(),
  });

  await assert.rejects(
    getOrCreateLocationIdentityKeyPair("account-corrupt", "device-corrupt", store),
    /clé d'identité locale est invalide/,
  );
});

test("keeps different device identities separate for the same account", async () => {
  const store = new MemoryLocationIdentityKeyStore();
  const first = await getOrCreateLocationIdentityKeyPair("account-a", "device-a", store);
  const second = await getOrCreateLocationIdentityKeyPair("account-a", "device-b", store);

  assert.notDeepEqual(first.publicJwk, second.publicJwk);
  assert.notEqual(first.privateKey, second.privateKey);
});


test("stores a contact fingerprint locally only after independent comparison", async () => {
  const store = new MemoryLocationIdentityKeyStore();
  const fingerprint = "ABCD ".repeat(15) + "ABCD";
  await pinTrustedLocationFingerprint({
    accountId: "owner",
    deviceId: "owner-device",
    contactAccountId: "contact",
    contactDeviceId: "contact-device",
    fingerprint,
    confirmedByIndependentChannel: true,
  }, store);
  assert.equal(
    await getPinnedTrustedLocationFingerprint("owner", "owner-device", "contact", "contact-device", store),
    fingerprint,
  );
});

test("refuses to pin a fingerprint without independent confirmation", async () => {
  const store = new MemoryLocationIdentityKeyStore();
  await assert.rejects(
    pinTrustedLocationFingerprint({
      accountId: "owner",
      deviceId: "owner-device",
      contactAccountId: "contact",
      contactDeviceId: "contact-device",
      fingerprint: "ABCD ".repeat(15) + "ABCD",
      confirmedByIndependentChannel: false as never,
    }, store),
    /vérification indépendante/,
  );
  assert.equal(await store.get("owner:owner-device"), null);
});

test("does not silently replace a previously pinned device fingerprint", async () => {
  const store = new MemoryLocationIdentityKeyStore();
  const first = "ABCD ".repeat(15) + "ABCD";
  const second = "1234 ".repeat(15) + "1234";
  await pinTrustedLocationFingerprint({
    accountId: "owner", deviceId: "owner-device",
    contactAccountId: "contact", contactDeviceId: "contact-device",
    fingerprint: first, confirmedByIndependentChannel: true,
  }, store);
  await assert.rejects(
    pinTrustedLocationFingerprint({
      accountId: "owner", deviceId: "owner-device",
      contactAccountId: "contact", contactDeviceId: "contact-device",
      fingerprint: second, confirmedByIndependentChannel: true,
    }, store),
    /déjà épinglée/,
  );
  assert.equal(
    await getPinnedTrustedLocationFingerprint("owner", "owner-device", "contact", "contact-device", store),
    first,
  );
});
