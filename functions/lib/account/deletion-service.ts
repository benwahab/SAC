import { verifyAccountPassword } from "../security/password-hash.ts";
import { logAccountEvent } from "./profile-service.ts";

type DeletionDatabase = Pick<D1Database, "prepare" | "batch">;

export type DeletionError =
  | "invalid_input"
  | "invalid_credentials"
  | "account_not_eligible"
  | "storage_unavailable";

export type DeletionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DeletionError };

export async function requestAccountDeletion(
  db: DeletionDatabase,
  cryptoProvider: Crypto,
  input: {
    readonly accountId: string;
    readonly currentSessionId: string;
    readonly password: unknown;
    readonly now?: number;
  },
): Promise<DeletionResult<{ deletionRequested: true }>> {
  const now = input.now ?? Date.now();
  if (!input.accountId || !input.currentSessionId || !Number.isSafeInteger(now) || now <= 0) {
    return { ok: false, error: "invalid_input" };
  }
  if (typeof input.password !== "string" || input.password.length === 0 || input.password.length > 1024) {
    return { ok: false, error: "invalid_credentials" };
  }

  try {
    const account = await db.prepare(
      `SELECT a.id, a.status, a.password_hash,
              email.normalized_value AS email
       FROM accounts a
       LEFT JOIN account_identities email
         ON email.account_id = a.id AND email.channel = 'email' AND email.is_primary = 1
       WHERE a.id = ? LIMIT 1`,
    ).bind(input.accountId).first<{ id: string; status: string; password_hash: string; email: string | null }>();
    if (!account || account.status !== "active" || !account.email) {
      return { ok: false, error: "account_not_eligible" };
    }
    if (!(await verifyAccountPassword(cryptoProvider, input.password, account.password_hash))) {
      return { ok: false, error: "invalid_credentials" };
    }

    const statements: D1PreparedStatement[] = [
      db.prepare(
        "UPDATE accounts SET status = 'deletion_pending', updated_at = ? WHERE id = ? AND status = 'active'",
      ).bind(now, input.accountId),
      db.prepare(
        `UPDATE device_sessions SET status = 'revoked', revoked_at = ?
         WHERE account_id = ? AND status = 'active'`,
      ).bind(now, input.accountId),
      db.prepare(
        `UPDATE devices SET status = 'revoked', revoked_at = ?
         WHERE account_id = ? AND status = 'active'`,
      ).bind(now, input.accountId),
      db.prepare(
        `UPDATE trusted_contacts SET status = 'revoked', revoked_at = ?
         WHERE status = 'active' AND (owner_account_id = ? OR contact_account_id = ?)`,
      ).bind(now, input.accountId, input.accountId),
      db.prepare(
        `UPDATE contact_invitations SET status = 'revoked', decided_at = ?
         WHERE status = 'pending' AND (inviter_account_id = ? OR destination_email = ?)`,
      ).bind(now, input.accountId, account.email),
      db.prepare(
        `UPDATE proximity_invitations SET status = 'cancelled', decided_at = ?
         WHERE status = 'pending' AND (inviter_account_id = ? OR recipient_account_id = ?)`,
      ).bind(now, input.accountId, input.accountId),
      db.prepare(
        `UPDATE close_relations SET status = 'removed', removed_at = ?, removed_by_account_id = ?
         WHERE status = 'active' AND (account_low_id = ? OR account_high_id = ?)`,
      ).bind(now, input.accountId, input.accountId, input.accountId),
      db.prepare(
        `UPDATE account_action_rate_limits SET action_count = 0, updated_at = ? WHERE account_id = ?`,
      ).bind(now, input.accountId),
      db.prepare("DELETE FROM account_contact_change_challenges WHERE account_id = ?").bind(input.accountId),
      db.prepare("DELETE FROM email_otp_challenges WHERE account_id = ? AND consumed_at IS NULL").bind(input.accountId),
    ];

    const results = await db.batch(statements);
    if (!results[0]?.success || results[0].meta.changes !== 1) {
      return { ok: false, error: "account_not_eligible" };
    }
    if (results.some((result) => !result.success)) return { ok: false, error: "storage_unavailable" };
    await logAccountEvent(db, input.accountId, "account_deletion_requested", {}, now);
    return { ok: true, value: { deletionRequested: true } };
  } catch {
    return { ok: false, error: "storage_unavailable" };
  }
}
