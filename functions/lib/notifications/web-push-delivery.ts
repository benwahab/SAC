import { decryptPushSubscription, type EncryptedPushSubscription, type PushSubscriptionPayload } from "./push-subscription-crypto.ts";
import type { SosPushEnvelope, SosPushSender } from "../alerts/sos-service.ts";
import { isAllowedPushEndpoint } from "./push-endpoint-policy.ts";

const encoder = new TextEncoder();
export interface WebPushEnvironment {
  PUSH_SUBSCRIPTION_ENCRYPTION_KEY?: string;
  PUSH_VAPID_PUBLIC_KEY?: string;
  PUSH_VAPID_PRIVATE_JWK?: string;
  PUSH_VAPID_SUBJECT?: string;
}

interface StoredSubscription extends EncryptedPushSubscription {
  id: string;
  encryption_key_version: string;
}

export type WebPushResult = "accepted" | "gone" | "retry" | "blocked";

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), c => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

async function hmac(keyBytes: Uint8Array, data: Uint8Array, cryptoProvider: Crypto): Promise<Uint8Array> {
  const key = await cryptoProvider.subtle.importKey("raw", keyBytes as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await cryptoProvider.subtle.sign("HMAC", key, data as BufferSource));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number, cryptoProvider: Crypto): Promise<Uint8Array> {
  const blocks: Uint8Array[] = [];
  let previous = new Uint8Array(0);
  let total = 0;
  for (let counter = 1; total < length; counter += 1) {
    if (counter > 255) throw new Error("hkdf_output_too_long");
    previous = await hmac(prk, concat(previous, info, new Uint8Array([counter])), cryptoProvider);
    blocks.push(previous);
    total += previous.byteLength;
  }
  return concat(...blocks).slice(0, length);
}

async function encryptWebPushPayload(
  subscription: PushSubscriptionPayload,
  payload: Uint8Array,
  cryptoProvider: Crypto,
): Promise<Uint8Array> {
  const clientPublicBytes = decodeBase64Url(subscription.keys.p256dh);
  const authSecret = decodeBase64Url(subscription.keys.auth);
  if (!clientPublicBytes || clientPublicBytes.byteLength !== 65 || clientPublicBytes[0] !== 4 || !authSecret || authSecret.byteLength !== 16) {
    throw new Error("invalid_subscription_keys");
  }

  const clientPublicKey = await cryptoProvider.subtle.importKey(
    "raw", clientPublicBytes as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, [],
  );
  const serverPair = await cryptoProvider.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"],
  ) as CryptoKeyPair;
  const serverPublicBytes = new Uint8Array(await cryptoProvider.subtle.exportKey("raw", serverPair.publicKey));
  const sharedSecret = new Uint8Array(await cryptoProvider.subtle.deriveBits(
    { name: "ECDH", public: clientPublicKey }, serverPair.privateKey, 256,
  ));

  const keyPrk = await hmac(authSecret, sharedSecret, cryptoProvider);
  const keyInfo = concat(encoder.encode("WebPush: info\0"), clientPublicBytes, serverPublicBytes);
  const inputKeyMaterial = await hkdfExpand(keyPrk, keyInfo, 32, cryptoProvider);

  const salt = cryptoProvider.getRandomValues(new Uint8Array(16));
  const contentPrk = await hmac(salt, inputKeyMaterial, cryptoProvider);
  const contentKeyBytes = await hkdfExpand(contentPrk, encoder.encode("Content-Encoding: aes128gcm\0"), 16, cryptoProvider);
  const nonce = await hkdfExpand(contentPrk, encoder.encode("Content-Encoding: nonce\0"), 12, cryptoProvider);
  const contentKey = await cryptoProvider.subtle.importKey("raw", contentKeyBytes as BufferSource, "AES-GCM", false, ["encrypt"]);
  const paddedPayload = concat(payload, new Uint8Array([2]));
  const ciphertext = new Uint8Array(await cryptoProvider.subtle.encrypt(
    { name: "AES-GCM", iv: nonce as BufferSource, tagLength: 128 }, contentKey, paddedPayload as BufferSource,
  ));

  const recordSize = new Uint8Array([0, 0, 16, 0]); // 4096 bytes, network byte order.
  const keyIdLength = new Uint8Array([serverPublicBytes.byteLength]);
  return concat(salt, recordSize, keyIdLength, serverPublicBytes, ciphertext);
}

async function createVapidAuthorization(
  audience: string,
  env: WebPushEnvironment,
  cryptoProvider: Crypto,
  now: number,
): Promise<string> {
  if (!env.PUSH_VAPID_PUBLIC_KEY || !env.PUSH_VAPID_PRIVATE_JWK || !env.PUSH_VAPID_SUBJECT) {
    throw new Error("vapid_not_configured");
  }
  const publicBytes = decodeBase64Url(env.PUSH_VAPID_PUBLIC_KEY);
  if (!publicBytes || publicBytes.byteLength !== 65 || publicBytes[0] !== 4) throw new Error("invalid_vapid_public_key");

  let jwk: JsonWebKey;
  try {
    jwk = JSON.parse(env.PUSH_VAPID_PRIVATE_JWK) as JsonWebKey;
  } catch {
    throw new Error("invalid_vapid_private_key");
  }
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.d || !jwk.x || !jwk.y) throw new Error("invalid_vapid_private_key");
  const jwkPublic = concat(new Uint8Array([4]), decodeBase64Url(jwk.x) ?? new Uint8Array(), decodeBase64Url(jwk.y) ?? new Uint8Array());
  if (encodeBase64Url(jwkPublic) !== env.PUSH_VAPID_PUBLIC_KEY) throw new Error("vapid_key_pair_mismatch");

  const privateKey = await cryptoProvider.subtle.importKey(
    "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );
  const header = encodeBase64Url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = encodeBase64Url(encoder.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(now / 1000) + 12 * 60 * 60,
    sub: env.PUSH_VAPID_SUBJECT,
  })));
  const unsigned = header + "." + claims;
  const signature = new Uint8Array(await cryptoProvider.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, privateKey, encoder.encode(unsigned),
  ));
  if (signature.byteLength !== 64) throw new Error("invalid_vapid_signature");
  return "vapid t=" + unsigned + "." + encodeBase64Url(signature) + ", k=" + env.PUSH_VAPID_PUBLIC_KEY;
}

export async function sendWebPush(
  subscription: PushSubscriptionPayload,
  payload: Uint8Array,
  env: WebPushEnvironment,
  options: { crypto?: Crypto; fetcher?: typeof fetch; now?: number } = {},
): Promise<WebPushResult> {
  const cryptoProvider = options.crypto ?? crypto;
  const fetcher = options.fetcher ?? fetch;
  const endpoint = isAllowedPushEndpoint(subscription.endpoint);
  if (!endpoint) return "blocked";

  try {
    const authorization = await createVapidAuthorization(endpoint.origin, env, cryptoProvider, options.now ?? Date.now());
    const body = await encryptWebPushPayload(subscription, payload, cryptoProvider);
    const response = await fetcher(endpoint.href, {
      method: "POST",
      redirect: "manual",
      headers: {
        Authorization: authorization,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        "TTL": "60",
        "Urgency": "high",
      },
      body: body as BodyInit,
    });
    if (response.status === 404 || response.status === 410) return "gone";
    if (response.status >= 200 && response.status < 300) return "accepted";
    return "retry";
  } catch {
    return "retry";
  }
}

export function createSosWebPushSender(
  db: D1Database,
  env: WebPushEnvironment,
  cryptoProvider: Crypto = crypto,
  fetcher: typeof fetch = fetch,
): SosPushSender {
  return {
    async send(envelope: SosPushEnvelope): Promise<boolean> {
      if (!env.PUSH_SUBSCRIPTION_ENCRYPTION_KEY || !env.PUSH_VAPID_PUBLIC_KEY || !env.PUSH_VAPID_PRIVATE_JWK || !env.PUSH_VAPID_SUBJECT) {
        return false;
      }
      let rows: D1Result<StoredSubscription>;
      try {
        rows = await db.prepare(
          `SELECT p.id, p.endpoint_hash AS endpointHash, p.encrypted_subscription AS ciphertext,
                  p.iv, p.encryption_key_version AS encryption_key_version
           FROM push_subscriptions p
           JOIN devices d ON d.id = p.device_id AND d.account_id = p.account_id AND d.status = 'active'
           JOIN accounts a ON a.id = p.account_id AND a.status = 'active'
           WHERE p.account_id = ? AND p.status = 'active'`,
        ).bind(envelope.recipientAccountId).all<StoredSubscription>();
      } catch {
        return false;
      }
      if (!rows.success || !rows.results?.length) return false;

      let accepted = 0;
      let allResolved = true;
      const payload = encoder.encode(JSON.stringify({ version: 1, kind: "private_sos" }));
      for (const row of rows.results) {
        if (row.encryption_key_version !== "v1") {
          allResolved = false;
          continue;
        }
        const subscription = await decryptPushSubscription({
          endpointHash: row.endpointHash,
          ciphertext: row.ciphertext,
          iv: row.iv,
        }, env.PUSH_SUBSCRIPTION_ENCRYPTION_KEY, cryptoProvider);
        if (!subscription) {
          allResolved = false;
          continue;
        }
        const outcome = await sendWebPush(subscription, payload, env, { crypto: cryptoProvider, fetcher });
        if (outcome === "accepted") {
          accepted += 1;
        } else if (outcome === "gone") {
          try {
            await db.prepare("DELETE FROM push_subscriptions WHERE id = ? AND status = 'active'").bind(row.id).run();
          } catch {
            allResolved = false;
          }
        } else {
          allResolved = false;
        }
      }
      return accepted > 0 && allResolved;
    },
  };
}
