# Knowledge base

Each agent has its own knowledge base: manual context, structured Q&A pairs and uploaded PDFs, all folded into the system prompt sent to the LLM on every reply. For agent-level settings see [Agents](./agents.md).

## Contents

- [Ways to add knowledge](#ways-to-add-knowledge)
- [How retrieval works](#how-retrieval-works)
- [Retrieval regression checks](#retrieval-regression-checks)
- [Storage](#storage)

## Ways to add knowledge

All three live on an agent's detail page, under the **Knowledge** tab (`/agents/{id}`, tab `knowledge`).

- **Manual context** — a free-form text box (`PUT /agents/{id}/context`, field `manual_context`). Saved as-is on the agent row; no chunking, no embeddings. It is always included in full in every system prompt for that agent.
- **Structured Q&A pairs** — a question (up to 2000 characters) and an exact answer (up to 8000 characters), added one at a time (`POST /agents/{id}/qa`) and listed for deletion (`DELETE /agents/{id}/qa/{qa_id}`). Like manual context, every saved pair is always included in full in every system prompt — pairs are not searched or ranked, so keep the list to what genuinely needs an exact, guaranteed answer.
- **PDF upload** — drag a PDF (up to 20 MB, `POST /agents/{id}/documents`, `multipart/form-data`). The backend extracts text per page with `pypdf`. A scanned PDF with no text layer is saved with `status: "error"` and a message explaining it could not be processed (no OCR is performed). On success (`status: "processed"`), the extracted text is stored and, best-effort, immediately chunked and embedded for semantic search (see below) — embedding failure never fails the upload, it just means that document falls back to keyword search. Documents can be deleted (`DELETE /agents/{id}/documents/{document_id}`), which cascades to their stored chunks.

Unlike manual context and Q&A pairs, PDF content is **not** always included in full — see retrieval below.

## How retrieval works

On every reply (`apps/api/app/services/knowledge.py`), `retrieve_knowledge()` decides how much of the agent's PDF text to include:

- **Small knowledge base** (all processed documents' extracted text totals ≤ 45,000 characters): every document is included in full, tagged as `DOCUMENTO: <filename>`.
- **Larger knowledge base** (> 45,000 characters total): the documents are split into ~1,800-character chunks (splitting on paragraph boundaries, falling back to a hard cut for oversized paragraphs) and only the most relevant ones are included, up to a 32,000-character budget:
  - **Semantic search** — if the agency has an OpenAI key configured and the complete current corpus has stored embeddings, each chunk's embedding (computed at upload time, model `text-embedding-3-small`) is compared to the query's embedding by cosine similarity, and the highest-scoring chunks are selected. Only processed, nonempty documents belonging to this agent are eligible, even if an inconsistent chunk row points elsewhere.
  - **Keyword fallback** — if the key/query embedding is unavailable, or the stored index is incomplete, stale or duplicated, search falls back over **all** eligible documents. Chunks are ranked by occurrences of query terms (3+ character words). Only positive matches are returned; an empty query or no match produces no documentary context or citations, rather than an arbitrary first chunk. Small knowledge bases still use the full-context behavior above.

Index readiness is checked against current document chunks (position and content)
on each large-corpus retrieval. This adds CPU/memory proportional to corpus size;
it avoids silently omitting documents after partial embedding failures. It does
not repair the index or perform paid re-embedding automatically.

Embeddings **always use the agency's OpenAI key** for this step (`resolve_provider_credentials(db, agent.agency_id, "openai")`), even when the agent's chat model is configured for Anthropic — an agency with only an Anthropic key configured falls back to keyword search for large knowledge bases.

The selected knowledge text, together with manual context, Q&A pairs and the structured business brief, is assembled by `build_system_prompt()` into the system message sent to the model — this is the one deliberate exception to the project's English-only-code convention (see `CLAUDE.md`): the section labels and connective text of the system prompt (e.g. "INSTRUCCIONES PRINCIPALES", "CONOCIMIENTO DOCUMENTAL", "PREGUNTAS FRECUENTES") are written in Spanish rather than English, because this text is customer-facing conversational context sent to the LLM, not developer-facing code.

## Retrieval regression checks

Run against a dedicated disposable PostgreSQL database ending in `_test`:

```bash
cd apps/api
TEST_DATABASE_URL=<disposable-test-url> .venv/bin/pytest tests/test_knowledge_retrieval.py -q
```

The deterministic fixtures exercise small/full context, English/Spanish keyword
fallback, incomplete indexes, failed/foreign/stale sources, no-match queries,
semantic citations and query-embedding outages. Embeddings are mocked; no provider
requests, customer documents or model charges are involved. Tests are collected
by the regular API suite. They do not establish model answer quality, semantic
precision on real vectors, hallucination rates, or prompt-injection resistance.
Those remain separate AI/RAG acceptance work.

Rollback: revert the retrieval changes and their regression tests/documentation;
no migration or stored-vector rewrite is required. That restores the known
partial-index omission and invalid-source risks.

## Storage

- `knowledge_documents` — one row per uploaded PDF: `filename`, the raw file bytes (`file_data`), the extracted text (`extracted_text`), and a `status`/`error_message` pair.
- `knowledge_chunks` — one row per chunk of a document's text: `content` (the chunk text) and `embedding`, stored as a plain **JSON array of floats** in a standard Postgres column — not a vector-typed column.

This is a deliberate simplicity tradeoff, called out directly in the model's source comment: similarity is computed in Python (`cosine_similarity()` in `apps/api/app/services/embeddings.py`) instead of in the database, so no `pgvector` (or any other Postgres extension) is required to self-host Voysse. The tradeoff is that similarity search is O(n) over an agent's chunks rather than index-accelerated — reasonable at the scale of one agent's knowledge base, with a documented escape hatch ("swap to pgvector at scale") if that ever stops being true.

## See also

- [Agents](./agents.md)
- [Architecture](./architecture.md)
