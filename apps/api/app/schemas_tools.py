"""Request/response schemas for agent custom tools (HTTP endpoints and MCP servers).

Kept out of schemas.py to respect the per-file size limit.
"""

import re
import uuid
from datetime import datetime
from typing import Annotated, Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# snake_case, no consecutive underscores: "__" is reserved as the separator
# between an MCP server name and its tool names when exposed to the LLM.
TOOL_NAME_PATTERN = r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$"
TOOL_NAME_RE = re.compile(TOOL_NAME_PATTERN)


def _validate_url(value: str) -> str:
    # urlparse tolerates surrounding whitespace but httpx does not; store the
    # trimmed value so a URL pasted with spaces still works.
    value = value.strip()
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("URL must start with http:// or https://")
    return value


class ToolParam(BaseModel):
    name: str = Field(pattern=TOOL_NAME_PATTERN, max_length=40)
    type: Literal["string", "number", "integer", "boolean"] = "string"
    description: str = ""
    required: bool = False


class HttpToolIn(BaseModel):
    type: Literal["http"]
    name: str = Field(pattern=TOOL_NAME_PATTERN, max_length=40)
    description: str = ""
    url: str
    http_method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"] = "GET"
    prompt_instructions: str = ""
    body_params: list[ToolParam] = []
    query_params: list[ToolParam] = []
    headers: dict[str, str] | None = None
    timeout_seconds: int = Field(default=30, ge=1, le=120)
    enabled: bool = True

    @field_validator("url")
    @classmethod
    def check_url(cls, value: str) -> str:
        return _validate_url(value)

    @model_validator(mode="after")
    def check_body_params(self) -> "HttpToolIn":
        if self.body_params and self.http_method in ("GET", "DELETE"):
            raise ValueError("body parameters are not allowed for GET or DELETE tools")
        return self


class McpToolIn(BaseModel):
    type: Literal["mcp"]
    # Shorter cap so "{name}__{mcp_tool}" composites stay within the 64-char
    # tool-name limit both providers enforce.
    name: str = Field(pattern=TOOL_NAME_PATTERN, max_length=24)
    description: str = ""
    url: str
    transport: Literal["sse", "streamable_http"] = "streamable_http"
    headers: dict[str, str] | None = None
    enabled: bool = True

    @field_validator("url")
    @classmethod
    def check_url(cls, value: str) -> str:
        return _validate_url(value)


AgentToolIn = Annotated[HttpToolIn | McpToolIn, Field(discriminator="type")]


class HttpToolUpdate(BaseModel):
    """Partial update. `headers` set to None or omitted keeps the stored secret;
    an empty dict clears it."""

    name: str | None = Field(default=None, pattern=TOOL_NAME_PATTERN, max_length=40)
    description: str | None = None
    url: str | None = None
    http_method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"] | None = None
    prompt_instructions: str | None = None
    body_params: list[ToolParam] | None = None
    query_params: list[ToolParam] | None = None
    headers: dict[str, str] | None = None
    timeout_seconds: int | None = Field(default=None, ge=1, le=120)
    transport: Literal["sse", "streamable_http"] | None = None
    enabled: bool | None = None

    @field_validator("url")
    @classmethod
    def check_url(cls, value: str | None) -> str | None:
        return _validate_url(value) if value is not None else None


class AgentToolOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    agent_id: uuid.UUID
    type: str
    name: str
    description: str
    enabled: bool
    url: str
    http_method: str
    prompt_instructions: str
    body_params: list[dict] = []
    query_params: list[dict] = []
    timeout_seconds: int
    transport: str
    cached_tools: list[dict] = []
    tools_cached_at: datetime | None = None
    has_headers: bool = False
    created_at: datetime
    updated_at: datetime


class McpTestIn(BaseModel):
    url: str | None = None
    transport: Literal["sse", "streamable_http"] = "streamable_http"
    headers: dict[str, str] | None = None
    # Reuse the stored (encrypted) headers of an existing tool.
    tool_id: uuid.UUID | None = None

    @field_validator("url")
    @classmethod
    def check_url(cls, value: str | None) -> str | None:
        return _validate_url(value) if value is not None else None


class McpTestOut(BaseModel):
    ok: bool
    tools: list[dict]
