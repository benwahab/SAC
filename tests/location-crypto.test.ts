import assert from "node:assert/strict";
import test from "node:test";
import {
  createLocationSessionKey,
  decryptLocationPayload,
  encryptLocationPayload,
} from "../src/services/location/crypto.ts";

test("la clé de session AES-GCM est non exportable", async () => {
  const key = await createLocationSessionKey();
  assert.equal(key.algorithm.name, "AES-GCM");
  assert.equal((key.algorithm as AesKeyAlgorithm).length, 256);
  assert.equal(key.extractable, false);
});

test("un paquet chiffré est déchiffrable avec la bonne clé et la bonne session", async () => {
  const key = await createLocationSessionKey();
  const packet = await encryptLocationPayload("opaque-test-payload", key, "session-test-1");

  assert.equal(
    await decryptLocationPayload(packet, key, "session-test-1"),
    "opaque-test-payload",
  );
});

test("une session différente ne peut pas authentifier le paquet", async () => {
  const key = await createLocationSessionKey();
  const packet = await encryptLocationPayload("opaque-test-payload", key, "session-test-1");

  await assert.rejects(
    decryptLocationPayload(packet, key, "session-test-2"),
  );
});

test("une modification du ciphertext est détectée", async () => {
  const key = await createLocationSessionKey();
  const packet = await encryptLocationPayload("opaque-test-payload", key, "session-test-1");
  const altered = new Uint8Array(packet.ciphertext);
  altered[0] ^= 1;

  await assert.rejects(
    decryptLocationPayload(
      { ...packet, ciphertext: altered },
      key,
      "session-test-1",
    ),
  );
});

test("chaque chiffrement génère un vecteur d'initialisation distinct", async () => {
  const key = await createLocationSessionKey();
  const first = await encryptLocationPayload("first", key, "session-test-1");
  const second = await encryptLocationPayload("second", key, "session-test-1");

  assert.equal(first.iv.byteLength, 12);
  assert.equal(second.iv.byteLength, 12);
  assert.notDeepEqual(first.iv, second.iv);
});

test("un identifiant de session vide est refusé", async () => {
  const key = await createLocationSessionKey();

  await assert.rejects(
    encryptLocationPayload("opaque-test-payload", key, " "),
    /identifiant de session est obligatoire/,
  );
});

test("une clé de session différente ne peut pas déchiffrer le paquet", async () => {
  const senderKey = await createLocationSessionKey();
  const unrelatedKey = await createLocationSessionKey();
  const packet = await encryptLocationPayload(
    "opaque-test-payload",
    senderKey,
    "session-test-1",
  );

  await assert.rejects(
    decryptLocationPayload(packet, unrelatedKey, "session-test-1"),
  );
});

test("une modification du vecteur d'initialisation est détectée", async () => {
  const key = await createLocationSessionKey();
  const packet = await encryptLocationPayload(
    "opaque-test-payload",
    key,
    "session-test-1",
  );
  const alteredIv = new Uint8Array(packet.iv);
  alteredIv[0] ^= 1;

  await assert.rejects(
    decryptLocationPayload(
      { ...packet, iv: alteredIv },
      key,
      "session-test-1",
    ),
  );
});

test("un paquet avec un IV de longueur incorrecte est refusé avant déchiffrement", async () => {
  const key = await createLocationSessionKey();
  const packet = await encryptLocationPayload(
    "opaque-test-payload",
    key,
    "session-test-1",
  );

  await assert.rejects(
    decryptLocationPayload(
      { ...packet, iv: new Uint8Array(8) },
      key,
      "session-test-1",
    ),
    /Paquet de localisation invalide/,
  );
});

import {
  createLocationExchangeKeyPair,
  deriveLocationRecipientKey,
} from "../src/services/location/key-exchange.ts";

test("ECDH établit la même clé AES-GCM non exportable sur les deux appareils", async () => {
  const alice = await createLocationExchangeKeyPair();
  const bob = await createLocationExchangeKeyPair();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(32));

  const aliceKey = await deriveLocationRecipientKey(
    alice.privateKey, bob.publicKey, salt, "session-1", "bob",
  );
  const bobKey = await deriveLocationRecipientKey(
    bob.privateKey, alice.publicKey, salt, "session-1", "bob",
  );

  assert.equal(alice.privateKey.extractable, false);
  assert.equal(bob.privateKey.extractable, false);
  assert.equal(aliceKey.extractable, false);
  assert.equal(bobKey.extractable, false);

  const packet = await encryptLocationPayload("position-test", aliceKey, "session-1");
  assert.equal(await decryptLocationPayload(packet, bobKey, "session-1"), "position-test");
});

test("la clé dérivée est liée à l'identifiant du destinataire", async () => {
  const alice = await createLocationExchangeKeyPair();
  const bob = await createLocationExchangeKeyPair();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(32));

  const bobKey = await deriveLocationRecipientKey(
    alice.privateKey, bob.publicKey, salt, "session-1", "bob",
  );
  const otherRecipientKey = await deriveLocationRecipientKey(
    alice.privateKey, bob.publicKey, salt, "session-1", "other-contact",
  );
  const packet = await encryptLocationPayload("position-test", bobKey, "session-1");

  await assert.rejects(decryptLocationPayload(packet, otherRecipientKey, "session-1"));
});

test("ECDH refuse un sel de dérivation de longueur incorrecte", async () => {
  const alice = await createLocationExchangeKeyPair();
  const bob = await createLocationExchangeKeyPair();

  await assert.rejects(
    deriveLocationRecipientKey(
      alice.privateKey, bob.publicKey, new Uint8Array(8), "session-1", "bob",
    ),
    /32 octets/,
  );
});
