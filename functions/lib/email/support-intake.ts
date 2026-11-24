import { sendBrevoTransactionalEmail, type BrevoEmailEnvironment } from "./brevo.ts";

export type SupportEmailLanguage = "fr" | "en" | "ar";
export type SupportOtpDelivery =
  | { ok: true; messageId: string }
  | { ok: false; reason: string };

const copy: Record<SupportEmailLanguage, { subject: string; title: string; instruction: string; safety: string }> = {
  fr: { subject: "Votre code pour contacter l’assistance SAC", title: "Vérification de votre adresse e-mail", instruction: "Saisissez ce code pour envoyer votre demande d’assistance SAC :", safety: "Ce code ne permet pas de réinitialiser votre compte. Si vous n’avez pas demandé ce code, ignorez cet e-mail et ne le partagez jamais." },
  en: { subject: "Your SAC support request code", title: "Verify your email address", instruction: "Enter this code to submit your SAC support request:", safety: "This code does not reset your account. If you did not request it, ignore this email and never share the code." },
  ar: { subject: "رمز طلب المساعدة في SAC", title: "التحقق من عنوان بريدك الإلكتروني", instruction: "أدخل هذا الرمز لإرسال طلب المساعدة إلى SAC:", safety: "هذا الرمز لا يعيد تعيين حسابك. إذا لم تطلبه، فتجاهل الرسالة ولا تشاركه." },
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export async function sendSupportTicketIntakeCode(
  env: BrevoEmailEnvironment,
  recipient: string,
  code: string,
  language: SupportEmailLanguage,
  fetcher: typeof fetch = fetch,
): Promise<SupportOtpDelivery> {
  if (!Object.prototype.hasOwnProperty.call(copy, language)) return { ok: false, reason: "invalid_language" };
  if (recipient.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || !/^\d{6}$/.test(code)) return { ok: false, reason: "invalid_input" };
  const template = copy[language];
  const direction = language === "ar" ? "rtl" : "ltr";
  const htmlContent = `<!doctype html><html lang="${language}" dir="${direction}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${template.title}</title></head><body style="margin:0;padding:32px 16px;background:#f2f8f4;font-family:Arial,sans-serif;color:#17352b"><main style="max-width:520px;margin:0 auto;padding:32px;border:1px solid #d8e9df;border-radius:20px;background:#fff"><p style="font-size:13px;font-weight:700;letter-spacing:3px;color:#438b6b">SAC</p><h1 style="font-size:23px">${template.title}</h1><p style="font-size:15px;line-height:1.6">${template.instruction}</p><p dir="ltr" style="margin:28px 0;padding:18px;text-align:center;border-radius:12px;background:#eef7f1;font-size:32px;font-weight:700;letter-spacing:8px">${escapeHtml(code)}</p><p style="font-size:12px;line-height:1.6;color:#60756b">${template.safety}</p></main></body></html>`;
  return sendBrevoTransactionalEmail(env, { recipientEmail: recipient, subject: template.subject, htmlContent }, fetcher);
}
