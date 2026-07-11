import { useState } from "react";
import { api, type PairedDevice } from "@verity/contracts";
import { base, decodeVapid } from "./config";

/** Push subscription flow. The Notification.requestPermission → serviceWorker.ready →
 *  pushConfig → pushManager.subscribe(decoded VAPID) → registerPush chain, the
 *  "veritySubscriptionId" storage key, and every user-facing status string are
 *  preserved verbatim from Arnav's main.tsx — restructured into a hook. */
export function usePush(device: PairedDevice | undefined) {
  const [status, setStatus] = useState<string | undefined>();

  async function enableNotifications() {
    if (!device) return;
    setStatus("Enabling notifications…");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setStatus("On iPhone, add Verity to your Home Screen, open it there, then enable notifications.");
        return;
      }
      const permission = await window.Notification.requestPermission();
      if (permission !== "granted") { setStatus("Notifications are blocked. Enable them in iPhone Settings."); return; }
      const registration = await navigator.serviceWorker.ready;
      const config = await api.pushConfig(base);
      if (!config.enabled) throw new Error("Push is not configured");
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapid(config.vapid_public_key) });
      const json = subscription.toJSON();
      const saved = await api.registerPush(base, { device_id: device.device_id, device_token: device.device_token, endpoint: json.endpoint!, p256dh: json.keys!.p256dh, auth: json.keys!.auth });
      localStorage.setItem("veritySubscriptionId", saved.subscription_id);
      setStatus("Notifications enabled — you can lock this phone");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to enable notifications"); }
  }

  async function disableNotifications() {
    if (!device) return;
    if (!("serviceWorker" in navigator)) {
      setStatus("Notifications are not available in this browser.");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    await subscription?.unsubscribe().catch(() => false);
    const id = localStorage.getItem("veritySubscriptionId");
    if (id) await api.revokePush(base, id, device.device_token).catch(() => undefined);
    localStorage.removeItem("veritySubscriptionId");
    setStatus("Notifications disabled");
  }

  return { status, enableNotifications, disableNotifications };
}
