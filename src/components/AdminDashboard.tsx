import { useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { Filter, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import type { Category } from "../types";

interface AdminReport {
  id: string;
  category: Category;
  urgency: "low" | "medium" | "high" | "critical";
  description: string;
  latitude: number | null;
  longitude: number | null;
  status: "received" | "in_progress" | "resolved";
  moderation_status: "pending" | "approved" | "rejected";
  createdAt: string;
}
interface ApiResult<T> { success: boolean; data: T | null; error: { message: string } | null; }
const categoryNames: Record<Category, string> = { danger: "Danger / sécurité", accident: "Accident", medical: "Urgence médicale", fire: "Incendie / sinistre", infrastructure: "Infrastructure / panne" };
const statusNames = { received: "Reçu", in_progress: "En cours", resolved: "Résolu" };
const urgencyNames = { low: "Faible", medium: "Modérée", high: "Élevée", critical: "Critique" };

export default function AdminDashboard() {
  const [token, setToken] = useState("");
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/reports", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const body = await response.json() as ApiResult<AdminReport[]>;
      if (!response.ok || !body.success || body.data === null) throw new Error(body.error?.message ?? "Accès refusé.");
      setReports(body.data); setAuthenticated(true);
    } catch (reason) {
      setAuthenticated(false); setReports([]);
      setError(reason instanceof Error ? reason.message : "Connexion impossible.");
    } finally { setLoading(false); }
  }

  async function updateReport(id: string, values: { status?: AdminReport["status"]; moderationStatus?: AdminReport["moderation_status"] }) {
    setError("");
    try {
      const response = await fetch("/api/admin/reports", { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ id, ...values }) });
      const body = await response.json() as ApiResult<unknown>;
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? "Mise à jour impossible.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Mise à jour impossible."); }
  }

  const filtered = useMemo(() => reports.filter((report) =>
    (statusFilter === "all" || report.status === statusFilter) &&
    (categoryFilter === "all" || report.category === categoryFilter)
  ), [reports, statusFilter, categoryFilter]);

  if (!authenticated) return <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <LockKeyhole size={32} className="text-sac-navy" />
    <h1 className="mt-3 text-2xl font-extrabold text-sac-navy">Espace professionnel</h1>
    <p className="mt-2 text-sm text-slate-600">Accès provisoire par jeton administrateur. Le système de comptes nominatifs et de rôles devra remplacer ce mécanisme avant toute exploitation réelle.</p>
    <label className="mt-5 block text-sm font-bold">Jeton d'accès<input type="password" autoComplete="current-password" className="field mt-2" value={token} onChange={(event) => setToken(event.target.value)} /></label>
    <button className="primary mt-3" disabled={loading || token.length < 20} onClick={load}>{loading ? "Vérification…" : "Accéder au tableau"}</button>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>;

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wide text-sac-green">Espace sécurisé</p><h1 className="mt-1 text-2xl font-extrabold text-sac-navy">Tableau des signalements</h1></div><div className="flex gap-2"><button className="secondary" onClick={load} disabled={loading}><RefreshCw size={16}/> Actualiser</button><button className="secondary" onClick={() => { setAuthenticated(false); setToken(""); setReports([]); }}>Déconnexion</button></div></div>
    <div className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2">
      <label className="text-sm font-semibold"><Filter size={15} className="mr-1 inline"/> Catégorie<select className="field mt-2" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Toutes</option>{Object.entries(categoryNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="text-sm font-semibold">Statut<select className="field mt-2" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tous</option>{Object.entries(statusNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    <div className="h-72 overflow-hidden rounded-2xl border bg-white"><MapContainer center={[13.5127,2.1128]} zoom={11} scrollWheelZoom className="h-full w-full"><TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{filtered.filter((item) => item.latitude !== null && item.longitude !== null).map((item) => <Marker key={item.id} position={[item.latitude as number,item.longitude as number]}><Popup><b>{categoryNames[item.category]}</b><br/>{statusNames[item.status]} · {urgencyNames[item.urgency]}</Popup></Marker>)}</MapContainer></div>
    <p className="text-sm text-slate-500">{filtered.length} signalement(s) correspondant aux filtres.</p>
    <div className="space-y-3">{filtered.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><b className="text-sac-navy">{categoryNames[item.category]}</b><p className="mt-1 text-sm text-slate-600">{item.description || "Aucune description"}</p><p className="mt-1 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString("fr-FR")} · Urgence {urgencyNames[item.urgency]}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{statusNames[item.status]}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Traitement<select className="field mt-1" value={item.status} onChange={(event) => updateReport(item.id,{status:event.target.value as AdminReport["status"]})}><option value="received">Reçu</option><option value="in_progress">En cours</option><option value="resolved">Résolu</option></select></label><label className="text-xs font-bold">Modération<select className="field mt-1" value={item.moderation_status} onChange={(event) => updateReport(item.id,{moderationStatus:event.target.value as AdminReport["moderation_status"]})}><option value="pending">En attente</option><option value="approved">Approuvé</option><option value="rejected">Rejeté</option></select></label></div></article>)}</div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><ShieldCheck size={16} className="shrink-0"/> Version de démarrage : accès par jeton partagé. Remplacer par des comptes agents nominatifs, rôles et journal d'audit avant mise en service.</p>
  </section>;
}