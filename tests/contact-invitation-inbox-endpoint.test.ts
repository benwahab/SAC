import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { createSessionCookie } from "../functions/lib/security/session-cookie.ts";
import { createSessionToken } from "../functions/lib/security/session-token.ts";
import { getSessionExpiresAt } from "../src/domain/auth-policy.ts";
import { onRequestGet as invitationInbox } from "../functions/api/contacts/invitations/inbox.ts";

test("contact invitation inbox requires an authenticated account before reading invitations", async () => {
  const statements: string[] = [];
  const response = await invitationInbox({
    request: new Request("https://sac.example/api/contacts/invitations/inbox"),
    env: { DB: { prepare(sql: string) { statements.push(sql); throw new Error("unexpected_db_access"); } } as never },
  } as never);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "authentication_required" });
  assert.equal(statements.length, 0);
});

test("contact invitation inbox is scoped to the authenticated account and never exposes tokens", async () => {
  const now = Date.now();
  const issued = await createSessionToken(webcrypto as unknown as Crypto);
  const createdAt = now - 20_000;
  const lastActivityAt = now - 1_000;
  const expiresAt = Date.parse(getSessionExpiresAt({
    createdAt: new Date(createdAt).toISOString(),
    lastActivityAt: new Date(lastActivityAt).toISOString(),
  }) as string);
  const authRow = {
    session_id: "session-current",
    account_id: "account-current",
    device_id: "device-root",
    token_hash: issued.tokenHash,
    session_status: "active",
    session_auth_version: 1,
    created_at: createdAt,
    last_activity_at: lastActivityAt,
    expires_at: expiresAt,
    revoked_at: null,
    account_status: "active",
    device_status: "active",
    current_device_auth_version: 1,
  };
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const query = { sql, values };
      queries.push(query);
      return {
        bind(...args: unknown[]) { values = args; query.values = args; return this; },
        async first() { return authRow; },
        async run() { return { success: true, meta: { changes: 1 } }; },
        async all() {
          if (sql.includes("inviter_identity.normalized_value")) {
            return {
              success: true,
              results: [{
                id: "received-invitation",
                inviter_email: "inviter@example.test",
                created_at: createdAt,
                expires_at: expiresAt,
              }],
            };
          }
          if (sql.includes("destination_email")) {
            return {
              success: true,
              results: [{
                id: "sent-invitation",
                destination_email: "recipient@example.test",
                created_at: createdAt,
                expires_at: expiresAt,
              }],
            };
          }
          throw new Error("unexpected_query: " + sql);
        },
      };
    },
  };

  const response = await invitationInbox({
    request: new Request("https://sac.example/api/contacts/invitations/inbox", {
      headers: { Cookie: createSessionCookie(issued.token) },
    }),
    env: { DB: db as never },
  } as never);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  const payload = await response.json() as {
    received: Array<{ id: string; inviterEmail: string; createdAt: number; expiresAt: number }>;
    sent: Array<{ id: string; destinationEmail: string; createdAt: number; expiresAt: number }>;
  };
  assert.deepEqual(payload, {
    received: [{
      id: "received-invitation",
      inviterEmail: "inviter@example.test",
      createdAt,
      expiresAt,
    }],
    sent: [{
      id: "sent-invitation",
      destinationEmail: "recipient@example.test",
      createdAt,
      expiresAt,
    }],
  });
  assert.equal(JSON.stringify(payload).includes(issued.token), false);
  assert.equal(JSON.stringify(payload).includes("token_digest"), false);
  const receivedQuery = queries.find((query) => query.sql.includes("inviter_identity.normalized_value"));
  const sentQuery = queries.find((query) => query.sql.includes("SELECT invitation.id, invitation.destination_email"));
  assert.ok(receivedQuery);
  assert.ok(sentQuery);
  assert.equal(receivedQuery.values[0], "account-current");
  assert.equal(sentQuery.values[0], "account-current");
  assert.match(receivedQuery.sql, /recipient\.id = \?/);
  assert.match(receivedQuery.sql, /recipient_identity\.normalized_value = invitation\.destination_email/);
  assert.match(sentQuery.sql, /invitation\.inviter_account_id = \?/);
});
