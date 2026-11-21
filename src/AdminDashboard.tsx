import { useCallback, useEffect, useState, type FormEvent } from "react";

type Permission = "read" | "create" | "update" | "process" | "export" | "delete";
type Account = { id: string; email: string };
type AuditEvent = { id: string; actor_email: string | null; action: string; scope_key: string | null; permission_used: string | null; outcome: string; occurred_at: number };
type Mission = {
  id: string; assignedAccountId: string; assignedEmail?: string | null; scopeKey: string; status: "active" | "suspended" | "revoked";
  dueAt: number | null; createdAt: number; updatedAt: number; version: number; permissions: Permission[];
};
const PERMISSIONS: { value: Permission; fr: string; en: string; ar: string }[] = [
  { value: "read", fr: "Consulter", en: "Read", ar: "قراءة" },
  { value: "create", fr: "Créer", en: "Create", ar: "إنشاء" },
  { value: "update", fr: "Modifier", en: "Update", ar: "تعديل" },
  { value: "process", fr: "Traiter", en: "Process", ar: "معالجة" },
  { value: "export", fr: "Exporter", en: "Export", ar: "تصدير" },
  { value: "delete", fr: "Supprimer", en: "Delete", ar: "حذف" },
];

export default function AdminDashboard({ language = "fr" }: { language?: "fr" | "en" | "ar" }) {
  const [allowedDevice, setAllowedDevice] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState("");
  const [accountId, setAccountId] = useState("");
  const [scopeKey, setScopeKey] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>(["read"]);
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const t = {
    fr: { title: "Administration SAC", subtitle: "Missions et délégations", unavailable: "Accès réservé au Super Admin sur ordinateur ou tablette.", denied: "Accès refusé ou session expirée.", loading: "Chargement…", assignee: "Collaborateur (e-mail vérifié)", search: "Rechercher un e-mail", scope: "Périmètre précis", scopeHint: "Ex. : zone:niamey ou module:assistance", due: "Échéance (facultative)", create: "Attribuer la mission", missions: "Missions attribuées", empty: "Aucune mission pour le moment.", suspend: "Suspendre", resume: "Reprendre", revoke: "Révoquer", active: "Active", suspended: "Suspendue", revoked: "Révoquée", saved: "Mission enregistrée.", select: "Sélectionner un compte", back: "Retour à l’accueil", choose: "Choisissez au moins une permission.", audit: "Journal d’audit", actor: "Acteur", action: "Action", result: "Résultat" },
    en: { title: "SAC administration", subtitle: "Missions and delegations", unavailable: "Access is limited to the Super Admin on desktop or tablet.", denied: "Access denied or session expired.", loading: "Loading…", assignee: "Collaborator (verified email)", search: "Search email", scope: "Exact scope", scopeHint: "e.g. area:niamey or module:support", due: "Deadline (optional)", create: "Assign mission", missions: "Assigned missions", empty: "No missions yet.", suspend: "Suspend", resume: "Resume", revoke: "Revoke", active: "Active", suspended: "Suspended", revoked: "Revoked", saved: "Mission saved.", select: "Select an account", back: "Back to home", choose: "Choose at least one permission.", audit: "Audit log", actor: "Actor", action: "Action", result: "Outcome" },
    ar: { title: "إدارة SAC", subtitle: "المهام والتفويضات", unavailable: "الوصول مخصص للمسؤول الأعلى عبر الكمبيوتر أو الجهاز اللوحي.", denied: "تم رفض الوصول أو انتهت الجلسة.", loading: "جارٍ التحميل…", assignee: "المتعاون (بريد موثّق)", search: "ابحث عن البريد", scope: "النطاق المحدد", scopeHint: "مثال area:niamey أو module:support", due: "الموعد النهائي (اختياري)", create: "إسناد المهمة", missions: "المهام المسندة", empty: "لا توجد مهام حالياً.", suspend: "تعليق", resume: "استئناف", revoke: "إلغاء", active: "نشطة", suspended: "معلقة", revoked: "ملغاة", saved: "تم حفظ المهمة.", select: "اختر حساباً", back: "العودة للرئيسية", choose: "اختر صلاحية واحدة على الأقل.", audit: "سجل التدقيق", actor: "المنفذ", action: "الإجراء", result: "النتيجة" },
  }[language];

  const refresh = useCallback(async () => {
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
    void refresh().catch((reason: unknown) => setError(reason instanceof Error && reason.message === "denied" ? t.denied : t.loading));
  }, [allowedDevice, refresh, t.denied, t.loading]);

  useEffect(() => {
    if (!allowedDevice) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch("/api/admin/accounts?q=" + encodeURIComponent(query), { credentials: "same-origin", cache: "no-store", signal: controller.signal })
        .then(async (response) => response.ok ? response.json() as Promise<{ accounts: Account[] }> : { accounts: [] })
        .then((payload) => setAccounts(payload.accounts))
        .catch(() => undefined);
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [allowedDevice, query]);

  async function createMission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountId || !scopeKey.trim() || permissions.length === 0) { setError(t.choose); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/missions", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedAccountId: accountId, scopeKey: scopeKey.trim(), permissions, dueAt: dueAt ? Date.parse(dueAt) : null }),
      });
      if (!response.ok) throw new Error("save_failed");
      setAccountId(""); setScopeKey(""); setPermissions(["read"]); setDueAt("");
      setNotice(t.saved); await refresh();
    } catch {
      setError(t.denied);
    } finally { setBusy(false); }
  }

  async function manageMission(missionId: string, action: "suspend" | "resume" | "revoke") {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/missions/" + encodeURIComponent(missionId), {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error("action_failed");
      await refresh();
    } catch { setError(t.denied); }
    finally { setBusy(false); }
  }

  if (!allowedDevice) return <main className="min-h-screen bg-sac-primary/20 p-6 text-sac-ink"><section className="mx-auto mt-16 max-w-lg rounded-3xl border border-white/80 bg-white/75 p-8 text-center shadow-glass"><h1 className="text-2xl font-black">SAC</h1><p className="mt-4 text-sm leading-7">{t.unavailable}</p><a href="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-sac-primary-strong px-5 font-bold text-white">{t.back}</a></section></main>;

  return <main className="min-h-screen bg-sac-primary/15 px-5 py-8 text-sac-ink sm:px-8" dir={language === "ar" ? "rtl" : "ltr"}>
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[.2em] text-sac-primary-strong">SAC</p><h1 className="mt-2 text-3xl font-black">{t.title}</h1><p className="mt-1 text-sm text-sac-muted">{t.subtitle}</p></div>
        <a href="/" className="rounded-xl border border-white bg-white/70 px-4 py-3 text-sm font-bold">{t.back}</a>
      </header>
      {error && <p role="alert" className="mb-5 rounded-xl border border-sac-alert/30 bg-white/80 p-4 text-sm text-sac-alert">{error}</p>}
      {notice && <p role="status" className="mb-5 rounded-xl border border-sac-confirm/30 bg-white/80 p-4 text-sm">{notice}</p>}
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
          <fieldset className="rounded-2xl border border-sac-primary-strong/15 p-4 md:col-span-2"><legend className="px-2 text-sm font-bold">{language === "fr" ? "Permissions explicitement accordées" : language === "en" ? "Explicitly granted permissions" : "الصلاحيات الممنوحة صراحةً"}</legend><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{PERMISSIONS.map((item) => <label key={item.value} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={permissions.includes(item.value)} onChange={(event) => setPermissions((current) => event.target.checked ? [...current, item.value] : current.filter((value) => value !== item.value))} />{item[language]}</label>)}</div></fieldset>
          <label className="block text-sm font-bold">{t.due}<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-sac-primary-strong/20 bg-white px-3 font-normal" /></label>
          <div className="flex items-end"><button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-sac-primary-strong px-5 font-extrabold text-white disabled:opacity-50">{busy ? "…" : t.create}</button></div>
        </form>
      </section>
      <section className="mt-8">
        <h2 className="mb-4 text-xl font-extrabold">{t.missions}</h2>
        {missions.length === 0 ? <p className="rounded-2xl bg-white/70 p-6 text-sm text-sac-muted">{t.empty}</p> : <div className="grid gap-4 lg:grid-cols-2">{missions.map((mission) => <article key={mission.id} className="rounded-2xl border border-white/90 bg-white/80 p-5 shadow-glass">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="break-all text-xs text-sac-muted">{mission.assignedEmail ?? mission.assignedAccountId}</p><h3 className="mt-1 font-extrabold">{mission.scopeKey}</h3></div><span className="rounded-full bg-sac-primary/50 px-3 py-1 text-xs font-bold">{t[mission.status]}</span></div>
          <div className="mt-3 flex flex-wrap gap-2">{mission.permissions.map((permission) => <span key={permission} className="rounded-lg border border-sac-primary-strong/15 px-2 py-1 text-xs">{PERMISSIONS.find((item) => item.value === permission)?.[language]}</span>)}</div>
          {mission.dueAt && <p className="mt-3 text-xs text-sac-muted">{new Date(mission.dueAt).toLocaleString(language)}</p>}
          {mission.status !== "revoked" && <div className="mt-4 flex flex-wrap gap-2">{mission.status === "active" ? <button disabled={busy} onClick={() => void manageMission(mission.id, "suspend")} className="rounded-lg border px-3 py-2 text-xs font-bold">{t.suspend}</button> : <button disabled={busy} onClick={() => void manageMission(mission.id, "resume")} className="rounded-lg border px-3 py-2 text-xs font-bold">{t.resume}</button>}<button disabled={busy} onClick={() => void manageMission(mission.id, "revoke")} className="rounded-lg bg-sac-alert px-3 py-2 text-xs font-bold text-white">{t.revoke}</button></div>}
        </article>)}</div>}
      </section>
      <section className="mt-8 rounded-3xl border border-white/90 bg-white/75 p-6 shadow-glass">
        <h2 className="text-xl font-extrabold">{t.audit}</h2>
        {auditEvents.length === 0 ? <p className="mt-4 text-sm text-sac-muted">{t.empty}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm">
          <thead><tr className="border-b border-sac-primary-strong/15 text-xs text-sac-muted"><th className="p-3">{t.actor}</th><th className="p-3">{t.action}</th><th className="p-3">{t.scope}</th><th className="p-3">{t.result}</th><th className="p-3">{t.due}</th></tr></thead>
          <tbody>{auditEvents.map((event) => <tr key={event.id} className="border-b border-sac-primary-strong/10"><td className="p-3">{event.actor_email ?? "—"}</td><td className="p-3">{event.action}</td><td className="p-3">{event.scope_key ?? "—"}</td><td className="p-3">{event.outcome}</td><td className="p-3">{new Date(event.occurred_at).toLocaleString(language)}</td></tr>)}</tbody>
        </table></div>}
      </section>
    </div>
  </main>;
}
