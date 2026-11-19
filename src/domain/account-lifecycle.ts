/**
 * Contrat métier pur de demande de suppression de compte.
 *
 * La suppression logique n'efface pas les données persistées : la politique
 * d'effacement/anonymisation, les délais légaux et les dépendances doivent
 * être définis séparément et exécutés atomiquement côté serveur.
 */
export type AccountLifecycleStatus = "pending_verification" | "active" | "suspended" | "deletion_pending" | "deleted";

export interface AccountLifecycleRecord {
  readonly accountId: string;
  readonly status: AccountLifecycleStatus;
  readonly createdAt: string;
  readonly deletionRequestedAt: string | null;
  readonly deletedAt: string | null;
}

export interface AccountActivityCounts {
  readonly activeAlerts: number;
  readonly activeTrips: number;
}

export type AccountLifecycleCommand =
  | { readonly type: "request_deletion"; readonly actorAccountId: string; readonly at: string }
  | { readonly type: "cancel_deletion"; readonly actorAccountId: string; readonly at: string }
  | { readonly type: "finalize_deletion"; readonly actorAccountId: "system"; readonly at: string; readonly activity: AccountActivityCounts }
  | { readonly type: "suspend_account"; readonly actorAccountId: string; readonly actorRole: string; readonly at: string }
  | { readonly type: "reinstate_account"; readonly actorAccountId: string; readonly actorRole: string; readonly at: string };

export type AccountLifecycleError =
  | "invalid_account"
  | "invalid_command"
  | "invalid_timestamp"
  | "event_before_account_creation"
  | "actor_not_owner"
  | "account_not_active"
  | "deletion_not_pending"
  | "active_alerts_remain"
  | "active_trips_remain"
  | "invalid_activity_counts"
  | "actor_not_super_admin"
  | "account_not_suspendable"
  | "account_not_suspended";

export type AccountLifecycleResult =
  | { readonly ok: true; readonly account: AccountLifecycleRecord; readonly allowNewActivity: boolean; readonly allowCloseExistingActivity: boolean }
  | { readonly ok: false; readonly error: AccountLifecycleError };

function isUtc(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isValidAccount(account: AccountLifecycleRecord): boolean {
  if (
    typeof account !== "object" ||
    account === null ||
    typeof account.accountId !== "string" ||
    typeof account.status !== "string" ||
    typeof account.createdAt !== "string" ||
    (account.deletionRequestedAt !== null && typeof account.deletionRequestedAt !== "string") ||
    (account.deletedAt !== null && typeof account.deletedAt !== "string") ||
    !account.accountId.trim() ||
    !isUtc(account.createdAt)
  ) return false;
  if (account.status === "pending_verification" || account.status === "active" || account.status === "suspended") {
    return account.deletionRequestedAt === null && account.deletedAt === null;
  }
  if (account.status === "deletion_pending") {
    return account.deletionRequestedAt !== null && isUtc(account.deletionRequestedAt) &&
      Date.parse(account.deletionRequestedAt) >= Date.parse(account.createdAt) && account.deletedAt === null;
  }
  if (account.status === "deleted") {
    return account.deletionRequestedAt !== null && isUtc(account.deletionRequestedAt) &&
      account.deletedAt !== null && isUtc(account.deletedAt) &&
      Date.parse(account.deletedAt) >= Date.parse(account.deletionRequestedAt);
  }
  return false;
}

function result(account: AccountLifecycleRecord): AccountLifecycleResult {
  return {
    ok: true,
    account,
    allowNewActivity: account.status === "active",
    allowCloseExistingActivity: account.status === "active" || account.status === "deletion_pending",
  };
}

export function transitionAccountLifecycle(
  account: AccountLifecycleRecord,
  command: AccountLifecycleCommand,
): AccountLifecycleResult {
  if (!isValidAccount(account)) return { ok: false, error: "invalid_account" };
  if (
    !command ||
    typeof command !== "object" ||
    typeof command.type !== "string" ||
    typeof command.at !== "string"
  ) {
    return { ok: false, error: "invalid_command" };
  }
  if (!isUtc(command.at)) return { ok: false, error: "invalid_timestamp" };
  if (Date.parse(command.at) < Date.parse(account.createdAt)) return { ok: false, error: "event_before_account_creation" };

  if (command.type === "request_deletion") {
    if (typeof command.actorAccountId !== "string" || command.actorAccountId !== account.accountId) return { ok: false, error: "actor_not_owner" };
    if (account.status !== "active") return { ok: false, error: "account_not_active" };
    return result({ ...account, status: "deletion_pending", deletionRequestedAt: command.at });
  }

  if (command.type === "cancel_deletion") {
    if (typeof command.actorAccountId !== "string" || command.actorAccountId !== account.accountId) return { ok: false, error: "actor_not_owner" };
    if (account.status !== "deletion_pending") return { ok: false, error: "deletion_not_pending" };
    if (Date.parse(command.at) < Date.parse(account.deletionRequestedAt!)) return { ok: false, error: "invalid_timestamp" };
    return result({ ...account, status: "active", deletionRequestedAt: null });
  }

  if (command.type === "suspend_account") {
    if (
      command.actorRole !== "super_admin" ||
      typeof command.actorAccountId !== "string" ||
      !command.actorAccountId.trim()
    ) {
      return { ok: false, error: "actor_not_super_admin" };
    }
    if (account.status !== "active") return { ok: false, error: "account_not_suspendable" };
    return result({ ...account, status: "suspended" });
  }

  if (command.type === "reinstate_account") {
    if (
      command.actorRole !== "super_admin" ||
      typeof command.actorAccountId !== "string" ||
      !command.actorAccountId.trim()
    ) {
      return { ok: false, error: "actor_not_super_admin" };
    }
    if (account.status !== "suspended") return { ok: false, error: "account_not_suspended" };
    return result({ ...account, status: "active" });
  }

  if (command.type === "finalize_deletion") {
    if (command.actorAccountId !== "system") return { ok: false, error: "invalid_command" };
    if (account.status !== "deletion_pending") return { ok: false, error: "deletion_not_pending" };
    if (
      !command.activity ||
      typeof command.activity !== "object" ||
      !Number.isSafeInteger(command.activity.activeAlerts) ||
      command.activity.activeAlerts < 0 ||
      !Number.isSafeInteger(command.activity.activeTrips) ||
      command.activity.activeTrips < 0
    ) {
      return { ok: false, error: "invalid_activity_counts" };
    }
    if (command.activity.activeAlerts > 0) return { ok: false, error: "active_alerts_remain" };
    if (command.activity.activeTrips > 0) return { ok: false, error: "active_trips_remain" };
    if (Date.parse(command.at) < Date.parse(account.deletionRequestedAt!)) return { ok: false, error: "invalid_timestamp" };
    return result({ ...account, status: "deleted", deletedAt: command.at });
  }

  return { ok: false, error: "invalid_command" };
}

/** L'autorisation métier est restreinte à la clôture des activités déjà ouvertes. */
export function canAccountCloseExistingActivity(status: AccountLifecycleStatus): boolean {
  return status === "active" || status === "deletion_pending";
}
