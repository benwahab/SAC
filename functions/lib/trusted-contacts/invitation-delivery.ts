import {
  cancelPendingContactInvitation,
  createContactInvitation,
  type ContactInvitationServiceError,
} from "./service.ts";
import {
  sendContactInvitationEmail,
  type ContactInvitationEmailEnvironment,
} from "../email/contact-invitation.ts";
import type { SacEmailLanguage } from "../email/resend.ts";

type InvitationDatabase = Pick<D1Database, "prepare" | "batch">;

export type InvitationDeliveryResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly invitationId: string;
        readonly destinationEmail: string;
        readonly expiresAt: number;
        readonly deliveryMessageId: string;
      };
    }
  | {
      readonly ok: false;
      readonly error: ContactInvitationServiceError | "delivery_failed";
      readonly invitationId?: string;
    };

/**
 * Creates the D1 invitation, sends its one-time link, and cancels the pending
 * record if the provider rejects delivery. The raw token is never returned to
 * the browser and is never persisted in D1.
 */
export async function createAndSendContactInvitation(
  db: InvitationDatabase,
  cryptoProvider: Crypto,
  emailEnvironment: ContactInvitationEmailEnvironment,
  input: {
    readonly authenticatedAccountId: string;
    readonly destinationEmail: string;
    readonly permissionVersion: string;
    readonly expiresAt: number;
    readonly language: SacEmailLanguage;
    readonly now?: number;
  },
  fetcher: typeof fetch = fetch,
): Promise<InvitationDeliveryResult> {
  const created = await createContactInvitation(db, cryptoProvider, {
    authenticatedAccountId: input.authenticatedAccountId,
    destinationEmail: input.destinationEmail,
    permissionVersion: input.permissionVersion,
    expiresAt: input.expiresAt,
    now: input.now,
  });
  if (!created.ok) return created;

  const delivery = await sendContactInvitationEmail(
    emailEnvironment,
    {
      recipientEmail: created.value.destinationEmail,
      invitationId: created.value.invitationId,
      token: created.value.token,
      expiresAt: created.value.expiresAt,
      language: input.language,
    },
    fetcher,
  );

  if (!delivery.ok) {
    const cancelled = await cancelPendingContactInvitation(db, {
      authenticatedOwnerAccountId: input.authenticatedAccountId,
      invitationId: created.value.invitationId,
      now: input.now,
    });
    if (!cancelled.ok) return { ok: false, error: cancelled.error };
    return { ok: false, error: "delivery_failed", invitationId: created.value.invitationId };
  }

  return {
    ok: true,
    value: {
      invitationId: created.value.invitationId,
      destinationEmail: created.value.destinationEmail,
      expiresAt: created.value.expiresAt,
      deliveryMessageId: delivery.messageId,
    },
  };
}
