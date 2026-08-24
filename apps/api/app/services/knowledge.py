import re
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Agent, KnowledgeChunk, KnowledgeDocument
from .embeddings import cosine_similarity, embed_query, embed_texts
from .providers import resolve_provider_credentials


MAX_FULL_CONTEXT_CHARS = 45_000
MAX_SEARCH_CONTEXT_CHARS = 32_000


@dataclass
class KnowledgeResult:
    text: str
    sources: list[dict]


def _terms(query: str) -> set[str]:
    return {word.lower() for word in re.findall(r"[\wáéíóúñü]{3,}", query, flags=re.IGNORECASE)}


def _chunks(text: str, size: int = 1800) -> list[str]:
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    result: list[str] = []
    current = ""
    for paragraph in paragraphs:
        if len(current) + len(paragraph) + 2 <= size:
            current = f"{current}\n\n{paragraph}".strip()
            continue
        if current:
            result.append(current)
        if len(paragraph) <= size:
            current = paragraph
        else:
            result.extend(paragraph[i : i + size] for i in range(0, len(paragraph), size))
            current = ""
    if current:
        result.append(current)
    return result


def build_knowledge(agent: Agent, documents: list[KnowledgeDocument], query: str) -> KnowledgeResult:
    valid_docs = [doc for doc in documents if doc.status == "processed" and doc.extracted_text.strip()]
    total = sum(len(doc.extracted_text) for doc in valid_docs)
    sources: list[dict] = []

    if total <= MAX_FULL_CONTEXT_CHARS:
        sections = []
        for doc in valid_docs:
            sections.append(f"DOCUMENTO: {doc.filename}\n{doc.extracted_text}")
            sources.append({"id": str(doc.id), "filename": doc.filename, "excerpt": doc.extracted_text[:220].strip()})
        return KnowledgeResult(text="\n\n".join(sections), sources=sources)

    terms = _terms(query)
    ranked: list[tuple[int, KnowledgeDocument, str]] = []
    for doc in valid_docs:
        for chunk in _chunks(doc.extracted_text):
            lower = chunk.lower()
            score = sum(lower.count(term) for term in terms)
            ranked.append((score, doc, chunk))
    ranked.sort(key=lambda item: item[0], reverse=True)

    selected = []
    used_chars = 0
    seen_docs: set[str] = set()
    for score, doc, chunk in ranked:
        if terms and score == 0 and selected:
            break
        if used_chars + len(chunk) > MAX_SEARCH_CONTEXT_CHARS:
            continue
        selected.append(f"DOCUMENTO: {doc.filename}\n{chunk}")
        used_chars += len(chunk)
        if str(doc.id) not in seen_docs:
            sources.append({"id": str(doc.id), "filename": doc.filename, "excerpt": chunk[:220].strip()})
            seen_docs.add(str(doc.id))
        if used_chars >= MAX_SEARCH_CONTEXT_CHARS:
            break
    return KnowledgeResult(text="\n\n".join(selected), sources=sources)


async def embed_document_chunks(db: Session, agent: Agent, document: KnowledgeDocument) -> int:
    """Chunk a processed document and store embeddings for semantic search.

    Best-effort: returns 0 (and stores nothing) when the agent has no connection
    or the provider does not support embeddings — keyword search still works.
    """
    if not document.extracted_text.strip():
        return 0
    credentials = resolve_provider_credentials(db, agent.agency_id, "openai")
    if not credentials:
        return 0
    pieces = _chunks(document.extracted_text)
    if not pieces:
        return 0
    base_url, api_key = credentials
    vectors = await embed_texts(base_url, api_key, pieces)
    if not vectors:
        return 0
    db.add_all(
        KnowledgeChunk(
            document_id=document.id,
            agent_id=agent.id,
            position=index,
            content=content,
            embedding=vector,
        )
        for index, (content, vector) in enumerate(zip(pieces, vectors))
    )
    db.commit()
    return len(pieces)


async def retrieve_knowledge(db: Session, agent: Agent, query: str) -> KnowledgeResult:
    """Return the knowledge context for a query.

    Small knowledge bases are included in full. Larger ones use semantic search
    over stored embeddings, falling back to keyword ranking when embeddings are
    unavailable.
    """
    documents = list(
        db.scalars(select(KnowledgeDocument).where(KnowledgeDocument.agent_id == agent.id)).all()
    )
    valid_docs = [doc for doc in documents if doc.status == "processed" and doc.extracted_text.strip()]
    total = sum(len(doc.extracted_text) for doc in valid_docs)
    if total <= MAX_FULL_CONTEXT_CHARS:
        return build_knowledge(agent, valid_docs, query)

    semantic = await _semantic_search(db, agent, query)
    return semantic if semantic is not None else build_knowledge(agent, valid_docs, query)


async def _semantic_search(db: Session, agent: Agent, query: str) -> KnowledgeResult | None:
    credentials = resolve_provider_credentials(db, agent.agency_id, "openai")
    if not credentials:
        return None
    chunks = list(
        db.scalars(select(KnowledgeChunk).where(KnowledgeChunk.agent_id == agent.id)).all()
    )
    chunks = [chunk for chunk in chunks if chunk.embedding]
    if not chunks:
        return None
    base_url, api_key = credentials
    query_vector = await embed_query(base_url, api_key, query)
    if not query_vector:
        return None

    ranked = sorted(chunks, key=lambda chunk: cosine_similarity(query_vector, chunk.embedding), reverse=True)
    selected: list[str] = []
    sources: list[dict] = []
    seen_docs: set[str] = set()
    used_chars = 0
    for chunk in ranked:
        if used_chars + len(chunk.content) > MAX_SEARCH_CONTEXT_CHARS:
            continue
        filename = chunk.document.filename
        selected.append(f"DOCUMENTO: {filename}\n{chunk.content}")
        used_chars += len(chunk.content)
        if str(chunk.document_id) not in seen_docs:
            sources.append({"id": str(chunk.document_id), "filename": filename, "excerpt": chunk.content[:220].strip()})
            seen_docs.add(str(chunk.document_id))
        if used_chars >= MAX_SEARCH_CONTEXT_CHARS:
            break
    if not selected:
        return None
    return KnowledgeResult(text="\n\n".join(selected), sources=sources)


def _business_brief(agent: Agent) -> str:
    """Compose the filled structured-brief fields into a labelled block."""
    fields = (
        ("Qué hace el negocio", agent.brief_summary),
        ("Productos y servicios", agent.brief_products),
        ("Público objetivo", agent.brief_audience),
        ("Información y políticas clave", agent.brief_policies),
        ("Objetivo principal del agente", agent.brief_goal),
        ("Debe hacer siempre", agent.brief_dos),
        ("No debe hacer nunca", agent.brief_donts),
    )
    lines = [f"- {label}: {value.strip()}" for label, value in fields if value.strip()]
    return "\n".join(lines)


def build_system_prompt(agent: Agent, knowledge_text: str) -> str:
    client = agent.client
    tz_name = (agent.timezone or "UTC").strip() or "UTC"
    try:
        now = datetime.now(ZoneInfo(tz_name))
    except (ZoneInfoNotFoundError, ValueError):
        tz_name = "UTC"
        now = datetime.now(ZoneInfo("UTC"))
    parts = [
        f"Eres {agent.name}, un agente de IA de {client.name}.",
        f"FECHA Y HORA ACTUAL ({tz_name}): {now:%Y-%m-%d %H:%M}.",
        f"INSTRUCCIONES PRINCIPALES:\n{agent.instructions or 'Responde de forma útil y precisa.'}",
        f"PERSONALIDAD Y TONO:\n{agent.personality or 'Profesional, claro y amable.'}",
    ]
    brief = _business_brief(agent)
    if brief:
        parts.append(f"BRIEF DEL NEGOCIO:\n{brief}")
    if client.general_context.strip():
        parts.append(f"CONTEXTO GENERAL DEL CLIENTE:\n{client.general_context}")
    if agent.manual_context.strip():
        parts.append(f"CONTEXTO MANUAL DEL AGENTE:\n{agent.manual_context}")
    if agent.qa_pairs:
        faq = "\n\n".join(f"P: {qa.question}\nR: {qa.answer}" for qa in agent.qa_pairs)
        parts.append(f"PREGUNTAS FRECUENTES:\n{faq}")
    if knowledge_text.strip():
        parts.append(
            "CONOCIMIENTO DOCUMENTAL:\n"
            f"{knowledge_text}\n\n"
            "Usa este conocimiento cuando sea relevante. No inventes información que no aparezca aquí."
        )
    return "\n\n".join(parts)
