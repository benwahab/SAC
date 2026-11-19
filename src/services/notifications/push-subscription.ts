export type PushSetupState =
  | "unsupported"
  | "permission_denied"
  | "not_configured"
  | "not_subscribed"
  | "subscribed";

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function supported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  if (!supported()) throw new Error("Les notifications push ne sont pas prises en charge sur ce navigateur.");
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (registration) return registration;
  return navigator.serviceWorker.ready;
}

async function getPublicKey(): Promise<string> {
  const response = await fetch("/api/push/vapid-public-key", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload = await response.json() as { publicKey?: string; error?: string };
  if (!response.ok || !payload.publicKey) {
    if (response.status === 503) throw new Error("Le service de notifications SAC n’est pas encore entièrement configuré.");
    throw new Error("Impossible de préparer les notifications SAC.");
  }
  return payload.publicKey;
}

async function saveSubscription(subscription: PushSubscription): Promise<void> {
  const response = await fetch("/api/push/subscriptions", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "subscribe", subscription: subscription.toJSON() }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (response.status === 401) throw new Error("Votre session SAC a expiré. Reconnectez-vous.");
    throw new Error(payload.error === "push_subscription_storage_not_configured"
      ? "Le stockage sécurisé des notifications n’est pas disponible."
      : "L’enregistrement sécurisé de cet appareil a échoué.");
  }
}

export async function getPushSetupState(): Promise<PushSetupState> {
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "permission_denied";
  try {
    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await saveSubscription(subscription);
      return "subscribed";
    }
    try {
      await getPublicKey();
    } catch {
      return "not_configured";
    }
    return "not_subscribed";
  } catch {
    return "not_subscribed";
  }
}

export async function enablePushNotifications(): Promise<void> {
  if (!supported()) throw new Error("Les notifications push ne sont pas prises en charge sur ce navigateur.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(permission === "denied"
      ? "Les notifications sont bloquées dans les réglages du navigateur."
      : "L’autorisation des notifications n’a pas été accordée.");
  }
  const registration = await getRegistration();
  const publicKey = await getPublicKey();
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(publicKey) as BufferSource,
  });
  await saveSubscription(subscription);
}

export async function disablePushNotifications(): Promise<void> {
  if (!supported()) return;
  const registration = await getRegistration();
  const subscription = await registration.pushManager.getSubscription();
  const response = await fetch("/api/push/subscriptions", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "remove" }),
  });
  if (!response.ok) throw new Error("La suppression de l’abonnement sur SAC n’a pas été confirmée.");
  if (subscription) {
    const removed = await subscription.unsubscribe();
    if (!removed) throw new Error("L’abonnement local n’a pas pu être désactivé.");
  }
}
