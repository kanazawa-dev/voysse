"""No raw recovery tokens in the database, logs, or HTTP response."""
import hashlib
import logging
import secrets
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from urllib.parse import urlsplit

from sqlalchemy import select, update

from ..config import get_settings
from ..database import SessionLocal
from ..models import User

logger = logging.getLogger(__name__)


def recovery_configured() -> bool:
    settings = get_settings()
    url = urlsplit(settings.auth_public_url)
    return bool(
        settings.smtp_host and settings.smtp_from and url.netloc
        and not url.username and not url.password and not url.query and not url.fragment
        and (url.scheme == "https" or (
            url.scheme == "http" and url.hostname in {"localhost", "127.0.0.1"}
        ))
    )


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def send_recovery_email(email: str, token: str) -> None:
    settings = get_settings()
    message = EmailMessage()
    message["Subject"] = "Voysse — Restablecer contraseña / Reset password"
    message["From"] = settings.smtp_from
    message["To"] = email
    link = f"{settings.auth_public_url.rstrip('/')}/reset-password#token={token}"
    message.set_content(
        "Restablece tu contraseña / Reset your password:\n\n"
        f"{link}\n\n"
        "Este enlace caduca en 30 minutos y solo puede usarse una vez. "
        "Si no lo solicitaste, ignora este correo.\n"
        "This link expires in 30 minutes and can only be used once. "
        "If you did not request it, ignore this email."
    )
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        if settings.smtp_starttls:
            smtp.starttls(context=ssl.create_default_context())
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)


def request_recovery(email: str) -> None:
    # Runs after the identical HTTP response for known/unknown addresses.
    # Persist cooldown under a row lock, including across API processes.
    digest = None
    try:
        with SessionLocal() as db:
            user = db.scalar(select(User).where(User.email == email).with_for_update())
            now = datetime.now(timezone.utc)
            if not user or not user.agency.is_active:
                return
            if user.reset_requested_at and now - user.reset_requested_at < timedelta(seconds=60):
                return
            token = secrets.token_urlsafe(32)
            digest = token_digest(token)
            user.reset_token_hash = digest
            user.reset_expires_at = now + timedelta(minutes=30)
            user.reset_requested_at = now
            db.commit()
        send_recovery_email(email, token)
    except Exception:
        # Never log SMTP exceptions: providers may echo recipient/body/token.
        logger.error("Password recovery delivery failed; check mail service configuration")
        if digest:
            with SessionLocal() as db:
                db.execute(update(User).where(User.reset_token_hash == digest).values(
                    reset_token_hash=None, reset_expires_at=None
                ))
                db.commit()
