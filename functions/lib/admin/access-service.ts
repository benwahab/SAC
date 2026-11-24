export type AdminRole = "super_admin" | "delegate" | null;

export interface AdminAccessSummary {
  canAccess: boolean;
  role: AdminRole;
  activeMissions: number;
}

export async function readAdminAccess(db: D1Database, accountId: string): Promise<AdminAccessSummary> {
  const [role, missions] = await Promise.all([
    db.prepare(
      "SELECT 1 AS allowed FROM account_roles WHERE account_id = ? AND role = 'super_admin' LIMIT 1",
    ).bind(accountId).first<{ allowed: number }>(),
    db.prepare(
      "SELECT COUNT(*) AS count FROM admin_missions WHERE assigned_account_id = ? AND status = 'active'",
    ).bind(accountId).first<{ count: number }>(),
  ]);
  const superAdmin = Boolean(role?.allowed);
  const activeMissions = Number.isSafeInteger(missions?.count) ? missions!.count : 0;
  return {
    canAccess: superAdmin || activeMissions > 0,
    role: superAdmin ? "super_admin" : activeMissions > 0 ? "delegate" : null,
    activeMissions,
  };
}
