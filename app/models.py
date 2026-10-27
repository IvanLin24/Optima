import time
from uuid import uuid4
from sqlalchemy import String, Integer, BigInteger, Boolean, ForeignKey, JSON, Text, UniqueConstraint, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


def uid():
    return str(uuid4())


class Entity:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    created_at: Mapped[int] = mapped_column(BigInteger, default=lambda: int(time.time()))


class Company(Entity, Base):
    __tablename__ = "companies"
    name: Mapped[str] = mapped_column(String(200))
    inn: Mapped[str | None] = mapped_column(String(12), nullable=True)
    consent_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    consent_at: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    consent_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class User(Entity, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    demo_group: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)


class Token(Entity, Base):
    __tablename__ = "tokens"
    digest: Mapped[str] = mapped_column(String(64), unique=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    expires_at: Mapped[int] = mapped_column(BigInteger)
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class RateLimit(Base):
    __tablename__ = "rate_limits"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    count: Mapped[int] = mapped_column(Integer)


class EmailChallenge(Entity, Base):
    __tablename__ = "email_challenges"
    email: Mapped[str] = mapped_column(String(254), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    purpose: Mapped[str] = mapped_column(String(20))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[int] = mapped_column(BigInteger)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)


class PrototypeWorkspace(Base):
    __tablename__ = "prototype_workspaces"
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    state: Mapped[dict] = mapped_column(JSON)
    directory: Mapped[list] = mapped_column(JSON)


class SceneBusiness(Entity, Base):
    __tablename__ = "scene_businesses"
    __table_args__ = (UniqueConstraint("owner_company_id", "scene_key"),)
    owner_company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    scene_key: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(30))
    address: Mapped[str] = mapped_column(String(300))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    data: Mapped[dict] = mapped_column(JSON)


class SceneDeal(Entity, Base):
    __tablename__ = "scene_deals"
    owner_company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    sku: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(30), default="ready")
    revision: Mapped[int] = mapped_column(Integer, default=1)
    payload: Mapped[dict] = mapped_column(JSON)


class StatementImport(Entity, Base):
    __tablename__ = "statement_imports"
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20))
    result: Mapped[dict] = mapped_column(JSON, default=dict)


class Transaction(Entity, Base):
    __tablename__ = "transactions"
    __table_args__ = (UniqueConstraint("company_id", "fingerprint"),)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    import_id: Mapped[str] = mapped_column(ForeignKey("statement_imports.id"))
    fingerprint: Mapped[str] = mapped_column(String(64))
    date: Mapped[str] = mapped_column(String(10))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    direction: Mapped[str] = mapped_column(String(10))
    counterparty: Mapped[str] = mapped_column(String(255))
    counterparty_inn: Mapped[str] = mapped_column(String(12))
    purpose: Mapped[str] = mapped_column(Text)


class Offer(Entity, Base):
    __tablename__ = "offers"
    demo_group: Mapped[str] = mapped_column(String(36), index=True)
    supplier: Mapped[str] = mapped_column(String(200))
    supplier_inn: Mapped[str] = mapped_column(String(12))
    product: Mapped[str] = mapped_column(String(200))
    sku: Mapped[str] = mapped_column(String(50))
    retail_minor: Mapped[int] = mapped_column(Integer)
    wholesale_minor: Mapped[int] = mapped_column(Integer)
    min_quantity: Mapped[int] = mapped_column(Integer)
    pack_size: Mapped[int] = mapped_column(Integer, default=100)


class Contract(Entity, Base):
    __tablename__ = "contracts"
    offer_id: Mapped[str] = mapped_column(ForeignKey("offers.id"))
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(30), default="clarifying")
    # Version references are validated in the service while holding a row lock.
    active_version_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    proposed_version_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class Participant(Entity, Base):
    __tablename__ = "participants"
    __table_args__ = (UniqueConstraint("contract_id", "company_id"),)
    contract_id: Mapped[str] = mapped_column(ForeignKey("contracts.id"), index=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)


class Question(Entity, Base):
    __tablename__ = "questions"
    contract_id: Mapped[str] = mapped_column(ForeignKey("contracts.id"), index=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="open")
    answer: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class Version(Entity, Base):
    __tablename__ = "versions"
    __table_args__ = (UniqueConstraint("contract_id", "number"),)
    contract_id: Mapped[str] = mapped_column(ForeignKey("contracts.id"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(30), default="awaiting_signatures")
    payload: Mapped[dict] = mapped_column(JSON)
    document: Mapped[str] = mapped_column(Text)
    document_hash: Mapped[str] = mapped_column(String(64))
    supplier_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[int] = mapped_column(BigInteger)


class SignatureTask(Entity, Base):
    __tablename__ = "signature_tasks"
    __table_args__ = (UniqueConstraint("version_id", "company_id"),)
    version_id: Mapped[str] = mapped_column(ForeignKey("versions.id"), index=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    confirmed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)


class AuditEvent(Entity, Base):
    __tablename__ = "audit_events"
    contract_id: Mapped[str] = mapped_column(ForeignKey("contracts.id"), index=True)
    company_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    kind: Mapped[str] = mapped_column(String(50))
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
