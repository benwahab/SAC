import { Camera, Crown, KeyRound, Mail, Phone, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { OwnProfile, PrivacySettings, ScreenProps } from "../types";
import { fillCopy } from "../../i18n/translations";
import { MAX_PROFILE_PHOTO_BYTES } from "../../domain/account-profile";
import { clearStoredPasskeyCredentialId } from "../../services/device/passkey-storage";
import { accountErrorMessage } from "../errors";
import { Card, Halo, Notice, ProfileAvatar, Sheet, fieldClass, ghostBtn, primaryBtn } from "../ui";

type PrivacyKey = keyof PrivacySettings;
type SubscriptionView = { plan: "free" | "premium"; maxTrustedContacts: 2 | 10; activeTrustedContacts: number; periodEnd: number | null; paymentProviderConfigured: boolean };

export default function Account({ copy, go, notice, setNotice, ownProfile, setOwnProfile, refreshProfile, onLogout }: ScreenProps & {
  ownProfile: OwnProfile | null; setOwnProfile: (profile: OwnProfile | null) => void;
  refreshProfile: () => Promise<void>; onLogout: () => void;
}) {
  const [profile, setProfile] = useState<OwnProfile | null>(ownProfile);
  const [firstName, setFirstName] = useState(ownProfile?.firstName ?? "");
  const [lastName, setLastName] = useState(ownProfile?.lastName ?? "");
  const [loading, setLoading] = useState(!ownProfile);
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailChallenge, setEmailChallenge] = useState<{ id: string; expiresAt: number } | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [phone, setPhone] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const [phoneChallenge, setPhoneChallenge] = useState<{ id: string; expiresAt: number } | null>(null);
  const [phoneCode, setPhoneCode] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    if (!profile) {
      void refreshProfile().then(async () => {
        const response = await fetch("/api/account/profile", { credentials: "same-origin", cache: "no-store" });
        const payload = await response.json() as { profile?: OwnProfile };
        if (active && payload.profile) {
          setProfile(payload.profile); setFirstName(payload.profile.firstName); setLastName(payload.profile.lastName);
        }
      }).catch(() => undefined).finally(() => { if (active) setLoading(false); });
    } else {
      setFirstName(profile.firstName); setLastName(profile.lastName); setLoading(false);
    }
    return () => { active = false; };
  }, [profile, refreshProfile]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/billing/subscription", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("subscription_unavailable");
        const payload = await response.json() as SubscriptionView;
        if (payload && (payload.plan === "free" || payload.plan === "premium")) setSubscription(payload);
      })
      .catch(() => { if (!controller.signal.aborted) setSubscription(null); });
    return () => controller.abort();
  }, []);

  function updateProfile(next: OwnProfile) {
    setProfile(next); setOwnProfile(next);
  }

  async function request<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const payload = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(accountErrorMessage(copy, payload.error));
    return payload;
  }

  async function saveNames(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("names"); setProblem(""); setNotice("");
    try {
      const payload = await request<{ profile?: OwnProfile }>("/api/account/profile", { firstName, lastName });
      if (payload.profile) updateProfile(payload.profile);
      setNotice(copy.accountSaved);
    } catch (reason) { setProblem(reason instanceof Error ? reason.message : copy.accountErrGeneric); }
    finally { setBusy(null); }
  }

  async function selectPhoto(file: File | undefined) {
    if (!file || busy) return;
    if (file.size > MAX_PROFILE_PHOTO_BYTES) { setProblem(copy.accountPhotoTooLarge); return; }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setProblem(copy.accountPhotoInvalid); return; }
    setBusy("photo"); setProblem(""); setNotice("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error(copy.accountPhotoInvalid));
        reader.readAsDataURL(file);
      });
      const payload = await request<{ photoUrl: string; photoVersion: number }>("/api/account/photo", { dataUrl });
      if (profile) updateProfile({ ...profile, photoUrl: payload.photoUrl, photoVersion: payload.photoVersion });
      setNotice(copy.accountSaved);
    } catch (reason) { setProblem(reason instanceof Error ? reason.message : copy.accountPhotoInvalid); }
    finally { setBusy(null); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function removePhoto() {
    if (busy || !window.confirm(copy.accountPhotoRemove)) return;
    setBusy("photo"); setProblem(""); setNotice("");
    try {
      await request("/api/account/photo", { delete: true });
      if (profile) updateProfile({ ...profile, photoUrl: null, photoVersion: 0 });
      setNotice(copy.accountSaved);
    } catch (reason) { setProblem(reason instanceof Error ? reason.message : copy.accountErrGeneric); }
    finally { setBusy(null); }
  }

  async function togglePrivacy(key: PrivacyKey, value: boolean) {
    if (busy || !profile) return;
    setBusy("privacy"); setProblem(""); setNotice("");
    try {
      const payload = await request<{ privacy: PrivacySettings }>("/api/account/privacy", { [key]: value });
      updateProfile({ ...profile, privacy: payload.privacy });
    } catch (reason) { setProblem(reason instanceof Error ? reason.message : copy.accountErrGeneric); }
    finally { setBusy(null); }
  }

  async function requestEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("email"); setProblem(""); setNotice("");
    try {
      const payload = await request<{ challengeId: string; expiresAt: number }>("/api/account/email-change", { action: "request", newEmail: email.trim(), currentPassword: emailPassword });
      setEmailChallenge({ id: payload.challengeId, expiresAt: payload.expiresAt });
      setNotice(copy.accountCodeSent);
    } catch (reason) { setProblem(reason instanceof Error ? reason.message : copy.accountErrGeneric); }
    finally { setBusy(null); }
  }

  async function confirmEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !emailChallenge) return;
    setBusy("email"); setProblem(""); setNotice("");
    try {
      const payload = await request<{ email: string }>("/api/account/email-change", { action: "confirm", challengeId: emailChallenge.id, code: emailCode.trim() });
      if (profile) updateProfile({ ...profile, email: payload.email });
      setEmailChallenge(null); setEmailCode(""); setEmail(""); setEmailPassword("");
      setNotice(copy.accountEmailChanged);
    } catch (reason) { setProblem(reason instanceof Error ? reason.message : copy.accountErrGeneric); }
    finally { setBusy(null); }
  }

  async function requestPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("phone"); setProblem(""); setNotice("");
    try {
      const payload = await request<{ challengeId: string; expiresAt: number }>("/api/account/phone-change", { action: "request", newPhone: phone.trim(), currentPassword: phonePassword });
      setPhoneChallenge({ id: payload.challengeId, expiresAt: payload.expiresAt });
      setNotice(copy.accountCodeSent);
    } catch (reason) { setProblem(reason instanceof Error ? reason.message : copy.accountErrGeneric); }
    finally { setBusy(null); }
  }

  async function confirmPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !phoneChallenge) return;
    setBusy("phone"); setProblem(""); setNotice("");
    try {
      const payload = await request<{ phone: string }>("/api/account/phone-change", { action: "confirm", challengeId: phoneChallenge.id, code: phoneCode.trim() });
      if (profile) updateProfile({ ...profile, phone: payload.phone, phoneVerified: false });
      setPhoneChallenge(null); setPhoneCode(""); setPhone(""); setPhonePassword("");
      setNotice(copy.accountPhoneChanged);
    } catch (reason) { setProblem(reason instanceof Error ? reason.message : copy.accountErrGeneric); }
    finally { setBusy(null); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (newPassword !== confirmPassword) { setProblem(copy.accountPasswordMismatch); return; }
    setBusy("password"); setProblem(""); setNotice("");
    try {
      await request("/api/account/password", { currentPassword, newPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setNotice(copy.accountPasswordChanged);
    } catch (reason) { setProblem(reason instanceof Error ? reason.message : copy.accountPasswordInvalid); }
    finally { setBusy(null); }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !confirmDelete) return;
    setBusy("delete"); setProblem(""); setNotice("");
    try {
      await request("/api/account/deletion", { password: deletePassword });
      clearStoredPasskeyCredentialId();
      setNotice(copy.accountDeleted);
      window.setTimeout(onLogout, 900);
    } catch (reason) { setProblem(reason instanceof Error ? reason.message : copy.accountErrGeneric); }
    finally { setBusy(null); }
  }

  const privacyRow = (key: PrivacyKey, label: string, hint: string) => {
    const value = profile?.privacy[key] ?? false;
    return (
      <div className="flex items-start gap-3 border-t border-[#F0EAE5] py-3 first:border-t-0">
        <div className="min-w-0 flex-1"><p className="text-sm font-bold">{label}</p><p className="mt-0.5 text-xs leading-5 text-sac-muted">{hint}</p></div>
        <button type="button" role="switch" aria-checked={value} aria-label={label} disabled={busy !== null || !profile} onClick={() => void togglePrivacy(key, !value)}
          className={"relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 " + (value ? "bg-sac-confirm" : "bg-[#D8CEC6]")}>
          <span className={"absolute top-1 size-5 rounded-full bg-white shadow transition-all " + (value ? "start-6" : "start-1")} />
        </button>
      </div>
    );
  };

  return (
    <>
      <Halo title={copy.accountTitle} eyebrow={copy.privateSpace} onBack={() => go({ name: "settings" })} backLabel={copy.back}><p className="mt-1 text-sm text-white/90">{copy.accountIntro}</p></Halo>
      <Sheet>
        <Card className="!border-sac-primary/20 !bg-white/95">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[.14em] text-sac-primary-strong">{copy.homeOffersTitle}</p>
              <h2 className="mt-1 text-xl font-black text-sac-ink">{subscription ? (subscription.plan === "premium" ? copy.homeOfferPremiumTitle + " · " + copy.homeOfferPremiumPrice : copy.homeOfferFreeTitle + " · " + copy.homeOfferFreePrice) : copy.loading}</h2>
              <p className="mt-1 text-xs font-semibold text-sac-muted">{subscription ? fillCopy(copy.dashCircleCount, { n: subscription.activeTrustedContacts }) + " / " + subscription.maxTrustedContacts : copy.homePremiumHowIntro}</p>
              <p className="mt-1 text-sm leading-6 text-sac-muted">{copy.homeOfferFreeText}</p>
            </div>
            <ShieldCheck className="shrink-0 text-sac-confirm" size={22} />
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-sac-ink">
            <li>• {copy.homeOfferFreePoint1}</li>
            <li>• {copy.homeOfferFreePoint2}</li>
            <li>• {copy.homeOfferFreePoint3}</li>
          </ul>
          <div className="mt-4 rounded-2xl border border-sac-primary/15 bg-sac-canvas p-3">
            <p className="flex items-center gap-2 font-extrabold text-sac-ink"><Crown size={17} className="text-sac-primary-strong" />{copy.homeOfferPremiumTitle} · {copy.homeOfferPremiumPrice}</p>
            <p className="mt-1 text-sm leading-6 text-sac-muted">{copy.homeOfferPremiumText}</p>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-sac-ink">
              <li>• {copy.homeOfferPremiumPoint1}</li>
              <li>• {copy.homeOfferPremiumPoint2}</li>
              <li>• {copy.homeOfferPremiumPoint3}</li>
            </ul>
          </div>
          <p className="mt-3 rounded-xl bg-sac-confirm/10 p-3 text-xs font-semibold leading-5 text-sac-ink">{copy.homeOfferSosFree}</p>
          <p className="mt-2 text-xs leading-5 text-sac-muted">{copy.homePremiumHowIntro}</p>
          {subscription?.plan !== "premium" && (
            <button type="button" onClick={() => setNotice(copy.homePremiumHowIntro)} className="mt-3 min-h-11 w-full rounded-xl border border-sac-primary/30 bg-white px-4 text-sm font-extrabold text-sac-primary-strong">
              {copy.homeOfferPremiumCta}
            </button>
          )}
        </Card>
        {notice && <Notice kind="ok">{notice}</Notice>}
        {problem && <Notice kind="error">{problem}</Notice>}
        {loading ? <p className="py-6 text-center text-sm text-sac-muted">{copy.loading}</p> : !profile ? (
          <Card className="text-center"><p className="font-extrabold">{copy.profileLoadError}</p><button type="button" onClick={() => go({ name: "settings" })} className={"mt-4 " + primaryBtn}>{copy.back}</button></Card>
        ) : (
          <>
            <Card>
              <div className="flex items-center gap-4">
                <ProfileAvatar photoUrl={profile.photoUrl} name={`${profile.firstName} ${profile.lastName}`} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-extrabold">{copy.accountPhoto}</h2>
                  <p className="mt-1 text-xs leading-5 text-sac-muted">{copy.accountPhotoHint}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" disabled={busy !== null} onClick={() => fileRef.current?.click()} className={ghostBtn}><Camera size={16} />{copy.accountPhotoChange}</button>
                    {profile.photoUrl && <button type="button" disabled={busy !== null} onClick={() => void removePhoto()} className="min-h-12 rounded-[14px] border border-sac-alert/25 bg-sac-alert/5 px-3 text-xs font-bold text-sac-alert disabled:opacity-50">{copy.accountPhotoRemove}</button>}
                  </div>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void selectPhoto(event.target.files?.[0])} />
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="flex items-center gap-2 font-extrabold"><Save size={18} />{copy.accountProfileSection}</h2>
              <form onSubmit={saveNames} className="mt-3 flex flex-col gap-3">
                <div><label htmlFor="account-first-name" className="mb-1 block text-sm font-bold">{copy.accountFirstName}</label><input id="account-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={80} autoComplete="given-name" className={fieldClass} /></div>
                <div><label htmlFor="account-last-name" className="mb-1 block text-sm font-bold">{copy.accountLastName}</label><input id="account-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={80} autoComplete="family-name" className={fieldClass} /></div>
                <button type="submit" disabled={busy !== null || !firstName.trim() || !lastName.trim()} className={primaryBtn}>{busy === "names" ? copy.accountSaving : copy.accountSave}</button>
              </form>
            </Card>

            <Card>
              <h2 className="flex items-center gap-2 font-extrabold"><ShieldCheck size={18} />{copy.accountPrivacySection}</h2>
              <p className="mt-1 text-sm leading-6 text-sac-muted">{copy.accountPrivacyIntro}</p>
              <div className="mt-2">
                {privacyRow("searchByName", copy.privacySearchByName, copy.privacySearchByNameHint)}
                {privacyRow("searchByEmail", copy.privacySearchByEmail, copy.privacySearchByEmailHint)}
                {privacyRow("photoVisibleInSearch", copy.privacyPhotoSearch, copy.privacyPhotoSearchHint)}
                {privacyRow("photoVisibleToContacts", copy.privacyPhotoContacts, copy.privacyPhotoContactsHint)}
              </div>
            </Card>

            <Card>
              <h2 className="flex items-center gap-2 font-extrabold"><Mail size={18} />{copy.accountSecuritySection}</h2>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-sac-muted">{copy.accountEmail}</dt><dd className="truncate font-semibold" dir="ltr">{profile.email}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-sac-muted">{copy.accountPhone}</dt><dd className="text-end font-semibold"><span dir="ltr">{profile.phone || "—"}</span>{profile.phone && !profile.phoneVerified && <span className="block text-xs font-normal text-sac-muted">{copy.accountPhoneUnverified}</span>}</dd></div>
              </dl>
              <form onSubmit={emailChallenge ? confirmEmail : requestEmail} className="mt-4 flex flex-col gap-2 border-t border-[#F0EAE5] pt-3">
                <h3 className="text-sm font-extrabold">{copy.accountChangeEmail}</h3>
                {!emailChallenge ? <>
                  <input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder={copy.accountEmail} autoComplete="email" dir="ltr" className={fieldClass} />
                  <input type="password" required value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)} placeholder={copy.accountCurrentPassword} autoComplete="current-password" className={fieldClass} />
                  <button type="submit" disabled={busy !== null || !email.trim() || !emailPassword} className={ghostBtn}>{busy === "email" ? copy.accountSendingCode : copy.accountSendCode}</button>
                </> : <>
                  <p className="text-xs leading-5 text-sac-muted">{copy.accountCodeSent}</p>
                  <input inputMode="numeric" required maxLength={12} value={emailCode} onChange={(event) => setEmailCode(event.target.value)} placeholder={copy.accountCode} autoComplete="one-time-code" dir="ltr" className={fieldClass} />
                  <button type="submit" disabled={busy !== null || !emailCode.trim()} className={ghostBtn}>{busy === "email" ? copy.accountConfirming : copy.accountConfirm}</button>
                </>}
              </form>
              <form onSubmit={phoneChallenge ? confirmPhone : requestPhone} className="mt-4 flex flex-col gap-2 border-t border-[#F0EAE5] pt-3">
                <h3 className="flex items-center gap-2 text-sm font-extrabold"><Phone size={16} />{copy.accountChangePhone}</h3>
                {!phoneChallenge ? <>
                  <input type="tel" required maxLength={32} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={copy.accountPhone} autoComplete="tel" dir="ltr" className={fieldClass} />
                  <input type="password" required value={phonePassword} onChange={(event) => setPhonePassword(event.target.value)} placeholder={copy.accountCurrentPassword} autoComplete="current-password" className={fieldClass} />
                  <button type="submit" disabled={busy !== null || !phone.trim() || !phonePassword} className={ghostBtn}>{busy === "phone" ? copy.accountSendingCode : copy.accountSendCode}</button>
                </> : <>
                  <p className="text-xs leading-5 text-sac-muted">{copy.accountCodeSent}</p>
                  <input inputMode="numeric" required maxLength={12} value={phoneCode} onChange={(event) => setPhoneCode(event.target.value)} placeholder={copy.accountCode} autoComplete="one-time-code" dir="ltr" className={fieldClass} />
                  <button type="submit" disabled={busy !== null || !phoneCode.trim()} className={ghostBtn}>{busy === "phone" ? copy.accountConfirming : copy.accountConfirm}</button>
                </>}
              </form>
              <form onSubmit={changePassword} className="mt-4 flex flex-col gap-2 border-t border-[#F0EAE5] pt-3">
                <h3 className="flex items-center gap-2 text-sm font-extrabold"><KeyRound size={16} />{copy.accountChangePassword}</h3>
                <input type="password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder={copy.accountCurrentPassword} autoComplete="current-password" className={fieldClass} />
                <input type="password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder={copy.accountNewPassword} autoComplete="new-password" className={fieldClass} />
                <input type="password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={copy.accountConfirmPassword} autoComplete="new-password" className={fieldClass} />
                <button type="submit" disabled={busy !== null || !currentPassword || !newPassword || !confirmPassword} className={ghostBtn}>{busy === "password" ? copy.accountSaving : copy.accountChangePassword}</button>
              </form>
            </Card>

            <Card className="!border-sac-alert/30 !bg-sac-alert/5">
              <h2 className="flex items-center gap-2 font-extrabold text-sac-alert"><Trash2 size={18} />{copy.accountDangerZone}</h2>
              <p className="mt-1 text-sm leading-6 text-sac-muted">{copy.accountDeleteWarning}</p>
              <form onSubmit={deleteAccount} className="mt-3 flex flex-col gap-2">
                <label className="flex items-start gap-2 text-sm font-semibold"><input type="checkbox" checked={confirmDelete} onChange={(event) => setConfirmDelete(event.target.checked)} className="mt-1 size-4" />{copy.accountDelete}</label>
                <input type="password" required value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} placeholder={copy.accountDeletePassword} autoComplete="current-password" className={fieldClass} />
                {!confirmDelete ? (
                  <p className="text-xs font-medium text-sac-muted">Coche la case de confirmation pour activer le bouton.</p>
                ) : !deletePassword ? (
                  <p className="text-xs font-medium text-sac-muted">Saisis le mot de passe actuel de ton compte pour continuer.</p>
                ) : (
                  <p className="text-xs font-semibold text-sac-confirm">Confirmation et mot de passe renseignés. Tu peux envoyer la demande.</p>
                )}
                <button type="submit" disabled={busy !== null || !confirmDelete || !deletePassword} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-sac-alert px-4 text-sm font-extrabold text-white disabled:opacity-50"><Trash2 size={16} />{busy === "delete" ? copy.accountDeleting : copy.accountDeleteButton}</button>
              </form>
            </Card>
          </>
        )}
      </Sheet>
    </>
  );
}
