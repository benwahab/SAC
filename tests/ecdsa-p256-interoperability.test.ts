import assert from "node:assert/strict";
import test from "node:test";

// RFC 6979 vectors are verification fixtures; ECDSA signatures are not byte-deterministic by default.
const P256_ORDER = BigInt(
  "0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",
);
const RFC6979_PUBLIC_JWK: JsonWebKey = {
  kty: "EC",
  crv: "P-256",
  x: "YP7UuiVanTHJYet0xjVtaMBJuJI7Yfps5mliLmDyn7Y",
  y: "eQP-EAi4vJmkGunpVii8ZPLxsgwtfp9Rd6PClNRGIpk",
  ext: true,
  key_ops: ["verify"],
};
const RFC6979_HIGH_S =
  "EFD48B2AACB6A8FD1140DD9CD45E81D69D2C877B56AAF991C34D0EA84EAF3716" +
  "F7CB1C942D657C41D436C7A1B6E29F65F3E900DBB9AFF4064DC4AB2F843ACDA8";
const RFC6979_LOW_S =
  "EFD48B2AACB6A8FD1140DD9CD45E81D69D2C877B56AAF991C34D0EA84EAF3716" +
  "0834E36AD29A83BF2BC9385E491D6099C8FDF9D1ED67AA7EA5F51F93782857A9";

function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

function toBigInt(bytes: Uint8Array): bigint {
  return BigInt("0x" + Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""));
}

test("RFC 6979 P-256 SHA-256 vector verifies as fixed-width raw r||s", async () => {
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    RFC6979_PUBLIC_JWK,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const signature = fromHex(RFC6979_HIGH_S);
  assert.equal(signature.length, 64);
  assert.equal(
    await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      signature,
      new TextEncoder().encode("sample"),
    ),
    true,
  );
});

test("Web Crypto accepts the mathematically equivalent low-S form too", async () => {
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    RFC6979_PUBLIC_JWK,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const high = fromHex(RFC6979_HIGH_S);
  const low = fromHex(RFC6979_LOW_S);
  const highS = toBigInt(high.slice(32));
  const lowS = toBigInt(low.slice(32));
  assert.ok(highS > P256_ORDER / 2n);
  assert.ok(lowS <= P256_ORDER / 2n);
  assert.equal(
    await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      low,
      new TextEncoder().encode("sample"),
    ),
    true,
  );
});

test("Web Crypto P-256 signing emits a 64-byte raw signature", async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"],
  );
  const message = new TextEncoder().encode("SAC ECDSA P-256 format test");
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    pair.privateKey,
    message,
  ));
  assert.equal(signature.length, 64);
  assert.equal(
    await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pair.publicKey,
      signature,
      message,
    ),
    true,
  );
});
