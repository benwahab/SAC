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
      readonly reason: "credential_not_single_device" | "backup_state_inconsistent";
    };

export function evaluateWebAuthnRootCredentialPolicy(input: {
  credentialDeviceType: RootCredentialDeviceType;
  credentialBackedUp: boolean;
}): RootCredentialPolicyResult {
  if (input.credentialDeviceType !== "singleDevice") {
    return { accepted: false, reason: "credential_not_single_device" };
  }

  // BE=0/BS=1 is an invalid WebAuthn state, not an ordinary backed-up root.
  if (input.credentialBackedUp) {
    return { accepted: false, reason: "backup_state_inconsistent" };
  }

  return { accepted: true };
}
