import assert from "node:assert/strict";
import test from "node:test";
import {
  isCanonicalP256Coordinate,
  isCanonicalP256PublicJwk,
} from "../src/services/crypto/p256-jwk.ts";

// These tests protect the exact base64url representation used by public-key fingerprints.
const vectorJwk: JsonWebKey = {
  kty: "EC",
  crv: "P-256",
  x: "YP7UuiVanTHJYet0xjVtaMBJuJI7Yfps5mliLmDyn7Y",
  y: "eQP-EAi4vJmkGunpVii8ZPLxsgwtfp9Rd6PClNRGIpk",
};

test("les coordonnées P-256 RFC sont des base64url canoniques de 32 octets", () => {
  assert.equal(isCanonicalP256Coordinate(vectorJwk.x), true);
  assert.equal(isCanonicalP256Coordinate(vectorJwk.y), true);
  assert.equal(isCanonicalP256PublicJwk(vectorJwk), true);
});

test("les bits de remplissage base64url non nuls sont rejetés", () => {
  assert.equal(isCanonicalP256Coordinate(vectorJwk.x!.slice(0, -1) + "Z"), false);
  assert.equal(isCanonicalP256Coordinate(vectorJwk.y!.slice(0, -1) + "l"), false);
});

test("les longueurs incorrectes, padding et alphabets non base64url sont rejetés", () => {
  assert.equal(isCanonicalP256Coordinate(vectorJwk.x!.slice(0, -1)), false);
  assert.equal(isCanonicalP256Coordinate(vectorJwk.x + "="), false);
  assert.equal(isCanonicalP256Coordinate("A".repeat(42) + "+"), false);
  assert.equal(isCanonicalP256Coordinate(null), false);
});

test("les clés privées et les coordonnées absentes sont rejetées", () => {
  assert.equal(isCanonicalP256PublicJwk({ ...vectorJwk, d: "secret" }), false);
  assert.equal(isCanonicalP256PublicJwk({ ...vectorJwk, x: undefined }), false);
  assert.equal(isCanonicalP256PublicJwk({ ...vectorJwk, kty: "RSA" }), false);
});

test("les JWK publics exportés par Web Crypto restent acceptés", async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  assert.equal(isCanonicalP256PublicJwk(jwk), true);
});
