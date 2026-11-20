import { isCanonicalP256PublicJwk } from "../crypto/p256-jwk.ts";
import {
  createLocationExchangeKeyPair,
  deriveLocationDirectionalKey,
  fingerprintLocationIdentityKey,
  validateLocationExchangePublicKey,
  type LocationExchangeKeyPair,
} from "./key-exchange.ts";
import {
  getOrCreateLocationIdentityKeyPair,
  getPinnedTrustedLocationFingerprint,
  type LocationIdentityKeyStore,
} from "./identity-vault.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAX_BUNDLE_AGE_MS = 24 * 60 * 60 * 1000;
const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export interface SignedLocationSessionBundle {
  readonly version: 1;
  readonly ownerId: string;
  readonly deviceId: string;
  readonly alertId: string;
  readonly sessionId: string;
  readonly salt: Uint8Array;
  readonly expiresAt: number;
  readonly exchangePublicKey: JsonWebKey;
  readonly identityPublicKey: JsonWebKey;
  readonly signature: Uint8Array;
}

export interface CreatedLocationSessionBundle {
  readonly bundle: SignedLocationSessionBundle;
  /** Éphémère, non exportable, jamais écrit dans IndexedDB ou envoyé au serveur. */
  readonly exchangePrivateKey: CryptoKey;
}

function validContextId(value: unknown): value is string {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 256 &&
    [...value].every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127);
}

function canonicalPayload(bundle: Omit<SignedLocationSessionBundle, "signature">): Uint8Array {
  return encoder.encode(JSON.stringify([
    "SAC:location-session-bundle:v1",
    bundle.ownerId,
    bundle.deviceId,
    bundle.alertId,
    bundle.sessionId,
    Array.from(bundle.salt),
    bundle.expiresAt,
    bundle.exchangePublicKey.kty,
    bundle.exchangePublicKey.crv,
    bundle.exchangePublicKey.x,
    bundle.exchangePublicKey.y,
    bundle.identityPublicKey.kty,
    bundle.identityPublicKey.crv,
    bundle.identityPublicKey.x,
    bundle.identityPublicKey.y,
  ]));
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("base64url invalide");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function validBundleShape(bundle: SignedLocationSessionBundle): boolean {
  const now = Date.now();
  return !!bundle &&
    bundle.version === 1 &&
    validContextId(bundle.ownerId) &&
    validContextId(bundle.deviceId) &&
    validContextId(bundle.alertId) &&
    validContextId(bundle.sessionId) &&
    bundle.salt instanceof Uint8Array &&
    bundle.salt.byteLength === 32 &&
    Number.isSafeInteger(bundle.expiresAt) &&
    bundle.expiresAt > now &&
    bundle.expiresAt <= now + MAX_BUNDLE_AGE_MS &&
    isCanonicalP256PublicJwk(bundle.exchangePublicKey) &&
    isCanonicalP256PublicJwk(bundle.identityPublicKey) &&
    bundle.signature instanceof Uint8Array &&
    bundle.signature.byteLength === 64;
}

export async function createLocationSessionBundle(
  accountId: string,
  deviceId: string,
  alertId: string,
  sessionId: string,
  salt: Uint8Array,
  expiresAt: number,
  store?: LocationIdentityKeyStore,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<CreatedLocationSessionBundle> {
  if (
    !validContextId(accountId) ||
    !validContextId(deviceId) ||
    !validContextId(alertId) ||
    !validContextId(sessionId) ||
    !(salt instanceof Uint8Array) ||
    salt.byteLength !== 32 ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Date.now() ||
    expiresAt > Date.now() + MAX_BUNDLE_AGE_MS
  ) {
    throw new Error("Le contexte de session GPS est invalide ou expiré.");
  }

  const identity = await getOrCreateLocationIdentityKeyPair(
    accountId, deviceId, store, cryptoProvider,
  );
  const exchange: LocationExchangeKeyPair = await createLocationExchangeKeyPair(cryptoProvider);
  const exchangePublicKey = await cryptoProvider.subtle.exportKey("jwk", exchange.publicKey);
  const unsigned: Omit<SignedLocationSessionBundle, "signature"> = {
    version: 1,
    ownerId: accountId,
    deviceId,
    alertId,
    sessionId,
    salt: new Uint8Array(salt),
    expiresAt,
    exchangePublicKey,
    identityPublicKey: identity.publicJwk,
  };
  const signature = new Uint8Array(await cryptoProvider.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    identity.privateKey,
    canonicalPayload(unsigned),
  ));
  const bundle: SignedLocationSessionBundle = { ...unsigned, signature };
  if (!(await verifyLocationSessionBundle(
    bundle, accountId, deviceId, alertId, sessionId, cryptoProvider,
  ))) {
    throw new Error("La signature de la session GPS n'a pas pu être vérifiée.");
  }
  return { bundle, exchangePrivateKey: exchange.privateKey };
}

export async function verifyLocationSessionBundle(
  bundle: SignedLocationSessionBundle,
  expectedAccountId: string,
  expectedDeviceId: string,
  expectedAlertId: string,
  expectedSessionId: string,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<boolean> {
  try {
    if (
      !validBundleShape(bundle) ||
      bundle.ownerId !== expectedAccountId ||
      bundle.deviceId !== expectedDeviceId ||
      bundle.alertId !== expectedAlertId ||
      bundle.sessionId !== expectedSessionId ||
      !(await validateLocationExchangePublicKey(bundle.exchangePublicKey, cryptoProvider))
    ) return false;

    const identityKey = await cryptoProvider.subtle.importKey(
      "jwk",
      bundle.identityPublicKey,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    return cryptoProvider.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      identityKey,
      bundle.signature,
      canonicalPayload({
        version: bundle.version,
        ownerId: bundle.ownerId,
        deviceId: bundle.deviceId,
        alertId: bundle.alertId,
        sessionId: bundle.sessionId,
        salt: bundle.salt,
        expiresAt: bundle.expiresAt,
        exchangePublicKey: bundle.exchangePublicKey,
        identityPublicKey: bundle.identityPublicKey,
      }),
    );
  } catch {
    return false;
  }
}

export async function verifyPinnedLocationSessionBundle(
  bundle: SignedLocationSessionBundle,
  localAccountId: string,
  localDeviceId: string,
  expectedAlertId: string,
  expectedSessionId: string,
  store?: LocationIdentityKeyStore,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<boolean> {
  try {
    if (!bundle) return false;
    const pinned = await getPinnedTrustedLocationFingerprint(
      localAccountId,
      localDeviceId,
      bundle.ownerId,
      bundle.deviceId,
      store,
      cryptoProvider,
    );
    if (!pinned) return false;
    if (!(await verifyLocationSessionBundle(
      bundle,
      bundle.ownerId,
      bundle.deviceId,
      expectedAlertId,
      expectedSessionId,
      cryptoProvider,
    ))) return false;
    const actual = await fingerprintLocationIdentityKey(bundle.identityPublicKey, cryptoProvider);
    return actual === pinned;
  } catch {
    return false;
  }
}

/** Encodes the signed bundle as a bounded opaque string suitable for relay. */
export function encodeLocationSessionBundle(bundle: SignedLocationSessionBundle): string {
  if (!validBundleShape(bundle)) throw new Error("Bundle de session GPS invalide.");
  const json = JSON.stringify({
    version: bundle.version,
    ownerId: bundle.ownerId,
    deviceId: bundle.deviceId,
    alertId: bundle.alertId,
    sessionId: bundle.sessionId,
    salt: encodeBase64Url(bundle.salt),
    expiresAt: bundle.expiresAt,
    exchangePublicKey: bundle.exchangePublicKey,
    identityPublicKey: bundle.identityPublicKey,
    signature: encodeBase64Url(bundle.signature),
  });
  const encoded = encodeBase64Url(encoder.encode(json));
  if (encoded.length > 2048) throw new Error("Bundle de session GPS trop volumineux.");
  return encoded;
}

export function decodeLocationSessionBundle(value: string): SignedLocationSessionBundle | null {
  try {
    if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
    const parsed = JSON.parse(decoder.decode(decodeBase64Url(value))) as Record<string, unknown>;
    if (
      !parsed ||
      typeof parsed.ownerId !== "string" ||
      typeof parsed.deviceId !== "string" ||
      typeof parsed.alertId !== "string" ||
      typeof parsed.sessionId !== "string" ||
      typeof parsed.salt !== "string" ||
      typeof parsed.signature !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      typeof parsed.exchangePublicKey !== "object" ||
      parsed.exchangePublicKey === null ||
      typeof parsed.identityPublicKey !== "object" ||
      parsed.identityPublicKey === null
    ) return null;

    const bundle: SignedLocationSessionBundle = {
      version: parsed.version as 1,
      ownerId: parsed.ownerId,
      deviceId: parsed.deviceId,
      alertId: parsed.alertId,
      sessionId: parsed.sessionId,
      salt: decodeBase64Url(parsed.salt),
      expiresAt: parsed.expiresAt,
      exchangePublicKey: parsed.exchangePublicKey as JsonWebKey,
      identityPublicKey: parsed.identityPublicKey as JsonWebKey,
      signature: decodeBase64Url(parsed.signature),
    };
    return validBundleShape(bundle) ? bundle : null;
  } catch {
    return null;
  }
}

export async function deriveLocationSessionDirectionalKey(input: {
  ownPrivateKey: CryptoKey;
  remoteBundle: SignedLocationSessionBundle;
  authorAccountId: string;
  alertId: string;
  sessionId: string;
  senderDeviceId: string;
  recipientDeviceId: string;
  ownDeviceId: string;
  expectedSalt: Uint8Array;
}, localAccountId: string, store?: LocationIdentityKeyStore, cryptoProvider: Crypto = globalThis.crypto): Promise<CryptoKey> {
  const {
    ownPrivateKey, remoteBundle, authorAccountId, alertId, sessionId,
    senderDeviceId, recipientDeviceId, ownDeviceId, expectedSalt,
  } = input;
  if (
    remoteBundle.alertId !== alertId ||
    remoteBundle.sessionId !== sessionId ||
    remoteBundle.expiresAt <= Date.now() ||
    expectedSalt.byteLength !== 32 ||
    expectedSalt.some((value, index) => value !== remoteBundle.salt[index]) ||
    (ownDeviceId !== senderDeviceId && ownDeviceId !== recipientDeviceId) ||
    (ownDeviceId === senderDeviceId && remoteBundle.deviceId !== recipientDeviceId) ||
    (ownDeviceId === recipientDeviceId && remoteBundle.deviceId !== senderDeviceId)
  ) {
    throw new Error("Le bundle de clé ne correspond pas à cette session GPS.");
  }

  if (!(await verifyPinnedLocationSessionBundle(
    remoteBundle,
    localAccountId,
    ownDeviceId,
    alertId,
    sessionId,
    store,
    cryptoProvider,
  ))) {
    throw new Error("La clé de ce proche n'est pas vérifiée sur cet appareil.");
  }

  const remotePublicKey = await cryptoProvider.subtle.importKey(
    "jwk",
    remoteBundle.exchangePublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  return deriveLocationDirectionalKey(
    ownPrivateKey,
    remotePublicKey,
    expectedSalt,
    authorAccountId,
    alertId,
    sessionId,
    senderDeviceId,
    recipientDeviceId,
    ownDeviceId,
    cryptoProvider,
  );
}
