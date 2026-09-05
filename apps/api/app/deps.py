import uuid

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import AdminUser, User
from .security import decode_access_token, decode_admin_token


def get_inbox_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You are not signed in")
    claims = decode_access_token(access_token)
    if not claims:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="The session expired")
    try:
        parsed_id = uuid.UUID(claims["sub"])
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session") from exc
    user = db.get(User, parsed_id)
    if not user or claims.get("ver", 0) != user.session_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.agency.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="agency_pending_approval")
    if user.role not in {"admin", "operator"}:
        raise HTTPException(status_code=403, detail="Role not permitted")
    return user


def get_current_admin(
    admin_access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> AdminUser:
    if not admin_access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You are not signed in")
    admin_id = decode_admin_token(admin_access_token)
    if not admin_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="The session expired")
    try:
        parsed_id = uuid.UUID(admin_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session") from exc
    admin = db.get(AdminUser, parsed_id)
    if not admin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin not found")
    return admin


def get_current_user(user: User = Depends(get_inbox_user)) -> User:
    """Administrative access is the default; operator routes opt in explicitly."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user
