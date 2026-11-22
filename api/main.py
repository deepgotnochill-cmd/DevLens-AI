import asyncio
import os
from collections import OrderedDict, deque
from contextlib import asynccontextmanager
from time import monotonic

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .analyzer import Report, Upstream, analyze, repository
from .rag import explain


@asynccontextmanager
async def lifespan(app):
    pool = None
    if os.getenv("DATABASE_URL"):
        from psycopg_pool import AsyncConnectionPool
        pool = AsyncConnectionPool(os.environ["DATABASE_URL"], min_size=0, max_size=6, open=False, timeout=8)
        await pool.open()
    app.state.pool = pool
    async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
        app.state.client = client
        yield
    if pool:
        await pool.close()


app = FastAPI(title="DevLens AI", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS","http://localhost:3000").split(","),
                   allow_methods=["GET","POST"], allow_headers=["Content-Type"])
cache = OrderedDict()
locks = [asyncio.Lock() for _ in range(64)]
ai_slots = asyncio.Semaphore(3)
budget = deque()


class Query(BaseModel):
    url: str = Field(max_length=300)


class Question(Query):
    path: str = Field(min_length=1, max_length=1024)
    question: str = Field(min_length=3, max_length=1200)
    revision: str = Field(pattern=r"^[0-9a-f]{40}$")


class Citation(BaseModel):
    path: str
    start: int
    end: int
    excerpt: str
    url: str


class Explanation(BaseModel):
    answer: str
    sources: list[Citation]


@app.exception_handler(Upstream)
async def upstream_error(request, exc):
    return JSONResponse({"detail":exc.detail}, status_code=exc.status)


@app.exception_handler(httpx.RequestError)
async def network_error(request, exc):
    return JSONResponse({"detail":"The upstream service is unreachable. Please retry."}, status_code=503)


async def get_report(url):
    try:
        slug = repository(url)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    async with locks[hash(slug) % len(locks)]:
        item = cache.get(slug)
        if item and item[0] > monotonic():
            cache.move_to_end(slug)
            return item[1]
        report = await analyze(app.state.client, slug)
        cache[slug] = (monotonic() + 300, report)
        cache.move_to_end(slug)
        if len(cache) > 32:
            cache.popitem(last=False)
        return report


@app.get("/health")
def health():
    return {"status":"ok"}


@app.post("/analyze", response_model=Report)
async def inspect_repository(query: Query):
    return await get_report(query.url)


@app.post("/explain", response_model=Explanation)
async def explain_file(query: Question, request: Request):
    if not app.state.pool or not os.getenv("OPENAI_API_KEY"):
        raise Upstream(503, "Set up the AI provider and vector database to enable code explanations.")
    now = monotonic()
    while budget and budget[0] <= now - 60:
        budget.popleft()
    if len(budget) >= 10 or ai_slots.locked():
        raise Upstream(429, "AI request capacity reached. Try again in a minute.")
    budget.append(now)
    async with ai_slots:
        report = await get_report(query.url)
        if report.head != query.revision:
            raise Upstream(409, "The default branch changed. Analyze the repository again.")
        return await explain(app.state.client, app.state.pool, report, query.path, query.question)

