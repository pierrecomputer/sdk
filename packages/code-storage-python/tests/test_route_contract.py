"""Complete method and path contract for preferred REST requests."""

from collections.abc import Awaitable, Callable
from typing import Any, Optional
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from pierre_storage import GitStorage


class _Response:
    status_code = 200
    is_success = True
    reason_phrase = "OK"
    headers: dict[str, str] = {}

    def json(self) -> dict[str, Any]:
        return {}

    def raise_for_status(self) -> None:
        return None

    async def aread(self) -> bytes:
        return b"{}"

    async def aclose(self) -> None:
        return None


class _StreamContext:
    async def __aenter__(self) -> _Response:
        return _Response()

    async def __aexit__(self, *_args: object) -> None:
        return None


class _CaptureClient:
    requests: list[tuple[str, str, dict[str, Any]]] = []

    async def __aenter__(self) -> "_CaptureClient":
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None

    async def aclose(self) -> None:
        return None

    @classmethod
    def _capture(cls, method: str, url: str, kwargs: dict[str, Any]) -> _Response:
        cls.requests.append((method, url, kwargs))
        return _Response()

    async def get(self, url: str, **kwargs: Any) -> _Response:
        return self._capture("GET", url, kwargs)

    async def head(self, url: str, **kwargs: Any) -> _Response:
        return self._capture("HEAD", url, kwargs)

    async def post(self, url: str, **kwargs: Any) -> _Response:
        return self._capture("POST", url, kwargs)

    async def put(self, url: str, **kwargs: Any) -> _Response:
        return self._capture("PUT", url, kwargs)

    async def delete(self, url: str, **kwargs: Any) -> _Response:
        return self._capture("DELETE", url, kwargs)

    async def request(self, method: str, url: str, **kwargs: Any) -> _Response:
        return self._capture(method, url, kwargs)

    def stream(self, method: str, url: str, **kwargs: Any) -> _StreamContext:
        self._capture(method, url, kwargs)
        return _StreamContext()


class _RouteCase:
    def __init__(
        self,
        name: str,
        method: str,
        path: str,
        invoke: Callable[[], Awaitable[Any]],
        *,
        query: Optional[dict[str, str]] = None,
        body: Optional[dict[str, Any]] = None,
        no_body: bool = False,
    ) -> None:
        self.name = name
        self.method = method
        self.path = path
        self.invoke = invoke
        self.query = query or {}
        self.body = body
        self.no_body = no_body


@pytest.mark.asyncio
async def test_preferred_rest_route_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(httpx, "AsyncClient", _CaptureClient)
    storage = GitStorage(
        {
            "name": "route-contract",
            "token": "test-token",
            "api_base_url": "https://api.example.test",
            "storage_base_url": "storage.example.test",
        }
    )
    repo = storage.repo(id="owner/name")
    signature = {"name": "Route Test", "email": "route@example.test"}

    cases = [
        _RouteCase("create_repo", "POST", "/api/repos", lambda: storage.create_repo(id="owner/name")),
        _RouteCase("list_repos", "GET", "/api/repos", storage.list_repos),
        _RouteCase("find_one", "GET", "/api/repos/owner%2Fname", lambda: storage.find_one(id="owner/name")),
        _RouteCase("delete_repo", "DELETE", "/api/repos/owner%2Fname", lambda: storage.delete_repo(id="owner/name")),
        _RouteCase(
            "create_git_credential",
            "POST",
            "/api/repos/owner%2Fname/git-credentials",
            lambda: storage.create_git_credential(repo_name="owner/name", password="secret"),
        ),
        _RouteCase(
            "update_git_credential",
            "PUT",
            "/api/repos/owner%2Fname/git-credentials/credential%2Fid",
            lambda: storage.update_git_credential(
                repo_name="owner/name", id="credential/id", password="secret"
            ),
        ),
        _RouteCase(
            "delete_git_credential",
            "DELETE",
            "/api/repos/owner%2Fname/git-credentials/credential%2Fid",
            lambda: storage.delete_git_credential(repo_name="owner/name", id="credential/id"),
            no_body=True,
        ),
        _RouteCase(
            "get_file_stream",
            "GET",
            "/api/repos/owner%2Fname/file",
            lambda: repo.get_file_stream(path="README.md"),
        ),
        _RouteCase(
            "head_file",
            "HEAD",
            "/api/repos/owner%2Fname/file",
            lambda: repo.head_file(path="README.md"),
        ),
        _RouteCase("get_archive_stream", "POST", "/api/repos/owner%2Fname/archive", repo.get_archive_stream),
        _RouteCase("list_files", "GET", "/api/repos/owner%2Fname/files", repo.list_files),
        _RouteCase(
            "list_files_with_metadata",
            "GET",
            "/api/repos/owner%2Fname/files/metadata",
            repo.list_files_with_metadata,
        ),
        _RouteCase("list_branches", "GET", "/api/repos/owner%2Fname/branches", repo.list_branches),
        _RouteCase(
            "get_branch",
            "GET",
            "/api/repos/owner%2Fname/branch",
            lambda: repo.get_branch(name="feature/one", ephemeral=False),
            query={"name": "feature/one", "ephemeral": "false"},
        ),
        _RouteCase("list_tags", "GET", "/api/repos/owner%2Fname/tags", repo.list_tags),
        _RouteCase(
            "get_tag",
            "GET",
            "/api/repos/owner%2Fname/tag",
            lambda: repo.get_tag(name="release/v1"),
            query={"name": "release/v1"},
        ),
        _RouteCase("list_commits", "GET", "/api/repos/owner%2Fname/commits", repo.list_commits),
        _RouteCase(
            "get_commit",
            "GET",
            "/api/repos/owner%2Fname/commit",
            lambda: repo.get_commit(ref="main"),
        ),
        _RouteCase(
            "get_blame",
            "GET",
            "/api/repos/owner%2Fname/blame",
            lambda: repo.get_blame(path="README.md"),
        ),
        _RouteCase(
            "get_note",
            "GET",
            "/api/repos/owner%2Fname/notes",
            lambda: repo.get_note(object_ref="main"),
        ),
        _RouteCase(
            "create_note",
            "POST",
            "/api/repos/owner%2Fname/notes",
            lambda: repo.create_note(object_ref="main", note="note"),
        ),
        _RouteCase(
            "append_note",
            "POST",
            "/api/repos/owner%2Fname/notes",
            lambda: repo.append_note(object_ref="main", note="note"),
        ),
        _RouteCase(
            "delete_note",
            "DELETE",
            "/api/repos/owner%2Fname/notes",
            lambda: repo.delete_note(object_ref="main"),
        ),
        _RouteCase("list_notes_refs", "GET", "/api/repos/owner%2Fname/notes/refs", repo.list_notes_refs),
        _RouteCase(
            "get_branch_diff",
            "GET",
            "/api/repos/owner%2Fname/branches/diff",
            lambda: repo.get_branch_diff(branch="feature", base="main"),
            query={"branch": "feature", "base": "main"},
        ),
        _RouteCase(
            "get_commit_diff",
            "GET",
            "/api/repos/owner%2Fname/diff",
            lambda: repo.get_commit_diff(ref="main"),
        ),
        _RouteCase(
            "grep",
            "POST",
            "/api/repos/owner%2Fname/grep",
            lambda: repo.grep(pattern="TODO"),
        ),
        _RouteCase(
            "pull_upstream",
            "POST",
            "/api/repos/owner%2Fname/pull-upstream",
            lambda: repo.pull_upstream(ref="main"),
            body={"ref": "main"},
        ),
        _RouteCase(
            "create_branch",
            "POST",
            "/api/repos/owner%2Fname/branches/create",
            lambda: repo.create_branch(base_ref="main", target_branch="next"),
        ),
        _RouteCase(
            "promote_ephemeral_branch",
            "POST",
            "/api/repos/owner%2Fname/branches/create",
            lambda: repo.promote_ephemeral_branch(base_branch="feature"),
        ),
        _RouteCase(
            "delete_branch",
            "DELETE",
            "/api/repos/owner%2Fname/branches",
            lambda: repo.delete_branch(target_branch="next"),
        ),
        _RouteCase(
            "preview_merge",
            "GET",
            "/api/repos/owner%2Fname/merge/preview",
            lambda: repo.preview_merge(source_branch="feature", target_branch="main"),
        ),
        _RouteCase(
            "merge",
            "POST",
            "/api/repos/owner%2Fname/merge",
            lambda: repo.merge(source_ref="feature", target_branch="main", strategy="ff_only"),
        ),
        _RouteCase(
            "create_tag",
            "POST",
            "/api/repos/owner%2Fname/tags",
            lambda: repo.create_tag(name="v1", ref="main"),
        ),
        _RouteCase(
            "delete_tag",
            "DELETE",
            "/api/repos/owner%2Fname/tags/release%2Fv1",
            lambda: repo.delete_tag(name="release/v1"),
            no_body=True,
        ),
        _RouteCase(
            "restore_commit",
            "POST",
            "/api/repos/owner%2Fname/restore-commit",
            lambda: repo.restore_commit(target_branch="main", base_ref="HEAD~1", author=signature),
        ),
        _RouteCase(
            "create_commit",
            "POST",
            "/api/repos/owner%2Fname/commit-pack",
            lambda: repo.create_commit(
                target_branch="main", commit_message="test route", author=signature
            ).add_file_from_string("README.md", "content").send(),
        ),
        _RouteCase(
            "create_commit_from_diff",
            "POST",
            "/api/repos/owner%2Fname/diff-commit",
            lambda: repo.create_commit_from_diff(
                target_branch="main",
                commit_message="test route",
                author=signature,
                diff="diff --git a/README.md b/README.md",
            ),
        ),
    ]

    for case in cases:
        _CaptureClient.requests.clear()
        try:
            result = await case.invoke()
            if hasattr(result, "aclose"):
                await result.aclose()
        except Exception:
            # Most response parsers reject the generic body after the request is sent.
            pass

        assert _CaptureClient.requests, f"{case.name} did not send a request"
        method, raw_url, kwargs = _CaptureClient.requests[-1]
        parsed = urlparse(raw_url)
        assert method == case.method, case.name
        assert parsed.path == case.path, case.name
        query = parse_qs(parsed.query)
        for name, value in case.query.items():
            assert query.get(name) == [value], case.name
        if case.body is not None:
            assert kwargs.get("json") == case.body, case.name
        if case.no_body:
            assert "json" not in kwargs, case.name
