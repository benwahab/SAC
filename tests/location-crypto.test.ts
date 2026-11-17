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

import {
  createLocationIdentityKeyPair,
  signLocationKeyBundleWithPublicKey,
  verifyLocationKeyBundle,
} from "../src/services/location/key-exchange.ts";

test("une clé ECDH signée est vérifiée avec la clé publique d'identité", async () => {
  const contactExchange = await createLocationExchangeKeyPair();
  const identity = await createLocationIdentityKeyPair();
  const bundle = await signLocationKeyBundleWithPublicKey(
    "contact-bob",
    contactExchange.publicKey,
    identity.privateKey,
    identity.publicKey,
  );

  assert.equal(identity.privateKey.extractable, false);
  assert.equal(await verifyLocationKeyBundle(bundle), true);
});

test("une modification de l'identité déclarée invalide la signature", async () => {
  const exchange = await createLocationExchangeKeyPair();
  const identity = await createLocationIdentityKeyPair();
  const bundle = await signLocationKeyBundleWithPublicKey(
    "contact-bob", exchange.publicKey, identity.privateKey, identity.publicKey,
  );

  assert.equal(
    await verifyLocationKeyBundle({ ...bundle, ownerId: "contact-eve" }),
    false,
  );
});

test("une substitution de clé ECDH invalide la signature du contact", async () => {
  const exchange = await createLocationExchangeKeyPair();
  const substituted = await createLocationExchangeKeyPair();
  const identity = await createLocationIdentityKeyPair();
  const bundle = await signLocationKeyBundleWithPublicKey(
    "contact-bob", exchange.publicKey, identity.privateKey, identity.publicKey,
  );

  assert.equal(
    await verifyLocationKeyBundle({
      ...bundle,
      exchangePublicKey: await globalThis.crypto.subtle.exportKey("jwk", substituted.publicKey),
    }),
    false,
  );
});

import { fingerprintLocationIdentityKey } from "../src/services/location/key-exchange.ts";

test("l'empreinte de la clé d'identité est stable et indépendante du serveur", async () => {
  const identity = await createLocationIdentityKeyPair();
  const jwk = await globalThis.crypto.subtle.exportKey("jwk", identity.publicKey);
  const first = await fingerprintLocationIdentityKey(jwk);
  const second = await fingerprintLocationIdentityKey({ ...jwk });

  assert.equal(first, second);
  assert.match(first, /^(?:[0-9A-F]{4})(?: [0-9A-F]{4}){15}$/);
});

test("une autre clé d'identité produit une empreinte différente", async () => {
  const firstIdentity = await createLocationIdentityKeyPair();
  const secondIdentity = await createLocationIdentityKeyPair();
  const firstJwk = await globalThis.crypto.subtle.exportKey("jwk", firstIdentity.publicKey);
  const secondJwk = await globalThis.crypto.subtle.exportKey("jwk", secondIdentity.publicKey);

  assert.notEqual(
    await fingerprintLocationIdentityKey(firstJwk),
    await fingerprintLocationIdentityKey(secondJwk),
  );
});

test("l'empreinte refuse une clé d'identité qui n'est pas P-256", async () => {
  await assert.rejects(
    fingerprintLocationIdentityKey({ kty: "RSA", crv: "P-256", x: "x", y: "y" }),
    /invalide/,
  );
});


test("les contextes HKDF ne présentent pas de collision avec des identifiants contenant des séparateurs", async () => {
  const alice = await createLocationExchangeKeyPair();
  const bob = await createLocationExchangeKeyPair();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(32));

  const firstContextKey = await deriveLocationRecipientKey(
    alice.privateKey, bob.publicKey, salt, "a:b", "c",
  );
  const secondContextKey = await deriveLocationRecipientKey(
    alice.privateKey, bob.publicKey, salt, "a", "b:c",
  );
  const packet = await encryptLocationPayload("context-bound", firstContextKey, "a:b");

  await assert.rejects(
    decryptLocationPayload(packet, secondContextKey, "a:b"),
  );
});

test("la signature refuse une clé privée et une clé publique d'identité qui ne correspondent pas", async () => {
  const exchange = await createLocationExchangeKeyPair();
  const identityA = await createLocationIdentityKeyPair();
  const identityB = await createLocationIdentityKeyPair();

  await assert.rejects(
    signLocationKeyBundleWithPublicKey(
      "contact-bob",
      exchange.publicKey,
      identityA.privateKey,
      identityB.publicKey,
    ),
    /ne correspond pas/,
  );
});

test("la vérification d'un bundle mal formé retourne false sans lever d'exception", async () => {
  assert.equal(await verifyLocationKeyBundle(null as never), false);
  assert.equal(
    await verifyLocationKeyBundle({ version: 1, ownerId: "bob", identityPublicKey: null, exchangePublicKey: {}, signature: new Uint8Array(64) } as never),
    false,
  );

  const exchange = await createLocationExchangeKeyPair();
  const identity = await createLocationIdentityKeyPair();
  const bundle = await signLocationKeyBundleWithPublicKey(
    "contact-bob", exchange.publicKey, identity.privateKey, identity.publicKey,
  );

  assert.equal(
    await verifyLocationKeyBundle({ ...bundle, signature: new Uint8Array(8) }),
    false,
  );
});

test("un bundle ne peut pas embarquer une clé privée dans son JWK public", async () => {
  const exchange = await createLocationExchangeKeyPair();
  const identity = await createLocationIdentityKeyPair();
  const bundle = await signLocationKeyBundleWithPublicKey(
    "contact-bob", exchange.publicKey, identity.privateKey, identity.publicKey,
  );
  const identityJwk = await globalThis.crypto.subtle.exportKey("jwk", identity.publicKey);

  assert.equal(
    await verifyLocationKeyBundle({
      ...bundle,
      identityPublicKey: { ...identityJwk, d: "private-material-must-never-be-here" },
    }),
    false,
  );
});

test("les identifiants de contexte avec caractères de contrôle sont refusés", async () => {
  const alice = await createLocationExchangeKeyPair();
  const bob = await createLocationExchangeKeyPair();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(32));

  await assert.rejects(
    deriveLocationRecipientKey(
      alice.privateKey, bob.publicKey, salt, "session\nforged", "bob",
    ),
    /contexte/,
  );
});


test("l'empreinte refuse un JWK contenant du matériel privé", async () => {
  const identity = await createLocationIdentityKeyPair();
  const jwk = await globalThis.crypto.subtle.exportKey("jwk", identity.publicKey);

  assert.equal(
    await fingerprintLocationIdentityKey({ ...jwk, d: "private-material" }),
    await assert.rejects(
      fingerprintLocationIdentityKey({ ...jwk, d: "private-material" }),
    ).then(() => "rejected"),
  );
});
