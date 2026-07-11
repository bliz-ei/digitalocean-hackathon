import process from "node:process";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1];
}

const origin = option("origin");
const subscription = option("subscription");
const token = option("token");
const claim = option("claim");
if (!origin || !subscription || !token) {
  console.error("usage: node send.mjs --origin https://… --subscription <id> --token <admin-token> [--claim claim_<32 hex>]");
  process.exit(2);
}

const response = await fetch(`${new URL(origin).origin}/api/notifications`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-phase0-admin-token": token },
  body: JSON.stringify({ subscription_id: subscription, ...(claim ? { claim_id: claim } : {}) }),
});
const result = await response.json();
console.log(JSON.stringify(result, null, 2));
if (!response.ok) process.exitCode = 1;
