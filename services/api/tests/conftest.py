import pytest
from fastapi.testclient import TestClient
from app import main
from app.persistence.repository import MemoryRepository

@pytest.fixture
def client():
    main.repo = MemoryRepository()
    main.live_sessions.clear()
    with TestClient(main.app) as value:
        yield value
