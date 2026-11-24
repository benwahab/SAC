/**
 * Identifiant d'appareil non authentifiant, utilisé uniquement pour réutiliser
 * la ligne `devices` d'un même navigateur lors d'une connexion par mot de passe.
 * Il ne remplace ni le mot de passe, ni la session, ni un contrôle D1.
 */
export const DEVICE_COOKIE_NAME = "__Host-sac_device";
export const DEVICE_COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isDeviceIdentifier(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function createDeviceCookie(deviceId: string): string {
  if (!isDeviceIdentifier(deviceId)) throw new TypeError("invalid_device_cookie_identifier");
  return [
    `${DEVICE_COOKIE_NAME}=${deviceId}`,
    "Path=/",
    "Max-Age=" + DEVICE_COOKIE_MAX_AGE_SECONDS,
    "Secure",
    "HttpOnly",
    "SameSite=Strict",
  ].join("; ");
}

export function readDeviceCookie(request: Request): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;

  let found: string | null = null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== DEVICE_COOKIE_NAME) continue;
    if (found !== null) return null;

    const value = part.slice(separator + 1).trim();
    if (!isDeviceIdentifier(value)) return null;
    found = value;
  }
  return found;
}
