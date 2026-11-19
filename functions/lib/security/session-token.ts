/**
 * Émission des jetons opaques de session SAC.
 *
 * À utiliser côté serveur uniquement. Le jeton brut est remis une seule fois
 * au client sécurisé ; seule son empreinte SHA-256 est destinée à D1.
 * Ne jamais journaliser le jeton ni le placer dans une URL.
 */
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TOKEN_DOMAIN = "SAC:session-token:v1:";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromCanonicalBase64Url(value: string): Uint8Array | null {
  if (!TOKEN_PATTERN.test(value) || !/[AQgw]$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Uint8Array.from(atob(base64 + "="), (character) => character.charCodeAt(0));
    return decoded.length === TOKEN_BYTES && toBase64Url(decoded) === value ? decoded : null;
  } catch {
    return null;
  }
}

/** Produit l'empreinte à stocker ; un jeton invalide échoue fermé. */
export async function hashSessionToken(
  cryptoProvider: Pick<Crypto, "subtle">,
  token: string,
): Promise<string | null> {
  if (typeof token !== "string") return null;
  const decoded = fromCanonicalBase64Url(token);
  if (!decoded) return null;
  const message = new TextEncoder().encode(TOKEN_DOMAIN + token);
  const digest = new Uint8Array(await cryptoProvider.subtle.digest("SHA-256", message));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Crée un jeton imprévisible de 256 bits et son empreinte.
 * Le résultat brut doit être transmis une seule fois via un canal HTTPS sûr.
 */
export async function createSessionToken(
  cryptoProvider: Pick<Crypto, "subtle" | "getRandomValues">,
): Promise<{ readonly token: string; readonly tokenHash: string }> {
  const random = cryptoProvider.getRandomValues(new Uint8Array(TOKEN_BYTES));
  const token = toBase64Url(random);
  const tokenHash = await hashSessionToken(cryptoProvider, token);
  if (!tokenHash) throw new Error("session_token_generation_failed");
  return { token, tokenHash };
}
