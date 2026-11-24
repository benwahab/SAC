import { useMemo, type ReactNode } from "react";
import {
  BellRing, BookOpen, Building2, CalendarClock, ChevronRight, CircleHelp,
  Crown, HeartPulse, History, Info, KeyRound, LayoutDashboard,
  Settings, ShieldCheck, Siren, Sparkles, UserPlus, UsersRound,
} from "lucide-react";
import BrandLogo from "../../components/BrandLogo";
import { fillCopy, localeFor } from "../../i18n/translations";
import type { AdminAccess, CloseContact, OwnProfile, ProximityInvitation, ScreenProps, SosAlert } from "../types";
import { formatDate } from "../types";
import { Card, Notice, ProfileAvatar, Sheet } from "../ui";

type HomeProps = ScreenProps & {
  closeContacts: CloseContact[];
  invitations: ProximityInvitation[];
  ownProfile: OwnProfile | null;
  alerts: SosAlert[];
  loading: boolean;
  error: string;
  securityKeyConfigured: boolean;
  adminAccess: AdminAccess | null;
};

function SectionTitle({ title, intro }: { title: string; intro?: string }) {
  return (
    <div>
      <h2 className="text-lg font-black tracking-tight text-sac-ink">{title}</h2>
      {intro && <p className="mt-1 text-sm leading-6 text-sac-muted">{intro}</p>}
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[82px] flex-col items-start justify-between rounded-[20px] border border-white/90 bg-white p-4 text-start shadow-card">
      <span className="flex size-10 items-center justify-center rounded-2xl bg-sac-primary/10 text-sac-primary-strong">{icon}</span>
      <span className="mt-3 text-sm font-extrabold text-sac-ink">{label}</span>
    </button>
  );
}

export default function Dashboard({ copy, language, go, closeContacts, invitations, ownProfile, alerts, loading, error, securityKeyConfigured, adminAccess }: HomeProps) {
  const locale = localeFor(language);
  const firstName = ownProfile?.firstName?.trim();
  const greeting = firstName ? fillCopy(copy.homeGreeting, { name: firstName }) : copy.homeGreetingFallback;
  const active = alerts.filter((alert) => alert.status === "active");
  const received = active.find((alert) => alert.participantRole === "recipient");
  const own = active.find((alert) => alert.participantRole === "author");
  const focus = received ?? own;
  const pendingInvitations = invitations.filter((invitation) => invitation.direction === "received" && invitation.status === "pending").length;
  const hasContext = Boolean(focus || pendingInvitations || securityKeyConfigured === false || adminAccess?.canAccess);
  const category = (value: string) => copy[("cat_" + value) as keyof typeof copy] ?? value.replaceAll("_", " ");
  const recentAlerts = useMemo(() => [...alerts].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3), [alerts]);

  return (
    <>
      <header className="sac-home-hero relative overflow-hidden px-5 pb-12 pt-5 text-white">
        <svg className="pointer-events-none absolute -end-20 -top-20 rtl:-scale-x-100" width="360" height="360" viewBox="0 0 360 360" aria-hidden="true">
          <g fill="none" stroke="#fff" strokeWidth="2" opacity=".18"><circle cx="180" cy="180" r="72" /><circle cx="180" cy="180" r="125" /><circle cx="180" cy="180" r="178" /></g>
        </svg>
        <div className="relative flex items-start justify-between gap-3">
          <span className="grid h-12 w-24 place-items-center rounded-2xl border border-white/80 bg-white/95 px-2 shadow-glass"><BrandLogo className="h-7 w-auto" /></span>
          <div className="flex items-center gap-2">
            {adminAccess?.canAccess && (
              <a href="/administration" aria-label={copy.adminSpaceTitle} title={copy.adminSpaceTitle} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 text-xs font-extrabold text-white hover:bg-white/25 lg:hidden">
                <LayoutDashboard size={16} /><span className="hidden md:inline">{copy.adminSpaceTitle}</span>
              </a>
            )}
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-white/90">{copy.homeBadgePrivate}</span>
          </div>
        </div>

        <div className="relative mt-6 flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white/85">{greeting}</p>
            <p className="mt-1 text-[11px] font-black uppercase tracking-[.18em] text-white/60">{copy.homeEyebrow}</p>
          </div>
        </div>

        <h1 className="relative mt-4 max-w-md text-[2rem] font-black leading-[1.08] tracking-tight">{copy.homeDashboardTitle}</h1>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <span className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold " + (focus ? "border-white/30 bg-sac-alert text-white" : "border-white/25 bg-white/10 text-white/90")}>
            <span className={"size-2 rounded-full " + (focus ? "bg-white" : "bg-sac-confirm")} />{focus ? copy.homeStatusActive : copy.homeStatusCalm}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/90"><UsersRound size={14} />{fillCopy(copy.dashCircleCount, { n: closeContacts.length })}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/90"><ShieldCheck size={14} />{copy.homeBadgeSosFree}</span>
        </div>

      </header>

      <Sheet className="lg:grid lg:grid-cols-2 lg:items-start lg:px-6">
        {error && <div className="lg:col-span-2"><Notice kind="error">{error}</Notice></div>}

        {hasContext && (
          <Card className="!border-sac-primary/20 !bg-white/90 lg:col-span-2">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[.12em] text-sac-primary-strong"><Info size={16} />{copy.homeContextTitle}</h2>
            <div className="mt-3 flex flex-col gap-2">
              {focus && (
                <button type="button" onClick={() => go({ name: "alert", id: focus.id })} className="flex min-h-16 items-center gap-3 rounded-2xl border border-sac-alert/25 bg-sac-alert/5 p-3 text-start">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sac-alert/10 text-sac-alert"><Siren size={21} /></span>
                  <span className="min-w-0 flex-1"><span className="block font-extrabold text-sac-alert">{received ? copy.dashReceivedActive : copy.dashOwnActive}</span><span className="block truncate text-xs text-sac-muted">{String(category(focus.category))} · {formatDate(focus.createdAt, language, locale)}</span></span>
                  <ChevronRight size={18} className="shrink-0 text-sac-alert rtl:rotate-180" />
                </button>
              )}
              {pendingInvitations > 0 && (
                <button type="button" onClick={() => go({ name: "contacts" })} className="flex min-h-14 items-center gap-3 rounded-2xl border border-sac-primary/20 bg-sac-primary/5 p-3 text-start">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sac-primary/10 text-sac-primary-strong"><UserPlus size={20} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{fillCopy(copy.homeContextInvitation, { n: pendingInvitations })}</span><span className="block text-xs text-sac-muted">{copy.homeContextInvitationCta}</span></span>
                  <ChevronRight size={18} className="shrink-0 text-sac-primary-strong rtl:rotate-180" />
                </button>
              )}
              {securityKeyConfigured === false && (
                <button type="button" onClick={() => go({ name: "settings" })} className="flex min-h-16 items-center gap-3 rounded-2xl border border-sac-primary/20 bg-sac-canvas p-3 text-start">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sac-primary/10 text-sac-primary-strong"><KeyRound size={20} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{copy.homeContextSecurityTitle}</span><span className="block text-xs leading-5 text-sac-muted">{copy.homeContextSecurityText}</span></span>
                  <ChevronRight size={18} className="shrink-0 text-sac-primary-strong rtl:rotate-180" />
                </button>
              )}
              {adminAccess?.canAccess && (
                <a href="/administration" className="flex min-h-16 items-center gap-3 rounded-2xl border border-sac-primary/25 bg-sac-primary/5 p-3 text-start">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sac-primary/10 text-sac-primary-strong"><LayoutDashboard size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold">{copy.adminSpaceTitle}</span>
                    <span className="block text-xs leading-5 text-sac-muted">{adminAccess.role === "super_admin" ? copy.adminSpaceSuperText : copy.adminSpaceDelegateText}</span>
                    {adminAccess.role === "delegate" && <span className="mt-1 block text-[11px] font-bold text-sac-primary-strong">{fillCopy(copy.adminSpaceMissionCount, { n: adminAccess.activeMissions })}</span>}
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-sac-primary-strong rtl:rotate-180" />
                </a>
              )}
            </div>
          </Card>
        )}

        <section className="flex flex-col gap-3">
          <SectionTitle title={copy.dashCircle} />
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-3xl font-black leading-none text-sac-ink">{closeContacts.length}</p>
                <p className="mt-2 text-sm leading-6 text-sac-muted">{closeContacts.length === 0 ? copy.dashCircleEmpty : copy.homeCircleVerifiedLabel}</p>
              </div>
              <button type="button" onClick={() => go({ name: "contacts" })} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[14px] border border-sac-primary/30 bg-white px-3 text-sm font-extrabold text-sac-ember">
                <UserPlus size={17} />{copy.homeQuickInvite}
              </button>
            </div>
            {closeContacts.length > 0 && (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {closeContacts.slice(0, 6).map((contact) => (
                    <span key={contact.accountId} className="inline-flex items-center gap-2 rounded-full border border-sac-primary/15 bg-sac-canvas py-1 pe-3 ps-1 text-xs font-bold text-sac-ink">
                      <ProfileAvatar photoUrl={contact.photoUrl} name={contact.firstName || contact.lastName || "?"} size="sm" />
                      <span className="max-w-[9rem] truncate">{contact.firstName || contact.lastName || "?"}</span>
                    </span>
                  ))}
                </div>
                <button type="button" onClick={() => go({ name: "contacts" })} className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-extrabold text-sac-ember">{copy.dashSeeAll}<ChevronRight size={16} className="rtl:rotate-180" /></button>
              </>
            )}
          </Card>
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle title={copy.homeQuickActionsTitle} />
          <div className="grid grid-cols-2 gap-3">
            <QuickAction icon={<CalendarClock size={21} />} label={copy.homeQuickReminders} onClick={() => go({ name: "reminders" })} />
            <QuickAction icon={<BellRing size={21} />} label={copy.contactsAlertContacts} onClick={() => go({ name: "alertContacts" })} />
            <QuickAction icon={<History size={21} />} label={copy.navHistory} onClick={() => go({ name: "history" })} />
            <QuickAction icon={<Settings size={21} />} label={copy.navSettings} onClick={() => go({ name: "settings" })} />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle title={copy.dashRecent} />
          <Card>
            {recentAlerts.length === 0 ? (
              <p className="text-sm leading-6 text-sac-muted">{copy.dashNoRecent}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentAlerts.map((alert) => (
                  <button key={alert.id} type="button" onClick={() => go({ name: "alert", id: alert.id })} className="flex min-h-14 items-center gap-3 rounded-2xl border border-sac-primary/15 bg-sac-canvas p-3 text-start">
                    <span className={"flex size-9 shrink-0 items-center justify-center rounded-full " + (alert.status === "active" ? "bg-sac-alert/10 text-sac-alert" : "bg-sac-primary/10 text-sac-primary-strong")}><Siren size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold text-sac-ink">{alert.status === "active" ? (alert.participantRole === "recipient" ? copy.dashReceivedActive : copy.dashOwnActive) : copy.alertStatusClosed}</span>
                      <span className="block truncate text-xs text-sac-muted">{String(category(alert.category))} · {formatDate(alert.createdAt, language, locale)}</span>
                    </span>
                    <ChevronRight size={17} className="shrink-0 text-sac-muted rtl:rotate-180" />
                  </button>
                ))}
              </div>
            )}
            {alerts.length > 0 && <button type="button" onClick={() => go({ name: "history" })} className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-extrabold text-sac-ember">{copy.dashSeeAll}<ChevronRight size={16} className="rtl:rotate-180" /></button>}
          </Card>
        </section>

        <details className="group rounded-[22px] border border-sac-alert/25 bg-white p-4 shadow-card">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-extrabold text-sac-ink">
            <span className="flex items-center gap-2"><Siren size={18} className="text-sac-alert" />{copy.homeSosDetailsTitle}</span>
            <ChevronRight size={17} className="shrink-0 text-sac-muted transition-transform group-open:rotate-90 rtl:rotate-180" />
          </summary>
          <p className="mt-2 text-sm leading-6 text-sac-muted">{copy.homeSosShortText}</p>
          <ol className="mt-3 flex flex-col gap-2">
            {[
              [copy.homeSosStep1Title, copy.homeSosStep1Text],
              [copy.homeSosStep2Title, copy.homeSosStep2Text],
              [copy.homeSosStep3Title, copy.homeSosStep3Text],
              [copy.homeSosStep4Title, copy.homeSosStep4Text],
            ].map(([title, text], index) => (
              <li key={title} className="flex gap-2 text-sm leading-6"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sac-alert text-[11px] font-black text-white">{index + 1}</span><span><span className="block font-extrabold text-sac-ink">{title}</span><span className="mt-0.5 block text-xs leading-5 text-sac-muted">{text}</span></span></li>
            ))}
          </ol>
          <p className="mt-3 rounded-2xl bg-sac-alert/5 p-3 text-xs leading-5 text-sac-ink">{copy.homeSosNote}</p>
        </details>

        <details className="group rounded-[22px] border border-sac-primary/20 bg-white p-4 shadow-card">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-extrabold text-sac-ink">
            <span className="flex items-center gap-2"><Sparkles size={18} className="text-sac-primary-strong" />{copy.homeLearnTitle}</span>
            <ChevronRight size={17} className="shrink-0 text-sac-muted transition-transform group-open:rotate-90 rtl:rotate-180" />
          </summary>
          <p className="mt-2 text-sm leading-6 text-sac-muted">{copy.homeLearnIntro}</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              [copy.homeFeatureContactsTitle, copy.homeFeatureContactsText, <UsersRound size={18} />],
              [copy.homeFeatureRemindersTitle, copy.homeFeatureRemindersText, <CalendarClock size={18} />],
              [copy.homeFeatureHealthTitle, copy.homeFeatureHealthText, <HeartPulse size={18} />],
              [copy.homeFeatureHistoryTitle, copy.homeFeatureHistoryText, <History size={18} />],
            ].map(([title, text, icon]) => (
              <div key={String(title)} className="rounded-2xl border border-sac-primary/10 bg-sac-canvas p-3">
                <p className="flex items-center gap-2 text-sm font-extrabold text-sac-ink"><span className="text-sac-primary-strong">{icon}</span>{title}</p>
                <p className="mt-1 text-xs leading-5 text-sac-muted">{text}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-sac-primary/15 bg-[#F4FBF7] p-3">
            <p className="text-sm font-extrabold text-sac-ink">{copy.homeOffersTitle}</p>
            <div className="mt-2 flex flex-col gap-1.5 text-xs text-sac-muted">
              <p className="flex items-center justify-between gap-3"><span className="font-bold text-sac-ink">{copy.homeOfferFreeTitle}</span><span>{copy.homeOfferFreePrice}</span></p>
              <p className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 font-bold text-sac-ink"><Crown size={14} />{copy.homeOfferPremiumTitle}</span><span>{copy.homeOfferPremiumPrice}</span></p>
              <p className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 font-bold text-sac-ink"><Building2 size={14} />{copy.homeOfferProTitle}</span><span>{copy.homeOfferProPrice}</span></p>
            </div>
            <p className="mt-2 text-xs font-bold leading-5 text-sac-alert">{copy.homeOfferSosFree}</p>
            <p className="mt-1 text-[11px] leading-5 text-sac-muted">{copy.homeOfferPremiumNote}</p>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {[
              [copy.homeFaq1Q, copy.homeFaq1A], [copy.homeFaq2Q, copy.homeFaq2A], [copy.homeFaq3Q, copy.homeFaq3A],
              [copy.homeFaq4Q, copy.homeFaq4A], [copy.homeFaq5Q, copy.homeFaq5A],
            ].map(([question, answer]) => (
              <details key={question} className="rounded-2xl border border-sac-primary/15 bg-sac-canvas p-3">
                <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 text-sm font-extrabold text-sac-ink"><span className="flex items-start gap-2"><CircleHelp size={16} className="mt-0.5 shrink-0 text-sac-primary-strong" />{question}</span><ChevronRight size={15} className="shrink-0 text-sac-muted rtl:rotate-180" /></summary>
                <p className="mt-2 text-xs leading-5 text-sac-muted">{answer}</p>
              </details>
            ))}
          </div>

          <div className="mt-3 rounded-2xl border border-sac-primary/15 bg-sac-canvas p-3">
            <p className="flex items-start gap-2 text-xs leading-5 text-sac-muted"><BookOpen size={16} className="mt-0.5 shrink-0 text-sac-primary-strong" />{copy.homeHelpStatus}</p>
            <button type="button" onClick={() => go({ name: "settings" })} className="mt-2 inline-flex min-h-10 items-center gap-1 text-sm font-extrabold text-sac-ember">{copy.homeHelpSettingsCta}<ChevronRight size={16} className="rtl:rotate-180" /></button>
          </div>
        </details>

        <div className="flex items-start gap-3 rounded-2xl border border-sac-primary/15 bg-white/80 p-4 lg:col-span-2">
          <div className="min-w-0"><p className="text-sm font-extrabold">{firstName || copy.homeGreetingFallback}</p><p className="mt-1 text-xs leading-5 text-sac-muted">{copy.homeFooterEmergency}</p></div>
          {loading && <span className="ms-auto text-xs text-sac-muted">{copy.loading}</span>}
        </div>
      </Sheet>
    </>
  );
}
