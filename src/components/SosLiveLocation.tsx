import { useEffect, useState } from "react";
import { LocateFixed, ShieldCheck } from "lucide-react";
import {
  SosLocationRelayClient,
  type SosLocationRelayError,
  type SosLocationRelayStatus,
} from "../services/location/sos-location-relay";
import { fillCopy, localeFor, type Language, type PrivateCopy } from "../i18n/translations";
import type { EphemeralPreciseLocation } from "../services/location/live-geolocation";

type Props = {
  alertId: string;
  accountId: string;
  deviceId: string;
  participantRole: "author" | "recipient";
  copy: PrivateCopy;
  language: Language;
};

export default function SosLiveLocation({ alertId, accountId, deviceId, participantRole, copy, language }: Props) {
  const [status, setStatus] = useState<SosLocationRelayStatus>("connecting");
  const [error, setError] = useState<SosLocationRelayError | null>(null);
  const [location, setLocation] = useState<EphemeralPreciseLocation | null>(null);

  useEffect(() => {
    let mounted = true;
    const client = new SosLocationRelayClient({
      alertId,
      accountId,
      deviceId,
      role: participantRole,
      callbacks: {
        onStatus: (value) => { if (mounted) setStatus(value); },
        onLocation: (value) => { if (mounted) setLocation(value); },
        onClear: () => { if (mounted) setLocation(null); },
        onError: (value) => { if (mounted) setError(value); },
      },
    });
    void client.start();
    return () => {
      mounted = false;
      client.stop();
    };
  }, [alertId, accountId, deviceId, participantRole]);

  return (
    <section className="mt-4 rounded-xl border border-sac-primary-strong/15 bg-white/75 p-3" aria-label={copy.gpsAria}>
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-sac-confirm/15 p-2 text-sac-confirm"><LocateFixed size={17}/></div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-extrabold">{copy.gpsTitle}</h4>
          <p className="mt-0.5 text-xs text-sac-muted">{copy[("gps_" + status) as keyof PrivateCopy]}</p>
        </div>
        <ShieldCheck size={17} className="shrink-0 text-sac-confirm"/>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-sac-alert/5 p-2.5 text-xs leading-5 text-sac-alert">{copy[("gpserr_" + error) as keyof PrivateCopy]}</p>}
      {location && participantRole === "recipient" && (
        <div className="mt-3 rounded-lg bg-sac-confirm/10 p-3">
          <p className="text-xs font-bold uppercase text-sac-muted">{copy.gpsLast}</p>
          <p className="mt-1 break-all font-mono text-sm font-bold">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
          <p className="mt-1 text-xs text-sac-muted">{fillCopy(copy.gpsAccuracy, { m: Math.round(location.accuracy) })} · {new Date(location.capturedAt).toLocaleTimeString(localeFor(language))}</p>
        </div>
      )}
      <p className="mt-3 text-[11px] leading-4 text-sac-muted">
        {copy.gpsFootnote}
      </p>
    </section>
  );
}
