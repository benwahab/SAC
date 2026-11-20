import { CheckCircle2, MailPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { ScreenProps } from "../types";
import { Card, Halo, Notice, Sheet, fieldClass, ghostBtn, primaryBtn } from "../ui";

export default function Invite({ copy, go }: ScreenProps) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/contacts/invitations", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ destinationEmail: email.trim() }) });
      const payload = await response.json() as { invitationSent?: boolean; error?: string };
      if (!response.ok || !payload.invitationSent) {
        const messages: Record<string, string> = { invitation_service_not_configured: copy.inviteErrNotConfigured, account_not_eligible: copy.inviteErrNotEligible, relationship_already_active: copy.inviteErrAlready, self_invitation: copy.inviteErrSelf, invalid_email: copy.inviteErrEmail };
        throw new Error(messages[payload.error ?? ""] ?? copy.inviteErrGeneric);
      }
      setEmail(""); setSent(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : copy.errorGeneric); } finally { setBusy(false); }
  }
  return (
    <>
      <Halo title={copy.inviteTitle} eyebrow={copy.privateSpace} onBack={() => go({ name: "contacts" })} backLabel={copy.back}><p className="mt-1 text-sm text-white/90">{copy.inviteIntro}</p></Halo>
      <Sheet>
        {sent ? (
          <Card className="!border-sac-confirm/40 text-center"><CheckCircle2 className="mx-auto text-sac-confirm" size={40} /><p role="status" className="mt-3 font-extrabold leading-6">{copy.inviteSent}</p>
            <div className="mt-4 flex flex-col gap-2"><button type="button" onClick={() => setSent(false)} className={ghostBtn}>{copy.inviteAnother}</button><button type="button" onClick={() => go({ name: "contacts" })} className={primaryBtn}>{copy.inviteBack}</button></div></Card>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Card><label htmlFor="sac-invite-email" className="mb-2 block text-sm font-bold">{copy.inviteLabel}</label>
              <input id="sac-invite-email" type="email" required maxLength={254} autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={copy.invitePlaceholder} className={fieldClass} />
              <p className="mt-2 text-xs leading-5 text-sac-muted">{copy.inviteNote}</p></Card>
            {error && <Notice kind="error">{error}</Notice>}
            <button type="submit" disabled={busy || !email.trim()} className={primaryBtn}><MailPlus size={20} />{busy ? copy.inviteSending : copy.inviteSend}</button>
          </form>
        )}
      </Sheet>
    </>
  );
}
