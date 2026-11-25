import { useEffect } from "react";
import PrivateSosAlertPanel from "../../components/PrivateSosAlertPanel";
import type { ScreenProps, SosAlert } from "../types";
import { Card, Halo, Sheet, StatusBadge, primaryBtn } from "../ui";

export default function AlertScreen({ copy, language, go, notice, id, alerts, loading, refresh, identity }: ScreenProps & { id: string; identity: { accountId: string; deviceId: string } | null; alerts: SosAlert[]; loading: boolean; refresh: () => Promise<void> }) {
  const alert = alerts.find((a) => a.id === id);
  const back = () => go({ name: "history" });

  // A participant's already-open screen must not keep displaying an alert
  // after the server has revoked their relationship.
  useEffect(() => {
    if (!alert || alert.participantRole !== "recipient" || alert.status !== "active") return;
    const revalidate = async () => {
      try {
        const response = await fetch("/api/alerts/" + encodeURIComponent(id), {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (response.status === 404) await refresh();
      } catch {
        // A transient network error must not falsely revoke access locally.
      }
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void revalidate();
    }, 5_000);
    const onFocus = () => { if (document.visibilityState === "visible") void revalidate(); };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [alert?.id, alert?.participantRole, alert?.status, id, refresh]);
  if (!alert) {
    return (<><Halo title={copy.alertReceivedTitle} onBack={back} backLabel={copy.back} /><Sheet>
      {loading ? <p className="py-6 text-center text-sm text-sac-muted">{copy.loading}</p> : <Card className="text-center"><p className="font-bold">{copy.alertNotFound}</p><button type="button" onClick={back} className={"mt-3 " + primaryBtn}>{copy.navHistory}</button></Card>}
    </Sheet></>);
  }
  const recipient = alert.participantRole === "recipient";
  return (
    <>
      <Halo title={recipient ? copy.alertReceivedTitle : copy.alertOwnTitle} eyebrow={recipient ? copy.alertRoleRecipient : copy.alertRoleAuthor} tone={recipient && alert.status === "active" ? "alert" : "orange"} onBack={back} backLabel={copy.back}>
        <div className="mt-3"><span className="inline-flex rounded-full bg-white px-1 py-0.5"><StatusBadge active={alert.status === "active"} label={alert.status === "active" ? copy.alertStatusActive : copy.alertStatusClosed} /></span></div>
      </Halo>
      <Sheet>
        {notice && <p role="status" className="rounded-2xl border border-sac-confirm/25 bg-sac-confirm/10 p-3 text-sm font-semibold leading-6">{notice}</p>}
        {alert.description && <Card><p className="text-sm">{alert.description}</p></Card>}
        {identity && <PrivateSosAlertPanel key={alert.id} alertId={alert.id} accountId={identity.accountId} deviceId={identity.deviceId} participantRole={alert.participantRole} status={alert.status} copy={copy} language={language} onUpdated={() => void refresh()} />}
      </Sheet>
    </>
  );
}
