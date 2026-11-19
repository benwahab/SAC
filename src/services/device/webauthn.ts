/**
 * Adaptateur navigateur pour la cérémonie WebAuthn racine SAC.
 *
 * Il ne crée aucune autorité locale : les options doivent venir du serveur,
 * et la credential retournée doit encore être vérifiée et persistée côté serveur.
 * Aucun fallback logiciel n'est proposé.
 */
export type RootCredentialCreationOptionsJSON = Omit<
  PublicKeyCredentialCreationOptions,
  "challenge" | "user" | "excludeCredentials"
> & {
  challenge: string;
  user: Omit<PublicKeyCredentialUserEntity, "id"> & { id: string };
  excludeCredentials?: Array<
    Omit<PublicKeyCredentialDescriptor, "id"> & { id: string }
  >;
};

export interface SerializedRootCredential {
  id: string;
  rawId: string;
  type: "public-key";
  response: {
    clientDataJSON: string;
    attestationObject: string;
    transports: AuthenticatorTransport[];
  };
  clientExtensionResults: AuthenticationExtensionsClientOutputs;
  authenticatorAttachment: string | null;
}

export interface WebAuthnCreationPort {
  isSecureContext(): boolean;
  isSupported(): boolean;
  create(options: PublicKeyCredentialCreationOptions): Promise<Credential | null>;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const result = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(result).set(bytes);
  return result;
}

export function decodeBase64Url(value: string, label: string): Uint8Array {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    !/^[A-Za-z0-9_-]+$/.test(value) ||
    value.length % 4 === 1
  ) {
    throw new Error(`Le champ WebAuthn ${label} est invalide.`);
  }

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  let binary: string;
  try {
    binary = globalThis.atob(padded);
  } catch {
    throw new Error(`Le champ WebAuthn ${label} est invalide.`);
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const canonical = globalThis.btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\\+/g, "-")
    .replace(/\\//g, "_");
  if (canonical !== value) {
    throw new Error(`Le champ WebAuthn ${label} n'est pas un Base64URL canonique.`);
  }
  return bytes;
}

export function normalizeRootCreationOptions(
  input: RootCredentialCreationOptionsJSON,
): PublicKeyCredentialCreationOptions {
  if (
    typeof input !== "object" ||
    input === null ||
    typeof input.rp?.id !== "string" ||
    !input.rp.id ||
    input.authenticatorSelection?.authenticatorAttachment !== "platform" ||
    input.authenticatorSelection.userVerification !== "required" ||
    typeof input.user?.name !== "string" ||
    typeof input.user?.displayName !== "string"
  ) {
    throw new Error("Les options WebAuthn racine fournies par le serveur sont invalides.");
  }

  const challenge = decodeBase64Url(input.challenge, "challenge");
  const userId = decodeBase64Url(input.user.id, "user.id");
  if (challenge.byteLength !== 32 || userId.byteLength < 1 || userId.byteLength > 64) {
    throw new Error("La taille du challenge ou de l'identifiant utilisateur WebAuthn est invalide.");
  }

  const excludeCredentials = input.excludeCredentials?.map((descriptor, index) => {
    const id = decodeBase64Url(descriptor.id, `excludeCredentials[${index}].id`);
    if (id.byteLength < 1 || id.byteLength > 1024) {
      throw new Error("Un identifiant de credential à exclure est invalide.");
    }
    return { ...descriptor, id: toArrayBuffer(id) };
  });

  return {
    ...input,
    challenge: toArrayBuffer(challenge),
    user: { ...input.user, id: toArrayBuffer(userId) },
    ...(excludeCredentials ? { excludeCredentials } : {}),
  };
}

const browserPort: WebAuthnCreationPort = {
  isSecureContext: () => globalThis.isSecureContext === true,
  isSupported: () =>
    typeof globalThis.PublicKeyCredential !== "undefined" &&
    typeof globalThis.navigator?.credentials?.create === "function",
  create: (options) => globalThis.navigator.credentials.create({ publicKey: options }),
};

export async function createRootWebAuthnCredential(
  options: RootCredentialCreationOptionsJSON,
  port: WebAuthnCreationPort = browserPort,
): Promise<SerializedRootCredential> {
  if (!port.isSecureContext()) {
    throw new Error("L'enregistrement sécurisé SAC exige une connexion HTTPS.");
  }
  if (!port.isSupported()) {
    throw new Error("Cet appareil ou navigateur ne prend pas en charge WebAuthn.");
  }

  const publicKey = normalizeRootCreationOptions(options);
  let credential: Credential | null;
  try {
    credential = await port.create(publicKey);
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      throw new Error("La création de la credential SAC a été annulée ou refusée.");
    }
    throw error;
  }
  if (!credential) {
    throw new Error("Aucune credential WebAuthn n'a été créée.");
  }
  if (credential.type !== "public-key") {
    throw new Error("Le navigateur a retourné un type de credential inattendu.");
  }

  const publicKeyCredential = credential as PublicKeyCredential;
  const response = publicKeyCredential.response;
  if (!("attestationObject" in response)) {
    throw new Error("La réponse WebAuthn ne contient pas de preuve d'enregistrement.");
  }
  const attestation = response as AuthenticatorAttestationResponse;
  const transports = typeof attestation.getTransports === "function"
    ? attestation.getTransports()
    : [];

  return {
    id: publicKeyCredential.id,
    rawId: encodeBase64Url(new Uint8Array(publicKeyCredential.rawId)),
    type: "public-key",
    response: {
      clientDataJSON: encodeBase64Url(new Uint8Array(attestation.clientDataJSON)),
      attestationObject: encodeBase64Url(new Uint8Array(attestation.attestationObject)),
      transports,
    },
    clientExtensionResults: publicKeyCredential.getClientExtensionResults(),
    authenticatorAttachment: publicKeyCredential.authenticatorAttachment,
  };
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return globalThis.btoa(binary)
    .replace(/=/g, "")
    .replace(/\\+/g, "-")
    .replace(/\\//g, "_");
}
