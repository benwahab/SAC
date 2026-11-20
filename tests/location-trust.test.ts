import assert from "node:assert/strict";
import test from "node:test";
import {
  createLocationExchangeKeyPair,
  createLocationIdentityKeyPair,
  fingerprintLocationIdentityKey,
  signLocationKeyBundleWithPublicKey,
  verifyTrustedLocationKeyBundle,
} from "../src/services/location/key-exchange.ts";

async function createBundle(ownerId = "trusted-contact") {
  const identity = await createLocationIdentityKeyPair();
  const exchange = await createLocationExchangeKeyPair();
  const bundle = await signLocationKeyBundleWithPublicKey(
    ownerId,
    exchange.publicKey,
    identity.privateKey,
    identity.publicKey,
  );
  const fingerprint = await fingerprintLocationIdentityKey(bundle.identityPublicKey);
  return { bundle, fingerprint };
}

test("accepts a signed contact key only when its independently pinned fingerprint matches", async () => {
  const { bundle, fingerprint } = await createBundle();
  assert.equal(
    await verifyTrustedLocationKeyBundle(bundle, "trusted-contact", fingerprint),
    true,
  );
});

test("rejects a valid self-signed key when the account identity does not match", async () => {
  const { bundle, fingerprint } = await createBundle();
  assert.equal(
    await verifyTrustedLocationKeyBundle(bundle, "different-contact", fingerprint),
    false,
  );
});

test("rejects a valid self-signed key when the independent fingerprint differs", async () => {
  const { bundle } = await createBundle();
  const other = await createBundle();
  assert.equal(
    await verifyTrustedLocationKeyBundle(bundle, "trusted-contact", other.fingerprint),
    false,
  );
});

test("rejects malformed fingerprints and altered signatures", async () => {
  const { bundle, fingerprint } = await createBundle();
  assert.equal(await verifyTrustedLocationKeyBundle(bundle, "trusted-contact", "not-a-fingerprint"), false);
  const altered = new Uint8Array(bundle.signature);
  altered[0] ^= 1;
  assert.equal(
    await verifyTrustedLocationKeyBundle({ ...bundle, signature: altered }, "trusted-contact", fingerprint),
    false,
  );
});
