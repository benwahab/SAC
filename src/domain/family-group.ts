/**
 * Contrat métier pur des groupes familiaux.
 *
 * L'appartenance à un groupe ne donne jamais accès aux rappels, aux données de
 * santé, au SOS ou au GPS d'un autre membre. Tout accès à un rappel exige un
 * partage explicite, révocable et limité à un rappel ou à l'ensemble des rappels.
 */

export type FamilyGroupRole = "owner" | "member";
export type FamilyGroupMemberStatus = "active" | "left" | "removed";
export type FamilyGroupInvitationStatus = "pending" | "accepted" | "declined" | "revoked" | "expired";
export type FamilyGroupEventStatus = "active" | "cancelled";
export type FamilyGroupEventAudienceMode = "all" | "selected";

export interface FamilyGroupMember {
  readonly accountId: string;
  readonly role: FamilyGroupRole;
  readonly status: FamilyGroupMemberStatus;
  readonly joinedAt: number;
  readonly leftAt: number | null;
}

export interface FamilyGroup {
  readonly groupId: string;
  readonly ownerAccountId: string;
  readonly name: string;
  readonly members: readonly FamilyGroupMember[];
}

export interface FamilyGroupInvitation {
  readonly invitationId: string;
  readonly groupId: string;
  readonly inviterAccountId: string;
  readonly inviteeAccountId: string;
  readonly status: FamilyGroupInvitationStatus;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly decidedAt: number | null;
}

export interface FamilyGroupEvent {
  readonly eventId: string;
  readonly groupId: string;
  readonly createdByAccountId: string;
  readonly title: string;
  readonly description: string | null;
  readonly startsAt: number;
  readonly location: string | null;
  readonly status: FamilyGroupEventStatus;
  readonly audienceAccountIds: readonly string[];
}

export interface ReminderShare {
  readonly shareId: string;
  readonly ownerAccountId: string;
  readonly granteeAccountId: string;
  readonly reminderId: string | null;
  readonly canRead: boolean;
  readonly canEdit: boolean;
  readonly status: "active" | "revoked";
  readonly createdAt: number;
  readonly revokedAt: number | null;
}

export type FamilyGroupError =
  | "invalid_group"
  | "invalid_event"
  | "invalid_invitation"
  | "actor_not_member"
  | "actor_not_owner"
  | "owner_cannot_leave"
  | "member_already_exists"
  | "member_not_active"
  | "invitee_is_inviter"
  | "invitation_not_pending"
  | "invitation_expired"
  | "actor_not_invitee"
  | "audience_empty"
  | "audience_not_member"
  | "event_not_visible"
  | "reminder_access_denied";

export type FamilyGroupResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: FamilyGroupError };

const GROUP_NAME_MAX = 100;
const EVENT_TITLE_MAX = 200;
const EVENT_DESCRIPTION_MAX = 4000;
const EVENT_LOCATION_MAX = 500;

function activeMember(group: FamilyGroup, accountId: string): FamilyGroupMember | null {
  return group.members.find((member) => member.accountId === accountId && member.status === "active") ?? null;
}

export function activeMemberIds(group: FamilyGroup): readonly string[] {
  return group.members.filter((member) => member.status === "active").map((member) => member.accountId);
}

export function canManageGroup(group: FamilyGroup, actorAccountId: string): boolean {
  const member = activeMember(group, actorAccountId);
  return member?.role === "owner";
}

export function canInviteToGroup(group: FamilyGroup, actorAccountId: string): boolean {
  return canManageGroup(group, actorAccountId);
}

export function canCreateFamilyEvent(group: FamilyGroup, actorAccountId: string): boolean {
  return activeMember(group, actorAccountId) !== null;
}

export function canViewFamilyEvent(group: FamilyGroup, event: FamilyGroupEvent, actorAccountId: string): boolean {
  if (event.groupId !== group.groupId) return false;
  if (activeMember(group, actorAccountId) === null) return false;
  return event.audienceAccountIds.includes(actorAccountId);
}

export function resolveFamilyEventAudience(
  group: FamilyGroup,
  mode: FamilyGroupEventAudienceMode,
  selectedAccountIds: readonly string[],
): FamilyGroupResult<readonly string[]> {
  const members = new Set(activeMemberIds(group));
  if (mode === "all") return { ok: true, value: [...members] };
  if (selectedAccountIds.length === 0) return { ok: false, error: "audience_empty" };
  const unique = new Set<string>();
  for (const accountId of selectedAccountIds) {
    if (!members.has(accountId)) return { ok: false, error: "audience_not_member" };
    unique.add(accountId);
  }
  return { ok: true, value: [...unique] };
}

export function validateFamilyGroupName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= GROUP_NAME_MAX;
}

export function validateFamilyEvent(event: Omit<FamilyGroupEvent, "eventId" | "status" | "audienceAccountIds">): boolean {
  return event.groupId.trim().length > 0 &&
    event.createdByAccountId.trim().length > 0 &&
    event.title.trim().length >= 1 && event.title.length <= EVENT_TITLE_MAX &&
    (event.description === null || event.description.length <= EVENT_DESCRIPTION_MAX) &&
    (event.location === null || event.location.length <= EVENT_LOCATION_MAX) &&
    Number.isSafeInteger(event.startsAt) && event.startsAt > 0;
}

export function decideFamilyGroupInvitation(
  invitation: FamilyGroupInvitation,
  actorAccountId: string,
  decision: "accept" | "decline",
  nowMs: number,
): FamilyGroupResult<FamilyGroupInvitation> {
  if (invitation.status !== "pending") return { ok: false, error: "invitation_not_pending" };
  if (actorAccountId !== invitation.inviteeAccountId) return { ok: false, error: "actor_not_invitee" };
  if (nowMs >= invitation.expiresAt) return { ok: false, error: "invitation_expired" };
  if (invitation.inviteeAccountId === invitation.inviterAccountId) return { ok: false, error: "invitee_is_inviter" };
  return {
    ok: true,
    value: {
      ...invitation,
      status: decision === "accept" ? "accepted" : "declined",
      decidedAt: nowMs,
    },
  };
}

export function leaveFamilyGroup(group: FamilyGroup, actorAccountId: string, nowMs: number): FamilyGroupResult<FamilyGroup> {
  const member = activeMember(group, actorAccountId);
  if (!member) return { ok: false, error: "actor_not_member" };
  if (member.role === "owner") return { ok: false, error: "owner_cannot_leave" };
  return {
    ok: true,
    value: {
      ...group,
      members: group.members.map((item) => item.accountId === actorAccountId
        ? { ...item, status: "left", leftAt: nowMs }
        : item),
    },
  };
}

export function removeFamilyGroupMember(
  group: FamilyGroup,
  actorAccountId: string,
  targetAccountId: string,
  nowMs: number,
): FamilyGroupResult<FamilyGroup> {
  if (!canManageGroup(group, actorAccountId)) return { ok: false, error: "actor_not_owner" };
  if (targetAccountId === group.ownerAccountId) return { ok: false, error: "owner_cannot_leave" };
  const target = activeMember(group, targetAccountId);
  if (!target) return { ok: false, error: "member_not_active" };
  return {
    ok: true,
    value: {
      ...group,
      members: group.members.map((item) => item.accountId === targetAccountId
        ? { ...item, status: "removed", leftAt: nowMs }
        : item),
    },
  };
}

/**
 * L'appartenance à un groupe ne suffit jamais. Seul un partage explicite actif
 * accorde la lecture ou l'édition d'un rappel.
 */
export function canReadReminder(
  ownerAccountId: string,
  reminderId: string,
  requesterAccountId: string,
  shares: readonly ReminderShare[],
): boolean {
  if (ownerAccountId === requesterAccountId) return true;
  return shares.some((share) =>
    share.status === "active" &&
    share.ownerAccountId === ownerAccountId &&
    share.granteeAccountId === requesterAccountId &&
    share.canRead &&
    (share.reminderId === null || share.reminderId === reminderId)
  );
}

export function canEditReminder(
  ownerAccountId: string,
  reminderId: string,
  requesterAccountId: string,
  shares: readonly ReminderShare[],
): boolean {
  if (ownerAccountId === requesterAccountId) return true;
  return shares.some((share) =>
    share.status === "active" &&
    share.ownerAccountId === ownerAccountId &&
    share.granteeAccountId === requesterAccountId &&
    share.canEdit &&
    (share.reminderId === null || share.reminderId === reminderId)
  );
}

export function groupMembershipGrantsReminderAccess(): false {
  return false;
}
