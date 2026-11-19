import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

test(
  "SimpleWebAuthn 14.1.0 imports and executes inside the local Cloudflare Workers runtime",
  { timeout: 90_000 },
  async (t) => {
    const port = 8798;
    const child = spawn(
      process.execPath,
      [
        "node_modules/wrangler/bin/wrangler.js",
        "dev",
        "--local",
        "--config",
        "tests/wrangler.webauthn.toml",
        "--port",
        String(port),
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString(); });

    t.after(async () => {
      if (child.exitCode === null && !child.killed) {
        child.kill("SIGTERM");
        await Promise.race([once(child, "exit"), delay(3000)]);
      }
    });

    const deadline = Date.now() + 60_000;
    let ready = false;
    let lastError: unknown;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error("Wrangler exited before serving the test Worker: " + output);
      }
      try {
        const response = await fetch("http://127.0.0.1:" + port + "/options");
        if (response.status === 200) {
          const result = await response.json() as {
            challengePresent: boolean;
            rpId: string;
            rpName: string;
            userVerification: string;
            residentKey: string;
            attachment: string;
            algorithms: number[];
          };
          assert.equal(result.challengePresent, true);
          assert.equal(result.rpId, "localhost");
          assert.equal(result.rpName, "SAC runtime smoke test");
          assert.equal(result.userVerification, "required");
          assert.equal(result.residentKey, "required");
          assert.equal(result.attachment, "platform");
          assert.deepEqual(result.algorithms, [-7]);
          ready = true;
          break;
        }
      } catch (error) {
        lastError = error;
      }
      await delay(300);
    }

    assert.equal(ready, true, "Worker did not become ready: " + String(lastError) + "\n" + output);

    const rejected = await fetch("http://127.0.0.1:" + port + "/reject-invalid");
    assert.equal(rejected.status, 200, output);
    assert.deepEqual(await rejected.json(), { rejected: true });
  },
);
