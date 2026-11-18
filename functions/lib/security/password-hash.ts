/**
 * Hachage de mot de passe pour Cloudflare Workers.
 *
 * PBKDF2-HMAC-SHA-256, 600 000 itérations, sel aléatoire unique de 128 bits.
 * La clé dérivée sert à produire un vérificateur HMAC de contexte ; le mot de
 * passe et la clé dérivée ne sont jamais persistés.
 */
const ALGORITHM = "pbkdf2-sha256";
const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const TAG_BYTES = 32;
const VERIFIER_CONTEXT = new TextEncoder().encode("SAC password verifier v1");

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function deriveVerifierKey(
  cryptoProvider: Pick<Crypto, "subtle">,
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const material = await cryptoProvider.subtle.importKey(
    "raw",
    toArrayBuffer(new TextEncoder().encode(password)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return cryptoProvider.subtle.deriveKey(
    { name: "PBKDF2", salt: toArrayBuffer(salt), iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign", "verify"],
  );
}

export async function hashAccountPassword(
  cryptoProvider: Pick<Crypto, "subtle" | "getRandomValues">,
  password: string,
): Promise<string> {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("password_required");
  }
  const salt = cryptoProvider.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveVerifierKey(cryptoProvider, password, salt);
  const tag = new Uint8Array(
    await cryptoProvider.subtle.sign("HMAC", key, toArrayBuffer(VERIFIER_CONTEXT)),
  );
  if (tag.length !== TAG_BYTES) throw new Error("password_hash_failed");
  return [ALGORITHM, String(ITERATIONS), toBase64Url(salt), toBase64Url(tag)].join("$");
}

export async function verifyAccountPassword(
  cryptoProvider: Pick<Crypto, "subtle">,
  password: string,
  encoded: string,
): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 4 || parts[0] !== ALGORITHM || parts[1] !== String(ITERATIONS)) {
    return false;
  }
  const salt = fromBase64Url(parts[2]);
  const tag = fromBase64Url(parts[3]);
  if (!salt || salt.length !== SALT_BYTES || !tag || tag.length !== TAG_BYTES) return false;

  const key = await deriveVerifierKey(cryptoProvider, password, salt);
  return cryptoProvider.subtle.verify("HMAC", key, toArrayBuffer(tag), toArrayBuffer(VERIFIER_CONTEXT));
}
