export function isRelayTarget(
  senderRole: "author" | "recipient",
  messageType: "key-announce" | "gps-encrypted",
  targetRole: "author" | "recipient",
  targetConnectionId: string,
  recipientConnectionId: string | undefined,
): boolean {
  if (messageType === "gps-encrypted") {
    return targetRole === "recipient" && targetConnectionId === recipientConnectionId;
  }
  return senderRole === "author" ? targetRole === "recipient" : targetRole === "author";
}


/** Match only the public GPS socket endpoint; ticket APIs stay in Pages Functions. */
export function isGpsRelaySocketPath(pathname: string): boolean {
  return /^\/v1\/alerts\/[^/]+\/socket$/.test(pathname);
}
