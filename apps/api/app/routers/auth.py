from datetime import datetime, timezone
from fastapi import BackgroundTasks
from pydantic import BaseModel, EmailStr, Field, field_validator
from ..services.password_recovery import recovery_configured, request_recovery, token_digest

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..deps import get_inbox_user
from ..models import Agency, User
from ..ratelimit import login_rate_limit
from ..schemas import LoginRequest, RegisterRequest, UserOut
from ..security import create_access_token, hash_password, verify_password
from ..slugs import unique_slug


router = APIRouter(prefix="/auth", tags=["Authentication"])


def _set_session_cookie(response: Response, user: User) -> None:
    settings = get_settings()
    response.set_cookie(
        key="access_token",
        value=create_access_token(str(user.id), user.session_version),
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.access_token_minutes * 60,
        path="/",
    )


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(login_rate_limit)],
)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    email = payload.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="A user with that email already exists")
    agency_name = payload.agency_name.strip()
    agency = Agency(
        name=agency_name,
        slug=unique_slug(db, Agency, "slug", agency_name),
        is_active=not get_settings().require_agency_approval,
    )
    user = User(
        agency=agency,
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    # A pending agency (require_agency_approval) gets no working session --
    # the frontend reads agency.is_active on this same response to show a
    # "pending" message instead of navigating into the dashboard.
    if agency.is_active:
        _set_session_cookie(response, user)
    return user


@router.post("/login", response_model=UserOut, dependencies=[Depends(login_rate_limit)])
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.agency.is_active:
        raise HTTPException(status_code=403, detail="agency_pending_approval")
    _set_session_cookie(response, user)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie("access_token", path="/")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_inbox_user)):
    return user


# Public recovery endpoints intentionally do not reveal account existence.


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=32, max_length=128)
    password: str = Field(min_length=12, max_length=72)

    @field_validator("password")
    @classmethod
    def bcrypt_byte_limit(cls, value: str) -> str:
        if len(value.encode()) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return value


@router.post("/forgot-password", status_code=202, dependencies=[Depends(login_rate_limit)])
def forgot_password(payload: ForgotPasswordRequest, tasks: BackgroundTasks, response: Response):
    response.headers["Cache-Control"] = "no-store"
    if not recovery_configured():
        raise HTTPException(status_code=503, detail="Password recovery is not configured")
    tasks.add_task(request_recovery, payload.email.lower())
    return {"message": "If the account is eligible, a recovery email will be sent."}


@router.post("/reset-password", status_code=204, dependencies=[Depends(login_rate_limit)])
def reset_password(payload: ResetPasswordRequest, response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    user = db.scalar(select(User).where(
        User.reset_token_hash == token_digest(payload.token)
    ).with_for_update())
    if (
        not user or not user.reset_expires_at
        or user.reset_expires_at <= datetime.now(timezone.utc)
        or not user.agency.is_active
    ):
        raise HTTPException(status_code=400, detail="Invalid or expired recovery link")
    user.password_hash = hash_password(payload.password)
    user.session_version += 1
    user.reset_token_hash = None
    user.reset_expires_at = None
    db.commit()
    response.delete_cookie("access_token", path="/")
