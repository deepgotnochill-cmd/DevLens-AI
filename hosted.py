"""Authenticated review workspace. Public Pages analytics run independently."""
import base64
import binascii
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, Response
from psycopg import AsyncConnection

from api.main import app as api, lifespan as api_lifespan

ROOT = Path(__file__).resolve().parent
@asynccontextmanager
async def lifespan(_):
    if not os.environ.get("REVIEW_PASSWORD"):
        raise RuntimeError("Set REVIEW_PASSWORD before starting the hosted workspace.")
    async with await AsyncConnection.connect(os.environ["DATABASE_URL"]) as connection:
        await connection.execute("SELECT pg_advisory_xact_lock(713940204)")
        await connection.execute((ROOT / "db/init.sql").read_text())
    async with api_lifespan(api):
        yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def authenticate(request: Request, call_next):
    if request.url.path != "/health":
        scheme, _, token = request.headers.get("authorization", "").partition(" ")
        try:
            supplied = base64.b64decode(token, validate=True) if scheme.lower() == "basic" else b""
        except (binascii.Error, ValueError):
            supplied = b""
        expected = ("deep:" + os.environ["REVIEW_PASSWORD"]).encode()
        if not secrets.compare_digest(supplied, expected):
            return Response(status_code=401, headers={"WWW-Authenticate": 'Basic realm="DevLens review"'})
    return await call_next(request)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse)
def dashboard():
    page = (ROOT / "DevLens-AI.html").read_text(encoding="utf-8")
    return page.replace('id="devlens"', 'id="devlens" data-api="/api"', 1)


app.mount("/api", api)
