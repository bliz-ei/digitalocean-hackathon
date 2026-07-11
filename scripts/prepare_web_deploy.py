import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description="Render the Verity marketing-site App Platform spec")
parser.add_argument("--template", type=Path, default=ROOT / "infra/web.yaml")
parser.add_argument("--output", type=Path, default=ROOT / ".verity/web.yaml")
args = parser.parse_args()

app_url = os.getenv("VERITY_APP_URL", "").rstrip("/")
if not app_url.startswith("https://"):
    print("VERITY_APP_URL must be the deployed HTTPS API/PWA origin", file=sys.stderr)
    raise SystemExit(2)

rendered = args.template.read_text().replace('"__VERITY_APP_URL__"', json.dumps(app_url))
if "__VERITY_APP_URL__" in rendered:
    print("Web deployment template still contains unresolved tokens", file=sys.stderr)
    raise SystemExit(2)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(rendered)
print(args.output.resolve())
