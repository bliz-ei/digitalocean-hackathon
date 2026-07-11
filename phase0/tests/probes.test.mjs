import assert from "node:assert/strict";
import test from "node:test";
import { parseFrame, validateHello } from "../probes/relay/protocol.mjs";
import { subscriptionId, validClaimId, validSubscription } from "../probes/push/core.mjs";

test("relay frame preserves sequence, timing, and audio", () => {
  const frame = Buffer.alloc(24);
  frame.write("VRTY", 0, "ascii");
  frame.writeUInt8(1, 4);
  frame.writeBigUInt64BE(42n, 5);
  frame.writeDoubleBE(1234.5, 13);
  frame.set([1, 2, 3], 21);
  const parsed = parseFrame(frame);
  assert.equal(parsed.sequence, 42);
  assert.equal(parsed.capturedMono, 1234.5);
  assert.deepEqual([...parsed.audio], [1, 2, 3]);
});

test("relay rejects an incompatible hello", () => {
  assert.throws(() => validateHello({ schema_version: 1, mime_type: "audio/wav", chunk_duration_ms: 1000, capture_started_monotonic_ms: 1 }), /incompatible_hello/);
  assert.equal(validateHello({ schema_version: 1, mime_type: "audio/webm;codecs=opus", chunk_duration_ms: 1000, capture_started_monotonic_ms: 1 }).mime_type, "audio/webm;codecs=opus");
});

test("push identifiers expose no endpoint and claim IDs require 128 random bits", () => {
  const endpoint = "https://push.example.test/private/subscription";
  const id = subscriptionId(endpoint);
  assert.match(id, /^[a-f0-9]{24}$/);
  assert.ok(!id.includes("private"));
  assert.equal(validClaimId(`claim_${"a".repeat(32)}`), true);
  assert.equal(validClaimId("claim_short"), false);
});

test("push subscription accepts only HTTPS with both encrypted key fields", () => {
  assert.equal(validSubscription({ endpoint: "https://push.example.test/x", keys: { p256dh: "a".repeat(16), auth: "b".repeat(16) } }), true);
  assert.equal(validSubscription({ endpoint: "http://push.example.test/x", keys: { p256dh: "a".repeat(16), auth: "b".repeat(16) } }), false);
  assert.equal(validSubscription({ endpoint: "https://push.example.test/x", keys: {} }), false);
});
