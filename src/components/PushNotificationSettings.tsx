import { useEffect, useState } from "react";
import { Bell, BellOff, ShieldCheck } from "lucide-react";
import { disablePushNotifications, enablePushNotifications, getPushSetupState, type PushSetupState } from "../services/notifications/push-subscription";

export default function PushNotificationSettings() {
  const [state, setState] = useState<PushSetupState>("not_subscribed");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setState(await getPushSetupState());
  }

  useEffect(() => { void refresh(); }, []);

  async function enable() {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await enablePushNotifications();
      await refresh();
      setMessage("Cet appareil est enregistré pour recevoir les alertes privées SAC.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’activer les notifications.");
      await refresh();
    } finally { setBusy(false); }
  }

  async function disable() {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await disablePushNotifications();
      await refresh();
      setMessage("Les notifications SAC sont désactivées sur cet appareil.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de désactiver les notifications.");
    } finally { setBusy(false); }
  }

  return (
    <section className="mt-8 rounded-2xl border border-white/90 bg-white/55 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-sac-confirm/15 p-3 text-sac-confirm"><Bell size={21}/></div>
        <div className="min-w-0 flex-1">
          <h2 className="font-extrabold">Notifications sur cet appareil</h2>
          <p className="mt-1 text-xs leading-5 text-sac-muted">Recevoir les alertes privées envoyées par vos proches, même lorsque SAC n’est pas ouvert.</p>
        </div>
      </div>
      {state === "subscribed" ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-sac-confirm"><ShieldCheck size={17}/>Appareil enregistré</p>
          <button type="button" onClick={() => void disable()} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sac-alert/25 bg-white/70 px-4 text-sm font-bold text-sac-alert disabled:opacity-50"><BellOff size={16}/>{busy ? "Patientez…" : "Désactiver"}</button>
        </div>
      ) : state === "not_configured" ? (
        <p className="mt-4 rounded-xl bg-white/70 p-3 text-sm leading-6 text-sac-muted">Le service de livraison Push doit encore être configuré côté serveur. L’activation sera disponible ensuite.</p>
      ) : state === "unsupported" ? (
        <p className="mt-4 rounded-xl bg-white/70 p-3 text-sm leading-6 text-sac-muted">Ce navigateur ne prend pas en charge les notifications Push nécessaires à SAC.</p>
      ) : state === "permission_denied" ? (
        <p className="mt-4 rounded-xl bg-white/70 p-3 text-sm leading-6 text-sac-muted">Les notifications sont bloquées dans les réglages du navigateur. Autorisez-les pour SAC depuis les paramètres du navigateur.</p>
      ) : (
        <button type="button" onClick={() => void enable()} disabled={busy} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-sac-primary-strong px-4 font-extrabold text-white disabled:opacity-50"><Bell size={17}/>{busy ? "Activation…" : "Activer les notifications"}</button>
      )}
      {message && <p role="status" className="mt-3 text-sm text-sac-confirm">{message}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-sac-alert">{error}</p>}
    </section>
  );
}
