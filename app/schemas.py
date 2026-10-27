from datetime import datetime
from typing import Annotated, Literal, Generic, TypeVar
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


Password = Annotated[str, Field(min_length=12, max_length=128)]


class Register(Input):
    email: EmailStr
    password: Password
    company_name: str = Field(min_length=2, max_length=200)
    inn: str | None = Field(default=None, pattern=r"^\d{10}(\d{2})?$")


class Login(Input):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class EmailInput(Input):
    email: EmailStr


class VirtualCompanyInput(EmailInput):
    password: Password


class CodeVerify(EmailInput):
    challenge_id: UUID
    code: str = Field(pattern=r"^\d{6}$")


class CodeResend(EmailInput):
    challenge_id: UUID


class ChallengeView(BaseModel):
    challenge_id: str
    expires_in: int = 600
    resend_after: int = 60
    message: str = "Введите код из письма"


class PrototypeSave(Input):
    revision: int = Field(ge=1)
    state: dict

    @field_validator("state")
    @classmethod
    def validate_state(cls, value):
        import json

        if value.get("schema") != 3 or value.get("role") not in {"buyer", "supplier"}:
            raise ValueError("Некорректное состояние демо")
        if len(json.dumps(value, ensure_ascii=False).encode()) > 2_000_000:
            raise ValueError("Состояние слишком большое")
        return value


class TokenInput(Input):
    token: str = Field(min_length=20, max_length=200)


class Reset(TokenInput):
    password: Password


class Consent(Input):
    version: Literal["2026-10-26-v1"]
    accepted: Literal[True]


class CompanyUpdate(Input):
    name: str = Field(min_length=2, max_length=200)
    inn: str = Field(pattern=r"^\d{10}(\d{2})?$")


class Window(Input):
    start: datetime
    end: datetime

    @field_validator("start", "end")
    @classmethod
    def timezone_required(cls, v):
        if v.tzinfo is None or v.utcoffset() is None:
            raise ValueError("Укажите часовой пояс")
        return v

    @model_validator(mode="after")
    def ordered(self):
        if self.end <= self.start:
            raise ValueError("Конец окна должен быть позже начала")
        return self


class Answer(Input):
    product_id: UUID
    quantity: int = Field(gt=0, le=1_000_000, strict=True)
    delivery_window: Window
    delivery_address: str = Field(min_length=5, max_length=300)
    confirmed: Literal[True]


class Decision(Input):
    version_id: UUID
    document_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    accepted: Literal[True]


class Reject(Input):
    version_id: UUID
    document_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    reason: str = Field(min_length=1, max_length=500)


class Amendment(Input):
    base_version_id: UUID
    delivery_window: Window
    reason: str = Field(min_length=3, max_length=500)


class SupplierConfirmation(Input):
    version_id: UUID
    confirmed: Literal[True]


class DemoGenerate(Input):
    seed: int = Field(default=42, ge=0, le=1_000_000)


class AuthResult(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


class Message(BaseModel):
    message: str


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None


class CompanyView(BaseModel):
    id: str
    name: str
    inn: str | None


class MeView(BaseModel):
    id: str
    email: str
    email_verified: bool
    company: CompanyView
    consent_version: str | None
    consent_at: int | None
    is_demo: bool


class OfferView(BaseModel):
    id: str
    supplier: str
    product: str
    sku: str
    min_quantity: int
    pack_size: int
    retail_price_minor: int
    wholesale_price_minor: int


class Totals(BaseModel):
    quantity: int
    retail_minor: int
    wholesale_minor: int
    gross_savings_minor: int
    fee_minor: int
    net_savings_minor: int


class Share(Totals):
    company_id: str
    company_name: str
    delivery_address: str


class FinancialPayload(BaseModel):
    currency: Literal["RUB"]
    fee_rate_percent: int
    shares: list[Share]
    totals: Totals
    delivery_window: Window
    tax_note: str
    delivery_included: bool
    payment_mode: Literal["direct_to_supplier"]
    fee_collection: Literal["calculation_only"]
    amendment_reason: str | None = None
    base_version_id: str | None = None


class VersionView(BaseModel):
    id: str
    number: int
    status: str
    document_hash: str
    supplier_confirmed: bool
    expires_at: int
    payload: FinancialPayload
    signature_mode: Literal["demo"]
    legally_binding: Literal[False]


class ContractView(BaseModel):
    id: str
    title: str
    status: str
    active_version_id: str | None
    proposed_version_id: str | None
    signature_mode: Literal["demo"] = "demo"
    legally_binding: Literal[False] = False
    offer: OfferView
    active_version: VersionView | None
    proposed_version: VersionView | None


class AnswerSchema(BaseModel):
    product_id: str
    sku: str
    pack_size: int
    required: list[str]


class QuestionView(BaseModel):
    id: str
    contract_id: str
    text: str
    status: str
    answer: Answer | None
    legally_binding: Literal[False]
    answer_schema: AnswerSchema


class TaskView(BaseModel):
    id: str
    contract_id: str
    version_id: str
    version: int
    status: str
    version_status: str
    document_hash: str
    expires_at: int
    supplier_confirmed: bool
    download_url: str
    signature_mode: Literal["demo"]
    legally_binding: Literal[False]


class Readiness(BaseModel):
    ready: bool
    reason: str | None = None
    version_id: str | None = None


class AnswerResult(BaseModel):
    question: QuestionView
    readiness: Readiness


class ImportErrorView(BaseModel):
    line: int
    message: str


class ImportView(BaseModel):
    id: str
    status: str
    inserted: int
    duplicates: int
    errors: list[ImportErrorView]


class TransactionView(BaseModel):
    id: str
    date: str
    amount_minor: int
    direction: Literal["outgoing", "incoming"]
    counterparty: str
    counterparty_inn: str
    purpose: str


class DocumentView(BaseModel):
    id: str
    version: int
    format: Literal["markdown"]
    document_hash: str
    download_url: str
    legally_binding: Literal[False]


class EventView(BaseModel):
    id: str
    created_at: int
    kind: str
    detail: dict


class ErrorDetail(BaseModel):
    code: str
    message: str
    fields: list[dict] | None = None


class ErrorEnvelope(BaseModel):
    error: ErrorDetail
    request_id: str | None
