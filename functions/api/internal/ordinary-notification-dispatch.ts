import {
  runOrdinaryNotificationDispatch,
  type OrdinaryDispatchEnvironment,
} from "../../lib/notifications/ordinary-dispatch.ts";

interface Env extends OrdinaryDispatchEnvironment {
  DB: D1Database;
  INTERNAL_DISPATCH_TOKEN?: string;
}

const HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

async function tokenMatches(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const expected = env.INTERNAL_DISPATCH_TOKEN;
  if (!expected || expected.length < 32) return json({ error: "dispatch_not_configured" }, 503);
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ") || !(await tokenMatches(header.slice(7), expected))) {
    return json({ error: "unauthorized" }, 401);
  }

  await runOrdinaryNotificationDispatch(env.DB, env, Date.now());
  return json({ ok: true });
};
