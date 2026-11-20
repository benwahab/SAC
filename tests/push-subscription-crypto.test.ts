import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptPushSubscription,
  encryptPushSubscription,
  type PushSubscriptionPayload,
} from "../functions/lib/notifications/push-subscription-crypto.ts";

function secretFromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

const secret = secretFromBytes(Uint8Array.from({ length: 32 }, (_, index) => index + 1));
const payload: PushSubscriptionPayload = {
  endpoint: "https://push.example.test/subscription/private-token",
  keys: {
    p256dh: "B".repeat(87),
    auth: "A".repeat(22),
  },
};

test("les abonnements push sont chiffrés et déchiffrables avec le secret prévu", async () => {
  const encrypted = await encryptPushSubscription(payload, secret);
  assert.ok(encrypted);
  assert.match(encrypted.endpointHash, /^[a-f0-9]{64}$/);
  assert.equal(encrypted.iv.length, 16);
  assert.equal(encrypted.ciphertext.includes(payload.endpoint), false);
  assert.deepEqual(await decryptPushSubscription(encrypted, secret), payload);
});

test("un chiffrement renouvelle l'IV sans changer l'empreinte de l'endpoint", async () => {
  const first = await encryptPushSubscription(payload, secret);
  const second = await encryptPushSubscription(payload, secret);
  assert.ok(first && second);
  assert.equal(first.endpointHash, second.endpointHash);
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test("un secret différent ou un ciphertext altéré ne permet pas le déchiffrement", async () => {
  const encrypted = await encryptPushSubscription(payload, secret);
  assert.ok(encrypted);
  const otherSecret = secretFromBytes(Uint8Array.from({ length: 32 }, (_, index) => 255 - index));
  assert.equal(await decryptPushSubscription(encrypted, otherSecret), null);
  const altered = { ...encrypted, ciphertext: (encrypted.ciphertext.startsWith("A") ? "B" : "A") + encrypted.ciphertext.slice(1) };
  assert.equal(await decryptPushSubscription(altered, secret), null);
  const alteredFingerprint = { ...encrypted, endpointHash: "f".repeat(64) };
  assert.equal(await decryptPushSubscription(alteredFingerprint, secret), null);
});

test("un secret absent ou de taille incorrecte échoue sans stockage", async () => {
  assert.equal(await encryptPushSubscription(payload, undefined), null);
  assert.equal(await encryptPushSubscription(payload, "short"), null);
});

test("un payload endpoint trop long est refusé", async () => {
  assert.equal(
    await encryptPushSubscription({ ...payload, endpoint: "https://example.test/" + "x".repeat(2050) }, secret),
    null,
  );
});
