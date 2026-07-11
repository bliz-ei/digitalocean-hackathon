const OFFSCREEN_PATH = "offscreen.html";
const DASHBOARD_PATH = "dashboard.html";

async function hasOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)],
  });
  return contexts.length > 0;
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ["USER_MEDIA"],
    justification: "Consume user-approved tab audio while the service worker is idle.",
  });
}

async function setCaptureState(next) {
  await chrome.storage.session.set({ captureState: next });
  await chrome.action.setBadgeBackgroundColor({ color: next.status === "capturing" ? "#157f5b" : "#9b2c2c" });
  await chrome.action.setBadgeText({ text: next.status === "capturing" ? "REC" : "" });
}

async function openDashboard() {
  const url = chrome.runtime.getURL(DASHBOARD_PATH);
  const matches = await chrome.tabs.query({ url });
  if (matches[0]?.id) await chrome.tabs.update(matches[0].id, { active: true });
  else await chrome.tabs.create({ url });
}

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab.id || !tab.url?.startsWith("https://www.youtube.com/")) throw new Error("Open a YouTube tab before starting the probe.");
    const current = (await chrome.storage.session.get("captureState")).captureState;
    if (current?.status === "capturing") return openDashboard();
    await ensureOffscreenDocument();
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    const response = await chrome.runtime.sendMessage({ target: "offscreen", type: "capture.start", streamId, tabId: tab.id });
    if (!response?.ok) throw new Error(response?.error || "Offscreen capture failed.");
    await setCaptureState({ status: "capturing", tabId: tab.id, startedAt: new Date().toISOString() });
  } catch (error) {
    await setCaptureState({ status: "error", message: error?.message || "Capture could not start." });
  }
  await openDashboard();
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const current = (await chrome.storage.session.get("captureState")).captureState;
  if (current?.status === "capturing" && current.tabId === tabId && await hasOffscreenDocument()) {
    await chrome.runtime.sendMessage({ target: "offscreen", type: "capture.stop", reason: "tab_closed" }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "worker") return false;
  (async () => {
    if (message.type === "capture.status") {
      await setCaptureState(message.state);
      return { ok: true };
    }
    if (message.type === "dashboard.state") {
      return { ok: true, captureState: (await chrome.storage.session.get("captureState")).captureState ?? { status: "idle" } };
    }
    if (message.type === "dashboard.forward") {
      await ensureOffscreenDocument();
      return chrome.runtime.sendMessage({ ...message.message, target: "offscreen" });
    }
    return { ok: false, error: "unknown_message" };
  })().then(sendResponse, (error) => sendResponse({ ok: false, error: error?.message || "worker_error" }));
  return true;
});
