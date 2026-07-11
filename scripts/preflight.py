import json
import os
import sys
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
checks = {
    "extension_build": ROOT / "apps/extension/dist/manifest.json",
    "pwa_build": ROOT / "apps/pwa/dist/index.html",
    "app_spec": ROOT / "infra/app.yaml",
    "migration_live": ROOT / "services/api/migrations/002_live_transcript.sql",
    "migration_cross_device": ROOT / "services/api/migrations/003_cross_device.sql",
    "migration_evidence": ROOT / "services/api/migrations/003_evidence_verdict.sql",
}
result = {name: path.exists() for name, path in checks.items()}
health_url = os.getenv("VERITY_HEALTH_URL")
if health_url:
    try:
        with urlopen(health_url.rstrip("/") + "/readyz", timeout=5) as response:
            body = json.loads(response.read().decode())
            result["deployed_readiness"] = response.status == 200 and body.get("status") == "ready"
    except Exception:
        result["deployed_readiness"] = False
print(json.dumps(result, indent=2))
sys.exit(0 if all(result.values()) else 1)
