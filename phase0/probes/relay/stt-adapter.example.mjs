/**
 * Copy this file to ignored phase0/local/ and implement it for one selected
 * realtime STT candidate. Read credentials only from process.env. Do not log
 * headers, provider bodies, audio, or credentials.
 */
export async function createSttSession({ input, emitFinal, emitError }) {
  void input;
  void emitFinal;
  void emitError;
  throw new Error("Configure a selected STT provider in phase0/local before running this adapter.");

  // Return this shape after opening the provider's realtime connection:
  // return {
  //   async sendChunk({ sequence, captured_monotonic_ms, audio }) {},
  //   async transportDisconnected() {},
  //   async finish() {},
  // };
  //
  // Call emitFinal({ speaker: "A" | "B", text, start_ms, end_ms },
  //   { provider_event: "sanitized-event-name" }) only for provider-final data.
  // Never invent missing timestamps; reject the candidate instead.
}
