import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import webpush from "web-push";
import { subscriptionId, validClaimId, validSubscription } from "./core.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(here, "public");
const required = ["PUBLIC_ORIGIN", "VAPID_SUBJECT", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "PUSH_ADMIN_TOKEN"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);

const origin = new URL(process.env.PUBLIC_ORIGIN).origin;
const port = Number(process.env.PORT || 8080);
const subscriptions = new Map();
webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

function log(event, details = {}) {
  console.log(JSON.stringify({ event, at: new Date().toISOString(), ...details }));
}

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw Object.assign(new Error("payload_too_large"), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("invalid_json"), { status: 400 }); }
}

function authorized(request) {
  const provided = Buffer.from(request.headers["x-phase0-admin-token"] || "");
  const expected = Buffer.from(process.env.PUSH_ADMIN_TOKEN);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

let crcTable;
function crc32(buffer) {
  crcTable ||= Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, checksum]);
}

function iconPng(size) {
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x += 1) {
      const offset = 1 + x * 4;
      const inset = size * 0.18;
      row.set(x > inset && x < size - inset && y > inset && y < size - inset
        ? [244, 247, 245, 255] : [21, 127, 91, 255], offset);
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function serveStatic(request, response) {
  if (["/icon-192.png", "/icon-512.png"].includes(request.url)) {
    const body = iconPng(request.url.includes("512") ? 512 : 192);
    response.writeHead(200, { "content-type": "image/png", "cache-control": "public, max-age=86400" });
    response.end(body);
    return;
  }
  const route = request.url.split("?")[0];
  const file = route === "/app.js" ? "app.js"
    : route === "/sw.js" ? "sw.js"
      : route === "/manifest.webmanifest" ? "manifest.webmanifest"
        : "index.html";
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8" };
  const body = await readFile(path.join(publicDirectory, file));
  response.writeHead(200, {
    "content-type": types[path.extname(file)],
    "cache-control": file === "sw.js" ? "no-cache" : "public, max-age=300",
    "service-worker-allowed": "/",
  });
  response.end(body);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, origin);
    if (request.method === "GET" && url.pathname === "/healthz") return sendJson(response, 200, { ok: true });
    if (request.method === "GET" && url.pathname === "/api/config") {
      return sendJson(response, 200, { vapid_public_key: process.env.VAPID_PUBLIC_KEY, origin });
    }
    if (request.method === "POST" && url.pathname === "/api/subscriptions") {
      const subscription = await readJson(request);
      if (!validSubscription(subscription)) return sendJson(response, 400, { error: "invalid_subscription" });
      const id = subscriptionId(subscription.endpoint);
      subscriptions.set(id, subscription);
      log("subscription_registered", { subscription_id: id });
      return sendJson(response, 201, { id });
    }
    const subscriptionMatch = url.pathname.match(/^\/api\/subscriptions\/([a-f0-9]{24})$/);
    if (request.method === "DELETE" && subscriptionMatch) {
      const removed = subscriptions.delete(subscriptionMatch[1]);
      log("subscription_revoked", { subscription_id: subscriptionMatch[1], existed: removed });
      return sendJson(response, 200, { revoked: true, existed: removed });
    }
    if (request.method === "POST" && url.pathname === "/api/notifications") {
      if (!authorized(request)) return sendJson(response, 401, { error: "unauthorized" });
      const body = await readJson(request);
      const subscription = subscriptions.get(body.subscription_id);
      if (!subscription) return sendJson(response, 404, { error: "subscription_not_found" });
      const claimId = body.claim_id || `claim_${randomBytes(16).toString("hex")}`;
      if (!validClaimId(claimId)) return sendJson(response, 400, { error: "invalid_claim_id" });
      const sentAt = new Date().toISOString();
      const claimUrl = `${origin}/claims/${claimId}`;
      try {
        const result = await webpush.sendNotification(subscription, JSON.stringify({
          title: "Verity found missing context",
          body: "Tap to inspect a synthetic Phase 0 verdict route.",
          url: claimUrl,
          sent_at: sentAt,
        }), { TTL: 60, urgency: "high" });
        log("push_sent", { subscription_id: body.subscription_id, claim_id: claimId, status_code: result.statusCode });
        return sendJson(response, 202, { claim_id: claimId, claim_url: claimUrl, sent_at: sentAt, status_code: result.statusCode });
      } catch (error) {
        const removed = [404, 410].includes(error.statusCode);
        if (removed) subscriptions.delete(body.subscription_id);
        log("push_failed", { subscription_id: body.subscription_id, claim_id: claimId, status_code: error.statusCode || null, code: "web_push_error" });
        return sendJson(response, 502, { error: "push_failed", status_code: error.statusCode || null, subscription_removed: removed });
      }
    }
    if (request.method === "GET") return serveStatic(request, response);
    return sendJson(response, 404, { error: "not_found" });
  } catch (error) {
    log("request_failed", { code: error.message || "request_error" });
    return sendJson(response, error.status || 500, { error: error.status ? error.message : "internal_error" });
  }
});

server.listen(port, "0.0.0.0", () => log("push_probe_started", { port, origin }));
