import { beforeEach, describe, expect, it } from "vitest";
import type { Claim } from "@verity/contracts";
import { HISTORY_KEY, readHistory, recordClaim, relativeTime, isSubscribed } from "./lib/history";

// Minimal in-memory localStorage so the history module is testable in the node env.
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
  key() { return null; }
  get length() { return this.map.size; }
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    public_id: "abc123", session_id: "s", speaker_label: "Speaker A",
    exact_text: "The sky is green.", normalized_text: "the sky is green",
    start_ms: 0, end_ms: 1000, classification: "factual_claim", state: "COMPLETE",
    created_at: "2026-07-11T00:00:00Z", completed_at: "2026-07-11T00:00:01Z",
    evidence: [], verdict: null, fixture_mode: false, ...overrides,
  };
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("claim history", () => {
  it("starts empty", () => {
    expect(readHistory()).toEqual([]);
  });

  it("records a claim newest-first with verdict + text", () => {
    recordClaim(makeClaim({ public_id: "one", exact_text: "Claim one", verdict: { label: "Misleading" } as Claim["verdict"] }));
    recordClaim(makeClaim({ public_id: "two", exact_text: "Claim two" }));
    const history = readHistory();
    expect(history.map((h) => h.publicId)).toEqual(["two", "one"]);
    expect(history[1].verdict).toBe("Misleading");
    expect(history[1].claimText).toBe("Claim one");
    expect(history[0].verdict).toBeNull();
  });

  it("dedupes by publicId, moving the repeat to the front", () => {
    recordClaim(makeClaim({ public_id: "one" }));
    recordClaim(makeClaim({ public_id: "two" }));
    recordClaim(makeClaim({ public_id: "one" }));
    expect(readHistory().map((h) => h.publicId)).toEqual(["one", "two"]);
  });

  it("persists under the verityClaimHistory key", () => {
    recordClaim(makeClaim({ public_id: "keyed" }));
    expect(localStorage.getItem(HISTORY_KEY)).toContain("keyed");
  });

  it("reports subscription state from veritySubscriptionId", () => {
    expect(isSubscribed()).toBe(false);
    localStorage.setItem("veritySubscriptionId", "sub-1");
    expect(isSubscribed()).toBe(true);
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-07-11T12:00:00Z");
  it("labels sub-minute as just now", () => {
    expect(relativeTime("2026-07-11T11:59:30Z", now)).toBe("just now");
  });
  it("labels minutes, hours, days", () => {
    expect(relativeTime("2026-07-11T11:57:00Z", now)).toBe("3m ago");
    expect(relativeTime("2026-07-11T10:00:00Z", now)).toBe("2h ago");
    expect(relativeTime("2026-07-06T12:00:00Z", now)).toBe("5d ago");
  });
});
