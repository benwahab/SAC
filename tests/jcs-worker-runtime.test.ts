import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

test(
  "Cloudflare Workers runtime canonicalizes the RFC 8785 vector and hashes its UTF-8 bytes",
  { timeout: 60_000 },
  async (t) => {
    const port = 8799;
    const child = spawn(
      process.execPath,
      [
        "node_modules/wrangler/bin/wrangler.js",
        "dev",
        "--local",
        "--config",
        "tests/wrangler.jcs.toml",
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

    const deadline = Date.now() + 45_000;
    let response: Response | undefined;
    let lastError: unknown;

    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error("Wrangler exited before serving the test Worker: " + output);
      }
      try {
        response = await fetch("http://127.0.0.1:" + port + "/");
        break;
      } catch (error) {
        lastError = error;
        await delay(300);
      }
    }

    assert.ok(response, "Worker did not become ready: " + String(lastError) + "\n" + output);
    assert.equal(response.status, 200, output);

    const result = await response.json() as { canonical: string; sha256: string };
    const expected = String.raw`{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\u000f\nA'B\"\\\\\"/"}`;
    assert.equal(result.canonical, expected);
    assert.equal(
      result.sha256,
      "2d5e01a318d0f0879ab568c4be289c8b1f64ef8921a53c6277d5e069978baacb",
    );
  },
);
