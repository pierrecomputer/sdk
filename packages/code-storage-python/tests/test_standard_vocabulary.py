"""Contract tests for the standard API vocabulary."""

from unittest.mock import AsyncMock, MagicMock, patch
from urllib.parse import parse_qs, urlparse

import pytest

from pierre_storage import GitStorage
from pierre_storage.commit import (
    _base_metadata_from_options,
    _build_commit_result,
    _normalize_commit_options,
)


def response(data: dict, status: int = 200) -> MagicMock:
    """Build an HTTP response test double."""
    result = MagicMock()
    result.status_code = status
    result.is_success = 200 <= status < 300
    result.reason_phrase = "OK"
    result.json.return_value = data
    result.raise_for_status = MagicMock()
    return result


def client_for(method: str, result: MagicMock) -> MagicMock:
    """Build an async client test double for one request."""
    client = MagicMock()
    setattr(client.__aenter__.return_value, method, AsyncMock(return_value=result))
    client.__aexit__.return_value = False
    return client


def make_storage(options: dict) -> GitStorage:
    """Build a test storage client."""
    return GitStorage(options)


def commit_info() -> dict:
    """Return a valid commit response."""
    return {
        "sha": "subject-sha",
        "parent_shas": [],
        "message": "message",
        "author_name": "Author",
        "author_email": "author@example.com",
        "committer_name": "Committer",
        "committer_email": "committer@example.com",
        "date": "2026-08-28T00:00:00Z",
    }


def diff_response(**extra: object) -> dict:
    """Return a valid diff response."""
    return {
        "sha": "subject-sha",
        "stats": {"files": 0, "additions": 0, "deletions": 0, "changes": 0},
        "files": [],
        "filtered_files": [],
        **extra,
    }


def merge_response(source: dict) -> dict:
    """Return a valid merge response."""
    return {
        "result": "fast_forward",
        "commit_sha": "new-sha",
        "tree_sha": "tree-sha",
        "source": {**source, "ephemeral": False, "sha": "source-sha"},
        "target": {
            "branch": "main",
            "ephemeral": False,
            "old_sha": "old-sha",
            "new_sha": "new-sha",
        },
        "promoted_commits": 1,
    }


def note_response(**refs: str) -> dict:
    """Return a valid note write response."""
    return {
        "sha": "object-sha",
        **refs,
        "new_ref_sha": "notes-sha",
        "result": {"success": True, "status": "ok"},
    }


def restore_response(**branches: str) -> dict:
    """Return a valid restore response."""
    return {
        "commit": {
            "commit_sha": "new-sha",
            "tree_sha": "tree-sha",
            "target_branch": "main",
            "pack_bytes": 1,
        },
        "result": {
            **branches,
            "old_sha": "old-sha",
            "new_sha": "new-sha",
            "success": True,
            "status": "ok",
        },
    }


def commit_ack(**branches: str) -> dict:
    """Return a valid commit acknowledgment."""
    return {
        "commit": {
            "commit_sha": "new-sha",
            "tree_sha": "tree-sha",
            "target_branch": "main",
            "pack_bytes": 1,
            "blob_count": 0,
        },
        "result": {
            **branches,
            "old_sha": "old-sha",
            "new_sha": "new-sha",
            "success": True,
            "status": "ok",
        },
    }


def test_commit_metadata_uses_standard_names_and_preferred_values() -> None:
    """Commit metadata uses standard names and preserves explicit false values."""
    normalized = _normalize_commit_options(
        {
            "target_branch": "main",
            "commit_message": "message",
            "author": {"name": "Author", "email": "author@example.com"},
            "expected_target_sha": "preferred-guard",
            "expected_head_sha": "legacy-guard",
            "base_branch": "base",
            "target_is_ephemeral": False,
            "ephemeral": True,
            "base_is_ephemeral": False,
            "ephemeral_base": True,
        }
    )
    metadata = _base_metadata_from_options(normalized)

    assert metadata["expected_target_sha"] == "preferred-guard"
    assert metadata["target_is_ephemeral"] is False
    assert metadata["base_is_ephemeral"] is False
    assert "expected_head_sha" not in metadata
    assert "ephemeral" not in metadata
    assert "ephemeral_base" not in metadata

    legacy = _base_metadata_from_options(
        _normalize_commit_options(
            {
                "target_branch": "main",
                "commit_message": "message",
                "author": {"name": "Author", "email": "author@example.com"},
                "expected_head_sha": "legacy-guard",
                "base_branch": "base",
                "ephemeral": True,
                "ephemeral_base": True,
            }
        )
    )
    assert legacy["expected_target_sha"] == "legacy-guard"
    assert legacy["target_is_ephemeral"] is True
    assert legacy["base_is_ephemeral"] is True


@pytest.mark.parametrize(
    ("response_fields", "expected"),
    [
        ({"target_branch": "standard"}, "standard"),
        ({"branch": "legacy"}, "legacy"),
        ({"target_branch": "standard", "branch": "legacy"}, "standard"),
    ],
)
def test_commit_ref_update_response_aliases(response_fields: dict[str, str], expected: str) -> None:
    """Commit results prefer target_branch and populate its old alias."""
    ref_update = _build_commit_result(commit_ack(**response_fields))["ref_update"]
    assert (ref_update["target_branch"], ref_update["branch"]) == (expected, expected)


@pytest.mark.asyncio
async def test_read_requests_send_standard_query_names(git_storage_options: dict) -> None:
    """Read calls use standard query names and preferred values."""
    repo = make_storage(git_storage_options).repo(id="repo")

    get_commit_client = client_for("get", response({"commit": commit_info()}))
    with patch("httpx.AsyncClient", return_value=get_commit_client):
        await repo.get_commit(ref="preferred", sha="legacy")
    params = parse_qs(
        urlparse(get_commit_client.__aenter__.return_value.get.call_args.args[0]).query
    )
    assert params == {"ref": ["preferred"]}

    list_client = client_for("get", response({"commits": [], "has_more": False}))
    with patch("httpx.AsyncClient", return_value=list_client):
        await repo.list_commits(ref="preferred", branch="legacy")
    params = parse_qs(urlparse(list_client.__aenter__.return_value.get.call_args.args[0]).query)
    assert params == {"ref": ["preferred"]}

    diff_client = client_for("get", response(diff_response(base_sha="base-sha")))
    with patch("httpx.AsyncClient", return_value=diff_client):
        await repo.get_commit_diff(
            ref="preferred",
            sha="legacy",
            base_ref="preferred-base",
            base_sha="legacy-base",
            ref_is_ephemeral=False,
            base_is_ephemeral=False,
            git_apply_compatible=True,
        )
    params = parse_qs(
        urlparse(diff_client.__aenter__.return_value.get.call_args.args[0]).query,
        keep_blank_values=True,
    )
    assert params == {
        "ref": ["preferred"],
        "base_ref": ["preferred-base"],
        "ref_is_ephemeral": ["false"],
        "base_is_ephemeral": ["false"],
        "git_apply_compatible": ["true"],
    }

    note_client = client_for(
        "get", response({"sha": "object-sha", "note": "note", "ref_sha": "notes-sha"})
    )
    with patch("httpx.AsyncClient", return_value=note_client):
        await repo.get_note(
            object_ref="preferred-object",
            sha="legacy-object",
            notes_ref="preferred-notes",
            ref="legacy-notes",
        )
    params = parse_qs(urlparse(note_client.__aenter__.return_value.get.call_args.args[0]).query)
    assert params == {
        "object_ref": ["preferred-object"],
        "notes_ref": ["preferred-notes"],
    }


@pytest.mark.asyncio
async def test_write_requests_send_standard_body_names(git_storage_options: dict) -> None:
    """Write calls use standard body names and preferred values."""
    repo = make_storage(git_storage_options).repo(id="repo")

    merge_client = client_for("post", response(merge_response({"ref": "preferred"})))
    with patch("httpx.AsyncClient", return_value=merge_client):
        await repo.merge(
            source_ref="preferred",
            source_branch="legacy",
            target_branch="main",
            strategy="ff_only",
        )
    body = merge_client.__aenter__.return_value.post.call_args.kwargs["json"]
    assert body["source_ref"] == "preferred"
    assert "source_branch" not in body

    tag_client = client_for(
        "post", response({"name": "v1", "sha": "tag-sha", "message": "created"})
    )
    with patch("httpx.AsyncClient", return_value=tag_client):
        await repo.create_tag(name="v1", ref="preferred", target="legacy")
    assert tag_client.__aenter__.return_value.post.call_args.kwargs["json"] == {
        "name": "v1",
        "ref": "preferred",
    }

    delete_client = client_for(
        "request",
        response({"target_branch": "preferred", "ephemeral": False, "message": "deleted"}),
    )
    with patch("httpx.AsyncClient", return_value=delete_client):
        await repo.delete_branch(target_branch="preferred", name="legacy")
    assert delete_client.__aenter__.return_value.request.call_args.kwargs["json"] == {
        "target_branch": "preferred",
    }

    note_client = client_for("post", response(note_response(notes_ref="preferred-notes")))
    with patch("httpx.AsyncClient", return_value=note_client):
        await repo.create_note(
            object_ref="preferred-object",
            sha="legacy-object",
            note="note",
            notes_ref="preferred-notes",
            ref="legacy-notes",
            expected_notes_ref_sha="preferred-guard",
            expected_ref_sha="legacy-guard",
        )
    body = note_client.__aenter__.return_value.post.call_args.kwargs["json"]
    assert body == {
        "object_ref": "preferred-object",
        "action": "add",
        "note": "note",
        "notes_ref": "preferred-notes",
        "expected_notes_ref_sha": "preferred-guard",
    }

    restore_client = client_for("post", response(restore_response(target_branch="main")))
    with patch("httpx.AsyncClient", return_value=restore_client):
        await repo.restore_commit(
            target_branch="main",
            base_ref="preferred-base",
            target_commit_sha="legacy-base",
            expected_target_sha="preferred-guard",
            expected_head_sha="legacy-guard",
            author={"name": "Author", "email": "author@example.com"},
        )
    metadata = restore_client.__aenter__.return_value.post.call_args.kwargs["json"]["metadata"]
    assert metadata["base_ref"] == "preferred-base"
    assert metadata["expected_target_sha"] == "preferred-guard"
    assert "target_commit_sha" not in metadata
    assert "expected_head_sha" not in metadata


@pytest.mark.asyncio
async def test_standard_only_responses_populate_result_aliases(
    git_storage_options: dict,
) -> None:
    """Standard response fields populate preferred and deprecated results."""
    storage = make_storage(git_storage_options)
    repo = storage.repo(id="repo")

    list_client = client_for(
        "get",
        response(
            {
                "repos": [
                    {
                        "repo_id": "repo-id",
                        "repo_name": "preferred-repo",
                        "default_branch": "main",
                        "created_at": "",
                    }
                ],
                "has_more": False,
            }
        ),
    )
    with patch("httpx.AsyncClient", return_value=list_client):
        listed = (await storage.list_repos())["repos"][0]
    assert (listed["repo_name"], listed["url"]) == ("preferred-repo", "preferred-repo")

    diff_client = client_for("get", response(diff_response(base_sha="base-sha")))
    with patch("httpx.AsyncClient", return_value=diff_client):
        assert (await repo.get_commit_diff(ref="main"))["base_sha"] == "base-sha"

    delete_client = client_for(
        "request",
        response({"target_branch": "preferred-branch", "ephemeral": False, "message": "deleted"}),
    )
    with patch("httpx.AsyncClient", return_value=delete_client):
        deleted = await repo.delete_branch(target_branch="main")
    assert (deleted["target_branch"], deleted["name"]) == (
        "preferred-branch",
        "preferred-branch",
    )

    merge_client = client_for("post", response(merge_response({"ref": "preferred-source"})))
    with patch("httpx.AsyncClient", return_value=merge_client):
        merged = await repo.merge(source_ref="source", target_branch="main", strategy="ff_only")
    assert (merged["source"]["ref"], merged["source"]["branch"]) == (
        "preferred-source",
        "preferred-source",
    )

    note_client = client_for("post", response(note_response(notes_ref="preferred-notes")))
    with patch("httpx.AsyncClient", return_value=note_client):
        note = await repo.create_note(object_ref="object", note="note")
    assert (note["notes_ref"], note["target_ref"]) == (
        "preferred-notes",
        "preferred-notes",
    )


@pytest.mark.asyncio
async def test_deprecated_only_responses_remain_supported(git_storage_options: dict) -> None:
    """Deprecated response fields remain valid for an older cluster."""
    storage = make_storage(git_storage_options)
    repo = storage.repo(id="repo")

    list_client = client_for(
        "get",
        response(
            {
                "repos": [
                    {
                        "repo_id": "repo-id",
                        "url": "legacy-repo",
                        "default_branch": "main",
                        "created_at": "",
                    }
                ],
                "has_more": False,
            }
        ),
    )
    with patch("httpx.AsyncClient", return_value=list_client):
        assert (await storage.list_repos())["repos"][0]["repo_name"] == "legacy-repo"

    delete_client = client_for(
        "request", response({"name": "legacy-branch", "ephemeral": False, "message": "deleted"})
    )
    with patch("httpx.AsyncClient", return_value=delete_client):
        assert (await repo.delete_branch(target_branch="main"))["target_branch"] == "legacy-branch"

    merge_client = client_for("post", response(merge_response({"branch": "legacy-source"})))
    with patch("httpx.AsyncClient", return_value=merge_client):
        merged = await repo.merge(source_ref="source", target_branch="main", strategy="ff_only")
    assert merged["source"]["ref"] == "legacy-source"

    note_client = client_for("post", response(note_response(target_ref="legacy-notes")))
    with patch("httpx.AsyncClient", return_value=note_client):
        assert (await repo.create_note(object_ref="object", note="note"))["notes_ref"] == (
            "legacy-notes"
        )


@pytest.mark.asyncio
async def test_standard_response_fields_win_when_both_names_differ(
    git_storage_options: dict,
) -> None:
    """Standard response fields win and supply both result names."""
    storage = make_storage(git_storage_options)
    repo = storage.repo(id="repo")

    list_client = client_for(
        "get",
        response(
            {
                "repos": [
                    {
                        "repo_id": "repo-id",
                        "repo_name": "preferred-repo",
                        "url": "legacy-repo",
                        "default_branch": "main",
                        "created_at": "",
                    }
                ],
                "has_more": False,
            }
        ),
    )
    with patch("httpx.AsyncClient", return_value=list_client):
        listed = (await storage.list_repos())["repos"][0]
    assert (listed["repo_name"], listed["url"]) == ("preferred-repo", "preferred-repo")

    delete_client = client_for(
        "request",
        response(
            {
                "target_branch": "preferred-branch",
                "name": "legacy-branch",
                "ephemeral": False,
                "message": "deleted",
            }
        ),
    )
    with patch("httpx.AsyncClient", return_value=delete_client):
        deleted = await repo.delete_branch(target_branch="main")
    assert (deleted["target_branch"], deleted["name"]) == (
        "preferred-branch",
        "preferred-branch",
    )

    merge_client = client_for(
        "post",
        response(merge_response({"ref": "preferred-source", "branch": "legacy-source"})),
    )
    with patch("httpx.AsyncClient", return_value=merge_client):
        merged = await repo.merge(source_ref="source", target_branch="main", strategy="ff_only")
    assert (merged["source"]["ref"], merged["source"]["branch"]) == (
        "preferred-source",
        "preferred-source",
    )

    note_client = client_for(
        "post",
        response(note_response(notes_ref="preferred-notes", target_ref="legacy-notes")),
    )
    with patch("httpx.AsyncClient", return_value=note_client):
        note = await repo.create_note(object_ref="object", note="note")
    assert (note["notes_ref"], note["target_ref"]) == (
        "preferred-notes",
        "preferred-notes",
    )
