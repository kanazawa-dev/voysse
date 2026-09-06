"""Client-scoped operational graph; deliberately not a workflow execution engine."""
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .studio_layout import layout_view
from ..database import get_db
from ..deps import get_current_user
from ..models import Agent, Client, SocialChannel, User, WhatsAppChannel, WhatsAppCloudChannel, now_utc
from ..ratelimit import RateLimiter
from ..services.ai import chat_completion
from ..services.knowledge import build_system_prompt, retrieve_knowledge
from ..services.providers import resolve_agent_credentials
from ..services.usage import record_usage

router = APIRouter(prefix="/studio/{client_id}", tags=["Studio"])
Kind = Literal["whatsapp", "whatsapp-cloud", "instagram", "messenger"]
MODELS = {"whatsapp": WhatsAppChannel, "whatsapp-cloud": WhatsAppCloudChannel,
          "instagram": SocialChannel, "messenger": SocialChannel}
AGENT_FIELDS = ("id", "name", "description", "instructions", "model", "provider", "is_active",
                "widget_enabled", "widget_greeting", "widget_color", "widget_position", "updated_at")


def owned_client(db, user, client_id):
    row = db.scalar(select(Client).where(Client.id == client_id, Client.agency_id == user.agency_id))
    if not row:
        raise HTTPException(404, "Client not found")
    return row


def owned_agent(db, user, client_id, agent_id, lock=True):
    query = select(Agent).where(Agent.id == agent_id, Agent.client_id == client_id,
                                Agent.agency_id == user.agency_id)
    row = db.scalar(query.with_for_update() if lock else query)
    if not row:
        raise HTTPException(404, "Agent not found")
    return row


def channel_query(user, client_id, kind):
    model = MODELS[kind]
    query = select(model).where(model.client_id == client_id, model.agency_id == user.agency_id)
    return query.where(model.platform == kind) if model is SocialChannel else query


def graph(db, user, client_id):
    client = owned_client(db, user, client_id)
    agents = db.scalars(select(Agent).where(Agent.client_id == client_id,
                                         Agent.agency_id == user.agency_id).order_by(Agent.created_at)).all()
    channels = []
    for kind in MODELS:
        row = db.scalar(channel_query(user, client_id, kind))
        channels.append({"kind": kind, "id": row.id if row else None,
                         "agent_id": row.agent_id if row else None,
                         "status": row.status if row else "not_configured",
                         "is_enabled": row.is_enabled if row else False,
                         "updated_at": row.updated_at if row else None})
    return {"client": {"id": client.id, "name": client.name, "is_active": client.is_active},
            "layout": layout_view(client, [a.id for a in agents]),
            "agents": [{key: getattr(a, key) for key in AGENT_FIELDS} for a in agents], "channels": channels}


@router.get("")
def read_graph(client_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return graph(db, user, client_id)


class Binding(BaseModel):
    agent_id: uuid.UUID
    expected_agent_id: uuid.UUID
    expected_updated_at: datetime


@router.put("/channels/{kind}/agent")
def bind(client_id: uuid.UUID, kind: Kind, payload: Binding,
         db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    client = owned_client(db, user, client_id)
    agent = owned_agent(db, user, client_id, payload.agent_id)
    row = db.scalar(channel_query(user, client_id, kind).with_for_update())
    if not row:
        raise HTTPException(409, "Configure this channel first")
    if not client.is_active or not agent.is_active:
        raise HTTPException(409, "Client and target agent must be active")
    if row.agent_id != payload.expected_agent_id or row.updated_at != payload.expected_updated_at:
        raise HTTPException(409, "Connection changed; reload before applying")
    # Do not invoke legacy configure endpoints: they can enable/reset channels.
    row.agent_id, row.updated_at = agent.id, now_utc()
    db.commit()
    return graph(db, user, client_id)


class AgentSettings(BaseModel):
    expected_updated_at: datetime
    name: str = Field(min_length=1, max_length=180)
    description: str = Field(max_length=4000)
    instructions: str = Field(max_length=32000)
    widget_greeting: str = Field(max_length=2000)
    widget_color: str = Field(pattern=r"^(#[0-9a-fA-F]{6})?$")
    widget_enabled: bool


@router.patch("/agents/{agent_id}")
def configure_agent(client_id: uuid.UUID, agent_id: uuid.UUID, payload: AgentSettings,
                    db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agent = owned_agent(db, user, client_id, agent_id)
    if agent.updated_at != payload.expected_updated_at:
        raise HTTPException(409, "Agent changed; reload before applying")
    if not payload.name.strip():
        raise HTTPException(422, "Name is required")
    for key, value in payload.model_dump(exclude={"expected_updated_at"}).items():
        setattr(agent, key, value)
    agent.updated_at = now_utc()
    db.commit()
    return graph(db, user, client_id)


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class Preview(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[Turn] = Field(default_factory=list, max_length=12)


@router.post("/agents/{agent_id}/preview", dependencies=[Depends(RateLimiter(20, 60, name="studio-preview"))])
async def preview(client_id: uuid.UUID, agent_id: uuid.UUID, payload: Preview,
                  db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agent = owned_agent(db, user, client_id, agent_id, lock=False)
    credentials = resolve_agent_credentials(db, agent)
    if not credentials or not agent.model.strip():
        raise HTTPException(409, "Configure the model and provider credentials first")
    if not payload.message.strip():
        raise HTTPException(422, "Message is required")
    knowledge = await retrieve_knowledge(db, agent, payload.message)
    # No tool runner, channel send, production history or persisted conversation.
    messages = [{"role": "system", "content": build_system_prompt(agent, knowledge.text)},
                *[turn.model_dump() for turn in payload.history], {"role": "user", "content": payload.message}]
    completion = await chat_completion(agent.provider, *credentials, agent.model.strip(), messages,
                                       temperature=agent.temperature, max_tokens=min(agent.max_tokens, 2048))
    record_usage(db, agent.agency_id, agent.id, agent.provider, agent.model.strip(), completion)
    db.commit()
    return {"text": completion.text, "sources": knowledge.sources, "tools_enabled": False}
