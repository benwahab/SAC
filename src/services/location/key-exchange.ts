/**
 * Primitive expérimentale d'accord de clé ECDH pour SAC.
 *
 * Accord de clé ECDH éphémère utilisé par le partage GPS SOS.
 * L'identité du pair est vérifiée séparément à partir de sa session SAC
 * authentifiée et de son bundle de session signé.
 */
import { isCanonicalP256PublicJwk } from "../crypto/p256-jwk.ts";

const encoder = new TextEncoder();
const SALT_LENGTH = 32;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function requireContext(value: string, label: string): void {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 256 ||
    [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  ) {
    throw new Error(`Le contexte ${label} est invalide.`);
  }
}

function isP256PublicJwk(value: unknown): value is JsonWebKey {
  return isCanonicalP256PublicJwk(value);
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
    ["deriveBits"],
  );
  return { publicKey: pair.publicKey, privateKey: pair.privateKey };
}

/**
 * Les deux appareils dérivent la même clé avec ECDH + HKDF-SHA-256.
 * Le sel est public mais doit être aléatoire (32 octets) et transmis avec
 * l'enveloppe. Le contexte lie la clé à une session et à un destinataire.
 */
/**
 * Dérive une clé AES-GCM strictement directionnelle.
 * Les deux pairs appellent la fonction avec les mêmes sessionId,
 * senderId et recipientId. Le pair émetteur obtient encrypt-only ;
 * le pair destinataire obtient decrypt-only. Inverser les identifiants
 * ne donne pas la même clé.
 */
export async function deriveLocationDirectionalKey(
  ownPrivateKey: CryptoKey,
  remotePublicKey: CryptoKey,
  salt: Uint8Array,
  accountId: string,
  ceremonyId: string,
  sessionId: string,
  senderId: string,
  recipientId: string,
  ownDeviceId: string,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<CryptoKey> {
  requireContext(accountId, "du compte");
  requireContext(ceremonyId, "de cérémonie");
  requireContext(sessionId, "de session");
  requireContext(senderId, "de l'émetteur");
  requireContext(recipientId, "du destinataire");
  requireContext(ownDeviceId, "de l'appareil local");
  if (senderId === recipientId || (ownDeviceId !== senderId && ownDeviceId !== recipientId)) {
    throw new Error("Les identifiants des appareils et le sens du transfert sont incohérents.");
  }
  if (salt.byteLength !== SALT_LENGTH) {
    throw new Error("Le sel de dérivation doit contenir 32 octets.");
  }
  if (
    ownPrivateKey.type !== "private" ||
    remotePublicKey.type !== "public" ||
    !ownPrivateKey.usages.includes("deriveBits") ||
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
  const isSender = ownDeviceId === senderId;
  return cryptoProvider.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      info: encoder.encode(JSON.stringify([
        "SAC:location-directional-key:v4",
        accountId,
        ceremonyId,
        sessionId,
        senderId,
        recipientId,
        "location-payload",
        "AES-256-GCM",
      ])),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    isSender ? ["encrypt"] : ["decrypt"],
  );
}

/**
 * Valide une clé publique ECDH au-delà de son import JWK.
 *
 * Certains fournisseurs WebCrypto peuvent accepter à l'import un point EC
 * hors courbe. L'accord ECDH effectif doit donc également être tenté avec
 * une clé privée éphémère locale ; aucun secret dérivé n'est conservé.
 */
export async function validateLocationExchangePublicKey(
  publicJwk: JsonWebKey,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<boolean> {
  try {
    if (!isP256PublicJwk(publicJwk)) return false;
    const publicKey = await cryptoProvider.subtle.importKey(
      "jwk",
      publicJwk,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    if (
      publicKey.type !== "public" ||
      publicKey.algorithm.name !== "ECDH" ||
      (publicKey.algorithm as EcKeyAlgorithm).namedCurve !== "P-256"
    ) return false;

    const ephemeral = await cryptoProvider.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    );
    await cryptoProvider.subtle.deriveBits(
      { name: "ECDH", public: publicKey },
      ephemeral.privateKey,
      256,
    );
    return true;
  } catch {
    return false;
  }
}
