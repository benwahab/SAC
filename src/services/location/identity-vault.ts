import { isCanonicalP256PublicJwk } from "../crypto/p256-jwk.ts";

const DATABASE_NAME = "sac-location-identity";
const DATABASE_VERSION = 1;
const STORE_NAME = "identity-keys";
const encoder = new TextEncoder();

export interface LocationIdentityKeyRecord {
  readonly version: 1;
  readonly accountId: string;
  readonly privateKey: CryptoKey;
  readonly publicKey: CryptoKey;
  readonly publicJwk: JsonWebKey;
  readonly createdAt: number;
}

export interface LocationIdentityKeyStore {
  get(accountId: string): Promise<LocationIdentityKeyRecord | null>;
  /** Must be atomic and reject when this account already has a record. */
  add(record: LocationIdentityKeyRecord): Promise<void>;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Lecture du coffre de clés impossible."));
  });
}

function transactionResult(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Transaction du coffre de clés échouée."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Transaction du coffre de clés annulée."));
  });
}

function openDatabase(factory: IDBFactory = globalThis.indexedDB): Promise<IDBDatabase> {
  if (!factory) {
    return Promise.reject(new Error("Le stockage sécurisé local IndexedDB n'est pas disponible."));
  }

  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "accountId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Ouverture du coffre de clés impossible."));
    request.onblocked = () => reject(new Error("Le coffre de clés est bloqué par un autre onglet SAC."));
  });
}

/** IndexedDB stores non-extractable CryptoKey objects, never location payloads. */
export class IndexedDbLocationIdentityKeyStore implements LocationIdentityKeyStore {
  constructor(private readonly factory: IDBFactory = globalThis.indexedDB) {}

  async get(accountId: string): Promise<LocationIdentityKeyRecord | null> {
    const database = await openDatabase(this.factory);
    try {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const completed = transactionResult(transaction);
      const value = await requestResult(
        transaction.objectStore(STORE_NAME).get(accountId) as IDBRequest<LocationIdentityKeyRecord | undefined>,
      );
      await completed;
      return value ?? null;
    } finally {
      database.close();
    }
  }

  async add(record: LocationIdentityKeyRecord): Promise<void> {
    const database = await openDatabase(this.factory);
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const completed = transactionResult(transaction);
      const inserted = requestResult(transaction.objectStore(STORE_NAME).add(record));
      await Promise.all([inserted, completed]);
    } finally {
      database.close();
    }
  }
}

function validKeyPairShape(record: LocationIdentityKeyRecord, accountId: string): boolean {
  return record !== null &&
    typeof record === "object" &&
    record.version === 1 &&
    record.accountId === accountId &&
    Number.isSafeInteger(record.createdAt) &&
    record.createdAt > 0 &&
    record.privateKey?.type === "private" &&
    record.privateKey.extractable === false &&
    record.privateKey.algorithm.name === "ECDSA" &&
    (record.privateKey.algorithm as EcKeyAlgorithm).namedCurve === "P-256" &&
    record.privateKey.usages.includes("sign") &&
    record.publicKey?.type === "public" &&
    record.publicKey.algorithm.name === "ECDSA" &&
    (record.publicKey.algorithm as EcKeyAlgorithm).namedCurve === "P-256" &&
    record.publicKey.usages.includes("verify") &&
    isCanonicalP256PublicJwk(record.publicJwk);
}

async function verifyStoredKeyPair(
  record: LocationIdentityKeyRecord,
  accountId: string,
  cryptoProvider: Crypto,
): Promise<boolean> {
  try {
    if (!validKeyPairShape(record, accountId)) return false;
    const exported = await cryptoProvider.subtle.exportKey("jwk", record.publicKey);
    if (
      exported.kty !== record.publicJwk.kty ||
      exported.crv !== record.publicJwk.crv ||
      exported.x !== record.publicJwk.x ||
      exported.y !== record.publicJwk.y
    ) return false;

    const challenge = encoder.encode("SAC:location-identity-vault:v1:" + accountId);
    const signature = await cryptoProvider.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      record.privateKey,
      challenge,
    );
    return cryptoProvider.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      record.publicKey,
      signature,
      challenge,
    );
  } catch {
    return false;
  }
}

/**
 * Loads or creates the account's local signing identity. The ECDSA private
 * CryptoKey is non-extractable and stored only in IndexedDB. ECDH transport
 * keys remain ephemeral and must be generated in memory for each SOS session.
 */
export async function getOrCreateLocationIdentityKeyPair(
  accountId: string,
  store: LocationIdentityKeyStore = new IndexedDbLocationIdentityKeyStore(),
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<LocationIdentityKeyRecord> {
  if (
    typeof accountId !== "string" ||
    !accountId.trim() ||
    accountId.length > 256 ||
    [...accountId].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  ) {
    throw new Error("L'identifiant du compte est invalide.");
  }

  const existing = await store.get(accountId);
  if (existing) {
    if (!(await verifyStoredKeyPair(existing, accountId, cryptoProvider))) {
      throw new Error("La clé d'identité locale est invalide. Le partage GPS reste désactivé.");
    }
    return existing;
  }

  const pair = await cryptoProvider.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"],
  );
  const publicJwk = await cryptoProvider.subtle.exportKey("jwk", pair.publicKey);
  const record: LocationIdentityKeyRecord = {
    version: 1,
    accountId,
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    publicJwk,
    createdAt: Date.now(),
  };

  try {
    await store.add(record);
    return record;
  } catch (insertError) {
    // Another tab may have won the atomic first-use race. Reuse only the
    // winner's verified key; never return the unpersisted local key pair.
    const winner = await store.get(accountId);
    if (winner && await verifyStoredKeyPair(winner, accountId, cryptoProvider)) {
      return winner;
    }
    throw insertError;
  }
}
