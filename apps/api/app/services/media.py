import base64

import httpx
from fastapi import HTTPException

from .ai import _safe_provider_error, extract_openai_text


async def transcribe_audio(
    base_url: str,
    api_key: str,
    model: str,
    audio: bytes,
    filename: str = "audio.ogg",
    content_type: str = "audio/ogg",
) -> str:
    """Transcribe an audio clip via an OpenAI-compatible /audio/transcriptions endpoint."""
    url = f"{base_url.rstrip('/')}/audio/transcriptions"
    files = {"file": (filename, audio, content_type), "model": (None, model)}
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(url, headers={"Authorization": f"Bearer {api_key}"}, files=files)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not reach the transcription provider.") from exc
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Transcription failed: {_safe_provider_error(response)}")
    try:
        return (response.json().get("text") or "").strip()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Invalid transcription response.") from exc


async def describe_image(
    base_url: str,
    api_key: str,
    model: str,
    image: bytes,
    content_type: str,
    instruction: str,
) -> str:
    """Describe an image with an OpenAI vision model via the Responses API."""
    data_url = f"data:{content_type};base64,{base64.b64encode(image).decode()}"
    payload = {
        "model": model,
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": instruction},
                    {"type": "input_image", "image_url": data_url},
                ],
            }
        ],
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(f"{base_url.rstrip('/')}/responses", headers=headers, json=payload)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not reach the vision provider.") from exc
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Image analysis failed: {_safe_provider_error(response)}")
    try:
        return extract_openai_text(response.json())
    except (ValueError, KeyError, IndexError) as exc:
        raise HTTPException(status_code=502, detail="Invalid image analysis response.") from exc
