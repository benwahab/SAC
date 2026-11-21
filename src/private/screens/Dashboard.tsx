import { BellRing, ChevronRight, KeyRound, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { fillCopy, localeFor } from "../../i18n/translations";
import type { CloseContact, Contact, OwnProfile, ScreenProps, SosAlert } from "../types";
import { formatDate } from "../types";
import { Card, Halo, LevelBadge, Notice, ProfileAvatar, Sheet, StatusBadge, ghostBtn } from "../ui";

export default function Dashboard({ copy, language, go, contacts, closeContacts, ownProfile, alerts, loading, error, securityKeyConfigured }: ScreenProps & {
  contacts: Contact[]; closeContacts: CloseContact[]; ownProfile: OwnProfile | null;
  alerts: SosAlert[]; loading: boolean; error: string; securityKeyConfigured: boolean;
}) {
  const locale = localeFor(language);
  const active = alerts.filter((a) => a.status === "active");
  const received = active.find((a) => a.participantRole === "recipient");
  const own = active.find((a) => a.participantRole === "author");
  const focus = received ?? own;
  const level = (l: string) => copy[("level_" + l) as keyof typeof copy] ?? l;
  const cat = (c: string) => copy[("cat_" + c) as keyof typeof copy] ?? c.replaceAll("_", " ");
  return (
    <>
      <Halo title={copy.dashTitle} eyebrow="SAC" ><p className="mt-1 max-w-xs text-sm font-medium text-white/90">{copy.dashSubtitle}</p></Halo>
      <Sheet>
        {error && <Notice kind="error">{error}</Notice>}
        <button type="button" onClick={() => go({ name: "account" })} className="flex min-h-16 items-center gap-3 rounded-[20px] border border-[#F0EAE5] bg-white p-3 text-start shadow-card">
          <ProfileAvatar photoUrl={ownProfile?.photoUrl} name={ownProfile ? `${ownProfile.firstName} ${ownProfile.lastName}` : "?"} />
          <span className="min-w-0 flex-1"><span className="block truncate font-extrabold">{ownProfile ? `${ownProfile.firstName} ${ownProfile.lastName}` : copy.accountTitle}</span><span className="block text-xs text-sac-muted">{copy.dashAccount}</span></span>
          <ChevronRight size={18} className="shrink-0 text-sac-muted rtl:rotate-180" />
        </button>
        {loading ? <p className="py-6 text-center text-sm text-sac-muted">{copy.loading}</p> : focus ? (
          <Card className={received ? "border-2 !border-sac-alert" : "border-2 !border-sac-primary"}>
            <div className="flex items-center justify-between gap-2"><LevelBadge level={focus.level} label={String(level(focus.level))} /><span className="text-xs font-bold text-sac-muted tnum">{formatDate(focus.createdAt, language, locale)}</span></div>
            <p className="mt-3 text-lg font-extrabold">{received ? copy.dashReceivedActive : copy.dashOwnActive}</p>
            <p className="text-sm text-sac-muted">{String(cat(focus.category))}</p>
            <button type="button" onClick={() => go({ name: "alert", id: focus.id })} className={"mt-4 " + ghostBtn + " w-full"}>{copy.dashOpen}<ChevronRight size={16} className="rtl:rotate-180" /></button>
          </Card>
        ) : (
          <Card className="flex items-center gap-3 !border-sac-confirm/30">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sac-confirm/10 text-sac-confirm"><ShieldCheck size={26} /></span>
            <div><p className="font-extrabold">{copy.dashCalmTitle}</p><p className="text-sm text-sac-muted">{copy.dashCalmText}</p></div>
          </Card>
        )}
        {securityKeyConfigured === false && (
          <Card className="!border-sac-alert/30 !bg-sac-alert/5">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sac-alert/10 text-sac-alert"><KeyRound size={22} /></span>
              <div className="min-w-0">
                <p className="font-extrabold">{copy.securityKeyDashTitle}</p>
                <p className="mt-1 text-sm leading-6 text-sac-muted">{copy.securityKeyDashText}</p>
                <button type="button" onClick={() => go({ name: "settings" })} className={"mt-3 " + ghostBtn}>{copy.securityKeyDashCta}</button>
              </div>
            </div>
          </Card>
        )}
        <Card className="!border-sac-primary/25 !bg-sac-primary/5">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sac-primary/10 text-sac-primary"><BellRing size={22} /></span>
            <div className="min-w-0">
              <p className="font-extrabold">{copy.dashRemindersTitle}</p>
              <p className="mt-1 text-sm leading-6 text-sac-muted">{copy.dashRemindersText}</p>
              <button type="button" onClick={() => go({ name: "reminders" })} className={"mt-3 " + ghostBtn}>{copy.dashRemindersCta}</button>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-extrabold"><UsersRound size={18} />{copy.dashCircle}</h2>
            <button type="button" onClick={() => go({ name: "contacts" })} className="min-h-12 px-2 text-sm font-bold text-sac-ember">{copy.dashSeeAll}</button></div>
          {closeContacts.length === 0 ? <p className="mt-1 text-sm text-sac-muted">{copy.dashCircleEmpty}</p> : <>
            <p className="mt-1 text-sm text-sac-muted tnum">{fillCopy(copy.dashCircleCount, { n: closeContacts.length })}</p>
            <div className="mt-3 flex -space-x-2 rtl:space-x-reverse">{closeContacts.slice(0, 5).map((c) => <ProfileAvatar key={c.accountId} photoUrl={c.photoUrl} name={c.firstName} />)}</div></>}
          <button type="button" onClick={() => go({ name: "contacts" })} className={"mt-4 " + ghostBtn + " w-full"}><UserPlus size={16} />{copy.dashInvite}</button>
          {contacts.length > 0 && <p className="mt-2 text-xs text-sac-muted">{copy.contactsAlertContacts} · {contacts.length}</p>}
        </Card>
        <Card>
          <h2 className="font-extrabold">{copy.dashRecent}</h2>
          {alerts.length === 0 ? <p className="mt-2 text-sm text-sac-muted">{copy.dashNoRecent}</p> : <ul className="mt-2 divide-y divide-[#F0EAE5]">{alerts.slice(0, 3).map((a) => (
            <li key={a.id}><button type="button" onClick={() => go({ name: "alert", id: a.id })} className="flex min-h-14 w-full items-center justify-between gap-3 text-start">
              <span className="min-w-0"><span className="block truncate text-sm font-bold">{String(cat(a.category))}</span><span className="block text-xs text-sac-muted tnum">{formatDate(a.createdAt, language, locale)}</span></span>
              <StatusBadge active={a.status === "active"} label={a.status === "active" ? copy.alertStatusActive : copy.alertStatusClosed} /></button></li>))}</ul>}
        </Card>
        <p className="px-1 text-xs leading-5 text-sac-muted">{copy.emergencyNote}</p>
      </Sheet>
    </>
  );
}
