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
