import {
  isSecurityAnchorHead,
  isSecurityProjectionSynchronized,
  type SecurityAnchorHead,
} from "./security-anchor.ts";

export interface SecurityProjectionSnapshot {
  readonly sequence: number;
  readonly hash: string;
}

export interface SecurityAnchorAuthority {
  readHead(): Promise<SecurityAnchorHead>;
}

export type RestoreGateDecision =
  | { readonly ready: true; readonly head: SecurityAnchorHead }
  | {
      readonly ready: false;
      readonly reason:
        | "anchor_unavailable"
        | "anchor_invalid"
        | "projection_invalid"
        | "projection_ahead"
        | "projection_stale"
        | "head_mismatch";
    };

export async function evaluateRestoreGate(
  authority: SecurityAnchorAuthority,
  projection: SecurityProjectionSnapshot,
): Promise<RestoreGateDecision> {
  if (!isSecurityAnchorHead(projection)) {
    return { ready: false, reason: "projection_invalid" };
  }

  let head: unknown;
  try {
    head = await authority.readHead();
  } catch {
    return { ready: false, reason: "anchor_unavailable" };
  }

  if (!isSecurityAnchorHead(head)) {
    return { ready: false, reason: "anchor_invalid" };
  }

  if (projection.sequence > head.sequence) {
    return { ready: false, reason: "projection_ahead" };
  }
  if (projection.sequence < head.sequence) {
    return { ready: false, reason: "projection_stale" };
  }
  if (!isSecurityProjectionSynchronized(projection, head)) {
    return { ready: false, reason: "head_mismatch" };
  }

  return { ready: true, head };
}
