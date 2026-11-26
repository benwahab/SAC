/** Build the public WebSocket URL for an alert on the same SAC application origin. */
export function createGpsWebSocketUrl(requestUrl: string, alertId: string): string {
  const url = new URL(
    "/v1/alerts/" + encodeURIComponent(alertId) + "/socket",
    requestUrl,
  );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
