import { decodeCbor, type CborValue } from "./webauthn-cbor.ts";
import { isAllowedWebAuthnOrigin } from "./webauthn-origin.ts";
import { evaluateWebAuthnRootCredentialPolicy } from "../../../src/domain/webauthn-root-policy.ts";

export interface VerifiedRootCredential {
  credentialId: string;
  publicKeyX: string;
  publicKeyY: string;
  signCount: number;
  credentialDeviceType: "singleDevice";
  credentialBackedUp: false;
  userVerified: true;
}

function decodeBase64Url(value: unknown, maxBytes: number): Uint8Array {
  if (typeof value !== "string" || value.length < 1 || value.length > Math.ceil(maxBytes * 4 / 3) + 4 ||
      !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    throw new Error("webauthn_base64url_invalid");
  }
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)); }
  catch { throw new Error("webauthn_base64url_invalid"); }
  const canonical = toBase64Url(bytes);
  if (bytes.length > maxBytes || canonical !== value) throw new Error("webauthn_base64url_invalid");
  return bytes;
}

function mapValue(value: CborValue, key: CborValue): CborValue | undefined {
  return value instanceof Map ? value.get(key) : undefined;
}

function bytes(value: CborValue | undefined, length?: number): Uint8Array {
  if (!(value instanceof Uint8Array) || (length !== undefined && value.length !== length)) {
    throw new Error("webauthn_cbor_field_invalid");
  }
  return value;
}

function integer(value: CborValue | undefined): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error("webauthn_cbor_integer_invalid");
  return value;
}

function readUint16(data: Uint8Array, offset: number): number {
  if (offset + 2 > data.length) throw new Error("webauthn_auth_data_truncated");
  return (data[offset] << 8) | data[offset + 1];
}

function toBase64Url(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i += 0x8000) binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyRootRegistrationResponse(input: {
  response: unknown;
  expectedChallengeDigest: string;
  rpId: string;
  allowedOrigins: readonly string[];
  cryptoProvider: Pick<Crypto, "subtle">;
}): Promise<VerifiedRootCredential> {
  if (typeof input.response !== "object" || input.response === null || Array.isArray(input.response)) {
    throw new Error("webauthn_response_invalid");
  }
  const response = input.response as Record<string, unknown>;
  if (response.type !== "public-key" || response.authenticatorAttachment !== "platform" || typeof response.id !== "string") {
    throw new Error("webauthn_credential_type_invalid");
  }
  const rawId = decodeBase64Url(response.rawId, 1024);
  if (toBase64Url(rawId) !== response.id) throw new Error("webauthn_credential_id_mismatch");
  if (typeof response.response !== "object" || response.response === null) {
    throw new Error("webauthn_attestation_response_missing");
  }
  const payload = response.response as Record<string, unknown>;
  const clientDataBytes = decodeBase64Url(payload.clientDataJSON, 16_384);
  let clientData: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(clientDataBytes));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
    clientData = parsed as Record<string, unknown>;
  } catch { throw new Error("webauthn_client_data_invalid"); }

  let challengeMatches = false;
  if (typeof clientData.challenge === "string") {
    try {
      const challengeBytes = decodeBase64Url(clientData.challenge, 64);
      const challengeDigest = new Uint8Array(await input.cryptoProvider.subtle.digest("SHA-256", challengeBytes));
      const expectedDigest = Uint8Array.from(
        input.expectedChallengeDigest.match(/.{2}/g) ?? [],
        (byte) => Number.parseInt(byte, 16),
      );
      challengeMatches = /^[a-f0-9]{64}$/.test(input.expectedChallengeDigest) &&
        constantTimeEqual(challengeDigest, expectedDigest);
    } catch { challengeMatches = false; }
  }
  if (clientData.type !== "webauthn.create" || !challengeMatches ||
      clientData.crossOrigin === true ||
      !isAllowedWebAuthnOrigin(clientData.origin, input.rpId, input.allowedOrigins)) {
    throw new Error("webauthn_client_data_binding_invalid");
  }

  const attestationBytes = decodeBase64Url(payload.attestationObject, 65_536);
  const attestation = decodeCbor(attestationBytes);
  if (!(attestation instanceof Map) || attestation.size !== 3 ||
      mapValue(attestation, "fmt") !== "none" ||
      !(mapValue(attestation, "attStmt") instanceof Map) ||
      (mapValue(attestation, "attStmt") as Map<CborValue, CborValue>).size !== 0) {
    throw new Error("webauthn_attestation_format_rejected");
  }
  const authData = bytes(mapValue(attestation, "authData"));
  if (authData.length < 55) throw new Error("webauthn_auth_data_truncated");

  const expectedRpHash = new Uint8Array(await input.cryptoProvider.subtle.digest(
    "SHA-256", new TextEncoder().encode(input.rpId),
  ));
  if (!constantTimeEqual(authData.slice(0, 32), expectedRpHash)) {
    throw new Error("webauthn_rp_id_hash_mismatch");
  }

  const flags = authData[32];
  const userPresent = (flags & 0x01) !== 0;
  const userVerified = (flags & 0x04) !== 0;
  const backupEligible = (flags & 0x08) !== 0;
  const backedUp = (flags & 0x10) !== 0;
  const attestedCredentialData = (flags & 0x40) !== 0;
  const hasExtensions = (flags & 0x80) !== 0;
  if (!userPresent || !userVerified || !attestedCredentialData || hasExtensions || backupEligible || backedUp || (flags & 0x22) !== 0) {
    throw new Error("webauthn_root_authenticator_flags_rejected");
  }

  let offset = 37 + 16;
  const credentialIdLength = readUint16(authData, offset);
  offset += 2;
  if (credentialIdLength < 1 || credentialIdLength > 1024 || offset + credentialIdLength >= authData.length) {
    throw new Error("webauthn_credential_id_length_invalid");
  }
  const credentialId = authData.slice(offset, offset + credentialIdLength);
  offset += credentialIdLength;
  if (!constantTimeEqual(credentialId, rawId)) throw new Error("webauthn_credential_id_mismatch");

  const coseKey = decodeCbor(authData.slice(offset));
  if (!(coseKey instanceof Map) ||
      integer(mapValue(coseKey, 1)) !== 2 ||
      integer(mapValue(coseKey, 3)) !== -7 ||
      integer(mapValue(coseKey, -1)) !== 1) {
    throw new Error("webauthn_cose_key_profile_rejected");
  }
  const x = bytes(mapValue(coseKey, -2), 32);
  const y = bytes(mapValue(coseKey, -3), 32);
  if (coseKey.size !== 5) throw new Error("webauthn_cose_key_extra_fields");
  await input.cryptoProvider.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: toBase64Url(x), y: toBase64Url(y), ext: true, key_ops: ["verify"] },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );

  const policy = evaluateWebAuthnRootCredentialPolicy({
    credentialDeviceType: "singleDevice",
    credentialBackedUp: false,
    userVerified: true,
  });
  if (!policy.accepted) throw new Error("webauthn_root_policy_rejected");
  return {
    credentialId: toBase64Url(credentialId),
    publicKeyX: toBase64Url(x),
    publicKeyY: toBase64Url(y),
    signCount: (authData[33] * 0x1000000) + (authData[34] << 16) + (authData[35] << 8) + authData[36],
    credentialDeviceType: "singleDevice",
    credentialBackedUp: false,
    userVerified: true,
  };
}
