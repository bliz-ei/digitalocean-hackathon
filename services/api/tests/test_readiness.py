import os

import pytest
from fastapi.testclient import TestClient

from app import main
from app.persistence.repository import MemoryRepository
from app.readiness import readiness_checks


@pytest.fixture
def client():
    main.repo = MemoryRepository()
    main.live_sessions.clear()
    with TestClient(main.app) as value:
        yield value


def test_readiness_passes_in_memory_mode(client):
    response = client.get("/readyz")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["repository"] == "memory"


def test_readiness_checks_memory_repository():
    ok, body = readiness_checks("memory", MemoryRepository())
    assert ok is True
    assert body["status"] == "ready"
    assert body["repository"] == "memory"


@pytest.mark.skipif(not os.getenv("TEST_DATABASE_URL"), reason="PostgreSQL not configured")
def test_readiness_requires_postgres_migrations():
    from app.persistence.repository import PostgresRepository

    previous_mode = main.mode
    main.mode = "postgres"
    main.repo = PostgresRepository(os.environ["TEST_DATABASE_URL"])
    try:
        with TestClient(main.app) as client:
            response = client.get("/readyz")
            body = response.json()
            if response.status_code == 200:
                assert body["database"] == "ok"
            else:
                assert response.status_code == 503
                assert body["status"] == "not_ready"
    finally:
        main.repo.close()
        main.mode = previous_mode
        main.repo = MemoryRepository()
