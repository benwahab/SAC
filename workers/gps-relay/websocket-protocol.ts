export interface ParsedGpsWebSocketProtocols {
  readonly protocol: "sac-gps-v1";
  readonly ticket: string;
}

const PUBLIC_PROTOCOL = "sac-gps-v1";
const TICKET_PREFIX = "sac-gps-ticket.";

/** Parses the public protocol and one short-lived opaque ticket. */
export function parseGpsWebSocketProtocols(
  header: string | null,
): ParsedGpsWebSocketProtocols | null {
  if (typeof header !== "string" || header.length === 0 || header.length > 512) return null;
  const offered = header.split(",").map((value) => value.trim());
  if (offered.length !== 2 || offered.some((value) => value.length === 0)) return null;

  const publicProtocols = offered.filter((value) => value === PUBLIC_PROTOCOL);
  const ticketProtocols = offered.filter((value) => value.startsWith(TICKET_PREFIX));
  if (publicProtocols.length !== 1 || ticketProtocols.length !== 1) return null;

  const ticket = ticketProtocols[0].slice(TICKET_PREFIX.length);
  if (ticket.length !== 43 || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) return null;
  return { protocol: PUBLIC_PROTOCOL, ticket };
}
