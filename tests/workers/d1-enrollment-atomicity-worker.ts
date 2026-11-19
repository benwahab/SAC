interface Env {
  DB: D1Database;
}

type SeedInput = {
  ceremonyId: string;
  challengeId: string;
  challengeDigest: string;
  issuedAt: number;
  expiresAt: number;
};

type ApprovalInput = {
  ceremonyId: string;
  challengeId: string;
  challengeDigest: string;
  now: number;
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") return json({ ok: true });

    if (url.pathname === "/state" && request.method === "GET") {
      const ceremonyId = url.searchParams.get("ceremonyId");
      if (!ceremonyId) return json({ error: "missing_ceremony_id" }, 400);

      const ceremony = await env.DB.prepare(
        "SELECT id, status, approved_at FROM test_enrollment_ceremonies WHERE id = ?",
      ).bind(ceremonyId).first();
      const challenge = await env.DB.prepare(
        "SELECT id, consumed_at, expires_at FROM test_enrollment_challenges WHERE ceremony_id = ?",
      ).bind(ceremonyId).first();
      const guard = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM test_enrollment_commit_guard WHERE ceremony_id = ?",
      ).bind(ceremonyId).first<{ count: number }>();

      return json({ ceremony, challenge, commitCount: guard?.count ?? 0 });
    }

    if (request.method !== "POST") return json({ error: "not_found" }, 404);

    if (url.pathname === "/seed") {
      const input = await readJson<SeedInput>(request);
      if (!input
        || !input.ceremonyId
        || !input.challengeId
        || !/^[a-f0-9]{64}$/.test(input.challengeDigest)
        || !Number.isSafeInteger(input.issuedAt)
        || !Number.isSafeInteger(input.expiresAt)
        || input.expiresAt <= input.issuedAt) {
        return json({ error: "invalid_seed" }, 400);
      }

      try {
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO test_enrollment_ceremonies (id, status, approved_at) VALUES (?, 'pending', NULL)",
          ).bind(input.ceremonyId),
          env.DB.prepare(
            "INSERT INTO test_enrollment_challenges (id, ceremony_id, challenge_digest, issued_at, expires_at, consumed_at) VALUES (?, ?, ?, ?, ?, NULL)",
          ).bind(
            input.challengeId,
            input.ceremonyId,
            input.challengeDigest,
            input.issuedAt,
            input.expiresAt,
          ),
        ]);
        return json({ seeded: true });
      } catch {
        return json({ error: "seed_rejected" }, 409);
      }
    }

    if (url.pathname === "/approve") {
      const input = await readJson<ApprovalInput>(request);
      if (!input
        || !input.ceremonyId
        || !input.challengeId
        || !/^[a-f0-9]{64}$/.test(input.challengeDigest)
        || !Number.isSafeInteger(input.now)) {
        return json({ error: "invalid_approval" }, 400);
      }

      try {
        // Each D1 batch is one transaction. The final CHECK-constrained guard
        // converts a zero-row ceremony transition into a SQL failure, forcing
        // rollback of the preceding challenge consumption.
        await env.DB.batch([
          env.DB.prepare(
            `UPDATE test_enrollment_challenges
             SET consumed_at = ?
             WHERE id = ?
               AND ceremony_id = ?
               AND challenge_digest = ?
               AND consumed_at IS NULL
               AND expires_at > ?`,
          ).bind(
            input.now,
            input.challengeId,
            input.ceremonyId,
            input.challengeDigest,
            input.now,
          ),
          env.DB.prepare(
            `UPDATE test_enrollment_ceremonies
             SET status = 'approved', approved_at = ?
             WHERE id = ?
               AND status = 'pending'
               AND EXISTS (
                 SELECT 1 FROM test_enrollment_challenges
                 WHERE id = ?
                   AND ceremony_id = ?
                   AND consumed_at = ?
               )`,
          ).bind(
            input.now,
            input.ceremonyId,
            input.challengeId,
            input.ceremonyId,
            input.now,
          ),
          env.DB.prepare(
            "INSERT INTO test_enrollment_commit_guard (ceremony_id, accepted_rows) VALUES (?, changes())",
          ).bind(input.ceremonyId),
        ]);
        return json({ approved: true });
      } catch {
        // Deliberately generic: SQL details and challenge material never leak.
        return json({ approved: false, reason: "challenge_unavailable_or_already_used" }, 409);
      }
    }

    if (url.pathname === "/rollback-probe") {
      const input = await readJson<ApprovalInput>(request);
      if (!input
        || !input.ceremonyId
        || !input.challengeId
        || !/^[a-f0-9]{64}$/.test(input.challengeDigest)
        || !Number.isSafeInteger(input.now)) {
        return json({ error: "invalid_probe" }, 400);
      }

      let batchRejected = false;
      try {
        await env.DB.batch([
          env.DB.prepare(
            `UPDATE test_enrollment_challenges
             SET consumed_at = ?
             WHERE id = ?
               AND ceremony_id = ?
               AND challenge_digest = ?
               AND consumed_at IS NULL
               AND expires_at > ?`,
          ).bind(
            input.now,
            input.challengeId,
            input.ceremonyId,
            input.challengeDigest,
            input.now,
          ),
          // Intentional CHECK violation after the challenge write.
          env.DB.prepare(
            "UPDATE test_enrollment_ceremonies SET status = 'invalid' WHERE id = ?",
          ).bind(input.ceremonyId),
        ]);
      } catch {
        batchRejected = true;
      }

      const challenge = await env.DB.prepare(
        "SELECT consumed_at FROM test_enrollment_challenges WHERE id = ? AND ceremony_id = ?",
      ).bind(input.challengeId, input.ceremonyId).first<{ consumed_at: number | null }>();
      const ceremony = await env.DB.prepare(
        "SELECT status FROM test_enrollment_ceremonies WHERE id = ?",
      ).bind(input.ceremonyId).first<{ status: string }>();

      return json({
        batchRejected,
        challengeConsumptionRolledBack: challenge?.consumed_at === null,
        ceremonyStillPending: ceremony?.status === "pending",
      });
    }

    return json({ error: "not_found" }, 404);
  },
};
