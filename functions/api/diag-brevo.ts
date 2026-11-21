interface Env {
  DIAG_TOKEN?: string;
  BREVO_API_KEY?: string;
  BREVO_FROM_EMAIL?: string;
  BREVO_FROM_NAME?: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DIAG_TOKEN || request.headers.get("x-sac-diag") !== env.DIAG_TOKEN) {
    return new Response("Not found", { status: 404 });
  }

  const result = {
    apiKeyPresent: Boolean(env.BREVO_API_KEY),
    fromEmailPresent: Boolean(env.BREVO_FROM_EMAIL),
    fromNamePresent: Boolean(env.BREVO_FROM_NAME),
    accountStatus: null as number | null,
    sendersStatus: null as number | null,
    senderFound: null as boolean | null,
    senderActive: null as boolean | null,
  };

  if (env.BREVO_API_KEY) {
    try {
      const accountResponse = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": env.BREVO_API_KEY, accept: "application/json" },
      });
      result.accountStatus = accountResponse.status;
    } catch {
      result.accountStatus = -1;
    }

    try {
      const sendersResponse = await fetch("https://api.brevo.com/v3/senders", {
        headers: { "api-key": env.BREVO_API_KEY, accept: "application/json" },
      });
      result.sendersStatus = sendersResponse.status;
      if (sendersResponse.ok) {
        const payload = await sendersResponse.json() as { senders?: Array<{ email?: string; active?: boolean }> };
        const target = env.BREVO_FROM_EMAIL?.trim().toLowerCase();
        const match = payload.senders?.find((sender) => sender.email?.trim().toLowerCase() === target);
        result.senderFound = Boolean(match);
        result.senderActive = match?.active ?? null;
      }
    } catch {
      result.sendersStatus = -1;
    }
  }

  return new Response(JSON.stringify(result), {
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" },
  });
};
