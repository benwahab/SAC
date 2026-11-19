import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { createSessionToken, hashSessionToken } from "../functions/lib/security/session-token.ts";

const cryptoProvider = webcrypto as unknown as Crypto;

test("crée un jeton opaque canonique de 256 bits et une empreinte hexadécimale", async () => {
  const result = await createSessionToken(cryptoProvider);
  assert.match(result.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(result.token, /[AQgw]$/);
  assert.match(result.tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(await hashSessionToken(cryptoProvider, result.token), result.tokenHash);
});

test("deux créations indépendantes produisent des jetons et empreintes distincts", async () => {
  const first = await createSessionToken(cryptoProvider);
  const second = await createSessionToken(cryptoProvider);
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.tokenHash, second.tokenHash);
});

test("le jeton brut n'est pas l'empreinte persistable", async () => {
  const result = await createSessionToken(cryptoProvider);
  assert.notEqual(result.token, result.tokenHash);
  assert.equal(result.token.length, 43);
  assert.equal(result.tokenHash.length, 64);
});

test("refuse les jetons malformés et les encodages Base64URL non canoniques", async () => {
  for (const token of [
    "",
    "x",
    "a".repeat(42),
    "a".repeat(44),
    "a".repeat(42) + "B",
    "a".repeat(42) + "=",
    "a".repeat(42) + "!",
    null as never,
    123 as never,
  ]) {
    assert.equal(await hashSessionToken(cryptoProvider, token), null);
  }
});

test("l'empreinte est liée au domaine de session et au jeton exact", async () => {
  const first = await createSessionToken(cryptoProvider);
  const changed = first.token.slice(0, -1) + (first.token.endsWith("A") ? "Q" : "A");
  assert.notEqual(await hashSessionToken(cryptoProvider, first.token), await hashSessionToken(cryptoProvider, changed));
});
