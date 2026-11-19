const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generateContactInvitationToken(random: Pick<Crypto, "getRandomValues">): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  random.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function digestContactInvitationToken(
  cryptoProvider: Pick<Crypto, "subtle">,
  token: string,
): Promise<string> {
  if (!TOKEN_PATTERN.test(token)) throw new TypeError("invalid_invitation_token");
  const digest = new Uint8Array(await cryptoProvider.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isContactInvitationTokenFormat(token: unknown): token is string {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}
