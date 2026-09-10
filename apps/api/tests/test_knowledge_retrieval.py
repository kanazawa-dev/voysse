"""Deterministic retrieval acceptance: real PostgreSQL, no provider traffic."""
import asyncio
import uuid
from unittest.mock import AsyncMock

import pytest

from app.models import Agent, KnowledgeChunk, KnowledgeDocument
from app.services import knowledge
from conftest import TestingSession


@pytest.fixture
def corpus(authenticated_client, monkeypatch):
    client_id = authenticated_client.post("/api/clients", json={"name": "Retrieval"}).json()["id"]
    agents = [uuid.UUID(authenticated_client.post("/api/agents", json={
        "client_id": client_id, "name": name, "provider": "openai", "model": "gpt-4.1-mini",
    }).json()["id"]) for name in ("Main", "Other")]
    monkeypatch.setattr(knowledge, "resolve_provider_credentials", lambda *args: ("https://unused.invalid", "fake"))
    embedding = AsyncMock(return_value=[1.0, 0.0])
    monkeypatch.setattr(knowledge, "embed_query", embedding)
    return agents, embedding


def document(db, agent_id, name, content, *, indexed=True, status="processed"):
    doc = KnowledgeDocument(agent_id=agent_id, filename=name, file_data=b"",
                            extracted_text=content, status=status)
    db.add(doc)
    db.flush()
    if indexed:
        db.add_all(KnowledgeChunk(document_id=doc.id, agent_id=agent_id,
                                 position=i, content=part, embedding=[1.0, 0.0])
                   for i, part in enumerate(knowledge._chunks(content)))
        db.flush()
    return doc


def retrieve(db, agent_id, query):
    return asyncio.run(knowledge.retrieve_knowledge(db, db.get(Agent, agent_id), query))


def test_small_corpus_includes_only_processed_agent_documents(corpus):
    (agent, other), embedding = corpus
    with TestingSession.begin() as db:
        good = document(db, agent, "hours.pdf", "Open Monday.")
        document(db, agent, "failed.pdf", "INVALID_SECRET", status="error")
        document(db, other, "other.pdf", "OTHER_SECRET")
        result = retrieve(db, agent, "hours")
        assert [s["id"] for s in result.sources] == [str(good.id)]
        assert "SECRET" not in result.text
    embedding.assert_not_called()


@pytest.mark.parametrize("query,content", [
    ("refund", "Refund within thirty days."),
    ("devolución", "La devolución tarda treinta días."),
])
def test_partial_index_falls_back_without_losing_matching_document(corpus, query, content):
    (agent, _), embedding = corpus
    with TestingSession.begin() as db:
        document(db, agent, "general.pdf", "General information. " * 2400)
        target = document(db, agent, "policy.pdf", content, indexed=False)
        result = retrieve(db, agent, query)
        assert [s["id"] for s in result.sources] == [str(target.id)]
        assert content in result.text
    embedding.assert_not_called()


@pytest.mark.parametrize("query", ["astronomy", "?!", ""])
def test_keyword_search_does_not_cite_arbitrary_text(corpus, query):
    (agent, _), _embedding = corpus
    with TestingSession.begin() as db:
        document(db, agent, "general.pdf", "General information. " * 2400, indexed=False)
        result = retrieve(db, agent, query)
        assert result.text == ""
        assert result.sources == []


@pytest.mark.parametrize("invalid_kind", ["failed", "foreign", "stale"])
def test_semantic_search_excludes_invalid_document_chunks(corpus, invalid_kind):
    (agent, other), _embedding = corpus
    with TestingSession.begin() as db:
        document(db, agent, "general.pdf", "General information. " * 2400)
        owner = other if invalid_kind == "foreign" else agent
        doc = document(db, owner, "invalid.pdf", "Current text.", indexed=False,
                       status="error" if invalid_kind == "failed" else "processed")
        # Inconsistent or stale index rows must not override document eligibility.
        db.add(KnowledgeChunk(document_id=doc.id, agent_id=agent, position=0,
                              content="INVALID_SECRET", embedding=[1.0, 0.0]))
        db.flush()
        result = retrieve(db, agent, "General")
        assert "INVALID_SECRET" not in result.text
        assert str(doc.id) not in {s["id"] for s in result.sources}


def test_complete_semantic_index_and_embedding_outage(corpus):
    (agent, _), embedding = corpus
    with TestingSession.begin() as db:
        doc = document(db, agent, "general.pdf", "General information. " * 2400)
        result = retrieve(db, agent, "General")
        assert [s["id"] for s in result.sources] == [str(doc.id)]
        assert result.sources[0]["excerpt"] in result.text
        embedding.assert_awaited_once()
        embedding.return_value = None
        fallback = retrieve(db, agent, "General")
        assert fallback.sources[0]["id"] == str(doc.id)
        assert "General" in fallback.text
