import { CheckCircle2, Search, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { RelationState } from "../../domain/account-profile";
import type { ScreenProps } from "../types";
import { socialErrorMessage } from "../errors";
import { Card, Halo, Notice, ProfileAvatar, Sheet, fieldClass, ghostBtn, primaryBtn } from "../ui";

type SearchResult = { accountId: string; firstName: string; lastName: string; photoUrl: string | null; relation: RelationState };

export default function Invite({ copy, go, notice, setNotice, refreshSocial }: ScreenProps & { refreshSocial: () => Promise<void> }) {
  const [mode, setMode] = useState<"name" | "email">("name");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [sent, setSent] = useState(false);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value || searching) return;
    setSearching(true); setProblem(""); setResults(null); setSelected(null);
    try {
      const response = await fetch(`/api/directory/search?mode=${mode}&q=${encodeURIComponent(value)}`, { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json() as { results?: SearchResult[]; error?: string };
      if (!response.ok || !Array.isArray(payload.results)) throw new Error(socialErrorMessage(copy, payload.error));
      setResults(payload.results);
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : copy.errorGeneric);
    } finally { setSearching(false); }
  }

  async function send() {
    if (busy || !selected) return;
    setBusy(true); setProblem(""); setNotice("");
    try {
      const response = await fetch("/api/proximity/invitations", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientAccountId: selected.accountId }),
      });
      const payload = await response.json() as { invitationSent?: boolean; error?: string };
      if (!response.ok || payload.invitationSent !== true) throw new Error(socialErrorMessage(copy, payload.error));
      setSent(true);
      await refreshSocial();
    } catch (reason) {
      setProblem(reason instanceof Error ? reason.message : copy.contactsErrInvite);
    } finally { setBusy(false); }
  }

  return (
    <>
      <Halo title={copy.inviteTitle} eyebrow={copy.privateSpace} onBack={() => go({ name: "contacts" })} backLabel={copy.back}><p className="mt-1 text-sm text-white/90">{copy.inviteIntro}</p></Halo>
      <Sheet>
        {notice && <Notice kind="ok">{notice}</Notice>}
        {problem && <Notice kind="error">{problem}</Notice>}
        {sent ? (
          <Card className="!border-sac-confirm/40 text-center"><CheckCircle2 className="mx-auto text-sac-confirm" size={40} /><p role="status" className="mt-3 font-extrabold leading-6">{copy.inviteSent}</p>
            <div className="mt-4 flex flex-col gap-2"><button type="button" onClick={() => { setSent(false); setSelected(null); setResults(null); setQuery(""); }} className={ghostBtn}>{copy.inviteAnother}</button><button type="button" onClick={() => go({ name: "contacts" })} className={primaryBtn}>{copy.inviteBack}</button></div></Card>
        ) : (
          <>
            <Card>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label={copy.inviteTitle}>
                <button type="button" aria-pressed={mode === "name"} onClick={() => { setMode("name"); setResults(null); setSelected(null); }} className={"min-h-11 rounded-[14px] border text-sm font-extrabold " + (mode === "name" ? "border-sac-primary bg-sac-primary text-white" : "border-[#E8DCD3] bg-white")}>{copy.contactsSearchName}</button>
                <button type="button" aria-pressed={mode === "email"} onClick={() => { setMode("email"); setResults(null); setSelected(null); }} className={"min-h-11 rounded-[14px] border text-sm font-extrabold " + (mode === "email" ? "border-sac-primary bg-sac-primary text-white" : "border-[#E8DCD3] bg-white")}>{copy.contactsSearchEmail}</button>
              </div>
              <form onSubmit={search} className="mt-3 flex gap-2">
                <input aria-label={copy.contactsSearchPlaceholder} type={mode === "email" ? "email" : "search"} value={query} onChange={(event) => setQuery(event.target.value)} maxLength={mode === "email" ? 254 : 80} placeholder={copy.contactsSearchPlaceholder} dir={mode === "email" ? "ltr" : undefined} className={fieldClass} />
                <button type="submit" disabled={searching || !query.trim()} className="min-h-12 shrink-0 rounded-[14px] bg-sac-primary px-4 text-sm font-extrabold text-white disabled:opacity-50"><Search size={17} /></button>
              </form>
              <p className="mt-2 text-xs leading-5 text-sac-muted">{copy.contactsSearchHint}</p>
            </Card>
            {results && (results.length === 0 ? <Card><p className="text-sm text-sac-muted">{copy.inviteSearchEmpty}</p></Card> : (
              <Card>
                <ul className="divide-y divide-[#F0EAE5]">
                  {results.map((item) => (
                    <li key={item.accountId}>
                      <button type="button" disabled={item.relation !== "none"} onClick={() => setSelected(item)} aria-pressed={selected?.accountId === item.accountId}
                        className={"flex min-h-16 w-full items-center gap-3 py-3 text-start disabled:opacity-60 " + (selected?.accountId === item.accountId ? "text-sac-primary" : "")}>
                        <ProfileAvatar photoUrl={item.photoUrl} name={item.firstName} />
                        <span className="min-w-0 flex-1"><span className="block truncate font-bold">{item.firstName} {item.lastName}</span><span className="block text-xs text-sac-muted">{item.relation === "connected" ? copy.contactsRelationActive : item.relation === "none" ? (selected?.accountId === item.accountId ? copy.inviteSelected : copy.contactsInvite) : copy.contactsPendingTitle}</span></span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
            <button type="button" disabled={busy || !selected} onClick={() => void send()} className={primaryBtn}><UserPlus size={20} />{busy ? copy.contactsInviting : copy.inviteSend}</button>
          </>
        )}
      </Sheet>
    </>
  );
}
