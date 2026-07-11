import argparse
import os
from pathlib import Path

import psycopg


database_url = os.environ.get("VERITY_DATABASE_URL", "postgresql://verity:verity@localhost:54329/verity")
parser = argparse.ArgumentParser()
parser.add_argument("--down", action="store_true")
args = parser.parse_args()
root = Path(__file__).parents[1] / "services/api/migrations"
migrations = sorted(root.glob("*.down.sql"), reverse=True) if args.down else sorted(
    path for path in root.glob("*.sql") if not path.name.endswith(".down.sql")
)
with psycopg.connect(database_url, autocommit=True) as connection:
    for migration in migrations:
        connection.execute(migration.read_text())
