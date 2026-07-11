import argparse
import hashlib
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
with psycopg.connect(database_url, autocommit=False) as connection:
    tracking_existed = connection.execute(
        "SELECT to_regclass('public.schema_migrations') IS NOT NULL"
    ).fetchone()[0]
    connection.execute("""CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
    )""")
    legacy_markers = {
        "001_initial.sql": "claims",
        "002_live_transcript.sql": "transcript_segments",
        "003_cross_device.sql": "pairing_challenges",
        "003_evidence_verdict.sql": "notification_jobs",
    }
    for migration in migrations:
        sql = migration.read_text()
        checksum = hashlib.sha256(sql.encode()).hexdigest()
        applied = connection.execute(
            "SELECT checksum FROM schema_migrations WHERE filename=%s", (migration.name,)
        ).fetchone()
        if applied:
            if applied[0] != checksum:
                raise RuntimeError(f"Applied migration changed: {migration.name}")
            continue
        marker = legacy_markers.get(migration.name)
        if not tracking_existed and marker and connection.execute(
            "SELECT to_regclass(%s) IS NOT NULL", (f"public.{marker}",)
        ).fetchone()[0]:
            connection.execute(
                "INSERT INTO schema_migrations(filename, checksum) VALUES (%s, %s)",
                (migration.name, checksum),
            )
            continue
        connection.execute(sql)
        connection.execute(
            "INSERT INTO schema_migrations(filename, checksum) VALUES (%s, %s)",
            (migration.name, checksum),
        )
    connection.commit()
