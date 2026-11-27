"""Authenticated review workspace. Public Pages analytics run independently."""
import base64
import binascii
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
from psycopg import AsyncConnection

from api.rag import EXTENSIONS, explain_revision
from api.analyzer import Upstream, repository
from api.main import Explanation, Question, app as api, ai_slots, lifespan as api_lifespan

ROOT = Path(__file__).resolve().parent
@asynccontextmanager
async def lifespan(_):
    if not os.environ.get("REVIEW_PASSWORD"):
        raise RuntimeError("Set REVIEW_PASSWORD before starting the hosted workspace.")
    async with await AsyncConnection.connect(os.environ["DATABASE_URL"]) as connection:
        await connection.execute("SELECT pg_advisory_xact_lock(713940204)")
        await connection.execute((ROOT / "db/init.sql").read_text())
        await connection.execute("CREATE TABLE IF NOT EXISTS public_review_usage (day date PRIMARY KEY, attempts integer NOT NULL)")
    async with api_lifespan(api):
        yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def authenticate(request: Request, call_next):
    if request.url.path not in {"/health", "/public/explain"}:
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


public = FastAPI(docs_url=None, redoc_url=None, openapi_url=None,
                 exception_handlers=api.exception_handlers.copy())
public.add_middleware(CORSMiddleware, allow_origins=["https://deepgotnochill-cmd.github.io"],
                      allow_methods=["POST"], allow_headers=["Content-Type"])


@public.post("/explain", response_model=Explanation)
async def public_explanation(query: Question, request: Request):
    try:
        slug = repository(query.url)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    path = query.path
    if (any(part in {"", ".", ".."} for part in path.split("/"))
            or not path.lower().endswith(EXTENSIONS)):
        raise HTTPException(422, "Select a supported source file.")
    if ai_slots.locked():
        raise HTTPException(429, "The public explainer is busy. Please try again shortly.")
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(503, "The AI provider is not configured.")
    limit = int(os.getenv("PUBLIC_AI_DAILY_LIMIT", "20"))
    if limit <= 0:
        raise HTTPException(429, "Public AI reviews are paused.")
    async with api.state.pool.connection() as conn:
        result = await conn.execute("""
            INSERT INTO public_review_usage AS usage (day, attempts)
            VALUES ((now() AT TIME ZONE 'UTC')::date, 1)
            ON CONFLICT (day) DO UPDATE SET attempts = usage.attempts + 1
            WHERE usage.attempts < %s RETURNING attempts
        """, (limit,))
        if await result.fetchone() is None:
            raise HTTPException(429, "The shared daily AI limit has been reached. Try after midnight UTC.")

    async def read_source():
        url = f"https://raw.githubusercontent.com/{slug}/{query.revision}/{quote(path, safe='/')}"
        async with api.state.client.stream("GET", url) as response:
            if response.status_code != 200:
                raise Upstream(404 if response.status_code == 404 else 503,
                               "Could not retrieve this public file at the selected commit.")
            content = bytearray()
            async for chunk in response.aiter_bytes(8192):
                content.extend(chunk)
                if len(content) > 60000:
                    raise Upstream(422, "Select a source file under 60 KB.")
        try:
            return content.decode("utf-8")
        except UnicodeError:
            raise Upstream(422, "Select a UTF-8 text file.")

    async with ai_slots:
        return await explain_revision(api.state.client, api.state.pool, slug, query.revision,
                                      path, query.question, read_source)


app.mount("/public", public)
