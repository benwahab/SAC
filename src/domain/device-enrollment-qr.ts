const SCHEME = "sac-pair:";
const HOST = "v1";
const MAX_QR_LENGTH = 512;
const BASE64URL_16_BYTES = /^[A-Za-z0-9_-]{22}$/;
const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/;

export type DeviceEnrollmentQrMode = "retrieve" | "bootstrap";

export interface DeviceEnrollmentQrPayload {
  readonly mode: DeviceEnrollmentQrMode;
  readonly id: string;
  readonly secret: string;
  readonly expiresAt: number;
}

export type DeviceEnrollmentQrError =
  | "qr_too_long"
  | "qr_invalid_uri"
  | "qr_invalid_scheme"
  | "qr_invalid_version"
  | "qr_invalid_query"
  | "qr_duplicate_field"
  | "qr_unknown_field"
  | "qr_invalid_mode"
  | "qr_invalid_id"
  | "qr_invalid_secret"
  | "qr_invalid_expiry"
  | "qr_expired";

export type DeviceEnrollmentQrResult =
  | { readonly ok: true; readonly payload: DeviceEnrollmentQrPayload }
  | { readonly ok: false; readonly error: DeviceEnrollmentQrError };

function isMode(value: string): value is DeviceEnrollmentQrMode {
  return value === "retrieve" || value === "bootstrap";
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function isCanonicalBase64Url(value: string, byteLength: number): boolean {
  const expected = byteLength === 16 ? BASE64URL_16_BYTES : BASE64URL_32_BYTES;
  if (!expected.test(value)) return false;
  const decoded = decodeBase64Url(value);
  if (!decoded || decoded.byteLength !== byteLength) return false;
  let reencoded = "";
  for (const byte of decoded) reencoded += String.fromCharCode(byte);
  return btoa(reencoded).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") === value;
}

export function formatDeviceEnrollmentQr(payload: DeviceEnrollmentQrPayload): string {
  if (!isMode(payload.mode) ||
    !isCanonicalBase64Url(payload.id, 16) ||
    !isCanonicalBase64Url(payload.secret, 32) ||
    !Number.isSafeInteger(payload.expiresAt) ||
    payload.expiresAt <= 0) {
    throw new Error("device_enrollment_qr_invalid");
  }
  return SCHEME + "//" + HOST +
    "?m=" + payload.mode +
    "&id=" + payload.id +
    "&s=" + payload.secret +
    "&e=" + payload.expiresAt;
}

export function parseDeviceEnrollmentQr(value: string, now: number): DeviceEnrollmentQrResult {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_QR_LENGTH) {
    return { ok: false, error: "qr_too_long" };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "qr_invalid_uri" };
  }

  if (url.protocol !== SCHEME) return { ok: false, error: "qr_invalid_scheme" };
  if (url.host !== HOST || url.pathname !== "" || url.username || url.password || url.port || url.hash) {
    return { ok: false, error: "qr_invalid_version" };
  }

  const fields = new Map<string, string>();
  for (const part of url.search.slice(1).split("&")) {
    if (!part) return { ok: false, error: "qr_invalid_query" };
    const separator = part.indexOf("=");
    if (separator <= 0) return { ok: false, error: "qr_invalid_query" };
    let key: string;
    let fieldValue: string;
    try {
      key = decodeURIComponent(part.slice(0, separator));
      fieldValue = decodeURIComponent(part.slice(separator + 1));
    } catch {
      return { ok: false, error: "qr_invalid_query" };
    }
    if (fields.has(key)) return { ok: false, error: "qr_duplicate_field" };
    fields.set(key, fieldValue);
  }

  const allowedFields = new Set(["m", "id", "s", "e"]);
  for (const key of fields.keys()) {
    if (!allowedFields.has(key)) return { ok: false, error: "qr_unknown_field" };
  }
  if (fields.size !== 4) return { ok: false, error: "qr_invalid_query" };

  const mode = fields.get("m") as string;
  const id = fields.get("id") as string;
  const secret = fields.get("s") as string;
  const expiry = fields.get("e") as string;

  if (!isMode(mode)) return { ok: false, error: "qr_invalid_mode" };
  if (!isCanonicalBase64Url(id, 16)) return { ok: false, error: "qr_invalid_id" };
  if (!isCanonicalBase64Url(secret, 32)) return { ok: false, error: "qr_invalid_secret" };
  if (!/^[0-9]+$/.test(expiry)) return { ok: false, error: "qr_invalid_expiry" };

  const expiresAt = Number(expiry);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    return { ok: false, error: "qr_invalid_expiry" };
  }
  if (expiresAt <= now) return { ok: false, error: "qr_expired" };

  return { ok: true, payload: { mode, id, secret, expiresAt } };
}
