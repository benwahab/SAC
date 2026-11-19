import type { ContactInvitationStatus } from "./sac.ts";

/**
 * Contrat métier pur des invitations de proches SAC.
 *
 * La persistance, le hash du jeton, l'envoi e-mail et l'atomicité de la
 * consommation + création de relation restent des responsabilités serveur.
 * Aucun délai ou quota non validé n'est imposé ici.
 */
export type ContactAccountStatus = "pending_verification" | "active" | "suspended" | "deletion_pending" | "deleted";

export interface ContactInvitationRecord {
  readonly invitationId: string;
  readonly inviterAccountId: string;
  readonly destinationEmail: string;
  readonly recipientAccountId: string | null;
  readonly tokenDigest: string;
  readonly permissionVersion: string;
  readonly status: ContactInvitationStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly decidedAt: string | null;
}

export interface TrustedContactRecord {
  readonly ownerAccountId: string;
  readonly contactAccountId: string;
  readonly invitationId: string;
  readonly permissionVersion: string;
  readonly status: "active";
  readonly createdAt: string;
  readonly revokedAt: null;
}

export type ContactInvitationCommand =
  | {
      readonly type: "accept";
      readonly actorAccountId: string;
      readonly accountStatus: ContactAccountStatus;
      readonly verifiedEmail: string | null;
      readonly presentedTokenDigest: string;
      readonly presentedPermissionVersion: string;
      readonly existingActiveRelationship: boolean;
      readonly at: string;
    }
  | {
      readonly type: "decline";
      readonly actorAccountId: string;
      readonly accountStatus: ContactAccountStatus;
      readonly verifiedEmail: string | null;
      readonly presentedTokenDigest: string;
      readonly at: string;
    }
  | {
      readonly type: "revoke";
      readonly actorAccountId: string;
      readonly at: string;
    }
  | { readonly type: "expire"; readonly actorAccountId: "system"; readonly at: string };

export type ContactInvitationError =
  | "invalid_invitation"
  | "invalid_command"
  | "invalid_timestamp"
  | "event_before_creation"
  | "invitation_not_pending"
  | "token_invalid"
  | "invitation_expired"
  | "account_not_active"
  | "email_not_verified"
  | "email_destination_mismatch"
  | "self_invitation"
  | "permission_version_mismatch"
  | "relationship_already_active"
  | "actor_not_inviter"
  | "not_yet_expired";

export type ContactInvitationResult =
  | {
      readonly ok: true;
      readonly invitation: ContactInvitationRecord;
      readonly relationship: TrustedContactRecord | null;
    }
  | { readonly ok: false; readonly error: ContactInvitationError };

function validUtc(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}

function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value === value.trim().toLowerCase();
}

function validInvitation(invitation: ContactInvitationRecord): boolean {
  if (!invitation.invitationId.trim() || !invitation.inviterAccountId.trim()) return false;
  if (!validEmail(invitation.destinationEmail) || !/^[a-f0-9]{64}$/.test(invitation.tokenDigest)) return false;
  if (!invitation.permissionVersion.trim() || !validUtc(invitation.createdAt) || !validUtc(invitation.expiresAt)) return false;
  if (Date.parse(invitation.expiresAt) <= Date.parse(invitation.createdAt)) return false;
  if (invitation.status === "pending") {
    return invitation.recipientAccountId === null && invitation.decidedAt === null;
  }
  if (invitation.status === "accepted" || invitation.status === "declined") {
    return invitation.recipientAccountId !== null && invitation.recipientAccountId.trim().length > 0 &&
      invitation.decidedAt !== null && validUtc(invitation.decidedAt) &&
      Date.parse(invitation.decidedAt) >= Date.parse(invitation.createdAt);
  }
  return invitation.recipientAccountId === null &&
    invitation.decidedAt !== null && validUtc(invitation.decidedAt) &&
    Date.parse(invitation.decidedAt) >= Date.parse(invitation.createdAt);
}

function fail(error: ContactInvitationError): ContactInvitationResult {
  return { ok: false, error };
}

export function transitionContactInvitation(
  invitation: ContactInvitationRecord,
  command: ContactInvitationCommand,
): ContactInvitationResult {
  if (!validInvitation(invitation)) return fail("invalid_invitation");
  if (!command || typeof command !== "object" || typeof command.at !== "string") return fail("invalid_command");
  if (!validUtc(command.at)) return fail("invalid_timestamp");
  if (Date.parse(command.at) < Date.parse(invitation.createdAt)) return fail("event_before_creation");
  if (invitation.status !== "pending") return fail("invitation_not_pending");

  if (command.type === "revoke") {
    if (command.actorAccountId !== invitation.inviterAccountId) return fail("actor_not_inviter");
    const updated: ContactInvitationRecord = { ...invitation, status: "revoked", decidedAt: command.at };
    return { ok: true, invitation: updated, relationship: null };
  }

  if (command.type === "expire") {
    if (command.actorAccountId !== "system") return fail("invalid_command");
    if (Date.parse(command.at) < Date.parse(invitation.expiresAt)) return fail("not_yet_expired");
    const updated: ContactInvitationRecord = { ...invitation, status: "expired", decidedAt: command.at };
    return { ok: true, invitation: updated, relationship: null };
  }

  if (command.type === "accept" || command.type === "decline") {
    if (command.accountStatus !== "active") return fail("account_not_active");
    if (!command.verifiedEmail) return fail("email_not_verified");
    if (!validEmail(command.verifiedEmail)) return fail("email_not_verified");
    if (command.verifiedEmail !== invitation.destinationEmail) return fail("email_destination_mismatch");
    if (command.presentedTokenDigest !== invitation.tokenDigest) return fail("token_invalid");
    if (Date.parse(command.at) >= Date.parse(invitation.expiresAt)) return fail("invitation_expired");
    if (command.actorAccountId === invitation.inviterAccountId) return fail("self_invitation");

    if (command.type === "decline") {
      const updated: ContactInvitationRecord = {
        ...invitation,
        recipientAccountId: command.actorAccountId,
        status: "declined",
        decidedAt: command.at,
      };
      return { ok: true, invitation: updated, relationship: null };
    }

    if (command.presentedPermissionVersion !== invitation.permissionVersion) return fail("permission_version_mismatch");
    if (command.existingActiveRelationship) return fail("relationship_already_active");

    const updated: ContactInvitationRecord = {
      ...invitation,
      recipientAccountId: command.actorAccountId,
      status: "accepted",
      decidedAt: command.at,
    };
    const relationship: TrustedContactRecord = {
      ownerAccountId: invitation.inviterAccountId,
      contactAccountId: command.actorAccountId,
      invitationId: invitation.invitationId,
      permissionVersion: invitation.permissionVersion,
      status: "active",
      createdAt: command.at,
      revokedAt: null,
    };
    return { ok: true, invitation: updated, relationship };
  }

  return fail("invalid_command");
}
