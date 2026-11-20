import { Clock3, UserPlus, UserRoundMinus, UsersRound } from "lucide-react";
import { useState } from "react";
import type { Contact, ScreenProps } from "../types";
import { Avatar, Card, Halo, Notice, Sheet, primaryBtn } from "../ui";

export default function Contacts({ copy, go, notice, setNotice, contacts, setContacts, loading, error, refresh }: ScreenProps & {
  contacts: Contact[]; setContacts: (c: Contact[]) => void; loading: boolean; error: string; refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
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
        <Card className="!bg-sac-sand"><h2 className="flex items-center gap-2 font-extrabold"><Clock3 size={17} />{copy.pendingTitle}</h2><p className="mt-1 text-sm leading-6 text-sac-muted">{copy.pendingSoon}</p></Card>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="min-h-12 text-sm font-bold text-sac-ember underline">{copy.refresh}</button>
      </Sheet>
    </>
  );
}
