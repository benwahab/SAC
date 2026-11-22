import {
  createRootWebAuthnCredential,
  type RootCredentialCreationOptionsJSON,
  type SerializedRootCredential,
  type WebAuthnCreationPort,
} from "./webauthn.ts";
import { clearStoredPasskeyCredentialId, storePasskeyCredentialId } from "./passkey-storage.ts";

export interface RootEnrollmentCeremony {
  ceremonyId: string;
  expiresAt: number;
  options: RootCredentialCreationOptionsJSON;
}
export interface RootEnrollmentResult {
  enrolled: true;
  device: { id: string; status: "active"; credentialType: "singleDevice"; backedUp: false };
  session: { id: string; expiresAt: string };
}
type FetchPort = typeof fetch;

async function readPayload<T>(response: Response): Promise<T> {
  try { return await response.json() as T; }
  catch { throw new Error("Réponse du serveur SAC invalide."); }
}

export async function requestRootEnrollment(
  email: string,
  password: string,
  fetcher: FetchPort = fetch,
): Promise<RootEnrollmentCeremony> {
  const response = await fetcher("/api/auth/root-enrollment-options", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const payload = await readPayload<RootEnrollmentCeremony & { error?: string }>(response);
  if (!response.ok || !payload.ceremonyId || !payload.options) {
    throw new Error(payload.error ?? "root_enrollment_unavailable");
  }
  return payload;
}

export async function requestRootEnrollmentFromSession(
  fetcher: FetchPort = fetch,
): Promise<RootEnrollmentCeremony> {
  const response = await fetcher("/api/auth/start-root-enrollment", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
  });
  const payload = await readPayload<RootEnrollmentCeremony & { error?: string }>(response);
  if (!response.ok || !payload.ceremonyId || !payload.options) {
    throw new Error(payload.error ?? "root_enrollment_unavailable");
  }
  return payload;
}

export async function completeRootEnrollment(
  ceremony: RootEnrollmentCeremony,
  fetcher: FetchPort = fetch,
  creationPort?: WebAuthnCreationPort,
): Promise<RootEnrollmentResult> {
  if (!ceremony || !ceremony.ceremonyId || ceremony.expiresAt <= Date.now()) {
    throw new Error("enrollment_expired_or_unavailable");
  }
  const credential: SerializedRootCredential = await createRootWebAuthnCredential(
    ceremony.options,
    creationPort,
  );
  const response = await fetcher("/api/auth/complete-root-enrollment", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ceremonyId: ceremony.ceremonyId, credential }),
    cache: "no-store",
  });
  const payload = await readPayload<RootEnrollmentResult & { error?: string }>(response);
  if (!response.ok || !payload.enrolled || !payload.session?.id) {
    throw new Error(payload.error ?? "root_enrollment_failed");
  }
  storePasskeyCredentialId(credential.id);
  return payload;
}

export async function getDeviceSession(fetcher: FetchPort = fetch): Promise<{
  authenticated: boolean; accountId?: string; deviceId?: string; sessionId?: string; securityKeyConfigured?: boolean; credentialId?: string | null;
}> {
  const response = await fetcher("/api/auth/session", {
    method: "GET", credentials: "same-origin", cache: "no-store",
  });
  const payload = await readPayload<{ authenticated: boolean; accountId?: string; deviceId?: string; sessionId?: string; securityKeyConfigured?: boolean; credentialId?: string | null }>(response);
  if (!response.ok || !payload.authenticated) return { authenticated: false };
  if (payload.credentialId) storePasskeyCredentialId(payload.credentialId);
  else if (payload.securityKeyConfigured === false) clearStoredPasskeyCredentialId();
  return payload;
}

export async function logoutDeviceSession(fetcher: FetchPort = fetch): Promise<boolean> {
  const response = await fetcher("/api/auth/logout", {
    method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json" }, body: "{}",
    cache: "no-store",
  });
  const payload = await readPayload<{ loggedOut: boolean }>(response);
  return response.ok && payload.loggedOut === true;
}
