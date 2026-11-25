import { requireAuthenticatedDeviceSession } from "../../lib/security/require-authenticated-device-session.ts";
import { listTrustedContacts, listTrustedBy } from "../../lib/trusted-contacts/service.ts";

interface Env { DB: D1Database; }

const HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireAuthenticatedDeviceSession(request, env.DB);
  if (!session.ok) {
    return json(
      { error: session.status === 401 ? "authentication_required" : "contacts_unavailable" },
      session.status,
    );
  }

  const [result, trustedBy] = await Promise.all([
    listTrustedContacts(env.DB, session.value.accountId),
    listTrustedBy(env.DB, session.value.accountId),
  ]);
  if (!result.ok || !trustedBy.ok) {
    return json({ error: "contacts_unavailable" }, 503);
  }

  return json({
    contacts: result.value.map((contact) => ({
      accountId: contact.accountId,
      email: contact.email,
      createdAt: contact.createdAt,
    })),
    trustedBy: trustedBy.value.map((relationship) => ({
      ownerAccountId: relationship.ownerAccountId,
      email: relationship.email,
      createdAt: relationship.createdAt,
    })),
  });
};
