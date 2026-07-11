export const FRAME_HEADER_BYTES = 21;

export function parseFrame(data) {
  const buffer = Buffer.from(data);
  if (buffer.length < FRAME_HEADER_BYTES || buffer.subarray(0, 4).toString("ascii") !== "VRTY") {
    throw new Error("invalid_frame_magic");
  }
  if (buffer.readUInt8(4) !== 1) throw new Error("unsupported_frame_version");
  const sequenceBig = buffer.readBigUInt64BE(5);
  if (sequenceBig > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("sequence_out_of_range");
  return {
    sequence: Number(sequenceBig),
    capturedMono: buffer.readDoubleBE(13),
    audio: buffer.subarray(FRAME_HEADER_BYTES),
  };
}

export function validateHello(message) {
  const metadata = {
    schema_version: message?.schema_version,
    mime_type: message?.mime_type,
    chunk_duration_ms: message?.chunk_duration_ms,
    capture_started_monotonic_ms: message?.capture_started_monotonic_ms,
  };
  if (metadata.schema_version !== 1 || metadata.chunk_duration_ms !== 1000
    || !Number.isFinite(metadata.capture_started_monotonic_ms)
    || !/^audio\/webm(?:;|$)/.test(metadata.mime_type || "")) {
    throw new Error("incompatible_hello");
  }
  return metadata;
}
