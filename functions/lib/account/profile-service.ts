import {
  decodeProfilePhoto,
  validateProfileNames,
  type PrivacyKey,
  type ProfileValidationError,
} from "../../../src/domain/account-profile.ts";

type AccountDatabase = Pick<D1Database, "prepare" | "batch">;

export type AccountServiceError =
  | "invalid_input"
  | "invalid_first_name"
  | "invalid_last_name"
  | "invalid_photo"
  | "photo_too_large"
  | "profile_names_required"
  | "profile_not_found"
  | "photo_not_found"
  | "storage_unavailable";

export type AccountServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AccountServiceError };

export interface OwnProfile {
  readonly accountId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly phoneVerified: boolean;
  readonly photoUrl: string | null;
  readonly photoVersion: number;
  readonly privacy: Record<PrivacyKey, boolean>;
}

export interface AuthorizedPhoto {
  readonly mime: string;
  readonly base64: string;
  readonly version: number;
}

function fail<T>(error: AccountServiceError): AccountServiceResult<T> {
  return { ok: false, error };
}

function profileError(error: ProfileValidationError): AccountServiceError {
  return error === "invalid_search_query" ? "invalid_input" : error;
}

export async function logAccountEvent(
  db: AccountDatabase,
  accountId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
  now = Date.now(),
): Promise<void> {
  const serialized = JSON.stringify(metadata);
  try {
    await db.prepare(
      `INSERT INTO account_activity_log (id, account_id, event_type, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      accountId,
      eventType,
      serialized.length <= 2000 ? serialized : JSON.stringify({ truncated: true }),
      now,
    ).run();
  } catch {
    // L'audit ne doit pas annuler une opération déjà validée.
  }
}

export function photoUrl(accountId: string, version: number): string | null {
  return version > 0 ? `/api/profile/photo/${encodeURIComponent(accountId)}?v=${version}` : null;
}

export async function getOwnAccountProfile(
  db: AccountDatabase,
  accountId: string,
): Promise<AccountServiceResult<OwnProfile>> {
  if (!accountId) return fail("invalid_input");
  try {
    const row = await db.prepare(
      `SELECT a.id AS account_id,
              COALESCE(p.first_name, '') AS first_name,
              COALESCE(p.last_name, '') AS last_name,
              COALESCE(p.photo_version, 0) AS photo_version,
              p.photo_mime,
              COALESCE(email.normalized_value, '') AS email,
              COALESCE(phone.normalized_value, '') AS phone,
              phone.verified_at AS phone_verified_at,
              COALESCE(pr.search_by_name, 0) AS search_by_name,
              COALESCE(pr.search_by_email, 0) AS search_by_email,
              COALESCE(pr.photo_visible_in_search, 0) AS photo_visible_in_search,
              COALESCE(pr.photo_visible_to_contacts, 1) AS photo_visible_to_contacts
       FROM accounts a
       LEFT JOIN account_profiles p ON p.account_id = a.id
       LEFT JOIN account_identities email
         ON email.account_id = a.id AND email.channel = 'email' AND email.is_primary = 1
       LEFT JOIN account_identities phone
         ON phone.account_id = a.id AND phone.channel = 'phone' AND phone.is_primary = 1
       LEFT JOIN account_privacy_settings pr ON pr.account_id = a.id
       WHERE a.id = ?
       LIMIT 1`,
    ).bind(accountId).first<Record<string, unknown>>();

    if (!row || typeof row.account_id !== "string") return fail("profile_not_found");
    const version = typeof row.photo_version === "number" ? row.photo_version : 0;
    return {
      ok: true,
      value: {
        accountId: row.account_id,
        firstName: String(row.first_name ?? ""),
        lastName: String(row.last_name ?? ""),
        email: String(row.email ?? ""),
        phone: String(row.phone ?? ""),
        phoneVerified: typeof row.phone_verified_at === "number",
        photoUrl: row.photo_mime ? photoUrl(row.account_id, version) : null,
        photoVersion: version,
        privacy: {
          searchByName: row.search_by_name === 1,
          searchByEmail: row.search_by_email === 1,
          photoVisibleInSearch: row.photo_visible_in_search === 1,
          photoVisibleToContacts: row.photo_visible_to_contacts === 1,
        },
      },
    };
  } catch {
    return fail("storage_unavailable");
  }
}

export async function updateProfileNames(
  db: AccountDatabase,
  accountId: string,
  input: { readonly firstName: unknown; readonly lastName: unknown },
  now = Date.now(),
): Promise<AccountServiceResult<{ firstName: string; lastName: string }>> {
  const names = validateProfileNames(input);
  if (!names.ok) return fail(profileError(names.error));
  try {
    const result = await db.batch([
      db.prepare(
        `INSERT INTO account_profiles (account_id, first_name, last_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(account_id) DO UPDATE SET
           first_name = excluded.first_name,
           last_name = excluded.last_name,
           updated_at = excluded.updated_at`,
      ).bind(accountId, names.value.firstName, names.value.lastName, now, now),
      db.prepare(
        `INSERT OR IGNORE INTO account_privacy_settings
         (account_id, search_by_name, search_by_email, photo_visible_in_search, photo_visible_to_contacts, updated_at)
         VALUES (?, 0, 0, 0, 1, ?)`,
      ).bind(accountId, now),
    ]);
    if (!result[0]?.success || result[0].meta.changes !== 1 || result.some((entry) => !entry.success)) {
      return fail("storage_unavailable");
    }
    await logAccountEvent(db, accountId, "profile_names_updated", {}, now);
    return { ok: true, value: names.value };
  } catch {
    return fail("storage_unavailable");
  }
}

export async function updatePrivacy(
  db: AccountDatabase,
  accountId: string,
  input: Record<string, unknown>,
  now = Date.now(),
): Promise<AccountServiceResult<Record<PrivacyKey, boolean>>> {
  const keys: PrivacyKey[] = ["searchByName", "searchByEmail", "photoVisibleInSearch", "photoVisibleToContacts"];
  try {
    const existing = await db.prepare(
      `SELECT search_by_name, search_by_email, photo_visible_in_search, photo_visible_to_contacts
       FROM account_privacy_settings WHERE account_id = ? LIMIT 1`,
    ).bind(accountId).first<Record<string, number>>();
    const values: Record<PrivacyKey, boolean> = {
      searchByName: existing?.search_by_name === 1,
      searchByEmail: existing?.search_by_email === 1,
      photoVisibleInSearch: existing?.photo_visible_in_search === 1,
      photoVisibleToContacts: existing ? existing.photo_visible_to_contacts === 1 : true,
    };
    for (const key of keys) {
      if (input[key] !== undefined) {
        if (typeof input[key] !== "boolean") return fail("invalid_input");
        values[key] = input[key] as boolean;
      }
    }

    const result = await db.prepare(
      `INSERT INTO account_privacy_settings
       (account_id, search_by_name, search_by_email, photo_visible_in_search, photo_visible_to_contacts, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET
         search_by_name = excluded.search_by_name,
         search_by_email = excluded.search_by_email,
         photo_visible_in_search = excluded.photo_visible_in_search,
         photo_visible_to_contacts = excluded.photo_visible_to_contacts,
         updated_at = excluded.updated_at`,
    ).bind(
      accountId,
      values.searchByName ? 1 : 0,
      values.searchByEmail ? 1 : 0,
      values.photoVisibleInSearch ? 1 : 0,
      values.photoVisibleToContacts ? 1 : 0,
      now,
    ).run();
    if (!result.success || result.meta.changes !== 1) return fail("storage_unavailable");
    await logAccountEvent(db, accountId, "privacy_updated", {}, now);
    return { ok: true, value: values };
  } catch {
    return fail("storage_unavailable");
  }
}

export async function setProfilePhoto(
  db: AccountDatabase,
  accountId: string,
  dataUrl: unknown,
  now = Date.now(),
): Promise<AccountServiceResult<{ photoUrl: string; photoVersion: number }>> {
  const photo = decodeProfilePhoto(dataUrl);
  if (!photo.ok) return fail(profileError(photo.error));
  try {
    const profile = await db.prepare(
      "SELECT 1 AS present FROM account_profiles WHERE account_id = ? LIMIT 1",
    ).bind(accountId).first<{ present: number }>();
    if (!profile?.present) return fail("profile_names_required");
    const result = await db.prepare(
      `UPDATE account_profiles
       SET photo_mime = ?, photo_data = ?, photo_version = photo_version + 1, updated_at = ?
       WHERE account_id = ?`,
    ).bind(photo.value.mime, photo.value.base64, now, accountId).run();
    if (!result.success || result.meta.changes !== 1) return fail("storage_unavailable");
    const row = await db.prepare(
      "SELECT photo_version FROM account_profiles WHERE account_id = ?",
    ).bind(accountId).first<{ photo_version: number }>();
    const version = row?.photo_version ?? 1;
    await logAccountEvent(db, accountId, "profile_photo_updated", { version }, now);
    return { ok: true, value: { photoUrl: photoUrl(accountId, version) as string, photoVersion: version } };
  } catch {
    return fail("storage_unavailable");
  }
}

export async function deleteProfilePhoto(
  db: AccountDatabase,
  accountId: string,
  now = Date.now(),
): Promise<AccountServiceResult<{ deleted: true }>> {
  try {
    const result = await db.prepare(
      `UPDATE account_profiles
       SET photo_mime = NULL, photo_data = NULL, photo_version = photo_version + 1, updated_at = ?
       WHERE account_id = ?`,
    ).bind(now, accountId).run();
    if (!result.success || result.meta.changes !== 1) return fail("photo_not_found");
    await logAccountEvent(db, accountId, "profile_photo_deleted", {}, now);
    return { ok: true, value: { deleted: true } };
  } catch {
    return fail("storage_unavailable");
  }
}

export async function getAuthorizedPhoto(
  db: AccountDatabase,
  viewerAccountId: string,
  targetAccountId: string,
): Promise<AccountServiceResult<AuthorizedPhoto>> {
  if (!viewerAccountId || !targetAccountId) return fail("invalid_input");
  try {
    const row = await db.prepare(
      `SELECT p.photo_mime, p.photo_data, p.photo_version,
              COALESCE(pr.photo_visible_in_search, 0) AS photo_search,
              COALESCE(pr.photo_visible_to_contacts, 1) AS photo_contacts,
              COALESCE(pr.search_by_name, 0) AS search_name,
              COALESCE(pr.search_by_email, 0) AS search_email,
              CASE WHEN ? = p.account_id THEN 1 ELSE 0 END AS is_self,
              CASE WHEN EXISTS (
                SELECT 1
                FROM close_relations r
                JOIN close_relation_permissions cp
                  ON cp.relation_id = r.id
                 AND cp.grantor_account_id = p.account_id
                 AND cp.grantee_account_id = ?
                 AND cp.permission_key = 'profile_photo'
                 AND cp.status = 'active'
                WHERE r.status = 'active'
                  AND ((r.account_low_id = p.account_id AND r.account_high_id = ?)
                    OR (r.account_high_id = p.account_id AND r.account_low_id = ?))
              ) THEN 1 ELSE 0 END AS relation_photo
       FROM account_profiles p
       JOIN accounts a ON a.id = p.account_id AND a.status = 'active'
       LEFT JOIN account_privacy_settings pr ON pr.account_id = p.account_id
       WHERE p.account_id = ? AND p.photo_mime IS NOT NULL AND p.photo_data IS NOT NULL
       LIMIT 1`,
    ).bind(
      viewerAccountId,
      viewerAccountId,
      viewerAccountId,
      viewerAccountId,
      targetAccountId,
    ).first<Record<string, unknown>>();
    if (!row || typeof row.photo_mime !== "string" || typeof row.photo_data !== "string") {
      return fail("photo_not_found");
    }
    const searchable = row.search_name === 1 || row.search_email === 1;
    const allowed = row.is_self === 1
      || (row.relation_photo === 1 && row.photo_contacts === 1)
      || (row.photo_search === 1 && searchable);
    if (!allowed) return fail("photo_not_found");
    return {
      ok: true,
      value: {
        mime: row.photo_mime,
        base64: row.photo_data,
        version: typeof row.photo_version === "number" ? row.photo_version : 0,
      },
    };
  } catch {
    return fail("storage_unavailable");
  }
}

