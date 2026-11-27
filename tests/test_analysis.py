import unittest
from unittest.mock import patch

import httpx

from api.analyzer import Upstream, analyze, repository
from api.rag import chunks, explain, provider


class RepositoryTests(unittest.TestCase):
    def test_normalization(self):
        self.assertEqual(repository(" https://github.com/Owner/Project.git/ "), "owner/project")

    def test_bad_urls(self):
        for address in ["http://github.com/a/b","https://github.com@evil.test/a/b","https://github.com:443/a/b",
                        "https://github.com/a/..","https://github.com/a/b?x=y","https://github.com/a/b/tree/main",
                        "https://github.com/a/%2e%2e","https://github.com.evil.test/a/b","file:///tmp/x"]:
            with self.subTest(address=address), self.assertRaises(ValueError):
                repository(address)

    def test_chunk_line_ranges(self):
        lines = [str(i) for i in range(100)]
        for start, end, body in chunks("\n".join(lines)):
            self.assertEqual(body.splitlines(), lines[start-1:end])


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_revision_pinning_and_counts(self):
        sha = "a"*40
        meta = {"full_name":"o/r","html_url":"https://github.com/o/r","private":False,
                "default_branch":"main","description":"Example","stargazers_count":12,"forks_count":2,
                "subscribers_count":1,"open_issues_count":3,"license":None,"archived":False,"pushed_at":None}
        responses = {"/repos/o/r":meta, "/repos/o/r/commits":[{"sha":sha,"commit":{"message":"A\nB","committer":{"date":"2026-01-01T00:00:00Z"}}}],
                     "/repos/o/r/languages":{"Python":32},"/repos/o/r/git/trees/"+sha:{"tree":[{"path":"README.md","type":"blob","size":3,"sha":"b"*40}],"truncated":False}}
        def transport(req):
            self.assertEqual(req.url.host,"api.github.com")
            return httpx.Response(200,json=responses[req.url.path])
        async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
            report = await analyze(client,"o/r")
        self.assertEqual(report.commits[0].message,"A")
        self.assertEqual(report.files[0].path,"README.md")
        self.assertEqual(report.head,sha)
        self.assertEqual(report.watchers,1)
        with self.assertRaises(Upstream) as error:
            await explain(None,None,report,"README.md","Explain")
        self.assertEqual(error.exception.status,503)

    async def test_private_repo_rejected_before_contents(self):
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r:httpx.Response(200,json={"private":True}))) as client:
            with self.assertRaises(Upstream) as error:
                await analyze(client,"o/r")
            self.assertEqual(error.exception.status,404)

    async def test_rate_limit(self):
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r:httpx.Response(403))) as client:
            with self.assertRaises(Upstream) as error:
                await analyze(client,"o/r")
            self.assertEqual(error.exception.status,429)


    async def test_provider_errors_are_actionable_and_redacted(self):
        cases = [(401, {}, "API key"), (403, {}, "permissions"),
                 (429, {"code": "insufficient_quota"}, "API billing"),
                 (429, {}, "limited"), (503, {}, "temporarily")]
        for status, error, expected in cases:
            with self.subTest(status=status, expected=expected), patch.dict("os.environ", OPENAI_API_KEY="test"):
                response = httpx.Response(status, json={"error": {**error, "message": "private upstream data"}})
                async with httpx.AsyncClient(transport=httpx.MockTransport(lambda req: response)) as client:
                    with self.assertRaises(Upstream) as result:
                        await provider(client, "embeddings", {})
                self.assertIn(expected, result.exception.detail)
                self.assertNotIn("private upstream data", result.exception.detail)
