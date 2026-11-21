import {
  deleteProfilePhoto,
  getAuthorizedPhoto,
  getOwnAccountProfile,
  setProfilePhoto,
  updatePrivacy,
  updateProfileNames,
} from "../../functions/lib/account/profile-service.ts";
import {
  getCloseContact,
  listCloseContacts,
  listProximityInvitations,
  removeCloseContact,
  respondProximityInvitation,
  searchDirectory,
  sendProximityInvitation,
  setRelationPermission,
} from "../../functions/lib/account/social-service.ts";
import { hashAccountPassword } from "../../functions/lib/security/password-hash.ts";
import { requestAccountDeletion } from "../../functions/lib/account/deletion-service.ts";
import { confirmContactChange } from "../../functions/lib/account/contact-change-service.ts";
import { digestEmailOtp } from "../../functions/lib/security/email-otp-code.ts";

interface Env { DB: D1Database; }
const HEADERS = { "content-type": "application/json" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

async function body<T>(request: Request): Promise<T> {
  return await request.json() as T;
}

const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true });

    if (url.pathname === "/seed" && request.method === "POST") {
      const now = Date.now();
      const passwordHash = await hashAccountPassword(crypto, "correct horse battery");
      const ids = {
        owner: crypto.randomUUID(),
        friend: crypto.randomUUID(),
        hidden: crypto.randomUUID(),
      };
      const suffix = (Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 6) || "abcdef");
      const names = {
        owner: `Amina${suffix}`,
        friend: `Boubacar${suffix}`,
        hidden: `Caché${suffix}`,
      };
      const emails = {
        owner: `owner-${ids.owner}@example.invalid`,
        friend: `friend-${ids.friend}@example.invalid`,
        hidden: `hidden-${ids.hidden}@example.invalid`,
      };
      const statements: D1PreparedStatement[] = [];
      const seed = [
        { id: ids.owner, email: emails.owner, first: names.owner, last: "Diallo", searchName: 1, searchEmail: 1, photo: true },
        { id: ids.friend, email: emails.friend, first: names.friend, last: "Sani", searchName: 1, searchEmail: 1, photo: true },
        { id: ids.hidden, email: emails.hidden, first: names.hidden, last: "Secret", searchName: 0, searchEmail: 0, photo: false },
      ];
      for (const [index, person] of seed.entries()) {
        const otpId = `otp-${person.id}`;
        statements.push(
          env.DB.prepare(
            `INSERT INTO accounts (id, status, preferred_language, password_hash, created_at, updated_at)
             VALUES (?, 'pending_verification', 'fr', ?, ?, ?)`,
          ).bind(person.id, passwordHash, now, now),
          env.DB.prepare(
            `INSERT INTO account_identities (id, account_id, channel, normalized_value, verified_at, is_primary, created_at)
             VALUES (?, ?, 'email', ?, NULL, 1, ?)`,
          ).bind(`email-${person.id}`, person.id, person.email, now),
          env.DB.prepare(
            `INSERT INTO account_identities (id, account_id, channel, normalized_value, verified_at, is_primary, created_at)
             VALUES (?, ?, 'phone', ?, NULL, 1, ?)`,
          ).bind(`phone-${person.id}`, person.id, `+2279${person.id.replace(/\D/g, "").slice(0, 7).padEnd(7, "0")}`, now),
          env.DB.prepare(
            `INSERT INTO email_otp_challenges
             (id, account_id, identity_id, purpose, digest, attempt_count, max_attempts, delivery_status, created_at, expires_at, consumed_at, invalidated_at)
             VALUES (?, ?, ?, 'account_email_verification', ?, 0, 6, 'pending', ?, ?, NULL, NULL)`,
          ).bind(otpId, person.id, `email-${person.id}`, "0".repeat(64), now, now + 600_000),
          env.DB.prepare(
            `UPDATE email_otp_challenges SET delivery_status = 'accepted'
             WHERE id = ? AND account_id = ? AND delivery_status = 'pending'`,
          ).bind(otpId, person.id),
          env.DB.prepare(
            `UPDATE email_otp_challenges SET consumed_at = ?, attempt_count = attempt_count + 1
             WHERE id = ? AND account_id = ? AND delivery_status = 'accepted'`,
          ).bind(now + 1, otpId, person.id),
          env.DB.prepare(
            `INSERT INTO account_profiles
             (account_id, first_name, last_name, photo_mime, photo_data, photo_version, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            person.id,
            person.first,
            person.last,
            person.photo ? "image/png" : null,
            person.photo ? TINY_PNG.split(",")[1] : null,
            person.photo ? 1 : 0,
            now,
            now,
          ),
          env.DB.prepare(
            `INSERT INTO account_privacy_settings
             (account_id, search_by_name, search_by_email, photo_visible_in_search, photo_visible_to_contacts, updated_at)
             VALUES (?, ?, ?, 1, 1, ?)`,
          ).bind(person.id, person.searchName, person.searchEmail, now),
        );
      }
      await env.DB.batch(statements);
      return json({
        ...ids,
        ownerFirstName: names.owner,
        friendFirstName: names.friend,
        hiddenFirstName: names.hidden,
        ownerEmail: emails.owner,
        friendEmail: emails.friend,
        hiddenEmail: emails.hidden,
      });
    }

    if (url.pathname === "/search") {
      const result = await searchDirectory(
        env.DB,
        url.searchParams.get("viewer") ?? "",
        url.searchParams.get("mode"),
        url.searchParams.get("q"),
      );
      return json(result, result.ok ? 200 : 400);
    }

    if (url.pathname === "/invite" && request.method === "POST") {
      const input = await body<{ inviter: string; recipient: string }>(request);
      const result = await sendProximityInvitation(env.DB, input.inviter, input.recipient);
      return json(result, result.ok ? 201 : 409);
    }

    if (url.pathname === "/invitations") {
      const result = await listProximityInvitations(env.DB, url.searchParams.get("accountId") ?? "");
      return json(result, result.ok ? 200 : 400);
    }

    if (url.pathname === "/respond" && request.method === "POST") {
      const input = await body<{ accountId: string; invitationId: string; action: string }>(request);
      const result = await respondProximityInvitation(env.DB, input.accountId, input.invitationId, input.action);
      return json(result, result.ok ? 200 : 409);
    }

    if (url.pathname === "/contacts") {
      const result = await listCloseContacts(env.DB, url.searchParams.get("accountId") ?? "");
      return json(result, result.ok ? 200 : 400);
    }

    if (url.pathname === "/contact") {
      const result = await getCloseContact(
        env.DB,
        url.searchParams.get("viewer") ?? "",
        url.searchParams.get("target") ?? "",
      );
      return json(result, result.ok ? 200 : 404);
    }

    if (url.pathname === "/permission" && request.method === "POST") {
      const input = await body<{ accountId: string; target: string; permission: string; granted: boolean }>(request);
      const result = await setRelationPermission(env.DB, input.accountId, input.target, input.permission, input.granted);
      return json(result, result.ok ? 200 : 400);
    }

    if (url.pathname === "/remove" && request.method === "POST") {
      const input = await body<{ accountId: string; target: string }>(request);
      const result = await removeCloseContact(env.DB, input.accountId, input.target);
      return json(result, result.ok ? 200 : 404);
    }

    if (url.pathname === "/photo") {
      const result = await getAuthorizedPhoto(
        env.DB,
        url.searchParams.get("viewer") ?? "",
        url.searchParams.get("target") ?? "",
      );
      return json(result, result.ok ? 200 : 404);
    }

    if (url.pathname === "/profile") {
      const result = await getOwnAccountProfile(env.DB, url.searchParams.get("accountId") ?? "");
      return json(result, result.ok ? 200 : 404);
    }

    if (url.pathname === "/profile-update" && request.method === "POST") {
      const input = await body<{ accountId: string; firstName: string; lastName: string }>(request);
      const result = await updateProfileNames(env.DB, input.accountId, { firstName: input.firstName, lastName: input.lastName });
      return json(result, result.ok ? 200 : 400);
    }

    if (url.pathname === "/privacy" && request.method === "POST") {
      const input = await body<{ accountId: string; privacy: Record<string, unknown> }>(request);
      const result = await updatePrivacy(env.DB, input.accountId, input.privacy);
      return json(result, result.ok ? 200 : 400);
    }

    if (url.pathname === "/contact-change" && request.method === "POST") {
      const input = await body<{ accountId: string; channel: "email" | "phone"; newValue: string; valid: boolean }>(request);
      const secret = "s".repeat(32);
      const challengeId = crypto.randomUUID();
      const purpose = input.channel === "email" ? "account_email_change" : "account_phone_change";
      const identity = await env.DB.prepare(
        `SELECT id, normalized_value FROM account_identities
         WHERE account_id = ? AND channel = ? AND is_primary = 1 LIMIT 1`,
      ).bind(input.accountId, input.channel).first<{ id: string; normalized_value: string }>();
      if (!identity) return json({ ok: false, error: "identity_missing" }, 400);
      const code = "123456";
      const now = Date.now();
      const digest = await digestEmailOtp(crypto, secret, challengeId, purpose, code);
      await env.DB.prepare(
        `INSERT INTO account_contact_change_challenges
         (id, account_id, identity_id, channel, purpose, new_value, delivery_target, digest,
          attempt_count, max_attempts, delivery_status, created_at, expires_at, consumed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 6, 'accepted', ?, ?, NULL)`,
      ).bind(challengeId, input.accountId, identity.id, input.channel, purpose, input.newValue, input.newValue, digest, now, now + 600_000).run();
      const result = await confirmContactChange(env.DB, crypto, { EMAIL_OTP_HMAC_SECRET: secret }, {
        accountId: input.accountId,
        currentSessionId: "test-session",
        challengeId,
        code: input.valid ? code : "000000",
      });
      return json(result, result.ok ? 200 : 400);
    }

    if (url.pathname === "/delete" && request.method === "POST") {
      const input = await body<{ accountId: string; password: string }>(request);
      const result = await requestAccountDeletion(env.DB, crypto, {
        accountId: input.accountId,
        currentSessionId: "test-session",
        password: input.password,
      });
      return json(result, result.ok ? 200 : 401);
    }

    if (url.pathname === "/photo-update" && request.method === "POST") {
      const input = await body<{ accountId: string; dataUrl: string }>(request);
      const result = await setProfilePhoto(env.DB, input.accountId, input.dataUrl);
      return json(result, result.ok ? 200 : 400);
    }

    if (url.pathname === "/status" && request.method === "POST") {
      const input = await body<{ accountId: string; status: string }>(request);
      const result = await env.DB.prepare("UPDATE accounts SET status = ?, updated_at = ? WHERE id = ?")
        .bind(input.status, Date.now(), input.accountId).run();
      return json({ ok: result.success && result.meta.changes === 1 }, result.success ? 200 : 500);
    }

    if (url.pathname === "/photo-delete" && request.method === "POST") {
      const input = await body<{ accountId: string }>(request);
      const result = await deleteProfilePhoto(env.DB, input.accountId);
      return json(result, result.ok ? 200 : 400);
    }

    return json({ error: "not_found" }, 404);
  },
};
