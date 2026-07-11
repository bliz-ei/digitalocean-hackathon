const CHUNK_MS = 1000;
const MAX_LOG_EVENTS = 10000;
const MAX_PENDING_CHUNKS = 180;
const MAX_BUFFERED_BYTES = 8 * 1024 * 1024;

const state = {
  status: "idle", tabId: null, stream: null, audioContext: null, sourceNode: null,
  recorder: null, sequence: 0, captureStartedMono: null, transportUrl: null,
  socket: null, reconnectAttempt: 0, reconnectTimer: null, pending: new Map(),
  sentThisConnection: new Set(), logs: [], stopping: false, longTaskCount: 0, observer: null,
};

function record(event, details = {}) {
  state.logs.push({
    schema_version: 1,
    event,
    wall_time: new Date().toISOString(),
    monotonic_ms: Math.round(performance.now() * 1000) / 1000,
    ...details,
  });
  if (state.logs.length > MAX_LOG_EVENTS) state.logs.splice(0, state.logs.length - MAX_LOG_EVENTS);
}

function notifyWorker(next) {
  return chrome.runtime.sendMessage({ target: "worker", type: "capture.status", state: next }).catch(() => {});
}

function safeTransportUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  const loopback = ["127.0.0.1", "localhost"].includes(url.hostname);
  if (url.protocol !== "ws:" || !loopback || url.username || url.password || url.search || url.hash) {
    throw new Error("The Phase 0 relay must be a credential-free ws:// loopback URL.");
  }
  return url.href;
}

function frameChunk(sequence, capturedMono, payload) {
  const header = new ArrayBuffer(21);
  const view = new DataView(header);
  for (const [index, value] of [0x56, 0x52, 0x54, 0x59, 1].entries()) view.setUint8(index, value);
  view.setBigUint64(5, BigInt(sequence), false);
  view.setFloat64(13, capturedMono, false);
  return new Blob([header, payload], { type: "application/octet-stream" });
}

function scheduleReconnect() {
  if (state.stopping || !state.transportUrl || state.reconnectTimer) return;
  const capped = Math.min(5000, 250 * 2 ** state.reconnectAttempt);
  const delay = Math.round(capped * (0.8 + Math.random() * 0.4));
  state.reconnectAttempt += 1;
  record("transport_reconnect_scheduled", { delay_ms: delay, attempt: state.reconnectAttempt });
  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;
    connectTransport();
  }, delay);
}

function flushPending() {
  if (state.socket?.readyState !== WebSocket.OPEN) return;
  for (const [sequence, frame] of state.pending) {
    if (state.socket.bufferedAmount > MAX_BUFFERED_BYTES || state.sentThisConnection.has(sequence)) break;
    state.socket.send(frame);
    state.sentThisConnection.add(sequence);
  }
}

function connectTransport() {
  if (!state.transportUrl || state.stopping || state.socket?.readyState === WebSocket.OPEN) return;
  const socket = new WebSocket(state.transportUrl);
  socket.binaryType = "arraybuffer";
  state.socket = socket;
  socket.addEventListener("open", () => {
    state.reconnectAttempt = 0;
    state.sentThisConnection.clear();
    record("transport_connected");
    socket.send(JSON.stringify({
      type: "hello", schema_version: 1,
      mime_type: state.recorder?.mimeType || "audio/webm;codecs=opus",
      chunk_duration_ms: CHUNK_MS,
      capture_started_monotonic_ms: state.captureStartedMono,
    }));
    flushPending();
  });
  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") return;
    try {
      const message = JSON.parse(event.data);
      if (message.type === "ack" && Number.isSafeInteger(message.sequence)) {
        state.pending.delete(message.sequence);
        state.sentThisConnection.delete(message.sequence);
        record("transport_ack", { sequence: message.sequence });
        flushPending();
      }
    } catch { record("transport_protocol_error", { code: "invalid_json" }); }
  });
  socket.addEventListener("close", (event) => {
    if (state.socket === socket) state.socket = null;
    record("transport_disconnected", { code: event.code, pending_chunks: state.pending.size });
    scheduleReconnect();
  });
  socket.addEventListener("error", () => record("transport_error", { code: "websocket_error" }));
}

async function handleChunk(blob) {
  if (!blob.size || state.stopping) return;
  const sequence = state.sequence++;
  const capturedMono = performance.now();
  const expected = state.captureStartedMono + (sequence + 1) * CHUNK_MS;
  record("audio_chunk", {
    sequence,
    byte_length: blob.size,
    drift_ms: Math.round((capturedMono - expected) * 1000) / 1000,
    pending_chunks: state.pending.size,
  });
  if (!state.transportUrl) return;
  if (state.pending.size >= MAX_PENDING_CHUNKS) {
    record("transport_backpressure_drop", { sequence, pending_chunks: state.pending.size });
    return;
  }
  state.pending.set(sequence, frameChunk(sequence, capturedMono, blob));
  flushPending();
}

async function startCapture(message) {
  if (state.status === "capturing") throw new Error("Capture is already active.");
  const settings = await chrome.storage.local.get("captureProbeConfig");
  state.transportUrl = safeTransportUrl(settings.captureProbeConfig?.transportUrl);
  state.tabId = message.tabId;
  state.sequence = 0;
  state.pending.clear();
  state.sentThisConnection.clear();
  state.logs = [];
  state.stopping = false;
  state.longTaskCount = 0;
  record("capture_start_requested", { tab_id: state.tabId, chunk_duration_ms: CHUNK_MS });

  state.stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: message.streamId } },
    video: false,
  });
  state.audioContext = new AudioContext();
  await state.audioContext.resume();
  state.sourceNode = state.audioContext.createMediaStreamSource(state.stream);
  state.sourceNode.connect(state.audioContext.destination);
  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
  state.recorder = new MediaRecorder(state.stream, { mimeType, audioBitsPerSecond: 64000 });
  state.recorder.addEventListener("dataavailable", (event) => handleChunk(event.data));
  state.recorder.addEventListener("error", () => record("recorder_error", { code: "media_recorder_error" }));
  for (const track of state.stream.getTracks()) {
    track.addEventListener("ended", () => { if (!state.stopping) stopCapture("track_ended"); }, { once: true });
  }
  try {
    state.observer = new PerformanceObserver((list) => { state.longTaskCount += list.getEntries().length; });
    state.observer.observe({ type: "longtask", buffered: true });
  } catch { state.observer = null; }
  state.captureStartedMono = performance.now();
  state.recorder.start(CHUNK_MS);
  state.status = "capturing";
  record("capture_started", {
    mime_type: state.recorder.mimeType,
    sample_rate_hz: state.audioContext.sampleRate,
    audio_context_state: state.audioContext.state,
    playback_routed: true,
  });
  connectTransport();
  await notifyWorker({ status: "capturing", tabId: state.tabId, startedAt: new Date().toISOString() });
}

async function waitForRecorderStop() {
  if (!state.recorder || state.recorder.state === "inactive") return;
  await new Promise((resolve) => {
    state.recorder.addEventListener("stop", resolve, { once: true });
    state.recorder.stop();
  });
}

async function stopCapture(reason = "user_stop") {
  if (state.stopping || state.status === "idle") return;
  state.stopping = true;
  await waitForRecorderStop().catch(() => {});
  clearTimeout(state.reconnectTimer);
  state.reconnectTimer = null;
  state.sourceNode?.disconnect();
  for (const track of state.stream?.getTracks() || []) track.stop();
  await state.audioContext?.close().catch(() => {});
  state.observer?.disconnect();
  const resourcesReleased = (state.stream?.getTracks() || []).every((track) => track.readyState === "ended")
    && (!state.audioContext || state.audioContext.state === "closed");
  record("capture_stopped", {
    reason, chunks: state.sequence, pending_chunks: state.pending.size,
    long_tasks: state.longTaskCount, resources_released: resourcesReleased,
  });
  if (state.socket?.readyState === WebSocket.OPEN) {
    state.socket.send(JSON.stringify({ type: "stop", resources_released: resourcesReleased }));
  }
  state.socket?.close(1000, "capture stopped");
  state.status = "idle";
  state.stream = null;
  state.audioContext = null;
  state.sourceNode = null;
  state.recorder = null;
  state.socket = null;
  state.pending.clear();
  state.sentThisConnection.clear();
  state.stopping = false;
  await notifyWorker({ status: "idle", stoppedAt: new Date().toISOString(), resourcesReleased });
}

function snapshot() {
  return {
    status: state.status, tabId: state.tabId, chunks: state.sequence,
    pendingChunks: state.pending.size, transportConnected: state.socket?.readyState === WebSocket.OPEN,
    longTasks: state.longTaskCount, logs: state.logs,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen") return false;
  (async () => {
    if (message.type === "capture.start") { await startCapture(message); return { ok: true }; }
    if (message.type === "capture.stop") { await stopCapture(message.reason); return { ok: true, snapshot: snapshot() }; }
    if (message.type === "capture.snapshot") return { ok: true, snapshot: snapshot() };
    if (message.type === "capture.forceDisconnect") {
      if (state.socket?.readyState === WebSocket.OPEN) state.socket.close(4001, "forced probe disconnect");
      return { ok: true };
    }
    if (message.type === "capture.clearLogs") { state.logs = []; return { ok: true }; }
    return { ok: false, error: "unknown_message" };
  })().then(sendResponse, async (error) => {
    record("probe_error", { code: error?.name || "capture_error", message: error?.message || "Capture error" });
    await notifyWorker({ status: "error", message: error?.message || "Capture error" });
    sendResponse({ ok: false, error: error?.message || "capture_error" });
  });
  return true;
});
