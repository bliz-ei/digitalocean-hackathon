const elements = Object.fromEntries(["state", "enable", "revoke", "message", "claim", "timings", "copy"].map((id) => [id, document.querySelector(`#${id}`)]));
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
let timingRecord = null;

function definitionList(element, values) {
  element.replaceChildren();
  for (const [label, value] of Object.entries(values)) {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = String(value ?? "—");
    wrapper.append(term, description);
    element.append(wrapper);
  }
}

function base64UrlToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const binary = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function renderState() {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  definitionList(elements.state, {
    "Home Screen mode": standalone ? "yes" : "no",
    "Notification permission": globalThis.Notification?.permission || "unsupported",
    "Service worker": registration ? "registered" : "missing",
    "Push subscription": subscription ? "active" : "none",
    "Subscription ID": localStorage.getItem("phase0SubscriptionId"),
  });
}

elements.enable.addEventListener("click", async () => {
  try {
    if (!standalone) throw new Error("Install to the Home Screen and open the installed app before enabling notifications.");
    if (!("serviceWorker" in navigator) || !("PushManager" in globalThis) || !("Notification" in globalThis)) throw new Error("Web Push is not supported on this device.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error(`Notification permission is ${permission}.`);
    const registration = await navigator.serviceWorker.ready;
    const config = await fetch("/api/config", { cache: "no-store" }).then((response) => response.json());
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(config.vapid_public_key),
    });
    const response = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(subscription),
    });
    if (!response.ok) throw new Error("The probe server rejected the subscription.");
    const result = await response.json();
    localStorage.setItem("phase0SubscriptionId", result.id);
    elements.message.textContent = "Subscribed. Record the non-secret ID, lock the phone, and use send.mjs.";
  } catch (error) { elements.message.textContent = error.message; }
  await renderState();
});

elements.revoke.addEventListener("click", async () => {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  const id = localStorage.getItem("phase0SubscriptionId");
  await subscription?.unsubscribe();
  if (id) await fetch(`/api/subscriptions/${id}`, { method: "DELETE" }).catch(() => null);
  localStorage.removeItem("phase0SubscriptionId");
  elements.message.textContent = "Local and server subscription revocation requested. Verify a later send cannot deliver.";
  await renderState();
});

elements.copy.addEventListener("click", async () => {
  if (!timingRecord) return;
  await navigator.clipboard.writeText(JSON.stringify(timingRecord, null, 2));
  elements.message.textContent = "Sanitized timing record copied.";
});

if (location.pathname.startsWith("/claims/")) {
  const parameters = new URLSearchParams(location.search);
  const claimId = location.pathname.split("/").at(-1);
  timingRecord = {
    schema_version: 1,
    claim_id: claimId,
    route_matches_high_entropy_shape: /^claim_[a-f0-9]{32}$/.test(claimId),
    push_sent: parameters.get("push_sent_at"),
    push_received: parameters.get("push_received_at"),
    notification_opened: parameters.get("push_opened_at"),
    measured_on_device: true,
  };
  elements.claim.hidden = false;
  definitionList(elements.timings, timingRecord);
}

if ("serviceWorker" in navigator) await navigator.serviceWorker.register("/sw.js", { scope: "/" });
await renderState();
