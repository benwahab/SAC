/**
 * Production fail-closed gate. The relay cannot accept GPS sessions until
 * the browser key-authentication and end-to-end encryption client is ready.
 */
export function isGpsRelayReady(value: unknown): boolean {
  return value === "true";
}
