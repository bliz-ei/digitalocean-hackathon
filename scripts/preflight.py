import argparse
import json
import os
import sys
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description="Validate Verity build and deployment readiness")
parser.add_argument("--release", action="store_true", help="require deployment secrets and a live readiness URL")
args = parser.parse_args()

checks: dict[str, bool] = {
    "extension_build": (ROOT / "apps/extension/dist/manifest.json").exists(),
    "pwa_build": (ROOT / "apps/pwa/dist/index.html").exists(),
    "service_worker": (ROOT / "apps/pwa/dist/sw.js").exists(),
    "openapi_contract": (ROOT / "packages/contracts/openapi.json").exists(),
    "cross_device_migration": (ROOT / "services/api/migrations/003_cross_device.sql").exists(),
}

spec = (ROOT / "infra/app.yaml").read_text()
for required in ("kind: PRE_DEPLOY", "python scripts/migrate.py", "value: ${APP_URL}", "value: ${db.DATABASE_URL}", "prefix: /v1"):
    checks[f"app_spec:{required}"] = required in spec

required_env = (
    "VERITY_PAIRING_SECRET",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
    "VERITY_STT_API_KEY",
    "VERITY_GRADIENT_AGENT_ENDPOINT",
    "VERITY_GRADIENT_AGENT_KEY",
    "VERITY_FAST_API_KEY",
    "VERITY_FAST_MODEL",
    "VERITY_REASONING_API_KEY",
    "VERITY_REASONING_MODEL",
)
if args.release:
    for key in required_env:
        checks[f"env:{key}"] = bool(os.getenv(key))
    checks["pairing_secret_length"] = len(os.getenv("VERITY_PAIRING_SECRET", "")) >= 32
    checks["vapid_subject"] = os.getenv("VAPID_SUBJECT", "").startswith(("mailto:", "https://"))
    checks["gradient_endpoint_https"] = os.getenv("VERITY_GRADIENT_AGENT_ENDPOINT", "").startswith("https://")

health_url = os.getenv("VERITY_HEALTH_URL")
if health_url:
    try:
        with urlopen(health_url.rstrip("/") + "/readyz", timeout=10) as response:
            readiness = json.load(response)
        checks["deployed_readiness"] = (
            readiness.get("status") == "ready"
            and readiness.get("repository") == "postgres"
            and readiness.get("push") == "configured"
            and readiness.get("stt") == "deepgram"
            and readiness.get("evidence") == "gradient"
            and readiness.get("classifier") == "openai-compatible"
            and readiness.get("reasoner") == "openai-compatible"
        )
    except Exception:
        checks["deployed_readiness"] = False
elif args.release:
    checks["env:VERITY_HEALTH_URL"] = False

print(json.dumps(checks, indent=2, sort_keys=True))
failed = [name for name, passed in checks.items() if not passed]
if failed:
    print("Release blockers: " + ", ".join(failed), file=sys.stderr)
sys.exit(1 if failed else 0)
