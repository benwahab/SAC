const HEX64 = /^[a-f0-9]{64}$/;
const encoder = new TextEncoder();
export interface SecurityAnchorHead {
  readonly sequence: number;
  readonly hash: string;
}

export interface SecurityProjectionHead {
  readonly sequence: number;
  readonly hash: string;
}

export function isSecurityAnchorHead(value: unknown): value is SecurityAnchorHead {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const head = value as Record<string, unknown>;
  return Number.isSafeInteger(head.sequence) &&
    (head.sequence as number) >= 0 &&
    typeof head.hash === "string" &&
    HEX64.test(head.hash);
}

export function isSecurityProjectionSynchronized(
  projection: SecurityProjectionHead,
  anchor: SecurityAnchorHead,
): boolean {
  return isSecurityAnchorHead(projection) &&
    isSecurityAnchorHead(anchor) &&
    projection.sequence === anchor.sequence &&
    projection.hash === anchor.hash;
}

export function isNextSecurityAnchorSequence(
  current: SecurityAnchorHead,
  next: SecurityAnchorHead,
): boolean {
  return isSecurityAnchorHead(current) &&
    isSecurityAnchorHead(next) &&
    next.sequence === current.sequence + 1;
}

export async function computeSecurityAnchorHash(
  sequence: number,
  previousHash: string,
  event: string,
  cryptoProvider: Crypto = globalThis.crypto,
): Promise<string> {
  if (!Number.isSafeInteger(sequence) || sequence < 1 || !HEX64.test(previousHash)) {
    throw new Error("security_anchor_invalid_entry");
  }
  const input = encoder.encode(sequence + "\n" + previousHash + "\n" + event);
  const bytes = new ArrayBuffer(input.byteLength);
  new Uint8Array(bytes).set(input);
  const digest = await cryptoProvider.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
