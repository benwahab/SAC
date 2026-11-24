import { useState, type FormEvent } from "react";
import BrandLogo from "./components/BrandLogo";
import type { Language } from "./i18n/translations";

export default function SupportIntakePage({ language, setLanguage }: { language: Language; setLanguage: (language: Language) => void }) {
  const copy = {
    fr: { title: "Aide pour accéder à votre compte", intro: "Vous n’arrivez plus à vous connecter ? Vérifiez votre adresse e-mail pour transmettre une demande à l’assistance SAC.", email: "Adresse e-mail vérifiée du compte", send: "Recevoir un code", code: "Code à 6 chiffres", subject: "Objet de la demande", description: "Expliquez votre difficulté sans communiquer de mot de passe ni de code secret.", submit: "Envoyer la demande", sent: "Si cette adresse correspond à un compte actif, un code sera envoyé. Vérifiez votre boîte e-mail.", done: "Votre demande a été enregistrée.", reference: "Référence", back: "Retour à la connexion", emergency: "Cette assistance ne traite pas les urgences SOS. En cas de danger immédiat, utilisez le parcours SOS de SAC ou contactez les services d’urgence locaux.", error: "Impossible de traiter la demande. Vérifiez les informations ou réessayez plus tard.", required: "Tous les champs sont obligatoires.", note: "Ce formulaire transmet une demande à l’assistance après vérification de l’e-mail. Il ne réinitialise pas votre mot de passe et ne réactive pas un compte." },
    en: { title: "Help accessing your account", intro: "Unable to sign in? Verify your email address to send a request to SAC support.", email: "Verified email address on the account", send: "Send a code", code: "6-digit code", subject: "Request subject", description: "Describe the issue without sharing a password or secret code.", submit: "Submit request", sent: "If this address matches an active account, a code will be sent. Check your inbox.", done: "Your request has been recorded.", reference: "Reference", back: "Back to sign in", emergency: "This support service does not handle SOS emergencies. In immediate danger, use SAC SOS or contact local emergency services.", error: "The request could not be processed. Check the information or try again later.", required: "All fields are required.", note: "This form sends a support request after email verification. It does not reset your password or reactivate an account." },
    ar: { title: "المساعدة في الوصول إلى حسابك", intro: "هل يتعذر عليك تسجيل الدخول؟ تحقق من بريدك الإلكتروني لإرسال طلب إلى دعم SAC.", email: "البريد الإلكتروني الموثق للحساب", send: "إرسال رمز", code: "رمز من 6 أرقام", subject: "موضوع الطلب", description: "اشرح المشكلة دون مشاركة كلمة المرور أو أي رمز سري.", submit: "إرسال الطلب", sent: "إذا كان هذا العنوان مرتبطاً بحساب نشط، فسيتم إرسال رمز. تحقق من بريدك.", done: "تم تسجيل طلبك.", reference: "المرجع", back: "العودة إلى تسجيل الدخول", emergency: "لا يتعامل الدعم مع حالات الطوارئ SOS. عند وجود خطر فوري، استخدم خدمة SOS في SAC أو اتصل بخدمات الطوارئ المحلية.", error: "تعذرت معالجة الطلب. تحقق من المعلومات أو حاول لاحقاً.", required: "جميع الحقول مطلوبة.", note: "يرسل هذا النموذج طلباً إلى الدعم بعد التحقق من البريد الإلكتروني. ولا يعيد تعيين كلمة المرور أو تفعيل الحساب." },
  }[language];
  const [email,setEmail]=useState("");
  const [requestId,setRequestId]=useState("");
  const [code,setCode]=useState("");
  const [subject,setSubject]=useState("");
  const [description,setDescription]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [reference,setReference]=useState("");
  const rtl=language==="ar";

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response=await fetch("/api/support/recovery/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});
      const payload=await response.json() as {requestId?:string};
      if(!response.ok||!payload.requestId) throw new Error("request_failed");
      setRequestId(payload.requestId); setNotice(copy.sent);
    } catch { setError(copy.error); } finally { setBusy(false); }
  }
  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!code.trim()||!subject.trim()||!description.trim()){setError(copy.required);return;}
    setBusy(true);setError("");setNotice("");
    try {
      const response=await fetch("/api/support/recovery/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeId:requestId,code,subject,description})});
      const payload=await response.json() as {reference?:string};
      if(!response.ok||!payload.reference) throw new Error("request_failed");
      setReference(payload.reference);setNotice(copy.done);
    } catch { setError(copy.error); } finally { setBusy(false); }
  }

  return <main dir={rtl?"rtl":"ltr"} className="min-h-screen bg-[#f2f8f4] px-4 py-8 text-[#17352b] sm:px-6">
    <div className="mx-auto max-w-xl">
      <div className="mb-8 flex items-center justify-between gap-4"><a href="/connexion" aria-label="SAC"><BrandLogo className="h-10 w-auto" alt="SAC" /></a><select aria-label="Language" value={language} onChange={e=>setLanguage(e.target.value as Language)} className="rounded-xl border border-emerald-900/15 bg-white px-3 py-2 text-sm"><option value="fr">Français</option><option value="en">English</option><option value="ar">العربية</option></select></div>
      <section className="rounded-3xl border border-emerald-900/10 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-black">{copy.title}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{copy.intro}</p><p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs leading-6 text-emerald-950">{copy.note}</p>
        {!reference ? <>
          {!requestId ? <form onSubmit={requestCode} className="mt-6 space-y-4"><label className="block text-sm font-bold">{copy.email}<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-emerald-900/15 px-3 py-3 font-normal" /></label><button disabled={busy} className="w-full rounded-xl bg-emerald-800 px-4 py-3 font-bold text-white disabled:opacity-50">{busy?"…":copy.send}</button></form> : <form onSubmit={submitRequest} className="mt-6 space-y-4"><p className="rounded-xl bg-emerald-50 p-3 text-sm leading-6">{notice}</p><label className="block text-sm font-bold">{copy.code}<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)} className="mt-2 w-full rounded-xl border border-emerald-900/15 px-3 py-3 font-normal tracking-[0.3em]" /></label><label className="block text-sm font-bold">{copy.subject}<input required minLength={3} maxLength={160} value={subject} onChange={e=>setSubject(e.target.value)} className="mt-2 w-full rounded-xl border border-emerald-900/15 px-3 py-3 font-normal" /></label><label className="block text-sm font-bold">{copy.description}<textarea required minLength={5} maxLength={5000} rows={4} value={description} onChange={e=>setDescription(e.target.value)} className="mt-2 w-full rounded-xl border border-emerald-900/15 px-3 py-3 font-normal" /></label><button disabled={busy} className="w-full rounded-xl bg-emerald-800 px-4 py-3 font-bold text-white disabled:opacity-50">{busy?"…":copy.submit}</button></form>}
          {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        </> : <div className="mt-6 rounded-2xl bg-emerald-50 p-5"><p className="font-bold">{notice}</p><p className="mt-3 text-sm">{copy.reference}: <strong className="font-mono">{reference}</strong></p></div>}
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-950">{copy.emergency}</p>
        <a href="/connexion" className="mt-6 inline-flex text-sm font-bold text-emerald-800 underline underline-offset-4">{copy.back}</a>
      </section>
    </div>
  </main>;
}
