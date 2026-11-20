import { DurableObject } from "cloudflare:workers";

interface TicketClaims {
  alertId: string;
  accountId: string;
  role: "author" | "recipient";
  exp: number;
  scope: "connect" | "close";
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
  recipientAccountId?: string;
  sequence?: number;
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  const bytes = new Uint8Array(binary.length);\n  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);\n  return bytes;
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
      "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
    );
    const valid = await crypto.subtle.verify("HMAC", key, decodeBase64Url(parts[1]), new TextEncoder().encode(parts[0]));
    if (!valid) return null;
    const claims = decodeJsonPart(parts[0]) as TicketClaims;
    if (!claims || (claims.scope !== "connect" && claims.scope !== "close") || !claims.alertId || !claims.accountId ||
        (claims.role !== "author" && claims.role !== "recipient") ||
        !Number.isSafeInteger(claims.exp) || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}
function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
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
    const match = url.pathname.match(/^\/v1\/alerts\/([^/]+)\/socket$/);
    if (!match || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "not_found" }, 404);
    }
    const alertId = decodeURIComponent(match[1]);
    const ticket = url.searchParams.get("ticket") ?? "";
    const claims = await verifyTicket(ticket, env.GPS_RELAY_HMAC_SECRET);
    if (!claims || claims.alertId !== alertId) return json({ error: "invalid_ticket" }, 401);
    if (!(await isActiveParticipant(env.DB, alertId, claims.accountId))) {
      return json({ error: "alert_not_active_or_not_authorized" }, 403);
    }

    const id = env.GPS_ROOMS.idFromName(alertId);
    const room = env.GPS_ROOMS.get(id);
    const headers = new Headers(request.headers);
    headers.set("X-SAC-Alert-ID", alertId);
    headers.set("X-SAC-Account-ID", claims.accountId);
    headers.set("X-SAC-Role", claims.role);
    return room.fetch(new Request(request, { headers }));
  },
};

export class GpsRelayRoom extends DurableObject<Env> {
  private readonly sockets = new Map<WebSocket, { accountId: string; role: "author" | "recipient" }>();

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ error: "upgrade_required" }, 426);
    const alertId = request.headers.get("X-SAC-Alert-ID");
    const accountId = request.headers.get("X-SAC-Account-ID");
    const role = request.headers.get("X-SAC-Role");
    if (!alertId || !accountId || (role !== "author" && role !== "recipient")) return json({ error: "unauthorized" }, 401);
    if (!(await isActiveParticipant(this.env.DB, alertId, accountId))) return json({ error: "alert_closed" }, 410);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.sockets.set(server, { accountId, role });

    server.addEventListener("message", (event) => {
      void this.handleMessage(server, alertId, event.data);
    });
    server.addEventListener("close", () => this.sockets.delete(server));
    server.addEventListener("error", () => this.sockets.delete(server));

    return new Response(null, { status: 101, webSocket: client });
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
      if (typeof message.ciphertext !== "string" || message.ciphertext.length > 12_000 ||
          typeof message.iv !== "string" || message.iv.length > 64 ||
          !Number.isSafeInteger(message.sequence) || (message.sequence ?? 0) < 1) {
        sender.close(4002, "invalid_encrypted_payload");
        this.sockets.delete(sender);
        return;
      }
      // Reject obvious plaintext location fields. GPS coordinates must be
      // encrypted by the sender before they enter this relay.
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
      fromAccountId: identity.accountId,
    });
    for (const [socket] of this.sockets) {
      if (socket !== sender && socket.readyState === WebSocket.OPEN) {
        try { socket.send(outgoing); } catch { this.sockets.delete(socket); }
      }
    }
  }

  private closeRoom(code: number, reason: string): void {
    for (const [socket] of this.sockets) {
      try { socket.close(code, reason); } catch { /* already closed */ }
    }
    this.sockets.clear();
  }
}
