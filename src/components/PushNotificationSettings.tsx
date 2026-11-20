import { useEffect, useState } from "react";
import { Bell, BellOff, ShieldCheck } from "lucide-react";
import type { PrivateCopy } from "../i18n/translations";
import { disablePushNotifications, enablePushNotifications, getPushSetupState, type PushSetupState } from "../services/notifications/push-subscription";
import { Card, Notice, primaryBtn } from "../private/ui";

export default function PushNotificationSettings({ copy }: { copy: PrivateCopy }) {
  const [state, setState] = useState<PushSetupState>("not_subscribed");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function refresh() { setState(await getPushSetupState()); }
  useEffect(() => { void refresh(); }, []);

  async function toggle(enable: boolean) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (enable) await enablePushNotifications(); else await disablePushNotifications();
      await refresh();
      setMessage(enable ? copy.pushEnabledMsg : copy.pushDisabledMsg);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : enable ? copy.pushErrEnable : copy.pushErrDisable);
      if (enable) await refresh();
    } finally { setBusy(false); }
  }
  const info = (text: string) => <p className="mt-3 rounded-[14px] bg-sac-sand p-3 text-sm leading-6 text-sac-muted">{text}</p>;
  return (
    <Card>
      <div className="flex items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sac-confirm/10 text-sac-confirm"><Bell size={21} /></span>
        <div className="min-w-0"><h2 className="font-extrabold">{copy.pushTitle}</h2><p className="mt-1 text-xs leading-5 text-sac-muted">{copy.pushIntro}</p></div></div>
      {state === "subscribed" ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm font-bold text-sac-confirm"><ShieldCheck size={17} />{copy.pushOn}</p>
          <button type="button" onClick={() => void toggle(false)} disabled={busy} className="inline-flex min-h-12 items-center gap-2 rounded-[14px] border border-sac-alert/30 bg-white px-4 text-sm font-bold text-sac-alert disabled:opacity-50"><BellOff size={16} />{busy ? copy.pushWait : copy.pushDisable}</button></div>
      ) : state === "not_configured" ? info(copy.pushNotConfigured)
        : state === "unsupported" ? info(copy.pushUnsupported)
        : state === "permission_denied" ? info(copy.pushDenied)
        : <button type="button" onClick={() => void toggle(true)} disabled={busy} className={"mt-3 " + primaryBtn}><Bell size={18} />{busy ? copy.pushEnabling : copy.pushEnable}</button>}
      {message && <div className="mt-3"><Notice kind="ok">{message}</Notice></div>}
      {error && <div className="mt-3"><Notice kind="error">{error}</Notice></div>}
    </Card>
  );
}
