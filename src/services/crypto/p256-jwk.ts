const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Checks a 32-byte P-256 coordinate in canonical unpadded base64url form.
 * A 32-byte value encodes to 43 characters; the final character's two
 * unused low bits must be zero or multiple strings can decode to same bytes.
 */
export function isCanonicalP256Coordinate(value: unknown): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
    return false;
  }
  const last = BASE64URL.indexOf(value[42]);
  return last >= 0 && last % 4 === 0;
}

/** Validates the public mathematical fields of a P-256 EC JWK. */
export function isCanonicalP256PublicJwk(value: unknown): value is JsonWebKey {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const jwk = value as Record<string, unknown>;
  return jwk.kty === "EC" &&
    jwk.crv === "P-256" &&
    isCanonicalP256Coordinate(jwk.x) &&
    isCanonicalP256Coordinate(jwk.y) &&
    !("d" in jwk);
}
