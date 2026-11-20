import { useEffect, useState } from "react";
import { LocateFixed, ShieldCheck } from "lucide-react";
import {
  SosLocationRelayClient,
  type SosLocationRelayError,
  type SosLocationRelayStatus,
} from "../services/location/sos-location-relay";
import type { EphemeralPreciseLocation } from "../services/location/live-geolocation";

type Props = {
  alertId: string;
  accountId: string;
  deviceId: string;
  participantRole: "author" | "recipient";
};

const statusLabels: Record<SosLocationRelayStatus, string> = {
  connecting: "Connexion sécurisée en cours…",
  waiting_for_author: "En attente de la connexion sécurisée de l'auteur…",
  waiting_for_trusted_devices: "En attente d'un appareil de proche vérifié…",
  receiving: "Réception d'une position chiffrée en direct.",
  sharing: "Partage chiffré en direct avec les appareils vérifiés.",
  closed: "Partage GPS arrêté ou indisponible.",
};

const errorLabels: Record<SosLocationRelayError, string> = {
  gps_relay_not_ready: "Le service GPS chiffré n'est pas encore activé sur SAC.",
  authentication_required: "Votre session doit être renouvelée avant le partage GPS.",
  contact_key_unverified: "Un appareil du cercle n'est pas vérifié. Aucune position ne lui est transmise.",
  gps_permission_denied: "L'autorisation de localisation a été refusée sur cet appareil.",
  gps_unavailable: "La position GPS est momentanément indisponible.",
  relay_disconnected: "La connexion GPS sécurisée a été interrompue.",
  invalid_location_packet: "Une position chiffrée invalide a été écartée.",
};

export default function SosLiveLocation({ alertId, accountId, deviceId, participantRole }: Props) {
  const [status, setStatus] = useState<SosLocationRelayStatus>("connecting");
  const [error, setError] = useState<SosLocationRelayError | null>(null);
  const [location, setLocation] = useState<EphemeralPreciseLocation | null>(null);

  useEffect(() => {
    const client = new SosLocationRelayClient({
      alertId,
      accountId,
      deviceId,
      role: participantRole,
      callbacks: {
        onStatus: setStatus,
        onLocation: setLocation,
        onClear: () => setLocation(null),
        onError: setError,
      },
    });
    void client.start();
    return () => {
      client.stop();
      setLocation(null);
    };
  }, [alertId, accountId, deviceId, participantRole]);

  return (
    <section className="mt-4 rounded-xl border border-sac-primary-strong/15 bg-white/75 p-3" aria-label="Partage GPS sécurisé">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-sac-confirm/15 p-2 text-sac-confirm"><LocateFixed size={17}/></div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-extrabold">Localisation SOS</h4>
          <p className="mt-0.5 text-xs text-sac-muted">{statusLabels[status]}</p>
        </div>
        <ShieldCheck size={17} className="shrink-0 text-sac-confirm"/>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-sac-alert/5 p-2.5 text-xs leading-5 text-sac-alert">{errorLabels[error]}</p>}
      {location && participantRole === "recipient" && (
        <div className="mt-3 rounded-lg bg-sac-confirm/10 p-3">
          <p className="text-xs font-bold text-sac-muted">DERNIÈRE POSITION REÇUE · NON ARCHIVÉE</p>
          <p className="mt-1 break-all font-mono text-sm font-bold">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
          <p className="mt-1 text-xs text-sac-muted">Précision annoncée : ±{Math.round(location.accuracy)} m · {new Date(location.capturedAt).toLocaleTimeString()}</p>
        </div>
      )}
      <p className="mt-3 text-[11px] leading-4 text-sac-muted">
        Les coordonnées sont chiffrées entre appareils vérifiés. Elles ne sont pas conservées dans l'historique et sont effacées à la clôture de l'alerte.
      </p>
    </section>
  );
}
