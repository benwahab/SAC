export interface ParsedGpsWebSocketProtocols {
  readonly protocol: "sac-gps-v1";
  readonly ticket: string;
}

const PUBLIC_PROTOCOL = "sac-gps-v1";
const TICKET_PREFIX = "sac-gps-ticket.";
const MAX_TICKET_LENGTH = 4096;

/**
 * Strictly parses the browser WebSocket subprotocol offer.
 * The opaque ticket is never moved into a URL or echoed as the negotiated
 * protocol; only the public version protocol is selected in the handshake.
 */
export function parseGpsWebSocketProtocols(
  header: string | null,
): ParsedGpsWebSocketProtocols | null {
  if (typeof header !== "string" || header.length === 0 || header.length > 8192) {
    return null;
  }

  const offered = header.split(",").map((value) => value.trim());
  if (offered.length !== 2 || offered.some((value) => value.length === 0)) {
    return null;
  }

  const publicProtocols = offered.filter((value) => value === PUBLIC_PROTOCOL);
  const ticketProtocols = offered.filter((value) => value.startsWith(TICKET_PREFIX));
  if (publicProtocols.length !== 1 || ticketProtocols.length !== 1) return null;

  const ticket = ticketProtocols[0].slice(TICKET_PREFIX.length);
  if (
    ticket.length === 0 ||
    ticket.length > MAX_TICKET_LENGTH ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(ticket)
  ) return null;

  return { protocol: PUBLIC_PROTOCOL, ticket };
}
