interface Env { DB: D1Database; MEDIA?: R2Bucket; }
interface Context { request: Request; env: Env; }

const categories = ["danger", "accident", "medical", "fire", "infrastructure"];
const urgencies = ["low", "medium", "high", "critical"];
const maximumMediaBytes = 8 * 1024 * 1024;

function json<T>(data: T | null, error: { code: string; message: string } | null, status = 200): Response {
  return Response.json({ success: error === null, data: error === null ? data : null, error }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function isRateLimited(db: D1Database, key: string): Promise<boolean> {
  const minute = Math.floor(Date.now() / 60_000);
  await db.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(minute - 10).run();
  await db.prepare(
    "INSERT INTO rate_limits(rate_key,window_start,hits) VALUES(?,?,1) ON CONFLICT(rate_key,window_start) DO UPDATE SET hits=hits+1",
  ).bind(key, minute).run();
  const row = await db.prepare("SELECT hits FROM rate_limits WHERE rate_key=? AND window_start=?")
    .bind(key, minute).first<{ hits: number }>();
  return (row?.hits ?? 0) > 5;
}

function hasValidSignature(type: string, bytes: Uint8Array): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (type === "audio/webm") return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (type === "audio/mpeg") return String.fromCharCode(...bytes.slice(0, 3)) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (type === "audio/mp4") return String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  return false;
}

export async function onRequestGet({ request, env }: Context): Promise<Response> {
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const normalized = code.trim().toUpperCase();
    if (!/^SAC-[A-F0-9]{36}$/.test(normalized)) {
      return json(null, { code: "INVALID_CODE", message: "Code de suivi invalide." }, 400);
    }
    const row = await env.DB.prepare(
      "SELECT id,category,status,created_at AS createdAt,updated_at AS updatedAt FROM reports WHERE tracking_code_hash=? LIMIT 1",
    ).bind(await sha256(normalized)).first<{ id: string; category: string; status: string; createdAt: string; updatedAt: string }>();
    if (!row) return json(null, { code: "NOT_FOUND", message: "Aucun signalement ne correspond à ce code." }, 404);
    return json({
      reference: row.id.slice(0, 8).toUpperCase(),
      category: row.category,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }, null);
  }

  const rows = await env.DB.prepare(
    "SELECT id,category,urgency,status,description,latitude,longitude,created_at AS createdAt FROM reports WHERE moderation_status='approved' ORDER BY created_at DESC LIMIT 50",
  ).all();
  return json(rows.results ?? [], null);
}

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (contentLength > maximumMediaBytes + 1_048_576) {
    return json(null, { code: "REQUEST_TOO_LARGE", message: "La requête dépasse la taille autorisée." }, 413);
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (await isRateLimited(env.DB, ip)) {
    return json(null, { code: "RATE_LIMIT", message: "Trop de tentatives. Réessayez dans une minute." }, 429);
  }

  if (!(request.headers.get("Content-Type") ?? "").toLowerCase().includes("multipart/form-data")) {
    return json(null, { code: "CONTENT_TYPE", message: "Format de requête invalide." }, 415);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(null, { code: "INVALID_FORM", message: "Le formulaire transmis est invalide." }, 400);
  }

  const value = (key: string): string => {
    const item = form.get(key);
    return typeof item === "string" ? item.trim() : "";
  };

  const category = value("category");
  const urgency = value("urgency");
  const description = value("description");
  const latitudeText = value("latitude");
  const longitudeText = value("longitude");
  const address = value("addressApprox").slice(0, 160);

  if (!categories.includes(category) || !urgencies.includes(urgency) || description.length > 1000) {
    return json(null, { code: "VALIDATION", message: "Catégorie, urgence ou description invalide." }, 400);
  }

  const latitude = latitudeText === "" ? null : Number(latitudeText);
  const longitude = longitudeText === "" ? null : Number(longitudeText);
  if ((latitude === null) !== (longitude === null) ||
      (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      longitude === null || !Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
    return json(null, { code: "LOCATION", message: "Coordonnées invalides." }, 400);
  }

  const mediaValue = form.get("media");
  const media = mediaValue instanceof File && mediaValue.size > 0 ? mediaValue : null;
  let mediaKey: string | null = null;
  let mediaType: string | null = null;

  if (media) {
    if (!env.MEDIA) {
      return json(null, { code: "MEDIA_NOT_CONFIGURED", message: "Le stockage des pièces jointes n'est pas encore activé. Vous pouvez envoyer le signalement sans pièce jointe." }, 503);
    }
    if (media.size > maximumMediaBytes) {
      return json(null, { code: "MEDIA_TOO_LARGE", message: "Le fichier dépasse la limite de 8 Mo." }, 413);
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "audio/webm", "audio/mpeg", "audio/mp4"];
    if (!allowedTypes.includes(media.type)) {
      return json(null, { code: "MEDIA_TYPE", message: "Ce format de fichier n'est pas accepté." }, 415);
    }
    const bytes = new Uint8Array(await media.arrayBuffer());
    if (!hasValidSignature(media.type, bytes)) {
      return json(null, { code: "MEDIA_SIGNATURE", message: "Le contenu du fichier ne correspond pas à son format déclaré." }, 415);
    }
    mediaKey = `reports/${crypto.randomUUID()}`;
    mediaType = media.type;
  }

  const random = crypto.getRandomValues(new Uint8Array(18));
  const trackingCode = "SAC-" + Array.from(random, byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    if (media && mediaKey && env.MEDIA) {
      await env.MEDIA.put(mediaKey, media.stream(), { httpMetadata: { contentType: mediaType ?? "application/octet-stream" } });
    }

    const insertReport = env.DB.prepare(
      "INSERT INTO reports(id,category,urgency,description,latitude,longitude,address_approx,status,moderation_status,tracking_code_hash,media_key,media_type,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'received','pending',?,?,?,?,?)",
    ).bind(id, category, urgency, description, latitude, longitude, address, await sha256(trackingCode), mediaKey, mediaType, now, now);
    const insertHistory = env.DB.prepare(
      "INSERT INTO report_updates(id,report_id,old_status,new_status,note,created_at) VALUES(?,?,NULL,'received','Signalement citoyen enregistré',?)",
    ).bind(crypto.randomUUID(), id, now);

    // D1 batch exécute les deux écritures dans une même transaction.
    await env.DB.batch([insertReport, insertHistory]);
  } catch {
    if (mediaKey && env.MEDIA) {
      try { await env.MEDIA.delete(mediaKey); } catch { /* Nettoyage à retenter via une tâche dédiée. */ }
    }
    return json(null, { code: "SAVE_FAILED", message: "Le signalement n'a pas pu être enregistré." }, 500);
  }

  return json({ trackingCode, reference: id.slice(0, 8).toUpperCase() }, null, 201);
}
