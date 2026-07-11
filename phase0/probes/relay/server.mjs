import { createServer } from "node:http";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WebSocketServer } from "ws";
import { parseFrame, validateHello } from "./protocol.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const resultsDirectory = path.join(root, "phase0/results");
const port = Number(process.env.PHASE0_RELAY_PORT || 8787);
const retainAudio = process.env.PHASE0_RETAIN_AUDIO === "1";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
await mkdir(resultsDirectory, { recursive: true });

const logPath = path.join(resultsDirectory, `relay-${stamp}.jsonl`);
const logStream = createWriteStream(logPath, { flags: "wx", mode: 0o600 });
const audioPath = retainAudio ? path.join(resultsDirectory, `capture-${stamp}.webm`) : null;
const audioStream = audioPath ? createWriteStream(audioPath, { flags: "wx", mode: 0o600 }) : null;
const accepted = new Set();
let metadata = null;
let sttSession = null;
let processing = Promise.resolve();

function log(event, details = {}) {
  logStream.write(`${JSON.stringify({
    schema_version: 1,
    event,
    wall_time: new Date().toISOString(),
    monotonic_ms: Math.round(performance.now() * 1000) / 1000,
    ...details,
  })}\n`);
}

function validateFinalSegment(segment) {
  if (!["A", "B"].includes(segment?.speaker)) throw new Error("STT speaker must normalize to A or B");
  if (typeof segment.text !== "string" || !segment.text.trim()) throw new Error("STT final text is required");
  if (!Number.isInteger(segment.start_ms) || segment.start_ms < 0) throw new Error("STT start_ms is invalid");
  if (!Number.isInteger(segment.end_ms) || segment.end_ms < segment.start_ms) throw new Error("STT end_ms is invalid");
}

async function loadAdapter() {
  const configured = process.env.PHASE0_STT_ADAPTER;
  if (!configured) return null;
  const module = await import(pathToFileURL(path.resolve(root, configured)).href);
  if (typeof module.createSttSession !== "function") throw new Error("STT adapter must export createSttSession(options)");
  return module.createSttSession;
}

const createSttSession = await loadAdapter();

async function ensureSttSession() {
  if (!createSttSession || sttSession) return;
  sttSession = await createSttSession({
    input: Object.freeze({ ...metadata }),
    emitFinal(segment, providerMetadata = {}) {
      validateFinalSegment(segment);
      const safeMetadata = {
        provider_event: providerMetadata.provider_event || null,
        is_final: true,
        received_at: new Date().toISOString(),
      };
      log("stt_final_segment", { segment, provider_metadata: safeMetadata });
    },
    emitError(code) {
      log("stt_error", { code: String(code || "provider_error").slice(0, 80) });
    },
  });
  if (!sttSession || typeof sttSession.sendChunk !== "function") {
    throw new Error("STT adapter session must expose sendChunk(chunk)");
  }
  log("stt_adapter_connected");
}

const server = createServer((request, response) => {
  if (request.url === "/healthz") {
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  response.writeHead(404).end();
});

const webSocketServer = new WebSocketServer({ server, maxPayload: 1024 * 1024 });
webSocketServer.on("connection", (socket, request) => {
  const remote = request.socket.remoteAddress;
  if (!remote || !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)) {
    socket.close(1008, "loopback only");
    return;
  }
  log("transport_connected");
  socket.on("message", (data, isBinary) => {
    processing = processing.then(async () => {
      try {
      if (!isBinary) {
        const message = JSON.parse(data.toString("utf8"));
        if (message.type === "hello") {
          metadata = validateHello(message);
          await ensureSttSession();
          log("transport_hello", metadata);
        } else if (message.type === "stop") {
          log("capture_stopped", {
            resources_released: message.resources_released === true,
            chunks: accepted.size,
          });
          await sttSession?.finish?.();
        }
        return;
      }
      if (!metadata) throw new Error("hello_required");
      const frame = parseFrame(data);
      if (accepted.has(frame.sequence)) {
        log("duplicate_chunk_ignored", { sequence: frame.sequence });
        socket.send(JSON.stringify({ type: "ack", sequence: frame.sequence }));
        return;
      }
      await sttSession?.sendChunk({
        sequence: frame.sequence,
        captured_monotonic_ms: frame.capturedMono,
        audio: frame.audio,
      });
      accepted.add(frame.sequence);
      audioStream?.write(frame.audio);
      const expected = metadata.capture_started_monotonic_ms + (frame.sequence + 1) * metadata.chunk_duration_ms;
      const driftMs = Math.round((frame.capturedMono - expected) * 1000) / 1000;
      log("audio_chunk", {
        sequence: frame.sequence,
        byte_length: frame.audio.length,
        drift_ms: driftMs,
      });
      socket.send(JSON.stringify({ type: "ack", sequence: frame.sequence }));
      } catch (error) {
        log("protocol_error", { code: String(error.message || "relay_error").slice(0, 80) });
        socket.close(1003, "protocol error");
      }
    });
  });
  socket.on("close", (code) => {
    processing = processing.then(async () => {
      log("transport_disconnected", { code });
      await sttSession?.transportDisconnected?.();
    });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Relay listening on ws://127.0.0.1:${port}`);
  console.log(`Sanitized log: ${path.relative(root, logPath)}`);
  console.log(retainAudio ? `Audio retention enabled: ${path.relative(root, audioPath)}` : "Audio retention disabled.");
  log("relay_started", { port, audio_retention: retainAudio, stt_adapter: Boolean(createSttSession) });
});

async function shutdown(signal) {
  log("relay_stopped", { signal });
  await sttSession?.finish?.().catch(() => {});
  for (const client of webSocketServer.clients) client.close(1001, "relay shutdown");
  await new Promise((resolve) => server.close(resolve));
  audioStream?.end();
  logStream.end();
}

process.once("SIGINT", () => shutdown("SIGINT").finally(() => process.exit(0)));
process.once("SIGTERM", () => shutdown("SIGTERM").finally(() => process.exit(0)));
