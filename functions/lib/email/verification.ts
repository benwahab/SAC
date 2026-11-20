import { sendBrevoTransactionalEmail, type BrevoEmailEnvironment } from "./brevo.ts";

export type SacEmailLanguage = "fr" | "en" | "ar";
export type EmailDeliveryResult =
  | { ok: true; messageId: string }
  | { ok: false; reason: "provider_not_configured" | "invalid_recipient" | "provider_rejected" | "provider_unavailable" | "invalid_code" | "invalid_language" };

const copy: Record<SacEmailLanguage, { subject: string; title: string; instruction: string; safety: string }> = {
  fr: { subject: "Votre code de vérification SAC", title: "Vérification de votre adresse e-mail", instruction: "Saisissez ce code dans SAC pour vérifier votre adresse e-mail :", safety: "Si vous n'avez pas demandé ce code, ignorez cet e-mail. Ne communiquez jamais ce code à une autre personne." },
  en: { subject: "Your SAC verification code", title: "Verify your email address", instruction: "Enter this code in SAC to verify your email address:", safety: "If you did not request this code, ignore this email. Never share this code with anyone." },
  ar: { subject: "رمز التحقق الخاص بك في SAC", title: "التحقق من عنوان بريدك الإلكتروني", instruction: "أدخل هذا الرمز في SAC للتحقق من عنوان بريدك الإلكتروني:", safety: "إذا لم تطلب هذا الرمز، فتجاهل هذه الرسالة. لا تشارك الرمز مع أي شخص." },
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export async function sendAccountVerificationCode(
  env: BrevoEmailEnvironment,
  recipient: string,
  code: string,
  language: SacEmailLanguage,
  fetcher: typeof fetch = fetch,
): Promise<EmailDeliveryResult> {
  if (!Object.prototype.hasOwnProperty.call(copy, language)) return { ok: false, reason: "invalid_language" };
  const normalizedRecipient = recipient.trim();
  if (normalizedRecipient.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedRecipient)) return { ok: false, reason: "invalid_recipient" };
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: "invalid_code" };
  const template = copy[language];
  const direction = language === "ar" ? "rtl" : "ltr";
  const htmlContent = `<!doctype html>
<html lang="${language}" dir="${direction}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${template.title}</title></head>
<body style="margin:0;padding:32px 16px;background:#f2f8f4;font-family:Arial,sans-serif;color:#17352b">
<main style="max-width:520px;margin:0 auto;padding:32px;border:1px solid #d8e9df;border-radius:20px;background:#fff">
<p style="font-size:13px;font-weight:700;letter-spacing:3px;color:#438b6b">SAC</p>
<h1 style="font-size:23px">${template.title}</h1><p style="font-size:15px;line-height:1.6">${template.instruction}</p>
<p dir="ltr" style="margin:28px 0;padding:18px;text-align:center;border-radius:12px;background:#eef7f1;font-size:32px;font-weight:700;letter-spacing:8px">${escapeHtml(code)}</p>
<p style="font-size:12px;line-height:1.6;color:#60756b">${template.safety}</p></main></body></html>`;
  const result = await sendBrevoTransactionalEmail(env, { recipientEmail: normalizedRecipient, subject: template.subject, htmlContent }, fetcher);
  return result.ok ? result : { ok: false, reason: result.reason };
}
