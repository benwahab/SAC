import type { PrivateCopy } from "../i18n/translations";

export function accountErrorMessage(copy: PrivateCopy, code: string | undefined): string {
  switch (code) {
    case "invalid_first_name":
    case "invalid_last_name":
    case "profile_names_required": return copy.accountErrInvalidName;
    case "invalid_photo":
    case "photo_too_large": return copy.accountErrInvalidPhoto;
    case "wrong_password":
    case "invalid_current_password":
    case "invalid_credentials": return copy.accountErrWrongPassword;
    case "invalid_or_expired_code":
    case "invalid_code":
    case "too_many_attempts": return copy.accountErrInvalidCode;
    case "unchanged": return copy.accountErrConflict;
    case "rate_limited": return copy.accountErrRateLimited;
    case "identity_conflict":
    case "email_already_used":
    case "phone_already_used": return copy.accountErrConflict;
    default: return copy.accountErrGeneric;
  }
}

export function socialErrorMessage(copy: PrivateCopy, code: string | undefined): string {
  switch (code) {
    case "recipient_not_discoverable": return copy.inviteErrNotDiscoverable;
    case "self_invitation": return copy.inviteErrSelf;
    case "relationship_already_active": return copy.inviteErrAlready;
    case "invitation_already_pending": return copy.inviteErrAlready;
    case "rate_limited": return copy.inviteErrRateLimited;
    case "contact_not_found": return copy.contactsErrNotFound;
    default: return copy.contactsErrInvite;
  }
}
