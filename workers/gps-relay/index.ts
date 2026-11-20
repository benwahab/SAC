import { parseGpsWebSocketProtocols } from "./websocket-protocol.ts";
import { DurableObject } from "cloudflare:workers";

interface TicketClaims {
  alertId: string;
  accountId: string;
  role: "author" | "recipient";
  exp: number;
  scope: "connect" | "close";
  jti?: string;
}
interface Env {
  DB: D1Database;
  GPS_ROOMS: DurableObjectNamespace<GpsRelayRoom>;
  GPS_RELAY_HMAC_SECRET: string;
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
  role: "author" | "recipient";
  connectionId: string;
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function decodeJsonPart(value: string): unknown {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function verifyTicket(token: string, secret: string): Promise<TicketClaims | null> {
  if (!secret || secret.length < 32 || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      toArrayBuffer(decodeBase64Url(parts[1])),
      new TextEncoder().encode(parts[0]),
    );
    if (!valid) return null;
    const claims = decodeJsonPart(parts[0]) as TicketClaims;
    if (
      !claims ||
      (claims.scope !== "connect" && claims.scope !== "close") ||
      typeof claims.alertId !== "string" ||
      !claims.alertId ||
      typeof claims.accountId !== "string" ||
      !claims.accountId ||
      (claims.role !== "author" && claims.role !== "recipient") ||
      !Number.isSafeInteger(claims.exp) ||
      claims.exp <= Math.floor(Date.now() / 1000) ||
      (claims.scope === "connect" && (typeof claims.jti !== "string" || claims.jti.length < 16 || claims.jti.length > 64))
    ) return null;
    return claims;
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

async function isActiveParticipant(db: D1Database, alertId: string, accountId: string): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 AS allowed FROM alerts a
     WHERE a.id = ? AND a.status = 'active'
       AND (a.author_account_id = ? OR EXISTS (
         SELECT 1 FROM alert_recipients r
         WHERE r.alert_id = a.id AND r.recipient_account_id = ?
       )) LIMIT 1`,
  ).bind(alertId, accountId, accountId).first<{ allowed: number }>();
  return row?.allowed === 1;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/v1\/alerts\/([^/]+)\/(socket|close)$/);
    if (!match) return json({ error: "not_found" }, 404);

    let alertId: string;
    try {
      alertId = decodeURIComponent(match[1]);
    } catch {
      return json({ error: "invalid_alert_id" }, 400);
    }

    const action = match[2];
    let token = "";
    if (action === "socket") {
      const offered = parseGpsWebSocketProtocols(request.headers.get("Sec-WebSocket-Protocol"));
      if (request.method !== "GET" || !offered) {
        return json({ error: "invalid_websocket_protocol" }, 401);
      }
      token = offered.ticket;
    } else {
      token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    }
    const claims = await verifyTicket(token, env.GPS_RELAY_HMAC_SECRET);
    const expectedScope = action === "socket" ? "connect" : "close";
    if (!claims || claims.alertId !== alertId || claims.scope !== expectedScope) {
      return json({ error: "invalid_ticket" }, 401);
    }

    const room = env.GPS_ROOMS.get(env.GPS_ROOMS.idFromName(alertId));

    if (action === "close") {
      if (request.method !== "POST" || claims.role !== "author") {
        return json({ error: "forbidden" }, 403);
      }
      const closed = await env.DB.prepare(
        "SELECT 1 AS ok FROM alerts WHERE id = ? AND author_account_id = ? AND status = 'closed_by_author' LIMIT 1",
      ).bind(alertId, claims.accountId).first<{ ok: number }>();
      if (!closed) return json({ error: "alert_not_closed" }, 409);
      return room.fetch(new Request("https://gps-room.internal/close", { method: "POST" }));
    }

    if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "websocket_required" }, 426);
    }
    if (!(await isActiveParticipant(env.DB, alertId, claims.accountId))) {
      return json({ error: "alert_not_active_or_not_authorized" }, 403);
    }

    const ticketDigest = new Uint8Array(await crypto.subtle.digest(
      "SHA-256", new TextEncoder().encode(token),
    ));
    const ticketHash = Array.from(ticketDigest, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const consumed = await env.DB.prepare(
      `DELETE FROM gps_relay_tickets
       WHERE ticket_hash = ? AND alert_id = ? AND account_id = ? AND role = ?
         AND expires_at > ?`,
    ).bind(ticketHash, alertId, claims.accountId, claims.role, Date.now()).run();
    if (!consumed.success || consumed.meta.changes !== 1) {
      return json({ error: "ticket_expired_or_already_used" }, 401);
    }

    const headers = new Headers(request.headers);
    headers.set("X-SAC-Alert-ID", alertId);
    headers.set("X-SAC-Account-ID", claims.accountId);
    headers.set("X-SAC-Role", claims.role);
    return room.fetch(new Request(request, { headers }));
  },
};

export class GpsRelayRoom extends DurableObject<Env> {
  private readonly sockets = new Map<WebSocket, SocketIdentity>();

  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === "/close" && request.method === "POST") {
      this.closeRoom(4001, "alert_closed");
      return json({ closed: true });
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "upgrade_required" }, 426);
    }
    const offered = parseGpsWebSocketProtocols(request.headers.get("Sec-WebSocket-Protocol"));
    if (!offered) return json({ error: "invalid_websocket_protocol" }, 401);

    const alertId = request.headers.get("X-SAC-Alert-ID");
    const accountId = request.headers.get("X-SAC-Account-ID");
    const role = request.headers.get("X-SAC-Role");
    if (!alertId || !accountId || (role !== "author" && role !== "recipient")) {
      return json({ error: "unauthorized" }, 401);
    }
    if (!(await isActiveParticipant(this.env.DB, alertId, accountId))) {
      return json({ error: "alert_closed" }, 410);
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const identity: SocketIdentity = { accountId, role, connectionId: crypto.randomUUID() };
    server.accept();
    this.sockets.set(server, identity);

    server.addEventListener("message", (event) => {
      void this.handleMessage(server, alertId, event.data);
    });
    server.addEventListener("close", () => this.sockets.delete(server));
    server.addEventListener("error", () => this.sockets.delete(server));

    server.send(JSON.stringify({
      type: "connected",
      connectionId: identity.connectionId,
      role: identity.role,
    }));
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { "Sec-WebSocket-Protocol": offered.protocol },
    });
  }

  private async handleMessage(sender: WebSocket, alertId: string, raw: string | ArrayBuffer): Promise<void> {
    const identity = this.sockets.get(sender);
    if (!identity) return;

    if (!(await isActiveParticipant(this.env.DB, alertId, identity.accountId))) {
      this.closeRoom(4001, "alert_closed");
      return;
    }
    if (typeof raw !== "string" || raw.length > 16_384) {
      sender.close(4002, "invalid_message");
      this.sockets.delete(sender);
      return;
    }

    let message: RelayMessage;
    try {
      message = JSON.parse(raw) as RelayMessage;
    } catch {
      sender.close(4002, "invalid_message");
      this.sockets.delete(sender);
      return;
    }

    if (message.type === "heartbeat") {
      sender.send(JSON.stringify({ type: "heartbeat-ack", at: Date.now() }));
      return;
    }

    if (message.type === "key-announce") {
      if (typeof message.publicKey !== "string" || message.publicKey.length > 2048) {
        sender.close(4002, "invalid_key_announcement");
        this.sockets.delete(sender);
        return;
      }
    } else if (message.type === "gps-encrypted") {
      if (
        identity.role !== "author" ||
        typeof message.recipientConnectionId !== "string" ||
        message.recipientConnectionId.length > 64 ||
        typeof message.ciphertext !== "string" ||
        message.ciphertext.length > 12_000 ||
        typeof message.iv !== "string" ||
        message.iv.length > 64 ||
        !Number.isSafeInteger(message.sequence) ||
        (message.sequence ?? 0) < 1
      ) {
        sender.close(4002, "invalid_encrypted_payload");
        this.sockets.delete(sender);
        return;
      }
      const forbidden = ["latitude", "longitude", "lat", "lng", "coordinates", "address", "geohash", "location"];
      if (forbidden.some((key) => Object.prototype.hasOwnProperty.call(message, key))) {
        sender.close(4002, "plaintext_location_forbidden");
        this.sockets.delete(sender);
        return;
      }
    } else {
      sender.close(4002, "unsupported_message");
      this.sockets.delete(sender);
      return;
    }

    const outgoing = JSON.stringify({
      ...message,
      fromRole: identity.role,
      fromConnectionId: identity.connectionId,
    });
    for (const [socket, target] of this.sockets) {
      const isTarget = message.type !== "gps-encrypted" ||
        (target.role === "recipient" && target.connectionId === message.recipientConnectionId);
      if (socket !== sender && isTarget && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(outgoing);
        } catch {
          this.sockets.delete(socket);
        }
      }
    }
  }

  private closeRoom(code: number, reason: string): void {
    for (const socket of this.sockets.keys()) {
      try {
        socket.close(code, reason);
      } catch {
        // The socket may already be closed.
      }
    }
    this.sockets.clear();
  }
}
