"""Execute a user-defined HTTP tool with LLM-provided arguments.

Never raises: every failure becomes text handed back to the LLM so a broken
tool does not break the chat.
"""

import ipaddress
import json
import socket
from urllib.parse import quote, urlparse

import httpx

from ...config import get_settings
from ...models import AgentTool
from ...security import decrypt_secret
from .specs import path_placeholders

MAX_RESPONSE_CHARS = 100_000


async def execute_http_tool(tool: AgentTool, args: dict) -> tuple[str, bool]:
    """Run the tool and return (result_text, is_error)."""
    url = tool.url
    for name in path_placeholders(tool.url):
        if name not in args:
            return f"Error: missing required path parameter '{name}'", True
        url = url.replace("{" + name + "}", quote(str(args[name]), safe=""))

    blocked = _blocked_reason(url)
    if blocked:
        return blocked, True

    query_names = {param.get("name") for param in tool.query_params or []}
    params = {key: value for key, value in args.items() if key in query_names}
    body_names = {param.get("name") for param in tool.body_params or []}
    body = {key: value for key, value in args.items() if key in body_names}

    headers = {}
    if tool.encrypted_headers:
        try:
            headers = json.loads(decrypt_secret(tool.encrypted_headers))
        except Exception:
            return "Error: the tool's stored headers could not be decrypted", True

    request: dict = {"params": params or None, "headers": headers or None}
    if tool.http_method in ("POST", "PUT", "PATCH"):
        request["json"] = body

    try:
        async with httpx.AsyncClient(timeout=tool.timeout_seconds, follow_redirects=False) as client:
            response = await client.request(tool.http_method, url, **request)
    except httpx.HTTPError as exc:
        return f"Error: the request failed ({type(exc).__name__})", True

    text = response.text
    if len(text) > MAX_RESPONSE_CHARS:
        text = text[:MAX_RESPONSE_CHARS] + "... [truncated]"
    # Redirects (3xx) count as failures: they are never followed, so the data
    # was not retrieved.
    return f"HTTP {response.status_code}: {text}", response.status_code >= 300


def _blocked_reason(url: str) -> str | None:
    """Reject URLs resolving to private/loopback/reserved addresses (SSRF).

    Redirects are disabled at the client. DNS rebinding between this check and
    the request remains theoretically possible; pinning the resolved IP is not
    worth the transport complexity here.
    """
    if get_settings().tools_allow_private_urls:
        return None
    host = urlparse(url).hostname
    if not host:
        return "Error: invalid URL"
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return f"Error: could not resolve host '{host}'"
    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if address.is_private or address.is_loopback or address.is_link_local or address.is_reserved:
            return "Error: the tool URL resolves to a private or reserved address, which is not allowed"
    return None
