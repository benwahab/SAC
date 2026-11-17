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
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const jwk = value as Record<string, unknown>;
  return (
    jwk.kty === "EC" &&
    jwk.crv === "P-256" &&
    typeof jwk.x === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(jwk.x) &&
    typeof jwk.y === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(jwk.y) &&
    !("d" in jwk)
  );
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
  if (!isP256PublicJwk(exchangePublicKey)) {
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

export async function signLocationKeyBundleWithPublicKey(
  ownerId: string,
  exchangePublicKey: CryptoKey,
  identityPrivateKey: CryptoKey,
  identityPublicKey: CryptoKey,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<SignedLocationKeyBundle> {
  if (
    exchangePublicKey.type !== "public" ||
    identityPrivateKey.type !== "private" ||
    identityPublicKey.type !== "public" ||
    exchangePublicKey.usages.length !== 0 ||
    !identityPrivateKey.usages.includes("sign") ||
    !identityPublicKey.usages.includes("verify") ||
    exchangePublicKey.algorithm.name !== "ECDH" ||
    identityPrivateKey.algorithm.name !== "ECDSA" ||
    identityPublicKey.algorithm.name !== "ECDSA" ||
    (exchangePublicKey.algorithm as EcKeyAlgorithm).namedCurve !== "P-256" ||
    (identityPrivateKey.algorithm as EcKeyAlgorithm).namedCurve !== "P-256" ||
    (identityPublicKey.algorithm as EcKeyAlgorithm).namedCurve !== "P-256"
  ) {
    throw new Error("Types de clés incompatibles pour la signature.");
  }
  const exchangeJwk = await cryptoProvider.subtle.exportKey("jwk", exchangePublicKey);
  const identityJwk = await cryptoProvider.subtle.exportKey("jwk", identityPublicKey);
  const signature = await cryptoProvider.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    identityPrivateKey,
    toArrayBuffer(canonicalBundlePayload(ownerId, exchangeJwk)),
  );
  const bundle: SignedLocationKeyBundle = {
    version: 1,
    ownerId,
    exchangePublicKey: exchangeJwk,
    identityPublicKey: identityJwk,
    signature: new Uint8Array(signature),
  };
  if (!(await verifyLocationKeyBundle(bundle, cryptoProvider))) {
    throw new Error("La clé privée de signature ne correspond pas à la clé publique fournie.");
  }
  return bundle;
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
  try {
    if (
      typeof bundle !== "object" ||
      bundle === null ||
      bundle.version !== 1 ||
      typeof bundle.ownerId !== "string" ||
      !bundle.ownerId.trim() ||
      bundle.ownerId.length > 256 ||
      [...bundle.ownerId].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
      !isP256PublicJwk(bundle.identityPublicKey) ||
      !isP256PublicJwk(bundle.exchangePublicKey) ||
      !(bundle.signature instanceof Uint8Array) ||
      bundle.signature.byteLength !== 64
    ) {
      return false;
    }

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
      toArrayBuffer(canonicalBundlePayload(bundle.ownerId, bundle.exchangePublicKey)),
    );
  } catch {
    return false;
  }
}

/**
 * Empreinte courte à comparer par un canal indépendant (en personne ou
 * appel vocal/vidéo). Ne jamais traiter une empreinte reçue du même serveur
 * que la clé comme une preuve d'identité.
 */
export async function fingerprintLocationIdentityKey(
  identityPublicKey: JsonWebKey,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<string> {
  if (!isP256PublicJwk(identityPublicKey)) {
    throw new Error("La clé d'identité publique P-256 est invalide.");
  }
  const canonical = encoder.encode(JSON.stringify([
    "SAC:identity-fingerprint:v1",
    identityPublicKey.kty,
    identityPublicKey.crv,
    identityPublicKey.x,
    identityPublicKey.y,
  ]));
  const digest = new Uint8Array(await cryptoProvider.subtle.digest("SHA-256", canonical));
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return hex.toUpperCase().match(/.{1,4}/g)!.join(" ");
}
