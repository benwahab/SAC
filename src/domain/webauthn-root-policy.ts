/**
 * Politique produit validée pour la credential racine WebAuthn SAC V1.
 * BE=0/BS=0 est obligatoire : aucune credential synchronisable ni fallback.
 * Cette fonction vérifie les indicateurs fournis par le validateur WebAuthn ;
 * elle ne remplace jamais la vérification cryptographique de la réponse.
 */
export type RootCredentialDeviceType = "singleDevice" | "multiDevice" | "unknown";

export type RootCredentialPolicyResult =
  | { readonly accepted: true }
  | {
      readonly accepted: false;
      readonly reason: "credential_not_single_device" | "backup_state_inconsistent" | "user_verification_missing";
    };

export function evaluateWebAuthnRootCredentialPolicy(
  input: unknown,
): RootCredentialPolicyResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { accepted: false, reason: "credential_not_single_device" };
  }

  const candidate = input as Record<string, unknown>;
  if (candidate.userVerified !== true) {
    return { accepted: false, reason: "user_verification_missing" };
  }
  if (
    candidate.credentialDeviceType !== "singleDevice" &&
    candidate.credentialDeviceType !== "multiDevice" &&
    candidate.credentialDeviceType !== "unknown"
  ) {
    return { accepted: false, reason: "credential_not_single_device" };
  }

  if (candidate.credentialDeviceType !== "singleDevice") {
    return { accepted: false, reason: "credential_not_single_device" };
  }

  if (typeof candidate.credentialBackedUp !== "boolean") {
    return { accepted: false, reason: "backup_state_inconsistent" };
  }

  // BE=0/BS=1 is an invalid WebAuthn state, not an ordinary backed-up root.
  if (candidate.credentialBackedUp) {
    return { accepted: false, reason: "backup_state_inconsistent" };
  }

  return { accepted: true };
}
