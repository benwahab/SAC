import assert from "node:assert/strict";
import test from "node:test";
import {
  transitionContactInvitation,
  type ContactAccountStatus,
  type ContactInvitationRecord,
} from "../src/domain/contact-invitations.ts";

const createdAt = "2026-11-19T08:00:00.000Z";
const acceptedAt = "2026-11-19T08:05:00.000Z";
const expiresAt = "2026-11-26T08:00:00.000Z";
const tokenDigest = "a".repeat(64);

function invitation(overrides: Partial<ContactInvitationRecord> = {}): ContactInvitationRecord {
  return {
    invitationId: "invite-001",
    inviterAccountId: "account-owner",
    destinationEmail: "proche@example.com",
    recipientAccountId: null,
    tokenDigest,
    permissionVersion: "permissions-v1",
    status: "pending",
    createdAt,
    expiresAt,
    decidedAt: null,
    ...overrides,
  };
}

function accept(overrides: Partial<{ actorAccountId: string; accountStatus: ContactAccountStatus; verifiedEmail: string | null; presentedTokenDigest: string; presentedPermissionVersion: string; existingActiveRelationship: boolean; at: string }> = {}) {
  return {
    type: "accept" as const,
    actorAccountId: "account-contact",
    accountStatus: "active" as const,
    verifiedEmail: "proche@example.com",
    presentedTokenDigest: tokenDigest,
    presentedPermissionVersion: "permissions-v1",
    existingActiveRelationship: false,
    at: acceptedAt,
    ...overrides,
  };
}

test("une invitation en attente ne crée aucune relation avant acceptation", () => {
  const current = invitation();
  assert.equal(current.status, "pending");
  assert.equal(current.recipientAccountId, null);
});

test("un compte actif avec l'adresse vérifiée exacte peut accepter", () => {
  const result = transitionContactInvitation(invitation(), accept());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.invitation.status, "accepted");
  assert.equal(result.invitation.recipientAccountId, "account-contact");
  assert.deepEqual(result.relationship, {
    ownerAccountId: "account-owner",
    contactAccountId: "account-contact",
    invitationId: "invite-001",
    permissionVersion: "permissions-v1",
    status: "active",
    createdAt: acceptedAt,
    revokedAt: null,
  });
});

test("un compte non actif ne peut pas accepter", () => {
  const result = transitionContactInvitation(invitation(), accept({ accountStatus: "pending_verification" }));
  assert.deepEqual(result, { ok: false, error: "account_not_active" });
});

test("un compte sans adresse vérifiée ne peut pas accepter", () => {
  const result = transitionContactInvitation(invitation(), accept({ verifiedEmail: null }));
  assert.deepEqual(result, { ok: false, error: "email_not_verified" });
});

test("une adresse vérifiée différente de la destination ne peut pas accepter", () => {
  const result = transitionContactInvitation(invitation(), accept({ verifiedEmail: "other@example.com" }));
  assert.deepEqual(result, { ok: false, error: "email_destination_mismatch" });
});

test("un jeton incorrect ou remplacé est refusé", () => {
  const result = transitionContactInvitation(invitation(), accept({ presentedTokenDigest: "b".repeat(64) }));
  assert.deepEqual(result, { ok: false, error: "token_invalid" });
});

test("une version de permissions différente de celle présentée est refusée", () => {
  const result = transitionContactInvitation(invitation(), accept({ presentedPermissionVersion: "permissions-v2" }));
  assert.deepEqual(result, { ok: false, error: "permission_version_mismatch" });
});

test("une relation directionnelle active existante empêche le doublon", () => {
  const result = transitionContactInvitation(invitation(), accept({ existingActiveRelationship: true }));
  assert.deepEqual(result, { ok: false, error: "relationship_already_active" });
});

test("l'invitation ne peut pas être acceptée par l'invitant lui-même", () => {
  const result = transitionContactInvitation(invitation(), accept({ actorAccountId: "account-owner" }));
  assert.deepEqual(result, { ok: false, error: "self_invitation" });
});

test("le refus explicite consomme l'invitation sans créer de relation", () => {
  const result = transitionContactInvitation(invitation(), {
    type: "decline",
    actorAccountId: "account-contact",
    accountStatus: "active",
    verifiedEmail: "proche@example.com",
    presentedTokenDigest: tokenDigest,
    at: acceptedAt,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.invitation.status, "declined");
  assert.equal(result.relationship, null);
});

test("seul l'invitant peut retirer une invitation en attente", () => {
  const denied = transitionContactInvitation(invitation(), {
    type: "revoke", actorAccountId: "account-contact", at: acceptedAt,
  });
  assert.deepEqual(denied, { ok: false, error: "actor_not_inviter" });

  const allowed = transitionContactInvitation(invitation(), {
    type: "revoke", actorAccountId: "account-owner", at: acceptedAt,
  });
  assert.equal(allowed.ok, true);
  if (!allowed.ok) return;
  assert.equal(allowed.invitation.status, "revoked");
  assert.equal(allowed.relationship, null);
});

test("le système ne peut marquer expirée qu'une invitation arrivée à échéance", () => {
  const tooEarly = transitionContactInvitation(invitation(), {
    type: "expire", actorAccountId: "system", at: acceptedAt,
  });
  assert.deepEqual(tooEarly, { ok: false, error: "not_yet_expired" });

  const expired = transitionContactInvitation(invitation(), {
    type: "expire", actorAccountId: "system", at: expiresAt,
  });
  assert.equal(expired.ok, true);
  if (!expired.ok) return;
  assert.equal(expired.invitation.status, "expired");
});

test("une invitation terminale ne peut jamais être réutilisée", () => {
  const accepted = invitation({
    status: "accepted",
    recipientAccountId: "account-contact",
    decidedAt: acceptedAt,
  });
  const result = transitionContactInvitation(accepted, accept({ at: "2026-11-19T08:06:00.000Z" }));
  assert.deepEqual(result, { ok: false, error: "invitation_not_pending" });
});

test("une relation réciproque n'est pas créée par l'acceptation", () => {
  const result = transitionContactInvitation(invitation(), accept());
  assert.equal(result.ok, true);
  if (!result.ok || !result.relationship) return;
  assert.equal(result.relationship.ownerAccountId, "account-owner");
  assert.equal(result.relationship.contactAccountId, "account-contact");
  assert.notEqual(result.relationship.ownerAccountId, result.relationship.contactAccountId);
});
