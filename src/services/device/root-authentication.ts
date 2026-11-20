export interface RootAuthenticationOptions {
  challengeId: string;
  expiresAt: number;
  publicKey: {
    challenge: string;
    rpId: string;
    timeout: number;
    userVerification: "required";
    allowCredentials: Array<{ type: "public-key"; id: string }>;
  };
}
export interface RootAuthenticationResult {
  authenticated: true;
  session: { id: string; expiresAt: string };
}
type FetchPort = typeof fetch;

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) throw new Error("invalid_authentication_options");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), c => c.charCodeAt(0));
}
function encodeBase64Url(bytes: ArrayBuffer): string {
  const data = new Uint8Array(bytes);
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
async function payload<T>(response: Response): Promise<T> {
  try { return await response.json() as T; }
  catch { throw new Error("Réponse du serveur SAC invalide."); }
}

export async function requestRootAuthentication(email: string, password: string, fetcher: FetchPort = fetch): Promise<RootAuthenticationOptions> {
  const response = await fetcher("/api/auth/login-options", {
    method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }), cache: "no-store",
  });
  const result = await payload<RootAuthenticationOptions & { error?: string }>(response);
  if (!response.ok || !result.challengeId || !result.publicKey) throw new Error(result.error ?? "authentication_unavailable");
  return result;
}

export async function completeRootAuthentication(ceremony: RootAuthenticationOptions, fetcher: FetchPort = fetch): Promise<RootAuthenticationResult> {
  if (!ceremony?.challengeId || ceremony.expiresAt <= Date.now()) throw new Error("authentication_expired_or_unavailable");
  if (!globalThis.isSecureContext || typeof navigator.credentials?.get !== "function") throw new Error("webauthn_not_supported");
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: decodeBase64Url(ceremony.publicKey.challenge),
    rpId: ceremony.publicKey.rpId,
    timeout: ceremony.publicKey.timeout,
    userVerification: "required",
    allowCredentials: ceremony.publicKey.allowCredentials.map(item => ({
      type: "public-key",
      id: decodeBase64Url(item.id).buffer,
    })),
  };
  const credential = await navigator.credentials.get({ publicKey });
  if (!(credential instanceof PublicKeyCredential) || !(credential.response instanceof AuthenticatorAssertionResponse)) {
    throw new Error("webauthn_assertion_missing");
  }
  const responseData = credential.response;
  const response = await fetcher("/api/auth/login", {
    method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challengeId: ceremony.challengeId,
      credential: {
        id: credential.id,
        rawId: encodeBase64Url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: encodeBase64Url(responseData.clientDataJSON),
          authenticatorData: encodeBase64Url(responseData.authenticatorData),
          signature: encodeBase64Url(responseData.signature),
          userHandle: responseData.userHandle ? encodeBase64Url(responseData.userHandle) : null,
        },
      },
    }),
    cache: "no-store",
  });
  const result = await payload<RootAuthenticationResult & { error?: string }>(response);
  if (!response.ok || !result.authenticated || !result.session?.id) throw new Error(result.error ?? "invalid_authentication");
  return result;
}
