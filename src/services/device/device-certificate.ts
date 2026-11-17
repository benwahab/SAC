/**
 * Certificat expérimental d'un appareil secondaire autorisé par l'appareil racine.
 *
 * La clé racine de vérification doit provenir d'une ancre déjà vérifiée
 * indépendamment. Ne jamais la remplacer par une clé fournie uniquement
 * par le serveur ou par le certificat lui-même.
 *
 * Ce module ne gère ni stockage, ni révocation serveur, ni sessions.
 */
import { fingerprintLocationIdentityKey } from "./location/key-exchange.ts";

const encoder = new TextEncoder();
const PLATFORMS = ["web", "android", "ios"] as const;

export type CertifiedDevicePlatform = (typeof PLATFORMS)[number];

export interface SecondaryDeviceCertificate {
  readonly version: 1;
  readonly accountId: string;
  readonly deviceId: string;
  readonly platform: CertifiedDevicePlatform;
  readonly createdAt: string;
  readonly rootFingerprint: string;
  readonly identityPublicKey: JsonWebKey;
  readonly exchangePublicKey: JsonWebKey;
  readonly signature: Uint8Array;
}

function requireText(value: unknown, label: string): asserts value is string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 256 ||
    [...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
  ) {
    throw new Error(`Le champ ${label} du certificat est invalide.`);
  }
}

function validTimestamp(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function validPublicJwk(value: unknown, curve: "P-256"): value is JsonWebKey {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const jwk = value as Record<string, unknown>;
  return jwk.kty === "EC" &&
    jwk.crv === curve &&
    typeof jwk.x === "string" && /^[A-Za-z0-9_-]{43}$/.test(jwk.x) &&
    typeof jwk.y === "string" && /^[A-Za-z0-9_-]{43}$/.test(jwk.y) &&
    !("d" in jwk);
}

function canonicalPayload(
  certificate: Omit<SecondaryDeviceCertificate, "signature">,
): Uint8Array {
  return encoder.encode(JSON.stringify([
    "SAC:secondary-device-certificate:v1",
    certificate.version,
    certificate.accountId,
    certificate.deviceId,
    certificate.platform,
    certificate.createdAt,
    certificate.rootFingerprint,
    certificate.identityPublicKey.kty,
    certificate.identityPublicKey.crv,
    certificate.identityPublicKey.x,
    certificate.identityPublicKey.y,
    certificate.exchangePublicKey.kty,
    certificate.exchangePublicKey.crv,
    certificate.exchangePublicKey.x,
    certificate.exchangePublicKey.y,
    ["location:send", "location:receive"],
  ]));
}

function validateRootKeys(privateKey: CryptoKey, publicKey: CryptoKey): void {
  if (
    privateKey.type !== "private" ||
    publicKey.type !== "public" ||
    privateKey.algorithm.name !== "ECDSA" ||
    publicKey.algorithm.name !== "ECDSA" ||
    (privateKey.algorithm as EcKeyAlgorithm).namedCurve !== "P-256" ||
    (publicKey.algorithm as EcKeyAlgorithm).namedCurve !== "P-256" ||
    !privateKey.usages.includes("sign") ||
    !publicKey.usages.includes("verify")
  ) {
    throw new Error("La clé racine doit être une paire ECDSA P-256 valide.");
  }
}

export async function issueSecondaryDeviceCertificate(
  input: {
    accountId: string;
    deviceId: string;
    platform: CertifiedDevicePlatform;
    createdAt: string;
    identityPublicKey: CryptoKey;
    exchangePublicKey: CryptoKey;
  },
  rootPrivateKey: CryptoKey,
  trustedRootPublicKey: CryptoKey,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<SecondaryDeviceCertificate> {
  validateRootKeys(rootPrivateKey, trustedRootPublicKey);
  requireText(input.accountId, "accountId");
  requireText(input.deviceId, "deviceId");
  if (!PLATFORMS.includes(input.platform)) throw new Error("La plateforme de l'appareil est invalide.");
  if (!validTimestamp(input.createdAt)) throw new Error("La date du certificat est invalide.");
  if (
    input.identityPublicKey.type !== "public" ||
    input.identityPublicKey.algorithm.name !== "ECDSA" ||
    (input.identityPublicKey.algorithm as EcKeyAlgorithm).namedCurve !== "P-256" ||
    !input.identityPublicKey.usages.includes("verify") ||
    input.exchangePublicKey.type !== "public" ||
    input.exchangePublicKey.algorithm.name !== "ECDH" ||
    (input.exchangePublicKey.algorithm as EcKeyAlgorithm).namedCurve !== "P-256" ||
    input.exchangePublicKey.usages.length !== 0
  ) {
    throw new Error("Les clés publiques de l'appareil sont invalides.");
  }

  const identityJwk = await cryptoProvider.subtle.exportKey("jwk", input.identityPublicKey);
  const exchangeJwk = await cryptoProvider.subtle.exportKey("jwk", input.exchangePublicKey);
  if (!validPublicJwk(identityJwk, "P-256") || !validPublicJwk(exchangeJwk, "P-256")) {
    throw new Error("Les clés publiques exportées sont invalides.");
  }
  const rootJwk = await cryptoProvider.subtle.exportKey("jwk", trustedRootPublicKey);
  const rootFingerprint = await fingerprintLocationIdentityKey(rootJwk, cryptoProvider);
  const unsigned = {
    version: 1 as const,
    accountId: input.accountId,
    deviceId: input.deviceId,
    platform: input.platform,
    createdAt: input.createdAt,
    rootFingerprint,
    identityPublicKey: identityJwk,
    exchangePublicKey: exchangeJwk,
  };
  const signature = new Uint8Array(await cryptoProvider.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    rootPrivateKey,
    canonicalPayload(unsigned),
  ));
  const certificate = { ...unsigned, signature };
  if (!(await verifySecondaryDeviceCertificate(certificate, trustedRootPublicKey, { accountId: input.accountId, deviceId: input.deviceId }, cryptoProvider))) {
    throw new Error("La paire de clés racine ne correspond pas ou le certificat est invalide.");
  }
  return certificate;
}

export async function verifySecondaryDeviceCertificate(
  certificate: SecondaryDeviceCertificate,
  trustedRootPublicKey: CryptoKey,
  expected: { accountId: string; deviceId: string },
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<boolean> {
  try {
    if (
      typeof certificate !== "object" || certificate === null ||
      certificate.version !== 1 ||
      !PLATFORMS.includes(certificate.platform) ||
      !(certificate.signature instanceof Uint8Array) ||
      certificate.signature.length !== 64 ||
      !validPublicJwk(certificate.identityPublicKey, "P-256") ||
      !validPublicJwk(certificate.exchangePublicKey, "P-256")
    ) return false;
    requireText(certificate.accountId, "accountId");
    requireText(certificate.deviceId, "deviceId");
    requireText(expected.accountId, "expected.accountId");
    requireText(expected.deviceId, "expected.deviceId");
    if (certificate.accountId !== expected.accountId || certificate.deviceId !== expected.deviceId) return false;
    requireText(certificate.rootFingerprint, "rootFingerprint");
    if (!validTimestamp(certificate.createdAt)) return false;
    if (
      trustedRootPublicKey.type !== "public" ||
      trustedRootPublicKey.algorithm.name !== "ECDSA" ||
      (trustedRootPublicKey.algorithm as EcKeyAlgorithm).namedCurve !== "P-256" ||
      !trustedRootPublicKey.usages.includes("verify")
    ) return false;
    const rootJwk = await cryptoProvider.subtle.exportKey("jwk", trustedRootPublicKey);
    if (await fingerprintLocationIdentityKey(rootJwk, cryptoProvider) !== certificate.rootFingerprint) return false;
    const identityKey = await cryptoProvider.subtle.importKey(
      "jwk", certificate.identityPublicKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"],
    );
    const exchangeKey = await cryptoProvider.subtle.importKey(
      "jwk", certificate.exchangePublicKey, { name: "ECDH", namedCurve: "P-256" }, false, [],
    );
    if (identityKey.algorithm.name !== "ECDSA" || exchangeKey.algorithm.name !== "ECDH") return false;
    const { signature, ...unsigned } = certificate;
    return await cryptoProvider.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      trustedRootPublicKey,
      signature,
      canonicalPayload(unsigned),
    );
  } catch {
    return false;
  }
}
