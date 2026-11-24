import { createPasswordSession, type PasswordSessionResult } from "./password-session.ts";
import { requestRootAuthentication, type RootAuthenticationOptions } from "./root-authentication.ts";

export type LoginStart =
  | { kind: "session"; session: PasswordSessionResult }
  | { kind: "security_key"; ceremony: RootAuthenticationOptions };

export async function startLogin(email: string, password: string, fetcher: typeof fetch = fetch): Promise<LoginStart> {
  try {
    return { kind: "session", session: await createPasswordSession(email, password, fetcher) };
  } catch (reason) {
    if (!(reason instanceof Error) || reason.message !== "security_key_required") throw reason;
    return { kind: "security_key", ceremony: await requestRootAuthentication(email, password, fetcher) };
  }
}
