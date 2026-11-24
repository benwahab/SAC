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
    const [missionResponse, auditResponse] = await Promise.all([
      fetch("/api/admin/missions", { credentials: "same-origin", cache: "no-store" }),
      fetch("/api/admin/audit?limit=50", { credentials: "same-origin", cache: "no-store" }),
    ]);
    if (!missionResponse.ok || !auditResponse.ok) throw new Error(missionResponse.status === 401 || missionResponse.status === 403 ? "denied" : "unavailable");
    const [missionPayload, auditPayload] = await Promise.all([
      missionResponse.json() as Promise<{ missions: Mission[] }>,
      auditResponse.json() as Promise<{ events: AuditEvent[] }>,
    ]);
    setMissions(missionPayload.missions);
    setAuditEvents(auditPayload.events);
    setAccessDenied(false);
  }, []);

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

  if (access?.role === "delegate") return <main className="min-h-screen bg-sac-primary/15 px-5 py-8 text-sac-ink sm:px-8" dir={language === "ar" ? "rtl" : "ltr"}>
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div><BrandLogo className="h-8 w-auto" /><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black">{t.delegateTitle}</h1><span className="rounded-full bg-sac-primary/15 px-3 py-1 text-xs font-black text-sac-primary-strong">{t.roleDelegate}</span></div><p className="mt-1 text-sm text-sac-muted">{t.delegateSubtitle}</p></div>
        <a href="/" className="rounded-xl border border-white bg-white/70 px-4 py-3 text-sm font-bold">{t.back}</a>
      </header>
      {activeSection === "overview" && summary}
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
      {activeSection === "team" && <section className="rounded-3xl border border-white/90 bg-white/75 p-6 shadow-glass backdrop-blur-xl">
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
      </section>}
      {activeSection === "users" && <section className="rounded-3xl border border-emerald-900/10 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold">{sectionLabel(consoleSections[1])}</h2><p className="mt-1 text-sm text-slate-600">{language === "fr" ? "Répertoire en lecture seule des comptes actifs disposant d’une adresse e-mail principale vérifiée." : language === "ar" ? "دليل للقراءة فقط للحسابات النشطة التي لديها بريد إلكتروني أساسي تم التحقق منه." : "Read-only directory of active accounts with a verified primary email address."}</p></div><span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">{accounts.length} / 25</span></div>
        <label className="mt-5 block text-sm font-bold">{language === "fr" ? "Rechercher un compte" : language === "ar" ? "البحث عن حساب" : "Search accounts"}
          <input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} placeholder="nom@exemple.com" className="mt-2 min-h-11 w-full rounded-xl border border-emerald-900/15 bg-white px-3 font-normal" />
        </label>
        {accounts.length === 0 ? <p className="mt-5 rounded-xl bg-emerald-50/70 p-5 text-sm text-slate-600">{language === "fr" ? "Aucun compte actif correspondant. Saisis une adresse ou une partie d’adresse e-mail." : language === "ar" ? "لا يوجد حساب نشط مطابق. أدخل عنوان البريد الإلكتروني أو جزءاً منه." : "No matching active account. Enter an email address or part of one."}</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead><tr className="border-b border-emerald-900/10 text-xs text-slate-500"><th className="p-3">{language === "fr" ? "Identifiant du compte" : language === "ar" ? "معرّف الحساب" : "Account ID"}</th><th className="p-3">E-mail vérifié</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id} className="border-b border-emerald-900/10"><td className="p-3 font-mono text-xs">{account.id}</td><td className="p-3">{account.email}</td></tr>)}</tbody></table></div>}
        <p className="mt-4 text-xs text-slate-500">{language === "fr" ? "Limite de 25 résultats. Cet écran ne modifie pas les comptes et n’expose aucune donnée privée supplémentaire." : language === "ar" ? "الحد الأقصى 25 نتيجة. لا تعدّل هذه الشاشة الحسابات ولا تكشف بيانات خاصة إضافية." : "Limited to 25 results. This screen does not modify accounts or expose additional private data."}</p>
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
