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
