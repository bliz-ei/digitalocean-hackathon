import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, type Claim, type PairedDevice } from "@verity/contracts";
import { StatusCard, VerdictCard } from "@verity/ui";

const base = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const publicId = decodeURIComponent(location.pathname.match(/^\/claims\/([^/]+)/)?.[1] ?? "");
const redemptionToken = new URLSearchParams(location.search).get("pair") ?? undefined;

function decodeVapid(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob((value + padding).replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0)).buffer as ArrayBuffer;
}

function App() {
  const [status, setStatus] = useState(publicId ? "loading" : "Pair your iPhone");
  const [claim, setClaim] = useState<Claim>();
  const [code, setCode] = useState("");
  const [device, setDevice] = useState<PairedDevice | undefined>(() => {
    const saved = localStorage.getItem("verityDevice");
    return saved ? JSON.parse(saved) : undefined;
  });

  useEffect(() => {
    if (!publicId) return;
    api.getClaim(base, publicId).then(setClaim).catch(() => setStatus(navigator.onLine ? "Result not found" : "Offline — reconnect to load this result"));
  }, []);

  async function pair() {
    setStatus("Pairing…");
    try {
      const next = await api.redeemPairing(base, { code: redemptionToken ? undefined : code, redemption_token: redemptionToken, device_label: "Demo iPhone" });
      localStorage.setItem("verityDevice", JSON.stringify(next));
      setDevice(next); setStatus("Paired — enable notifications");
    } catch { setStatus("That pairing code is invalid, expired, or already used"); }
  }

  async function enableNotifications() {
    if (!device) return;
    setStatus("Enabling notifications…");
    try {
      const permission = await Notification.requestPermission();
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
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    await subscription?.unsubscribe().catch(() => false);
    const id = localStorage.getItem("veritySubscriptionId");
    if (id) await api.revokePush(base, id, device.device_token).catch(() => undefined);
    localStorage.removeItem("veritySubscriptionId");
    setStatus("Notifications disabled");
  }

  async function fixtureDemo() {
    setStatus("Starting disclosed demo fallback…");
    try {
      const session = await api.createSession(base);
      const result = await api.startFixture(base, session.id);
      history.pushState({}, "", `/claims/${result.public_id}`);
      setClaim(result);
    } catch { setStatus("Demo fallback failed"); }
  }

  if (claim) return <main><VerdictCard claim={claim} /></main>;
  return <main>
    <StatusCard state={status} />
    {!device ? <section className="verity-card">
      <h2>Connect this iPhone</h2>
      <p>Open Verity from your Home Screen, then enter the six-digit code shown on your desktop.</p>
      {!redemptionToken&&<label>Pairing code <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label>}
      <button disabled={!redemptionToken&&code.length !== 6} onClick={pair}>{redemptionToken?"Connect this device":"Pair device"}</button>
    </section> : <section className="verity-card">
      <h2>{device.device_label}</h2>
      <button onClick={enableNotifications}>Enable notifications</button>
      <button onClick={disableNotifications}>Disable notifications</button>
    </section>}
    <section className="verity-card"><button onClick={fixtureDemo}>Start fixture demo</button><small>Disclosed fallback using checked-in evidence.</small></section>
  </main>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
