const ALLOWED_PUSH_HOSTS = new Set([
  "fcm.googleapis.com",
  "fcmregistrations.googleapis.com",
  "jmt17.google.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
]);

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), c => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Only known public Web Push services may receive requests from the delivery worker. */
export function isAllowedPushEndpoint(endpoint: string): URL | null {
  try {
    const url = new URL(endpoint);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port !== "" && url.port !== "443") ||
      !ALLOWED_PUSH_HOSTS.has(url.hostname.toLowerCase()) ||
      url.hostname.endsWith(".local") ||
      url.hostname.endsWith(".localhost")
    ) return null;
    return url;
  } catch {
    return null;
  }
}

/** Validate the browser's P-256 ECDH public key before storing its subscription. */
export async function isValidPushSubscriptionPublicKey(
  value: string,
  cryptoProvider: Crypto = crypto,
): Promise<boolean> {
  const bytes = decodeBase64Url(value);
  if (!bytes || bytes.byteLength !== 65 || bytes[0] !== 4) return false;
  try {
    await cryptoProvider.subtle.importKey(
      "raw",
      bytes as BufferSource,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    return true;
  } catch {
    return false;
  }
}
