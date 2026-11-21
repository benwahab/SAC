import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import {
  hashAccountPassword,
  verifyAccountPassword,
} from "../functions/lib/security/password-hash.ts";

const cryptoProvider = webcrypto as unknown as Crypto;

test("hachage PBKDF2 conserve les paramètres et un sel aléatoire", async () => {
  const first = await hashAccountPassword(cryptoProvider, "une phrase de passe très longue 🔐");
  const second = await hashAccountPassword(cryptoProvider, "une phrase de passe très longue 🔐");
  assert.match(first, /^pbkdf2-sha256\$100000\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.notEqual(first, second);
});

test("vérifie le bon mot de passe et refuse un mot de passe différent", async () => {
  const encoded = await hashAccountPassword(cryptoProvider, "correct horse battery staple");
  assert.equal(await verifyAccountPassword(cryptoProvider, "correct horse battery staple", encoded), true);
  assert.equal(await verifyAccountPassword(cryptoProvider, "incorrect horse battery staple", encoded), false);
});

test("refuse un hash mal formé ou des paramètres inattendus", async () => {
  assert.equal(await verifyAccountPassword(cryptoProvider, "password", "sha256$1$bad$bad"), false);
  assert.equal(await verifyAccountPassword(cryptoProvider, "password", "pbkdf2-sha256$1$bad$bad"), false);
});

test("refuse les vérificateurs surdimensionnés et les entrées de vérification non textuelles", async () => {
  const encoded = await hashAccountPassword(cryptoProvider, "une phrase de passe valide");
  assert.equal(await verifyAccountPassword(cryptoProvider, "une phrase de passe valide", "x".repeat(257)), false);
  assert.equal(await verifyAccountPassword(cryptoProvider, "une phrase de passe valide", encoded + "$extra"), false);
  assert.equal(await verifyAccountPassword(cryptoProvider, "", encoded), false);
  assert.equal(await verifyAccountPassword(cryptoProvider, "une phrase de passe valide", null as never), false);
  assert.equal(await verifyAccountPassword(cryptoProvider, "une phrase de passe valide", 42 as never), false);
  assert.equal(await verifyAccountPassword(cryptoProvider, null as never, encoded), false);
});
