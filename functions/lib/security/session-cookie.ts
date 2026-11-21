/**
 * Cookie HTTP-only pour le jeton opaque de session SAC.
 *
 * Le cookie n'est pas une preuve d'autorisation à lui seul : chaque requête
 * doit encore vérifier l'empreinte en D1, l'état du compte et de l'appareil.
 * Le préfixe __Host- impose Secure, Path=/ et l'absence de Domain.
 */
export const SESSION_COOKIE_NAME = "__Host-sac_session";
export const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CANONICAL_TOKEN_SUFFIX = /[AEIMQUYcgkosw048]$/;

function isCanonicalSessionToken(token: unknown): token is string {
  return typeof token === "string" &&
    TOKEN_PATTERN.test(token) &&
    CANONICAL_TOKEN_SUFFIX.test(token);
}

/** Produit un Set-Cookie strict ; refuse tout jeton non canonique. */
export function createSessionCookie(token: string): string {
  if (!isCanonicalSessionToken(token)) {
    throw new TypeError("invalid_session_cookie_token");
  }

  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "Max-Age=" + SESSION_COOKIE_MAX_AGE_SECONDS,
    "Secure",
    "HttpOnly",
    "SameSite=Strict",
  ].join("; ");
}

/** Lit uniquement le cookie SAC ; les doublons sont refusés sans arbitrage. */
export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;

  let found: string | null = null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    if (found !== null) return null;

    const value = part.slice(separator + 1).trim();
    if (!isCanonicalSessionToken(value)) return null;
    found = value;
  }

  return found;
}

/** Efface le cookie de session sur le même chemin et avec les mêmes attributs. */
export function clearSessionCookie(): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "Secure",
    "HttpOnly",
    "SameSite=Strict",
  ].join("; ");
}
