import {
  ArrowDown, BellRing, BookOpen, Building2, CalendarClock, Check, ChevronRight,
  CircleHelp, Clock3, CreditCard, Crown, HeartPulse, History, Info, KeyRound,
  LayoutDashboard, LockKeyhole, RefreshCw, ShieldCheck, Siren, Sparkles, UserPlus, UsersRound, Wallet,
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

function SectionTitle({ eyebrow, title, intro, id }: { eyebrow?: string; title: string; intro?: string; id?: string }) {
  return (
    <div id={id} className="scroll-mt-4">
      {eyebrow && <p className="text-xs font-black uppercase tracking-[.2em] text-sac-primary-strong">{eyebrow}</p>}
      <h2 className="mt-1 text-2xl font-black tracking-tight text-sac-ink">{title}</h2>
      {intro && <p className="mt-2 text-sm leading-6 text-sac-muted">{intro}</p>}
    </div>
  );
}

function StatusPill({ tone, children }: { tone: "available" | "partial" | "soon"; children: React.ReactNode }) {
  const style = tone === "available"
    ? "border-sac-confirm/30 bg-sac-confirm/10 text-sac-confirm"
    : tone === "partial"
      ? "border-amber-500/30 bg-amber-50 text-amber-800"
      : "border-sac-primary-strong/20 bg-sac-sand text-sac-muted";
  return <span className={"inline-flex rounded-full border px-2.5 py-1 text-[11px] font-extrabold " + style}>{children}</span>;
}

function FeatureCard({ icon, title, text, example, status, future, onOpen, openLabel }: {
  icon: React.ReactNode; title: string; text: string; example: string;
  status: React.ReactNode; future?: string; onOpen?: () => void; openLabel: string;
}) {
  return (
    <article className="flex h-full flex-col rounded-[22px] border border-white/90 bg-white/85 p-4 shadow-card backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sac-primary/10 text-sac-primary-strong">{icon}</span>
        {status}
      </div>
      <h3 className="mt-3 text-lg font-black text-sac-ink">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-sac-muted">{text}</p>
      <p className="mt-3 rounded-xl bg-sac-canvas px-3 py-2 text-xs leading-5 text-sac-muted">{example}</p>
      {future && <p className="mt-2 text-[11px] font-bold leading-5 text-sac-primary-strong/80">{future}</p>}
      {onOpen && <button type="button" onClick={onOpen} className="mt-auto inline-flex min-h-11 items-center gap-1 pt-3 text-sm font-extrabold text-sac-ember">{openLabel}<ChevronRight size={16} className="rtl:rotate-180" /></button>}
    </article>
  );
}

function CheckLine({ children, tone = "confirm" }: { children: React.ReactNode; tone?: "confirm" | "alert" }) {
  return <li className="flex items-start gap-2 text-sm leading-6 text-sac-ink"><Check size={17} className={"mt-0.5 shrink-0 " + (tone === "alert" ? "text-sac-alert" : "text-sac-confirm")} aria-hidden="true" /><span>{children}</span></li>;
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

  return (
    <>
      <header className="sac-home-hero relative overflow-hidden px-5 pb-20 pt-6 text-white">
        <svg className="pointer-events-none absolute -end-20 -top-20 rtl:-scale-x-100" width="360" height="360" viewBox="0 0 360 360" aria-hidden="true">
          <g fill="none" stroke="#fff" strokeWidth="2" opacity=".18"><circle cx="180" cy="180" r="72" /><circle cx="180" cy="180" r="125" /><circle cx="180" cy="180" r="178" /></g>
        </svg>
        <div className="relative flex items-start justify-between gap-3">
          <span className="grid h-12 w-24 place-items-center rounded-2xl border border-white/80 bg-white/95 px-2 shadow-glass"><BrandLogo className="h-7 w-auto" /></span>
          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-white/90">{copy.homeBadgePrivate}</span>
        </div>
        <p className="relative mt-8 text-sm font-bold text-white/85">{greeting}</p>
        <p className="relative mt-1 text-[11px] font-black uppercase tracking-[.22em] text-white/60">{copy.homeEyebrow}</p>
        <h1 className="relative mt-3 max-w-md text-[2.15rem] font-black leading-[1.06] tracking-tight">{copy.homeMissionTitle}</h1>
        <p className="relative mt-4 max-w-md text-sm leading-6 text-white/85">{copy.homeMissionText}</p>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold"><ShieldCheck size={14} />{copy.homeBadgeSosFree}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold"><LockKeyhole size={14} />{copy.homeBadgeVerified}</span>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <a href="#home-sos" className="inline-flex min-h-12 items-center gap-2 rounded-[16px] bg-white px-4 text-sm font-black text-sac-primary-strong shadow-glass">{copy.homeDiscoverSos}<ArrowDown size={17} /></a>
          <a href="#home-services" className="inline-flex min-h-12 items-center gap-2 rounded-[16px] border border-white/30 bg-white/10 px-4 text-sm font-black text-white">{copy.homeDiscoverServices}<ChevronRight size={17} className="rtl:rotate-180" /></a>
        </div>
        <p className={"relative mt-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-extrabold " + (focus ? "border-white/30 bg-sac-alert text-white" : "border-white/25 bg-white/10 text-white/90")}>
          <span className={"size-2 rounded-full " + (focus ? "bg-white" : "bg-sac-confirm")} />{focus ? copy.homeStatusActive : copy.homeStatusCalm}
        </p>
      </header>

      <Sheet>
        {error && <Notice kind="error">{error}</Notice>}

        {hasContext && (
          <Card className="!border-sac-primary/20 !bg-white/90">
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

        <section id="home-sos" aria-labelledby="home-sos-title" className="scroll-mt-4 rounded-[26px] border border-sac-alert/25 bg-white p-5 shadow-card">
          <div className="flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sac-alert/10 text-sac-alert"><Siren size={26} /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-sac-alert">{copy.homeSosEyebrow}</p>
              <h2 id="home-sos-title" className="mt-1 text-xl font-black leading-tight text-sac-ink">{copy.homeSosTitle}</h2>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-sac-muted">{copy.homeSosText}</p>
          <ol className="mt-4 flex flex-col gap-3">
            {[
              [copy.homeSosStep1Title, copy.homeSosStep1Text],
              [copy.homeSosStep2Title, copy.homeSosStep2Text],
              [copy.homeSosStep3Title, copy.homeSosStep3Text],
              [copy.homeSosStep4Title, copy.homeSosStep4Text],
            ].map(([title, text], index) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sac-alert text-xs font-black text-white">{index + 1}</span>
                <span><span className="block text-sm font-extrabold text-sac-ink">{title}</span><span className="mt-0.5 block text-xs leading-5 text-sac-muted">{text}</span></span>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-2xl border border-sac-alert/15 bg-sac-alert/5 p-3 text-xs leading-5 text-sac-ink">{copy.homeSosNote}</p>
          <button type="button" onClick={() => go({ name: "sos" })} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-sac-alert px-4 text-sm font-black text-white shadow-sos"><Siren size={18} />{copy.homeSosCta}</button>
        </section>

        <section>
          <SectionTitle id="home-compare" title={copy.homeCompareTitle} intro={copy.homeCompareIntro} />
          <div className="mt-4 grid gap-3">
            <article className="rounded-[22px] border-2 border-sac-alert/30 bg-white p-4 shadow-card">
              <div className="flex items-center gap-2 text-sac-alert"><Siren size={20} /><h3 className="text-lg font-black">{copy.homeCompareSosTitle}</h3></div>
              <p className="mt-2 text-sm leading-6 text-sac-muted">{copy.homeCompareSosText}</p>
              <ul className="mt-3 flex flex-col gap-1.5"><CheckLine tone="alert">{copy.homeCompareSosPoint1}</CheckLine><CheckLine tone="alert">{copy.homeCompareSosPoint2}</CheckLine><CheckLine tone="alert">{copy.homeCompareSosPoint3}</CheckLine></ul>
            </article>
            <article className="rounded-[22px] border border-sac-confirm/25 bg-white p-4 shadow-card">
              <div className="flex items-center gap-2 text-sac-confirm"><BellRing size={20} /><h3 className="text-lg font-black">{copy.homeCompareOrdinaryTitle}</h3></div>
              <p className="mt-2 text-sm leading-6 text-sac-muted">{copy.homeCompareOrdinaryText}</p>
              <ul className="mt-3 flex flex-col gap-1.5"><CheckLine>{copy.homeCompareOrdinaryPoint1}</CheckLine><CheckLine>{copy.homeCompareOrdinaryPoint2}</CheckLine><CheckLine>{copy.homeCompareOrdinaryPoint3}</CheckLine></ul>
            </article>
          </div>
          <p className="mt-3 px-1 text-xs leading-5 text-sac-muted">{copy.homeCompareFooter}</p>
        </section>

        <section>
          <SectionTitle id="home-services" title={copy.homeFeaturesTitle} intro={copy.homeFeaturesIntro} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <FeatureCard icon={<UsersRound size={22} />} title={copy.homeFeatureContactsTitle} text={copy.homeFeatureContactsText} example={copy.homeFeatureContactsExample} status={<StatusPill tone="available">{copy.homeFeatureContactsStatus}</StatusPill>} future={copy.homeFeatureContactsFuture} onOpen={() => go({ name: "contacts" })} openLabel={copy.homeFeatureOpen} />
            <FeatureCard icon={<HeartPulse size={22} />} title={copy.homeFeatureHealthTitle} text={copy.homeFeatureHealthText} example={copy.homeFeatureHealthExample} status={<StatusPill tone="available">{copy.homeFeatureHealthStatus}</StatusPill>} future={copy.homeFeatureHealthFuture} onOpen={() => go({ name: "reminders" })} openLabel={copy.homeFeatureOpen} />
            <FeatureCard icon={<CalendarClock size={22} />} title={copy.homeFeatureRemindersTitle} text={copy.homeFeatureRemindersText} example={copy.homeFeatureRemindersExample} status={<StatusPill tone="available">{copy.homeFeatureRemindersStatus}</StatusPill>} onOpen={() => go({ name: "reminders" })} openLabel={copy.homeFeatureOpen} />
            <FeatureCard icon={<Sparkles size={22} />} title={copy.homeFeatureEventsTitle} text={copy.homeFeatureEventsText} example={copy.homeFeatureEventsExample} status={<StatusPill tone="partial">{copy.homeFeatureEventsStatus}</StatusPill>} onOpen={() => go({ name: "reminders" })} openLabel={copy.homeFeatureOpen} />
            <FeatureCard icon={<History size={22} />} title={copy.homeFeatureHistoryTitle} text={copy.homeFeatureHistoryText} example={copy.homeFeatureHistoryExample} status={<StatusPill tone="available">{copy.homeFeatureHistoryStatus}</StatusPill>} onOpen={() => go({ name: "history" })} openLabel={copy.homeFeatureOpen} />
            <div className="rounded-[22px] border border-sac-primary/20 bg-sac-primary/5 p-4 sm:col-span-2">
              <div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white text-sac-primary-strong"><UsersRound size={22} /></span><div><p className="font-extrabold">{copy.dashCircle}</p><p className="mt-1 text-sm leading-6 text-sac-muted">{closeContacts.length === 0 ? copy.dashCircleEmpty : fillCopy(copy.dashCircleCount, { n: closeContacts.length })}</p><button type="button" onClick={() => go({ name: "contacts" })} className="mt-2 inline-flex min-h-10 items-center gap-1 text-sm font-extrabold text-sac-ember">{copy.dashInvite}<ChevronRight size={16} className="rtl:rotate-180" /></button></div></div>
            </div>
          </div>
        </section>

        <section className="-mx-4 scroll-mt-4 border-y border-sac-primary/10 bg-[#F4FBF7] px-4 py-6">
          <SectionTitle id="home-offers" title={copy.homeOffersTitle} intro={copy.homeOffersIntro} />
          <div className="mt-4 grid gap-3">
            <article className="rounded-[22px] border border-sac-primary/20 bg-white p-4 shadow-card">
              <div className="flex items-center justify-between gap-2"><h3 className="text-lg font-black">{copy.homeOfferFreeTitle}</h3><span className="rounded-full bg-sac-sand px-2.5 py-1 text-[11px] font-extrabold text-sac-primary-strong">{copy.homeOfferFreePrice}</span></div>
              <p className="mt-2 text-sm leading-6 text-sac-muted">{copy.homeOfferFreeText}</p>
              <ul className="mt-3 flex flex-col gap-1.5"><CheckLine>{copy.homeOfferFreePoint1}</CheckLine><CheckLine>{copy.homeOfferFreePoint2}</CheckLine><CheckLine>{copy.homeOfferFreePoint3}</CheckLine></ul>
            </article>
            <article className="rounded-[22px] border-2 border-sac-primary-strong/40 bg-gradient-to-br from-white to-sac-sand p-4 shadow-glass">
              <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-lg font-black"><Crown size={19} className="text-sac-primary-strong" />{copy.homeOfferPremiumTitle}</h3><span className="rounded-full bg-sac-primary-strong px-2.5 py-1 text-[11px] font-extrabold text-white">{copy.homeOfferPremiumPrice}</span></div>
              <p className="mt-2 text-sm leading-6 text-sac-muted">{copy.homeOfferPremiumText}</p>
              <ul className="mt-3 flex flex-col gap-1.5"><CheckLine>{copy.homeOfferPremiumPoint1}</CheckLine><CheckLine>{copy.homeOfferPremiumPoint2}</CheckLine><CheckLine>{copy.homeOfferPremiumPoint3}</CheckLine></ul>
              <p className="mt-3 rounded-xl bg-white/80 p-3 text-xs leading-5 text-sac-muted">{copy.homeOfferPremiumNote}</p>
              <button type="button" disabled className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[16px] border border-sac-primary-strong/20 bg-white px-4 text-sm font-extrabold text-sac-muted opacity-80"><LockKeyhole size={17} />{copy.homeOfferPremiumCta}</button>
            </article>
            <article className="rounded-[22px] border border-sac-primary/20 bg-white p-4 shadow-card">
              <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-lg font-black"><Building2 size={19} className="text-sac-primary-strong" />{copy.homeOfferProTitle}</h3><span className="rounded-full bg-sac-sand px-2.5 py-1 text-[11px] font-extrabold text-sac-primary-strong">{copy.homeOfferProPrice}</span></div>
              <p className="mt-2 text-sm leading-6 text-sac-muted">{copy.homeOfferProText}</p>
              <ul className="mt-3 flex flex-col gap-1.5"><CheckLine>{copy.homeOfferProPoint1}</CheckLine><CheckLine>{copy.homeOfferProPoint2}</CheckLine><CheckLine>{copy.homeOfferProPoint3}</CheckLine></ul>
              <button type="button" disabled className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[16px] border border-sac-primary/20 bg-sac-canvas px-4 text-sm font-extrabold text-sac-muted opacity-80"><Clock3 size={17} />{copy.homeOfferProCta}</button>
            </article>
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-[20px] border border-sac-alert/25 bg-sac-alert/5 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sac-alert/10 text-sac-alert"><ShieldCheck size={21} /></span>
            <p className="text-sm font-extrabold leading-6 text-sac-alert">{copy.homeOfferSosFree}</p>
          </div>
          <details className="mt-4 rounded-[20px] border border-sac-primary/20 bg-white p-4 shadow-card">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-extrabold text-sac-ink"><span className="flex items-center gap-2"><CreditCard size={18} className="text-sac-primary-strong" />{copy.homePremiumHowTitle}</span><ChevronRight size={17} className="shrink-0 text-sac-muted rtl:rotate-180" /></summary>
            <p className="mt-2 text-xs leading-5 text-sac-muted">{copy.homePremiumHowIntro}</p>
            <ol className="mt-3 flex flex-col gap-2">
              {[copy.homePremiumStep1, copy.homePremiumStep2, copy.homePremiumStep3, copy.homePremiumStep4, copy.homePremiumStep5].map((step, index) => <li key={step} className="flex gap-2 text-sm leading-6"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sac-primary/10 text-[11px] font-black text-sac-primary-strong">{index + 1}</span>{step}</li>)}
            </ol>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-sac-canvas p-3 text-xs leading-5 text-sac-muted"><Info size={16} className="mt-0.5 shrink-0 text-sac-primary-strong" />{copy.homePremiumStatus}</div>
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-sac-canvas p-3 text-xs leading-5 text-sac-muted"><RefreshCw size={16} className="mt-0.5 shrink-0 text-sac-primary-strong" />{copy.homePremiumManage}</div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-sac-muted"><span className="inline-flex items-center gap-1 rounded-full bg-sac-canvas px-2.5 py-1"><Wallet size={14} />{copy.homePremiumMethodMobileMoney}</span><span className="inline-flex items-center gap-1 rounded-full bg-sac-canvas px-2.5 py-1"><CreditCard size={14} />{copy.homePremiumMethodCard}</span></div>
          </details>
        </section>

        <section>
          <SectionTitle id="home-tour" title={copy.homeTourTitle} intro={copy.homeTourIntro} />
          <ol className="mt-4 flex flex-col gap-3">
            {[
              [copy.homeTourStep1Title, copy.homeTourStep1Text],
              [copy.homeTourStep2Title, copy.homeTourStep2Text],
              [copy.homeTourStep3Title, copy.homeTourStep3Text],
              [copy.homeTourStep4Title, copy.homeTourStep4Text],
              [copy.homeTourStep5Title, copy.homeTourStep5Text],
            ].map(([title, text], index) => (
              <li key={title} className="flex gap-3 rounded-[20px] border border-white/90 bg-white/85 p-4 shadow-card">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sac-primary/10 text-sm font-black text-sac-primary-strong">{index + 1}</span>
                <span><span className="block font-extrabold text-sac-ink">{title}</span><span className="mt-1 block text-sm leading-6 text-sac-muted">{text}</span></span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <SectionTitle id="home-help" title={copy.homeHelpTitle} intro={copy.homeHelpIntro} />
          <div className="mt-4 flex flex-col gap-2">
            {[
              [copy.homeFaq1Q, copy.homeFaq1A], [copy.homeFaq2Q, copy.homeFaq2A], [copy.homeFaq3Q, copy.homeFaq3A],
              [copy.homeFaq4Q, copy.homeFaq4A], [copy.homeFaq5Q, copy.homeFaq5A],
            ].map(([question, answer]) => (
              <details key={question} className="rounded-2xl border border-sac-primary/15 bg-white/90 p-4 shadow-card">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-sm font-extrabold text-sac-ink"><span className="flex items-start gap-2"><CircleHelp size={17} className="mt-0.5 shrink-0 text-sac-primary-strong" />{question}</span><ChevronRight size={16} className="shrink-0 text-sac-muted rtl:rotate-180" /></summary>
                <p className="mt-2 text-sm leading-6 text-sac-muted">{answer}</p>
              </details>
            ))}
          </div>
          <div className="mt-3 rounded-2xl border border-sac-primary/15 bg-sac-canvas p-4">
            <p className="flex items-start gap-2 text-xs leading-5 text-sac-muted"><BookOpen size={16} className="mt-0.5 shrink-0 text-sac-primary-strong" />{copy.homeHelpStatus}</p>
            <button type="button" onClick={() => go({ name: "settings" })} className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-sac-ember">{copy.homeHelpSettingsCta}<ChevronRight size={16} className="rtl:rotate-180" /></button>
          </div>
        </section>

        <div className="flex items-start gap-3 rounded-2xl border border-sac-primary/15 bg-white/80 p-4">
          <ProfileAvatar photoUrl={ownProfile?.photoUrl} name={firstName || "SAC"} size="sm" />
          <div className="min-w-0"><p className="text-sm font-extrabold">{firstName || copy.homeGreetingFallback}</p><p className="mt-1 text-xs leading-5 text-sac-muted">{copy.homeFooterEmergency}</p></div>
          {loading && <span className="ms-auto text-xs text-sac-muted">{copy.loading}</span>}
        </div>
      </Sheet>
    </>
  );
}
