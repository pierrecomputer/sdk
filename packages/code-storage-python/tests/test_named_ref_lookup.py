"""Tests for exact branch and tag lookups."""

from typing import Any, Optional
from unittest.mock import AsyncMock, patch

import httpx
import jwt
import pytest

from pierre_storage import GitStorage


def decode_scopes(authorization: str) -> list[str]:
    """Read scopes from a test token without signature verification."""
    token = authorization.removeprefix("Bearer ")
    payload = jwt.decode(token, options={"verify_signature": False})
    return payload["scopes"]


def response(payload: dict[str, Any], status: int = 200) -> httpx.Response:
    """Build one HTTP response for a mocked request."""
    return httpx.Response(
        status,
        json=payload,
        request=httpx.Request("GET", "https://api.test.code.storage"),
    )


@pytest.mark.asyncio
async def test_get_branch_uses_preferred_route_and_git_read_scope(
    git_storage_options: dict,
) -> None:
    """Get one decoded branch without list fields or a list request."""
    repo = GitStorage(git_storage_options).repo(id="owner/repo")
    get = AsyncMock(
        return_value=response(
            {
                "branch": {
                    "name": "attempt/7",
                    "head_sha": "abc123",
                    "created_at": "2026-08-29T10:00:00Z",
                    "cursor": "private-cursor",
                }
            }
        )
    )

    with (
        patch("httpx.AsyncClient") as client,
        patch.object(
            repo, "list_branches", AsyncMock(side_effect=AssertionError("unexpected list"))
        ),
    ):
        client.return_value.__aenter__.return_value.get = get
        result = await repo.get_branch(name="attempt/7", ephemeral=True)

    url = get.await_args.args[0]
    assert url.endswith("/api/repos/owner%2Frepo/branch?name=attempt%2F7&ephemeral=true")
    assert "%252F" not in url
    assert decode_scopes(get.await_args.kwargs["headers"]["Authorization"]) == ["git:read"]
    assert result == {
        "name": "attempt/7",
        "head_sha": "abc123",
        "created_at": "2026-08-29T10:00:00Z",
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("ephemeral", "expected_query"),
    [(False, "name=feature%2Ffalse&ephemeral=false"), (None, "name=feature%2Fomitted")],
)
async def test_get_branch_preserves_ephemeral_value(
    git_storage_options: dict,
    ephemeral: Optional[bool],
    expected_query: str,
) -> None:
    """Keep false and omit an absent ephemeral value."""
    repo = GitStorage(git_storage_options).repo(id="repo")
    name = "feature/false" if ephemeral is False else "feature/omitted"
    get = AsyncMock(
        return_value=response(
            {
                "branch": {
                    "name": name,
                    "head_sha": "abc123",
                    "created_at": "2026-08-29T10:00:00Z",
                }
            }
        )
    )

    with patch("httpx.AsyncClient") as client:
        client.return_value.__aenter__.return_value.get = get
        await repo.get_branch(name=name, ephemeral=ephemeral)

    assert get.await_args.args[0].endswith(f"/branch?{expected_query}")


@pytest.mark.asyncio
async def test_get_tag_uses_preferred_route_and_hides_private_fields(
    git_storage_options: dict,
) -> None:
    """Return the public commit SHA without list or storage-only fields."""
    repo = GitStorage(git_storage_options).repo(id="owner/repo")
    get = AsyncMock(
        return_value=response(
            {
                "tag": {
                    "name": "releases/v1.4.0",
                    "sha": "commit123",
                    "object_sha": "tag-object-123",
                    "cursor": "private-cursor",
                }
            }
        )
    )

    with (
        patch("httpx.AsyncClient") as client,
        patch.object(repo, "list_tags", AsyncMock(side_effect=AssertionError("unexpected list"))),
    ):
        client.return_value.__aenter__.return_value.get = get
        result = await repo.get_tag(name="releases/v1.4.0")

    url = get.await_args.args[0]
    assert url.endswith("/api/repos/owner%2Frepo/tag?name=releases%2Fv1.4.0")
    assert "%252F" not in url
    assert decode_scopes(get.await_args.kwargs["headers"]["Authorization"]) == ["git:read"]
    assert result == {"name": "releases/v1.4.0", "sha": "commit123"}


@pytest.mark.asyncio
@pytest.mark.parametrize("method", ["get_branch", "get_tag"])
async def test_named_ref_not_found_uses_normal_http_error(
    git_storage_options: dict,
    method: str,
) -> None:
    """Return the standard HTTP error with its 404 status."""
    repo = GitStorage(git_storage_options).repo(id="repo")
    get = AsyncMock(return_value=response({"error": "ref not found"}, status=404))

    with patch("httpx.AsyncClient") as client:
        client.return_value.__aenter__.return_value.get = get
        with pytest.raises(httpx.HTTPStatusError) as caught:
            await getattr(repo, method)(name="missing/ref")

    assert caught.value.response.status_code == 404
