"""Read-only, bounded GitHub evidence collection."""
import asyncio
import os
import re
from datetime import UTC, datetime
from urllib.parse import quote

import httpx
from pydantic import BaseModel, Field

URL = re.compile(r"https://github\.com/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)/([A-Za-z0-9_.-]{1,104})/?", re.I)


def repository(value: str) -> str:
    match = URL.fullmatch(value.strip())
    if not match:
        raise ValueError("Enter a public repository URL such as https://github.com/pallets/flask.")
    owner, name = match.groups()
    name = name.removesuffix(".git")
    if name in {"", ".", ".."} or len(name) > 100:
        raise ValueError("Enter a valid repository name.")
    return f"{owner}/{name}".lower()


class Upstream(Exception):
    def __init__(self, status: int, detail: str):
        self.status = status
        self.detail = detail


class File(BaseModel):
    path: str
    type: str
    size: int = 0
    sha: str = ""


class Commit(BaseModel):
    sha: str
    date: str
    message: str


class Report(BaseModel):
    full_name: str
    url: str
    description: str
    stars: int
    forks: int
    open_items: int
    watchers: int
    default_branch: str
    license: str | None
    archived: bool
    pushed_at: str | None
    analyzed_at: str
    languages: dict[str, int]
    commits: list[Commit]
    files: list[File]
    truncated: bool
    head: str
    notes: list[str] = Field(default_factory=list)


async def github(client: httpx.AsyncClient, path: str, **params):
    token = os.getenv("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    response = await client.get("https://api.github.com/repos/" + path, params=params, headers=headers)
    if response.status_code == 404:
        raise Upstream(404, "Repository or revision unavailable. Check that the repository is public.")
    if response.status_code == 409:
        raise Upstream(409, "Repository has no commits.")
    if response.status_code in (403, 429):
        raise Upstream(429, "GitHub limited this request. Please retry after the limit resets.")
    if response.status_code != 200:
        raise Upstream(502, "GitHub could not complete this request.")
    return response.json()


async def analyze(client: httpx.AsyncClient, slug: str) -> Report:
    meta = await github(client, slug)
    if meta.get("private") is not False:
        raise Upstream(404, "Only public repositories are supported.")
    try:
        commits = await github(client, slug + "/commits", sha=meta["default_branch"], per_page=100)
    except Upstream as exc:
        if exc.status != 409:
            raise
        commits = []
    head = commits[0]["sha"] if commits else ""
    async def tree():
        if head:
            return await github(client, slug + "/git/trees/" + head, recursive=1)
        return {"tree": [], "truncated": False}
    languages, structure = await asyncio.gather(github(client, slug + "/languages"), tree())
    entries = structure["tree"]
    return Report(full_name=meta["full_name"], url=meta["html_url"], description=meta["description"] or "",
                  stars=meta["stargazers_count"], forks=meta["forks_count"], watchers=meta["subscribers_count"],
                  open_items=meta["open_issues_count"], default_branch=meta["default_branch"],
                  license=(meta.get("license") or {}).get("spdx_id"), archived=meta["archived"],
                  pushed_at=meta["pushed_at"], analyzed_at=datetime.now(UTC).isoformat(),
                  head=head, languages=languages, truncated=structure["truncated"] or len(entries)>5000,
                  files=[File(**e) for e in entries[:5000]],
                  commits=[Commit(sha=c["sha"], date=c["commit"]["committer"]["date"],
                                  message=c["commit"]["message"].split("\n")[0][:240]) for c in commits])

