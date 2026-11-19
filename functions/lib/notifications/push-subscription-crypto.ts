const encoder = new TextEncoder();
const SALT = encoder.encode("SAC:push-subscription-storage:v1");

export interface PushSubscriptionPayload {
  readonly endpoint: string;
  readonly keys: {
    readonly p256dh: string;
    readonly auth: string;
  };
}

export interface EncryptedPushSubscription {
  readonly endpointHash: string;
  readonly ciphertext: string;
  readonly iv: string;
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(
      atob(base64 + "=".repeat((4 - base64.length % 4) % 4)),
      (character) => character.charCodeAt(0),
    );
  } catch {
    return null;
  }
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function deriveKeys(secret: string, cryptoProvider: Crypto): Promise<{
  readonly encryption: CryptoKey;
  readonly fingerprint: CryptoKey;
} | null> {
  const raw = decodeBase64Url(secret);
  if (!raw || raw.byteLength !== 32) return null;
  const material = await cryptoProvider.subtle.importKey("raw", raw, "HKDF", false, ["deriveKey"]);
  const [encryption, fingerprint] = await Promise.all([
    cryptoProvider.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: SALT, info: encoder.encode("AES-256-GCM") },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    ),
    cryptoProvider.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: SALT, info: encoder.encode("HMAC-SHA-256") },
      material,
      { name: "HMAC", hash: "SHA-256", length: 256 },
      false,
      ["sign"],
    ),
  ]);
  return { encryption, fingerprint };
}

export async function encryptPushSubscription(
  payload: PushSubscriptionPayload,
  secret: string | undefined,
  cryptoProvider: Crypto = crypto,
): Promise<EncryptedPushSubscription | null> {
  if (!secret || payload.endpoint.length > 2048) return null;
  const keys = await deriveKeys(secret, cryptoProvider);
  if (!keys) return null;

  const iv = cryptoProvider.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(payload));
  const [ciphertext, fingerprint] = await Promise.all([
    cryptoProvider.subtle.encrypt({ name: "AES-GCM", iv }, keys.encryption, plaintext),
    cryptoProvider.subtle.sign("HMAC", keys.fingerprint, encoder.encode(payload.endpoint)),
  ]);
  return {
    endpointHash: Array.from(new Uint8Array(fingerprint), (byte) => byte.toString(16).padStart(2, "0")).join(""),
    ciphertext: encodeBase64Url(new Uint8Array(ciphertext)),
    iv: encodeBase64Url(iv),
  };
}

export async function decryptPushSubscription(
  encrypted: EncryptedPushSubscription,
  secret: string | undefined,
  cryptoProvider: Crypto = crypto,
): Promise<PushSubscriptionPayload | null> {
  if (!secret) return null;
  const keys = await deriveKeys(secret, cryptoProvider);
  const iv = decodeBase64Url(encrypted.iv);
  const ciphertext = decodeBase64Url(encrypted.ciphertext);
  if (!keys || !iv || iv.byteLength !== 12 || !ciphertext) return null;
  try {
    const plaintext = await cryptoProvider.subtle.decrypt({ name: "AES-GCM", iv }, keys.encryption, ciphertext);
    const value: unknown = JSON.parse(new TextDecoder().decode(plaintext));
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (typeof record.endpoint !== "string" || typeof record.keys !== "object" || record.keys === null) return null;
    const subscriptionKeys = record.keys as Record<string, unknown>;
    if (typeof subscriptionKeys.p256dh !== "string" || typeof subscriptionKeys.auth !== "string") return null;
    return { endpoint: record.endpoint, keys: { p256dh: subscriptionKeys.p256dh, auth: subscriptionKeys.auth } };
  } catch {
    return null;
  }
}
