import { parseGpsWebSocketProtocols } from "./websocket-protocol.ts";
import { isGpsRelayReady } from "./relay-readiness.ts";
import { isRelayTarget } from "./routing.ts";
import { DurableObject } from "cloudflare:workers";

interface Env {
  DB: D1Database;
  GPS_ROOMS: DurableObjectNamespace<GpsRelayRoom>;
  GPS_RELAY_E2EE_READY?: string;
}
interface RelayMessage {
  type: "heartbeat" | "key-announce" | "gps-encrypted";
  publicKey?: string;
  ciphertext?: string;
  iv?: string;
  recipientConnectionId?: string;
  sequence?: number;
}
interface SocketIdentity {
  accountId: string;
  deviceId: string;
  sessionId: string;
  role: "author" | "recipient";
  connectionId: string;
  alertId: string;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

async function hashTicket(ticket: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ticket)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function isActiveParticipant(
  db: D1Database, alertId: string, accountId: string, deviceId: string, sessionId: string,
): Promise<boolean> {
  try {
    const row = await db.prepare(
      `SELECT 1 AS allowed FROM alerts a
       JOIN devices d ON d.id = ? AND d.account_id = ? AND d.status = 'active'
       JOIN device_sessions s ON s.id = ? AND s.account_id = ? AND s.device_id = d.id
         AND s.status = 'active' AND s.expires_at > ?
       WHERE a.id = ? AND a.status = 'active'
         AND (a.author_account_id = ? OR EXISTS (
           SELECT 1 FROM alert_recipients r
           JOIN trusted_contacts t
             ON t.owner_account_id = a.author_account_id
            AND t.contact_account_id = r.recipient_account_id
            AND t.status = 'active'
            AND t.created_at <= a.created_at
            AND NOT EXISTS (SELECT 1 FROM trusted_contacts exited WHERE exited.owner_account_id = t.owner_account_id AND exited.contact_account_id = t.contact_account_id AND exited.revocation_reason = 'contact_withdrew' AND (exited.relationship_sequence > t.relationship_sequence))
           WHERE r.alert_id = a.id AND r.recipient_account_id = ?
         )) LIMIT 1`,
    ).bind(deviceId, accountId, sessionId, accountId, Date.now(), alertId, accountId, accountId).first<{ allowed: number }>();
    return row?.allowed === 1;
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!isGpsRelayReady(env.GPS_RELAY_E2EE_READY)) {
      return json({ error: "gps_relay_not_ready" }, 503);
    }
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/v1\/alerts\/([^/]+)\/socket$/);
    if (!match) return json({ error: "not_found" }, 404);

    let alertId: string;
    try { alertId = decodeURIComponent(match[1]); }
    catch { return json({ error: "invalid_alert_id" }, 400); }

    const offered = parseGpsWebSocketProtocols(request.headers.get("Sec-WebSocket-Protocol"));
    if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket" || !offered) {
      return json({ error: "invalid_websocket_protocol" }, 401);
    }

    const ticketHash = await hashTicket(offered.ticket);
    const consumed = await env.DB.prepare(
      `DELETE FROM gps_relay_tickets
       WHERE ticket_hash = ? AND alert_id = ? AND expires_at > ?
       RETURNING account_id, device_id, session_id, role`,
    ).bind(ticketHash, alertId, Date.now()).first<{
      account_id: string; device_id: string; session_id: string; role: "author" | "recipient";
    }>();

    if (!consumed) return json({ error: "ticket_expired_or_already_used" }, 401);
    if (!(await isActiveParticipant(env.DB, alertId, consumed.account_id, consumed.device_id, consumed.session_id))) {
      return json({ error: "alert_not_active_or_not_authorized" }, 403);
    }

    const headers = new Headers(request.headers);
    headers.set("X-SAC-Alert-ID", alertId);
    headers.set("X-SAC-Account-ID", consumed.account_id);
    headers.set("X-SAC-Device-ID", consumed.device_id);
    headers.set("X-SAC-Session-ID", consumed.session_id);
    headers.set("X-SAC-Role", consumed.role);
    const room = env.GPS_ROOMS.get(env.GPS_ROOMS.idFromName(alertId));
    return room.fetch(new Request(request, { headers }));
  },
};

export class GpsRelayRoom extends DurableObject<Env> {
  private readonly sockets = new Map<WebSocket, SocketIdentity>();

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "upgrade_required" }, 426);
    }
    const offered = parseGpsWebSocketProtocols(request.headers.get("Sec-WebSocket-Protocol"));
    if (!offered) return json({ error: "invalid_websocket_protocol" }, 401);

    const alertId = request.headers.get("X-SAC-Alert-ID");
    const accountId = request.headers.get("X-SAC-Account-ID");
    const deviceId = request.headers.get("X-SAC-Device-ID");
    const sessionId = request.headers.get("X-SAC-Session-ID");
    const role = request.headers.get("X-SAC-Role");
    if (!alertId || !accountId || !deviceId || !sessionId || (role !== "author" && role !== "recipient")) {
      return json({ error: "unauthorized" }, 401);
    }
    if (!(await isActiveParticipant(this.env.DB, alertId, accountId, deviceId, sessionId))) {
      return json({ error: "alert_closed" }, 410);
    }

    const existingParticipants: Array<{ connectionId: string; role: "author" | "recipient" }> = [];
    for (const [existingSocket, participant] of this.sockets) {
      if (existingSocket.readyState !== WebSocket.OPEN) {
        this.sockets.delete(existingSocket);
        continue;
      }
      if (!(await isActiveParticipant(
        this.env.DB, alertId, participant.accountId, participant.deviceId, participant.sessionId,
      ))) {
        existingSocket.close(4003, "access_revoked");
        this.sockets.delete(existingSocket);
        continue;
      }
      existingParticipants.push({ connectionId: participant.connectionId, role: participant.role });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const identity: SocketIdentity = { accountId, deviceId, sessionId, role, connectionId: crypto.randomUUID(), alertId };
    server.accept();
    this.sockets.set(server, identity);
    server.addEventListener("message", (event) => { void this.handleMessage(server, alertId, event.data); });
    server.addEventListener("close", () => {
      this.sockets.delete(server);
      void this.broadcastPresence(alertId, server, { type: "participant-disconnected", connectionId: identity.connectionId, role: identity.role });
    });
    server.addEventListener("error", () => {
      this.sockets.delete(server);
      void this.broadcastPresence(alertId, server, { type: "participant-disconnected", connectionId: identity.connectionId, role: identity.role });
    });
    server.send(JSON.stringify({ type: "connected", connectionId: identity.connectionId, role: identity.role, participants: existingParticipants }));
    await this.ctx.storage.setAlarm(Date.now() + 5_000);
    await this.broadcastPresence(alertId, server, { type: "participant-connected", connectionId: identity.connectionId, role: identity.role });
    return new Response(null, { status: 101, webSocket: client, headers: { "Sec-WebSocket-Protocol": offered.protocol } });
  }

  // Revalide périodiquement les sockets inactifs ; chaque émission reste aussi protégée par un contrôle immédiat.
  async alarm(): Promise<void> {
    for (const [socket, identity] of this.sockets) {
      if (socket.readyState !== WebSocket.OPEN ||
        !(await isActiveParticipant(this.env.DB, identity.alertId, identity.accountId, identity.deviceId, identity.sessionId))) {
        try { socket.close(4003, "access_revoked"); } catch {}
        this.sockets.delete(socket);
        await this.broadcastPresence(identity.alertId, socket, {
          type: "participant-disconnected", connectionId: identity.connectionId, role: identity.role,
        });
        continue;
      }
    }
    if (this.sockets.size > 0) await this.ctx.storage.setAlarm(Date.now() + 5_000);
  }

  private async broadcastPresence(alertId: string, except: WebSocket, message: Record<string, string>): Promise<void> {
    const payload = JSON.stringify(message);
    for (const [socket, target] of this.sockets) {
      if (socket === except || socket.readyState !== WebSocket.OPEN) continue;
      if (!(await isActiveParticipant(this.env.DB, alertId, target.accountId, target.deviceId, target.sessionId))) {
        socket.close(4003, "access_revoked");
        this.sockets.delete(socket);
        continue;
      }
      try { socket.send(payload); } catch { this.sockets.delete(socket); }
    }
  }

  private async handleMessage(sender: WebSocket, alertId: string, raw: string | ArrayBuffer): Promise<void> {
    const identity = this.sockets.get(sender);
    if (!identity) return;
    if (!(await isActiveParticipant(this.env.DB, alertId, identity.accountId, identity.deviceId, identity.sessionId))) {
      sender.close(4003, "access_revoked");
      this.sockets.delete(sender);
      await this.broadcastPresence(alertId, sender, { type: "participant-disconnected", connectionId: identity.connectionId, role: identity.role });
      return;
    }
    if (typeof raw !== "string" || raw.length > 16_384) {
      sender.close(4002, "invalid_message"); this.sockets.delete(sender); return;
    }
    let message: RelayMessage;
    try { message = JSON.parse(raw) as RelayMessage; }
    catch { sender.close(4002, "invalid_message"); this.sockets.delete(sender); return; }

    if (message.type === "heartbeat") {
      sender.send(JSON.stringify({ type: "heartbeat-ack", at: Date.now() }));
      return;
    }
    if (message.type === "key-announce") {
      if (typeof message.publicKey !== "string" || message.publicKey.length > 2048) {
        sender.close(4002, "invalid_key_announcement"); this.sockets.delete(sender); return;
      }
    } else if (message.type === "gps-encrypted") {
      if (identity.role !== "author" ||
        typeof message.recipientConnectionId !== "string" || message.recipientConnectionId.length > 64 ||
        typeof message.ciphertext !== "string" || message.ciphertext.length > 12_000 ||
        typeof message.iv !== "string" || message.iv.length > 64 ||
        !Number.isSafeInteger(message.sequence) || (message.sequence ?? 0) < 1) {
        sender.close(4002, "invalid_encrypted_payload"); this.sockets.delete(sender); return;
      }
      const forbidden = ["latitude", "longitude", "lat", "lng", "coordinates", "address", "geohash", "location"];
      if (forbidden.some((key) => Object.prototype.hasOwnProperty.call(message, key))) {
        sender.close(4002, "plaintext_location_forbidden"); this.sockets.delete(sender); return;
      }
    } else {
      sender.close(4002, "unsupported_message"); this.sockets.delete(sender); return;
    }

    const outgoing = JSON.stringify({ ...message, fromRole: identity.role, fromConnectionId: identity.connectionId,
      fromAccountId: identity.accountId, fromDeviceId: identity.deviceId });
    for (const [socket, target] of this.sockets) {
      const isTarget = isRelayTarget(
        identity.role,
        message.type,
        target.role,
        target.connectionId,
        message.recipientConnectionId,
      );
      if (socket !== sender && isTarget && socket.readyState === WebSocket.OPEN) {
        if (!(await isActiveParticipant(this.env.DB, alertId, target.accountId, target.deviceId, target.sessionId))) {
          socket.close(4003, "access_revoked");
          this.sockets.delete(socket);
          await this.broadcastPresence(alertId, socket, { type: "participant-disconnected", connectionId: target.connectionId, role: target.role });
          continue;
        }
        try { socket.send(outgoing); } catch { this.sockets.delete(socket); }
      }
    }
  }

}
