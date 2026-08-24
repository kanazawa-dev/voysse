from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Agency, Agent, Conversation, Message, now_utc
from ..ratelimit import widget_rate_limit
from ..schemas import WidgetConfigOut, WidgetMessageIn, WidgetReply
from ..services.tools import run_completion
from ..services.knowledge import build_system_prompt, retrieve_knowledge
from ..services.providers import resolve_agent_credentials
from ..services.usage import record_usage


router = APIRouter(prefix="/widget", tags=["Widget"])

HISTORY_LIMIT = 50


def _agent(db: Session, public_id: str) -> Agent:
    agent = db.scalar(
        select(Agent)
        .options(joinedload(Agent.client))
        .where(Agent.widget_public_id == public_id, Agent.widget_enabled.is_(True))
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Widget not found")
    return agent


def _conversation(db: Session, agent: Agent, session_id: str) -> Conversation:
    external_chat_id = f"widget:{session_id}"
    conversation = db.scalar(
        select(Conversation).where(
            Conversation.agent_id == agent.id,
            Conversation.channel == "widget",
            Conversation.external_chat_id == external_chat_id,
        )
    )
    if not conversation:
        conversation = Conversation(
            agency_id=agent.agency_id,
            client_id=agent.client_id,
            agent_id=agent.id,
            channel="widget",
            external_chat_id=external_chat_id,
            title="Web chat",
        )
        db.add(conversation)
        db.flush()
    return conversation


@router.get("/{public_id}", response_model=WidgetConfigOut)
def widget_config(public_id: str, db: Session = Depends(get_db)):
    agent = _agent(db, public_id)
    agency = db.get(Agency, agent.agency_id)
    return {
        "title": agent.name,
        "greeting": agent.widget_greeting,
        "color": agent.widget_color or (agency.brand_color if agency else ""),
        "position": agent.widget_position,
        "agency_name": agency.name if agency else "",
        "agency_logo_url": agency.logo_url if agency else None,
    }


@router.get("/{public_id}/history", response_model=WidgetReply)
def widget_history(public_id: str, session_id: str, db: Session = Depends(get_db)):
    agent = _agent(db, public_id)
    conversation = db.scalar(
        select(Conversation).where(
            Conversation.agent_id == agent.id,
            Conversation.channel == "widget",
            Conversation.external_chat_id == f"widget:{session_id}",
        )
    )
    if not conversation:
        return {"mode": "ai", "reply": None, "messages": []}
    messages = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at)
        .limit(HISTORY_LIMIT)
    ).all()
    return {
        "mode": conversation.mode,
        "reply": None,
        "messages": [{"role": item.role, "content": item.content} for item in messages],
    }


@router.post("/{public_id}/messages", response_model=WidgetReply, dependencies=[Depends(widget_rate_limit)])
async def widget_message(public_id: str, payload: WidgetMessageIn, db: Session = Depends(get_db)):
    agent = _agent(db, public_id)
    conversation = _conversation(db, agent, payload.session_id)

    content = payload.content.strip()
    if conversation.title == "Web chat":
        conversation.title = content[:80]
    conversation.updated_at = now_utc()
    db.add(Message(conversation_id=conversation.id, role="user", content=content, sender_type="visitor", sender_name="Visitor"))
    db.commit()

    if conversation.mode == "human":
        return {"mode": "human", "reply": None, "messages": []}

    credentials = resolve_agent_credentials(db, agent)
    if not agent.is_active or not credentials or not agent.model.strip():
        return {"mode": "ai", "reply": None, "messages": []}

    knowledge = await retrieve_knowledge(db, agent, content)
    db.refresh(conversation)
    history = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(agent.memory_limit or HISTORY_LIMIT)
    ).all()
    history = list(reversed(history))
    messages = [
        {"role": "system", "content": build_system_prompt(agent, knowledge.text)},
        *[{"role": item.role, "content": item.content} for item in history],
    ]
    base_url, api_key = credentials
    try:
        completion = await run_completion(
            db, agent, base_url, api_key, messages,
            temperature=agent.temperature, max_tokens=agent.max_tokens,
        )
    except HTTPException:
        return {"mode": "ai", "reply": None, "messages": []}

    conversation.updated_at = now_utc()
    db.add(Message(conversation_id=conversation.id, role="assistant", content=completion.text, sources=knowledge.sources, tool_calls=completion.tool_calls, sender_type="ai", sender_name=agent.name))
    record_usage(db, agent.agency_id, agent.id, agent.provider, agent.model.strip(), completion)
    db.commit()
    return {"mode": "ai", "reply": completion.text, "messages": []}
