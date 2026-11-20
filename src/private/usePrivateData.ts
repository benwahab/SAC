import { useCallback, useEffect, useState } from "react";
import { getDeviceSession } from "../services/device/root-enrollment";
import type { PrivateCopy } from "../i18n/translations";
import type { Contact, SosAlert } from "./types";

export function usePrivateData(copy: PrivateCopy, onLogout: () => void) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [identity, setIdentity] = useState<{ accountId: string; deviceId: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const session = await getDeviceSession();
      if (!session.authenticated || !session.accountId || !session.deviceId) { onLogout(); return; }
      setIdentity({ accountId: session.accountId, deviceId: session.deviceId });
      const response = await fetch("/api/contacts", { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json() as { contacts?: Contact[] };
      if (!response.ok || !Array.isArray(payload.contacts)) {
        if (response.status === 401) onLogout();
        throw new Error(copy.loadContactsError);
      }
      setContacts(payload.contacts);
      const alertsResponse = await fetch("/api/alerts", { credentials: "same-origin", cache: "no-store" });
      const alertsPayload = await alertsResponse.json() as { alerts?: SosAlert[] };
      if (alertsResponse.ok && Array.isArray(alertsPayload.alerts)) setAlerts(alertsPayload.alerts);
      else setError(copy.alertsLoadError);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.errorGeneric);
    } finally { setLoading(false); }
  }, [onLogout, copy]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { contacts, setContacts, alerts, loading, error, refresh, identity };
}
