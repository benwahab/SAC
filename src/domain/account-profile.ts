export const MAX_PROFILE_PHOTO_BYTES = 300_000;
export const MAX_PROFILE_PHOTO_BASE64_LENGTH = 400_000;

export type ProfilePhotoMime = "image/jpeg" | "image/png" | "image/webp";

export type ProfileValidationError =
  | "invalid_first_name"
  | "invalid_last_name"
  | "invalid_search_query"
  | "invalid_photo"
  | "photo_too_large";

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\p{Zs}'’.-]*$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePersonName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length === 0 || name.length > 80) return null;
  if (/[\u0000-\u001f\u007f]/.test(name) || !NAME_PATTERN.test(name)) return null;
  return name;
}

export function validateProfileNames(input: {
  readonly firstName: unknown;
  readonly lastName: unknown;
}): { ok: true; value: { firstName: string; lastName: string } } | { ok: false; error: ProfileValidationError } {
  const firstName = normalizePersonName(input.firstName);
  if (!firstName) return { ok: false, error: "invalid_first_name" };
  const lastName = normalizePersonName(input.lastName);
  if (!lastName) return { ok: false, error: "invalid_last_name" };
  return { ok: true, value: { firstName, lastName } };
}

export function normalizeDirectoryNameQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const query = value.trim().replace(/\s+/g, " ");
  if (query.length < 2 || query.length > 80) return null;
  if (/[\u0000-\u001f\u007f]/.test(query)) return null;
  return query;
}

export function normalizeDirectoryEmailQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

function decodeBase64(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function matchesMagic(bytes: Uint8Array, mime: ProfilePhotoMime): boolean {
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  return bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

export function decodeProfilePhoto(dataUrl: unknown):
  | { ok: true; value: { mime: ProfilePhotoMime; base64: string; bytes: Uint8Array } }
  | { ok: false; error: ProfileValidationError } {
  if (typeof dataUrl !== "string" || dataUrl.length > MAX_PROFILE_PHOTO_BASE64_LENGTH + 64) {
    return { ok: false, error: "invalid_photo" };
  }
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) return { ok: false, error: "invalid_photo" };
  const mime = match[1] as ProfilePhotoMime;
  const base64 = match[2];
  if (base64.length > MAX_PROFILE_PHOTO_BASE64_LENGTH) return { ok: false, error: "photo_too_large" };
  const bytes = decodeBase64(base64);
  if (!bytes || bytes.length < 32) return { ok: false, error: "invalid_photo" };
  if (bytes.length > MAX_PROFILE_PHOTO_BYTES) return { ok: false, error: "photo_too_large" };
  if (!matchesMagic(bytes, mime)) return { ok: false, error: "invalid_photo" };
  return { ok: true, value: { mime, base64, bytes } };
}

export type PrivacyKey =
  | "searchByName"
  | "searchByEmail"
  | "photoVisibleInSearch"
  | "photoVisibleToContacts";

export const PRIVACY_KEYS: readonly PrivacyKey[] = [
  "searchByName",
  "searchByEmail",
  "photoVisibleInSearch",
  "photoVisibleToContacts",
];

export type RelationState = "none" | "connected" | "invitation_sent" | "invitation_received";

export type RelationPermissionKey = "profile_photo" | "contact_details";
export const RELATION_PERMISSION_KEYS: readonly RelationPermissionKey[] = ["profile_photo", "contact_details"];

export function isRelationPermissionKey(value: unknown): value is RelationPermissionKey {
  return value === "profile_photo" || value === "contact_details";
}

export function canonicalAccountPair(left: string, right: string): { low: string; high: string; key: string } {
  if (!left || !right || left === right) throw new Error("invalid_account_pair");
  const low = left < right ? left : right;
  const high = left < right ? right : left;
  return { low, high, key: `${low}:${high}` };
}
