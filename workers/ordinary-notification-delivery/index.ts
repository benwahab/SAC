interface Env {
  PAGES_DISPATCH_URL?: string;
  INTERNAL_DISPATCH_TOKEN?: string;
}

async function requestDispatch(env: Env): Promise<void> {
  const url = env.PAGES_DISPATCH_URL?.trim();
  const token = env.INTERNAL_DISPATCH_TOKEN;
  if (!url || !token) {
    console.error("ordinary_dispatch_not_configured");
    return;
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    console.error("ordinary_dispatch_failed", response.status);
  }
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, context: ExecutionContext): Promise<void> {
    context.waitUntil(requestDispatch(env));
  },
};
