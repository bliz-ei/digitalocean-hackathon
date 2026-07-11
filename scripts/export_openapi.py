import argparse, json
from pathlib import Path
from app.main import app

target = Path(__file__).parents[1] / "packages/contracts/openapi.json"
rendered = json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"
check = argparse.ArgumentParser().parse_known_args()[1] == ["--check"]
if check and (not target.exists() or target.read_text() != rendered):
    raise SystemExit("OpenAPI artifact is stale; run npm run contracts:generate")
if not check:
    target.write_text(rendered)
