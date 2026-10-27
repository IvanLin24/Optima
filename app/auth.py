# AI: вход только по почтовому коду; не обходить подтверждение и не выводить OTP/секреты. См. ../AGENTS.md.
import hashlib
import hmac
import secrets
import time
from uuid import uuid4
from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from app.config import settings
from app.db import get_db
from app.email_policy import allowed_email
from app.errors import fail
from app.mail import send_code_email
from app.models import Company, User, Token, EmailChallenge, RateLimit
from app.prototype import ensure_workspace
from app.schemas import VirtualCompanyInput, CodeVerify, CodeResend, EmailInput, ChallengeView, AuthResult, Message
from app.security import hasher, auth_rate_limit, auth_response, current_user, bearer, digest

router = APIRouter(prefix="/auth", tags=["Вход по коду"], dependencies=[Depends(auth_rate_limit)])


def code_hash(challenge_id, code):
    return hmac.new(
        settings().otp_secret.get_secret_value().encode(), f"{challenge_id}:{code}".encode(), hashlib.sha256
    ).hexdigest()


def quota(db, name, limit):
    if db.bind.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    key = digest(name)
    db.execute(insert(RateLimit).values(key=key, count=0).on_conflict_do_nothing(index_elements=["key"]))
    number = db.execute(
        update(RateLimit).where(RateLimit.key == key).values(count=RateLimit.count + 1).returning(RateLimit.count)
    ).scalar_one()
    db.commit()
    if number > limit:
        fail(429, "EMAIL_LIMIT", "Лимит отправки писем исчерпан. Повторите позже.")


def start_challenge(db, email, password=None, pending_hash=None):
    email = allowed_email(email)
    stamp = int(time.time())
    quota(db, f"mail-minute:{email}:{stamp // 60}", 1)
    quota(db, f"mail-hour:{email}:{stamp // 3600}", 5)
    quota(db, f"mail-day:{stamp // 86400}", 80)
    user = db.scalar(select(User).where(User.email == email))
    ident = str(uuid4())
    response = {
        "challenge_id": ident,
        "expires_in": 600,
        "resend_after": 60,
        "message": "Если компания существует или создаётся, код отправлен на почту",
    }
    if not user and password is None and pending_hash is None:
        return response
    db.execute(
        update(EmailChallenge)
        .where(EmailChallenge.email == email, EmailChallenge.consumed.is_(False))
        .values(consumed=True)
    )
    code = f"{secrets.randbelow(1000000):06d}"
    item = EmailChallenge(
        id=ident,
        email=email,
        code_hash=code_hash(ident, code),
        purpose="login" if user else "create",
        password_hash=(pending_hash or hasher.hash(password)) if not user else None,
        expires_at=stamp + 600,
    )
    db.add(item)
    db.flush()
    try:
        send_code_email(email, code, item.purpose, ident)
    except (OSError, ValueError):
        fail(503, "MAIL_UNAVAILABLE", "Не удалось отправить код. Попробуйте позже.")
    db.commit()
    return response


@router.post("/virtual-company", response_model=ChallengeView, status_code=202)
def virtual_company(body: VirtualCompanyInput, db: Session = Depends(get_db)):
    return start_challenge(db, body.email, body.password)


@router.post("/register", response_model=ChallengeView, status_code=202)
def register(body: VirtualCompanyInput, db: Session = Depends(get_db)):
    return start_challenge(db, body.email, body.password)


@router.post("/login", response_model=ChallengeView, status_code=202)
def login(body: EmailInput, db: Session = Depends(get_db)):
    return start_challenge(db, body.email)


@router.post("/request-code", response_model=ChallengeView, status_code=202)
def request_code(body: EmailInput, db: Session = Depends(get_db)):
    return start_challenge(db, body.email)


@router.post("/verify-code", response_model=AuthResult)
def verify_code(body: CodeVerify, db: Session = Depends(get_db)):
    email = allowed_email(body.email)
    item = db.scalar(
        select(EmailChallenge)
        .where(EmailChallenge.id == str(body.challenge_id), EmailChallenge.email == email)
        .with_for_update()
    )
    if not item or item.consumed or item.expires_at <= int(time.time()) or item.attempts >= 5:
        fail(400, "INVALID_CODE", "Код недействителен или истёк. Запросите новый.")
    attempts = db.execute(
        update(EmailChallenge)
        .where(EmailChallenge.id == item.id, EmailChallenge.consumed.is_(False), EmailChallenge.attempts < 5)
        .values(attempts=EmailChallenge.attempts + 1)
        .returning(EmailChallenge.attempts)
    ).scalar_one_or_none()
    if attempts is None:
        fail(400, "INVALID_CODE", "Код уже использован или попытки исчерпаны.")
    if not hmac.compare_digest(item.code_hash, code_hash(item.id, body.code)):
        db.commit()
        fail(400, "INVALID_CODE", "Неверный код. Осталось попыток: " + str(5 - attempts))
    item.consumed = True
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        if item.purpose != "create" or not item.password_hash:
            fail(400, "INVALID_CODE", "Создайте виртуальную компанию.")
        suffix = item.id.replace("-", "")[:4].upper()
        company = Company(name=f"ООО «Линия {suffix}»", inn="0000000010")
        db.add(company)
        db.flush()
        user = User(email=email, password_hash=item.password_hash, company_id=company.id, verified=True)
        db.add(user)
        db.flush()
    else:
        user.verified = True
        company = db.get(Company, user.company_id)
    ensure_workspace(db, company)
    return auth_response(db, user)


@router.post("/resend-code", response_model=ChallengeView, status_code=202)
def resend_code(body: CodeResend, db: Session = Depends(get_db)):
    email = allowed_email(body.email)
    previous = db.get(EmailChallenge, str(body.challenge_id))
    if not previous or previous.email != email or previous.created_at < int(time.time()) - 86400:
        fail(400, "INVALID_CHALLENGE", "Начните вход или создание компании заново.")
    return start_challenge(db, email, pending_hash=previous.password_hash)


@router.post("/verify-email", response_model=Message)
def retired_link():
    fail(410, "CODE_REQUIRED", "Подтверждение выполняется только кодом из письма.")


@router.post("/logout", response_model=Message)
def logout(user: User = Depends(current_user), credentials=Depends(bearer), db: Session = Depends(get_db)):
    db.execute(update(Token).where(Token.digest == digest(credentials.credentials)).values(used=True))
    db.commit()
    return {"message": "Вы вышли из аккаунта"}
