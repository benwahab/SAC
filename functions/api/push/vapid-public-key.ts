interface Env { PUSH_VAPID_PUBLIC_KEY?: string; }

const HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

function isValidPublicKey(value: string | undefined): value is string {
  if (!value || !/^[A-Za-z0-9_-]{80,100}$/.test(value)) return false;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), c => c.charCodeAt(0));
    return bytes.byteLength === 65 && bytes[0] === 4;
  } catch {
    return false;
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!isValidPublicKey(env.PUSH_VAPID_PUBLIC_KEY)) {
    return json({ error: "push_delivery_not_configured" }, 503);
  }
  return json({ publicKey: env.PUSH_VAPID_PUBLIC_KEY });
};
