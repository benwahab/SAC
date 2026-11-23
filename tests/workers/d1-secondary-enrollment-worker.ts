interface Env {
  DB: D1Database;
}

type SeedInput = {
  accountId: string;
  rootDeviceId: string;
  newDeviceId: string;
  ceremonyId: string;
  challengeId: string;
  challengeDigest: string;
  transcriptHash: string;
  now: number;
  expiresAt: number;
};

type ApprovalInput = {
  accountId: string;
  ceremonyId: string;
  challengeId: string;
  challengeDigest: string;
  rootDeviceId: string;
  newDeviceId: string;
  transcriptHash: string;
  idempotencyKey: string;
  now: number;
};

type RevokeInput = {
  accountId: string;
  rootDeviceId: string;
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

function isHex64(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 256;
}

function isNow(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

async function requestHash(input: ApprovalInput): Promise<string> {
  const stable = JSON.stringify([
    input.accountId,
    input.ceremonyId,
    input.challengeId,
    input.challengeDigest,
    input.rootDeviceId,
    input.newDeviceId,
    input.transcriptHash,
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stable));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function existingIdempotency(
  env: Env,
  accountId: string,
  key: string,
): Promise<{ request_hash: string; response_json: string } | null> {
  return await env.DB.prepare(
    "SELECT request_hash, response_json FROM test_enrollment_idempotency WHERE account_id = ? AND idempotency_key = ?",
  ).bind(accountId, key).first<{ request_hash: string; response_json: string }>();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") return json({ ok: true });

    if (url.pathname === "/state" && request.method === "GET") {
      const ceremonyId = url.searchParams.get("ceremonyId");
      if (!ceremonyId) return json({ error: "missing_ceremony_id" }, 400);

      const ceremony = await env.DB.prepare(
        "SELECT id, account_id, root_device_id, new_device_id, status, approved_at FROM test_enrollment_ceremonies WHERE id = ?",
      ).bind(ceremonyId).first();
      const challenge = await env.DB.prepare(
        "SELECT id, consumed_at, expires_at FROM test_enrollment_challenges WHERE ceremony_id = ?",
      ).bind(ceremonyId).first();
      const devices = await env.DB.prepare(
        "SELECT id, role, status, auth_version, activated_at, revoked_at FROM test_devices WHERE account_id = (SELECT account_id FROM test_enrollment_ceremonies WHERE id = ?) ORDER BY role",
      ).bind(ceremonyId).all();
      const certificateCount = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM test_device_certificates WHERE ceremony_id = ?",
      ).bind(ceremonyId).first<{ count: number }>();
      const guardCount = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM test_enrollment_commit_guard WHERE ceremony_id = ?",
      ).bind(ceremonyId).first<{ count: number }>();
      const auditCount = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM test_enrollment_audit WHERE ceremony_id = ?",
      ).bind(ceremonyId).first<{ count: number }>();
      const idempotencyCount = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM test_enrollment_idempotency WHERE account_id = (SELECT account_id FROM test_enrollment_ceremonies WHERE id = ?)",
      ).bind(ceremonyId).first<{ count: number }>();

      return json({
        ceremony,
        challenge,
        devices: devices.results,
        certificateCount: certificateCount?.count ?? 0,
        guardCount: guardCount?.count ?? 0,
        auditCount: auditCount?.count ?? 0,
        idempotencyCount: idempotencyCount?.count ?? 0,
      });
    }

    if (request.method !== "POST") return json({ error: "not_found" }, 404);

    if (url.pathname === "/seed") {
      const input = await readJson<SeedInput>(request);
      if (!input
        || !isId(input.accountId)
        || !isId(input.rootDeviceId)
        || !isId(input.newDeviceId)
        || input.rootDeviceId === input.newDeviceId
        || !isId(input.ceremonyId)
        || !isId(input.challengeId)
        || !isHex64(input.challengeDigest)
        || !isHex64(input.transcriptHash)
        || !isNow(input.now)
        || !isNow(input.expiresAt)
        || input.expiresAt <= input.now) {
        return json({ error: "invalid_seed" }, 400);
      }

      try {
        await env.DB.batch([
          env.DB.prepare("INSERT INTO test_accounts (id, status) VALUES (?, 'active')").bind(input.accountId),
          env.DB.prepare(
            "INSERT INTO test_devices (id, account_id, role, status, auth_version, created_at, activated_at, revoked_at) VALUES (?, ?, 'root', 'active', 1, ?, ?, NULL)",
          ).bind(input.rootDeviceId, input.accountId, input.now, input.now),
          env.DB.prepare(
            "INSERT INTO test_devices (id, account_id, role, status, auth_version, created_at, activated_at, revoked_at) VALUES (?, ?, 'secondary', 'pending', 1, ?, NULL, NULL)",
          ).bind(input.newDeviceId, input.accountId, input.now),
          env.DB.prepare(
            "INSERT INTO test_enrollment_ceremonies (id, account_id, root_device_id, new_device_id, transcript_hash, status, created_at, expires_at, approved_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NULL)",
          ).bind(input.ceremonyId, input.accountId, input.rootDeviceId, input.newDeviceId, input.transcriptHash, input.now, input.expiresAt),
          env.DB.prepare(
            "INSERT INTO test_enrollment_challenges (id, ceremony_id, account_id, challenge_digest, created_at, expires_at, consumed_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
          ).bind(input.challengeId, input.ceremonyId, input.accountId, input.challengeDigest, input.now, input.expiresAt),
        ]);
        return json({ seeded: true });
      } catch {
        return json({ error: "seed_rejected" }, 409);
      }
    }

    if (url.pathname === "/seed-ceremony") {
      const input = await readJson<SeedInput>(request);
      if (!input
        || !isId(input.accountId)
        || !isId(input.rootDeviceId)
        || !isId(input.newDeviceId)
        || input.rootDeviceId === input.newDeviceId
        || !isId(input.ceremonyId)
        || !isId(input.challengeId)
        || !isHex64(input.challengeDigest)
        || !isHex64(input.transcriptHash)
        || !isNow(input.now)
        || !isNow(input.expiresAt)
        || input.expiresAt <= input.now) {
        return json({ error: "invalid_seed" }, 400);
      }

      try {
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO test_devices (id, account_id, role, status, auth_version, created_at, activated_at, revoked_at) VALUES (?, ?, 'secondary', 'pending', 1, ?, NULL, NULL)",
          ).bind(input.newDeviceId, input.accountId, input.now),
          env.DB.prepare(
            "INSERT INTO test_enrollment_ceremonies (id, account_id, root_device_id, new_device_id, transcript_hash, status, created_at, expires_at, approved_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NULL)",
          ).bind(input.ceremonyId, input.accountId, input.rootDeviceId, input.newDeviceId, input.transcriptHash, input.now, input.expiresAt),
          env.DB.prepare(
            "INSERT INTO test_enrollment_challenges (id, ceremony_id, account_id, challenge_digest, created_at, expires_at, consumed_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
          ).bind(input.challengeId, input.ceremonyId, input.accountId, input.challengeDigest, input.now, input.expiresAt),
        ]);
        return json({ seeded: true });
      } catch {
        return json({ error: "seed_rejected" }, 409);
      }
    }

    if (url.pathname === "/approve") {
      const input = await readJson<ApprovalInput>(request);
      if (!input
        || !isId(input.accountId)
        || !isId(input.ceremonyId)
        || !isId(input.challengeId)
        || !isHex64(input.challengeDigest)
        || !isId(input.rootDeviceId)
        || !isId(input.newDeviceId)
        || !isHex64(input.transcriptHash)
        || typeof input.idempotencyKey !== "string"
        || input.idempotencyKey.length < 16
        || input.idempotencyKey.length > 128
        || !isNow(input.now)) {
        return json({ error: "invalid_approval" }, 400);
      }

      const hash = await requestHash(input);
      const existing = await existingIdempotency(env, input.accountId, input.idempotencyKey);
      if (existing) {
        if (existing.request_hash !== hash) return json({ error: "idempotency_conflict" }, 409);
        return json({ ...JSON.parse(existing.response_json) as Record<string, unknown>, replayed: true });
      }

      const certificateId = crypto.randomUUID();
      const responseBody = {
        approved: true,
        ceremonyId: input.ceremonyId,
        deviceId: input.newDeviceId,
        certificateId,
      };

      try {
        // One D1 batch is one transaction. The final guard is CHECK-constrained:
        // if any earlier conditional write did not take effect, it inserts 0 and
        // forces the whole batch to roll back.
        await env.DB.batch([
          env.DB.prepare(
            `UPDATE test_enrollment_challenges
             SET consumed_at = ?
             WHERE id = ?
               AND ceremony_id = ?
               AND account_id = ?
               AND challenge_digest = ?
               AND consumed_at IS NULL
               AND expires_at > ?`,
          ).bind(input.now, input.challengeId, input.ceremonyId, input.accountId, input.challengeDigest, input.now),
          env.DB.prepare(
            `UPDATE test_devices
             SET status = 'active', activated_at = ?, auth_version = auth_version + 1
             WHERE id = ? AND account_id = ? AND role = 'secondary' AND status = 'pending'
               AND EXISTS (
                 SELECT 1 FROM test_enrollment_ceremonies c
                 JOIN test_enrollment_challenges ch
                   ON ch.ceremony_id = c.id AND ch.account_id = c.account_id
                 JOIN test_devices r
                   ON r.id = c.root_device_id AND r.account_id = c.account_id
                 WHERE c.id = ? AND c.account_id = ?
                   AND c.new_device_id = ?
                   AND c.status = 'pending'
                   AND ch.id = ?
                   AND ch.consumed_at = ?
                   AND r.status = 'active'
               )`,
          ).bind(input.now, input.newDeviceId, input.accountId, input.ceremonyId, input.accountId, input.newDeviceId, input.challengeId, input.now),
          env.DB.prepare(
            `INSERT INTO test_device_certificates
             (id, ceremony_id, account_id, device_id, root_device_id, transcript_hash, certificate_hash, created_at)
             SELECT ?, c.id, c.account_id, c.new_device_id, c.root_device_id, c.transcript_hash, ?, ?
             FROM test_enrollment_ceremonies c
             JOIN test_enrollment_challenges ch
               ON ch.ceremony_id = c.id AND ch.account_id = c.account_id
             JOIN test_devices n
               ON n.id = c.new_device_id AND n.account_id = c.account_id
             JOIN test_devices r
               ON r.id = c.root_device_id AND r.account_id = c.account_id
             WHERE c.id = ? AND c.account_id = ?
               AND c.transcript_hash = ?
               AND c.status = 'pending'
               AND ch.consumed_at = ?
               AND n.status = 'active'
               AND r.status = 'active'`,
          ).bind(certificateId, hash, input.now, input.ceremonyId, input.accountId, input.transcriptHash, input.now),
          env.DB.prepare(
            `UPDATE test_enrollment_ceremonies
             SET status = 'approved', approved_at = ?
             WHERE id = ? AND account_id = ? AND status = 'pending'
               AND EXISTS (
                 SELECT 1 FROM test_device_certificates cert
                 WHERE cert.ceremony_id = ? AND cert.account_id = ?
               )`,
          ).bind(input.now, input.ceremonyId, input.accountId, input.ceremonyId, input.accountId),
          env.DB.prepare(
            `INSERT INTO test_enrollment_audit (account_id, ceremony_id, event_type, created_at, detail_hash)
             VALUES (?, ?, 'approved', ?, ?)`,
          ).bind(input.accountId, input.ceremonyId, input.now, hash),
          env.DB.prepare(
            `INSERT INTO test_enrollment_commit_guard (ceremony_id, accepted_rows)
             VALUES (?, CASE WHEN EXISTS (
               SELECT 1 FROM test_enrollment_ceremonies c
               JOIN test_enrollment_challenges ch
                 ON ch.ceremony_id = c.id AND ch.account_id = c.account_id
               JOIN test_device_certificates cert
                 ON cert.ceremony_id = c.id AND cert.account_id = c.account_id
               JOIN test_devices n
                 ON n.id = c.new_device_id AND n.account_id = c.account_id
               JOIN test_devices r
                 ON r.id = c.root_device_id AND r.account_id = c.account_id
               WHERE c.id = ? AND c.account_id = ?
                 AND c.status = 'approved'
                 AND ch.consumed_at IS NOT NULL
                 AND n.status = 'active'
                 AND r.status = 'active'
             ) THEN 1 ELSE 0 END)`,
          ).bind(input.ceremonyId, input.ceremonyId, input.accountId),
          env.DB.prepare(
            `INSERT INTO test_enrollment_idempotency (account_id, idempotency_key, request_hash, response_json, created_at)
             VALUES (?, ?, ?, ?, ?)`,
          ).bind(input.accountId, input.idempotencyKey, hash, JSON.stringify(responseBody), input.now),
        ]);
        return json({ ...responseBody, replayed: false });
      } catch {
        const afterRace = await existingIdempotency(env, input.accountId, input.idempotencyKey);
        if (afterRace && afterRace.request_hash === hash) {
          return json({ ...JSON.parse(afterRace.response_json) as Record<string, unknown>, replayed: true });
        }
        return json({ approved: false, reason: "enrollment_unavailable_or_replayed" }, 409);
      }
    }

    if (url.pathname === "/revoke-root") {
      const input = await readJson<RevokeInput>(request);
      if (!input || !isId(input.accountId) || !isId(input.rootDeviceId) || !isNow(input.now)) {
        return json({ error: "invalid_revocation" }, 400);
      }

      try {
        await env.DB.batch([
          env.DB.prepare(
            `UPDATE test_devices
             SET status = 'revoked', revoked_at = ?, auth_version = auth_version + 1
             WHERE id = ? AND account_id = ? AND role = 'root' AND status = 'active'`,
          ).bind(input.now, input.rootDeviceId, input.accountId),
          env.DB.prepare(
            `UPDATE test_devices
             SET status = 'revoked', revoked_at = ?, auth_version = auth_version + 1
             WHERE account_id = ? AND role = 'secondary' AND status = 'active'`,
          ).bind(input.now, input.accountId),
          env.DB.prepare(
            "UPDATE test_enrollment_ceremonies SET status = 'rejected' WHERE account_id = ? AND status = 'pending'",
          ).bind(input.accountId),
          env.DB.prepare(
            `INSERT INTO test_revocation_guard (account_id, accepted_rows)
             VALUES (?, CASE WHEN EXISTS (
               SELECT 1 FROM test_devices
               WHERE id = ? AND account_id = ? AND role = 'root' AND status = 'revoked'
             ) THEN 1 ELSE 0 END)`,
          ).bind(input.accountId, input.rootDeviceId, input.accountId),
        ]);
        return json({ revoked: true });
      } catch {
        return json({ revoked: false, reason: "root_unavailable_or_already_revoked" }, 409);
      }
    }

    return json({ error: "not_found" }, 404);
  },
};
