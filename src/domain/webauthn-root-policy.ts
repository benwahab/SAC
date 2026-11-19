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
      readonly reason:
        | "credential_not_single_device"
        | "credential_backed_up"
        | "backup_state_inconsistent";
    };

export function evaluateWebAuthnRootCredentialPolicy(input: {
  credentialDeviceType: RootCredentialDeviceType;
  credentialBackedUp: boolean;
}): RootCredentialPolicyResult {
  if (input.credentialDeviceType === "multiDevice" || input.credentialDeviceType === "unknown") {
    return { accepted: false, reason: "credential_not_single_device" };
  }

  if (input.credentialBackedUp) {
    return { accepted: false, reason: "credential_backed_up" };
  }

  return { accepted: true };
}
