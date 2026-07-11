import argparse
import os
from pathlib import Path

import psycopg

database_url = os.environ.get(
    "VERITY_DATABASE_URL",
    "postgresql://verity:verity@localhost:54329/verity",
)
direction = argparse.ArgumentParser()
direction.add_argument("--down", action="store_true")
args = direction.parse_args()
name = "001_initial.down.sql" if args.down else "001_initial.sql"
migration = Path(__file__).parents[1] / "services/api/migrations" / name
with psycopg.connect(database_url, autocommit=True) as connection:
    connection.execute(migration.read_text())
