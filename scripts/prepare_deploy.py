import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description="Render a deployable App Platform spec without committing secrets")
parser.add_argument("--template", type=Path, default=ROOT / "infra/app.yaml")
parser.add_argument("--output", type=Path, default=ROOT / ".verity/app.yaml")
args = parser.parse_args()

values = {
    "__VERITY_PAIRING_SECRET__": os.getenv("VERITY_PAIRING_SECRET", ""),
    "__VAPID_PUBLIC_KEY__": os.getenv("VAPID_PUBLIC_KEY", ""),
    "__VAPID_PRIVATE_KEY__": os.getenv("VAPID_PRIVATE_KEY", ""),
    "__VAPID_SUBJECT__": os.getenv("VAPID_SUBJECT", ""),
    "__VERITY_STT_API_KEY__": os.getenv("VERITY_STT_API_KEY", ""),
}
missing = [token.strip("_") for token, value in values.items() if not value]
if missing:
    print("Missing deployment settings: " + ", ".join(missing), file=sys.stderr)
    raise SystemExit(2)
if len(values["__VERITY_PAIRING_SECRET__"]) < 32:
    print("VERITY_PAIRING_SECRET must contain at least 32 characters", file=sys.stderr)
    raise SystemExit(2)
if not values["__VAPID_SUBJECT__"].startswith(("mailto:", "https://")):
    print("VAPID_SUBJECT must start with mailto: or https://", file=sys.stderr)
    raise SystemExit(2)

rendered = args.template.read_text()
for token, value in values.items():
    rendered = rendered.replace(f'"{token}"', json.dumps(value))
if any(token in rendered for token in values):
    print("Deployment template still contains unresolved secret tokens", file=sys.stderr)
    raise SystemExit(2)

args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(rendered)
print(args.output.resolve())
