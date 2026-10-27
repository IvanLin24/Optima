# AI: маршруты сайта; правила в ../AGENTS.md. WEB proxy — отдельный сервис, НЕ ТРОГАТЬ.
import logging
from contextlib import asynccontextmanager
from uuid import uuid4
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from app.config import settings
from app.db import engine
from app.auth import router as auth_router
from app.api import router as api_router
from app.demo import router as demo_router, opportunities
from app.schemas import ErrorEnvelope
from app.prototype import router as prototype_router
from app.scene import router as scene_router


@asynccontextmanager
async def lifespan(app):
    settings().validate_runtime()
    yield


app = FastAPI(
    title="Совместные закупки B2B",
    version="0.1.0",
    lifespan=lifespan,
    responses={status: {"model": ErrorEnvelope} for status in (400, 401, 403, 404, 409, 413, 422, 429, 500, 503)},
    description="MVP: Белая площадь, выписки 1С TXT, три вкладки. "
    "Подтверждения демонстрационные, электронная подпись отсутствует.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings().cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID", "Content-Disposition"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request.state.request_id = str(uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


def error(request, status, code, message, fields=None):
    return JSONResponse(
        status_code=status,
        content={
            "error": {"code": code, "message": message, "fields": fields},
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(HTTPException)
async def http_error(request, exc):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "HTTP_ERROR", "message": str(exc.detail)}
    return error(request, exc.status_code, detail["code"], detail["message"])


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    # Do not echo input values: they can contain passwords or tokens.
    fields = [{"field": ".".join(map(str, item["loc"])), "message": item["msg"]} for item in exc.errors()]
    return error(request, 422, "VALIDATION_ERROR", "Проверьте поля запроса", fields)


@app.exception_handler(Exception)
async def internal_error(request, exc):
    logging.getLogger("app").error(
        "Unhandled error request_id=%s type=%s", getattr(request.state, "request_id", None), type(exc).__name__
    )
    return error(request, 500, "INTERNAL_ERROR", "Ошибка сервера")


@app.get("/health", tags=["Система"])
def health() -> dict:
    return {"status": "ok", "version": app.version}


@app.get("/health/ready", tags=["Система"])
def ready() -> dict:
    with engine.connect() as db:
        db.execute(text("SELECT 1"))
        db.execute(text("SELECT version_num FROM alembic_version"))
    return {"status": "ready"}


for router in (auth_router, api_router, opportunities, demo_router, prototype_router, scene_router):
    app.include_router(router, prefix="/api/v1")
