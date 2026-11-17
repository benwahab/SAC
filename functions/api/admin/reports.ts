interface Env { DB: D1Database; SAC_ADMIN_TOKEN?: string; }
interface Context { request: Request; env: Env; }

const json = (data: unknown, error: { code: string; message: string } | null, status = 200): Response =>
  Response.json({ success: error === null, data: error === null ? data : null, error }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

async function authorized(request: Request, env: Env): Promise<boolean> {
  const expected = env.SAC_ADMIN_TOKEN ?? "";
  const authorization = request.headers.get("Authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(authorization);
  const given = match?.[1] ?? "";
  if (!expected || expected.length !== given.length) return false;

  const [expectedDigest, givenDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(given)),
  ]);
  const left = new Uint8Array(expectedDigest);
  const right = new Uint8Array(givenDigest);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function isRateLimited(db: D1Database, key: string): Promise<boolean> {
  const minute = Math.floor(Date.now() / 60_000);
  await db.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(minute - 10).run();
  await db.prepare(
    "INSERT INTO rate_limits(rate_key,window_start,hits) VALUES(?,?,1) ON CONFLICT(rate_key,window_start) DO UPDATE SET hits=hits+1",
  ).bind(`admin:${key}`, minute).run();
  const row = await db.prepare("SELECT hits FROM rate_limits WHERE rate_key=? AND window_start=?")
    .bind(`admin:${key}`, minute).first<{ hits: number }>();
  return (row?.hits ?? 0) > 30;
}

async function authorizeRequest(request: Request, env: Env): Promise<Response | null> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (await isRateLimited(env.DB, ip)) {
    return json(null, { code: "RATE_LIMIT", message: "Trop de tentatives. Réessayez dans une minute." }, 429);
  }
  if (!await authorized(request, env)) {
    return json(null, { code: "UNAUTHORIZED", message: "Accès professionnel non autorisé." }, 401);
  }
  return null;
}

export async function onRequestGet({ request, env }: Context): Promise<Response> {
  const denied = await authorizeRequest(request, env);
  if (denied) return denied;

  const rows = await env.DB.prepare(
    "SELECT id,category,urgency,description,latitude,longitude,status,moderation_status,created_at AS createdAt FROM reports ORDER BY created_at DESC LIMIT 200",
  ).all();
  return json(rows.results ?? [], null);
}

export async function onRequestPut({ request, env }: Context): Promise<Response> {
  const denied = await authorizeRequest(request, env);
  if (denied) return denied;

  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (contentLength > 16_384) {
    return json(null, { code: "REQUEST_TOO_LARGE", message: "La requête dépasse la taille autorisée." }, 413);
  }

  let body: { id?: unknown; status?: unknown; moderationStatus?: unknown; note?: unknown } | null;
  try {
    body = await request.json() as typeof body;
  } catch {
    return json(null, { code: "INVALID_JSON", message: "Le contenu transmis est invalide." }, 400);
  }

  if (!body || typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) {
    return json(null, { code: "VALIDATION", message: "Identifiant de signalement invalide." }, 400);
  }
  if ((body.status !== undefined && (typeof body.status !== "string" || !["received", "in_progress", "resolved"].includes(body.status))) ||
      (body.moderationStatus !== undefined && (typeof body.moderationStatus !== "string" || !["pending", "approved", "rejected"].includes(body.moderationStatus))) ||
      (body.status === undefined && body.moderationStatus === undefined) ||
      (body.note !== undefined && (typeof body.note !== "string" || body.note.length > 500))) {
    return json(null, { code: "VALIDATION", message: "Les valeurs de mise à jour sont invalides." }, 400);
  }

  const old = await env.DB.prepare(
    "SELECT status,moderation_status FROM reports WHERE id=?",
  ).bind(body.id).first<{ status: string; moderation_status: string }>();
  if (!old) return json(null, { code: "NOT_FOUND", message: "Signalement introuvable." }, 404);

  const status = typeof body.status === "string" ? body.status : old.status;
  const moderation = typeof body.moderationStatus === "string" ? body.moderationStatus : old.moderation_status;
  const now = new Date().toISOString();
  const note = typeof body.note === "string" ? body.note.trim() : (
    body.moderationStatus !== undefined ? `Modération : ${moderation}` : "Mise à jour du traitement"
  );

  try {
    const update = env.DB.prepare(
      "UPDATE reports SET status=?,moderation_status=?,updated_at=? WHERE id=?",
    ).bind(status, moderation, now, body.id);
    const history = env.DB.prepare(
      "INSERT INTO report_updates(id,report_id,old_status,new_status,note,created_at) VALUES(?,?,?,?,?,?)",
    ).bind(crypto.randomUUID(), body.id, old.status, status, note, now);
    await env.DB.batch([update, history]);
  } catch {
    return json(null, { code: "UPDATE_FAILED", message: "La mise à jour n'a pas pu être enregistrée." }, 500);
  }

  return json({ id: body.id, status, moderationStatus: moderation, updatedAt: now }, null);
}
