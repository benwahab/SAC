interface Env {
  DIAG_TOKEN?: string;
  DB?: D1Database;
  EMAIL_OTP_HMAC_SECRET?: string;
  BREVO_API_KEY?: string;
  BREVO_FROM_EMAIL?: string;
  BREVO_FROM_NAME?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DIAG_TOKEN || request.headers.get("x-sac-diag") !== env.DIAG_TOKEN) {
    return new Response("Not found", { status: 404 });
  }

  const hmacPresent = Boolean(env.EMAIL_OTP_HMAC_SECRET);
  const hmacValidLength = hmacPresent && (env.EMAIL_OTP_HMAC_SECRET?.length ?? 0) >= 32;
  const brevoApiKeyPresent = Boolean(env.BREVO_API_KEY);
  const brevoFromEmailPresent = Boolean(env.BREVO_FROM_EMAIL);
  const brevoFromNamePresent = Boolean(env.BREVO_FROM_NAME);

  let brevoAccountStatus: number | null = null;
  let brevoSendersStatus: number | null = null;
  let senderFound: boolean | null = null;
  let senderActive: boolean | null = null;

  if (env.BREVO_API_KEY) {
    try {
      const accountResponse = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": env.BREVO_API_KEY, accept: "application/json" },
      });
      brevoAccountStatus = accountResponse.status;
    } catch {
      brevoAccountStatus = -1;
    }

    try {
      const sendersResponse = await fetch("https://api.brevo.com/v3/senders", {
        headers: { "api-key": env.BREVO_API_KEY, accept: "application/json" },
      });
      brevoSendersStatus = sendersResponse.status;
      if (sendersResponse.ok) {
        const payload = await sendersResponse.json() as { senders?: Array<{ email?: string; active?: boolean }> };
        const target = env.BREVO_FROM_EMAIL?.trim().toLowerCase();
        const match = payload.senders?.find((sender) => sender.email?.trim().toLowerCase() === target);
        senderFound = Boolean(match);
        senderActive = match?.active ?? null;
      }
    } catch {
      brevoSendersStatus = -1;
    }
  }

  return json({
    db: Boolean(env.DB),
    hmacPresent,
    hmacValidLength,
    brevoApiKeyPresent,
    brevoFromEmailPresent,
    brevoFromNamePresent,
    brevoAccountStatus,
    brevoSendersStatus,
    senderFound,
    senderActive,
  });
};
