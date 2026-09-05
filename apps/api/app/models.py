import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


def new_public_id() -> str:
    return uuid.uuid4().hex


def new_domain_token() -> str:
    return uuid.uuid4().hex


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Agency(Base):
    __tablename__ = "agencies"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(180))
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    brand_color: Mapped[str] = mapped_column(String(20), default="#1748c7")
    logo_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    logo_mime: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Toggled from the Voysse team's admin panel. A suspended agency's users
    # are rejected at login and kicked out of any active session.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Optional, agency-set USD rate per 1M tokens, used only to estimate cost
    # on the per-client usage view. Voysse has no real pricing data for every
    # model an agency might bring, so this stays blank (tokens-only) unless
    # the agency fills in what they're actually paying their provider.
    cost_per_million_input_tokens: Mapped[float | None] = mapped_column(Float, nullable=True)
    cost_per_million_output_tokens: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    users: Mapped[list["User"]] = relationship(back_populates="agency", cascade="all, delete-orphan")

    @property
    def logo_url(self) -> str | None:
        return f"/api/agency/logo?v={int(self.created_at.timestamp())}" if self.logo_data else None


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("email", name="uq_users_email"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    agency_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agencies.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(320), index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(30), default="admin")
    session_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    reset_token_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    reset_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reset_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    agency: Mapped[Agency] = relationship(back_populates="users")


class TeamInvitation(Base):
    __tablename__ = "team_invitations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    agency_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agencies.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(320))
    role: Mapped[str] = mapped_column(String(30))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    agency_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agencies.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    industry: Mapped[str] = mapped_column(String(160), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    general_context: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    portal_slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    portal_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    portal_title: Mapped[str] = mapped_column(String(180), default="")
    portal_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    portal_password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Optional custom domain for this client's portal. Verified via a DNS TXT
    # challenge; only verified domains are routed and get an on-demand cert.
    portal_domain: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    portal_domain_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    portal_domain_token: Mapped[str] = mapped_column(String(64), default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    agents: Mapped[list["Agent"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    social_channels: Mapped[list["SocialChannel"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    whatsapp_channel: Mapped["WhatsAppChannel | None"] = relationship(
        back_populates="client", cascade="all, delete-orphan", uselist=False
    )
    whatsapp_cloud_channel: Mapped["WhatsAppCloudChannel | None"] = relationship(
        back_populates="client", cascade="all, delete-orphan", uselist=False
    )

    @property
    def portal_password_configured(self) -> bool:
        return bool(self.portal_password_hash)


class ProviderCredential(Base):
    """One AI provider API key per agency (bring your own key). provider is
    "openai" or "anthropic"; the base URL is resolved from the provider."""

    __tablename__ = "provider_credentials"
    __table_args__ = (UniqueConstraint("agency_id", "provider", name="uq_provider_credentials_agency_provider"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    agency_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agencies.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(30))
    encrypted_api_key: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    agency_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agencies.id", ondelete="CASCADE"), index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text, default="")
    instructions: Mapped[str] = mapped_column(Text, default="")
    personality: Mapped[str] = mapped_column(Text, default="")
    # Structured business brief. Optional guided fields that compose into the
    # system prompt alongside the free-form instructions.
    brief_summary: Mapped[str] = mapped_column(Text, default="", server_default="")
    brief_products: Mapped[str] = mapped_column(Text, default="", server_default="")
    brief_audience: Mapped[str] = mapped_column(Text, default="", server_default="")
    brief_policies: Mapped[str] = mapped_column(Text, default="", server_default="")
    brief_goal: Mapped[str] = mapped_column(Text, default="", server_default="")
    brief_dos: Mapped[str] = mapped_column(Text, default="", server_default="")
    brief_donts: Mapped[str] = mapped_column(Text, default="", server_default="")
    # AI provider ("openai" or "anthropic"); the agency's key for that provider is used.
    provider: Mapped[str] = mapped_column(String(30), default="openai", server_default="openai")
    model: Mapped[str] = mapped_column(String(180), default="")
    # IANA timezone (e.g. "America/Bogota"); injected into the system prompt so
    # the agent knows the local date/time. "UTC" when unset.
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", server_default="UTC")
    manual_context: Mapped[str] = mapped_column(Text, default="")
    # Generation settings. Sampling params are applied best-effort by the AI
    # service (models that reject them fall back to their defaults).
    temperature: Mapped[float] = mapped_column(Float, default=0.7, server_default="0.7")
    max_tokens: Mapped[int] = mapped_column(Integer, default=2048, server_default="2048")
    # How many past messages are kept as conversation memory.
    memory_limit: Mapped[int] = mapped_column(Integer, default=30, server_default="30")
    # Multimodal capabilities. When enabled, inbound images are described by a
    # vision model and inbound audio is transcribed before reaching the agent.
    image_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    image_model: Mapped[str] = mapped_column(String(180), default="", server_default="")
    audio_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    audio_model: Mapped[str] = mapped_column(String(180), default="whisper-1", server_default="whisper-1")
    # Embeddable web chat widget.
    widget_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    widget_public_id: Mapped[str] = mapped_column(String(64), default=new_public_id, unique=True, index=True)
    widget_greeting: Mapped[str] = mapped_column(Text, default="", server_default="")
    widget_color: Mapped[str] = mapped_column(String(20), default="", server_default="")
    widget_position: Mapped[str] = mapped_column(String(10), default="right", server_default="right")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    client: Mapped[Client] = relationship(back_populates="agents")
    documents: Mapped[list["KnowledgeDocument"]] = relationship(back_populates="agent", cascade="all, delete-orphan")
    qa_pairs: Mapped[list["AgentQA"]] = relationship(back_populates="agent", cascade="all, delete-orphan", order_by="AgentQA.position")
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="agent", cascade="all, delete-orphan")
    whatsapp_channels: Mapped[list["WhatsAppChannel"]] = relationship(back_populates="agent")
    whatsapp_cloud_channels: Mapped[list["WhatsAppCloudChannel"]] = relationship(back_populates="agent")
    tools: Mapped[list["AgentTool"]] = relationship(back_populates="agent", cascade="all, delete-orphan", order_by="AgentTool.created_at")


class AgentTool(Base):
    """A custom tool the agent can call: a user-defined HTTP endpoint
    ("http") or an external MCP server ("mcp")."""

    __tablename__ = "agent_tools"
    __table_args__ = (UniqueConstraint("agent_id", "name", name="uq_agent_tools_agent_name"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(10))
    name: Mapped[str] = mapped_column(String(64))
    description: Mapped[str] = mapped_column(Text, default="")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # HTTP endpoint (may contain {param} path placeholders) or MCP server URL.
    url: Mapped[str] = mapped_column(Text, default="")
    # HTTP tools only.
    http_method: Mapped[str] = mapped_column(String(10), default="GET")
    prompt_instructions: Mapped[str] = mapped_column(Text, default="")
    body_params: Mapped[list] = mapped_column(JSON, default=list)
    query_params: Mapped[list] = mapped_column(JSON, default=list)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=30)
    # MCP servers only. cached_tools holds the last list_tools result so chat
    # requests never block on discovery; refreshed on save/test-connection.
    transport: Mapped[str] = mapped_column(String(20), default="streamable_http")
    cached_tools: Mapped[list] = mapped_column(JSON, default=list)
    tools_cached_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # The full auth headers dict, encrypted at rest; never returned by the API.
    encrypted_headers: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    agent: Mapped[Agent] = relationship(back_populates="tools")


class WhatsAppChannel(Base):
    __tablename__ = "whatsapp_channels"
    __table_args__ = (UniqueConstraint("client_id", name="uq_whatsapp_channels_client_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    agency_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agencies.id", ondelete="CASCADE"), index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id", ondelete="RESTRICT"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="disconnected")
    phone_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(180), nullable=True)
    encrypted_auth_state: Mapped[str | None] = mapped_column(Text, nullable=True)
    encrypted_qr: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    client: Mapped[Client] = relationship(back_populates="whatsapp_channel")
    agent: Mapped[Agent] = relationship(back_populates="whatsapp_channels")
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="whatsapp_channel")


class WhatsAppCloudChannel(Base):
    """Official WhatsApp Business Cloud API channel (Meta Graph API). Coexists
    with the Baileys channel: a client can have one of each, on different
    numbers. Credentials are provided manually (bring your own Meta app)."""

    __tablename__ = "whatsapp_cloud_channels"
    __table_args__ = (UniqueConstraint("client_id", name="uq_whatsapp_cloud_channels_client_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    agency_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agencies.id", ondelete="CASCADE"), index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id", ondelete="RESTRICT"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="disconnected")
    phone_number: Mapped[str | None] = mapped_column(String(80), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(180), nullable=True)
    phone_number_id: Mapped[str] = mapped_column(String(80), default="", server_default="")
    waba_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    encrypted_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    encrypted_app_secret: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Token the owner pastes into their Meta app's webhook config; it must be
    # re-displayable, so it is stored in plain text like portal_domain_token.
    webhook_verify_token: Mapped[str] = mapped_column(String(64), default=new_public_id, server_default="")
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    client: Mapped[Client] = relationship(back_populates="whatsapp_cloud_channel")
    agent: Mapped[Agent] = relationship(back_populates="whatsapp_cloud_channels")
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="whatsapp_cloud_channel")


class WhatsAppCloudEvent(Base):
    __tablename__ = "whatsapp_cloud_events"
    __table_args__ = (UniqueConstraint("channel_id", "external_id", name="uq_cloud_event_external"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    channel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("whatsapp_cloud_channels.id", ondelete="CASCADE"), index=True)
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("conversations.id", ondelete="SET NULL"))
    external_id: Mapped[str] = mapped_column(String(255))
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(30), default="queued", index=True)
    reply: Mapped[str | None] = mapped_column(Text)
    reply_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    error_code: Mapped[str | None] = mapped_column(String(80))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class SocialChannel(Base):
    __tablename__ = "social_channels"
    __table_args__ = (
        UniqueConstraint("client_id", "platform", name="uq_social_client_platform"),
        UniqueConstraint("platform", "account_id", name="uq_social_account"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    agency_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agencies.id", ondelete="CASCADE"), index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id", ondelete="RESTRICT"))
    platform: Mapped[str] = mapped_column(String(20))
    account_id: Mapped[str] = mapped_column(String(80))
    display_name: Mapped[str] = mapped_column(String(180), default="")
    encrypted_access_token: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="disconnected")
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    agent: Mapped[Agent] = relationship()
    client: Mapped[Client] = relationship(back_populates="social_channels")
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="social_channel", cascade="all, delete-orphan")


class SocialEvent(Base):
    """Durable inbox/outbox. Ambiguous external sends are never retried blindly."""
    __tablename__ = "social_events"
    __table_args__ = (UniqueConstraint("channel_id", "external_id", name="uq_social_event"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    channel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("social_channels.id", ondelete="CASCADE"), index=True)
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), nullable=True)
    external_id: Mapped[str] = mapped_column(String(255))
    sender_id: Mapped[str] = mapped_column(String(255))
    text: Mapped[str] = mapped_column(Text)
    supported: Mapped[bool] = mapped_column(Boolean, default=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(30), default="queued", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    channel: Mapped[SocialChannel] = relationship()


class AgentQA(Base):
    __tablename__ = "agent_qa"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"), index=True)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    agent: Mapped[Agent] = relationship(back_populates="qa_pairs")


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    file_data: Mapped[bytes] = mapped_column(LargeBinary)
    extracted_text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="processed")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    agent: Mapped[Agent] = relationship(back_populates="documents")
    chunks: Mapped[list["KnowledgeChunk"]] = relationship(back_populates="document", cascade="all, delete-orphan")


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("knowledge_documents.id", ondelete="CASCADE"), index=True)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text)
    # Embedding vector stored as a JSON array of floats (portable across any
    # Postgres; similarity is computed in Python). Swap to pgvector at scale.
    embedding: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    document: Mapped[KnowledgeDocument] = relationship(back_populates="chunks")


class UsageRecord(Base):
    __tablename__ = "usage_records"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    agency_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agencies.id", ondelete="CASCADE"), index=True)
    agent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("agents.id", ondelete="SET NULL"), nullable=True, index=True)
    provider: Mapped[str] = mapped_column(String(30))
    model: Mapped[str] = mapped_column(String(180))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        UniqueConstraint("whatsapp_channel_id", "external_chat_id", name="uq_conversations_whatsapp_chat"),
        UniqueConstraint(
            "whatsapp_cloud_channel_id", "external_chat_id", name="uq_conversations_whatsapp_cloud_chat"
        ),
        UniqueConstraint("social_channel_id", "external_chat_id", name="uq_conversations_social_chat"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    agency_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agencies.id", ondelete="CASCADE"), index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(240), default="New conversation")
    mode: Mapped[str] = mapped_column(String(30), default="ai")
    channel: Mapped[str] = mapped_column(String(40), default="playground")
    whatsapp_channel_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("whatsapp_channels.id", ondelete="CASCADE"), nullable=True, index=True
    )
    whatsapp_cloud_channel_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("whatsapp_cloud_channels.id", ondelete="CASCADE"), nullable=True, index=True
    )
    external_chat_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    social_channel_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("social_channels.id", ondelete="CASCADE"), nullable=True, index=True
    )
    contact_name: Mapped[str | None] = mapped_column(String(180), nullable=True)
    operator_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    agent: Mapped[Agent] = relationship(back_populates="conversations")
    whatsapp_channel: Mapped[WhatsAppChannel | None] = relationship(back_populates="conversations")
    whatsapp_cloud_channel: Mapped[WhatsAppCloudChannel | None] = relationship(back_populates="conversations")
    social_channel: Mapped[SocialChannel | None] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")
    human_deliveries: Mapped[list["HumanDelivery"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")


class HumanDelivery(Base):
    __tablename__ = "human_deliveries"

    # Client supplied idempotency key; no retries with a different key on timeout.
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    portal_client_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"))
    sender_name: Mapped[str] = mapped_column(String(160))
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30))
    error_code: Mapped[str | None] = mapped_column(String(80))
    external_message_id: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    conversation: Mapped[Conversation] = relationship(back_populates="human_deliveries")


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        UniqueConstraint("conversation_id", "external_message_id", name="uq_messages_conversation_external"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(30))
    content: Mapped[str] = mapped_column(Text)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    # Tool usage behind an assistant reply: [{name, arguments, result_preview, is_error}].
    tool_calls: Mapped[list | None] = mapped_column(JSON, nullable=True)
    sender_type: Mapped[str] = mapped_column(String(30), default="visitor")
    sender_name: Mapped[str | None] = mapped_column(String(180), nullable=True)
    external_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    external_received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class AdminUser(Base):
    """A Voysse team account for the internal admin panel.

    Unrelated to Agency/User -- this is platform staff, not a customer.
    There is no self-registration; accounts are created with the
    `create-admin` management command (see app/scripts/create_admin.py).
    """
    __tablename__ = "admin_users"
    __table_args__ = (UniqueConstraint("email", name="uq_admin_users_email"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(320), index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class CloudLead(Base):
    """An interest submission from the marketing site's Cloud plan CTA.

    No account or agency exists yet at this point -- Cloud has no self-serve
    checkout, so this is just a lead for the team to follow up with.
    """
    __tablename__ = "cloud_leads"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(255))
    agency_name: Mapped[str] = mapped_column(String(180))
    # Worked from the admin panel: "new" until someone follows up.
    status: Mapped[str] = mapped_column(String(20), default="new")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Alert(Base):
    """An agency-facing heads-up about something that broke on its own, not
    from a user action they're already looking at -- a WhatsApp session that
    dropped, a knowledge document that failed to process. Raised and
    auto-resolved from app/alerts.py; resolved_at is null while open."""
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    agency_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agencies.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(60))
    severity: Mapped[str] = mapped_column(String(20), default="warning")
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text, default="")
    resource_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
