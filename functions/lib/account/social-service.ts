import {
  canonicalAccountPair,
  normalizeDirectoryEmailQuery,
  normalizeDirectoryNameQuery,
  isRelationPermissionKey,
  type RelationPermissionKey,
  type RelationState,
} from "../../../src/domain/account-profile.ts";
import { consumeRateLimit } from "./rate-limit.ts";
import { logAccountEvent, photoUrl } from "./profile-service.ts";

type SocialDatabase = Pick<D1Database, "prepare" | "batch">;

const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_PENDING_SENT = 20;
const SEARCH_LIMIT = 20;

export type SocialError =
  | "invalid_input"
  | "rate_limited"
  | "account_not_eligible"
  | "recipient_not_discoverable"
  | "self_invitation"
  | "relationship_already_active"
  | "invitation_already_pending"
  | "invitation_limit_reached"
  | "invalid_or_expired_invitation"
  | "contact_not_found"
  | "permission_not_found"
  | "storage_unavailable";

export type SocialResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SocialError };

export interface DirectoryResult {
  readonly accountId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly photoUrl: string | null;
  readonly relation: RelationState;
}

export interface ProximityInvitationView {
  readonly id: string;
  readonly direction: "received" | "sent";
  readonly accountId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly photoUrl: string | null;
  readonly status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly decidedAt: number | null;
}

export interface CloseContactView {
  readonly accountId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly photoUrl: string | null;
  readonly connectedAt: number;
  readonly permissionsToMe: { readonly profilePhoto: boolean; readonly contactDetails: boolean };
  readonly permissionsFromMe: { readonly profilePhoto: boolean; readonly contactDetails: boolean };
  readonly contactDetails: {
    readonly email: string | null;
    readonly phone: string | null;
    readonly phoneVerified: boolean;
  } | null;
}

function fail<T>(error: SocialError): SocialResult<T> {
  return { ok: false, error };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 128 && value.trim() === value;
}

function mapInvitationRow(row: Record<string, unknown>, direction: "received" | "sent"): ProximityInvitationView {
  const version = typeof row.photo_version === "number" ? row.photo_version : 0;
  const accountId = String(direction === "received" ? row.inviter_account_id : row.recipient_account_id);
  return {
    id: String(row.id),
    direction,
    accountId,
    firstName: String(row.first_name ?? ""),
    lastName: String(row.last_name ?? ""),
    photoUrl: row.photo_search === 1 && row.photo_mime ? photoUrl(accountId, version) : null,
    status: String(row.status) as ProximityInvitationView["status"],
    createdAt: Number(row.created_at),
    expiresAt: Number(row.expires_at),
    decidedAt: typeof row.decided_at === "number" ? row.decided_at : null,
  };
}

export async function searchDirectory(
  db: SocialDatabase,
  viewerAccountId: string,
  mode: unknown,
  rawQuery: unknown,
  now = Date.now(),
): Promise<SocialResult<DirectoryResult[]>> {
  if (!validId(viewerAccountId) || (mode !== "name" && mode !== "email")) return fail("invalid_input");
  const query = mode === "name" ? normalizeDirectoryNameQuery(rawQuery) : normalizeDirectoryEmailQuery(rawQuery);
  if (!query) return fail("invalid_input");

  const rate = await consumeRateLimit(db, viewerAccountId, "directory_search", 30, 60_000, now);
  if (rate === "limited") return fail("rate_limited");
  if (rate === "unavailable") return fail("storage_unavailable");

  try {
    const rows = mode === "name"
      ? await db.prepare(
        `SELECT p.account_id, p.first_name, p.last_name, p.photo_mime, p.photo_version,
                COALESCE(pr.photo_visible_in_search, 0) AS photo_search
         FROM account_profiles p
         JOIN accounts a ON a.id = p.account_id AND a.status = 'active'
         LEFT JOIN account_privacy_settings pr ON pr.account_id = p.account_id
         WHERE p.account_id <> ?
           AND length(trim(p.first_name)) > 0
           AND length(trim(p.last_name)) > 0
           AND COALESCE(pr.search_by_name, 0) = 1
           AND (
             p.first_name LIKE ? ESCAPE '\\'
             OR p.last_name LIKE ? ESCAPE '\\'
             OR (p.first_name || ' ' || p.last_name) LIKE ? ESCAPE '\\'
           )
         ORDER BY p.last_name, p.first_name, p.account_id
         LIMIT ?`,
      ).bind(viewerAccountId, `%${escapeLike(query)}%`, `%${escapeLike(query)}%`, `%${escapeLike(query)}%`, SEARCH_LIMIT).all<Record<string, unknown>>()
      : await db.prepare(
        `SELECT p.account_id, p.first_name, p.last_name, p.photo_mime, p.photo_version,
                COALESCE(pr.photo_visible_in_search, 0) AS photo_search
         FROM account_profiles p
         JOIN accounts a ON a.id = p.account_id AND a.status = 'active'
         JOIN account_identities i
           ON i.account_id = p.account_id
          AND i.channel = 'email'
          AND i.is_primary = 1
          AND i.verified_at IS NOT NULL
         LEFT JOIN account_privacy_settings pr ON pr.account_id = p.account_id
         WHERE p.account_id <> ?
           AND length(trim(p.first_name)) > 0
           AND length(trim(p.last_name)) > 0
           AND COALESCE(pr.search_by_email, 0) = 1
           AND i.normalized_value = ?
         LIMIT ?`,
      ).bind(viewerAccountId, query, SEARCH_LIMIT).all<Record<string, unknown>>();

    if (!rows.success || !Array.isArray(rows.results)) return fail("storage_unavailable");
    if (rows.results.length === 0) return { ok: true, value: [] };

    const ids = rows.results.map((row) => String(row.account_id));
    const placeholders = ids.map(() => "?").join(", ");
    const [relations, invitations] = await Promise.all([
      db.prepare(
        `SELECT CASE WHEN account_low_id = ? THEN account_high_id ELSE account_low_id END AS other_id
         FROM close_relations
         WHERE status = 'active'
           AND (account_low_id = ? OR account_high_id = ?)
           AND (account_low_id IN (${placeholders}) OR account_high_id IN (${placeholders}))`,
      ).bind(viewerAccountId, viewerAccountId, viewerAccountId, ...ids, ...ids).all<{ other_id: string }>(),
      db.prepare(
        `SELECT inviter_account_id, recipient_account_id
         FROM proximity_invitations
         WHERE status = 'pending'
           AND expires_at > ?
           AND ((inviter_account_id = ? AND recipient_account_id IN (${placeholders}))
             OR (recipient_account_id = ? AND inviter_account_id IN (${placeholders})))`,
      ).bind(now, viewerAccountId, ...ids, viewerAccountId, ...ids).all<{ inviter_account_id: string; recipient_account_id: string }>(),
    ]);

    const connected = new Set((relations.results ?? []).map((row) => row.other_id));
    const sent = new Set<string>();
    const received = new Set<string>();
    for (const row of invitations.results ?? []) {
      if (row.inviter_account_id === viewerAccountId) sent.add(row.recipient_account_id);
      else received.add(row.inviter_account_id);
    }

    return {
      ok: true,
      value: rows.results.map((row) => {
        const accountId = String(row.account_id);
        const version = typeof row.photo_version === "number" ? row.photo_version : 0;
        const relation: RelationState = connected.has(accountId) ? "connected" :
          sent.has(accountId) ? "invitation_sent" :
          received.has(accountId) ? "invitation_received" : "none";
        return {
          accountId,
          firstName: String(row.first_name),
          lastName: String(row.last_name),
          photoUrl: row.photo_search === 1 && row.photo_mime ? photoUrl(accountId, version) : null,
          relation,
        };
      }),
    };
  } catch {
    return fail("storage_unavailable");
  }
}

export async function sendProximityInvitation(
  db: SocialDatabase,
  inviterAccountId: string,
  recipientAccountId: unknown,
  now = Date.now(),
): Promise<SocialResult<{ invitationId: string; expiresAt: number }>> {
  if (!validId(inviterAccountId) || !validId(recipientAccountId)) return fail("invalid_input");
  if (inviterAccountId === recipientAccountId) return fail("self_invitation");

  const rate = await consumeRateLimit(db, inviterAccountId, "proximity_invite", 10, 60 * 60 * 1000, now);
  if (rate === "limited") return fail("rate_limited");
  if (rate === "unavailable") return fail("storage_unavailable");

  try {
    const accounts = await db.prepare(
      `SELECT id, status FROM accounts WHERE id IN (?, ?)`,
    ).bind(inviterAccountId, recipientAccountId).all<{ id: string; status: string }>();
    const statuses = new Map((accounts.results ?? []).map((row) => [row.id, row.status]));
    if (statuses.get(inviterAccountId) !== "active" || statuses.get(recipientAccountId) !== "active") {
      return fail("account_not_eligible");
    }

    const privacy = await db.prepare(
      `SELECT search_by_name, search_by_email
       FROM account_privacy_settings WHERE account_id = ? LIMIT 1`,
    ).bind(recipientAccountId).first<{ search_by_name: number; search_by_email: number }>();
    if (!privacy || (privacy.search_by_name !== 1 && privacy.search_by_email !== 1)) {
      return fail("recipient_not_discoverable");
    }

    const pair = canonicalAccountPair(inviterAccountId, recipientAccountId);
    const relation = await db.prepare(
      `SELECT 1 AS present FROM close_relations
       WHERE status = 'active' AND account_low_id = ? AND account_high_id = ? LIMIT 1`,
    ).bind(pair.low, pair.high).first<{ present: number }>();
    if (relation?.present) return fail("relationship_already_active");

    await db.prepare(
      `UPDATE proximity_invitations SET status = 'expired', decided_at = ?
       WHERE pair_key = ? AND status = 'pending' AND expires_at <= ?`,
    ).bind(now, pair.key, now).run();

    const pending = await db.prepare(
      `SELECT 1 AS present FROM proximity_invitations
       WHERE pair_key = ? AND status = 'pending' LIMIT 1`,
    ).bind(pair.key).first<{ present: number }>();
    if (pending?.present) return fail("invitation_already_pending");

    const pendingSent = await db.prepare(
      `SELECT COUNT(*) AS count FROM proximity_invitations
       WHERE inviter_account_id = ? AND status = 'pending' AND expires_at > ?`,
    ).bind(inviterAccountId, now).first<{ count: number }>();
    if ((pendingSent?.count ?? 0) >= MAX_PENDING_SENT) return fail("invitation_limit_reached");

    const invitationId = crypto.randomUUID();
    const expiresAt = now + INVITATION_TTL_MS;
    const inserted = await db.prepare(
      `INSERT INTO proximity_invitations
       (id, inviter_account_id, recipient_account_id, pair_key, status, created_at, expires_at, decided_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, NULL)`,
    ).bind(invitationId, inviterAccountId, recipientAccountId, pair.key, now, expiresAt).run();
    if (!inserted.success || inserted.meta.changes !== 1) return fail("storage_unavailable");

    await logAccountEvent(db, inviterAccountId, "proximity_invitation_sent", { invitationId }, now);
    return { ok: true, value: { invitationId, expiresAt } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("proximity_invitations_one_pending_pair")) return fail("invitation_already_pending");
    return fail("storage_unavailable");
  }
}

export async function listProximityInvitations(
  db: SocialDatabase,
  accountId: string,
  now = Date.now(),
): Promise<SocialResult<ProximityInvitationView[]>> {
  if (!validId(accountId)) return fail("invalid_input");
  try {
    await db.prepare(
      `UPDATE proximity_invitations SET status = 'expired', decided_at = ?
       WHERE status = 'pending' AND expires_at <= ? AND (inviter_account_id = ? OR recipient_account_id = ?)`,
    ).bind(now, now, accountId, accountId).run();

    const received = await db.prepare(
      `SELECT i.id, i.inviter_account_id, i.recipient_account_id, i.status,
              i.created_at, i.expires_at, i.decided_at,
              p.first_name, p.last_name, p.photo_mime, p.photo_version,
              CASE WHEN COALESCE(pr.photo_visible_in_search, 0) = 1
                    AND (COALESCE(pr.search_by_name, 0) = 1 OR COALESCE(pr.search_by_email, 0) = 1)
                   THEN 1 ELSE 0 END AS photo_search
       FROM proximity_invitations i
       JOIN account_profiles p ON p.account_id = i.inviter_account_id
       LEFT JOIN account_privacy_settings pr ON pr.account_id = i.inviter_account_id
       WHERE i.recipient_account_id = ?
       ORDER BY i.created_at DESC, i.id DESC LIMIT 50`,
    ).bind(accountId).all<Record<string, unknown>>();
    const sent = await db.prepare(
      `SELECT i.id, i.inviter_account_id, i.recipient_account_id, i.status,
              i.created_at, i.expires_at, i.decided_at,
              p.first_name, p.last_name, p.photo_mime, p.photo_version,
              CASE WHEN COALESCE(pr.photo_visible_in_search, 0) = 1
                    AND (COALESCE(pr.search_by_name, 0) = 1 OR COALESCE(pr.search_by_email, 0) = 1)
                   THEN 1 ELSE 0 END AS photo_search
       FROM proximity_invitations i
       JOIN account_profiles p ON p.account_id = i.recipient_account_id
       LEFT JOIN account_privacy_settings pr ON pr.account_id = i.recipient_account_id
       WHERE i.inviter_account_id = ?
       ORDER BY i.created_at DESC, i.id DESC LIMIT 50`,
    ).bind(accountId).all<Record<string, unknown>>();

    if (!received.success || !sent.success) return fail("storage_unavailable");
    return {
      ok: true,
      value: [
        ...(received.results ?? []).map((row) => mapInvitationRow(row, "received")),
        ...(sent.results ?? []).map((row) => mapInvitationRow(row, "sent")),
      ].sort((left, right) => right.createdAt - left.createdAt),
    };
  } catch {
    return fail("storage_unavailable");
  }
}

export async function respondProximityInvitation(
  db: SocialDatabase,
  accountId: string,
  invitationId: unknown,
  action: unknown,
  now = Date.now(),
): Promise<SocialResult<{ status: "accepted" | "declined" | "cancelled"; accountId: string }>> {
  if (!validId(accountId) || !validId(invitationId) ||
      (action !== "accept" && action !== "decline" && action !== "cancel")) {
    return fail("invalid_input");
  }
  try {
    const invitation = await db.prepare(
      `SELECT id, inviter_account_id, recipient_account_id, status, expires_at
       FROM proximity_invitations WHERE id = ? LIMIT 1`,
    ).bind(invitationId).first<Record<string, unknown>>();
    if (!invitation || invitation.status !== "pending") return fail("invalid_or_expired_invitation");

    const inviterId = String(invitation.inviter_account_id);
    const recipientId = String(invitation.recipient_account_id);
    const expiresAt = Number(invitation.expires_at);
    if (expiresAt <= now) {
      await db.prepare(
        `UPDATE proximity_invitations SET status = 'expired', decided_at = ?
         WHERE id = ? AND status = 'pending' AND expires_at <= ?`,
      ).bind(now, invitationId, now).run();
      return fail("invalid_or_expired_invitation");
    }

    if (action === "accept" || action === "decline") {
      if (recipientId !== accountId) return fail("invalid_or_expired_invitation");
    } else if (inviterId !== accountId) {
      return fail("invalid_or_expired_invitation");
    }

    if (action === "accept") {
      const accounts = await db.prepare(
        "SELECT id, status FROM accounts WHERE id IN (?, ?)",
      ).bind(inviterId, recipientId).all<{ id: string; status: string }>();
      const statuses = new Map((accounts.results ?? []).map((row) => [row.id, row.status]));
      if (!accounts.success || statuses.get(inviterId) !== "active" || statuses.get(recipientId) !== "active") {
        await db.prepare(
          `UPDATE proximity_invitations SET status = 'cancelled', decided_at = ?
           WHERE id = ? AND status = 'pending'`,
        ).bind(now, invitationId).run();
        return fail("invalid_or_expired_invitation");
      }
    }

    if (action === "decline" || action === "cancel") {
      const status = action === "decline" ? "declined" : "cancelled";
      const result = await db.prepare(
        `UPDATE proximity_invitations SET status = ?, decided_at = ?
         WHERE id = ? AND status = 'pending' AND expires_at > ?`,
      ).bind(status, now, invitationId, now).run();
      if (!result.success || result.meta.changes !== 1) return fail("invalid_or_expired_invitation");
      await logAccountEvent(db, accountId, action === "decline" ? "proximity_invitation_declined" : "proximity_invitation_cancelled", { invitationId }, now);
      return { ok: true, value: { status, accountId: action === "decline" ? inviterId : recipientId } };
    }

    const pair = canonicalAccountPair(inviterId, recipientId);
    const relationId = crypto.randomUUID();
    const results = await db.batch([
      db.prepare(
        `UPDATE proximity_invitations SET status = 'accepted', decided_at = ?
         WHERE id = ? AND status = 'pending' AND recipient_account_id = ? AND expires_at > ?`,
      ).bind(now, invitationId, accountId, now),
      db.prepare(
        `INSERT INTO close_relations
         (id, account_low_id, account_high_id, invitation_id, status, created_at, removed_at, removed_by_account_id)
         SELECT ?, ?, ?, id, 'active', decided_at, NULL, NULL
         FROM proximity_invitations
         WHERE id = ? AND status = 'accepted' AND recipient_account_id = ? AND decided_at = ?`,
      ).bind(relationId, pair.low, pair.high, invitationId, accountId, now),
    ]);

    if (results.length !== 2 || results.some((result) => !result.success || result.meta.changes !== 1)) {
      return fail("invalid_or_expired_invitation");
    }
    await logAccountEvent(db, accountId, "proximity_invitation_accepted", { invitationId, relationId }, now);
    await logAccountEvent(db, inviterId, "proximity_invitation_accepted", { invitationId, relationId }, now);
    return { ok: true, value: { status: "accepted", accountId: inviterId } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("close_relations_one_active_pair") || message.includes("UNIQUE constraint failed: close_relations.account_low_id")) {
      return fail("relationship_already_active");
    }
    return fail("storage_unavailable");
  }
}

export async function listCloseContacts(
  db: SocialDatabase,
  viewerAccountId: string,
): Promise<SocialResult<CloseContactView[]>> {
  if (!validId(viewerAccountId)) return fail("invalid_input");
  try {
    const result = await db.prepare(
      `WITH mine AS (
         SELECT r.id AS relation_id, r.created_at AS connected_at,
                CASE WHEN r.account_low_id = ? THEN r.account_high_id ELSE r.account_low_id END AS other_id
         FROM close_relations r
         WHERE r.status = 'active' AND (r.account_low_id = ? OR r.account_high_id = ?)
       )
       SELECT m.relation_id, m.connected_at, m.other_id,
              p.first_name, p.last_name, p.photo_mime, p.photo_version,
              COALESCE(pr.photo_visible_to_contacts, 1) AS photo_global,
              EXISTS (
                SELECT 1 FROM close_relation_permissions cp
                WHERE cp.relation_id = m.relation_id
                  AND cp.grantor_account_id = m.other_id
                  AND cp.grantee_account_id = ?
                  AND cp.permission_key = 'profile_photo'
                  AND cp.status = 'active'
              ) AS photo_to_me,
              EXISTS (
                SELECT 1 FROM close_relation_permissions cp
                WHERE cp.relation_id = m.relation_id
                  AND cp.grantor_account_id = m.other_id
                  AND cp.grantee_account_id = ?
                  AND cp.permission_key = 'contact_details'
                  AND cp.status = 'active'
              ) AS details_to_me,
              EXISTS (
                SELECT 1 FROM close_relation_permissions cp
                WHERE cp.relation_id = m.relation_id
                  AND cp.grantor_account_id = ?
                  AND cp.grantee_account_id = m.other_id
                  AND cp.permission_key = 'profile_photo'
                  AND cp.status = 'active'
              ) AS photo_from_me,
              EXISTS (
                SELECT 1 FROM close_relation_permissions cp
                WHERE cp.relation_id = m.relation_id
                  AND cp.grantor_account_id = ?
                  AND cp.grantee_account_id = m.other_id
                  AND cp.permission_key = 'contact_details'
                  AND cp.status = 'active'
              ) AS details_from_me,
              email.normalized_value AS email,
              phone.normalized_value AS phone,
              phone.verified_at AS phone_verified_at
       FROM mine m
       JOIN account_profiles p ON p.account_id = m.other_id
       JOIN accounts a ON a.id = m.other_id AND a.status = 'active'
       LEFT JOIN account_privacy_settings pr ON pr.account_id = m.other_id
       LEFT JOIN account_identities email
         ON email.account_id = m.other_id AND email.channel = 'email' AND email.is_primary = 1 AND email.verified_at IS NOT NULL
       LEFT JOIN account_identities phone
         ON phone.account_id = m.other_id AND phone.channel = 'phone' AND phone.is_primary = 1
       ORDER BY m.connected_at DESC, m.relation_id`,
    ).bind(viewerAccountId, viewerAccountId, viewerAccountId, viewerAccountId, viewerAccountId, viewerAccountId, viewerAccountId)
      .all<Record<string, unknown>>();

    if (!result.success || !Array.isArray(result.results)) return fail("storage_unavailable");
    return {
      ok: true,
      value: result.results.map((row) => {
        const accountId = String(row.other_id);
        const version = typeof row.photo_version === "number" ? row.photo_version : 0;
        const photoAllowed = row.photo_global === 1 && row.photo_to_me === 1;
        return {
          accountId,
          firstName: String(row.first_name),
          lastName: String(row.last_name),
          photoUrl: photoAllowed && row.photo_mime ? photoUrl(accountId, version) : null,
          connectedAt: Number(row.connected_at),
          permissionsToMe: {
            profilePhoto: row.photo_to_me === 1,
            contactDetails: row.details_to_me === 1,
          },
          permissionsFromMe: {
            profilePhoto: row.photo_from_me === 1,
            contactDetails: row.details_from_me === 1,
          },
          contactDetails: row.details_to_me === 1
            ? {
                email: typeof row.email === "string" ? row.email : null,
                phone: typeof row.phone === "string" ? row.phone : null,
                phoneVerified: typeof row.phone_verified_at === "number",
              }
            : null,
        };
      }),
    };
  } catch {
    return fail("storage_unavailable");
  }
}

export async function getCloseContact(
  db: SocialDatabase,
  viewerAccountId: string,
  targetAccountId: string,
): Promise<SocialResult<CloseContactView>> {
  if (!validId(targetAccountId)) return fail("invalid_input");
  const list = await listCloseContacts(db, viewerAccountId);
  if (!list.ok) return list;
  const contact = list.value.find((item) => item.accountId === targetAccountId);
  return contact ? { ok: true, value: contact } : fail("contact_not_found");
}

export async function setRelationPermission(
  db: SocialDatabase,
  grantorAccountId: string,
  targetAccountId: string,
  permission: unknown,
  granted: unknown,
  now = Date.now(),
): Promise<SocialResult<{ permission: RelationPermissionKey; granted: boolean }>> {
  if (!validId(grantorAccountId) || !validId(targetAccountId) ||
      !isRelationPermissionKey(permission) || typeof granted !== "boolean") {
    return fail("invalid_input");
  }
  const pair = canonicalAccountPair(grantorAccountId, targetAccountId);
  try {
    const relation = await db.prepare(
      `SELECT id FROM close_relations
       WHERE status = 'active' AND account_low_id = ? AND account_high_id = ? LIMIT 1`,
    ).bind(pair.low, pair.high).first<{ id: string }>();
    if (!relation) return fail("contact_not_found");

    const result = await db.prepare(
      `INSERT INTO close_relation_permissions
       (relation_id, grantor_account_id, grantee_account_id, permission_key, status, granted_at, revoked_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(relation_id, grantor_account_id, permission_key) DO UPDATE SET
         status = excluded.status,
         granted_at = CASE WHEN excluded.status = 'active' THEN excluded.granted_at ELSE close_relation_permissions.granted_at END,
         revoked_at = excluded.revoked_at,
         updated_at = excluded.updated_at`,
    ).bind(
      relation.id,
      grantorAccountId,
      targetAccountId,
      permission,
      granted ? "active" : "revoked",
      now,
      granted ? null : now,
      now,
    ).run();
    if (!result.success || result.meta.changes !== 1) return fail("storage_unavailable");
    await logAccountEvent(db, grantorAccountId, granted ? "relation_permission_granted" : "relation_permission_revoked", {
      permission,
      targetAccountId,
    }, now);
    return { ok: true, value: { permission, granted } };
  } catch {
    return fail("storage_unavailable");
  }
}

export async function removeCloseContact(
  db: SocialDatabase,
  accountId: string,
  targetAccountId: string,
  now = Date.now(),
): Promise<SocialResult<{ removed: true }>> {
  if (!validId(accountId) || !validId(targetAccountId) || accountId === targetAccountId) return fail("invalid_input");
  const pair = canonicalAccountPair(accountId, targetAccountId);
  try {
    const result = await db.prepare(
      `UPDATE close_relations
       SET status = 'removed', removed_at = ?, removed_by_account_id = ?
       WHERE status = 'active' AND account_low_id = ? AND account_high_id = ?`,
    ).bind(now, accountId, pair.low, pair.high).run();
    if (!result.success || result.meta.changes !== 1) return fail("contact_not_found");
    await logAccountEvent(db, accountId, "close_contact_removed", { targetAccountId }, now);
    return { ok: true, value: { removed: true } };
  } catch {
    return fail("storage_unavailable");
  }
}
