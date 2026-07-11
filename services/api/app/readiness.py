import os
from typing import Any

from app.persistence.repository import PostgresRepository, Repository


def readiness_checks(repository_mode: str, repository: Repository) -> tuple[bool, dict[str, Any]]:
    checks: dict[str, Any] = {
        "status": "ready",
        "repository": repository_mode,
        "stt": "recorded",
        "push": "configured" if os.getenv("VAPID_PUBLIC_KEY") and os.getenv("VAPID_PRIVATE_KEY") else "disabled",
        "pairing_secret": "configured" if os.getenv("VERITY_PAIRING_SECRET") else "ephemeral",
    }
    ok = True

    if isinstance(repository, PostgresRepository):
        try:
            repository.db.execute("SELECT 1").fetchone()
            tables = {
                row[0]
                for row in repository.db.execute(
                    """SELECT table_name FROM information_schema.tables
                       WHERE table_schema = 'public'
                       AND table_name IN (
                         'pairing_challenges', 'paired_devices', 'notification_jobs'
                       )"""
                ).fetchall()
            }
            required = {"pairing_challenges", "paired_devices", "notification_jobs"}
            missing = sorted(required - tables)
            if missing:
                checks["database"] = "missing_migrations"
                checks["missing_tables"] = missing
                ok = False
            else:
                checks["database"] = "ok"
        except Exception as error:
            checks["database"] = "unavailable"
            checks["database_error"] = str(error)[:160]
            ok = False
        if repository_mode == "postgres" and not os.getenv("VERITY_PAIRING_SECRET"):
            checks["pairing_secret"] = "missing"
            ok = False

    if not ok:
        checks["status"] = "not_ready"
    return ok, checks
