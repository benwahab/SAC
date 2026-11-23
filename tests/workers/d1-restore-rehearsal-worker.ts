import { computeSecurityAnchorHash } from "../../src/domain/security-anchor.ts";

interface Env {
  DB: D1Database;
}

type Projection = {
  sequence: number;
  root_status: "none" | "active" | "revoked";
  secondary_status: "none" | "pending" | "active" | "revoked";
  event_hash: string;
};

type AppendInput = {
  event: "ROOT_REGISTERED" | "SECONDARY_ACTIVATED" | "ROOT_REVOKED";
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}

async function readProjection(env: Env): Promise<Projection | null> {
  return await env.DB.prepare(
    "SELECT sequence, root_status, secondary_status, event_hash FROM test_restore_projection WHERE id = 1",
  ).first<Projection>();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") return json({ ok: true });

    if (url.pathname === "/state" && request.method === "GET") {
      const projection = await readProjection(env);
      return projection ? json(projection) : json({ error: "projection_missing" }, 503);
    }

    if (url.pathname === "/ready" && request.method === "GET") {
      const expectedSequence = Number(url.searchParams.get("sequence"));
      const expectedHash = url.searchParams.get("hash");
      if (!Number.isSafeInteger(expectedSequence) || expectedSequence < 0 || !expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash)) {
        return json({ ready: false, error: "invalid_anchor" }, 400);
      }
      const projection = await readProjection(env);
      const ready = projection?.sequence === expectedSequence && projection.event_hash === expectedHash;
      return json({ ready, projection }, ready ? 200 : 503);
    }

    if (url.pathname !== "/append" || request.method !== "POST") {
      return json({ error: "not_found" }, 404);
    }

    const input = await readJson<AppendInput>(request);
    if (!input || !["ROOT_REGISTERED", "SECONDARY_ACTIVATED", "ROOT_REVOKED"].includes(input.event)) {
      return json({ error: "invalid_event" }, 400);
    }

    const current = await readProjection(env);
    if (!current) return json({ error: "projection_missing" }, 503);

    let root = current.root_status;
    let secondary = current.secondary_status;
    if (input.event === "ROOT_REGISTERED") {
      if (current.root_status !== "none") return json({ error: "transition_rejected" }, 409);
      root = "active";
    } else if (input.event === "SECONDARY_ACTIVATED") {
      if (current.root_status !== "active" || current.secondary_status !== "none") {
        return json({ error: "transition_rejected" }, 409);
      }
      secondary = "active";
    } else {
      if (current.root_status !== "active") return json({ error: "transition_rejected" }, 409);
      root = "revoked";
      if (secondary === "active") secondary = "revoked";
    }

    const sequence = current.sequence + 1;
    const eventHash = await computeSecurityAnchorHash(sequence, current.event_hash, input.event);
    const result = await env.DB.prepare(
      `UPDATE test_restore_projection
       SET sequence = ?, root_status = ?, secondary_status = ?, event_hash = ?
       WHERE id = 1 AND sequence = ? AND event_hash = ?`,
    ).bind(sequence, root, secondary, eventHash, current.sequence, current.event_hash).run();
    if (!result.success || result.meta.changes !== 1) {
      return json({ error: "projection_conflict" }, 409);
    }

    return json({
      sequence,
      root_status: root,
      secondary_status: secondary,
      event_hash: eventHash,
    });
  },
};
