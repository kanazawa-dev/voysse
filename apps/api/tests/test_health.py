from sqlalchemy.exc import OperationalError

from app.database import get_db
from app.main import app


def test_liveness_and_readiness(client):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/ready").json() == {"status": "ready"}


def test_readiness_failure_is_safe(client):
    class UnavailableDatabase:
        def execute(self, statement):
            raise OperationalError("private-db-password", {}, Exception("secret"))

    original = app.dependency_overrides[get_db]
    app.dependency_overrides[get_db] = lambda: UnavailableDatabase()
    try:
        response = client.get("/ready")
        assert response.status_code == 503
        assert response.json() == {"status": "unavailable"}
        assert client.get("/health").status_code == 200
    finally:
        app.dependency_overrides[get_db] = original
