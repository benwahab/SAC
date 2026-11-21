import {
  requireAuthenticatedDeviceSession,
  type AuthenticatedDeviceSession,
} from "./require-authenticated-device-session.ts";

export type SuperAdminSessionResult =
  | { readonly ok: true; readonly value: AuthenticatedDeviceSession }
  | { readonly ok: false; readonly status: 401 | 403 | 503 };

/**
 * Vérifie la session appareil puis le rôle persistant dans D1.
 * Aucun rôle, e-mail ou identifiant de compte fourni par le client n'est accepté.
 */
export async function requireSuperAdminSession(
  request: Request,
  db: D1Database | undefined,
): Promise<SuperAdminSessionResult> {
  const authenticated = await requireAuthenticatedDeviceSession(request, db);
  if (!authenticated.ok) return authenticated;
  try {
    const role = await db!.prepare(
      "SELECT 1 AS allowed FROM account_roles WHERE account_id = ? AND role = 'super_admin' LIMIT 1",
    ).bind(authenticated.value.accountId).first<{ allowed: number }>();
    if (!role) return { ok: false, status: 403 };
    return { ok: true, value: authenticated.value };
  } catch {
    return { ok: false, status: 503 };
  }
}
