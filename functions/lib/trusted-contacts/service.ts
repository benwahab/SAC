import {
  digestContactInvitationToken,
  generateContactInvitationToken,
} from "../security/contact-invitation-token.ts";

type InvitationDatabase = Pick<D1Database, "prepare" | "batch">;

export type ContactInvitationServiceError =
  | "invalid_input"
  | "account_not_eligible"
  | "self_invitation"
  | "invitation_not_created"
  | "invalid_or_expired_invitation"
  | "relationship_not_revoked"
  | "relationship_already_active"
  | "contact_limit_reached"
  | "storage_unavailable";

export type ContactInvitationServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ContactInvitationServiceError };

function fail<T>(error: ContactInvitationServiceError): ContactInvitationServiceResult<T> {
  return { ok: false, error };
}

function validUtcMilliseconds(value: number, now: number): boolean {
  return Number.isSafeInteger(value) && value > now && value <= 8_640_000_000_000_000;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Creates a pending invitation for an authenticated account.
 * The caller MUST supply accountId from a verified server-side session,
 * never from request JSON. Expiry is supplied by the caller because the
 * product expiry policy has not been fixed.
 */
export async function createContactInvitation(
  db: InvitationDatabase,
  cryptoProvider: Crypto,
  input: {
    readonly authenticatedAccountId: string;
    readonly destinationEmail: string;
    readonly permissionVersion: string;
    readonly expiresAt: number;
    readonly now?: number;
  },
): Promise<ContactInvitationServiceResult<{
  readonly invitationId: string;
  readonly token: string;
  readonly destinationEmail: string;
  readonly expiresAt: number;
}>> {
  const now = input.now ?? Date.now();
  const destinationEmail = normalizeEmail(input.destinationEmail);
  if (
    !input.authenticatedAccountId.trim() ||
    !validEmail(destinationEmail) ||
    !input.permissionVersion.trim() ||
    input.permissionVersion.length > 128 ||
    !validUtcMilliseconds(input.expiresAt, now)
  ) return fail("invalid_input");

  try {
    const owner = await db.prepare(
      `SELECT i.normalized_value AS email
       FROM accounts a
       JOIN account_identities i ON i.account_id = a.id
       WHERE a.id = ?
         AND a.status = 'active'
         AND i.channel = 'email'
         AND i.is_primary = 1
         AND i.verified_at IS NOT NULL
       LIMIT 1`,
    ).bind(input.authenticatedAccountId).first<{ email: string }>();

    if (!owner) return fail("account_not_eligible");
    if (owner.email === destinationEmail) return fail("self_invitation");

    const existingRelationship = await db.prepare(
      `SELECT 1 AS present
       FROM trusted_contacts t
       JOIN account_identities i ON i.account_id = t.contact_account_id
       WHERE t.owner_account_id = ?
         AND t.status = 'active'
         AND i.channel = 'email'
         AND i.is_primary = 1
         AND i.verified_at IS NOT NULL
         AND i.normalized_value = ?
       LIMIT 1`,
    ).bind(input.authenticatedAccountId, destinationEmail).first<{ present: number }>();
    if (existingRelationship) return fail("relationship_already_active");

    const invitationId = cryptoProvider.randomUUID();
    const token = generateContactInvitationToken(cryptoProvider);
    const tokenDigest = await digestContactInvitationToken(cryptoProvider, token);

    const inserted = await db.prepare(
      `INSERT INTO contact_invitations
       (id, inviter_account_id, destination_email, token_digest, permission_version,
        status, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    ).bind(
      invitationId,
      input.authenticatedAccountId,
      destinationEmail,
      tokenDigest,
      input.permissionVersion,
      now,
      input.expiresAt,
    ).run();

    if (!inserted.success || inserted.meta.changes !== 1) return fail("invitation_not_created");
    return {
      ok: true,
      value: { invitationId, token, destinationEmail, expiresAt: input.expiresAt },
    };
  } catch {
    return fail("storage_unavailable");
  }
}

/**
 * Atomically consumes the invitation and creates the directional relationship.
 * The authenticated account ID is supplied by the server-side session guard.
 */
export async function acceptContactInvitation(
  db: InvitationDatabase,
  cryptoProvider: Crypto,
  input: {
    readonly authenticatedAccountId: string;
    readonly invitationId: string;
    readonly token: string;
    readonly permissionVersion: string;
    readonly maxActiveContacts: 2 | 10;
    readonly now?: number;
  },
): Promise<ContactInvitationServiceResult<{ readonly ownerAccountId: string; readonly contactAccountId: string }>> {
  const now = input.now ?? Date.now();
  if (
    !input.authenticatedAccountId.trim() ||
    !input.invitationId.trim() ||
    !input.permissionVersion.trim() ||
    (input.maxActiveContacts !== 2 && input.maxActiveContacts !== 10) ||
    !isSafeToken(input.token) ||
    !Number.isSafeInteger(now) ||
    now < 0
  ) return fail("invalid_input");

  try {
    const digest = await digestContactInvitationToken(cryptoProvider, input.token);
    const results = await db.batch([
      db.prepare(
        `UPDATE contact_invitations
         SET status = 'accepted', recipient_account_id = ?, decided_at = ?
         WHERE id = ?
           AND status = 'pending'
           AND token_digest = ?
           AND permission_version = ?
           AND expires_at > ?
           AND inviter_account_id <> ?
           AND (SELECT COUNT(*) FROM trusted_contacts t
                WHERE t.owner_account_id = contact_invitations.inviter_account_id
                  AND t.status = 'active') < ?
           AND EXISTS (
             SELECT 1
             FROM accounts a
             JOIN account_identities i ON i.account_id = a.id
             WHERE a.id = ?
               AND a.status = 'active'
               AND i.channel = 'email'
               AND i.is_primary = 1
               AND i.verified_at IS NOT NULL
               AND i.normalized_value = contact_invitations.destination_email
           )`,
      ).bind(
        input.authenticatedAccountId,
        now,
        input.invitationId,
        digest,
        input.permissionVersion,
        now,
        input.authenticatedAccountId,
        input.maxActiveContacts,
        input.authenticatedAccountId,
      ),
      db.prepare(
        `INSERT INTO trusted_contacts
         (owner_account_id, contact_account_id, invitation_id, permission_version,
          status, created_at, revoked_at)
         SELECT inviter_account_id, recipient_account_id, id, permission_version,
                'active', decided_at, NULL
         FROM contact_invitations
         WHERE id = ?
           AND status = 'accepted'
           AND recipient_account_id = ?
           AND decided_at = ?`,
      ).bind(input.invitationId, input.authenticatedAccountId, now),
    ]);

    if (
      results.length !== 2 ||
      !results[0].success ||
      results[0].meta.changes !== 1 ||
      !results[1].success ||
      results[1].meta.changes !== 1
    ) return fail("invalid_or_expired_invitation");

    const relationship = await db.prepare(
      `SELECT owner_account_id, contact_account_id
       FROM trusted_contacts
       WHERE invitation_id = ?`,
    ).bind(input.invitationId).first<{ owner_account_id: string; contact_account_id: string }>();

    if (!relationship) return fail("storage_unavailable");
    return {
      ok: true,
      value: {
        ownerAccountId: relationship.owner_account_id,
        contactAccountId: relationship.contact_account_id,
      },
    };
  } catch {
    return fail("invalid_or_expired_invitation");
  }
}

function isSafeToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** Only the owner can revoke their own directional relationship. */
export async function revokeTrustedContact(
  db: InvitationDatabase,
  input: {
    readonly authenticatedOwnerAccountId: string;
    readonly contactAccountId: string;
    readonly now?: number;
  },
): Promise<ContactInvitationServiceResult<{ readonly revoked: true }>> {
  const now = input.now ?? Date.now();
  if (
    !input.authenticatedOwnerAccountId.trim() ||
    !input.contactAccountId.trim() ||
    !Number.isSafeInteger(now) ||
    now < 0
  ) return fail("invalid_input");

  try {
    const result = await db.prepare(
      `UPDATE trusted_contacts
       SET status = 'revoked', revoked_at = ?
       WHERE owner_account_id = ?
         AND contact_account_id = ?
         AND status = 'active'
         AND created_at <= ?`,
    ).bind(now, input.authenticatedOwnerAccountId, input.contactAccountId, now).run();

    if (!result.success || result.meta.changes !== 1) return fail("relationship_not_revoked");
    return { ok: true, value: { revoked: true } };
  } catch {
    return fail("storage_unavailable");
  }
}

export async function listTrustedContacts(
  db: InvitationDatabase,
  authenticatedAccountId: string,
): Promise<ContactInvitationServiceResult<Array<{
  readonly accountId: string;
  readonly email: string;
  readonly createdAt: number;
}>>> {
  if (!authenticatedAccountId.trim()) return fail("invalid_input");
  try {
    const result = await db.prepare(
      `SELECT t.contact_account_id AS account_id,
              i.normalized_value AS email,
              t.created_at AS created_at
       FROM trusted_contacts t
       JOIN account_identities i ON i.account_id = t.contact_account_id
       WHERE t.owner_account_id = ?
         AND t.status = 'active'
         AND i.channel = 'email'
         AND i.is_primary = 1
         AND i.verified_at IS NOT NULL
       ORDER BY t.created_at DESC`,
    ).bind(authenticatedAccountId).all<{
      account_id: string;
      email: string;
      created_at: number;
    }>();

    if (!result.success) return fail("storage_unavailable");
    return {
      ok: true,
      value: (result.results ?? []).map((row) => ({
        accountId: row.account_id,
        email: row.email,
        createdAt: row.created_at,
      })),
    };
  } catch {
    return fail("storage_unavailable");
  }
}
