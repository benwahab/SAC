import { Check, ChevronRight, Search, ShieldCheck, UserPlus, UsersRound, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { RelationState } from "../../domain/account-profile";
import type { CloseContact, ProximityInvitation, ScreenProps } from "../types";
import { formatDate } from "../types";
import { socialErrorMessage } from "../errors";
import { Card, Halo, Notice, ProfileAvatar, Sheet, fieldClass, ghostBtn, primaryBtn } from "../ui";

type SearchResult = {
  accountId: string; firstName: string; lastName: string; photoUrl: string | null;
  relation: RelationState;
};

export default function Contacts({ copy, language, go, notice, setNotice, closeContacts, invitations, socialLoading, socialError, refreshSocial }: ScreenProps & {
  closeContacts: CloseContact[]; invitations: ProximityInvitation[];
  socialLoading: boolean; socialError: string; refreshSocial: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"name" | "email">("name");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [responding, setResponding] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const locale = language === "ar" ? "ar" : language === "en" ? "en-GB" : "fr-FR";
  const pending = invitations.filter((item) => item.status === "pending");

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value || searching) return;
    setSearching(true); setProblem(""); setResults(null);
    try {
      const response = await fetch(`/api/directory/search?mode=${mode}&q=${encodeURIComponent(value)}`, { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json() as { results?: SearchResult[]; error?: string };
      if (!response.ok || !Array.isArray(payload.results)) throw new Error(socialErrorMessage(copy, payload.error));
      setResults(payload.results);
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : copy.errorGeneric);
    } finally { setSearching(false); }
  }

  async function invite(accountId: string) {
    if (inviting) return;
    setInviting(accountId); setProblem(""); setNotice("");
    try {
      const response = await fetch("/api/proximity/invitations", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientAccountId: accountId }),
      });
      const payload = await response.json() as { invitationSent?: boolean; error?: string };
      if (!response.ok || payload.invitationSent !== true) throw new Error(socialErrorMessage(copy, payload.error));
      setNotice(copy.contactsInvited);
      setResults((current) => current?.map((item) => item.accountId === accountId ? { ...item, relation: "invitation_sent" } : item) ?? null);
      await refreshSocial();
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : copy.contactsErrInvite);
    } finally { setInviting(null); }
  }

  async function respond(invitationId: string, action: "accept" | "decline" | "cancel") {
    if (responding) return;
    setResponding(invitationId); setProblem(""); setNotice("");
    try {
      const response = await fetch("/api/proximity/invitations/respond", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, action }),
      });
      const payload = await response.json() as { responded?: boolean; error?: string };
      if (!response.ok || payload.responded !== true) throw new Error(socialErrorMessage(copy, payload.error));
      setNotice(action === "accept" ? copy.contactsAccepted : action === "cancel" ? copy.contactsCancelled : copy.contactsDeclined);
      await refreshSocial();
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : copy.errorGeneric);
    } finally { setResponding(null); }
  }

  return (
    <>
      <Halo title={copy.contactsTitle} eyebrow={copy.privateSpace}><p className="mt-1 text-sm text-white/90">{copy.contactsIntro}</p></Halo>
      <Sheet>
        {notice && <Notice kind="ok">{notice}</Notice>}
        {(problem || socialError) && <Notice kind="error">{problem || socialError}</Notice>}

        <Card>
          <h2 className="flex items-center gap-2 font-extrabold"><Search size={18} />{copy.contactsSearchTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-sac-muted">{copy.contactsSearchIntro}</p>
          <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label={copy.contactsSearchTitle}>
            <button type="button" aria-pressed={mode === "name"} onClick={() => { setMode("name"); setResults(null); }} className={"min-h-11 rounded-[14px] border text-sm font-extrabold " + (mode === "name" ? "border-sac-primary bg-sac-primary text-white" : "border-[#E8DCD3] bg-white")}>{copy.contactsSearchName}</button>
            <button type="button" aria-pressed={mode === "email"} onClick={() => { setMode("email"); setResults(null); }} className={"min-h-11 rounded-[14px] border text-sm font-extrabold " + (mode === "email" ? "border-sac-primary bg-sac-primary text-white" : "border-[#E8DCD3] bg-white")}>{copy.contactsSearchEmail}</button>
          </div>
          <form onSubmit={search} className="mt-3 flex gap-2">
            <input aria-label={copy.contactsSearchPlaceholder} type={mode === "email" ? "email" : "search"} value={query} onChange={(event) => setQuery(event.target.value)} maxLength={mode === "email" ? 254 : 80} placeholder={copy.contactsSearchPlaceholder} dir={mode === "email" ? "ltr" : undefined} className={fieldClass} />
            <button type="submit" disabled={searching || !query.trim()} className="min-h-12 shrink-0 rounded-[14px] bg-sac-primary px-4 text-sm font-extrabold text-white disabled:opacity-50">{searching ? copy.loading : copy.contactsSearchButton}</button>
          </form>
          <p className="mt-2 text-xs leading-5 text-sac-muted">{copy.contactsSearchHint}</p>
          {results && (results.length === 0 ? <p className="mt-3 text-sm text-sac-muted">{copy.contactsSearchEmpty}</p> : (
            <ul className="mt-3 divide-y divide-[#F0EAE5]">
              {results.map((item) => (
                <li key={item.accountId} className="flex items-center gap-3 py-3">
                  <ProfileAvatar photoUrl={item.photoUrl} name={item.firstName} />
                  <div className="min-w-0 flex-1"><p className="truncate font-bold">{item.firstName} {item.lastName}</p><p className="text-xs text-sac-muted">{item.relation === "connected" ? copy.contactsRelationActive : item.relation === "none" ? copy.contactsAvailable : item.relation === "invitation_received" ? copy.contactsReceived : copy.contactsSent}</p></div>
                  {item.relation === "none"
                    ? <button type="button" disabled={inviting !== null} onClick={() => void invite(item.accountId)} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[14px] bg-sac-primary px-3 text-xs font-extrabold text-white disabled:opacity-50"><UserPlus size={15} />{inviting === item.accountId ? copy.contactsInviting : copy.contactsInvite}</button>
                    : <span className="text-xs font-bold text-sac-confirm">{item.relation === "connected" ? copy.contactsRelationActive : item.relation === "invitation_received" ? copy.contactsReceived : copy.contactsSent}</span>}
                </li>
              ))}
            </ul>
          ))}
        </Card>

        <Card className="!bg-sac-sand">
          <h2 className="font-extrabold">{copy.contactsPendingTitle}</h2>
          {socialLoading ? <p className="mt-2 text-sm text-sac-muted">{copy.loading}</p> : pending.length === 0 ? <p className="mt-2 text-sm text-sac-muted">{copy.contactsPendingEmpty}</p> : (
            <ul className="mt-3 space-y-2">
              {pending.map((item) => (
                <li key={item.id} className="rounded-xl border border-white/80 bg-white/80 p-3">
                  <div className="flex items-center gap-3">
                    <ProfileAvatar photoUrl={item.photoUrl} name={item.firstName} size="sm" />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.firstName} {item.lastName}</p><p className="text-xs text-sac-muted">{item.direction === "received" ? copy.contactsReceived : copy.contactsSent} · {formatDate(item.expiresAt, language, locale)}</p></div>
                    {item.direction === "received" ? (
                      <div className="flex shrink-0 gap-1">
                        <button type="button" disabled={responding !== null} onClick={() => void respond(item.id, "accept")} aria-label={copy.contactsAccept} className="grid size-10 place-items-center rounded-xl bg-sac-confirm/10 text-sac-confirm disabled:opacity-50"><Check size={17} /></button>
                        <button type="button" disabled={responding !== null} onClick={() => void respond(item.id, "decline")} aria-label={copy.contactsDecline} className="grid size-10 place-items-center rounded-xl bg-sac-alert/5 text-sac-alert disabled:opacity-50"><X size={17} /></button>
                      </div>
                    ) : (
                      <button type="button" disabled={responding !== null} onClick={() => void respond(item.id, "cancel")} aria-label={copy.contactsCancel} className="grid size-10 shrink-0 place-items-center rounded-xl bg-sac-alert/5 text-sac-alert disabled:opacity-50"><X size={17} /></button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 font-extrabold"><UsersRound size={18} />{copy.contactsTitle}</h2>
          {socialLoading ? <p className="mt-2 text-sm text-sac-muted">{copy.loading}</p> : closeContacts.length === 0 ? (
            <div className="mt-2 rounded-[16px] border border-dashed border-sac-primary/30 bg-white px-4 py-6 text-center"><UsersRound className="mx-auto text-sac-muted" size={26} /><p className="mt-2 font-extrabold">{copy.contactsEmpty}</p><p className="mt-1 text-sm text-sac-muted">{copy.contactsEmptyHint}</p></div>
          ) : (
            <ul className="mt-2 divide-y divide-[#F0EAE5]">
              {closeContacts.map((item) => (
                <li key={item.accountId}>
                  <button type="button" onClick={() => go({ name: "contact", id: item.accountId })} className="flex min-h-16 w-full items-center gap-3 py-3 text-start">
                    <ProfileAvatar photoUrl={item.photoUrl} name={item.firstName} />
                    <span className="min-w-0 flex-1"><span className="block truncate font-bold">{item.firstName} {item.lastName}</span><span className="block truncate text-xs text-sac-muted">{item.contactDetails?.email ?? item.contactDetails?.phone ?? copy.contactsDetailsHidden}</span></span>
                    <ChevronRight size={18} className="shrink-0 text-sac-muted rtl:rotate-180" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 flex items-center gap-1.5 text-xs text-sac-muted"><ShieldCheck size={14} />{copy.contactPermissionsIntro}</p>
        </Card>

        <button type="button" onClick={() => go({ name: "alertContacts" })} className={ghostBtn + " w-full"}>
          <ShieldCheck size={16} />{copy.contactsAlertContacts}
        </button>
        <button type="button" onClick={() => void refreshSocial()} disabled={socialLoading} className="min-h-12 text-sm font-bold text-sac-ember underline disabled:opacity-50">{copy.refresh}</button>
        <button type="button" onClick={() => go({ name: "home" })} className={primaryBtn}>{copy.back}</button>
      </Sheet>
    </>
  );
}
