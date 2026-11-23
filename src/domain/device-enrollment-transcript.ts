import canonicalize from "canonicalize";
import { isCanonicalP256PublicJwk } from "../services/crypto/p256-jwk.ts";
import { validateLocationExchangePublicKey } from "../services/location/key-exchange.ts";
import { parseStrictJson } from "../services/crypto/strict-json.ts";
import { SAS_WORDLIST_EN_V1 } from "./device-enrollment-sas-wordlist.ts";

export const DEVICE_ENROLLMENT_PROTOCOL = "SAC-DEVICE-ENROLLMENT" as const;
export const DEVICE_ENROLLMENT_VERSION = 1 as const;
export const DEVICE_ENROLLMENT_NEW_DEVICE_DOMAIN = "SAC-DEVICE-ENROLLMENT-NEW-DEVICE-V1";
export const DEVICE_ENROLLMENT_ROOT_APPROVAL_DOMAIN = "SAC-DEVICE-ENROLLMENT-ROOT-APPROVAL-V1";
export const DEVICE_ENROLLMENT_SAS_DOMAIN = "SAC-DEVICE-ENROLLMENT-SAS-V1";
export const DEVICE_ENROLLMENT_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const DEVICE_ENROLLMENT_CEREMONY_TTL_MS = 10 * 60 * 1000;
export const DEVICE_ENROLLMENT_TRANSCRIPT_MAX_BYTES = 16 * 1024;
export const DEVICE_ENROLLMENT_TRANSCRIPT_MAX_DEPTH = 8;
export const DEVICE_ENROLLMENT_SAS_WORD_COUNT = 6;
export const DEVICE_ENROLLMENT_SAS_BITS = 66;

export const DEVICE_ENROLLMENT_PLATFORMS = ["web", "android", "ios"] as const;
export const DEVICE_ENROLLMENT_USAGES = ["device-authentication", "key-agreement"] as const;

export type DeviceEnrollmentPlatform = (typeof DEVICE_ENROLLMENT_PLATFORMS)[number];
export type DeviceEnrollmentUsage = (typeof DEVICE_ENROLLMENT_USAGES)[number];
export type DeviceEnrollmentSignatureRole = "new-device" | "root-approval";

export interface DeviceEnrollmentPublicKey {
  readonly kty: "EC";
  readonly crv: "P-256";
  readonly x: string;
  readonly y: string;
}

export interface DeviceEnrollmentTranscript {
  readonly protocol: typeof DEVICE_ENROLLMENT_PROTOCOL;
  readonly version: typeof DEVICE_ENROLLMENT_VERSION;
  readonly accountId: string;
  readonly rootDeviceId: string;
  readonly rootKeyVersion: number;
  readonly rootIdentityKeyThumbprint: string;
  readonly ceremonyId: string;
  readonly challengeId: string;
  readonly challenge: string;
  readonly newDeviceId: string;
  readonly newDeviceNonce: string;
  readonly rootNonce: string;
  readonly platform: DeviceEnrollmentPlatform;
  readonly identityPublicKey: DeviceEnrollmentPublicKey;
  readonly agreementPublicKey: DeviceEnrollmentPublicKey;
  readonly usages: readonly DeviceEnrollmentUsage[];
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export type DeviceEnrollmentTranscriptInput = Omit<DeviceEnrollmentTranscript, "protocol" | "version">;

const TRANSCRIPT_FIELDS = [
  "accountId",
  "agreementPublicKey",
  "ceremonyId",
  "challenge",
  "challengeId",
  "expiresAt",
  "identityPublicKey",
  "issuedAt",
  "newDeviceId",
  "newDeviceNonce",
  "platform",
  "protocol",
  "rootDeviceId",
  "rootIdentityKeyThumbprint",
  "rootKeyVersion",
  "rootNonce",
  "usages",
  "version",
] as const;
const TRANSCRIPT_FIELD_SET = new Set<string>(TRANSCRIPT_FIELDS);
const JWK_FIELDS = new Set(["crv", "kty", "x", "y"]);
const encoder = new TextEncoder();

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

function invalid(label: string): never {
  throw new Error("device_enrollment_transcript_invalid:" + label);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireOpaqueText(value: unknown, label: string): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 256 ||
    [...value].some((character) => {
      const code = character.codePointAt(0)!;
      return code < 0x21 || code === 0x7f;
    })
  ) {
    invalid(label);
  }
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)), (character) => character.charCodeAt(0));
}

function isCanonicalBase64Url(value: unknown, byteLength: number): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value) || value.length !== Math.ceil((byteLength * 4) / 3)) {
    return false;
  }
  try {
    const bytes = decodeBase64Url(value);
    if (bytes.length !== byteLength) return false;
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_") === value;
  } catch {
    return false;
  }
}

function requireBase64Url(value: unknown, byteLength: number, label: string): asserts value is string {
  if (!isCanonicalBase64Url(value, byteLength)) invalid(label);
}

function requirePublicKey(value: unknown, label: string): asserts value is DeviceEnrollmentPublicKey {
  if (!isRecord(value)) invalid(label);
  const keys = Object.keys(value);
  if (keys.length !== JWK_FIELDS.size || keys.some((key) => !JWK_FIELDS.has(key))) invalid(label);
  if (!isCanonicalP256PublicJwk(value)) invalid(label);
}

function requireSafeTimestamp(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) invalid(label);
}

function samePublicKey(left: DeviceEnrollmentPublicKey, right: DeviceEnrollmentPublicKey): boolean {
  return left.x === right.x && left.y === right.y;
}

function validateTranscript(value: unknown): asserts value is DeviceEnrollmentTranscript {
  if (!isRecord(value)) invalid("object");
  const keys = Object.keys(value);
  if (keys.length !== TRANSCRIPT_FIELDS.length || keys.some((key) => !TRANSCRIPT_FIELD_SET.has(key))) {
    invalid("fields");
  }
  if (value.protocol !== DEVICE_ENROLLMENT_PROTOCOL) invalid("protocol");
  if (value.version !== DEVICE_ENROLLMENT_VERSION) invalid("version");
  requireOpaqueText(value.accountId, "accountId");
  requireOpaqueText(value.rootDeviceId, "rootDeviceId");
  if (!Number.isSafeInteger(value.rootKeyVersion) || (value.rootKeyVersion as number) < 1) invalid("rootKeyVersion");
  requireBase64Url(value.rootIdentityKeyThumbprint, 32, "rootIdentityKeyThumbprint");
  requireBase64Url(value.ceremonyId, 16, "ceremonyId");
  requireBase64Url(value.challengeId, 16, "challengeId");
  requireBase64Url(value.challenge, 32, "challenge");
  requireBase64Url(value.newDeviceId, 16, "newDeviceId");
  requireBase64Url(value.newDeviceNonce, 32, "newDeviceNonce");
  requireBase64Url(value.rootNonce, 32, "rootNonce");
  if (!DEVICE_ENROLLMENT_PLATFORMS.includes(value.platform as DeviceEnrollmentPlatform)) invalid("platform");
  requirePublicKey(value.identityPublicKey, "identityPublicKey");
  requirePublicKey(value.agreementPublicKey, "agreementPublicKey");
  if (samePublicKey(value.identityPublicKey, value.agreementPublicKey)) invalid("duplicate_public_key");
  if (!Array.isArray(value.usages) || value.usages.length !== DEVICE_ENROLLMENT_USAGES.length) invalid("usages");
  if (value.usages.some((usage, index) => usage !== DEVICE_ENROLLMENT_USAGES[index])) invalid("usages");
  requireSafeTimestamp(value.issuedAt, "issuedAt");
  requireSafeTimestamp(value.expiresAt, "expiresAt");
  if (value.expiresAt <= value.issuedAt) invalid("expiry");
  if (value.expiresAt - value.issuedAt > DEVICE_ENROLLMENT_CEREMONY_TTL_MS) invalid("expiry_too_long");
}

export function buildDeviceEnrollmentTranscript(input: DeviceEnrollmentTranscriptInput): DeviceEnrollmentTranscript {
  const transcript = {
    ...input,
    protocol: DEVICE_ENROLLMENT_PROTOCOL,
    version: DEVICE_ENROLLMENT_VERSION,
  } as DeviceEnrollmentTranscript;
  validateTranscript(transcript);
  return transcript;
}

export function parseDeviceEnrollmentTranscript(source: string): DeviceEnrollmentTranscript {
  const value = parseStrictJson(source, {
    maxBytes: DEVICE_ENROLLMENT_TRANSCRIPT_MAX_BYTES,
    maxDepth: DEVICE_ENROLLMENT_TRANSCRIPT_MAX_DEPTH,
  });
  validateTranscript(value);
  return value;
}

export function canonicalizeDeviceEnrollmentTranscript(transcript: DeviceEnrollmentTranscript): string {
  validateTranscript(transcript);
  const canonical = canonicalize(transcript);
  if (typeof canonical !== "string") invalid("canonicalization");
  return canonical;
}

export function hashDeviceEnrollmentTranscript(
  transcript: DeviceEnrollmentTranscript,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<Uint8Array> {
  const canonical = canonicalizeDeviceEnrollmentTranscript(transcript);
  return cryptoProvider.subtle.digest("SHA-256", toArrayBuffer(encoder.encode(canonical))).then((digest) => new Uint8Array(digest));
}

export function deviceEnrollmentSignaturePayload(
  transcript: DeviceEnrollmentTranscript,
  role: DeviceEnrollmentSignatureRole,
): Uint8Array {
  if (role !== "new-device" && role !== "root-approval") invalid("role");
  const domain = role === "new-device"
    ? DEVICE_ENROLLMENT_NEW_DEVICE_DOMAIN
    : DEVICE_ENROLLMENT_ROOT_APPROVAL_DOMAIN;
  const canonical = encoder.encode(canonicalizeDeviceEnrollmentTranscript(transcript));
  const prefix = encoder.encode(domain);
  const payload = new Uint8Array(prefix.length + 1 + canonical.length);
  payload.set(prefix, 0);
  payload[prefix.length] = 0;
  payload.set(canonical, prefix.length + 1);
  return payload;
}

export async function computeDeviceEnrollmentKeyThumbprint(
  publicKey: DeviceEnrollmentPublicKey,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<string> {
  requirePublicKey(publicKey, "publicKey");
  const canonical = canonicalize({
    kty: publicKey.kty,
    crv: publicKey.crv,
    x: publicKey.x,
    y: publicKey.y,
  });
  if (typeof canonical !== "string") invalid("canonicalization");
  const digest = await cryptoProvider.subtle.digest("SHA-256", toArrayBuffer(encoder.encode(canonical)));
  return encodeBase64Url(new Uint8Array(digest));
}

export async function matchesDeviceEnrollmentRootThumbprint(
  transcript: DeviceEnrollmentTranscript,
  rootPublicKey: DeviceEnrollmentPublicKey,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<boolean> {
  try {
    return await computeDeviceEnrollmentKeyThumbprint(rootPublicKey, cryptoProvider) === transcript.rootIdentityKeyThumbprint;
  } catch {
    return false;
  }
}

export async function validateDeviceEnrollmentPublicKeys(
  transcript: DeviceEnrollmentTranscript,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<boolean> {
  try {
    validateTranscript(transcript);
    const identity = await cryptoProvider.subtle.importKey(
      "jwk",
      transcript.identityPublicKey as JsonWebKey,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    if (
      identity.type !== "public" ||
      identity.algorithm.name !== "ECDSA" ||
      (identity.algorithm as EcKeyAlgorithm).namedCurve !== "P-256"
    ) return false;
    return await validateLocationExchangePublicKey(transcript.agreementPublicKey as JsonWebKey, cryptoProvider);
  } catch {
    return false;
  }
}

export async function deviceEnrollmentAssertionChallenge(
  transcript: DeviceEnrollmentTranscript,
  role: DeviceEnrollmentSignatureRole,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<Uint8Array> {
  const digest = await cryptoProvider.subtle.digest("SHA-256", toArrayBuffer(deviceEnrollmentSignaturePayload(transcript, role)));
  return new Uint8Array(digest);
}

export function isDeviceEnrollmentTranscriptFresh(
  transcript: DeviceEnrollmentTranscript,
  now: number,
  clockSkewMs = 30_000,
): boolean {
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(clockSkewMs) || clockSkewMs < 0) return false;
  return transcript.issuedAt <= now + clockSkewMs && now < transcript.expiresAt;
}

function extractSixWordIndices(digest: Uint8Array): number[] {
  if (digest.length < 9) invalid("sas_digest");
  const indices: number[] = [];
  for (let word = 0; word < DEVICE_ENROLLMENT_SAS_WORD_COUNT; word += 1) {
    let index = 0;
    for (let bit = 0; bit < 11; bit += 1) {
      const offset = word * 11 + bit;
      const byte = digest[Math.floor(offset / 8)];
      index = (index << 1) | ((byte >> (7 - (offset % 8))) & 1);
    }
    indices.push(index);
  }
  return indices;
}

export async function deriveDeviceEnrollmentSas(
  transcript: DeviceEnrollmentTranscript,
  rootApprovalSignature: Uint8Array,
  cryptoProvider: Crypto = globalThis.crypto,
  wordList: readonly string[] = SAS_WORDLIST_EN_V1,
): Promise<readonly string[]> {
  if (!(rootApprovalSignature instanceof Uint8Array) || rootApprovalSignature.length < 1 || rootApprovalSignature.length > 1024) {
    invalid("root_signature");
  }
  if (wordList.length !== 2048 || wordList.some((word) => typeof word !== "string" || word.length === 0)) {
    invalid("wordlist");
  }
  const canonical = encoder.encode(canonicalizeDeviceEnrollmentTranscript(transcript));
  const domain = encoder.encode(DEVICE_ENROLLMENT_SAS_DOMAIN);
  const input = new Uint8Array(domain.length + 1 + canonical.length + 1 + rootApprovalSignature.length);
  input.set(domain, 0);
  input[domain.length] = 0;
  input.set(canonical, domain.length + 1);
  input[domain.length + 1 + canonical.length] = 0;
  input.set(rootApprovalSignature, domain.length + 1 + canonical.length + 1);
  const digest = new Uint8Array(await cryptoProvider.subtle.digest("SHA-256", toArrayBuffer(input)));
  return extractSixWordIndices(digest).map((index) => wordList[index]);
}
