import {
  createLocationSessionBundle,
  decodeLocationSessionBundle,
  deriveLocationSessionDirectionalKey,
  encodeLocationSessionBundle,
  verifyAuthenticatedLocationSessionBundle,
  type CreatedLocationSessionBundle,
} from "./location-session.ts";
import {
  encryptLocationPayload,
  decryptLocationPayload,
  type EncryptedLocationPacket,
} from "./crypto.ts";
import {
  startBrowserPreciseLocationWatch,
  type EphemeralPreciseLocation,
} from "./live-geolocation.ts";
import type { LocationIdentityKeyStore } from "./identity-vault.ts";

export type SosLocationRelayStatus =
  | "connecting"
  | "waiting_for_author"
  | "waiting_for_devices"
  | "receiving"
  | "sharing"
  | "closed";

export type SosLocationRelayError =
  | "gps_relay_not_ready"
  | "authentication_required"
  | "contact_identity_invalid"
  | "gps_permission_denied"
  | "gps_unavailable"
  | "relay_disconnected"
  | "invalid_location_packet";

export interface SosLocationRelayCallbacks {
  onStatus(status: SosLocationRelayStatus): void;
  onLocation(location: EphemeralPreciseLocation): void;
  onClear(): void;
  onError(error: SosLocationRelayError): void;
}

export interface SosLocationRelayOptions {
  alertId: string;
  accountId: string;
  deviceId: string;
  role: "author" | "recipient";
  callbacks: SosLocationRelayCallbacks;
  identityStore?: LocationIdentityKeyStore;
  fetcher?: typeof fetch;
  WebSocketConstructor?: typeof WebSocket;
}

interface RelayEnvelope {
  type: string;
  role?: "author" | "recipient";
  fromRole?: "author" | "recipient";
  connectionId?: string;
  fromConnectionId?: string;
  fromAccountId?: string;
  fromDeviceId?: string;
  participants?: Array<{ connectionId: string; role: "author" | "recipient" }>;
  publicKey?: string;
  recipientConnectionId?: string;
  ciphertext?: string;
  iv?: string;
  sequence?: number;
}

interface RecipientSendKey {
  key: CryptoKey;
  nextSequence: number;
}

interface AuthorReceiveKey {
  key: CryptoKey;
  lastSequence: number;
}

const HEARTBEAT_INTERVAL_MS = 15_000;
const SESSION_LIFETIME_MS = 23 * 60 * 60 * 1000;

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("base64url invalide");
  }
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function isLocation(value: unknown): value is EphemeralPreciseLocation {
  if (!value || typeof value !== "object") return false;
  const location = value as Record<string, unknown>;
  return typeof location.latitude === "number" &&
    Number.isFinite(location.latitude) && location.latitude >= -90 && location.latitude <= 90 &&
    typeof location.longitude === "number" &&
    Number.isFinite(location.longitude) && location.longitude >= -180 && location.longitude <= 180 &&
    typeof location.accuracy === "number" && Number.isFinite(location.accuracy) && location.accuracy >= 0 &&
    typeof location.capturedAt === "number" && Number.isSafeInteger(location.capturedAt) && location.capturedAt > 0;
}

function mapTicketError(status: number, error: string | undefined): SosLocationRelayError {
  if (error === "gps_relay_not_ready") return "gps_relay_not_ready";
  if (status === 401 || error === "authentication_required") return "authentication_required";
  return "relay_disconnected";
}

/**
 * Browser-only SOS location transport. It does not persist coordinates or
 * session keys. GPS tracking starts only after at least one recipient device
 * has presented a signature and fingerprint verified against a local pin.
 */
export class SosLocationRelayClient {
  private readonly fetcher: typeof fetch;
  private readonly WebSocketConstructor: typeof WebSocket;
  private socket: WebSocket | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private watch: { stop(): void } | null = null;
  private ownSession: CreatedLocationSessionBundle | null = null;
  private sessionId = "";
  private salt: Uint8Array | null = null;
  private readonly recipientKeys = new Map<string, RecipientSendKey>();
  private readonly authorKeys = new Map<string, AuthorReceiveKey>();
  private stopped = false;

  constructor(private readonly options: SosLocationRelayOptions) {
    this.fetcher = options.fetcher ?? fetch;
    this.WebSocketConstructor = options.WebSocketConstructor ?? WebSocket;
  }

  async start(): Promise<void> {
    if (this.socket || this.stopped) return;
    this.options.callbacks.onStatus("connecting");
    try {
      const response = await this.fetcher(
        `/api/alerts/${encodeURIComponent(this.options.alertId)}/gps-ticket`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      const payload = await response.json() as {
        ticket?: string;
        websocketUrl?: string;
        websocketProtocol?: string;
        error?: string;
      };
      if (
        !response.ok ||
        !payload.ticket ||
        !payload.websocketUrl ||
        payload.websocketProtocol !== "sac-gps-v1"
      ) {
        const error = mapTicketError(response.status, payload.error);
        this.options.callbacks.onError(error);
        this.options.callbacks.onStatus("closed");
        return;
      }

      this.socket = new this.WebSocketConstructor(payload.websocketUrl, [
        payload.websocketProtocol,
        `sac-gps-ticket.${payload.ticket}`,
      ]);
      this.socket.addEventListener("open", () => {
        if (this.stopped) return;
        this.heartbeat = setInterval(() => this.send({ type: "heartbeat" }), HEARTBEAT_INTERVAL_MS);
      });
      this.socket.addEventListener("message", (event) => {
        void this.handleMessage(event.data).catch(() => this.options.callbacks.onError("relay_disconnected"));
      });
      this.socket.addEventListener("close", () => {
        if (!this.stopped) {
          this.stop();
          this.options.callbacks.onError("relay_disconnected");
        }
      });
      this.socket.addEventListener("error", () => {
        if (!this.stopped) this.options.callbacks.onError("relay_disconnected");
      });
    } catch {
      this.options.callbacks.onError("relay_disconnected");
      this.options.callbacks.onStatus("closed");
    }
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.watch?.stop();
    this.watch = null;
    if (this.heartbeat !== null) clearInterval(this.heartbeat);
    this.heartbeat = null;
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) {
      try { socket.close(1000, "sos_closed"); } catch { /* already closed */ }
    }
    this.recipientKeys.clear();
    this.authorKeys.clear();
    this.ownSession = null;
    this.salt = null;
    this.sessionId = "";
    this.options.callbacks.onClear();
    this.options.callbacks.onStatus("closed");
  }

  private send(message: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      try { this.socket.send(JSON.stringify(message)); }
      catch { this.options.callbacks.onError("relay_disconnected"); }
    }
  }

  private async createAuthorSession(): Promise<void> {
    this.sessionId = crypto.randomUUID();
    this.salt = crypto.getRandomValues(new Uint8Array(32));
    this.ownSession = await createLocationSessionBundle(
      this.options.accountId,
      this.options.deviceId,
      this.options.alertId,
      this.sessionId,
      this.salt,
      Date.now() + SESSION_LIFETIME_MS,
      this.options.identityStore,
    );
    this.sendOwnSessionBundle();
    this.options.callbacks.onStatus("waiting_for_devices");
  }

  private sendOwnSessionBundle(): void {
    if (!this.ownSession) return;
    this.send({
      type: "key-announce",
      publicKey: encodeLocationSessionBundle(this.ownSession.bundle),
    });
  }

  private async handleMessage(raw: unknown): Promise<void> {
    if (this.stopped || typeof raw !== "string" || raw.length > 16_384) return;
    let message: RelayEnvelope;
    try { message = JSON.parse(raw) as RelayEnvelope; }
    catch { this.options.callbacks.onError("relay_disconnected"); return; }

    if (message.type === "connected") {
      if (message.role !== this.options.role || typeof message.connectionId !== "string") {
        this.stop();
        this.options.callbacks.onError("relay_disconnected");
        return;
      }
      if (this.options.role === "author") {
        try {
          await this.createAuthorSession();
          if (message.participants?.some((participant) => participant.role === "recipient")) {
            this.sendOwnSessionBundle();
          }
        } catch {
          this.options.callbacks.onError("contact_identity_invalid");
          this.stop();
        }
      } else {
        this.options.callbacks.onStatus("waiting_for_author");
      }
      return;
    }

    if (message.type === "participant-connected") {
      if (this.options.role === "author" && message.role === "recipient") {
        this.sendOwnSessionBundle();
      }
      return;
    }

    if (message.type === "participant-disconnected") {
      if (typeof message.connectionId === "string") {
        this.recipientKeys.delete(message.connectionId);
        const wasAuthor = this.authorKeys.delete(message.connectionId);
        if (wasAuthor) {
          this.options.callbacks.onClear();
          this.options.callbacks.onStatus("waiting_for_author");
        }
        if (this.options.role === "author" && this.recipientKeys.size === 0) {
          this.watch?.stop();
          this.watch = null;
          this.options.callbacks.onClear();
          this.options.callbacks.onStatus("waiting_for_devices");
        }
      }
      return;
    }

    if (message.type === "heartbeat-ack") return;

    if (message.type === "key-announce") {
      await this.handleKeyAnnouncement(message);
      return;
    }

    if (message.type === "gps-encrypted" && this.options.role === "recipient") {
      await this.handleEncryptedLocation(message);
    }
  }

  private async handleKeyAnnouncement(message: RelayEnvelope): Promise<void> {
    if (
      typeof message.publicKey !== "string" ||
      typeof message.fromConnectionId !== "string" ||
      (message.fromRole !== "author" && message.fromRole !== "recipient")
    ) return;

    const remote = decodeLocationSessionBundle(message.publicKey);
    if (!remote || remote.alertId !== this.options.alertId) {
      this.options.callbacks.onError("contact_identity_invalid");
      return;
    }

    if (!message.fromAccountId || !message.fromDeviceId ||
      remote.ownerId !== message.fromAccountId || remote.deviceId !== message.fromDeviceId) {
      this.options.callbacks.onError("contact_identity_invalid");
      return;
    }

    const identityValid = await verifyAuthenticatedLocationSessionBundle(
      remote,
      message.fromAccountId,
      message.fromDeviceId,
      this.options.alertId,
      remote.sessionId,
    );
    if (!identityValid) {
      this.options.callbacks.onError("contact_identity_invalid");
      return;
    }

    if (this.options.role === "recipient" && message.fromRole === "author") {
      const sameSession = this.sessionId === remote.sessionId &&
        !!this.ownSession &&
        !!this.salt &&
        this.ownSession.bundle.expiresAt === remote.expiresAt &&
        this.ownSession.bundle.salt.every((value, index) => value === remote.salt[index]);
      if (sameSession && this.authorKeys.has(message.fromConnectionId)) return;

      if (!sameSession) {
        this.watch?.stop();
        this.watch = null;
        this.options.callbacks.onClear();
        this.authorKeys.clear();
        this.recipientKeys.clear();
        this.sessionId = remote.sessionId;
        this.salt = new Uint8Array(remote.salt);
        this.ownSession = await createLocationSessionBundle(
          this.options.accountId,
          this.options.deviceId,
          this.options.alertId,
          remote.sessionId,
          remote.salt,
          remote.expiresAt,
          this.options.identityStore,
        );
      }
      this.sendOwnSessionBundle();

      const ownSession = this.ownSession;
      if (!ownSession) return;
      const key = await deriveLocationSessionDirectionalKey({
        ownPrivateKey: ownSession.exchangePrivateKey,
        remoteBundle: remote,
        authorAccountId: remote.ownerId,
        alertId: this.options.alertId,
        sessionId: remote.sessionId,
        senderDeviceId: remote.deviceId,
        recipientDeviceId: this.options.deviceId,
        ownDeviceId: this.options.deviceId,
        expectedSalt: remote.salt,
      });
      this.authorKeys.set(message.fromConnectionId, { key, lastSequence: 0 });
      this.options.callbacks.onStatus("receiving");
      return;
    }

    if (this.options.role === "author" && message.fromRole === "recipient") {
      if (!this.ownSession || remote.sessionId !== this.sessionId || !this.salt) return;
      if (
        this.recipientKeys.has(message.fromConnectionId) &&
        remote.expiresAt === this.ownSession.bundle.expiresAt &&
        this.salt.every((value, index) => value === remote.salt[index])
      ) return;
      const key = await deriveLocationSessionDirectionalKey({
        ownPrivateKey: this.ownSession.exchangePrivateKey,
        remoteBundle: remote,
        authorAccountId: this.options.accountId,
        alertId: this.options.alertId,
        sessionId: this.sessionId,
        senderDeviceId: this.options.deviceId,
        recipientDeviceId: remote.deviceId,
        ownDeviceId: this.options.deviceId,
        expectedSalt: this.salt,
      });
      this.recipientKeys.set(message.fromConnectionId, { key, nextSequence: 1 });
      this.options.callbacks.onStatus("sharing");
      this.ensureGpsWatch();
    }
  }

  private ensureGpsWatch(): void {
    if (this.watch || this.stopped || this.options.role !== "author" || this.recipientKeys.size === 0) return;
    this.watch = startBrowserPreciseLocationWatch({
      onPosition: (position) => { void this.sendLocation(position); },
      onError: (reason) => {
        this.options.callbacks.onError(reason === "permission_denied" ? "gps_permission_denied" : "gps_unavailable");
      },
      onClear: () => this.options.callbacks.onClear(),
    });
  }

  private async sendLocation(location: EphemeralPreciseLocation): Promise<void> {
    if (this.stopped || !this.ownSession || !this.sessionId || !isLocation(location)) return;
    if (Date.now() >= this.ownSession.bundle.expiresAt) {
      this.stop();
      this.options.callbacks.onError("relay_disconnected");
      return;
    }
    const payload = JSON.stringify(location);
    for (const [recipientConnectionId, target] of this.recipientKeys) {
      try {
        const sequence = target.nextSequence++;
        const packet: EncryptedLocationPacket = await encryptLocationPayload(payload, target.key, this.sessionId);
        this.send({
          type: "gps-encrypted",
          recipientConnectionId,
          ciphertext: encodeBase64Url(packet.ciphertext),
          iv: encodeBase64Url(packet.iv),
          sequence,
        });
      } catch {
        this.options.callbacks.onError("relay_disconnected");
        this.recipientKeys.delete(recipientConnectionId);
      }
    }
    if (this.recipientKeys.size === 0) {
      this.watch?.stop();
      this.watch = null;
      this.options.callbacks.onClear();
      this.options.callbacks.onStatus("waiting_for_devices");
    }
  }

  private async handleEncryptedLocation(message: RelayEnvelope): Promise<void> {
    if (
      typeof message.fromConnectionId !== "string" ||
      !Number.isSafeInteger(message.sequence) ||
      (message.sequence ?? 0) < 1 ||
      typeof message.iv !== "string" ||
      typeof message.ciphertext !== "string"
    ) {
      this.options.callbacks.onError("invalid_location_packet");
      return;
    }
    const source = this.authorKeys.get(message.fromConnectionId);
    if (!source || message.sequence! <= source.lastSequence) return;
    if (!this.ownSession || Date.now() >= this.ownSession.bundle.expiresAt) {
      this.stop();
      this.options.callbacks.onError("relay_disconnected");
      return;
    }
    try {
      const packet: EncryptedLocationPacket = {
        version: 1,
        algorithm: "AES-256-GCM",
        iv: decodeBase64Url(message.iv),
        ciphertext: decodeBase64Url(message.ciphertext),
      };
      const plaintext = await decryptLocationPayload(packet, source.key, this.sessionId);
      const location = JSON.parse(plaintext) as unknown;
      if (!isLocation(location)) throw new Error("invalid location");
      source.lastSequence = message.sequence!;
      this.options.callbacks.onLocation(location);
      this.options.callbacks.onStatus("receiving");
    } catch {
      this.options.callbacks.onError("invalid_location_packet");
    }
  }
}
