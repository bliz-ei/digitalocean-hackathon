import { createHash } from "node:crypto";

export function subscriptionId(endpoint) {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 24);
}

export function validSubscription(value) {
  return Boolean(value && typeof value.endpoint === "string" && value.endpoint.startsWith("https://")
    && ["p256dh", "auth"].every((key) => typeof value.keys?.[key] === "string" && value.keys[key].length >= 16));
}

export function validClaimId(value) {
  return /^claim_[a-f0-9]{32}$/.test(value);
}
