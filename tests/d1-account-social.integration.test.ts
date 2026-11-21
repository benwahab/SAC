import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

const PORT = 8805;
const BASE = `http://127.0.0.1:${PORT}`;
const CONFIG = "tests/wrangler.account-social.toml";
const WRANGLER = "node_modules/wrangler/bin/wrangler.js";
const STATE = mkdtempSync(join(tmpdir(), "sac-account-social-"));

async function command(args: string[]): Promise<string> {
  const child = spawn(process.execPath, [WRANGLER, ...args], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout?.on("data", (x: Buffer) => output += x.toString());
  child.stderr?.on("data", (x: Buffer) => output += x.toString());
  const [code] = await once(child, "exit") as [number | null];
  if (code !== 0) throw new Error(`Wrangler failed: ${args.join(" ")}\n${output}`);
  return output;
}

async function get<T>(path: string): Promise<{ status: number; data: T }> {
  const response = await fetch(BASE + path);
  return { status: response.status, data: await response.json() as T };
}

async function post<T>(path: string, data: unknown): Promise<{ status: number; data: T }> {
  const response = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  return { status: response.status, data: await response.json() as T };
}

test("profils, confidentialité et relations réciproques fonctionnent dans D1 isolé", { timeout: 180_000 }, async (t) => {
  t.after(() => rmSync(STATE, { recursive: true, force: true }));
  const applied = await command(["d1", "migrations", "apply", "sac-account-social-test-v2", "--local", "--persist-to", STATE, "--config", CONFIG]);
  assert.match(applied, /success|applied|No migrations/i);

  const child = spawn(process.execPath, [WRANGLER, "dev", "--local", "--persist-to", STATE, "--config", CONFIG, "--port", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout?.on("data", (x: Buffer) => output += x.toString());
  child.stderr?.on("data", (x: Buffer) => output += x.toString());
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([once(child, "exit"), delay(3000)]);
    }
  });

  let ready = false;
  for (let index = 0; index < 200; index += 1) {
    try {
      const response = await fetch(BASE + "/health");
      if (response.ok) { ready = true; break; }
    } catch {}
    await delay(300);
  }
  assert.equal(ready, true, output);

  const seeded = await post<{
    owner: string; friend: string; hidden: string;
    ownerFirstName: string; friendFirstName: string; hiddenFirstName: string;
    ownerEmail: string; friendEmail: string; hiddenEmail: string;
  }>("/seed", {});
  assert.equal(seeded.status, 200, JSON.stringify(seeded.data));
  const { owner, friend, hidden, ownerFirstName, friendFirstName, hiddenFirstName, friendEmail, hiddenEmail } = seeded.data;

  const byName = await get<{ ok: boolean; value: Array<{ accountId: string; firstName: string; photoUrl: string | null; relation: string }> }>(
    `/search?viewer=${owner}&mode=name&q=${encodeURIComponent(friendFirstName)}`,
  );
  assert.equal(byName.status, 200, JSON.stringify(byName.data));
  assert.equal(byName.data.ok, true);
  assert.equal(byName.data.value.length, 1);
  assert.equal(byName.data.value[0].accountId, friend);
  assert.equal(byName.data.value[0].firstName, friendFirstName);
  assert.ok(byName.data.value[0].photoUrl);
  assert.equal(byName.data.value[0].relation, "none");

  const hiddenByName = await get<{ ok: boolean; value: unknown[] }>(
    `/search?viewer=${owner}&mode=name&q=${encodeURIComponent(hiddenFirstName)}`,
  );
  assert.equal(hiddenByName.status, 200);
  assert.equal(hiddenByName.data.value.length, 0);

  const byEmail = await get<{ ok: boolean; value: Array<{ accountId: string }> }>(
    `/search?viewer=${owner}&mode=email&q=${encodeURIComponent(friendEmail)}`,
  );
  assert.equal(byEmail.status, 200, JSON.stringify(byEmail.data));
  assert.deepEqual(byEmail.data.value.map((row) => row.accountId), [friend]);

  const hiddenInvite = await post<{ error: string }>("/invite", { inviter: owner, recipient: hidden });
  assert.equal(hiddenInvite.status, 409);
  assert.equal(hiddenInvite.data.error, "recipient_not_discoverable");

  const selfInvite = await post<{ error: string }>("/invite", { inviter: owner, recipient: owner });
  assert.equal(selfInvite.status, 409);
  assert.equal(selfInvite.data.error, "self_invitation");

  const invitation = await post<{ ok: boolean; value: { invitationId: string } }>("/invite", { inviter: owner, recipient: friend });
  assert.equal(invitation.status, 201, JSON.stringify(invitation.data));
  assert.equal(invitation.data.ok, true);
  const invitationId = invitation.data.value.invitationId;

  const friendSearchAfterInvite = await get<{ value: Array<{ relation: string }> }>(
    `/search?viewer=${friend}&mode=name&q=${encodeURIComponent(ownerFirstName)}`,
  );
  assert.equal(friendSearchAfterInvite.data.value[0]?.relation, "invitation_received");

  const friendInbox = await get<{ ok: boolean; value: Array<{ id: string; direction: string; status: string }> }>(`/invitations?accountId=${friend}`);
  assert.equal(friendInbox.status, 200);
  assert.equal(friendInbox.data.value.length, 1);
  assert.equal(friendInbox.data.value[0].direction, "received");
  assert.equal(friendInbox.data.value[0].status, "pending");

  const noContactsYet = await get<{ ok: boolean; value: unknown[] }>(`/contacts?accountId=${owner}`);
  assert.equal(noContactsYet.data.value.length, 0);

  const accepted = await post<{ ok: boolean }>("/respond", { accountId: friend, invitationId, action: "accept" });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
  assert.equal(accepted.data.ok, true);

  const ownerContacts = await get<{
    ok: boolean;
    value: Array<{
      accountId: string;
      firstName: string;
      photoUrl: string | null;
      permissionsToMe: { profilePhoto: boolean; contactDetails: boolean };
      permissionsFromMe: { profilePhoto: boolean; contactDetails: boolean };
      contactDetails: { email: string | null; phone: string | null; phoneVerified: boolean } | null;
    }>;
  }>(`/contacts?accountId=${owner}`);
  assert.equal(ownerContacts.status, 200, JSON.stringify(ownerContacts.data));
  assert.equal(ownerContacts.data.value.length, 1);
  assert.equal(ownerContacts.data.value[0].accountId, friend);
  assert.equal(ownerContacts.data.value[0].permissionsToMe.profilePhoto, false);
  assert.equal(ownerContacts.data.value[0].permissionsToMe.contactDetails, false);
  assert.equal(ownerContacts.data.value[0].contactDetails, null);
  assert.equal(ownerContacts.data.value[0].photoUrl, null);

  const grantPhoto = await post<{ ok: boolean }>("/permission", {
    accountId: friend,
    target: owner,
    permission: "profile_photo",
    granted: true,
  });
  assert.equal(grantPhoto.status, 200, JSON.stringify(grantPhoto.data));
  const ownerSeesGrantedPhoto = await get<{ value: Array<{ photoUrl: string | null }> }>(`/contacts?accountId=${owner}`);
  assert.ok(ownerSeesGrantedPhoto.data.value[0].photoUrl);

  const friendContacts = await get<{ ok: boolean; value: Array<{ accountId: string }> }>(`/contacts?accountId=${friend}`);
  assert.deepEqual(friendContacts.data.value.map((row) => row.accountId), [owner]);

  const friendSearchAfterAccept = await get<{ value: Array<{ relation: string }> }>(
    `/search?viewer=${friend}&mode=name&q=${encodeURIComponent(ownerFirstName)}`,
  );
  assert.equal(friendSearchAfterAccept.data.value[0]?.relation, "connected");

  const duplicateInvite = await post<{ error: string }>("/invite", { inviter: owner, recipient: friend });
  assert.equal(duplicateInvite.status, 409);
  assert.equal(duplicateInvite.data.error, "relationship_already_active");

  const grantDetails = await post<{ ok: boolean }>("/permission", {
    accountId: owner,
    target: friend,
    permission: "contact_details",
    granted: true,
  });
  assert.equal(grantDetails.status, 200, JSON.stringify(grantDetails.data));
  const friendSeesDetails = await get<{ value: Array<{ contactDetails: { email: string | null; phone: string | null; phoneVerified: boolean } | null }> }>(`/contacts?accountId=${friend}`);
  assert.ok(friendSeesDetails.data.value[0].contactDetails?.email);
  assert.ok(friendSeesDetails.data.value[0].contactDetails?.phone);
  assert.equal(friendSeesDetails.data.value[0].contactDetails?.phoneVerified, false);

  const revokePhoto = await post<{ ok: boolean }>("/permission", {
    accountId: friend,
    target: owner,
    permission: "profile_photo",
    granted: false,
  });
  assert.equal(revokePhoto.status, 200, JSON.stringify(revokePhoto.data));
  const ownerSeesNoPhoto = await get<{ value: Array<{ photoUrl: string | null }> }>(`/contacts?accountId=${owner}`);
  assert.equal(ownerSeesNoPhoto.data.value[0].photoUrl, null);

  const grantPhotoAgain = await post<{ ok: boolean }>("/permission", {
    accountId: friend,
    target: owner,
    permission: "profile_photo",
    granted: true,
  });
  assert.equal(grantPhotoAgain.status, 200, JSON.stringify(grantPhotoAgain.data));
  const ownerSeesPhotoAgain = await get<{ value: Array<{ photoUrl: string | null }> }>(`/contacts?accountId=${owner}`);
  assert.ok(ownerSeesPhotoAgain.data.value[0].photoUrl);

  const updatedPhoto = await post<{ ok: boolean; value: { photoVersion: number } }>("/photo-update", {
    accountId: friend,
    dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=",
  });
  assert.equal(updatedPhoto.status, 200, JSON.stringify(updatedPhoto.data));
  assert.equal(updatedPhoto.data.value.photoVersion, 2);

  const ownerAfterPhotoUpdate = await get<{ value: Array<{ photoUrl: string | null }> }>(`/contacts?accountId=${owner}`);
  assert.match(ownerAfterPhotoUpdate.data.value[0].photoUrl ?? "", /v=2/);

  const ownerProfile = await get<{ ok: boolean; value: { firstName: string; lastName: string; privacy: Record<string, boolean> } }>(`/profile?accountId=${owner}`);
  assert.equal(ownerProfile.status, 200);
  assert.equal(ownerProfile.data.value.firstName, ownerFirstName);
  assert.equal(ownerProfile.data.value.privacy.searchByName, true);

  const namesUpdated = await post<{ ok: boolean }>("/profile-update", { accountId: owner, firstName: `${ownerFirstName}a`, lastName: "Diallo" });
  assert.equal(namesUpdated.status, 200, JSON.stringify(namesUpdated.data));
  const ownerProfileAfter = await get<{ value: { firstName: string } }>(`/profile?accountId=${owner}`);
  assert.equal(ownerProfileAfter.data.value.firstName, `${ownerFirstName}a`);

  const invalidName = await post<{ ok: boolean; error: string }>("/profile-update", { accountId: owner, firstName: "<script>", lastName: "Diallo" });
  assert.equal(invalidName.status, 400);
  assert.equal(invalidName.data.error, "invalid_first_name");

  const invalidPhoto = await post<{ ok: boolean; error: string }>("/photo-update", { accountId: owner, dataUrl: "data:image/png;base64,AAAA" });
  assert.equal(invalidPhoto.status, 400);
  assert.equal(invalidPhoto.data.error, "invalid_photo");

  const ownerGrantsPhotoToFriend = await post<{ ok: boolean }>("/permission", {
    accountId: owner,
    target: friend,
    permission: "profile_photo",
    granted: true,
  });
  assert.equal(ownerGrantsPhotoToFriend.status, 200, JSON.stringify(ownerGrantsPhotoToFriend.data));
  await post("/privacy", { accountId: owner, privacy: { photoVisibleInSearch: false } });
  const unauthorizedPhoto = await get<{ ok: boolean }>(`/photo?viewer=${hidden}&target=${owner}`);
  assert.equal(unauthorizedPhoto.status, 404);
  const authorizedPhoto = await get<{ ok: boolean }>(`/photo?viewer=${friend}&target=${owner}`);
  assert.equal(authorizedPhoto.status, 200);
  await post("/privacy", { accountId: owner, privacy: { photoVisibleToContacts: false } });
  const contactPhotoHiddenByPrivacy = await get<{ ok: boolean }>(`/photo?viewer=${friend}&target=${owner}`);
  assert.equal(contactPhotoHiddenByPrivacy.status, 404);
  await post("/privacy", { accountId: owner, privacy: { photoVisibleToContacts: true } });
  const photoDeleted = await post<{ ok: boolean }>("/photo-delete", { accountId: owner });
  assert.equal(photoDeleted.status, 200, JSON.stringify(photoDeleted.data));
  const profileAfterPhotoDelete = await get<{ value: { photoUrl: string | null } }>(`/profile?accountId=${owner}`);
  assert.equal(profileAfterPhotoDelete.data.value.photoUrl, null);


  const wrongContactCode = await post<{ ok: boolean; error: string }>("/contact-change", {
    accountId: hidden,
    channel: "phone",
    newValue: "+22790000999",
    valid: false,
  });
  assert.equal(wrongContactCode.status, 400);
  assert.equal(wrongContactCode.data.error, "invalid_or_expired_code");

  const newOwnerEmail = `changed-${owner}@example.invalid`;
  const emailChanged = await post<{ ok: boolean; value: { channel: string; value: string } }>("/contact-change", {
    accountId: owner,
    channel: "email",
    newValue: newOwnerEmail,
    valid: true,
  });
  assert.equal(emailChanged.status, 200, JSON.stringify(emailChanged.data));
  assert.equal(emailChanged.data.value.value, newOwnerEmail);
  const oldEmailSearch = await get<{ ok: boolean; value: unknown[] }>(
    `/search?viewer=${friend}&mode=email&q=${encodeURIComponent(seeded.data.ownerEmail)}`,
  );
  assert.equal(oldEmailSearch.data.value.length, 0);
  const newEmailSearch = await get<{ ok: boolean; value: Array<{ accountId: string }> }>(
    `/search?viewer=${friend}&mode=email&q=${encodeURIComponent(newOwnerEmail)}`,
  );
  assert.deepEqual(newEmailSearch.data.value.map((row) => row.accountId), [owner]);

  const grantFriendDetails = await post<{ ok: boolean }>("/permission", {
    accountId: friend,
    target: owner,
    permission: "contact_details",
    granted: true,
  });
  assert.equal(grantFriendDetails.status, 200, JSON.stringify(grantFriendDetails.data));
  const newFriendPhone = "+22790000888";
  const phoneChanged = await post<{ ok: boolean; value: { channel: string; value: string } }>("/contact-change", {
    accountId: friend,
    channel: "phone",
    newValue: newFriendPhone,
    valid: true,
  });
  assert.equal(phoneChanged.status, 200, JSON.stringify(phoneChanged.data));
  assert.equal(phoneChanged.data.value.value, newFriendPhone);
  const ownerSeesNewPhone = await get<{ value: Array<{ contactDetails: { phone: string | null; phoneVerified: boolean } | null }> }>(`/contacts?accountId=${owner}`);
  assert.equal(ownerSeesNewPhone.data.value[0].contactDetails?.phone, newFriendPhone);
  assert.equal(ownerSeesNewPhone.data.value[0].contactDetails?.phoneVerified, false);

  const removed = await post<{ ok: boolean }>("/remove", { accountId: owner, target: friend });
  assert.equal(removed.status, 200, JSON.stringify(removed.data));
  const ownerAfterRemoval = await get<{ value: unknown[] }>(`/contacts?accountId=${owner}`);
  const friendAfterRemoval = await get<{ value: unknown[] }>(`/contacts?accountId=${friend}`);
  assert.equal(ownerAfterRemoval.data.value.length, 0);
  assert.equal(friendAfterRemoval.data.value.length, 0);

  const reinvite = await post<{ ok: boolean; value: { invitationId: string } }>("/invite", { inviter: owner, recipient: friend });
  assert.equal(reinvite.status, 201, JSON.stringify(reinvite.data));

  const recipientCancel = await post<{ ok: boolean; error: string }>("/respond", {
    accountId: friend,
    invitationId: reinvite.data.value.invitationId,
    action: "cancel",
  });
  assert.equal(recipientCancel.status, 409);
  const ownerCancel = await post<{ ok: boolean; value: { status: string } }>("/respond", {
    accountId: owner,
    invitationId: reinvite.data.value.invitationId,
    action: "cancel",
  });
  assert.equal(ownerCancel.status, 200, JSON.stringify(ownerCancel.data));
  assert.equal(ownerCancel.data.value.status, "cancelled");

  const suspendedInvite = await post<{ ok: boolean; value: { invitationId: string } }>("/invite", { inviter: owner, recipient: friend });
  assert.equal(suspendedInvite.status, 201, JSON.stringify(suspendedInvite.data));
  const suspendOwner = await post<{ ok: boolean }>("/status", { accountId: owner, status: "suspended" });
  assert.equal(suspendOwner.status, 200, JSON.stringify(suspendOwner.data));
  const acceptSuspended = await post<{ ok: boolean; error: string }>("/respond", {
    accountId: friend,
    invitationId: suspendedInvite.data.value.invitationId,
    action: "accept",
  });
  assert.equal(acceptSuspended.status, 409);
  const restoreOwner = await post<{ ok: boolean }>("/status", { accountId: owner, status: "active" });
  assert.equal(restoreOwner.status, 200, JSON.stringify(restoreOwner.data));

  const wrongPassword = await post<{ error: string }>("/delete", { accountId: hidden, password: "wrong" });
  assert.equal(wrongPassword.status, 401);
  const deletion = await post<{ ok: boolean }>("/delete", { accountId: hidden, password: "correct horse battery" });
  assert.equal(deletion.status, 200, JSON.stringify(deletion.data));
  const hiddenAfterDeletion = await get<{ ok: boolean }>(`/search?viewer=${owner}&mode=email&q=${encodeURIComponent(hiddenEmail)}`);
  assert.equal(hiddenAfterDeletion.data.ok, true);
});
