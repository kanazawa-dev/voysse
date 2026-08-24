import re
import uuid
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from pypdf import PdfReader
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..config import get_settings
from ..database import get_db
from ..deps import get_current_user
from ..models import Agent, AgentQA, Client, KnowledgeDocument, User, WhatsAppChannel
from ..schemas import AgentCreate, AgentOut, AgentUpdate, DocumentOut, ManualContextRequest, QAPairCreate, QAPairOut
from ..services.knowledge import embed_document_chunks


router = APIRouter(prefix="/agents", tags=["Agents"])
MAX_PDF_BYTES = 20 * 1024 * 1024


def _agent(db: Session, user: User, agent_id: uuid.UUID) -> Agent:
    agent = db.scalar(
        select(Agent)
        .options(joinedload(Agent.client).selectinload(Client.agents))
        .where(Agent.id == agent_id, Agent.agency_id == user.agency_id)
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


def _validate_client(db: Session, user: User, client_id: uuid.UUID) -> None:
    client = db.scalar(select(Client).where(Client.id == client_id, Client.agency_id == user.agency_id))
    if not client:
        raise HTTPException(status_code=400, detail="The selected client does not exist")


@router.get("", response_model=list[AgentOut])
def list_agents(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(
        select(Agent)
        .options(joinedload(Agent.client).selectinload(Client.agents))
        .where(Agent.agency_id == user.agency_id)
        .order_by(Agent.created_at.desc())
    ).unique().all()


@router.post("", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
def create_agent(payload: AgentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _validate_client(db, user, payload.client_id)
    agent = Agent(agency_id=user.agency_id, **payload.model_dump())
    db.add(agent)
    db.commit()
    return _agent(db, user, agent.id)


@router.get("/{agent_id}", response_model=AgentOut)
def get_agent(agent_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _agent(db, user, agent_id)


@router.patch("/{agent_id}", response_model=AgentOut)
def update_agent(agent_id: uuid.UUID, payload: AgentUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agent = _agent(db, user, agent_id)
    values = payload.model_dump(exclude_unset=True)
    client_id = values.get("client_id", agent.client_id)
    if client_id != agent.client_id and db.scalar(select(WhatsAppChannel).where(WhatsAppChannel.agent_id == agent.id)):
        raise HTTPException(
            status_code=409,
            detail="This agent is assigned to WhatsApp. Assign another agent to the channel before changing its client.",
        )
    _validate_client(db, user, client_id)
    for key, value in values.items():
        setattr(agent, key, value)
    db.commit()
    return _agent(db, user, agent_id)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(agent_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agent = _agent(db, user, agent_id)
    if db.scalar(select(WhatsAppChannel).where(WhatsAppChannel.agent_id == agent.id)):
        raise HTTPException(
            status_code=409,
            detail="This agent is assigned to WhatsApp. Assign another agent to the channel before deleting it.",
        )
    db.delete(agent)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{agent_id}/context", response_model=AgentOut)
def set_context(agent_id: uuid.UUID, payload: ManualContextRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agent = _agent(db, user, agent_id)
    agent.manual_context = payload.manual_context
    db.commit()
    return _agent(db, user, agent_id)


def _document_out(doc: KnowledgeDocument) -> dict:
    return {
        "id": doc.id,
        "filename": doc.filename,
        "status": doc.status,
        "error_message": doc.error_message,
        "created_at": doc.created_at,
        "character_count": len(doc.extracted_text or ""),
    }


@router.get("/{agent_id}/documents", response_model=list[DocumentOut])
def list_documents(agent_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agent = _agent(db, user, agent_id)
    docs = db.scalars(
        select(KnowledgeDocument)
        .where(KnowledgeDocument.agent_id == agent.id)
        .order_by(KnowledgeDocument.created_at.desc())
    ).all()
    return [_document_out(doc) for doc in docs]


@router.post("/{agent_id}/documents", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    agent_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    agent = _agent(db, user, agent_id)
    original_name = file.filename or "document.pdf"
    if file.content_type != "application/pdf" and not original_name.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    data = await file.read(MAX_PDF_BYTES + 1)
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="The PDF exceeds the 20 MB limit")

    safe_name = re.sub(r"[^\w. -]", "_", Path(original_name).name)[:220] or "document.pdf"
    document = KnowledgeDocument(agent_id=agent.id, filename=safe_name, file_data=data, status="processed")
    try:
        reader = PdfReader(BytesIO(data))
        document.extracted_text = "\n\n".join((page.extract_text() or "").strip() for page in reader.pages).strip()
        if not document.extracted_text:
            document.status = "error"
            document.error_message = "No extractable text was found in the PDF. It may be a scanned document."
    except Exception:
        document.status = "error"
        document.error_message = "The PDF could not be processed. Check that the file is not damaged or protected."
    db.add(document)
    db.commit()
    db.refresh(document)
    if document.status == "processed":
        # Best-effort: index embeddings for semantic search. Never fail the
        # upload if the provider has no embeddings support.
        try:
            await embed_document_chunks(db, agent, document)
        except Exception:
            db.rollback()
    return _document_out(document)


@router.delete("/{agent_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(agent_id: uuid.UUID, document_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agent = _agent(db, user, agent_id)
    document = db.scalar(
        select(KnowledgeDocument).where(
            KnowledgeDocument.id == document_id,
            KnowledgeDocument.agent_id == agent.id,
        )
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(document)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{agent_id}/qa", response_model=list[QAPairOut])
def list_qa(agent_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agent = _agent(db, user, agent_id)
    return db.scalars(select(AgentQA).where(AgentQA.agent_id == agent.id).order_by(AgentQA.position, AgentQA.created_at)).all()


@router.post("/{agent_id}/qa", response_model=QAPairOut, status_code=status.HTTP_201_CREATED)
def create_qa(agent_id: uuid.UUID, payload: QAPairCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agent = _agent(db, user, agent_id)
    position = db.scalar(select(func.count(AgentQA.id)).where(AgentQA.agent_id == agent.id)) or 0
    pair = AgentQA(agent_id=agent.id, question=payload.question.strip(), answer=payload.answer.strip(), position=position)
    db.add(pair)
    db.commit()
    db.refresh(pair)
    return pair


@router.delete("/{agent_id}/qa/{qa_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_qa(agent_id: uuid.UUID, qa_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agent = _agent(db, user, agent_id)
    pair = db.scalar(select(AgentQA).where(AgentQA.id == qa_id, AgentQA.agent_id == agent.id))
    if not pair:
        raise HTTPException(status_code=404, detail="Q&A pair not found")
    db.delete(pair)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
