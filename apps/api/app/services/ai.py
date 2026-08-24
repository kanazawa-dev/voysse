from dataclasses import dataclass

import httpx
from fastapi import HTTPException


ANTHROPIC_VERSION = "2023-06-01"


@dataclass
class Completion:
    text: str
    input_tokens: int = 0
    output_tokens: int = 0
    # Set by the tool loop: [{name, arguments, result_preview, is_error}].
    tool_calls: list[dict] | None = None

# Substrings in a provider's 400 error that mean a sampling parameter is not
# accepted (e.g. reasoning models, or Anthropic's temperature <= 1 limit). When
# seen, we retry once without those params.
_SAMPLING_PARAM_HINTS = ("temperature", "max_tokens", "max_output_tokens", "max_completion_tokens", "unsupported", "not supported")


async def chat_completion(
    provider: str,
    base_url: str,
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
    *,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> Completion:
    """Generate a reply using the provider's modern chat API: the OpenAI
    Responses API, or the Anthropic Messages API."""
    try:
        if provider == "anthropic":
            return await _anthropic_messages(base_url, api_key, model, messages, temperature, max_tokens)
        return await _openai_responses(base_url, api_key, model, messages, temperature, max_tokens)
    except HTTPException:
        raise
    except (httpx.HTTPError, KeyError, ValueError, IndexError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Could not get a valid response from the AI provider. Check the API key and the model.",
        ) from exc


async def _openai_responses(base_url, api_key, model, messages, temperature, max_tokens) -> Completion:
    url = f"{base_url.rstrip('/')}/responses"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    instructions = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
    input_items = [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] != "system"]
    base_payload: dict = {"model": model, "input": input_items}
    if instructions:
        base_payload["instructions"] = instructions
    sampling: dict = {}
    if temperature is not None:
        sampling["temperature"] = temperature
    if max_tokens is not None:
        sampling["max_output_tokens"] = max_tokens
    data = await _post_json(url, headers, base_payload, sampling)
    usage = data.get("usage") or {}
    return Completion(
        text=extract_openai_text(data),
        input_tokens=int(usage.get("input_tokens") or 0),
        output_tokens=int(usage.get("output_tokens") or 0),
    )


async def _anthropic_messages(base_url, api_key, model, messages, temperature, max_tokens) -> Completion:
    url = f"{base_url.rstrip('/')}/messages"
    headers = {"x-api-key": api_key, "anthropic-version": ANTHROPIC_VERSION, "Content-Type": "application/json"}
    system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
    convo = [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] in ("user", "assistant")]
    # Anthropic requires max_tokens; sampling (temperature) is retried away on error.
    base_payload: dict = {"model": model, "messages": convo, "max_tokens": max_tokens or 2048}
    if system:
        base_payload["system"] = system
    sampling: dict = {}
    if temperature is not None:
        sampling["temperature"] = temperature
    data = await _post_json(url, headers, base_payload, sampling)
    parts = [block.get("text", "") for block in data.get("content", []) if block.get("type") == "text"]
    text = "".join(parts).strip()
    if not text:
        raise ValueError("empty response")
    usage = data.get("usage") or {}
    return Completion(
        text=text,
        input_tokens=int(usage.get("input_tokens") or 0),
        output_tokens=int(usage.get("output_tokens") or 0),
    )


async def _post_json(url: str, headers: dict, base_payload: dict, sampling: dict) -> dict:
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(url, headers=headers, json={**base_payload, **sampling})
        if sampling and response.status_code >= 400 and _is_sampling_param_error(response):
            response = await client.post(url, headers=headers, json=base_payload)
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"The AI provider responded with an error: {_safe_provider_error(response)}")
    return response.json()


def extract_openai_text(data: dict) -> str:
    """Pull the assistant text out of an OpenAI Responses API result."""
    convenience = data.get("output_text")
    if isinstance(convenience, str) and convenience.strip():
        return convenience.strip()
    parts: list[str] = []
    for item in data.get("output", []):
        if item.get("type") == "message":
            for chunk in item.get("content", []) or []:
                if chunk.get("type") in ("output_text", "text"):
                    parts.append(chunk.get("text", ""))
    text = "".join(parts).strip()
    if not text:
        raise ValueError("empty response")
    return text


def _is_sampling_param_error(response: httpx.Response) -> bool:
    message = _safe_provider_error(response).lower()
    return any(hint in message for hint in _SAMPLING_PARAM_HINTS)


def _safe_provider_error(response: httpx.Response) -> str:
    try:
        data = response.json()
        message = data.get("error", {}).get("message") or data.get("message")
        if isinstance(message, str):
            return message[:500]
    except ValueError:
        pass
    return f"HTTP {response.status_code}"


async def test_provider(provider: str, base_url: str, api_key: str) -> dict:
    """Verify a provider key by listing its models."""
    if provider == "anthropic":
        headers = {"x-api-key": api_key, "anthropic-version": ANTHROPIC_VERSION}
    else:
        headers = {"Authorization": f"Bearer {api_key}"}
    url = f"{base_url.rstrip('/')}/models"
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.get(url, headers=headers)
        if response.status_code < 400:
            try:
                data = response.json()
                models = sorted(
                    item.get("id", "")
                    for item in data.get("data", [])
                    if isinstance(item, dict) and item.get("id")
                )
            except (ValueError, AttributeError):
                models = []
            return {"ok": True, "message": f"Key verified. {len(models)} models available.", "models": models}
        raise HTTPException(status_code=502, detail=f"Could not verify the key: {_safe_provider_error(response)}")
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not connect to the provider") from exc
