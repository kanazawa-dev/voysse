from datetime import timedelta

from sqlalchemy import select
from app.deps import get_current_admin
from app.main import app
from app.models import AcquisitionCount, now_utc
from app.routers.acquisition import acquisition_limit
from conftest import TestingSession


def test_open_sources_and_atomic_counts(client):
    for source in ["hn", "reddit", "producthunt", "linkedin", "podcast-42", " NEW_partner "]:
        for _ in range(2):
            assert client.post("/api/acquisition/events", json={"source": source, "event": "pageview"}).status_code == 204
    with TestingSession() as db:
        rows = db.scalars(select(AcquisitionCount)).all()
        assert len(rows) == 6 and all(row.count == 2 for row in rows)
        assert "new_partner" in {row.source for row in rows}
    assert client.get("/api/admin/acquisition").status_code == 401


def test_invalid_payloads(client):
    for source in ["", "a" * 81, "<script>", "email@example.com", "two words", "https://site"]:
        assert client.post("/api/acquisition/events", json={"source": source, "event": "app"}).status_code == 422
    assert client.post("/api/acquisition/events", json={"source": "hn", "event": "signup"}).status_code == 422
    assert client.post("/api/acquisition/events", json={"source": "hn", "event": "app", "url": "private"}).status_code == 422


def test_report_and_retention(client):
    today = now_utc().date()
    with TestingSession() as db:
        db.add_all([AcquisitionCount(day=today - timedelta(days=days), source="hn", event="pageview", count=10)
                    for days in [0, 29, 30, 90]])
        db.commit()
    client.post("/api/acquisition/events", json={"source": "youtube", "event": "booking"})
    app.dependency_overrides[get_current_admin] = lambda: object()
    try:
        result = client.get("/api/admin/acquisition").json()
        assert {"source": "hn", "event": "pageview", "count": 20} in result["rows"]
        assert {"source": "youtube", "event": "booking", "count": 1} in result["rows"]
        assert not result["truncated"]
        assert client.get("/api/admin/acquisition?days=91").status_code == 422
        with TestingSession() as db:
            assert len(db.scalars(select(AcquisitionCount)).all()) == 4
    finally:
        app.dependency_overrides.pop(get_current_admin)


def test_rate_limit_dependency(client):
    from fastapi import HTTPException
    def blocked():
        raise HTTPException(429, "Too many requests")
    app.dependency_overrides[acquisition_limit] = blocked
    try:
        assert client.post("/api/acquisition/events", json={"source": "hn", "event": "pageview"}).status_code == 429
    finally:
        app.dependency_overrides.pop(acquisition_limit)


def test_agency_cannot_read_global_report(authenticated_client):
    assert authenticated_client.get("/api/admin/acquisition").status_code == 401
