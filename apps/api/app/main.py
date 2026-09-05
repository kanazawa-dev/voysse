from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import get_db
from .routers import (
    admin,
    agency,
    agent_tools,
    agents,
    alerts,
    auth,
    catalog,
    clients,
    cloud,
    conversations,
    dashboard,
    domains,
    portal,
    providers,
    social,
    team,
    whatsapp,
    whatsapp_cloud,
    whatsapp_cloud_webhook,
    widget,
)


settings = get_settings()
app = FastAPI(
    title="Voysse API",
    description="API to manage agencies, clients and AI agents.",
    version="0.3.0",
)
def _split_origins(value: str) -> list[str]:
    return [origin.strip() for origin in value.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    # FRONTEND_URL / MARKETING_URL each accept one origin or several
    # comma-separated ones (e.g. the old Railway domain and the new custom
    # domain during a DNS cutover), plus any localhost/127.0.0.1 port so
    # changing WEB_PORT never breaks local dev.
    allow_origins=_split_origins(settings.frontend_url) + _split_origins(settings.marketing_url),
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["System"])
def health():
    return {"status": "ok"}


@app.get("/ready", tags=["System"])
def readiness(db: Session = Depends(get_db)):
    """Readiness checks storage; /health remains a dependency-free liveness probe."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        # Do not expose connection strings or driver errors on a public endpoint.
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return {"status": "ready"}


app.include_router(auth.router, prefix="/api")
app.include_router(agency.router, prefix="/api")
app.include_router(clients.router, prefix="/api")
app.include_router(agents.router, prefix="/api")
app.include_router(agent_tools.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(providers.router, prefix="/api")
app.include_router(catalog.router, prefix="/api")
app.include_router(conversations.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(portal.router, prefix="/api")
app.include_router(whatsapp.router, prefix="/api")
app.include_router(whatsapp.internal_router, prefix="/api")
app.include_router(whatsapp_cloud.router, prefix="/api")
app.include_router(whatsapp_cloud_webhook.public_router, prefix="/api")
app.include_router(widget.router, prefix="/api")
app.include_router(domains.public_router, prefix="/api")
app.include_router(cloud.public_router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(social.router, prefix="/api")
app.include_router(social.public_router, prefix="/api")

app.include_router(team.router, prefix="/api")
