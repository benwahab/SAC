import { Clock3, UserPlus, UserRoundMinus, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { Contact, ScreenProps } from "../types";
import { Avatar, Card, Halo, Notice, Sheet, primaryBtn } from "../ui";

export default function Contacts({ copy, language, go, notice, setNotice, contacts, setContacts, loading, error, refresh }: ScreenProps & {
  contacts: Contact[]; setContacts: (c: Contact[]) => void; loading: boolean; error: string; refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [received, setReceived] = useState<Array<{ id: string; inviterEmail: string; createdAt: number; expiresAt: number }>>([]);
  const [sent, setSent] = useState<Array<{ id: string; destinationEmail: string; createdAt: number; expiresAt: number }>>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [invitationsError, setInvitationsError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/contacts/invitations/inbox", { credentials: "same-origin", cache: "no-store" });
        const payload = await response.json() as {
          received?: Array<{ id: string; inviterEmail: string; createdAt: number; expiresAt: number }>;
          sent?: Array<{ id: string; destinationEmail: string; createdAt: number; expiresAt: number }>;
        };
        if (!response.ok || !Array.isArray(payload.received) || !Array.isArray(payload.sent)) throw new Error(copy.errorGeneric);
        if (active) { setReceived(payload.received); setSent(payload.sent); }
      } catch (reason) {
        if (active) setInvitationsError(reason instanceof Error ? reason.message : copy.errorGeneric);
      } finally { if (active) setInvitationsLoading(false); }
    })();
    return () => { active = false; };
  }, [copy.errorGeneric]);

  async function revoke(contactAccountId: string) {
    if (busy || !window.confirm(copy.contactRemoveConfirm)) return;
    setBusy(true); setProblem(""); setNotice("");
    try {
      const response = await fetch("/api/contacts/revoke", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactAccountId }) });
      const payload = await response.json() as { revoked?: boolean };
      if (!response.ok || !payload.revoked) throw new Error(copy.contactRemoveError);
      setContacts(contacts.filter((c) => c.accountId !== contactAccountId));
      setNotice(copy.contactRemoved);
    } catch (reason) { setProblem(reason instanceof Error ? reason.message : copy.errorGeneric); } finally { setBusy(false); }
  }
  return (
    <>
      <Halo title={copy.contactsTitle} eyebrow={copy.privateSpace}><p className="mt-1 text-sm text-white/90">{copy.contactsIntro}</p></Halo>
      <Sheet>
        {notice && <Notice kind="ok">{notice}</Notice>}
        {(problem || error) && <Notice kind="error">{problem || error}</Notice>}
        <button type="button" onClick={() => go({ name: "invite" })} className={primaryBtn}><UserPlus size={20} />{copy.contactsAdd}</button>
        {loading ? <p className="py-6 text-center text-sm text-sac-muted">{copy.loading}</p> : contacts.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-sac-primary/30 bg-white px-4 py-8 text-center"><UsersRound className="mx-auto text-sac-muted" size={30} /><p className="mt-3 font-extrabold">{copy.contactsEmpty}</p><p className="mt-1 text-sm text-sac-muted">{copy.contactsEmptyHint}</p></div>
        ) : (
          <Card className="!py-1"><ul className="divide-y divide-[#F0EAE5]">{contacts.map((c) => (
            <li key={c.accountId} className="flex items-center gap-3 py-3"><Avatar email={c.email} />
              <div className="min-w-0 flex-1"><p className="truncate font-bold" dir="ltr">{c.email}</p><p className="text-xs font-semibold text-sac-confirm">{copy.contactVerified}</p></div>
              <button type="button" disabled={busy} onClick={() => void revoke(c.accountId)} className="inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-[14px] border border-sac-alert/25 bg-sac-alert/5 px-3 text-xs font-bold text-sac-alert disabled:opacity-50"><UserRoundMinus size={15} />{copy.contactRemove}</button></li>))}</ul></Card>
        )}
        <p className="px-1 text-xs text-sac-muted">{copy.contactsLimit}</p>
        <Card className="!bg-sac-sand">
          <h2 className="flex items-center gap-2 font-extrabold"><Clock3 size={17} />{language === "fr" ? "Invitations en attente" : language === "en" ? "Pending invitations" : "الدعوات المعلّقة"}</h2>
          {invitationsLoading ? <p className="mt-2 text-sm text-sac-muted">{copy.loading}</p> : invitationsError ? (
            <p role="alert" className="mt-2 text-sm text-sac-alert">{invitationsError}</p>
          ) : received.length === 0 && sent.length === 0 ? (
            <p className="mt-2 text-sm text-sac-muted">{language === "fr" ? "Aucune invitation en attente." : language === "en" ? "No pending invitations." : "لا توجد دعوات معلّقة."}</p>
          ) : (
            <div className="mt-3 space-y-3">
              {received.length > 0 && <div><p className="text-xs font-extrabold uppercase tracking-wide text-sac-muted">{language === "fr" ? "Reçues" : language === "en" ? "Received" : "الواردة"}</p><ul className="mt-2 space-y-2">{received.map((item) => <li key={item.id} className="rounded-xl border border-white/80 bg-white/70 p-3"><p className="text-sm font-bold" dir="ltr">{item.inviterEmail}</p><p className="mt-1 text-xs leading-5 text-sac-muted">{language === "fr" ? "Ouvrez le lien reçu par e-mail pour accepter ou refuser." : language === "en" ? "Open the link sent by email to accept or decline." : "افتح الرابط المرسل بالبريد لقبول الدعوة أو رفضها."}</p><p className="mt-1 text-xs text-sac-muted">{language === "fr" ? "Expire le " : language === "en" ? "Expires " : "تنتهي "}{new Date(item.expiresAt).toLocaleString(language === "ar" ? "ar" : language === "en" ? "en" : "fr")}</p></li>)}</ul></div>}
              {sent.length > 0 && <div><p className="text-xs font-extrabold uppercase tracking-wide text-sac-muted">{language === "fr" ? "Envoyées" : language === "en" ? "Sent" : "الصادرة"}</p><ul className="mt-2 space-y-2">{sent.map((item) => <li key={item.id} className="rounded-xl border border-white/80 bg-white/70 p-3"><p className="text-sm font-bold" dir="ltr">{item.destinationEmail}</p><p className="mt-1 text-xs text-sac-muted">{language === "fr" ? "En attente de réponse" : language === "en" ? "Awaiting response" : "بانتظار الرد"} · {new Date(item.expiresAt).toLocaleString(language === "ar" ? "ar" : language === "en" ? "en" : "fr")}</p></li>)}</ul></div>}
            </div>
          )}
        </Card>
        <button type="button" onClick={() => { void refresh(); setInvitationsLoading(true); setInvitationsError(""); fetch("/api/contacts/invitations/inbox", { credentials: "same-origin", cache: "no-store" }).then(async (response) => { const payload = await response.json() as { received?: typeof received; sent?: typeof sent }; if (!response.ok || !Array.isArray(payload.received) || !Array.isArray(payload.sent)) throw new Error(copy.errorGeneric); setReceived(payload.received); setSent(payload.sent); }).catch((reason) => setInvitationsError(reason instanceof Error ? reason.message : copy.errorGeneric)).finally(() => setInvitationsLoading(false)); }} disabled={loading || invitationsLoading} className="min-h-12 text-sm font-bold text-sac-ember underline">{copy.refresh}</button>
      </Sheet>
    </>
  );
}
