import type { Claim, Verdict } from "@verity/contracts";

/** Client-side history of every claim page this device has opened.
 *  Stored in localStorage under "verityClaimHistory" as a newest-first array. */
export const HISTORY_KEY = "verityClaimHistory";
const MAX_ENTRIES = 30;

export type ClaimHistoryEntry = {
  publicId: string;
  claimText: string;
  verdict: Verdict["label"] | null;
  savedAt: string; // ISO timestamp of when this device opened the page
};

function storage(): Storage | undefined {
  try { return globalThis.localStorage; } catch { return undefined; }
}

export function readHistory(): ClaimHistoryEntry[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ClaimHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/** Record a claim into history (newest-first, deduped by publicId). Returns the new list. */
export function recordClaim(claim: Claim): ClaimHistoryEntry[] {
  const store = storage();
  if (!store) return [];
  const entry: ClaimHistoryEntry = {
    publicId: claim.public_id,
    claimText: claim.exact_text,
    verdict: claim.verdict?.label ?? null,
    savedAt: new Date().toISOString(),
  };
  const next = [entry, ...readHistory().filter((item) => item.publicId !== entry.publicId)].slice(0, MAX_ENTRIES);
  store.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

/** Compact relative-time label, e.g. "just now", "3m ago", "2h ago", "5d ago". */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Whether this device has an active push subscription (storage key preserved from Arnav's flow). */
export function isSubscribed(): boolean {
  const store = storage();
  return !!store?.getItem("veritySubscriptionId");
}
