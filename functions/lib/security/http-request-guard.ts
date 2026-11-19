const HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function reject(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), { status, headers: HEADERS });
}

/**
 * Garde commune des endpoints JSON mutatifs exposés par la PWA.
 * Elle refuse les requêtes cross-origin et les corps qui ne sont pas JSON.
 * Elle ne remplace ni l'authentification, ni les contrôles d'autorisation,
 * ni une protection CSRF liée à une future session par cookie.
 */
export function guardSameOriginJsonPost(request: Request): Response | null {
  if (request.method !== "POST") return reject("method_not_allowed", 405);

  const origin = request.headers.get("Origin");
  if (!origin) return reject("origin_required", 403);

  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(request.url).origin;
  } catch {
    return reject("invalid_request_origin", 400);
  }

  if (origin !== expectedOrigin) return reject("cross_origin_request", 403);

  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return reject("cross_site_request", 403);
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType.trim())) {
    return reject("json_content_type_required", 415);
  }

  return null;
}
