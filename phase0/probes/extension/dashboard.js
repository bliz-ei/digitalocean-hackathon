const status = document.querySelector("#status");
const events = document.querySelector("#events");
const message = document.querySelector("#message");
const transport = document.querySelector("#transport");
let snapshot = { logs: [] };

function setMessage(value) { message.textContent = value; }

function renderDefinition(values) {
  status.replaceChildren();
  for (const [label, value] of Object.entries(values)) {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = String(value ?? "—");
    wrapper.append(term, description);
    status.append(wrapper);
  }
}

function forward(type, extra = {}) {
  return chrome.runtime.sendMessage({ target: "worker", type: "dashboard.forward", message: { type, ...extra } });
}

async function refresh() {
  const worker = await chrome.runtime.sendMessage({ target: "worker", type: "dashboard.state" }).catch(() => null);
  const response = await forward("capture.snapshot").catch(() => null);
  if (response?.ok) snapshot = response.snapshot;
  renderDefinition({
    state: worker?.captureState?.status || snapshot.status || "idle",
    tab: snapshot.tabId,
    chunks: snapshot.chunks || 0,
    pending: snapshot.pendingChunks || 0,
    transport: snapshot.transportConnected ? "connected" : "not connected",
    "long tasks": snapshot.longTasks || 0,
    "resources released": worker?.captureState?.resourcesReleased,
  });
  events.textContent = snapshot.logs?.slice(-20).map((event) => JSON.stringify(event)).join("\n") || "No events yet.";
}

document.querySelector("#save-transport").addEventListener("click", async () => {
  try {
    const value = transport.value.trim();
    if (value) {
      const url = new URL(value);
      if (url.protocol !== "ws:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.search || url.username || url.password) {
        throw new Error("Use a credential-free ws://127.0.0.1 or ws://localhost URL.");
      }
    }
    await chrome.storage.local.set({ captureProbeConfig: { transportUrl: value || null } });
    setMessage("Saved. The setting applies to the next capture.");
  } catch (error) { setMessage(error.message); }
});

document.querySelector("#disconnect").addEventListener("click", async () => {
  await forward("capture.forceDisconnect");
  setMessage("Forced disconnect requested. Watch for reconnect and ACK events.");
  await refresh();
});

document.querySelector("#stop").addEventListener("click", async () => {
  const response = await forward("capture.stop", { reason: "user_stop" });
  setMessage(response?.ok ? "Capture stopped; inspect resources released before accepting the run." : response?.error || "Stop failed.");
  await refresh();
});

document.querySelector("#clear").addEventListener("click", async () => {
  await forward("capture.clearLogs");
  setMessage("Log cleared.");
  await refresh();
});

document.querySelector("#export").addEventListener("click", () => {
  const body = `${(snapshot.logs || []).map((event) => JSON.stringify(event)).join("\n")}\n`;
  const url = URL.createObjectURL(new Blob([body], { type: "application/x-ndjson" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `verity-capture-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
  link.click();
  URL.revokeObjectURL(url);
});

const config = await chrome.storage.local.get("captureProbeConfig");
transport.value = config.captureProbeConfig?.transportUrl || "";
await refresh();
setInterval(refresh, 1000);
