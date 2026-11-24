type FetchPort = typeof fetch;

export interface PasswordSessionResult {
  authenticated: true;
  securityKeyConfigured: boolean;
  session: { id: string; expiresAt: string };
}

export async function createPasswordSession(
  email: string,
  password: string,
  fetcher: FetchPort = fetch,
): Promise<PasswordSessionResult> {
  const response = await fetcher("/api/auth/password-session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const payload = await response.json() as PasswordSessionResult & { error?: string };
  if (!response.ok || !payload.authenticated || !payload.session?.id) {
    throw new Error(payload.error ?? "authentication_unavailable");
  }
  return payload;
}
