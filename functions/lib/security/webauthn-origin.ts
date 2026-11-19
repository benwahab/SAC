/**
 * Contrôle strict du couple origine WebAuthn / RP ID.
 *
 * La liste des origines autorisées doit provenir de la configuration serveur,
 * jamais d'un en-tête fourni librement par le client.
 */
export function isAllowedWebAuthnOrigin(
  origin: unknown,
  rpId: unknown,
  allowedOrigins: readonly string[],
): boolean {
  if (
    typeof origin !== "string" ||
    typeof rpId !== "string" ||
    !Array.isArray(allowedOrigins) ||
    allowedOrigins.length === 0
  ) return false;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.origin !== origin ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) return false;

  const hostname = parsed.hostname.toLowerCase();
  const normalizedRpId = rpId.toLowerCase();
  if (
    hostname !== normalizedRpId &&
    !hostname.endsWith("." + normalizedRpId)
  ) return false;

  return allowedOrigins.some((candidate) => {
    if (typeof candidate !== "string") return false;
    try {
      const allowed = new URL(candidate);
      return allowed.protocol === "https:" &&
        allowed.origin === candidate &&
        allowed.username === "" &&
        allowed.password === "" &&
        allowed.pathname === "/" &&
        allowed.search === "" &&
        allowed.hash === "" &&
        allowed.origin === parsed.origin;
    } catch {
      return false;
    }
  });
}
