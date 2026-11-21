import { requireAuthenticatedDeviceSession } from "../../../lib/security/require-authenticated-device-session.ts";
import { getAuthorizedPhoto } from "../../../lib/account/profile-service.ts";

interface Env { DB: D1Database; }

function notFound(): Response {
  return new Response(null, {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export const onRequestGet: PagesFunction<Env, "accountId"> = async ({ request, env, params }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) return new Response(null, { status: session.status, headers: { "Cache-Control": "no-store" } });
  const accountId = params.accountId;
  if (typeof accountId !== "string" || !accountId.trim() || accountId.length > 128) return notFound();

  const result = await getAuthorizedPhoto(env.DB, session.value.accountId, accountId);
  if (!result.ok) return notFound();

  const etag = `"v${result.value.version}"`;
  if (request.headers.get("If-None-Match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "private, no-cache",
        "Cross-Origin-Resource-Policy": "same-origin",
        Vary: "Cookie",
      },
    });
  }

  let binary: string;
  try {
    binary = atob(result.value.base64);
  } catch {
    return notFound();
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Response(bytes, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-cache",
      "Content-Type": result.value.mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Resource-Policy": "same-origin",
      ETag: etag,
      Vary: "Cookie",
    },
  });
};
