import https from "node:https";
import { randomBytes } from "node:crypto";

const hostname = process.env.SAC_APP_HOST ?? "sac-app.benwahab111.workers.dev";
const alertId = "sac-gps-relay-smoke-probe";
const ticket = "A".repeat(43);
const path = `/v1/alerts/${encodeURIComponent(alertId)}/socket`;

const request = https.request({
  hostname,
  port: 443,
  path,
  method: "GET",
  headers: {
    Connection: "Upgrade",
    Upgrade: "websocket",
    "Sec-WebSocket-Key": randomBytes(16).toString("base64"),
    "Sec-WebSocket-Version": "13",
    "Sec-WebSocket-Protocol": `sac-gps-v1, sac-gps-ticket.${ticket}`,
  },
}, (response) => {
  response.resume();
  if (response.statusCode !== 401) {
    console.error(`GPS relay smoke test expected HTTP 401 for an invalid ticket, received ${response.statusCode}`);
    process.exitCode = 1;
    return;
  }
  console.log("GPS relay smoke test passed: sac-app route is live and rejects an invalid one-time ticket.");
});

request.on("upgrade", () => {
  console.error("GPS relay smoke test failed: an invalid ticket unexpectedly opened a WebSocket.");
  process.exitCode = 1;
});
request.on("error", (error) => {
  console.error("GPS relay smoke test failed:", error.message);
  process.exitCode = 1;
});
request.setTimeout(15_000, () => request.destroy(new Error("GPS relay smoke test timed out")));
request.end();
