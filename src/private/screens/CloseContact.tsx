import { Mail, Phone, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { CloseContact as CloseContactType, RelationPermission, ScreenProps } from "../types";
import { socialErrorMessage } from "../errors";
import { Card, Halo, Notice, ProfileAvatar, Sheet, primaryBtn } from "../ui";

export default function CloseContact({ copy, go, notice, setNotice, id, refreshSocial }: ScreenProps & {
  id: string; refreshSocial: () => Promise<void>;
}) {
  const [contact, setContact] = useState<CloseContactType | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<RelationPermission | "remove" | null>(null);
  const [problem, setProblem] = useState("");

  async function fetchContact(): Promise<CloseContactType> {
    const response = await fetch(`/api/proximity/contacts/profile?accountId=${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store" });
    const payload = await response.json() as { contact?: CloseContactType; error?: string };
    if (!response.ok || !payload.contact) throw new Error(socialErrorMessage(copy, payload.error));
    return payload.contact;
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const loaded = await fetchContact();
        if (active) setContact(loaded);
      } catch (reason) {
        if (active) setProblem(reason instanceof Error ? reason.message : copy.contactNotFound);
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [copy, id]);

  async function toggle(permission: RelationPermission, granted: boolean) {
    if (busy || !contact) return;
    setBusy(permission); setProblem(""); setNotice("");
    try {
      const response = await fetch("/api/proximity/permissions", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: contact.accountId, permission, granted }),
      });
      const payload = await response.json() as { updated?: boolean; error?: string };
      if (!response.ok || payload.updated !== true) throw new Error(socialErrorMessage(copy, payload.error));
      setContact(await fetchContact());
      await refreshSocial();
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : copy.contactPermissionError);
    } finally { setBusy(null); }
  }

  async function remove() {
    if (busy || !contact || !window.confirm(copy.contactRemoveConfirm)) return;
    setBusy("remove"); setProblem(""); setNotice("");
    try {
      const response = await fetch("/api/proximity/contacts/remove", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: contact.accountId }),
      });
      const payload = await response.json() as { removed?: boolean; error?: string };
      if (!response.ok || payload.removed !== true) throw new Error(socialErrorMessage(copy, payload.error));
      await refreshSocial();
      go({ name: "contacts" });
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : copy.contactRemoveError);
    } finally { setBusy(null); }
  }

  const permissionRow = (permission: RelationPermission, label: string, hint: string, enabled: boolean) => (
    <div className="flex items-start gap-3 border-t border-[#F0EAE5] py-3 first:border-t-0">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sac-primary/10 text-sac-primary"><UserRound size={18} /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-bold">{label}</p><p className="mt-0.5 text-xs leading-5 text-sac-muted">{hint}</p></div>
      <button type="button" role="switch" aria-checked={enabled} aria-label={label} disabled={busy !== null} onClick={() => void toggle(permission, !enabled)}
        className={"relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 " + (enabled ? "bg-sac-confirm" : "bg-[#D8CEC6]")}>
        <span className={"absolute top-1 size-5 rounded-full bg-white shadow transition-all " + (enabled ? "start-6" : "start-1")} />
      </button>
    </div>
  );

  return (
    <>
      <Halo title={copy.contactTitle} eyebrow={copy.privateSpace} onBack={() => go({ name: "contacts" })} backLabel={copy.back} />
      <Sheet>
        {notice && <Notice kind="ok">{notice}</Notice>}
        {(problem) && <Notice kind="error">{problem}</Notice>}
        {loading ? <p className="py-6 text-center text-sm text-sac-muted">{copy.loading}</p> : !contact ? (
          <Card className="text-center"><p className="font-extrabold">{copy.contactNotFound}</p><button type="button" onClick={() => go({ name: "contacts" })} className={"mt-4 " + primaryBtn}>{copy.back}</button></Card>
        ) : (
          <>
            <Card className="text-center">
              <ProfileAvatar photoUrl={contact.photoUrl} name={contact.firstName} size="lg" />
              <h2 className="mt-3 text-xl font-extrabold">{contact.firstName} {contact.lastName}</h2>
              <p className="mt-1 text-xs font-semibold text-sac-confirm">{copy.contactsRelationActive}</p>
            </Card>

            <Card>
              <h2 className="flex items-center gap-2 font-extrabold"><ShieldCheck size={18} />{copy.contactPermissionsTitle}</h2>
              <p className="mt-1 text-sm leading-6 text-sac-muted">{copy.contactPermissionsIntro}</p>
              <div className="mt-2">
                {permissionRow("profile_photo", copy.contactPermissionPhoto, copy.contactPermissionPhotoHint, contact.permissionsFromMe.profilePhoto)}
                {permissionRow("contact_details", copy.contactPermissionDetails, copy.contactPermissionDetailsHint, contact.permissionsFromMe.contactDetails)}
              </div>
            </Card>

            <Card>
              <h2 className="font-extrabold">{copy.contactDetailsTitle}</h2>
              {!contact.contactDetails ? <p className="mt-2 text-sm text-sac-muted">{copy.contactDetailsHidden}</p> : (
                <dl className="mt-2 space-y-2 text-sm">
                  {contact.contactDetails.email && <div className="flex items-center gap-2"><dt className="text-sac-muted"><Mail size={16} aria-label={copy.contactDetailsEmail} /></dt><dd className="font-semibold" dir="ltr">{contact.contactDetails.email}</dd></div>}
                  {contact.contactDetails.phone && <div className="flex items-center gap-2"><dt className="text-sac-muted"><Phone size={16} aria-label={copy.contactDetailsPhone} /></dt><dd className="font-semibold"><span dir="ltr">{contact.contactDetails.phone}</span>{!contact.contactDetails.phoneVerified && <span className="block text-xs font-normal text-sac-muted">{copy.contactPhoneUnverified}</span>}</dd></div>}
                </dl>
              )}
            </Card>

            <button type="button" disabled={busy !== null} onClick={() => void remove()} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[18px] border-2 border-sac-alert bg-white px-5 font-extrabold text-sac-alert disabled:opacity-50"><Trash2 size={18} />{copy.contactRemove}</button>
          </>
        )}
      </Sheet>
    </>
  );
}
