import assert from "node:assert/strict";
import test from "node:test";
import {
  canCreateFamilyEvent,
  canEditReminder,
  canInviteToGroup,
  canManageGroup,
  canReadReminder,
  canViewFamilyEvent,
  decideFamilyGroupInvitation,
  groupMembershipGrantsReminderAccess,
  leaveFamilyGroup,
  removeFamilyGroupMember,
  resolveFamilyEventAudience,
  validateFamilyEvent,
  validateFamilyGroupName,
  type FamilyGroup,
  type FamilyGroupEvent,
  type FamilyGroupInvitation,
  type ReminderShare,
} from "../src/domain/family-group.ts";

const group: FamilyGroup = {
  groupId: "group-a",
  ownerAccountId: "owner-a",
  name: "Famille A",
  members: [
    { accountId: "owner-a", role: "owner", status: "active", joinedAt: 1, leftAt: null },
    { accountId: "member-a", role: "member", status: "active", joinedAt: 2, leftAt: null },
    { accountId: "member-b", role: "member", status: "left", joinedAt: 3, leftAt: 4 },
  ],
};

const event: FamilyGroupEvent = {
  eventId: "event-a",
  groupId: "group-a",
  createdByAccountId: "owner-a",
  title: "Anniversaire",
  description: null,
  startsAt: Date.UTC(2026, 11, 1, 10, 0),
  location: null,
  status: "active",
  audienceAccountIds: ["owner-a", "member-a"],
};

test("l'appartenance à un groupe ne donne aucun accès aux rappels", () => {
  assert.equal(groupMembershipGrantsReminderAccess(), false);
  assert.equal(canReadReminder("owner-a", "reminder-a", "member-a", []), false);
  assert.equal(canEditReminder("owner-a", "reminder-a", "member-a", []), false);
});

test("un partage explicite accorde la lecture sans donner l'édition", () => {
  const share: ReminderShare = {
    shareId: "share-a",
    ownerAccountId: "owner-a",
    granteeAccountId: "member-a",
    reminderId: "reminder-a",
    canRead: true,
    canEdit: false,
    status: "active",
    createdAt: 10,
    revokedAt: null,
  };
  assert.equal(canReadReminder("owner-a", "reminder-a", "member-a", [share]), true);
  assert.equal(canReadReminder("owner-a", "reminder-b", "member-a", [share]), false);
  assert.equal(canEditReminder("owner-a", "reminder-a", "member-a", [share]), false);
});

test("un partage révoqué ne donne plus accès", () => {
  const share: ReminderShare = {
    shareId: "share-a",
    ownerAccountId: "owner-a",
    granteeAccountId: "member-a",
    reminderId: null,
    canRead: true,
    canEdit: true,
    status: "revoked",
    createdAt: 10,
    revokedAt: 20,
  };
  assert.equal(canReadReminder("owner-a", "reminder-a", "member-a", [share]), false);
  assert.equal(canEditReminder("owner-a", "reminder-a", "member-a", [share]), false);
});

test("l'audience 'all' ne contient que les membres actifs", () => {
  const result = resolveFamilyEventAudience(group, "all", []);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value, ["owner-a", "member-a"]);
});

test("une audience sélectionnée refuse un non-membre", () => {
  assert.deepEqual(resolveFamilyEventAudience(group, "selected", []), { ok: false, error: "audience_empty" });
  assert.deepEqual(resolveFamilyEventAudience(group, "selected", ["member-b"]), { ok: false, error: "audience_not_member" });
  assert.deepEqual(resolveFamilyEventAudience(group, "selected", ["owner-a", "owner-a"]), { ok: true, value: ["owner-a"] });
});

test("un événement n'est visible que par un membre actif de son audience", () => {
  assert.equal(canViewFamilyEvent(group, event, "owner-a"), true);
  assert.equal(canViewFamilyEvent(group, event, "member-a"), true);
  assert.equal(canViewFamilyEvent(group, event, "member-b"), false);
  assert.equal(canViewFamilyEvent(group, { ...event, audienceAccountIds: ["owner-a"] }, "member-a"), false);
});

test("seul le propriétaire gère le groupe et invite", () => {
  assert.equal(canManageGroup(group, "owner-a"), true);
  assert.equal(canManageGroup(group, "member-a"), false);
  assert.equal(canInviteToGroup(group, "owner-a"), true);
  assert.equal(canInviteToGroup(group, "member-a"), false);
  assert.equal(canCreateFamilyEvent(group, "member-a"), true);
  assert.equal(canCreateFamilyEvent(group, "member-b"), false);
});

test("une invitation ne peut être acceptée que par l'invité et une seule fois", () => {
  const invitation: FamilyGroupInvitation = {
    invitationId: "invitation-a",
    groupId: "group-a",
    inviterAccountId: "owner-a",
    inviteeAccountId: "member-a",
    status: "pending",
    createdAt: 100,
    expiresAt: 200,
    decidedAt: null,
  };
  assert.deepEqual(decideFamilyGroupInvitation(invitation, "owner-a", "accept", 150), { ok: false, error: "actor_not_invitee" });
  assert.deepEqual(decideFamilyGroupInvitation(invitation, "member-a", "accept", 200), { ok: false, error: "invitation_expired" });
  const accepted = decideFamilyGroupInvitation(invitation, "member-a", "accept", 150);
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  assert.equal(accepted.value.status, "accepted");
  assert.equal(accepted.value.decidedAt, 150);
  assert.deepEqual(decideFamilyGroupInvitation(accepted.value, "member-a", "decline", 160), { ok: false, error: "invitation_not_pending" });
});

test("un membre peut quitter le groupe, pas le propriétaire", () => {
  const left = leaveFamilyGroup(group, "member-a", 50);
  assert.equal(left.ok, true);
  if (!left.ok) return;
  assert.equal(left.value.members.find((item) => item.accountId === "member-a")?.status, "left");
  assert.deepEqual(leaveFamilyGroup(group, "owner-a", 50), { ok: false, error: "owner_cannot_leave" });
});

test("seul le propriétaire peut retirer un membre", () => {
  assert.deepEqual(removeFamilyGroupMember(group, "member-a", "owner-a", 50), { ok: false, error: "actor_not_owner" });
  assert.deepEqual(removeFamilyGroupMember(group, "owner-a", "owner-a", 50), { ok: false, error: "owner_cannot_leave" });
  const removed = removeFamilyGroupMember(group, "owner-a", "member-a", 50);
  assert.equal(removed.ok, true);
  if (!removed.ok) return;
  assert.equal(removed.value.members.find((item) => item.accountId === "member-a")?.status, "removed");
});

test("valide les noms et les événements", () => {
  assert.equal(validateFamilyGroupName("Famille A"), true);
  assert.equal(validateFamilyGroupName("   "), false);
  const input = {
    groupId: event.groupId,
    createdByAccountId: event.createdByAccountId,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt,
    location: event.location,
  };
  assert.equal(validateFamilyEvent(input), true);
  assert.equal(validateFamilyEvent({ ...input, title: "" }), false);
});
