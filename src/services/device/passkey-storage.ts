const STORAGE_KEY = "sac-passkey-credential-id";

function validCredentialId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,1024}$/.test(value);
}

export function getStoredPasskeyCredentialId(): string | null {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
    return value && validCredentialId(value) ? value : null;
  } catch {
    return null;
  }
}

export function storePasskeyCredentialId(credentialId: string): void {
  if (!validCredentialId(credentialId)) return;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, credentialId);
  } catch {
    // La clé reste utilisable ; seul le raccourci de connexion n'est pas mémorisé.
  }
}

export function clearStoredPasskeyCredentialId(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Le nettoyage local reste facultatif.
  }
}
