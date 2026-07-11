import { useState } from "react";
import { api, type PairedDevice } from "@verity/contracts";
import { base } from "./config";

/** ?pair= redemption token from the URL, if present. Read once at module load
 *  (verbatim from Arnav's main.tsx). */
export const redemptionToken = new URLSearchParams(location.search).get("pair") ?? undefined;

/** Load the paired device from localStorage. Storage key "verityDevice" is preserved. */
export function loadDevice(): PairedDevice | undefined {
  const saved = localStorage.getItem("verityDevice");
  return saved ? JSON.parse(saved) : undefined;
}

/** Pairing flow. The redeemPairing call, "verityDevice" storage key, and the
 *  "That pairing code is invalid, expired, or already used" error string are
 *  preserved verbatim from Arnav's main.tsx — restructured into a hook. */
export function usePairing() {
  const [device, setDevice] = useState<PairedDevice | undefined>(loadDevice);
  const [status, setStatus] = useState<string | undefined>();
  const [code, setCode] = useState("");

  async function pair() {
    setStatus("Pairing…");
    try {
      const next = await api.redeemPairing(base, { code: redemptionToken ? undefined : code, redemption_token: redemptionToken, device_label: "Demo iPhone" });
      localStorage.setItem("verityDevice", JSON.stringify(next));
      setDevice(next); setStatus("Paired — enable notifications");
    } catch { setStatus("That pairing code is invalid, expired, or already used"); }
  }

  return { device, status, code, setCode, pair };
}
