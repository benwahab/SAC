export interface BrevoEmailEnvironment {
  readonly BREVO_API_KEY?: string;
  readonly BREVO_FROM_EMAIL?: string;
  readonly BREVO_FROM_NAME?: string;
}
export type BrevoSendResult =
  | { readonly ok: true; readonly messageId: string }
  | { readonly ok: false; readonly reason: "provider_not_configured" | "invalid_recipient" | "provider_rejected" | "provider_unavailable" };

const ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const MAX_RESPONSE_BYTES = 4096;

async function readBoundedJson(response: Response): Promise<unknown | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        try { void reader.cancel().catch(() => undefined); } catch { /* bounded rejection */ }
        return null;
      }
      chunks.push(value);
    }
  } catch { return null; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown; }
  catch { return null; }
}

export async function sendBrevoTransactionalEmail(
  env: BrevoEmailEnvironment,
  input: { readonly recipientEmail: string; readonly subject: string; readonly htmlContent: string },
  fetcher: typeof fetch = fetch,
): Promise<BrevoSendResult> {
  const apiKey = env.BREVO_API_KEY?.trim();
  const senderEmail = env.BREVO_FROM_EMAIL?.trim();
  const senderName = env.BREVO_FROM_NAME?.trim();
  if (!apiKey || !senderEmail || !senderName) return { ok: false, reason: "provider_not_configured" };
  const recipientEmail = input.recipientEmail.trim().toLowerCase();
  if (recipientEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) return { ok: false, reason: "invalid_recipient" };
  let response: Response;
  try {
    response = await fetcher(ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      headers: { "api-key": apiKey, "accept": "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: recipientEmail }],
        subject: input.subject,
        htmlContent: input.htmlContent,
      }),
    });
  } catch { return { ok: false, reason: "provider_unavailable" }; }
  if (!response.ok) return { ok: false, reason: "provider_rejected" };
  const payload = await readBoundedJson(response);
  if (typeof payload === "object" && payload !== null && "messageId" in payload &&
      typeof payload.messageId === "string" && payload.messageId.length > 0) {
    return { ok: true, messageId: payload.messageId };
  }
  return { ok: false, reason: "provider_rejected" };
}
