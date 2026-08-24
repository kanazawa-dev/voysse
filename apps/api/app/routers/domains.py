from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Client


# Public, unauthenticated: consumed by the gateway's on-demand TLS "ask" hook
# and by the frontend middleware that maps a custom host to its portal.
public_router = APIRouter(prefix="/public", tags=["Public"])


@public_router.get("/portal-domain")
def resolve_portal_domain(domain: str, db: Session = Depends(get_db)):
    host = domain.strip().lower()
    client = db.scalar(
        select(Client).where(
            Client.portal_domain == host,
            Client.portal_domain_verified.is_(True),
            Client.portal_enabled.is_(True),
        )
    )
    if not client:
        # Non-2xx tells Caddy not to issue a certificate for this host.
        raise HTTPException(status_code=404, detail="Unknown domain")
    return {"portal_slug": client.portal_slug}
