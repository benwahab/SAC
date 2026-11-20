import { sendBrevoTransactionalEmail } from "./brevo.ts";
import type { SacEmailLanguage } from "./verification.ts";

export interface ContactInvitationEmailEnvironment {
  readonly BREVO_API_KEY?: string;
  readonly BREVO_FROM_EMAIL?: string;
  readonly BREVO_FROM_NAME?: string;
  readonly APP_BASE_URL?: string;
}

export type ContactInvitationEmailResult =
  | { readonly ok: true; readonly messageId: string }
  | {
      readonly ok: false;
      readonly reason: "provider_not_configured" | "invalid_invitation" | "provider_rejected" | "provider_unavailable";
    };



const copy: Record<SacEmailLanguage, {
  subject: string;
  title: string;
  greeting: string;
  instruction: string;
  action: string;
  expiry: string;
  safety: string;
}> = {
  fr: {
    subject: "Invitation à rejoindre vos proches sur SAC",
    title: "Vous êtes invité(e) à rejoindre un cercle de confiance",
    greeting: "Une personne souhaite vous ajouter à ses proches sur SAC.",
    instruction: "Connectez-vous à votre compte SAC pour accepter ou refuser cette invitation.",
    action: "Consulter l'invitation",
    expiry: "Cette invitation expire le",
    safety: "Si vous ne connaissez pas la personne à l'origine de cette invitation, refusez-la. Ne transférez pas ce lien : il permet de répondre à l'invitation.",
  },
  en: {
    subject: "You have been invited to join a trusted circle on SAC",
    title: "You have been invited to join a trusted circle",
    greeting: "Someone wants to add you to their trusted contacts on SAC.",
    instruction: "Sign in to your SAC account to accept or decline this invitation.",
    action: "View invitation",
    expiry: "This invitation expires on",
    safety: "If you do not recognize the person who invited you, decline the invitation. Do not forward this link; it can be used to respond to the invitation.",
  },
  ar: {
    subject: "دعوة للانضمام إلى دائرة الثقة على SAC",
    title: "لقد تمت دعوتك للانضمام إلى دائرة ثقة",
    greeting: "يرغب شخص ما في إضافتك إلى جهات الاتصال الموثوقة لديه على SAC.",
    instruction: "سجّل الدخول إلى حساب SAC لقبول الدعوة أو رفضها.",
    action: "عرض الدعوة",
    expiry: "تنتهي صلاحية هذه الدعوة في",
    safety: "إذا كنت لا تعرف الشخص الذي أرسل الدعوة، فارفضها. لا تُعد توجيه هذا الرابط لأنه يتيح الرد على الدعوة.",
  },
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

function buildInvitationUrl(baseUrl: string, invitationId: string, token: string): string | null {
  try {
    const base = new URL(baseUrl);
    if (
      base.protocol !== "https:" ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname !== "/"
    ) return null;
    const url = new URL("/invitation/accept", base.origin);
    url.searchParams.set("id", invitationId);
    url.searchParams.set("token", token);
    return url.toString();
  } catch {
    return null;
  }
}

/** Sends the one-time invitation link. It never logs or persists the raw token. */
export async function sendContactInvitationEmail(
  env: ContactInvitationEmailEnvironment,
  input: {
    readonly recipientEmail: string;
    readonly invitationId: string;
    readonly token: string;
    readonly expiresAt: number;
    readonly language: SacEmailLanguage;
  },
  fetcher: typeof fetch = fetch,
): Promise<ContactInvitationEmailResult> {
  const apiKey = env.BREVO_API_KEY?.trim();
  const from = env.BREVO_FROM_EMAIL?.trim();
  const fromName = env.BREVO_FROM_NAME?.trim();
  const baseUrl = env.APP_BASE_URL?.trim();
  if (!apiKey || !from || !fromName || !baseUrl) return { ok: false, reason: "provider_not_configured" };

  const recipientEmail = input.recipientEmail.trim().toLowerCase();
  if (
    recipientEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail) ||
    !/^[0-9a-f-]{36}$/i.test(input.invitationId) ||
    !/^[A-Za-z0-9_-]{43}$/.test(input.token) ||
    !Number.isSafeInteger(input.expiresAt) ||
    input.expiresAt <= Date.now()
  ) return { ok: false, reason: "invalid_invitation" };

  const invitationUrl = buildInvitationUrl(baseUrl, input.invitationId, input.token);
  if (!invitationUrl) return { ok: false, reason: "invalid_invitation" };

  const template = copy[input.language];
  const safeUrl = escapeHtml(invitationUrl);
  const safeExpiry = escapeHtml(new Date(input.expiresAt).toLocaleString(input.language));
  const direction = input.language === "ar" ? "rtl" : "ltr";
  const html = `<!doctype html>
<html lang="${input.language}" dir="${direction}">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:32px 16px;background:#f2f8f4;font-family:Arial,sans-serif;color:#17352b">
    <main style="max-width:540px;margin:0 auto;padding:32px;border:1px solid #d8e9df;border-radius:20px;background:#fff">
      <p style="font-size:13px;font-weight:700;letter-spacing:3px;color:#438b6b">SAC</p>
      <h1 style="font-size:23px;line-height:1.35">${template.title}</h1>
      <p style="font-size:15px;line-height:1.6">${template.greeting}</p>
      <p style="font-size:15px;line-height:1.6">${template.instruction}</p>
      <p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#438b6b;color:#fff;text-decoration:none;font-weight:700">${template.action}</a></p>
      <p style="font-size:12px;line-height:1.6;color:#60756b">${template.expiry} <span dir="ltr">${safeExpiry}</span></p>
      <p style="font-size:12px;line-height:1.6;color:#60756b">${template.safety}</p>
    </main>
  </body>
</html>`;

  try {
    const result = await sendBrevoTransactionalEmail(
      { BREVO_API_KEY: apiKey, BREVO_FROM_EMAIL: from, BREVO_FROM_NAME: fromName },
      { recipientEmail, subject: template.subject, htmlContent: html },
      fetcher,
    );
    return result.ok ? result : { ok: false, reason: result.reason === "invalid_recipient" ? "invalid_invitation" : result.reason };
  } catch {
    return { ok: false, reason: "provider_unavailable" };
  }
}
