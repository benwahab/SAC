/**
 * Construction côté serveur des options de création de la credential racine.
 *
 * Ce module ne constitue pas un endpoint et ne persiste pas le challenge.
 * L'appelant doit enregistrer le challenge avec une cérémonie D1 à usage
 * unique avant de remettre ces options au navigateur.
 */
export type RootResidentKeyPolicy = "required" | "preferred" | "discouraged";

export interface RootRegistrationOptionsInput {
  rpId: string;
  rpName: string;
  userHandle: Uint8Array;
  userName: string;
  userDisplayName: string;
  residentKey: RootResidentKeyPolicy;
  excludeCredentialIds?: readonly Uint8Array[];
}

export interface RootRegistrationOptionsJSON {
  challenge: string;
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: [{ type: "public-key"; alg: -7 }];
  timeout: 300_000;
  authenticatorSelection: {
    authenticatorAttachment: "platform";
    residentKey: RootResidentKeyPolicy;
    requireResidentKey: boolean;
    userVerification: "required";
  };
  attestation: "none";
  excludeCredentials?: Array<{
    type: "public-key";
    id: string;
    transports?: AuthenticatorTransport[];
  }>;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function isValidRpId(value: string): boolean {
  if (value.length < 1 || value.length > 253 || value !== value.toLowerCase()) return false;
  if (!/^[a-z0-9.-]+$/.test(value) || value.startsWith(".") || value.endsWith(".")) return false;
  return value.split(".").every((label) =>
    label.length > 0 && label.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  );
}

/**
 * Génère les options du profil racine SAC. residentKey reste une décision
 * explicite de configuration, car sa compatibilité Android n'est pas figée.
 */
export function createRootRegistrationOptions(
  input: RootRegistrationOptionsInput,
  random: Pick<Crypto, "getRandomValues">,
): RootRegistrationOptionsJSON {
  if (
    !input ||
    typeof input !== "object" ||
    !isValidRpId(input.rpId) ||
    typeof input.rpName !== "string" ||
    !input.rpName.trim() ||
    input.rpName.length > 128 ||
    !(input.userHandle instanceof Uint8Array) ||
    input.userHandle.byteLength < 1 ||
    input.userHandle.byteLength > 64 ||
    typeof input.userName !== "string" ||
    !input.userName.trim() ||
    input.userName.length > 254 ||
    typeof input.userDisplayName !== "string" ||
    !input.userDisplayName.trim() ||
    input.userDisplayName.length > 128 ||
    !["required", "preferred", "discouraged"].includes(input.residentKey)
  ) {
    throw new Error("root_registration_configuration_invalid");
  }

  const challenge = random.getRandomValues(new Uint8Array(32));
  const options: RootRegistrationOptionsJSON = {
    challenge: encodeBase64Url(challenge),
    rp: { id: input.rpId, name: input.rpName.trim() },
    user: {
      id: encodeBase64Url(input.userHandle),
      name: input.userName.trim(),
      displayName: input.userDisplayName.trim(),
    },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    timeout: 300_000,
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: input.residentKey,
      requireResidentKey: input.residentKey === "required",
      userVerification: "required",
    },
    attestation: "none",
  };

  if (input.excludeCredentialIds?.length) {
    if (input.excludeCredentialIds.length > 32) {
      throw new Error("root_registration_exclude_list_too_large");
    }
    options.excludeCredentials = input.excludeCredentialIds.map((id) => {
      if (!(id instanceof Uint8Array) || id.byteLength < 1 || id.byteLength > 1024) {
        throw new Error("root_registration_exclude_credential_invalid");
      }
      return { type: "public-key", id: encodeBase64Url(id) };
    });
  }

  return options;
}
