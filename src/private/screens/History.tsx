import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { fillCopy, localeFor } from "../../i18n/translations";
import type { ScreenProps, SosAlert } from "../types";
import { formatDate } from "../types";
import { Card, Halo, LevelBadge, Notice, Sheet, StatusBadge } from "../ui";

export default function HistoryScreen({ copy, language, go, alerts, loading, error }: ScreenProps & { alerts: SosAlert[]; loading: boolean; error: string }) {
  const [filter, setFilter] = useState<"all" | "author" | "recipient">("all");
  const locale = localeFor(language);
  const rows = alerts.filter((a) => filter === "all" || a.participantRole === filter);
  const tabs: [typeof filter, string][] = [["all", copy.historyAll], ["author", copy.historyMine], ["recipient", copy.historyReceived]];
  const reason = (r: string | null) => r === "completed" ? copy.closureCompleted : r === "cancelled" ? copy.closureCancelled : "";
  return (
    <>
      <Halo title={copy.historyTitle} eyebrow={copy.privateSpace} />
      <Sheet>
        {error && <Notice kind="error">{error}</Notice>}
        <div className="grid grid-cols-3 gap-1 rounded-[16px] bg-sac-sand p-1" role="group">{tabs.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={"min-h-12 rounded-[12px] text-sm font-bold " + (filter === key ? "bg-white text-sac-ink shadow-card" : "text-sac-muted")}>{label}</button>))}</div>
        {loading ? <p className="py-6 text-center text-sm text-sac-muted">{copy.loading}</p> : rows.length === 0 ? <p className="py-6 text-center text-sm text-sac-muted">{copy.historyEmpty}</p> : (
          <ul className="flex flex-col gap-3">{rows.map((a) => (
            <li key={a.id}><Card><button type="button" onClick={() => go({ name: "alert", id: a.id })} className="flex w-full items-start justify-between gap-3 text-start">
              <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><LevelBadge level={a.level} label={String(copy[("level_" + a.level) as keyof typeof copy] ?? a.level)} /><StatusBadge active={a.status === "active"} label={a.status === "active" ? copy.alertStatusActive : copy.alertStatusClosed} /></span>
                <span className="mt-2 block font-extrabold">{String(copy[("cat_" + a.category) as keyof typeof copy] ?? a.category.replaceAll("_", " "))}</span>
                <span className="block text-xs text-sac-muted">{a.participantRole === "author" ? copy.alertRoleAuthor : copy.alertRoleRecipient} · <span className="tnum">{formatDate(a.createdAt, language, locale)}</span></span>
                {a.closedAt && <span className="block text-xs text-sac-muted">{fillCopy(copy.historyClosedWhy, { r: reason(a.closureReason) })}</span>}</span>
              <ChevronRight size={18} className="mt-1 shrink-0 text-sac-muted rtl:rotate-180" aria-label={copy.historyOpen} /></button></Card></li>))}</ul>)}
      </Sheet>
    </>
  );
}
