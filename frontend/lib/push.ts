import { apiFetch } from "./api";
import { api } from "./paths";

/**
 * Web Push helpers (closed-app notifications).
 *
 * The service worker (/sw.js) is already registered in providers.tsx. These
 * helpers handle the subscription lifecycle: ask the browser for permission,
 * create a PushSubscription with our VAPID public key, and register/drop it on
 * the backend. The bell uses `usePush` (hooks/usePush.ts) to drive the UI.
 */

/** True when this browser can do Web Push at all. */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** VAPID keys are base64url; the Push API wants a Uint8Array. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready;
}

/** Current subscription on this browser, if any. */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await readyRegistration();
  return reg.pushManager.getSubscription();
}

/**
 * Request permission, subscribe with the server's VAPID key, and persist the
 * subscription. Returns true on success. Throws only on unexpected errors;
 * a denied permission resolves to false.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!pushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const { publicKey } = await apiFetch<{ publicKey: string }>(api.pushVapidKey);
  if (!publicKey) return false; // server has no VAPID keys configured

  const reg = await readyRegistration();
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  await apiFetch(api.pushSubscribe, {
    method: "POST",
    body: JSON.stringify(sub.toJSON()),
  });
  return true;
}

/** Unsubscribe this browser and drop it from the backend. */
export async function unsubscribeFromPush(): Promise<void> {
  const sub = await getExistingSubscription();
  if (!sub) return;
  try {
    await apiFetch(api.pushUnsubscribe, {
      method: "POST",
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  } finally {
    await sub.unsubscribe();
  }
}
