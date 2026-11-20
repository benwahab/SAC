import { useEffect, useState } from "react";
import { Copy, Fingerprint, ShieldCheck } from "lucide-react";
import {
  fingerprintLocationIdentityKey,
} from "../services/location/key-exchange";
import {
  getOrCreateLocationIdentityKeyPair,
  pinTrustedLocationFingerprint,
} from "../services/location/identity-vault";

type Contact = { accountId: string; email: string };
type Props = {
  accountId: string;
  deviceId: string;
  contacts: Contact[];
};

type ContactInput = { deviceId: string; fingerprint: string; confirmed: boolean };

const FINGERPRINT_PATTERN = /^(?:[0-9A-F]{4})(?: [0-9A-F]{4}){15}$/;

export default function LocationKeyVerification({ accountId, deviceId, contacts }: Props) {
  const [ownFingerprint, setOwnFingerprint] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyContact, setBusyContact] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, ContactInput>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const identity = await getOrCreateLocationIdentityKeyPair(accountId, deviceId);
        const fingerprint = await fingerprintLocationIdentityKey(identity.publicJwk);
        if (!cancelled) setOwnFingerprint(fingerprint);
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error
            ? reason.message
            : "Le coffre local de sécurité n'est pas disponible sur cet appareil.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accountId, deviceId]);

  function updateInput(contactId: string, patch: Partial<ContactInput>) {
    setInputs((current) => ({
      ...current,
      [contactId]: {
        deviceId: current[contactId]?.deviceId ?? "",
        fingerprint: current[contactId]?.fingerprint ?? "",
        confirmed: current[contactId]?.confirmed ?? false,
        ...patch,
      },
    }));
  }

  async function copyOwnFingerprint() {
    if (!ownFingerprint) return;
    try {
      await navigator.clipboard.writeText(ownFingerprint);
      setNotice("Votre empreinte a été copiée.");
      setError("");
    } catch {
      setError("Copie indisponible. Vous pouvez sélectionner et copier le code affiché.");
    }
  }

  async function saveContactFingerprint(contact: Contact) {
    const value = inputs[contact.accountId];
    if (!value || !value.deviceId.trim() || !FINGERPRINT_PATTERN.test(value.fingerprint)) {
      setError("Saisissez l'identifiant de l'appareil et son empreinte complète.");
      return;
    }
    if (!value.confirmed) {
      setError("Comparez d'abord l'empreinte avec votre proche par appel vocal/vidéo ou en personne.");
      return;
    }

    setBusyContact(contact.accountId);
    setError("");
    setNotice("");
    try {
      await pinTrustedLocationFingerprint({
        accountId,
        deviceId,
        contactAccountId: contact.accountId,
        contactDeviceId: value.deviceId.trim(),
        fingerprint: value.fingerprint,
        confirmedByIndependentChannel: true,
      });
      setNotice("Empreinte de cet appareil enregistrée localement. Elle n'a pas été envoyée au serveur.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d'enregistrer cette empreinte.");
    } finally {
      setBusyContact(null);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-sac-primary-strong/15 bg-white/55 p-4 sm:p-5" aria-label="Vérification des clés GPS">
      <div className="flex items-center gap-2">
        <div className="rounded-xl bg-sac-confirm/15 p-2 text-sac-confirm"><Fingerprint size={19}/></div>
        <div>
          <h3 className="font-extrabold">Sécurité du partage GPS</h3>
          <p className="text-xs text-sac-muted">Vérification des appareils de vos proches</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-5 text-sac-muted">
        Avant d'activer le partage GPS chiffré, comparez les empreintes avec vos proches par un canal indépendant, par exemple lors d'un appel vocal ou en personne. Ne faites jamais confiance à un code reçu uniquement dans SAC.
      </p>

      <div className="mt-4 rounded-xl border border-white bg-white/80 p-3">
        <p className="text-xs font-bold text-sac-muted">MON EMPREINTE DE SÉCURITÉ</p>
        {loading ? <p className="mt-2 text-sm text-sac-muted">Préparation du coffre local…</p> : ownFingerprint ? (
          <>
            <p className="mt-2 break-all font-mono text-sm font-bold tracking-wide">{ownFingerprint}</p>
            <p className="mt-2 break-all text-[11px] text-sac-muted">Appareil : {deviceId}</p>
            <button type="button" onClick={() => void copyOwnFingerprint()} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-sac-primary-strong/15 bg-white px-3 text-xs font-bold"><Copy size={14}/>Copier mon empreinte</button>
          </>
        ) : <p className="mt-2 text-sm text-sac-alert">Empreinte indisponible. Le partage GPS restera désactivé.</p>}
      </div>

      <div className="mt-4 space-y-3">
        {contacts.map((contact) => {
          const value = inputs[contact.accountId] ?? { deviceId: "", fingerprint: "", confirmed: false };
          const valid = value.deviceId.trim().length > 0 && FINGERPRINT_PATTERN.test(value.fingerprint);
          return (
            <div key={contact.accountId} className="rounded-xl border border-white bg-white/70 p-3">
              <p className="font-bold">{contact.email}</p>
              <label className="mt-3 block text-xs font-bold text-sac-muted">
                Identifiant de l'appareil du proche
                <input
                  value={value.deviceId}
                  onChange={(event) => updateInput(contact.accountId, { deviceId: event.target.value })}
                  maxLength={256}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Identifiant communiqué par le proche"
                  className="mt-1 min-h-10 w-full rounded-lg border border-white bg-white px-3 text-sm font-normal text-sac-ink outline-none focus:ring-2 focus:ring-sac-confirm/30"
                />
              </label>
              <label className="mt-3 block text-xs font-bold text-sac-muted">
                Empreinte de sécurité communiquée par le proche
                <input
                  value={value.fingerprint}
                  onChange={(event) => updateInput(contact.accountId, { fingerprint: event.target.value.toUpperCase() })}
                  maxLength={79}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="XXXX XXXX XXXX …"
                  className="mt-1 min-h-10 w-full rounded-lg border border-white bg-white px-3 font-mono text-xs font-normal tracking-wide text-sac-ink outline-none focus:ring-2 focus:ring-sac-confirm/30"
                />
              </label>
              <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-sac-muted">
                <input
                  type="checkbox"
                  checked={value.confirmed}
                  onChange={(event) => updateInput(contact.accountId, { confirmed: event.target.checked })}
                  className="mt-1"
                />
                J'ai comparé cette empreinte directement avec ce proche, indépendamment de SAC.
              </label>
              <button
                type="button"
                disabled={loading || !ownFingerprint || !valid || !value.confirmed || busyContact !== null}
                onClick={() => void saveContactFingerprint(contact)}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-sac-primary-strong px-3 text-xs font-extrabold text-white disabled:opacity-45"
              >
                <ShieldCheck size={14}/>{busyContact === contact.accountId ? "Enregistrement…" : "Enregistrer l'empreinte vérifiée"}
              </button>
            </div>
          );
        })}
      </div>
      {notice && <p role="status" className="mt-3 rounded-xl bg-sac-confirm/10 p-3 text-xs text-sac-ink">{notice}</p>}
      {error && <p role="alert" className="mt-3 rounded-xl bg-sac-alert/5 p-3 text-xs text-sac-alert">{error}</p>}
    </section>
  );
}
