/**
 * Primitive expérimentale de chiffrement des paquets de localisation SAC.
 *
 * Ce module ne persiste aucune clé ni donnée, ne gère pas l'expiration J+30,
 * ne distribue pas les clés aux contacts et n'est pas encore branché à l'app.
 * Il sert uniquement à valider AES-256-GCM et l'authentification du contexte
 * avant de concevoir l'échange de clés natif.
 */

export interface EncryptedLocationPacket {
  readonly version: 1;
  readonly algorithm: "AES-256-GCM";
  readonly iv: Uint8Array;
  readonly ciphertext: Uint8Array;
}

const AES_GCM_IV_LENGTH = 12;
const AES_GCM_TAG_LENGTH = 128;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function createAdditionalData(sessionId: string): ArrayBuffer {
  if (!sessionId.trim()) {
    throw new Error("L'identifiant de session est obligatoire.");
  }

  return toArrayBuffer(encoder.encode(`SAC:location:v1:${sessionId}`));
}

/** Génère une clé AES-GCM non exportable, conservée uniquement par l'appelant. */
export async function createLocationSessionKey(
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<CryptoKey> {
  return cryptoProvider.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Chiffre un contenu opaque ; le serveur ne doit recevoir que ce paquet. */
export async function encryptLocationPayload(
  payload: string,
  key: CryptoKey,
  sessionId: string,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<EncryptedLocationPacket> {
  const iv = cryptoProvider.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
  const ciphertext = await cryptoProvider.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: createAdditionalData(sessionId),
      tagLength: AES_GCM_TAG_LENGTH,
    },
    key,
    encoder.encode(payload),
  );

  return {
    version: 1,
    algorithm: "AES-256-GCM",
    iv,
    ciphertext: new Uint8Array(ciphertext),
  };
}

/** Déchiffre uniquement si l'identifiant de session et l'intégrité correspondent. */
export async function decryptLocationPayload(
  packet: EncryptedLocationPacket,
  key: CryptoKey,
  sessionId: string,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<string> {
  if (
    packet.version !== 1 ||
    packet.algorithm !== "AES-256-GCM" ||
    packet.iv.byteLength !== AES_GCM_IV_LENGTH ||
    packet.ciphertext.byteLength <= AES_GCM_TAG_LENGTH / 8
  ) {
    throw new Error("Paquet de localisation invalide.");
  }

  const plaintext = await cryptoProvider.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(packet.iv),
      additionalData: createAdditionalData(sessionId),
      tagLength: AES_GCM_TAG_LENGTH,
    },
    key,
    toArrayBuffer(packet.ciphertext),
  );

  return decoder.decode(plaintext);
}
