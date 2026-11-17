/**
 * Primitive expérimentale d'accord de clé ECDH pour SAC.
 *
 * La clé privée reste non exportable. La clé publique peut être transmise
 * après authentification indépendante. Ce module ne valide PAS l'identité
 * du propriétaire d'une clé publique distante : une couche de confiance,
 * signature et révocation est obligatoire avant toute utilisation réelle.
 * Ce module n'est pas branché à l'application.
 */
const encoder = new TextEncoder();
const SALT_LENGTH = 32;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function requireContext(value: string, label: string): void {
  if (!value.trim()) throw new Error(`Le contexte ${label} est obligatoire.`);
}

export interface LocationExchangeKeyPair {
  readonly publicKey: CryptoKey;
  readonly privateKey: CryptoKey;
}

export async function createLocationExchangeKeyPair(
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<LocationExchangeKeyPair> {
  const pair = await cryptoProvider.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"],
  );
  return { publicKey: pair.publicKey, privateKey: pair.privateKey };
}

/**
 * Les deux appareils dérivent la même clé avec ECDH + HKDF-SHA-256.
 * Le sel est public mais doit être aléatoire (32 octets) et transmis avec
 * l'enveloppe. Le contexte lie la clé à une session et à un destinataire.
 */
export async function deriveLocationRecipientKey(
  ownPrivateKey: CryptoKey,
  remotePublicKey: CryptoKey,
  salt: Uint8Array,
  sessionId: string,
  recipientId: string,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<CryptoKey> {
  requireContext(sessionId, "de session");
  requireContext(recipientId, "du destinataire");
  if (salt.byteLength !== SALT_LENGTH) {
    throw new Error("Le sel de dérivation doit contenir 32 octets.");
  }
  if (
    ownPrivateKey.algorithm.name !== "ECDH" ||
    remotePublicKey.algorithm.name !== "ECDH" ||
    (ownPrivateKey.algorithm as EcKeyAlgorithm).namedCurve !== "P-256" ||
    (remotePublicKey.algorithm as EcKeyAlgorithm).namedCurve !== "P-256"
  ) {
    throw new Error("Les clés d'échange doivent utiliser ECDH P-256.");
  }

  const secret = await cryptoProvider.subtle.deriveBits(
    { name: "ECDH", public: remotePublicKey }, ownPrivateKey, 256,
  );
  const hkdfKey = await cryptoProvider.subtle.importKey(
    "raw", secret, "HKDF", false, ["deriveKey"],
  );
  return cryptoProvider.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      info: encoder.encode(`SAC:location-recipient:v1:${sessionId}:${recipientId}`),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export interface SignedLocationKeyBundle {
  readonly version: 1;
  readonly ownerId: string;
  readonly exchangePublicKey: JsonWebKey;
  readonly identityPublicKey: JsonWebKey;
  readonly signature: Uint8Array;
}

export interface LocationIdentityKeyPair {
  readonly publicKey: CryptoKey;
  readonly privateKey: CryptoKey;
}

function canonicalBundlePayload(
  ownerId: string,
  exchangePublicKey: JsonWebKey,
): Uint8Array {
  requireContext(ownerId, "du propriétaire");
  if (
    exchangePublicKey.kty !== "EC" ||
    exchangePublicKey.crv !== "P-256" ||
    typeof exchangePublicKey.x !== "string" ||
    typeof exchangePublicKey.y !== "string"
  ) {
    throw new Error("La clé publique ECDH P-256 est invalide.");
  }
  return encoder.encode(JSON.stringify([
    "SAC:identity-key-bundle:v1",
    ownerId,
    exchangePublicKey.kty,
    exchangePublicKey.crv,
    exchangePublicKey.x,
    exchangePublicKey.y,
  ]));
}

/** Génère une clé de signature d'identité distincte de la clé ECDH. */
export async function createLocationIdentityKeyPair(
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<LocationIdentityKeyPair> {
  const pair = await cryptoProvider.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"],
  );
  return { publicKey: pair.publicKey, privateKey: pair.privateKey };
}

/** Signe le lien entre l'identité déclarée et la clé publique ECDH. */
export async function signLocationKeyBundle(
  ownerId: string,
  exchangePublicKey: CryptoKey,
  identityPrivateKey: CryptoKey,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<SignedLocationKeyBundle> {
  if (
    exchangePublicKey.algorithm.name !== "ECDH" ||
    identityPrivateKey.algorithm.name !== "ECDSA"
  ) {
    throw new Error("Types de clés incompatibles pour la signature.");
  }
  const exchangeJwk = await cryptoProvider.subtle.exportKey("jwk", exchangePublicKey);
  const identityJwk = await cryptoProvider.subtle.exportKey(
    "jwk",
    // Public key is derived from the private key's pair by the caller and
    // supplied separately through create bundle helper below.
    identityPrivateKey,
  ).catch(() => null);

  if (identityJwk) {
    throw new Error("La clé privée d'identité ne doit jamais être exportée.");
  }
  throw new Error("Fournir la clé publique d'identité via signLocationKeyBundleWithPublicKey.");
}

export async function signLocationKeyBundleWithPublicKey(
  ownerId: string,
  exchangePublicKey: CryptoKey,
  identityPrivateKey: CryptoKey,
  identityPublicKey: CryptoKey,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<SignedLocationKeyBundle> {
  if (
    exchangePublicKey.algorithm.name !== "ECDH" ||
    identityPrivateKey.algorithm.name !== "ECDSA" ||
    identityPublicKey.algorithm.name !== "ECDSA"
  ) {
    throw new Error("Types de clés incompatibles pour la signature.");
  }
  const exchangeJwk = await cryptoProvider.subtle.exportKey("jwk", exchangePublicKey);
  const identityJwk = await cryptoProvider.subtle.exportKey("jwk", identityPublicKey);
  const signature = await cryptoProvider.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    identityPrivateKey,
    canonicalBundlePayload(ownerId, exchangeJwk),
  );
  return {
    version: 1,
    ownerId,
    exchangePublicKey: exchangeJwk,
    identityPublicKey: identityJwk,
    signature: new Uint8Array(signature),
  };
}

/**
 * Vérifie la signature du lien identité/clé ECDH. Cela ne prouve pas à lui
 * seul que le signataire est le vrai contact : comparer l'empreinte de
 * identityPublicKey à une référence déjà vérifiée (QR/code de sécurité).
 */
export async function verifyLocationKeyBundle(
  bundle: SignedLocationKeyBundle,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<boolean> {
  if (
    bundle.version !== 1 ||
    !bundle.ownerId.trim() ||
    bundle.identityPublicKey.kty !== "EC" ||
    bundle.identityPublicKey.crv !== "P-256" ||
    bundle.exchangePublicKey.kty !== "EC" ||
    bundle.exchangePublicKey.crv !== "P-256"
  ) {
    return false;
  }
  try {
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
      toArrayBuffer(bundle.signature),
      canonicalBundlePayload(bundle.ownerId, bundle.exchangePublicKey),
    );
  } catch {
    return false;
  }
}

