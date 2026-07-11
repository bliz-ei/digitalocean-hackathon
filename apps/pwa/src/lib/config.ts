/** API base URL and the VAPID key decoder — moved verbatim from the original main.tsx. */

export const base = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** Decode a base64url VAPID public key into an ArrayBuffer (verbatim from Arnav's main.tsx). */
export function decodeVapid(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob((value + padding).replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0)).buffer as ArrayBuffer;
}
