import { useCallback, useEffect, useState, type FormEvent } from "react";
import { adminTranslations, type AdminPermission, type Language } from "./i18n/translations";
import BrandLogo from "./components/BrandLogo";

type Permission = AdminPermission;
type Account = { id: string; email: string };
type AuditEvent = { id: string; actor_email: string | null; action: string; scope_key: string | null; permission_used: string | null; outcome: string; occurred_at: number };
type Mission = {
  id: string; assignedAccountId: string; assignedEmail?: string | null; scopeKey: string; status: "active" | "suspended" | "revoked";
  dueAt: number | null; createdAt: number; updatedAt: number; version: number; permissions: Permission[];
};
type DelegateMission = {
  id: string; scopeKey: string; status: "active" | "suspended"; dueAt: number | null;
  createdAt: number; updatedAt: number; version: number; permissions: Permission[];
};
type AdminAccess = { canAccess: boolean; role: "super_admin" | "delegate" | null; activeMissions: number };
type OverviewMetrics = { activeAccounts: number; activeAlerts: number; alertsLast24h: number; activeMissions: number; activeDelegates: number; auditEventsLast24h: number };
type AlertSupervision = {
  summary: { active: number; createdLast24h: number; closedLast24h: number; activeWithResponse: number; activeWithResponsible: number; activeWithoutResponse: number };
  byLevel: { level: string; total: number }[];
  byCategory: { category: string; total: number }[];
};
type SupportTicket = { id: string; public_reference: string; category: string; subject: string; priority: string; status: string; created_at: number; updated_at: number; requester_email: string };
type SupportInbox = { counts: { new: number; open: number; waiting: number; resolved: number }; tickets: SupportTicket[] };
type SupportTicketDetail = { ticket: SupportTicket & { description: string; version: number }; messages: { id: string; author_kind: string; body: string; created_at: number }[]; events: { id: string; event_type: string; previous_value: string | null; new_value: string | null; occurred_at: number }[] };
const PERMISSION_VALUES: Permission[] = ["read", "create", "update", "process", "export", "delete"];

export default function AdminDashboard({ language = "fr" }: { language?: Language }) {
  const [allowedDevice, setAllowedDevice] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [delegateMissions, setDelegateMissions] = useState<DelegateMission[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [overviewMetrics, setOverviewMetrics] = useState<OverviewMetrics | null>(null);
  const [alertSupervision, setAlertSupervision] = useState<AlertSupervision | null>(null);
  const [supportInbox, setSupportInbox] = useState<SupportInbox | null>(null);
  const [supportTicketDetail, setSupportTicketDetail] = useState<SupportTicketDetail | null>(null);
  const [supportReply, setSupportReply] = useState("");
  const [query, setQuery] = useState("");
  const [accountId, setAccountId] = useState("");
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
  const [scopeKey, setScopeKey] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>(["read"]);
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [error, setError] = useState("");
  const t = adminTranslations[language];
  const isSuperAdmin = access?.role === "super_admin";
  const activeMissionCount = isSuperAdmin ? missions.filter((mission) => mission.status === "active").length : delegateMissions.filter((mission) => mission.status === "active").length;
  const delegateCount = new Set(missions.filter((mission) => mission.status === "active").map((mission) => mission.assignedAccountId)).size;
  const permissionCount = new Set((isSuperAdmin ? missions : delegateMissions).flatMap((mission) => mission.permissions)).size;

  const refreshSuperAdmin = useCallback(async () => {
    const [missionResponse, auditResponse, overviewResponse] = await Promise.all([
      fetch("/api/admin/missions", { credentials: "same-origin", cache: "no-store" }),
      fetch("/api/admin/audit?limit=50", { credentials: "same-origin", cache: "no-store" }),
      fetch("/api/admin/overview", { credentials: "same-origin", cache: "no-store" }),
    ]);
    const alertResponse = await fetch("/api/admin/alerts", { credentials: "same-origin", cache: "no-store" });
    const supportResponse = await fetch("/api/admin/support", { credentials: "same-origin", cache: "no-store" });
    if (!missionResponse.ok || !auditResponse.ok || !overviewResponse.ok || !alertResponse.ok || !supportResponse.ok) throw new Error([missionResponse, auditResponse, overviewResponse, alertResponse, supportResponse].some((response) => response.status === 401 || response.status === 403) ? "denied" : "unavailable");
    const [missionPayload, auditPayload, overviewPayload, alertPayload, supportPayload] = await Promise.all([
      missionResponse.json() as Promise<{ missions: Mission[] }>,
      auditResponse.json() as Promise<{ events: AuditEvent[] }>,
      overviewResponse.json() as Promise<{ metrics: OverviewMetrics }>,
      alertResponse.json() as Promise<AlertSupervision>,
      supportResponse.json() as Promise<SupportInbox>,
    ]);
    setMissions(missionPayload.missions);
    setAuditEvents(auditPayload.events);
    setOverviewMetrics(overviewPayload.metrics);
    setAlertSupervision(alertPayload);
    setSupportInbox(supportPayload);
    setAccessDenied(false);
  }, []);

  const loadSupportTicket = async (ticketId: string) => {
    const response = await fetch(`/api/admin/support/${encodeURIComponent(ticketId)}`, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("support_ticket_unavailable");
    setSupportTicketDetail(await response.json() as SupportTicketDetail);
  };

  const sendSupportReply = async () => {
    if (!supportTicketDetail || !supportReply.trim() || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/support/${encodeURIComponent(supportTicketDetail.ticket.id)}/messages`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: supportReply.trim() }),
      });
      if (!response.ok) throw new Error("support_reply_failed");
      setSupportReply("");
      await loadSupportTicket(supportTicketDetail.ticket.id);
      await refreshSuperAdmin();
    } catch { setError("unavailable"); } finally { setBusy(false); }
  };

  const updateSupportStatus = async (status: string) => {
    if (!supportTicketDetail || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/support/${encodeURIComponent(supportTicketDetail.ticket.id)}`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, expectedVersion: supportTicketDetail.ticket.version }),
      });
      if (!response.ok) throw new Error("support_status_failed");
      await loadSupportTicket(supportTicketDetail.ticket.id);
      await refreshSuperAdmin();
    } catch { setError("unavailable"); } finally { setBusy(false); }
  };

  const refreshDelegate = useCallback(async () => {
    const response = await fetch("/api/admin/my-missions", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "denied" : "unavailable");
    const payload = await response.json() as { missions?: DelegateMission[] };
    setDelegateMissions(Array.isArray(payload.missions) ? payload.missions : []);
    setAccessDenied(false);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setAllowedDevice(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!allowedDevice) return;
    const controller = new AbortController();
    setAccessLoading(true);
    void fetch("/api/admin/access", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "denied" : "unavailable");
        return response.json() as Promise<AdminAccess>;
      })
      .then((payload) => {
        if (!payload.canAccess || !payload.role) {
          setAccessDenied(true);
          setError(t.denied);
          return;
        }
        setAccess(payload);
        setAccessDenied(false);
        setError("");
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setAccessDenied(true);
        setError(reason instanceof Error && reason.message === "denied" ? t.denied : t.loadError);
      })
      .finally(() => setAccessLoading(false));
    return () => controller.abort();
  }, [allowedDevice, t]);

  useEffect(() => {
    if (!allowedDevice || !access) return;
    const load = access.role === "super_admin" ? refreshSuperAdmin : refreshDelegate;
    void load().catch((reason: unknown) => {
      if (reason instanceof Error && reason.message === "denied") {
        setAccessDenied(true);
        setError(t.denied);
        return;
      }
      setError(t.loadError);
    });
  }, [allowedDevice, access, refreshDelegate, refreshSuperAdmin, t]);

  useEffect(() => {
    if (!allowedDevice || access?.role !== "super_admin") return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch("/api/admin/accounts?q=" + encodeURIComponent(query), { credentials: "same-origin", cache: "no-store", signal: controller.signal })
        .then(async (response) => response.ok ? response.json() as Promise<{ accounts: Account[] }> : { accounts: [] })
        .then((payload) => setAccounts(payload.accounts))
        .catch(() => undefined);
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [allowedDevice, access, query]);

  async function createMission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountId || !scopeKey.trim() || permissions.length === 0) { setError(t.choose); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const editing = editingMissionId;
      const response = await fetch(editing ? "/api/admin/missions/" + encodeURIComponent(editing) : "/api/admin/missions", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing
          ? { action: "replace", assignedAccountId: accountId, scopeKey: scopeKey.trim(), permissions, dueAt: dueAt ? Date.parse(dueAt) : null }
          : { assignedAccountId: accountId, scopeKey: scopeKey.trim(), permissions, dueAt: dueAt ? Date.parse(dueAt) : null }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        if (payload?.error === "mission_conflict") {
          setError(t.conflict);
          await refreshSuperAdmin();
          return;
        }
        throw new Error("save_failed");
      }
      setAccountId(""); setScopeKey(""); setPermissions(["read"]); setDueAt(""); setEditingMissionId(null);
      setNotice(t.saved); await refreshSuperAdmin();
    } catch {
      setError(t.denied);
    } finally { setBusy(false); }
  }

  function editMission(mission: Mission) {
    setEditingMissionId(mission.id);
    setAccountId(mission.assignedAccountId);
    setQuery(mission.assignedEmail ?? "");
    setScopeKey(mission.scopeKey);
    setPermissions(mission.permissions);
    setDueAt(mission.dueAt === null ? "" : new Date(mission.dueAt - new Date(mission.dueAt).getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
    setError(""); setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function manageMission(missionId: string, action: "suspend" | "resume" | "revoke") {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/missions/" + encodeURIComponent(missionId), {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        if (payload?.error === "mission_conflict") {
          setError(t.conflict);
          await refreshSuperAdmin();
          return;
        }
        throw new Error("action_failed");
      }
      await refreshSuperAdmin();
    } catch { setError(t.denied); }
    finally { setBusy(false); }
  }


  const consoleSections = [
    { id: "overview", icon: "⌂", fr: "Vue d’ensemble", en: "Overview", ar: "نظرة عامة", detailFr: "Indicateurs fiables, activité récente et supervision.", detailEn: "Verified indicators, recent activity and service monitoring.", detailAr: "مؤشرات موثوقة والنشاط الأخير ومراقبة الخدمات." },
    { id: "users", icon: "◎", fr: "Utilisateurs", en: "Users", ar: "المستخدمون", detailFr: "Comptes, états et assistance de compte.", detailEn: "Accounts, statuses and account assistance.", detailAr: "الحسابات والحالات ومساعدة الحساب." },
    { id: "alerts", icon: "⌁", fr: "Alertes", en: "Alerts", ar: "التنبيهات", detailFr: "Supervision respectueuse de la confidentialité citoyenne.", detailEn: "Monitoring that protects citizen privacy.", detailAr: "مراقبة تحترم خصوصية المواطنين." },
    { id: "finances", icon: "▤", fr: "Finances", en: "Finance", ar: "المالية", detailFr: "Comptabilité, trésorerie, budgets et paiements.", detailEn: "Accounting, treasury, budgets and payments.", detailAr: "المحاسبة والخزينة والميزانيات والمدفوعات." },
    { id: "support", icon: "☏", fr: "Assistance", en: "Support", ar: "الدعم", detailFr: "Demandes, tickets, centre d’aide et incidents.", detailEn: "Requests, tickets, help desk and incidents.", detailAr: "الطلبات والتذاكر والمساعدة والحوادث." },
    { id: "security", icon: "⬡", fr: "Sécurité", en: "Security", ar: "الأمان", detailFr: "Accès, missions administratives et journal d’audit.", detailEn: "Access, administrative missions and audit log.", detailAr: "الوصول والمهام الإدارية وسجل التدقيق." },
    { id: "team", icon: "♧", fr: "Équipe et missions", en: "Team & missions", ar: "الفريق والمهام", detailFr: "Collaborateurs, missions et délégations.", detailEn: "Staff, assignments and delegations.", detailAr: "الفريق والمهام والتفويضات." },
    { id: "external", icon: "⇄", fr: "Relations externes", en: "External relations", ar: "العلاقات الخارجية", detailFr: "Partenaires, candidatures et conventions.", detailEn: "Partners, applications and agreements.", detailAr: "الشركاء والطلبات والاتفاقيات." },
    { id: "resources", icon: "▦", fr: "Ressources", en: "Resources", ar: "الموارد", detailFr: "Ressources humaines, logistique, équipements et documents.", detailEn: "HR, logistics, equipment and documents.", detailAr: "الموارد البشرية واللوجستيات والمعدات والوثائق." },
    { id: "steering", icon: "◫", fr: "Pilotage", en: "Management", ar: "الإدارة", detailFr: "Objectifs, indicateurs, projets et rapports de direction.", detailEn: "Objectives, KPIs, projects and executive reports.", detailAr: "الأهداف والمؤشرات والمشاريع وتقارير الإدارة." },
    { id: "settings", icon: "⚙", fr: "Paramètres", en: "Settings", ar: "الإعدادات", detailFr: "Configuration, langues, fournisseurs et versions.", detailEn: "Configuration, languages, providers and versions.", detailAr: "الإعدادات واللغات ومقدمو الخدمات والإصدارات." },
  ];
  const selectedSection = consoleSections.find((section) => section.id === activeSection) ?? consoleSections[0];
  const sectionLabel = (section: typeof consoleSections[number]) => language === "fr" ? section.fr : language === "ar" ? section.ar : section.en;
  const sectionDetail = (section: typeof consoleSections[number]) => language === "fr" ? section.detailFr : language === "ar" ? section.detailAr : section.detailEn;

  if (!allowedDevice) return <main className="min-h-screen bg-sac-primary/20 p-6 text-sac-ink"><section className="mx-auto mt-16 max-w-lg rounded-3xl border border-white/80 bg-white/75 p-8 text-center shadow-glass"><BrandLogo className="mx-auto h-10 w-auto" /><p className="mt-4 text-sm leading-7">{t.unavailable}</p><a href="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-sac-primary-strong px-5 font-bold text-white">{t.back}</a></section></main>;

  if (accessLoading) return <main className="min-h-screen bg-sac-primary/20 p-6 text-sac-ink"><section className="mx-auto mt-16 max-w-lg rounded-3xl border border-white/80 bg-white/75 p-8 text-center shadow-glass"><BrandLogo className="mx-auto h-10 w-auto" /><p className="mt-4 text-sm leading-7">{t.loading}</p></section></main>;

  if (accessDenied) return <main className="min-h-screen bg-sac-primary/20 p-6 text-sac-ink"><section className="mx-auto mt-16 max-w-lg rounded-3xl border border-white/80 bg-white/75 p-8 text-center shadow-glass"><BrandLogo className="mx-auto h-10 w-auto" /><p className="mt-4 text-sm leading-7">{t.denied}</p><div className="mt-6 flex flex-wrap justify-center gap-3"><a href="/connexion" className="inline-flex min-h-11 items-center rounded-xl bg-sac-primary-strong px-5 font-bold text-white">{t.signIn}</a><a href="/" className="inline-flex min-h-11 items-center rounded-xl border border-sac-primary-strong/20 bg-white/70 px-5 font-bold">{t.back}</a></div></section></main>;

  const summaryCards = isSuperAdmin
    ? [
      { label: t.summaryRole, value: t.roleSuperAdmin },
      { label: t.summaryActive, value: activeMissionCount },
      { label: t.summaryDelegates, value: delegateCount },
      { label: t.summaryAuditEvents, value: auditEvents.length },
    ]
    : [
      { label: t.summaryRole, value: t.roleDelegate },
      { label: t.summaryActive, value: activeMissionCount },
      { label: t.summaryPermissions, value: permissionCount },
      { label: t.missions, value: delegateMissions.length },
    ];
  const summary = <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{summaryCards.map((card) => <div key={card.label} className="rounded-2xl border border-white/90 bg-white/75 p-5 shadow-glass"><p className="text-[11px] font-black uppercase tracking-[.14em] text-sac-muted">{card.label}</p><p className="mt-2 text-2xl font-black text-sac-primary-strong">{card.value}</p></div>)}</section>;

  const overviewLabels = language === "fr"
    ? [{ label: "Comptes actifs", value: overviewMetrics?.activeAccounts }, { label: "Alertes actives", value: overviewMetrics?.activeAlerts }, { label: "Alertes · 24 h", value: overviewMetrics?.alertsLast24h }, { label: "Missions actives", value: overviewMetrics?.activeMissions }, { label: "Délégués actifs", value: overviewMetrics?.activeDelegates }, { label: "Événements d’audit · 24 h", value: overviewMetrics?.auditEventsLast24h }]
    : language === "ar"
      ? [{ label: "الحسابات النشطة", value: overviewMetrics?.activeAccounts }, { label: "التنبيهات النشطة", value: overviewMetrics?.activeAlerts }, { label: "التنبيهات · 24 ساعة", value: overviewMetrics?.alertsLast24h }, { label: "المهام النشطة", value: overviewMetrics?.activeMissions }, { label: "المفوضون النشطون", value: overviewMetrics?.activeDelegates }, { label: "أحداث التدقيق · 24 ساعة", value: overviewMetrics?.auditEventsLast24h }]
      : [{ label: "Active accounts", value: overviewMetrics?.activeAccounts }, { label: "Active alerts", value: overviewMetrics?.activeAlerts }, { label: "Alerts · 24h", value: overviewMetrics?.alertsLast24h }, { label: "Active missions", value: overviewMetrics?.activeMissions }, { label: "Active delegates", value: overviewMetrics?.activeDelegates }, { label: "Audit events · 24h", value: overviewMetrics?.auditEventsLast24h }];
  const overviewCards = <section className="mb-8"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-extrabold text-emerald-950">{language === "fr" ? "Activité réelle de la plateforme" : language === "ar" ? "النشاط الفعلي للمنصة" : "Live platform activity"}</h2><span className="text-[11px] text-slate-500">{language === "fr" ? "Période glissante de 24 heures" : language === "ar" ? "آخر 24 ساعة" : "Rolling 24-hour period"}</span></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{overviewLabels.map((metric) => <div key={metric.label} className="rounded-2xl border border-emerald-900/10 bg-white/85 p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">{metric.label}</p><p className="mt-2 text-2xl font-black tabular-nums text-emerald-950">{metric.value === undefined ? "—" : metric.value.toLocaleString(language)}</p></div>)}</div>{!overviewMetrics && <p className="mt-3 text-xs text-slate-500">{language === "fr" ? "Indicateurs indisponibles : actualise la page ou réessaie plus tard." : language === "ar" ? "المؤشرات غير متاحة: حدّث الصفحة أو أعد المحاولة لاحقاً." : "Metrics unavailable: refresh the page or try again later."}</p>}</section>;

  if (access?.role === "delegate") return <main className="min-h-screen bg-sac-primary/15 px-5 py-8 text-sac-ink sm:px-8" dir={language === "ar" ? "rtl" : "ltr"}>
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div><BrandLogo className="h-8 w-auto" /><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black">{t.delegateTitle}</h1><span className="rounded-full bg-sac-primary/15 px-3 py-1 text-xs font-black text-sac-primary-strong">{t.roleDelegate}</span></div><p className="mt-1 text-sm text-sac-muted">{t.delegateSubtitle}</p></div>
        <a href="/" className="rounded-xl border border-white bg-white/70 px-4 py-3 text-sm font-bold">{t.back}</a>
      </header>
      {activeSection === "overview" && <>{summary}{isSuperAdmin && overviewCards}</>}
      {error && <p role="alert" className="mb-5 rounded-xl border border-sac-alert/30 bg-white/80 p-4 text-sm text-sac-alert">{error}</p>}
      <section>
        <h2 className="mb-4 text-xl font-extrabold">{t.myMissions}</h2>
        {delegateMissions.length === 0 ? <p className="rounded-2xl bg-white/70 p-6 text-sm text-sac-muted">{t.noMissions}</p> : <div className="grid gap-4 md:grid-cols-2">{delegateMissions.map((mission) => <article key={mission.id} className="rounded-2xl border border-white/90 bg-white/80 p-5 shadow-glass">
          <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-extrabold">{mission.scopeKey}</h3><span className="rounded-full bg-sac-primary/50 px-3 py-1 text-xs font-bold">{t[mission.status]}</span></div>
          <div className="mt-3 flex flex-wrap gap-2">{mission.permissions.map((permission) => <span key={permission} className="rounded-lg border border-sac-primary-strong/15 px-2 py-1 text-xs">{t.permissions[permission]}</span>)}</div>
          {mission.dueAt && <p className="mt-3 text-xs text-sac-muted">{t.dueOn}: {new Date(mission.dueAt).toLocaleString(language)}</p>}
        </article>)}</div>}
      </section>
    </div>
  </main>;

  return <main className="min-h-screen bg-[#F4FBF7] text-[#1F2A24]" dir={language === "ar" ? "rtl" : "ltr"}>
    <div className="flex min-h-screen">
      <aside className="hidden w-72 shrink-0 border-e border-emerald-900/10 bg-white/80 p-5 shadow-sm lg:flex lg:flex-col">
        <div className="mb-8"><BrandLogo className="h-8 w-auto" /><p className="mt-3 text-xs font-bold uppercase tracking-wider text-emerald-800/60">SAC · Administration</p><h2 className="mt-1 text-lg font-black">{t.roleSuperAdmin}</h2></div>
        <nav aria-label="Navigation professionnelle" className="flex-1 space-y-1">
          {consoleSections.map((section) => <button key={section.id} type="button" onClick={() => setActiveSection(section.id)} aria-current={activeSection === section.id ? "page" : undefined} className={activeSection === section.id ? "flex min-h-11 w-full items-center gap-3 rounded-xl bg-emerald-100 px-3 py-2 text-start text-sm font-bold text-emerald-950 shadow-sm" : "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-sm font-bold text-slate-600 hover:bg-emerald-50 hover:text-emerald-950"}>
            <span aria-hidden="true" className="w-6 text-center text-lg">{section.icon}</span><span>{sectionLabel(section)}</span>
          </button>)}
        </nav>
        <a href="/" className="mt-6 rounded-xl border border-emerald-900/15 px-3 py-3 text-center text-sm font-bold">{t.back}</a>
      </aside>
      <div className="min-w-0 flex-1 px-4 py-5 sm:px-7 lg:px-9">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 lg:hidden"><BrandLogo className="h-7 w-auto" /><span className="text-sm font-black">SAC Admin</span></div>
          <div className="hidden lg:block"><p className="text-xs font-bold uppercase tracking-widest text-emerald-800/60">Console professionnelle</p><h1 className="mt-1 text-2xl font-black">{sectionLabel(selectedSection)}</h1></div>
          <div className="ms-auto flex items-center gap-3"><span className="rounded-full border border-emerald-800/15 bg-white px-3 py-2 text-xs font-bold">{t.roleSuperAdmin}</span><a href="/" className="rounded-xl border border-emerald-900/15 bg-white px-4 py-2 text-sm font-bold lg:hidden">{t.back}</a></div>
        </header>
        <div className="mb-5 flex gap-2 overflow-x-auto pb-2 lg:hidden" aria-label="Navigation professionnelle">
          {consoleSections.map((section) => <button key={section.id} type="button" onClick={() => setActiveSection(section.id)} aria-current={activeSection === section.id ? "page" : undefined} className={activeSection === section.id ? "shrink-0 rounded-xl bg-emerald-800 px-3 py-2 text-xs font-bold text-white" : "shrink-0 rounded-xl border border-emerald-900/15 bg-white px-3 py-2 text-xs font-bold text-slate-700"}>{sectionLabel(section)}</button>)}
        </div>
        <div className="mb-6 rounded-2xl border border-emerald-900/10 bg-white/80 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-800/60">SAC · {sectionLabel(selectedSection)}</p>
          <p className="mt-1 text-sm text-slate-600">{sectionDetail(selectedSection)}</p>
        </div>
      {activeSection === "overview" && summary}
      {error && <p role="alert" className="mb-5 rounded-xl border border-sac-alert/30 bg-white/80 p-4 text-sm text-sac-alert">{error}</p>}
      {notice && <p role="status" className="mb-5 rounded-xl border border-sac-confirm/30 bg-white/80 p-4 text-sm">{notice}</p>}
      {activeSection === "team" && <>
      <section className="rounded-3xl border border-white/90 bg-white/75 p-6 shadow-glass backdrop-blur-xl">
        <h2 className="text-xl font-extrabold">{t.create}</h2>
        <form onSubmit={createMission} className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="block text-sm font-bold">{t.assignee}
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} className="mt-2 min-h-11 w-full rounded-xl border border-sac-primary-strong/20 bg-white px-3 font-normal" />
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} required className="mt-2 min-h-11 w-full rounded-xl border border-sac-primary-strong/20 bg-white px-3 font-normal">
              <option value="">{t.select}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.email}</option>)}
            </select>
          </label>
          <label className="block text-sm font-bold">{t.scope}
            <input value={scopeKey} onChange={(event) => setScopeKey(event.target.value)} maxLength={200} required placeholder={t.scopeHint} className="mt-2 min-h-11 w-full rounded-xl border border-sac-primary-strong/20 bg-white px-3 font-normal" />
          </label>
          <fieldset className="rounded-2xl border border-sac-primary-strong/15 p-4 md:col-span-2"><legend className="px-2 text-sm font-bold">{t.permissionsLabel}</legend><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{PERMISSION_VALUES.map((value) => <label key={value} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={permissions.includes(value)} onChange={(event) => setPermissions((current) => event.target.checked ? [...current, value] : current.filter((item) => item !== value))} />{t.permissions[value]}</label>)}</div></fieldset>
          <label className="block text-sm font-bold">{t.due}<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-sac-primary-strong/20 bg-white px-3 font-normal" /></label>
          <div className="flex flex-col gap-2"><button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-sac-primary-strong px-5 font-extrabold text-white disabled:opacity-50">{busy ? "…" : editingMissionId ? t.save : t.create}</button>
            {editingMissionId && <button type="button" disabled={busy} onClick={() => { setEditingMissionId(null); setAccountId(""); setQuery(""); setScopeKey(""); setPermissions(["read"]); setDueAt(""); }} className="min-h-10 w-full rounded-xl border px-4 text-sm font-bold">{t.cancel}</button>}</div>
        </form>
      </section>
      <section className="mt-8">
        <h2 className="mb-4 text-xl font-extrabold">{t.missions}</h2>
        {missions.length === 0 ? <p className="rounded-2xl bg-white/70 p-6 text-sm text-sac-muted">{t.empty}</p> : <div className="grid gap-4 md:grid-cols-2">{missions.map((mission) => <article key={mission.id} className="rounded-2xl border border-white/90 bg-white/80 p-5 shadow-glass">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="break-all text-xs text-sac-muted">{mission.assignedEmail ?? mission.assignedAccountId}</p><h3 className="mt-1 font-extrabold">{mission.scopeKey}</h3></div><span className="rounded-full bg-sac-primary/50 px-3 py-1 text-xs font-bold">{t[mission.status]}</span></div>
          <div className="mt-3 flex flex-wrap gap-2">{mission.permissions.map((permission) => <span key={permission} className="rounded-lg border border-sac-primary-strong/15 px-2 py-1 text-xs">{t.permissions[permission]}</span>)}</div>
          {mission.dueAt && <p className="mt-3 text-xs text-sac-muted">{new Date(mission.dueAt).toLocaleString(language)}</p>}
          {mission.status !== "revoked" && <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={() => editMission(mission)} className="rounded-lg border px-3 py-2 text-xs font-bold">{t.edit}</button>{mission.status === "active" ? <button disabled={busy} onClick={() => void manageMission(mission.id, "suspend")} className="rounded-lg border px-3 py-2 text-xs font-bold">{t.suspend}</button> : <button disabled={busy} onClick={() => void manageMission(mission.id, "resume")} className="rounded-lg border px-3 py-2 text-xs font-bold">{t.resume}</button>}<button disabled={busy} onClick={() => void manageMission(mission.id, "revoke")} className="rounded-lg bg-sac-alert px-3 py-2 text-xs font-bold text-white">{t.revoke}</button></div>}
        </article>)}</div>}
      </section>
      </>}
      {activeSection === "users" && <section className="rounded-3xl border border-emerald-900/10 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold">{sectionLabel(consoleSections[1])}</h2><p className="mt-1 text-sm text-slate-600">{language === "fr" ? "Répertoire en lecture seule des comptes actifs disposant d’une adresse e-mail principale vérifiée." : language === "ar" ? "دليل للقراءة فقط للحسابات النشطة التي لديها بريد إلكتروني أساسي تم التحقق منه." : "Read-only directory of active accounts with a verified primary email address."}</p></div><span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">{accounts.length} / 25</span></div>
        <label className="mt-5 block text-sm font-bold">{language === "fr" ? "Rechercher un compte" : language === "ar" ? "البحث عن حساب" : "Search accounts"}
          <input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} placeholder="nom@exemple.com" className="mt-2 min-h-11 w-full rounded-xl border border-emerald-900/15 bg-white px-3 font-normal" />
        </label>
        {accounts.length === 0 ? <p className="mt-5 rounded-xl bg-emerald-50/70 p-5 text-sm text-slate-600">{language === "fr" ? "Aucun compte actif correspondant. Saisis une adresse ou une partie d’adresse e-mail." : language === "ar" ? "لا يوجد حساب نشط مطابق. أدخل عنوان البريد الإلكتروني أو جزءاً منه." : "No matching active account. Enter an email address or part of one."}</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead><tr className="border-b border-emerald-900/10 text-xs text-slate-500"><th className="p-3">{language === "fr" ? "Identifiant du compte" : language === "ar" ? "معرّف الحساب" : "Account ID"}</th><th className="p-3">E-mail vérifié</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id} className="border-b border-emerald-900/10"><td className="p-3 font-mono text-xs">{account.id}</td><td className="p-3">{account.email}</td></tr>)}</tbody></table></div>}
        <p className="mt-4 text-xs text-slate-500">{language === "fr" ? "Limite de 25 résultats. Cet écran ne modifie pas les comptes et n’expose aucune donnée privée supplémentaire." : language === "ar" ? "الحد الأقصى 25 نتيجة. لا تعدّل هذه الشاشة الحسابات ولا تكشف بيانات خاصة إضافية." : "Limited to 25 results. This screen does not modify accounts or expose additional private data."}</p>
      </section>}
      {activeSection === "alerts" && <section className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { label: language === "fr" ? "Alertes actives" : language === "ar" ? "التنبيهات النشطة" : "Active alerts", value: alertSupervision?.summary.active },
            { label: language === "fr" ? "Créées · 24 h" : language === "ar" ? "تم إنشاؤها · 24 ساعة" : "Created · 24h", value: alertSupervision?.summary.createdLast24h },
            { label: language === "fr" ? "Clôturées · 24 h" : language === "ar" ? "أُغلقت · 24 ساعة" : "Closed · 24h", value: alertSupervision?.summary.closedLast24h },
            { label: language === "fr" ? "Avec une réponse" : language === "ar" ? "مع استجابة" : "With a response", value: alertSupervision?.summary.activeWithResponse },
            { label: language === "fr" ? "Avec responsable actuel" : language === "ar" ? "لها مسؤول حالي" : "With current responsible contact", value: alertSupervision?.summary.activeWithResponsible },
            { label: language === "fr" ? "Sans réponse enregistrée" : language === "ar" ? "دون استجابة مسجلة" : "Without recorded response", value: alertSupervision?.summary.activeWithoutResponse },
          ].map((metric) => <article key={metric.label} className="rounded-2xl border border-emerald-900/10 bg-white/90 p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">{metric.label}</p><p className="mt-2 text-2xl font-black tabular-nums text-emerald-950">{metric.value === undefined ? "—" : metric.value.toLocaleString(language)}</p></article>)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm">
            <h2 className="font-extrabold">{language === "fr" ? "Alertes actives par niveau" : language === "ar" ? "التنبيهات النشطة حسب المستوى" : "Active alerts by level"}</h2>
            <div className="mt-4 space-y-3">{["critical", "urgent", "preventive"].map((level) => {
              const total = alertSupervision?.byLevel.find((item) => item.level === level)?.total ?? 0;
              const label = language === "fr" ? ({ critical: "Critique", urgent: "Urgente", preventive: "Préventive" }[level]) : language === "ar" ? ({ critical: "حرجة", urgent: "عاجلة", preventive: "وقائية" }[level]) : ({ critical: "Critical", urgent: "Urgent", preventive: "Preventive" }[level]);
              return <div key={level} className="flex items-center justify-between gap-3 border-b border-emerald-900/10 pb-2 text-sm"><span>{label}</span><strong className="tabular-nums">{alertSupervision ? total.toLocaleString(language) : "—"}</strong></div>;
            })}</div>
          </article>
          <article className="rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm">
            <h2 className="font-extrabold">{language === "fr" ? "Alertes actives par catégorie" : language === "ar" ? "التنبيهات النشطة حسب الفئة" : "Active alerts by category"}</h2>
            <div className="mt-4 space-y-3">{["personal_danger", "accident", "home_intrusion", "medical_emergency", "lost_or_disoriented_person", "custom_alert"].map((category) => {
              const total = alertSupervision?.byCategory.find((item) => item.category === category)?.total ?? 0;
              const labelsFr: Record<string, string> = { personal_danger: "Danger personnel", accident: "Accident", home_intrusion: "Intrusion au domicile", medical_emergency: "Urgence médicale", lost_or_disoriented_person: "Personne perdue ou désorientée", custom_alert: "Autre alerte" };
              const labelsEn: Record<string, string> = { personal_danger: "Personal danger", accident: "Accident", home_intrusion: "Home intrusion", medical_emergency: "Medical emergency", lost_or_disoriented_person: "Lost or disoriented person", custom_alert: "Other alert" };
              const labelsAr: Record<string, string> = { personal_danger: "خطر شخصي", accident: "حادث", home_intrusion: "اقتحام المنزل", medical_emergency: "حالة طبية طارئة", lost_or_disoriented_person: "شخص تائه أو مشوش", custom_alert: "تنبيه آخر" };
              return <div key={category} className="flex items-center justify-between gap-3 border-b border-emerald-900/10 pb-2 text-sm"><span>{(language === "fr" ? labelsFr : language === "ar" ? labelsAr : labelsEn)[category]}</span><strong className="tabular-nums">{alertSupervision ? total.toLocaleString(language) : "—"}</strong></div>;
            })}</div>
          </article>
        </div>
        <p className="rounded-xl border border-emerald-900/10 bg-emerald-50/70 p-4 text-xs leading-6 text-emerald-950">{language === "fr" ? "Vue agrégée réservée au Super Admin. Aucun nom, message privé, identifiant de citoyen, destinataire ni emplacement GPS n’est affiché. « Avec une réponse » signifie qu’un événement d’accusé de réception ou de volontariat a été enregistré ; cela ne signifie pas nécessairement qu’une prise en charge est toujours en cours." : language === "ar" ? "عرض إجمالي مخصص للمسؤول الأعلى. لا تظهر أسماء أو رسائل خاصة أو معرّفات المواطنين أو المستلمون أو مواقع GPS. تعني «مع استجابة» تسجيل إقرار بالاستلام أو تطوع، ولا تعني بالضرورة أن المساعدة لا تزال جارية." : "Aggregate view for the Super Admin only. No names, private messages, citizen IDs, recipients or GPS locations are displayed. “With a response” means an acknowledgement or volunteer event was recorded; it does not necessarily mean assistance is still ongoing."}</p>
        {!alertSupervision && <p className="text-sm text-slate-500">{language === "fr" ? "Données de supervision indisponibles pour le moment." : language === "ar" ? "بيانات المراقبة غير متاحة حالياً." : "Supervision data is currently unavailable."}</p>}
      </section>}
      {activeSection === "support" && <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: language === "fr" ? "Nouveaux tickets" : language === "ar" ? "تذاكر جديدة" : "New tickets", value: supportInbox?.counts.new },
            { label: language === "fr" ? "Tickets ouverts" : language === "ar" ? "تذاكر مفتوحة" : "Open tickets", value: supportInbox?.counts.open },
            { label: language === "fr" ? "En attente" : language === "ar" ? "قيد الانتظار" : "Waiting", value: supportInbox?.counts.waiting },
            { label: language === "fr" ? "Résolus" : language === "ar" ? "تم حلها" : "Resolved", value: supportInbox?.counts.resolved },
          ].map((item) => <article key={item.label} className="rounded-2xl border border-emerald-900/10 bg-white/85 p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-black tabular-nums text-emerald-950">{item.value === undefined ? "—" : item.value.toLocaleString(language)}</p></article>)}
        </div>
        <article className="rounded-3xl border border-emerald-900/10 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">{language === "fr" ? "Demandes d’assistance" : language === "ar" ? "طلبات المساعدة" : "Support requests"}</h2><p className="mt-1 text-xs text-slate-500">{language === "fr" ? "100 demandes au maximum · triées par priorité et activité" : language === "ar" ? "حتى 100 طلب · مرتبة حسب الأولوية والنشاط" : "Up to 100 requests · sorted by priority and activity"}</p></div><button type="button" onClick={() => void refreshSuperAdmin().catch(() => setError("unavailable"))} className="rounded-xl border border-emerald-900/15 px-3 py-2 text-xs font-bold">{language === "fr" ? "Actualiser" : language === "ar" ? "تحديث" : "Refresh"}</button></div>
          {!supportInbox ? <p className="mt-5 text-sm text-slate-500">{language === "fr" ? "Données d’assistance indisponibles." : language === "ar" ? "بيانات المساعدة غير متاحة." : "Support data unavailable."}</p> : supportInbox.tickets.length === 0 ? <p className="mt-5 rounded-xl bg-emerald-50/70 p-5 text-sm text-slate-600">{language === "fr" ? "Aucune demande enregistrée pour le moment." : language === "ar" ? "لا توجد طلبات مسجلة حالياً." : "No support requests have been recorded yet."}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-emerald-900/10 text-xs text-slate-500"><th className="p-3">{language === "fr" ? "Référence" : language === "ar" ? "المرجع" : "Reference"}</th><th className="p-3">{language === "fr" ? "Sujet" : language === "ar" ? "الموضوع" : "Subject"}</th><th className="p-3">{language === "fr" ? "Catégorie" : language === "ar" ? "الفئة" : "Category"}</th><th className="p-3">{language === "fr" ? "Demandeur" : language === "ar" ? "مقدم الطلب" : "Requester"}</th><th className="p-3">{language === "fr" ? "État" : language === "ar" ? "الحالة" : "Status"}</th></tr></thead><tbody>{supportInbox.tickets.map((ticket) => <tr key={ticket.id} className="border-b border-emerald-900/10"><td className="p-3 font-mono text-xs"><button type="button" onClick={() => void loadSupportTicket(ticket.id).catch(() => setError("unavailable"))} className="font-bold text-emerald-800 underline underline-offset-4">{ticket.public_reference}</button></td><td className="p-3 font-semibold">{ticket.subject}</td><td className="p-3">{ticket.category}</td><td className="p-3">{ticket.requester_email}</td><td className="p-3">{ticket.status}</td></tr>)}</tbody></table></div>}
        </article>
        {supportTicketDetail && <article className="rounded-3xl border border-emerald-900/10 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-emerald-800">{supportTicketDetail.ticket.public_reference}</p><h3 className="mt-1 text-lg font-extrabold">{supportTicketDetail.ticket.subject}</h3><p className="mt-1 text-xs text-slate-500">{supportTicketDetail.ticket.requester_email} · {supportTicketDetail.ticket.category}</p></div><button type="button" onClick={() => setSupportTicketDetail(null)} className="rounded-xl border px-3 py-2 text-xs font-bold">{language === "fr" ? "Fermer" : language === "ar" ? "إغلاق" : "Close"}</button></div>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 whitespace-pre-wrap">{supportTicketDetail.ticket.description}</div>
          <div className="mt-4 flex flex-wrap gap-2">{(["open","waiting_requester","waiting_internal","resolved","closed"] as const).map(status => <button key={status} type="button" disabled={busy || supportTicketDetail.ticket.status === "closed" || supportTicketDetail.ticket.status === status} onClick={() => void updateSupportStatus(status)} className="rounded-xl border border-emerald-900/15 px-3 py-2 text-xs font-bold disabled:opacity-40">{status}</button>)}</div>
          <h4 className="mt-5 font-extrabold">{language === "fr" ? "Échanges" : language === "ar" ? "المحادثة" : "Conversation"}</h4>
          <div className="mt-3 space-y-2">{supportTicketDetail.messages.length === 0 ? <p className="text-sm text-slate-500">{language === "fr" ? "Aucun message complémentaire." : language === "ar" ? "لا توجد رسائل إضافية." : "No additional messages."}</p> : supportTicketDetail.messages.map(message => <div key={message.id} className="rounded-xl bg-emerald-50/60 p-3"><p className="text-[11px] font-extrabold uppercase text-emerald-900">{message.author_kind === "support" ? "SAC · Support" : language === "fr" ? "Demandeur" : language === "ar" ? "مقدم الطلب" : "Requester"} · {new Date(message.created_at).toLocaleString(language)}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p></div>)}</div>
          {supportTicketDetail.ticket.status !== "closed" && <div className="mt-4 space-y-2"><textarea value={supportReply} onChange={event => setSupportReply(event.target.value)} maxLength={5000} rows={3} placeholder={language === "fr" ? "Écrire une réponse…" : language === "ar" ? "اكتب رداً..." : "Write a reply…"} className="w-full rounded-xl border border-emerald-900/15 p-3 text-sm" /><button type="button" disabled={busy || !supportReply.trim()} onClick={() => void sendSupportReply()} className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{language === "fr" ? "Envoyer la réponse" : language === "ar" ? "إرسال الرد" : "Send reply"}</button></div>}
        </article>}
        <p className="rounded-xl border border-emerald-900/10 bg-emerald-50/70 p-4 text-xs leading-6 text-emerald-950">{language === "fr" ? "Les tickets sont séparés des alertes SOS. Le premier parcours exige une session de compte active ; la récupération sans connexion fera l’objet d’un flux OTP dédié. Les pièces jointes et les exports ne sont pas activés." : language === "ar" ? "التذاكر منفصلة عن تنبيهات SOS. يتطلب المسار الأول جلسة حساب نشطة؛ وسيُنفذ استرداد الحساب دون تسجيل الدخول عبر OTP منفصل. المرفقات والتصدير غير مفعلين." : "Tickets are separate from SOS alerts. The first intake flow requires an active account session; no-login account recovery will use a dedicated OTP flow. Attachments and exports are not enabled."}</p>
      </section>}
      {activeSection === "security" && <section className="mt-8 rounded-3xl border border-white/90 bg-white/75 p-6 shadow-glass">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-extrabold">{t.audit}</h2><a href="/api/admin/audit/export" className="inline-flex min-h-10 items-center rounded-xl border border-sac-primary-strong/20 bg-white px-4 text-xs font-extrabold text-sac-ink hover:bg-sac-primary/10">{language === "fr" ? "Exporter le journal CSV" : language === "en" ? "Export audit CSV" : "تصدير سجل التدقيق CSV"}</a></div>
        {auditEvents.length === 0 ? <p className="mt-4 text-sm text-sac-muted">{t.emptyAudit}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm">
          <thead><tr className="border-b border-sac-primary-strong/15 text-xs text-sac-muted"><th className="p-3">{t.actor}</th><th className="p-3">{t.action}</th><th className="p-3">{t.scope}</th><th className="p-3">{t.result}</th><th className="p-3">{t.due}</th></tr></thead>
          <tbody>{auditEvents.map((event) => <tr key={event.id} className="border-b border-sac-primary-strong/10"><td className="p-3">{event.actor_email ?? "—"}</td><td className="p-3">{event.action}</td><td className="p-3">{event.scope_key ?? "—"}</td><td className="p-3">{event.outcome}</td><td className="p-3">{new Date(event.occurred_at).toLocaleString(language)}</td></tr>)}</tbody>
        </table></div>}
      </section>}
      {![ "overview", "team", "security" ].includes(activeSection) && <section className="rounded-3xl border border-emerald-900/10 bg-white p-6 shadow-sm"><div className="flex items-start gap-3"><span className="rounded-xl bg-amber-50 px-3 py-2 text-xl text-amber-700">◷</span><div><h2 className="text-lg font-extrabold">{language === "fr" ? "Module à développer" : language === "ar" ? "وحدة قيد التطوير" : "Module to build"}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{language === "fr" ? "Cette rubrique est intégrée à la navigation. Ses fonctions métier, ses données et ses autorisations serveur seront développées et testées avant son activation. Aucune donnée fictive n’est affichée." : language === "ar" ? "تمت إضافة هذا القسم إلى التنقل. سيتم تطوير وظائفه وبياناته وصلاحيات الخادم واختبارها قبل تفعيله. لا يتم عرض بيانات وهمية." : "This section is part of the navigation. Its business functions, data and server permissions will be built and tested before activation. No fictional data is displayed."}</p><p className="mt-3 text-xs font-bold text-amber-800">{language === "fr" ? "État : structure présente, module non opérationnel" : language === "ar" ? "الحالة: الهيكل موجود، الوحدة غير مفعلة" : "Status: structure present, module not operational"}</p></div></div></section>}
      </div>
    </div>
  </main>;
}
