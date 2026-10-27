import hashlib
import secrets
import time
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from app.config import settings
from app.db import get_db
from app.errors import fail
from app.models import Token, User, RateLimit

hasher = PasswordHasher()
dummy_hash = hasher.hash(secrets.token_urlsafe(32))
bearer = HTTPBearer(auto_error=False)


def digest(value: str):
    return hashlib.sha256(value.encode()).hexdigest()


def password_matches(value, encoded):
    try:
        return hasher.verify(encoded, value)
    except (VerificationError, InvalidHashError):
        return False


def issue_token(db, user_id, kind, seconds):
    raw = secrets.token_urlsafe(32)
    db.add(Token(user_id=user_id, kind=kind, digest=digest(raw), expires_at=int(time.time()) + seconds))
    return raw


def consume_token(db, raw, kind):
    record = db.scalar(select(Token).where(Token.digest == digest(raw), Token.kind == kind))
    if not record:
        fail(400, "INVALID_TOKEN", "Токен недействителен или истёк")
    changed = db.execute(
        update(Token)
        .where(Token.id == record.id, Token.used.is_(False), Token.expires_at > int(time.time()))
        .values(used=True)
    )
    if changed.rowcount != 1:
        fail(400, "INVALID_TOKEN", "Токен недействителен или истёк")
    return db.get(User, record.user_id)


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)):
    if not credentials:
        fail(401, "UNAUTHENTICATED", "Нужен вход в аккаунт")
    record = db.scalar(
        select(Token).where(
            Token.digest == digest(credentials.credentials),
            Token.kind == "access",
            Token.used.is_(False),
            Token.expires_at > int(time.time()),
        )
    )
    user = db.get(User, record.user_id) if record else None
    if not user or not user.verified:
        fail(401, "UNAUTHENTICATED", "Сессия недействительна или истекла")
    return user


def auth_rate_limit(request: Request, db: Session = Depends(get_db)):
    # Database-backed fixed windows survive workers/restarts. Proxy headers are not trusted here.
    bucket = int(time.time()) // 900
    host = request.client.host if request.client else "unknown"
    key = digest(f"{request.url.path}:{host}:{bucket}")
    if db.bind.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    db.execute(insert(RateLimit).values(key=key, count=0).on_conflict_do_nothing(index_elements=["key"]))
    db.execute(update(RateLimit).where(RateLimit.key == key).values(count=RateLimit.count + 1))
    count = db.scalar(select(RateLimit.count).where(RateLimit.key == key))
    db.commit()  # Persist even when the following login attempt fails.
    if count > 30:
        fail(429, "RATE_LIMITED", "Слишком много попыток. Повторите через 15 минут")


def auth_response(db, user):
    seconds = settings().access_token_minutes * 60
    token = issue_token(db, user.id, "access", seconds)
    db.commit()
    return {"access_token": token, "token_type": "bearer", "expires_in": seconds}
