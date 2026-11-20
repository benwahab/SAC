const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function signGpsRelayTicket(
  secret: string,
  claims: { alertId: string; accountId: string; deviceId: string; sessionId: string; role: "author" | "recipient"; exp: number; scope: "connect" | "close"; jti?: string },
): Promise<string> {
  if (secret.length < 32) throw new Error("gps_relay_secret_invalid");
  const payload = toBase64Url(encoder.encode(JSON.stringify(claims)));
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return payload + "." + toBase64Url(signature);
}
