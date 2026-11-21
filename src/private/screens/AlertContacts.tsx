import { MailPlus, ShieldCheck, UserRoundMinus, UsersRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Contact, ScreenProps } from "../types";
import { Avatar, Card, Halo, Notice, Sheet, fieldClass, ghostBtn, primaryBtn } from "../ui";

export default function AlertContacts({ copy, go, notice, setNotice, contacts, setContacts, loading, error, refresh }: ScreenProps & {
  contacts: Contact[]; setContacts: (contacts: Contact[]) => void;
  loading: boolean; error: string; refresh: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [sent, setSent] = useState(false);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true); setProblem(""); setNotice("");
    try {
      const response = await fetch("/api/contacts/invitations", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationEmail: email.trim() }),
      });
      const payload = await response.json() as { invitationSent?: boolean; error?: string };
      if (!response.ok || !payload.invitationSent) {
        const messages: Record<string, string> = {
          invitation_service_not_configured: copy.alertContactsErrNotConfigured,
          account_not_eligible: copy.alertContactsErrNotEligible,
          relationship_already_active: copy.alertContactsErrAlready,
          self_invitation: copy.alertContactsErrSelf,
          invalid_email: copy.alertContactsErrEmail,
        };
        throw new Error(messages[payload.error ?? ""] ?? copy.alertContactsErrGeneric);
      }
      setEmail(""); setSent(true);
    } catch (reason) { setProblem(reason instanceof Error ? reason.message : copy.alertContactsErrGeneric); }
    finally { setBusy(false); }
  }

  async function revoke(accountId: string) {
    if (busy || !window.confirm(copy.contactRemoveConfirm)) return;
    setBusy(true); setProblem(""); setNotice("");
    try {
      const response = await fetch("/api/contacts/revoke", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactAccountId: accountId }),
      });
      const payload = await response.json() as { revoked?: boolean };
      if (!response.ok || !payload.revoked) throw new Error(copy.contactRemoveError);
      setContacts(contacts.filter((contact) => contact.accountId !== accountId));
      setNotice(copy.contactRemoved);
    } catch (reason) { setProblem(reason instanceof Error ? reason.message : copy.contactRemoveError); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Halo title={copy.alertContactsTitle} eyebrow={copy.privateSpace} onBack={() => go({ name: "contacts" })} backLabel={copy.back}><p className="mt-1 text-sm text-white/90">{copy.alertContactsIntro}</p></Halo>
      <Sheet>
        {notice && <Notice kind="ok">{notice}</Notice>}
        {(problem || error) && <Notice kind="error">{problem || error}</Notice>}
        <Card>
          <h2 className="flex items-center gap-2 font-extrabold"><UsersRound size={18} />{copy.alertContactsTitle}</h2>
          {loading ? <p className="mt-2 text-sm text-sac-muted">{copy.loading}</p> : contacts.length === 0 ? <p className="mt-2 text-sm text-sac-muted">{copy.alertContactsEmpty}</p> : (
            <ul className="mt-2 divide-y divide-[#F0EAE5]">
              {contacts.map((contact) => (
                <li key={contact.accountId} className="flex items-center gap-3 py-3">
                  <Avatar email={contact.email} />
                  <div className="min-w-0 flex-1"><p className="truncate font-bold" dir="ltr">{contact.email}</p><p className="text-xs font-semibold text-sac-confirm">{copy.contactVerified}</p></div>
                  <button type="button" disabled={busy} onClick={() => void revoke(contact.accountId)} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[14px] border border-sac-alert/25 bg-sac-alert/5 px-3 text-xs font-bold text-sac-alert disabled:opacity-50"><UserRoundMinus size={15} />{copy.contactRemove}</button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-sac-muted">{copy.alertContactsLimit}</p>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 font-extrabold"><ShieldCheck size={18} />{copy.alertContactsAdd}</h2>
          {sent ? <p role="status" className="mt-2 text-sm font-semibold text-sac-confirm">{copy.alertContactsInviteSent}</p> : (
            <form onSubmit={invite} className="mt-3 flex flex-col gap-2">
              <label htmlFor="alert-contact-email" className="text-sm font-bold">{copy.alertContactsInviteLabel}</label>
              <input id="alert-contact-email" type="email" required maxLength={254} autoComplete="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={copy.alertContactsInvitePlaceholder} className={fieldClass} />
              <button type="submit" disabled={busy || !email.trim()} className={primaryBtn}><MailPlus size={18} />{busy ? copy.alertContactsInviteSending : copy.alertContactsInviteSend}</button>
            </form>
          )}
        </Card>

        <button type="button" onClick={() => void refresh()} disabled={loading} className={ghostBtn + " w-full"}>{copy.refresh}</button>
      </Sheet>
    </>
  );
}
