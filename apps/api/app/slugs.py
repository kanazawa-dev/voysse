import re
import unicodedata
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Agency, Client


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized.lower()).strip("-")
    return slug[:140] or "espacio"


def unique_slug(db: Session, model: type[Agency] | type[Client], field_name: str, value: str) -> str:
    base = slugify(value)
    candidate = base
    for _ in range(100):
        field = getattr(model, field_name)
        if not db.scalar(select(model.id).where(field == candidate)):
            return candidate
        candidate = f"{base}-{str(uuid.uuid4())[:6]}"
    return f"{base}-{uuid.uuid4().hex[:12]}"
