import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { verifyRootRegistrationResponse } from "../functions/lib/security/webauthn-root-verifier.ts";

const cryptoProvider = webcrypto as unknown as Crypto;
function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function head(major: number, value: number): number[] {
  if (value < 24) return [(major << 5) | value];
  if (value < 256) return [(major << 5) | 24, value];
  if (value < 65536) return [(major << 5) | 25, value >> 8, value & 255];
  throw new Error("fixture_length_unsupported");
}
function cborInt(value: number): number[] {
  return value >= 0 ? head(0, value) : head(1, -1 - value);
}
function cborBytes(value: Uint8Array): number[] { return [...head(2, value.length), ...value]; }
function cborText(value: string): number[] {
  const bytes = new TextEncoder().encode(value);
  return [...head(3, bytes.length), ...bytes];
}
function cborMap(entries: Array<[number[] | string, number[] | Uint8Array]>): Uint8Array {
  const output = [...head(5, entries.length)];
  for (const [key, value] of entries) {
    output.push(...(typeof key === "string" ? cborText(key) : key), ...(value instanceof Uint8Array ? [...value] : value));
  }
  return Uint8Array.from(output);
}
function decodeB64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)), c => c.charCodeAt(0));
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

async function fixture(overrides: { flags?: number; origin?: string; rpId?: string } = {}) {
  const pair = await cryptoProvider.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"],
  );
  const jwk = await cryptoProvider.subtle.exportKey("jwk", pair.publicKey);
  const x = decodeB64(jwk.x!);
  const y = decodeB64(jwk.y!);
  const credentialIdBytes = cryptoProvider.getRandomValues(new Uint8Array(24));
  const credentialId = base64url(credentialIdBytes);
  const challengeBytes = cryptoProvider.getRandomValues(new Uint8Array(32));
  const challenge = base64url(challengeBytes);
  const rpId = overrides.rpId ?? "sac.example";
  const rpHash = new Uint8Array(await cryptoProvider.subtle.digest("SHA-256", new TextEncoder().encode(rpId)));
  const header = new Uint8Array(37 + 16 + 2);
  header.set(rpHash, 0);
  header[32] = overrides.flags ?? 0x45;
  header[37 + 16] = credentialIdBytes.length >> 8;
  header[37 + 17] = credentialIdBytes.length & 255;
  const cose = cborMap([
    [cborInt(1), cborInt(2)],
    [cborInt(3), cborInt(-7)],
    [cborInt(-1), cborInt(1)],
    [cborInt(-2), cborBytes(x)],
    [cborInt(-3), cborBytes(y)],
  ]);
  const authData = concat(header, credentialIdBytes, cose);
  const attestation = cborMap([
    ["fmt", cborText("none")],
    ["attStmt", Uint8Array.of(0xa0).map(x => x)],
    ["authData", cborBytes(authData)],
  ]);
  const clientData = new TextEncoder().encode(JSON.stringify({
    type: "webauthn.create",
    challenge,
    origin: overrides.origin ?? "https://sac.example",
    crossOrigin: false,
  }));
  const digest = new Uint8Array(await cryptoProvider.subtle.digest("SHA-256", challengeBytes));
  const expectedChallengeDigest = Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
  return {
    response: {
      id: credentialId,
      rawId: credentialId,
      type: "public-key",
      authenticatorAttachment: "platform",
      response: {
        clientDataJSON: base64url(clientData),
        attestationObject: base64url(attestation),
      },
    },
    expectedChallengeDigest,
    rpId,
  };
}

test("verifies a valid none-attestation P-256 single-device root credential", async () => {
  const input = await fixture();
  const result = await verifyRootRegistrationResponse({
    ...input, expectedOrigin: "https://sac.example", allowedOrigins: ["https://sac.example"], cryptoProvider,
  });
  assert.equal(result.credentialId.length, 32);
  assert.match(result.publicKeyX, /^[A-Za-z0-9_-]{43}$/);
  assert.match(result.publicKeyY, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(result.credentialDeviceType, "singleDevice");
  assert.equal(result.credentialBackedUp, false);
  assert.equal(result.userVerified, true);
  assert.equal(result.signCount, 0);
});

test("rejects a challenge replayed from a different challenge digest", async () => {
  const input = await fixture();
  await assert.rejects(() => verifyRootRegistrationResponse({
    ...input, expectedChallengeDigest: "0".repeat(64), expectedOrigin: "https://sac.example",
    allowedOrigins: ["https://sac.example"], cryptoProvider,
  }));
});

test("rejects an origin not in the server allowlist", async () => {
  const input = await fixture({ origin: "https://evil.sac.example" });
  await assert.rejects(() => verifyRootRegistrationResponse({
    ...input, allowedOrigins: ["https://sac.example"], cryptoProvider,
  }));
});

test("rejects backup-eligible and backed-up authenticator flags", async () => {
  for (const flags of [0x4d, 0x5d]) {
    const input = await fixture({ flags });
    await assert.rejects(() => verifyRootRegistrationResponse({
      ...input, allowedOrigins: ["https://sac.example"], cryptoProvider,
    }));
  }
});

test("rejects a mismatched RP ID hash", async () => {
  const input = await fixture({ rpId: "other.example" });
  await assert.rejects(() => verifyRootRegistrationResponse({
    ...input, rpId: "sac.example", allowedOrigins: ["https://sac.example"], cryptoProvider,
  }));
});
