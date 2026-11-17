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
