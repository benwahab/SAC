import assert from "node:assert/strict";
import { createPublicKey, verify } from "node:crypto";
import test from "node:test";

const P256_ORDER = BigInt(
  "0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",
);
const PUBLIC_JWK = {
  kty: "EC",
  crv: "P-256",
  x: "YP7UuiVanTHJYet0xjVtaMBJuJI7Yfps5mliLmDyn7Y",
  y: "eQP-EAi4vJmkGunpVii8ZPLxsgwtfp9Rd6PClNRGIpk",
  ext: true,
  key_ops: ["verify"],
};
const RFC_RAW_HEX =
  "EFD48B2AACB6A8FD1140DD9CD45E81D69D2C877B56AAF991C34D0EA84EAF3716" +
  "F7CB1C942D657C41D436C7A1B6E29F65F3E900DBB9AFF4064DC4AB2F843ACDA8";

function fromHex(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

function toBigInt(bytes: Uint8Array): bigint {
  return BigInt("0x" + Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""));
}

function assertScalar(value: Uint8Array): void {
  const n = toBigInt(value);
  if (n < 1n || n >= P256_ORDER) throw new Error("ecdsa_der_invalid:scalar_range");
}

function encodeInteger(value: Uint8Array): Uint8Array {
  let start = 0;
  while (start < value.length - 1 && value[start] === 0) start += 1;
  let bytes = value.slice(start);
  if ((bytes[0] & 0x80) !== 0) {
    const padded = new Uint8Array(bytes.length + 1);
    padded.set(bytes, 1);
    bytes = padded;
  }
  const result = new Uint8Array(bytes.length + 2);
  result[0] = 0x02;
  result[1] = bytes.length;
  result.set(bytes, 2);
  return result;
}

/** Test-only strict adapter: 64-byte P1363 r||s to minimal DER. */
function rawToDer(raw: Uint8Array): Uint8Array {
  if (raw.length !== 64) throw new Error("ecdsa_raw_invalid:length");
  const r = raw.slice(0, 32);
  const s = raw.slice(32, 64);
  assertScalar(r);
  assertScalar(s);
  const ri = encodeInteger(r);
  const si = encodeInteger(s);
  const body = new Uint8Array(ri.length + si.length);
  body.set(ri);
  body.set(si, ri.length);
  if (body.length >= 128) throw new Error("ecdsa_der_invalid:length");
  const result = new Uint8Array(body.length + 2);
  result[0] = 0x30;
  result[1] = body.length;
  result.set(body, 2);
  return result;
}

/** Test-only strict adapter: minimal DER ECDSA sequence to fixed-width P1363. */
function derToRaw(der: Uint8Array): Uint8Array {
  if (der.length < 8 || der[0] !== 0x30) throw new Error("ecdsa_der_invalid:sequence");
  if ((der[1] & 0x80) !== 0 || der[1] !== der.length - 2) {
    throw new Error("ecdsa_der_invalid:sequence_length");
  }

  let offset = 2;
  const readInteger = (): Uint8Array => {
    if (der[offset] !== 0x02) throw new Error("ecdsa_der_invalid:integer_tag");
    const length = der[offset + 1];
    offset += 2;
    if (!length || offset + length > der.length) {
      throw new Error("ecdsa_der_invalid:integer_length");
    }
    const encoded = der.slice(offset, offset + length);
    offset += length;
    if ((encoded[0] & 0x80) !== 0) throw new Error("ecdsa_der_invalid:negative_integer");
    if (
      encoded.length > 1 &&
      encoded[0] === 0 &&
      (encoded[1] & 0x80) === 0
    ) {
      throw new Error("ecdsa_der_invalid:non_minimal_integer");
    }
    const significant = encoded[0] === 0 ? encoded.slice(1) : encoded;
    if (significant.length > 32) throw new Error("ecdsa_der_invalid:integer_overflow");
    const fixed = new Uint8Array(32);
    fixed.set(significant, 32 - significant.length);
    assertScalar(fixed);
    return fixed;
  };

  const r = readInteger();
  const s = readInteger();
  if (offset !== der.length) throw new Error("ecdsa_der_invalid:trailing_data");
  const raw = new Uint8Array(64);
  raw.set(r);
  raw.set(s, 32);
  return raw;
}

test("P1363/DER adapters round-trip the RFC 6979 P-256 signature", () => {
  const raw = fromHex(RFC_RAW_HEX);
  const der = rawToDer(raw);
  assert.equal(raw.length, 64);
  assert.equal(der[0], 0x30);
  assert.deepEqual(derToRaw(der), raw);
});

test("the DER form verifies with Node's independent ECDSA verifier", () => {
  const publicKey = createPublicKey({ key: PUBLIC_JWK, format: "jwk" });
  const der = rawToDer(fromHex(RFC_RAW_HEX));
  assert.equal(
    verify("sha256", Buffer.from("sample"), { key: publicKey, dsaEncoding: "der" }, der),
    true,
  );
});

test("DER parser rejects negative, zero, non-minimal and trailing encodings", () => {
  const invalid = [
    [0x30, 0x06, 0x02, 0x01, 0x80, 0x02, 0x01, 0x01],
    [0x30, 0x06, 0x02, 0x01, 0x00, 0x02, 0x01, 0x01],
    [0x30, 0x07, 0x02, 0x02, 0x00, 0x01, 0x02, 0x01, 0x01],
    [0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01, 0x00],
    [0x30, 0x81, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01],
  ];
  for (const bytes of invalid) {
    assert.throws(() => derToRaw(Uint8Array.from(bytes)));
  }
});

test("P1363 encoder rejects wrong lengths and out-of-range scalars", () => {
  assert.throws(() => rawToDer(new Uint8Array(63)));
  const invalid = new Uint8Array(64);
  invalid.set(fromHex(P256_ORDER.toString(16).padStart(64, "0")));
  invalid[63] = 1;
  assert.throws(() => rawToDer(invalid));
});
