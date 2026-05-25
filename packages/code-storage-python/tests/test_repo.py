"""Tests for Repo operations."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from urllib.parse import parse_qs, urlparse

import jwt
import pytest

from pierre_storage import GitStorage
from pierre_storage.errors import ApiError, RefUpdateError
from pierre_storage.version import get_user_agent


class TestRepoFileOperations:
    """Tests for file operations."""

    @pytest.mark.asyncio
    async def test_get_file_stream(self, git_storage_options: dict) -> None:
        """Test getting file stream."""
        storage = GitStorage(git_storage_options)

        # Mock repo creation
        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        # Mock file stream response
        file_response = MagicMock()
        file_response.status_code = 200
        file_response.is_success = True
        file_response.raise_for_status = MagicMock()
        file_response.aclose = AsyncMock()

        with patch("httpx.AsyncClient") as mock_client_cls:
            create_client = MagicMock()
            create_client.__aenter__.return_value.post = AsyncMock(return_value=create_response)
            create_client.__aexit__.return_value = False

            stream_client = MagicMock()
            stream_context = MagicMock()
            stream_context.__aenter__ = AsyncMock(return_value=file_response)
            stream_context.__aexit__ = AsyncMock(return_value=False)
            stream_client.stream = MagicMock(return_value=stream_context)
            stream_client.aclose = AsyncMock()

            mock_client_cls.side_effect = [create_client, stream_client]

            repo = await storage.create_repo(id="test-repo")
            response = await repo.get_file_stream(path="README.md", ref="main")

            assert response is not None
            assert response.status_code == 200
            await response.aclose()
            stream_client.stream.assert_called_once()
            file_response.aclose.assert_awaited_once()
            stream_client.aclose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_file_stream_actual_streaming(self, git_storage_options: dict) -> None:
        """Test that file streaming actually works with aiter_bytes."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        # Mock a streaming response with actual content
        file_response = MagicMock()
        file_response.status_code = 200
        file_response.is_success = True
        file_response.raise_for_status = MagicMock()
        file_response.aclose = AsyncMock()

        # Mock the async iteration over bytes
        async def mock_aiter_bytes():
            yield b"Hello, "
            yield b"world!"

        file_response.aiter_bytes = mock_aiter_bytes

        with patch("httpx.AsyncClient") as mock_client_cls:
            create_client = MagicMock()
            create_client.__aenter__.return_value.post = AsyncMock(return_value=create_response)
            create_client.__aexit__.return_value = False

            stream_client = MagicMock()
            stream_context = MagicMock()
            stream_context.__aenter__ = AsyncMock(return_value=file_response)
            stream_context.__aexit__ = AsyncMock(return_value=False)
            stream_client.stream = MagicMock(return_value=stream_context)
            stream_client.aclose = AsyncMock()

            mock_client_cls.side_effect = [create_client, stream_client]

            repo = await storage.create_repo(id="test-repo")
            response = await repo.get_file_stream(path="README.md", ref="main")

            # Actually consume the stream
            chunks = []
            async for chunk in response.aiter_bytes():
                chunks.append(chunk)

            content = b"".join(chunks)
            assert content == b"Hello, world!"
            assert response.status_code == 200

            await response.aclose()
            stream_client.stream.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_file_stream_ephemeral_flag(self, git_storage_options: dict) -> None:
        """Ensure ephemeral flag propagates to file requests."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        file_response = MagicMock()
        file_response.status_code = 200
        file_response.is_success = True
        file_response.raise_for_status = MagicMock()
        file_response.aclose = AsyncMock()

        with patch("httpx.AsyncClient") as mock_client_cls:
            create_client = MagicMock()
            create_client.__aenter__.return_value.post = AsyncMock(return_value=create_response)
            create_client.__aexit__.return_value = False

            stream_client = MagicMock()
            stream_context = MagicMock()
            stream_context.__aenter__ = AsyncMock(return_value=file_response)
            stream_context.__aexit__ = AsyncMock(return_value=False)
            stream_client.stream = MagicMock(return_value=stream_context)
            stream_client.aclose = AsyncMock()

            mock_client_cls.side_effect = [create_client, stream_client]

            repo = await storage.create_repo(id="test-repo")
            response = await repo.get_file_stream(
                path="README.md",
                ref="feature/demo",
                ephemeral=True,
            )

            assert response.status_code == 200
            called_url = stream_client.stream.call_args.args[1]
            parsed = urlparse(called_url)
            params = parse_qs(parsed.query)
            assert params.get("ephemeral") == ["true"]
            assert params.get("ref") == ["feature/demo"]

            await response.aclose()
            stream_client.stream.assert_called_once()
            file_response.aclose.assert_awaited_once()
            stream_client.aclose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_archive_stream(self, git_storage_options: dict) -> None:
        """Ensure archive requests include filters and prefix."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        archive_response = MagicMock()
        archive_response.status_code = 200
        archive_response.is_success = True
        archive_response.raise_for_status = MagicMock()
        archive_response.aclose = AsyncMock()

        with patch("httpx.AsyncClient") as mock_client_cls:
            create_client = MagicMock()
            create_client.__aenter__.return_value.post = AsyncMock(return_value=create_response)
            create_client.__aexit__.return_value = False

            stream_client = MagicMock()
            stream_context = MagicMock()
            stream_context.__aenter__ = AsyncMock(return_value=archive_response)
            stream_context.__aexit__ = AsyncMock(return_value=False)
            stream_client.stream = MagicMock(return_value=stream_context)
            stream_client.aclose = AsyncMock()

            mock_client_cls.side_effect = [create_client, stream_client]

            repo = await storage.create_repo(id="test-repo")
            response = await repo.get_archive_stream(
                ref="main",
                include_globs=["README.md"],
                exclude_globs=["vendor/**"],
                max_blob_size=1024,
                archive_prefix="repo/",
            )

            assert response.status_code == 200
            assert stream_client.stream.call_args.args[0] == "POST"
            called_url = stream_client.stream.call_args.args[1]
            parsed = urlparse(called_url)
            assert parsed.path.endswith("/repos/archive")
            payload = stream_client.stream.call_args.kwargs["json"]
            assert payload == {
                "ref": "main",
                "include_globs": ["README.md"],
                "exclude_globs": ["vendor/**"],
                "max_blob_size": 1024,
                "archive": {"prefix": "repo/"},
            }

            await response.aclose()
            stream_client.stream.assert_called_once()
            archive_response.aclose.assert_awaited_once()
            stream_client.aclose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_list_files(self, git_storage_options: dict) -> None:
        """Test listing files in repository."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        list_response = MagicMock()
        list_response.status_code = 200
        list_response.is_success = True
        list_response.json.return_value = {
            "paths": ["README.md", "src/main.py", "package.json"],
            "ref": "main",
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=create_response
            )
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=list_response
            )

            repo = await storage.create_repo(id="test-repo")
            result = await repo.list_files(ref="main")

            assert result is not None
            assert "paths" in result
            assert len(result["paths"]) == 3
            assert "README.md" in result["paths"]

    @pytest.mark.asyncio
    async def test_list_files_ephemeral_flag(self, git_storage_options: dict) -> None:
        """Ensure ephemeral flag propagates to list files."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        list_response = MagicMock()
        list_response.status_code = 200
        list_response.is_success = True
        list_response.json.return_value = {
            "paths": ["README.md"],
            "ref": "refs/namespaces/ephemeral/refs/heads/feature/demo",
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            client_instance.get = AsyncMock(return_value=list_response)

            repo = await storage.create_repo(id="test-repo")
            result = await repo.list_files(ref="feature/demo", ephemeral=True)

            assert result["paths"] == ["README.md"]
            assert result["ref"] == "refs/namespaces/ephemeral/refs/heads/feature/demo"
            called_url = client_instance.get.call_args.args[0]
            parsed = urlparse(called_url)
            params = parse_qs(parsed.query)
            assert params.get("ephemeral") == ["true"]
            assert params.get("ref") == ["feature/demo"]

    @pytest.mark.asyncio
    async def test_list_files_subtree_and_pagination(self, git_storage_options: dict) -> None:
        """path/recursive/cursor/limit reach the wire; entries+pagination parsed."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        list_response = MagicMock()
        list_response.status_code = 200
        list_response.is_success = True
        list_response.json.return_value = {
            "paths": ["docs/guide.md"],
            "ref": "main",
            "entries": [
                {"path": "docs/sub", "type": "tree", "mode": "040000"},
                {"path": "docs/guide.md", "type": "blob", "mode": "100644"},
            ],
            "next_cursor": "docs/zz",
            "has_more": True,
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            client_instance.get = AsyncMock(return_value=list_response)

            repo = await storage.create_repo(id="test-repo")
            result = await repo.list_files(
                ref="main",
                path="docs",
                recursive=False,
                cursor="docs/a.md",
                limit=50,
            )

            assert result["paths"] == ["docs/guide.md"]
            assert result["entries"] == [
                {"path": "docs/sub", "type": "tree", "mode": "040000"},
                {"path": "docs/guide.md", "type": "blob", "mode": "100644"},
            ]
            assert result["next_cursor"] == "docs/zz"
            assert result["has_more"] is True

            called_url = client_instance.get.call_args.args[0]
            params = parse_qs(urlparse(called_url).query)
            assert params.get("path") == ["docs"]
            assert params.get("recursive") == ["false"]
            assert params.get("cursor") == ["docs/a.md"]
            assert params.get("limit") == ["50"]

    @pytest.mark.asyncio
    async def test_list_files_legacy_response_defaults(
        self, git_storage_options: dict
    ) -> None:
        """Servers without entries/has_more still produce a valid result."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        list_response = MagicMock()
        list_response.status_code = 200
        list_response.is_success = True
        list_response.json.return_value = {"paths": ["README.md"], "ref": "main"}

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            client_instance.get = AsyncMock(return_value=list_response)

            repo = await storage.create_repo(id="test-repo")
            result = await repo.list_files()
            assert result["paths"] == ["README.md"]
            assert result["entries"] == []
            assert result["has_more"] is False
            assert "next_cursor" not in result

    @pytest.mark.asyncio
    async def test_head_file_parses_response_headers(
        self, git_storage_options: dict
    ) -> None:
        """head_file issues HEAD and returns parsed FileMetadata."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        head_response = MagicMock()
        head_response.status_code = 200
        head_response.is_success = True
        head_response.headers = {
            "x-blob-sha": "b10b5ha",
            "x-last-commit-sha": "c0mm1tsha",
            "content-length": "128",
            "etag": '"b10b5ha"',
            "last-modified": "Wed, 21 Oct 2026 07:28:00 GMT",
            "accept-ranges": "bytes",
            "content-type": "application/octet-stream",
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            client_instance.head = AsyncMock(return_value=head_response)

            repo = await storage.create_repo(id="test-repo")
            meta = await repo.head_file(path="README.md")

            assert meta["blob_sha"] == "b10b5ha"
            assert meta["last_commit_sha"] == "c0mm1tsha"
            assert meta["size"] == 128
            assert meta["etag"] == '"b10b5ha"'
            assert meta["accept_ranges"] == "bytes"
            assert meta["content_type"] == "application/octet-stream"
            assert meta["raw_last_modified"] == "Wed, 21 Oct 2026 07:28:00 GMT"
            assert isinstance(meta["last_modified"], datetime)

            called_url = client_instance.head.call_args.args[0]
            assert urlparse(called_url).path.endswith("/repos/file")
            assert parse_qs(urlparse(called_url).query).get("path") == ["README.md"]

    @pytest.mark.asyncio
    async def test_get_file_stream_forwards_conditional_headers(
        self, git_storage_options: dict
    ) -> None:
        """get_file_stream passes Range/If-* headers through to the server."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        stream_response = MagicMock()
        stream_response.status_code = 206
        stream_response.is_success = True
        stream_response.raise_for_status = MagicMock()

        stream_cm = MagicMock()
        stream_cm.__aenter__ = AsyncMock(return_value=stream_response)
        stream_cm.__aexit__ = AsyncMock(return_value=None)

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value
            # post() runs under `async with` context for create_repo
            client_instance.__aenter__.return_value.post = AsyncMock(
                return_value=create_response
            )
            # stream() is called on the long-lived client used by get_file_stream
            client_instance.stream = MagicMock(return_value=stream_cm)
            client_instance.aclose = AsyncMock()

            repo = await storage.create_repo(id="test-repo")
            result = await repo.get_file_stream(
                path="README.md",
                headers={
                    "range": "bytes=0-15",
                    "if_none_match": '"abc"',
                    "if_modified_since": "Wed, 21 Oct 2026 07:28:00 GMT",
                },
            )
            assert result.status_code == 206

            stream_args = client_instance.stream.call_args
            assert stream_args.args[0] == "GET"
            sent_headers = stream_args.kwargs["headers"]
            assert sent_headers["Range"] == "bytes=0-15"
            assert sent_headers["If-None-Match"] == '"abc"'
            assert sent_headers["If-Modified-Since"] == "Wed, 21 Oct 2026 07:28:00 GMT"

    @pytest.mark.asyncio
    async def test_list_files_with_metadata_ephemeral_flag(self, git_storage_options: dict) -> None:
        """Ensure ephemeral flag propagates to list files with metadata."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        list_response = MagicMock()
        list_response.status_code = 200
        list_response.is_success = True
        list_response.json.return_value = {
            "files": [
                {
                    "path": "README.md",
                    "mode": "100644",
                    "size": 12,
                    "last_commit_sha": "deadbeef",
                }
            ],
            "commits": {
                "deadbeef": {
                    "author": "Test User",
                    "date": "2026-02-19T12:00:00Z",
                    "message": "initial commit",
                }
            },
            "ref": "refs/namespaces/ephemeral/refs/heads/feature/demo",
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            client_instance.get = AsyncMock(return_value=list_response)

            repo = await storage.create_repo(id="test-repo")
            result = await repo.list_files_with_metadata(ref="feature/demo", ephemeral=True)

            assert result["files"][0]["path"] == "README.md"
            assert result["files"][0]["mode"] == "100644"
            assert result["files"][0]["size"] == 12
            assert result["files"][0]["last_commit_sha"] == "deadbeef"
            assert result["commits"]["deadbeef"]["author"] == "Test User"
            assert result["commits"]["deadbeef"]["raw_date"] == "2026-02-19T12:00:00Z"
            assert result["commits"]["deadbeef"]["message"] == "initial commit"
            assert isinstance(result["commits"]["deadbeef"]["date"], datetime)
            assert result["ref"] == "refs/namespaces/ephemeral/refs/heads/feature/demo"

            called_url = client_instance.get.call_args.args[0]
            parsed = urlparse(called_url)
            params = parse_qs(parsed.query)
            assert parsed.path.endswith("/repos/files/metadata")
            assert params.get("ephemeral") == ["true"]
            assert params.get("ref") == ["feature/demo"]

    @pytest.mark.asyncio
    async def test_list_files_with_metadata_invalid_commit_date_fallback(
        self, git_storage_options: dict
    ) -> None:
        """Ensure invalid commit dates do not fail metadata listing."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        list_response = MagicMock()
        list_response.status_code = 200
        list_response.is_success = True
        list_response.json.return_value = {
            "files": [
                {
                    "path": "README.md",
                    "mode": "100644",
                    "size": 12,
                    "last_commit_sha": "deadbeef",
                }
            ],
            "commits": {
                "deadbeef": {
                    "author": "Test User",
                    "date": "not-a-date",
                    "message": "initial commit",
                }
            },
            "ref": "main",
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            client_instance.get = AsyncMock(return_value=list_response)

            repo = await storage.create_repo(id="test-repo")
            result = await repo.list_files_with_metadata()

            assert result["commits"]["deadbeef"]["raw_date"] == "not-a-date"
            assert result["commits"]["deadbeef"]["date"] == datetime.min.replace(
                tzinfo=timezone.utc
            )

    @pytest.mark.asyncio
    async def test_list_files_with_metadata_custom_ttl(self, git_storage_options: dict) -> None:
        """Ensure custom TTL propagates to list files with metadata JWT."""
        storage = GitStorage(git_storage_options)
        custom_ttl = 900

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        list_response = MagicMock()
        list_response.status_code = 200
        list_response.is_success = True
        list_response.json.return_value = {
            "files": [],
            "commits": {},
            "ref": "main",
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            client_instance.get = AsyncMock(return_value=list_response)

            repo = await storage.create_repo(id="test-repo")
            await repo.list_files_with_metadata(ttl=custom_ttl)

            _, kwargs = client_instance.get.call_args
            headers = kwargs["headers"]
            token = headers["Authorization"].replace("Bearer ", "")
            payload = jwt.decode(token, options={"verify_signature": False})
            assert payload["exp"] - payload["iat"] == custom_ttl

    @pytest.mark.asyncio
    async def test_grep_posts_body_and_parses_response(self, git_storage_options: dict) -> None:
        """Test grep request body and response parsing."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        grep_response = MagicMock()
        grep_response.status_code = 200
        grep_response.is_success = True
        grep_response.raise_for_status = MagicMock()
        grep_response.json.return_value = {
            "query": {"pattern": "SEARCHME", "case_sensitive": False},
            "repo": {"ref": "main", "commit": "deadbeef"},
            "matches": [
                {
                    "path": "src/a.ts",
                    "lines": [{"line_number": 12, "text": "SEARCHME", "type": "match"}],
                }
            ],
            "next_cursor": None,
            "has_more": False,
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(side_effect=[create_response, grep_response])

            repo = await storage.create_repo(id="test-repo")
            result = await repo.grep(
                pattern="SEARCHME",
                ref="main",
                paths=["src/"],
                case_sensitive=False,
                file_filters={"include_globs": ["**/*.ts"], "exclude_globs": ["**/vendor/**"]},
                context={"before": 1, "after": 2},
                limits={"max_lines": 5, "max_matches_per_file": 7},
                pagination={"cursor": "abc", "limit": 3},
            )

            assert result["query"]["pattern"] == "SEARCHME"
            assert result["query"]["case_sensitive"] is False
            assert result["repo"]["ref"] == "main"
            assert result["repo"]["commit"] == "deadbeef"
            assert result["matches"][0]["path"] == "src/a.ts"
            assert result["matches"][0]["lines"][0]["line_number"] == 12
            assert result["matches"][0]["lines"][0]["text"] == "SEARCHME"
            assert result["next_cursor"] is None
            assert result["has_more"] is False

            _, kwargs = client_instance.post.call_args
            assert kwargs["json"]["ref"] == "main"
            assert kwargs["json"]["paths"] == ["src/"]
            assert kwargs["json"]["query"] == {"pattern": "SEARCHME", "case_sensitive": False}
            assert kwargs["json"]["file_filters"] == {
                "include_globs": ["**/*.ts"],
                "exclude_globs": ["**/vendor/**"],
            }
            assert kwargs["json"]["context"] == {"before": 1, "after": 2}
            assert kwargs["json"]["limits"] == {"max_lines": 5, "max_matches_per_file": 7}
            assert kwargs["json"]["pagination"] == {"cursor": "abc", "limit": 3}

    @pytest.mark.asyncio
    async def test_grep_legacy_rev(self, git_storage_options: dict) -> None:
        """Test grep legacy rev option maps to ref."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        grep_response = MagicMock()
        grep_response.status_code = 200
        grep_response.is_success = True
        grep_response.raise_for_status = MagicMock()
        grep_response.json.return_value = {
            "query": {"pattern": "SEARCHME", "case_sensitive": False},
            "repo": {"ref": "main", "commit": "deadbeef"},
            "matches": [],
            "next_cursor": None,
            "has_more": False,
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(side_effect=[create_response, grep_response])

            repo = await storage.create_repo(id="test-repo")
            result = await repo.grep(
                pattern="SEARCHME",
                rev="main",
            )

            assert result["repo"]["ref"] == "main"

            _, kwargs = client_instance.post.call_args
            assert kwargs["json"]["ref"] == "main"
            assert "rev" not in kwargs["json"]

    @pytest.mark.asyncio
    async def test_grep_ephemeral_in_body(self, git_storage_options: dict) -> None:
        """grep ephemeral=True must surface as body['ephemeral']=True."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        grep_response = MagicMock()
        grep_response.status_code = 200
        grep_response.is_success = True
        grep_response.raise_for_status = MagicMock()
        grep_response.json.return_value = {
            "query": {"pattern": "SEARCHME", "case_sensitive": True},
            "repo": {"ref": "feature", "commit": "deadbeef"},
            "matches": [],
            "next_cursor": None,
            "has_more": False,
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(side_effect=[create_response, grep_response])

            repo = await storage.create_repo(id="test-repo")
            await repo.grep(pattern="SEARCHME", ref="feature", ephemeral=True)

            _, kwargs = client_instance.post.call_args
            assert kwargs["json"]["ephemeral"] is True
            assert kwargs["json"]["ref"] == "feature"


class TestRepoBranchOperations:
    """Tests for branch operations."""

    @pytest.mark.asyncio
    async def test_list_branches(self, git_storage_options: dict) -> None:
        """Test listing branches."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        branches_response = MagicMock()
        branches_response.status_code = 200
        branches_response.is_success = True
        branches_response.json.return_value = {
            "branches": [
                {
                    "cursor": "c1",
                    "name": "main",
                    "head_sha": "abc123",
                    "created_at": "2025-01-01T00:00:00Z",
                },
                {
                    "cursor": "c2",
                    "name": "develop",
                    "head_sha": "def456",
                    "created_at": "2025-01-02T00:00:00Z",
                },
            ],
            "next_cursor": None,
            "has_more": False,
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=create_response
            )
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=branches_response
            )

            repo = await storage.create_repo(id="test-repo")
            result = await repo.list_branches(limit=10)

            assert result is not None
            assert "branches" in result
            assert len(result["branches"]) == 2
            assert result["branches"][0]["name"] == "main"

    @pytest.mark.asyncio
    async def test_list_branches_with_pagination(self, git_storage_options: dict) -> None:
        """Test listing branches with pagination cursor."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        branches_response = MagicMock()
        branches_response.status_code = 200
        branches_response.is_success = True
        branches_response.json.return_value = {
            "branches": [
                {
                    "cursor": "c3",
                    "name": "feature-1",
                    "head_sha": "ghi789",
                    "created_at": "2025-01-03T00:00:00Z",
                }
            ],
            "next_cursor": "next-page-token",
            "has_more": True,
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=create_response
            )
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=branches_response
            )

            repo = await storage.create_repo(id="test-repo")
            result = await repo.list_branches(limit=1, cursor="some-cursor")

            assert result is not None
            assert result["next_cursor"] == "next-page-token"
            assert result["has_more"] is True

    @pytest.mark.asyncio
    async def test_list_branches_ephemeral_query_param(
        self, git_storage_options: dict
    ) -> None:
        """ephemeral=True must surface as ephemeral=true in the query string."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        branches_response = MagicMock()
        branches_response.status_code = 200
        branches_response.is_success = True
        branches_response.json.return_value = {
            "branches": [],
            "next_cursor": None,
            "has_more": False,
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=create_response
            )
            mock_get = AsyncMock(return_value=branches_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            repo = await storage.create_repo(id="test-repo")
            await repo.list_branches(ephemeral=True)

            called_url = mock_get.await_args.args[0]
            assert "ephemeral=true" in called_url

    @pytest.mark.asyncio
    async def test_create_branch_prefers_base_ref(self, git_storage_options: dict) -> None:
        """Test creating a branch prefers the new base_ref payload."""
        storage = GitStorage(git_storage_options)

        create_repo_response = MagicMock()
        create_repo_response.status_code = 200
        create_repo_response.is_success = True
        create_repo_response.json.return_value = {"repo_id": "test-repo"}

        create_branch_response = MagicMock()
        create_branch_response.status_code = 200
        create_branch_response.is_success = True
        create_branch_response.json.return_value = {
            "message": "branch created",
            "target_branch": "feature/demo",
            "target_is_ephemeral": True,
            "commit_sha": "abc123",
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(
                side_effect=[create_repo_response, create_branch_response]
            )

            repo = await storage.create_repo(id="test-repo")
            result = await repo.create_branch(
                base_ref="main",
                target_branch="feature/demo",
                target_is_ephemeral=True,
            )

            assert result["message"] == "branch created"
            assert result["target_branch"] == "feature/demo"
            assert result["target_is_ephemeral"] is True
            assert result["commit_sha"] == "abc123"

            assert client_instance.post.await_count == 2
            branch_call = client_instance.post.await_args_list[1]
            assert branch_call.args[0].endswith("/api/v1/repos/branches/create")
            payload = branch_call.kwargs["json"]
            assert payload["base_ref"] == "main"
            assert "base_branch" not in payload
            assert payload["target_branch"] == "feature/demo"
            assert payload["target_is_ephemeral"] is True


    @pytest.mark.asyncio
    async def test_merge_posts_body_and_parses_response(self, git_storage_options: dict) -> None:
        """Test merging branches posts the expected body and parses the response."""
        storage = GitStorage(git_storage_options)

        create_repo_response = MagicMock()
        create_repo_response.status_code = 200
        create_repo_response.is_success = True
        create_repo_response.json.return_value = {"repo_id": "test-repo"}

        merge_response = MagicMock()
        merge_response.status_code = 200
        merge_response.is_success = True
        merge_response.json.return_value = {
            "result": "merge_commit",
            "commit_sha": "merge123",
            "tree_sha": "tree123",
            "source": {"branch": "feature", "ephemeral": True, "sha": "source123"},
            "target": {
                "branch": "main",
                "ephemeral": False,
                "old_sha": "old123",
                "new_sha": "merge123",
            },
            "merge_base_sha": "base123",
            "promoted_commits": 2,
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(side_effect=[create_repo_response, merge_response])

            repo = await storage.create_repo(id="test-repo")
            result = await repo.merge(
                source_branch=" feature ",
                source_is_ephemeral=True,
                target_branch=" main ",
                target_is_ephemeral=False,
                expected_target_sha=" old123 ",
                commit_message=" merge feature ",
                author={"name": " Bot ", "email": " bot@example.com "},
                committer={"name": " Commit Bot ", "email": " commit@example.com "},
                strategy="merge",
                allow_unrelated_histories=False,
                ttl=900,
            )

            assert result == {
                "result": "merge_commit",
                "commit_sha": "merge123",
                "tree_sha": "tree123",
                "source": {"branch": "feature", "ephemeral": True, "sha": "source123"},
                "target": {
                    "branch": "main",
                    "ephemeral": False,
                    "old_sha": "old123",
                    "new_sha": "merge123",
                },
                "merge_base_sha": "base123",
                "promoted_commits": 2,
            }

            assert client_instance.post.await_count == 2
            merge_call = client_instance.post.await_args_list[1]
            assert merge_call.args[0].endswith("/api/v1/repos/merge")
            assert merge_call.kwargs["json"] == {
                "source_branch": "feature",
                "source_is_ephemeral": True,
                "target_branch": "main",
                "target_is_ephemeral": False,
                "expected_target_sha": "old123",
                "commit_message": "merge feature",
                "author": {"name": "Bot", "email": "bot@example.com"},
                "committer": {"name": "Commit Bot", "email": "commit@example.com"},
                "strategy": "merge",
                "allow_unrelated_histories": False,
            }
            headers = merge_call.kwargs["headers"]
            token = headers["Authorization"].replace("Bearer ", "")
            payload = jwt.decode(token, options={"verify_signature": False})
            assert payload["scopes"] == ["git:write"]
            assert payload["exp"] - payload["iat"] == 900

    @pytest.mark.asyncio
    async def test_merge_omits_blank_optional_fields(self, git_storage_options: dict) -> None:
        """Blank optional merge fields should be omitted from the request body."""
        storage = GitStorage(git_storage_options)

        create_repo_response = MagicMock()
        create_repo_response.status_code = 200
        create_repo_response.is_success = True
        create_repo_response.json.return_value = {"repo_id": "test-repo"}

        merge_response = MagicMock()
        merge_response.status_code = 200
        merge_response.is_success = True
        merge_response.json.return_value = {
            "result": "fast_forward",
            "commit_sha": "ff123",
            "tree_sha": "tree123",
            "source": {"branch": "feature", "ephemeral": False, "sha": "ff123"},
            "target": {
                "branch": "main",
                "ephemeral": False,
                "old_sha": "old123",
                "new_sha": "ff123",
            },
            "promoted_commits": 1,
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(side_effect=[create_repo_response, merge_response])

            repo = await storage.create_repo(id="test-repo")
            result = await repo.merge(
                source_branch="feature",
                target_branch="main",
                strategy="ff_prefer",
                expected_target_sha=" ",
                commit_message=None,
            )

            assert "merge_base_sha" not in result
            payload = client_instance.post.await_args_list[1].kwargs["json"]
            assert payload == {
                "source_branch": "feature",
                "target_branch": "main",
                "strategy": "ff_prefer",
            }

    @pytest.mark.asyncio
    async def test_merge_conflict_keeps_response_body(self, git_storage_options: dict) -> None:
        """Merge conflicts should surface the API error and retain the response body."""
        storage = GitStorage(git_storage_options)

        create_repo_response = MagicMock()
        create_repo_response.status_code = 200
        create_repo_response.is_success = True
        create_repo_response.json.return_value = {"repo_id": "test-repo"}

        conflict_body = {
            "error": "merge conflict",
            "conflict_paths": ["README.md"],
            "merge_base_sha": "base123",
        }
        merge_response = MagicMock()
        merge_response.status_code = 409
        merge_response.is_success = False
        merge_response.json.return_value = conflict_body

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(side_effect=[create_repo_response, merge_response])

            repo = await storage.create_repo(id="test-repo")

            with pytest.raises(ApiError, match="merge conflict") as exc_info:
                await repo.merge(source_branch="feature", target_branch="main", strategy="merge")

            assert exc_info.value.status_code == 409
            assert exc_info.value.response is merge_response
            assert exc_info.value.response.json() == conflict_body

    @pytest.mark.asyncio
    async def test_merge_validation(self, git_storage_options: dict) -> None:
        """Test merge validates required fields and optional signatures locally."""
        storage = GitStorage(git_storage_options)

        create_repo_response = MagicMock()
        create_repo_response.status_code = 200
        create_repo_response.is_success = True
        create_repo_response.json.return_value = {"repo_id": "test-repo"}

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_repo_response)

            repo = await storage.create_repo(id="test-repo")

            with pytest.raises(ValueError, match="source_branch is required"):
                await repo.merge(source_branch=" ", target_branch="main", strategy="merge")

            with pytest.raises(ValueError, match="target_branch is required"):
                await repo.merge(source_branch="feature", target_branch=" ", strategy="merge")

            with pytest.raises(ValueError, match="strategy is required"):
                await repo.merge(source_branch="feature", target_branch="main", strategy=" ")

            with pytest.raises(ValueError, match="strategy must be one of merge, ff_only, ff_prefer"):
                await repo.merge(source_branch="feature", target_branch="main", strategy="squash")

            with pytest.raises(ValueError, match="author name and email are required"):
                await repo.merge(
                    source_branch="feature",
                    target_branch="main",
                    strategy="merge",
                    author={"name": "Bot", "email": " "},
                )

            with pytest.raises(ValueError, match="committer name and email are required"):
                await repo.merge(
                    source_branch="feature",
                    target_branch="main",
                    strategy="merge",
                    committer={"name": " ", "email": "bot@example.com"},
                )

            assert client_instance.post.await_count == 1
    @pytest.mark.asyncio
    async def test_create_branch_falls_back_to_deprecated_base_branch(
        self, git_storage_options: dict
    ) -> None:
        """Test create_branch still supports deprecated base_branch."""
        storage = GitStorage(git_storage_options)

        create_repo_response = MagicMock()
        create_repo_response.status_code = 200
        create_repo_response.is_success = True
        create_repo_response.json.return_value = {"repo_id": "test-repo"}

        create_branch_response = MagicMock()
        create_branch_response.status_code = 200
        create_branch_response.is_success = True
        create_branch_response.json.return_value = {
            "message": "branch created",
            "target_branch": "feature/demo",
            "target_is_ephemeral": False,
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(
                side_effect=[create_repo_response, create_branch_response]
            )

            repo = await storage.create_repo(id="test-repo")
            with pytest.warns(DeprecationWarning, match="base_branch is deprecated"):
                result = await repo.create_branch(
                    base_branch=" main ",
                    target_branch=" feature/demo ",
                )

            assert result["target_branch"] == "feature/demo"
            branch_call = client_instance.post.await_args_list[1]
            payload = branch_call.kwargs["json"]
            assert payload["base_branch"] == "main"
            assert "base_ref" not in payload
            assert payload["target_branch"] == "feature/demo"

    @pytest.mark.asyncio
    async def test_create_branch_prefers_base_ref_when_both_are_provided(
        self, git_storage_options: dict
    ) -> None:
        """Test create_branch prefers base_ref over deprecated base_branch."""
        storage = GitStorage(git_storage_options)

        create_repo_response = MagicMock()
        create_repo_response.status_code = 200
        create_repo_response.is_success = True
        create_repo_response.json.return_value = {"repo_id": "test-repo"}

        create_branch_response = MagicMock()
        create_branch_response.status_code = 200
        create_branch_response.is_success = True
        create_branch_response.json.return_value = {
            "message": "branch created",
            "target_branch": "feature/demo",
            "target_is_ephemeral": False,
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(
                side_effect=[create_repo_response, create_branch_response]
            )

            repo = await storage.create_repo(id="test-repo")
            with pytest.warns(DeprecationWarning, match="base_branch is deprecated"):
                await repo.create_branch(
                    base_ref="refs/tags/v1.2.3",
                    base_branch="main",
                    target_branch="feature/demo",
                )

            payload = client_instance.post.await_args_list[1].kwargs["json"]
            assert payload["base_ref"] == "refs/tags/v1.2.3"
            assert "base_branch" not in payload

    @pytest.mark.asyncio
    async def test_create_branch_blank_base_ref_falls_back_to_base_branch(
        self, git_storage_options: dict
    ) -> None:
        """Blank base_ref should be treated as missing after trimming."""
        storage = GitStorage(git_storage_options)

        create_repo_response = MagicMock()
        create_repo_response.status_code = 200
        create_repo_response.is_success = True
        create_repo_response.json.return_value = {"repo_id": "test-repo"}

        create_branch_response = MagicMock()
        create_branch_response.status_code = 200
        create_branch_response.is_success = True
        create_branch_response.json.return_value = {
            "message": "branch created",
            "target_branch": "feature/demo",
            "target_is_ephemeral": False,
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(
                side_effect=[create_repo_response, create_branch_response]
            )

            repo = await storage.create_repo(id="test-repo")
            with pytest.warns(DeprecationWarning, match="base_branch is deprecated"):
                await repo.create_branch(
                    base_ref="   ",
                    base_branch="main",
                    target_branch="feature/demo",
                )

            payload = client_instance.post.await_args_list[1].kwargs["json"]
            assert payload["base_branch"] == "main"
            assert "base_ref" not in payload

    @pytest.mark.asyncio
    async def test_create_branch_requires_effective_base(self, git_storage_options: dict) -> None:
        """create_branch requires a non-blank base_ref or base_branch."""
        storage = GitStorage(git_storage_options)

        create_repo_response = MagicMock()
        create_repo_response.status_code = 200
        create_repo_response.is_success = True
        create_repo_response.json.return_value = {"repo_id": "test-repo"}

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_repo_response)

            repo = await storage.create_repo(id="test-repo")

            with pytest.raises(ValueError, match="base_ref or base_branch is required"):
                await repo.create_branch(
                    base_ref="  ",
                    base_branch=" ",
                    target_branch="feature/demo",
                )

    @pytest.mark.asyncio
    async def test_create_branch_requires_target_branch(self, git_storage_options: dict) -> None:
        """create_branch still requires a non-blank target branch."""
        storage = GitStorage(git_storage_options)

        create_repo_response = MagicMock()
        create_repo_response.status_code = 200
        create_repo_response.is_success = True
        create_repo_response.json.return_value = {"repo_id": "test-repo"}

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_repo_response)

            repo = await storage.create_repo(id="test-repo")

            with pytest.raises(ValueError, match="target_branch is required"):
                await repo.create_branch(base_ref="main", target_branch="  ")

    @pytest.mark.asyncio
    async def test_promote_ephemeral_branch_defaults(self, git_storage_options: dict) -> None:
        """Test promoting an ephemeral branch with default target branch."""
        storage = GitStorage(git_storage_options)

        create_repo_response = MagicMock()
        create_repo_response.status_code = 200
        create_repo_response.is_success = True
        create_repo_response.json.return_value = {"repo_id": "test-repo"}

        promote_response = MagicMock()
        promote_response.status_code = 200
        promote_response.is_success = True
        promote_response.json.return_value = {
            "message": "branch promoted",
            "target_branch": "ephemeral/demo",
            "target_is_ephemeral": False,
            "commit_sha": "def456",
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(side_effect=[create_repo_response, promote_response])

            repo = await storage.create_repo(id="test-repo")
            result = await repo.promote_ephemeral_branch(base_branch="ephemeral/demo")

            assert result["message"] == "branch promoted"
            assert result["target_branch"] == "ephemeral/demo"
            assert result["target_is_ephemeral"] is False
            assert result["commit_sha"] == "def456"

            assert client_instance.post.await_count == 2
            branch_call = client_instance.post.await_args_list[1]
            assert branch_call.args[0].endswith("/api/v1/repos/branches/create")
            payload = branch_call.kwargs["json"]
            assert payload["base_ref"] == "ephemeral/demo"
            assert payload["target_branch"] == "ephemeral/demo"
            assert payload["base_is_ephemeral"] is True
            assert payload["target_is_ephemeral"] is False

    @pytest.mark.asyncio
    async def test_promote_ephemeral_branch_custom_target(
        self,
        git_storage_options: dict,
    ) -> None:
        """Test promoting an ephemeral branch to a custom target branch."""
        storage = GitStorage(git_storage_options)

        create_repo_response = MagicMock()
        create_repo_response.status_code = 200
        create_repo_response.is_success = True
        create_repo_response.json.return_value = {"repo_id": "test-repo"}

        promote_response = MagicMock()
        promote_response.status_code = 200
        promote_response.is_success = True
        promote_response.json.return_value = {
            "message": "branch promoted",
            "target_branch": "feature/final-demo",
            "target_is_ephemeral": False,
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(side_effect=[create_repo_response, promote_response])

            repo = await storage.create_repo(id="test-repo")
            result = await repo.promote_ephemeral_branch(
                base_branch="ephemeral/demo",
                target_branch="feature/final-demo",
            )

            assert result["target_branch"] == "feature/final-demo"
            assert result["target_is_ephemeral"] is False

            assert client_instance.post.await_count == 2
            branch_call = client_instance.post.await_args_list[1]
            payload = branch_call.kwargs["json"]
            assert payload["base_ref"] == "ephemeral/demo"
            assert payload["target_branch"] == "feature/final-demo"
            assert payload["base_is_ephemeral"] is True
            assert payload["target_is_ephemeral"] is False

    @pytest.mark.asyncio
    async def test_create_branch_conflict(self, git_storage_options: dict) -> None:
        """Test create_branch surfaces API errors."""
        storage = GitStorage(git_storage_options)

        create_repo_response = MagicMock()
        create_repo_response.status_code = 200
        create_repo_response.is_success = True
        create_repo_response.json.return_value = {"repo_id": "test-repo"}

        conflict_response = MagicMock()
        conflict_response.status_code = 409
        conflict_response.is_success = False
        conflict_response.json.return_value = {"message": "branch already exists"}

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(side_effect=[create_repo_response, conflict_response])

            repo = await storage.create_repo(id="test-repo")

            with pytest.raises(ApiError) as exc_info:
                await repo.create_branch(
                    base_ref="main",
                    target_branch="feature/demo",
                )

            assert exc_info.value.status_code == 409
            assert "branch already exists" in str(exc_info.value)


class TestRepoCommitOperations:
    """Tests for commit operations."""

    @pytest.mark.asyncio
    async def test_list_commits(self, git_storage_options: dict) -> None:
        """Test listing commits."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        commits_response = MagicMock()
        commits_response.status_code = 200
        commits_response.is_success = True
        commits_response.json.return_value = {
            "commits": [
                {
                    "sha": "abc123",
                    "message": "Initial commit",
                    "author_name": "Test User",
                    "author_email": "test@example.com",
                    "committer_name": "Test User",
                    "committer_email": "test@example.com",
                    "date": "2025-01-01T00:00:00Z",
                },
                {
                    "sha": "def456",
                    "message": "Second commit",
                    "author_name": "Test User",
                    "author_email": "test@example.com",
                    "committer_name": "Test User",
                    "committer_email": "test@example.com",
                    "date": "2025-01-02T00:00:00Z",
                },
            ],
            "next_cursor": None,
            "has_more": False,
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=create_response
            )
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=commits_response
            )

            repo = await storage.create_repo(id="test-repo")
            result = await repo.list_commits(branch="main", limit=10)

            assert result is not None
            assert "commits" in result
            assert len(result["commits"]) == 2
            assert result["commits"][0]["sha"] == "abc123"
            assert result["commits"][0]["message"] == "Initial commit"

    @pytest.mark.asyncio
    async def test_list_commits_ephemeral_query_param(
        self, git_storage_options: dict
    ) -> None:
        """ephemeral=True must surface as ephemeral=true in the query string."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        commits_response = MagicMock()
        commits_response.status_code = 200
        commits_response.is_success = True
        commits_response.json.return_value = {
            "commits": [],
            "next_cursor": None,
            "has_more": False,
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=create_response
            )
            mock_get = AsyncMock(return_value=commits_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            repo = await storage.create_repo(id="test-repo")
            await repo.list_commits(branch="feature", ephemeral=True)

            called_url = mock_get.await_args.args[0]
            assert "ephemeral=true" in called_url
            assert "branch=feature" in called_url

    @pytest.mark.asyncio
    async def test_list_commits_path_query_param(
        self, git_storage_options: dict
    ) -> None:
        """path kwarg appears as `path=` query parameter."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        commits_response = MagicMock()
        commits_response.status_code = 200
        commits_response.is_success = True
        commits_response.json.return_value = {
            "commits": [],
            "next_cursor": None,
            "has_more": False,
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=create_response
            )
            mock_get = AsyncMock(return_value=commits_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            repo = await storage.create_repo(id="test-repo")
            await repo.list_commits(branch="main", path="docs/guide.md")

            called_url = mock_get.await_args.args[0]
            params = parse_qs(urlparse(called_url).query)
            assert params.get("branch") == ["main"]
            assert params.get("path") == ["docs/guide.md"]

    @pytest.mark.asyncio
    async def test_get_commit(self, git_storage_options: dict) -> None:
        """Test fetching a single commit's metadata."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        commit_response = MagicMock()
        commit_response.status_code = 200
        commit_response.is_success = True
        commit_response.raise_for_status = MagicMock()
        commit_response.json.return_value = {
            "commit": {
                "sha": "abc123",
                "message": "feat: add endpoint",
                "author_name": "Jane Doe",
                "author_email": "jane@example.com",
                "committer_name": "Jane Doe",
                "committer_email": "jane@example.com",
                "date": "2024-01-15T14:32:18Z",
            },
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            client_instance.get = AsyncMock(return_value=commit_response)

            repo = await storage.create_repo(id="test-repo")
            result = await repo.get_commit(sha="abc123")

            commit = result["commit"]
            assert commit["sha"] == "abc123"
            assert commit["message"] == "feat: add endpoint"
            assert commit["author_name"] == "Jane Doe"
            assert commit["author_email"] == "jane@example.com"
            assert commit["committer_name"] == "Jane Doe"
            assert commit["committer_email"] == "jane@example.com"
            assert commit["raw_date"] == "2024-01-15T14:32:18Z"
            assert isinstance(commit["date"], datetime)
            assert commit["date"] == datetime(2024, 1, 15, 14, 32, 18, tzinfo=timezone.utc)

            called_url = client_instance.get.call_args.args[0]
            parsed = urlparse(called_url)
            assert parsed.path.endswith("/api/v1/repos/commit")
            assert parse_qs(parsed.query) == {"sha": ["abc123"]}

            headers = client_instance.get.call_args.kwargs["headers"]
            assert headers["Code-Storage-Agent"] == get_user_agent()
            token = headers["Authorization"].replace("Bearer ", "")
            payload = jwt.decode(token, options={"verify_signature": False})
            assert payload["scopes"] == ["git:read"]
            assert payload["repo"] == "test-repo"

    @pytest.mark.asyncio
    async def test_get_commit_trims_sha_and_honors_ttl(self, git_storage_options: dict) -> None:
        """get_commit should strip surrounding whitespace and apply ttl override."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        commit_response = MagicMock()
        commit_response.status_code = 200
        commit_response.is_success = True
        commit_response.raise_for_status = MagicMock()
        commit_response.json.return_value = {
            "commit": {
                "sha": "abc123",
                "message": "msg",
                "author_name": "A",
                "author_email": "a@example.com",
                "committer_name": "A",
                "committer_email": "a@example.com",
                "date": "2024-01-15T14:32:18Z",
            },
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            client_instance.get = AsyncMock(return_value=commit_response)

            repo = await storage.create_repo(id="test-repo")
            await repo.get_commit(sha="  abc123  ", ttl=600)

            called_url = client_instance.get.call_args.args[0]
            parsed = urlparse(called_url)
            assert parse_qs(parsed.query) == {"sha": ["abc123"]}

            headers = client_instance.get.call_args.kwargs["headers"]
            token = headers["Authorization"].replace("Bearer ", "")
            payload = jwt.decode(token, options={"verify_signature": False})
            assert payload["exp"] - payload["iat"] == 600

    @pytest.mark.asyncio
    async def test_get_commit_requires_sha(self, git_storage_options: dict) -> None:
        """get_commit should reject blank or whitespace-only sha values."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            client_instance.get = AsyncMock()

            repo = await storage.create_repo(id="test-repo")

            with pytest.raises(ValueError, match="get_commit sha is required"):
                await repo.get_commit(sha="")

            with pytest.raises(ValueError, match="get_commit sha is required"):
                await repo.get_commit(sha="   ")

            client_instance.get.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_blame(self, git_storage_options: dict) -> None:
        """Test blaming a file."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        blame_response = MagicMock()
        blame_response.status_code = 200
        blame_response.is_success = True
        blame_response.raise_for_status = MagicMock()
        blame_response.json.return_value = {
            "ref": "main",
            "path": "src/x.go",
            "commit_sha": "aaa111",
            "lines": [
                {
                    "line_number": 10,
                    "commit_sha": "bbb222",
                    "original_line_number": 5,
                    "original_path": "src/x.go",
                    "previous_commit_sha": "zzz000",
                    "author_name": "Alice",
                    "author_email": "alice@example.com",
                    "author_time": "2024-01-15T14:32:18Z",
                    "committer_name": "Alice",
                    "committer_email": "alice@example.com",
                    "committer_time": "2024-01-15T14:32:18Z",
                    "summary": "init",
                },
                {
                    "line_number": 11,
                    "commit_sha": "ccc333",
                    "original_line_number": 11,
                    "original_path": "src/old.go",
                    "author_name": "Bob",
                    "author_email": "bob@example.com",
                    "author_time": "2024-02-20T09:00:00Z",
                    "committer_name": "Bob",
                    "committer_email": "bob@example.com",
                    "committer_time": "2024-02-20T09:00:00Z",
                    "summary": "fix",
                },
            ],
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            client_instance.get = AsyncMock(return_value=blame_response)

            repo = await storage.create_repo(id="test-repo")
            result = await repo.get_blame(
                path="src/x.go",
                ref="main",
                ranges=["10,20", "/getUser/,+30"],
                detect_moves=True,
            )

            assert result["ref"] == "main"
            assert result["path"] == "src/x.go"
            assert result["commit_sha"] == "aaa111"
            assert len(result["lines"]) == 2

            first = result["lines"][0]
            assert first["commit_sha"] == "bbb222"
            assert first["author_name"] == "Alice"
            assert first["previous_commit_sha"] == "zzz000"
            assert first["raw_author_time"] == "2024-01-15T14:32:18Z"
            assert isinstance(first["author_time"], datetime)
            assert first["author_time"] == datetime(
                2024, 1, 15, 14, 32, 18, tzinfo=timezone.utc
            )

            second = result["lines"][1]
            assert second["original_path"] == "src/old.go"
            assert "previous_commit_sha" not in second
            assert second["author_name"] == "Bob"

            called_url = client_instance.get.call_args.args[0]
            parsed = urlparse(called_url)
            assert parsed.path.endswith("/api/v1/repos/blame")
            assert parse_qs(parsed.query) == {
                "path": ["src/x.go"],
                "ref": ["main"],
                "range": ["10,20", "/getUser/,+30"],
                "detect_moves": ["true"],
            }

            headers = client_instance.get.call_args.kwargs["headers"]
            assert headers["Code-Storage-Agent"] == get_user_agent()
            token = headers["Authorization"].replace("Bearer ", "")
            payload = jwt.decode(token, options={"verify_signature": False})
            assert payload["scopes"] == ["git:read"]
            assert payload["repo"] == "test-repo"

    @pytest.mark.asyncio
    async def test_get_blame_omits_optional_params(self, git_storage_options: dict) -> None:
        """blame should send only the path when no other knobs are supplied."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        blame_response = MagicMock()
        blame_response.status_code = 200
        blame_response.is_success = True
        blame_response.raise_for_status = MagicMock()
        blame_response.json.return_value = {
            "ref": "main",
            "path": "src/x.go",
            "commit_sha": "sha",
            "lines": [],
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            client_instance.get = AsyncMock(return_value=blame_response)

            repo = await storage.create_repo(id="test-repo")
            await repo.get_blame(path="src/x.go")

            called_url = client_instance.get.call_args.args[0]
            parsed = urlparse(called_url)
            assert parse_qs(parsed.query) == {"path": ["src/x.go"]}

    @pytest.mark.asyncio
    async def test_get_blame_requires_path(self, git_storage_options: dict) -> None:
        """blame should reject blank or whitespace-only path values."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            client_instance.get = AsyncMock()

            repo = await storage.create_repo(id="test-repo")

            with pytest.raises(ValueError, match="get_blame path is required"):
                await repo.get_blame(path="")

            with pytest.raises(ValueError, match="get_blame path is required"):
                await repo.get_blame(path="   ")

            client_instance.get.assert_not_called()

    @pytest.mark.asyncio
    async def test_restore_commit(self, git_storage_options: dict) -> None:
        """Test restoring to a previous commit."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        restore_response = MagicMock()
        restore_response.status_code = 200
        restore_response.is_success = True
        restore_response.json.return_value = {
            "commit": {
                "commit_sha": "new-commit-sha",
                "tree_sha": "new-tree-sha",
                "target_branch": "main",
                "pack_bytes": 1024,
                "blob_count": 0,
            },
            "result": {
                "success": True,
                "branch": "main",
                "old_sha": "old-sha",
                "new_sha": "new-commit-sha",
                "status": "ok",
            },
        }

        with patch("httpx.AsyncClient") as mock_client:
            # Mock both create and restore
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                side_effect=[create_response, restore_response]
            )

            repo = await storage.create_repo(id="test-repo")
            result = await repo.restore_commit(
                target_branch="main",
                target_commit_sha="abc123",
                commit_message="Restore commit",
                author={"name": "Test", "email": "test@example.com"},
            )

            assert result is not None
            assert result["commit_sha"] == "new-commit-sha"
            assert result["ref_update"]["branch"] == "main"
            assert result["ref_update"]["new_sha"] == "new-commit-sha"
            assert result["ref_update"]["old_sha"] == "old-sha"


class TestRepoNoteOperations:
    """Tests for git note operations."""

    @pytest.mark.asyncio
    async def test_get_note(self, git_storage_options: dict) -> None:
        """Test reading a git note."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        note_response = MagicMock()
        note_response.status_code = 200
        note_response.is_success = True
        note_response.raise_for_status = MagicMock()
        note_response.json.return_value = {
            "sha": "abc123",
            "note": "hello notes",
            "ref_sha": "def456",
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            client_instance.get = AsyncMock(return_value=note_response)

            repo = await storage.create_repo(id="test-repo")
            result = await repo.get_note(sha="abc123")

            assert result["sha"] == "abc123"
            assert result["note"] == "hello notes"
            assert result["ref_sha"] == "def456"

    @pytest.mark.asyncio
    async def test_create_append_delete_note(self, git_storage_options: dict) -> None:
        """Test creating, appending, and deleting git notes."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        create_note_response = MagicMock()
        create_note_response.status_code = 201
        create_note_response.is_success = True
        create_note_response.json.return_value = {
            "sha": "abc123",
            "target_ref": "refs/notes/commits",
            "new_ref_sha": "def456",
            "result": {"success": True, "status": "ok"},
        }

        append_note_response = MagicMock()
        append_note_response.status_code = 200
        append_note_response.is_success = True
        append_note_response.json.return_value = {
            "sha": "abc123",
            "target_ref": "refs/notes/commits",
            "new_ref_sha": "ghi789",
            "result": {"success": True, "status": "ok"},
        }

        delete_note_response = MagicMock()
        delete_note_response.status_code = 200
        delete_note_response.is_success = True
        delete_note_response.json.return_value = {
            "sha": "abc123",
            "target_ref": "refs/notes/commits",
            "new_ref_sha": "ghi789",
            "result": {"success": True, "status": "ok"},
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(
                side_effect=[create_response, create_note_response, append_note_response]
            )
            client_instance.request = AsyncMock(return_value=delete_note_response)

            repo = await storage.create_repo(id="test-repo")

            create_result = await repo.create_note(sha="abc123", note="note content")
            assert create_result["new_ref_sha"] == "def456"

            append_result = await repo.append_note(sha="abc123", note="note append")
            assert append_result["new_ref_sha"] == "ghi789"

            delete_result = await repo.delete_note(sha="abc123")
            assert delete_result["target_ref"] == "refs/notes/commits"

            create_call = client_instance.post.call_args_list[1]
            assert create_call.kwargs["json"] == {
                "sha": "abc123",
                "action": "add",
                "note": "note content",
            }

            append_call = client_instance.post.call_args_list[2]
            assert append_call.kwargs["json"] == {
                "sha": "abc123",
                "action": "append",
                "note": "note append",
            }

            delete_call = client_instance.request.call_args_list[0]
            assert delete_call.args[0] == "DELETE"
            assert delete_call.kwargs["json"] == {"sha": "abc123"}


class TestRepoTagOperations:
    """Tests for tag operations."""

    @pytest.mark.asyncio
    async def test_list_tags(self, git_storage_options: dict) -> None:
        """Test listing tags."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        list_tags_response = MagicMock()
        list_tags_response.status_code = 200
        list_tags_response.is_success = True
        list_tags_response.raise_for_status = MagicMock()
        list_tags_response.json.return_value = {
            "tags": [
                {"cursor": "c1", "name": "v1.0.0", "sha": "abc123"},
                {"cursor": "c2", "name": "v1.0.1", "sha": "def456"},
            ],
            "next_cursor": "next",
            "has_more": True,
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            client_instance.get = AsyncMock(return_value=list_tags_response)

            repo = await storage.create_repo(id="test-repo")
            result = await repo.list_tags(cursor="start", limit=17)

            assert result["next_cursor"] == "next"
            assert result["has_more"] is True
            assert result["tags"][0]["name"] == "v1.0.0"
            assert result["tags"][1]["sha"] == "def456"

            list_call = client_instance.get.call_args
            assert "cursor=start" in list_call.args[0]
            assert "limit=17" in list_call.args[0]

    @pytest.mark.asyncio
    async def test_create_and_delete_tag(self, git_storage_options: dict) -> None:
        """Test creating and deleting tags."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        create_tag_response = MagicMock()
        create_tag_response.status_code = 200
        create_tag_response.is_success = True
        create_tag_response.json.return_value = {
            "name": "v1.0.0",
            "sha": "0123456789abcdef0123456789abcdef01234567",
            "message": "tag created",
        }

        delete_tag_response = MagicMock()
        delete_tag_response.status_code = 200
        delete_tag_response.is_success = True
        delete_tag_response.json.return_value = {
            "name": "v1.0.0",
            "message": "tag deleted",
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(side_effect=[create_response, create_tag_response])
            client_instance.request = AsyncMock(return_value=delete_tag_response)

            repo = await storage.create_repo(id="test-repo")

            create_result = await repo.create_tag(
                name="v1.0.0",
                target="0123456789abcdef0123456789abcdef01234567",
            )
            assert create_result["message"] == "tag created"

            delete_result = await repo.delete_tag(name="v1.0.0")
            assert delete_result["message"] == "tag deleted"

            create_call = client_instance.post.call_args_list[1]
            assert create_call.kwargs["json"] == {
                "name": "v1.0.0",
                "target": "0123456789abcdef0123456789abcdef01234567",
            }

            delete_call = client_instance.request.call_args_list[0]
            assert delete_call.args[0] == "DELETE"
            assert delete_call.kwargs["json"] == {"name": "v1.0.0"}

    @pytest.mark.asyncio
    async def test_delete_branch(self, git_storage_options: dict) -> None:
        """Test deleting a branch sends DELETE with the expected payload."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        delete_branch_response = MagicMock()
        delete_branch_response.status_code = 200
        delete_branch_response.is_success = True
        delete_branch_response.json.return_value = {
            "name": "feature/old-onboarding",
            "message": "branch deleted",
            "ephemeral": False,
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            client_instance.request = AsyncMock(return_value=delete_branch_response)

            repo = await storage.create_repo(id="test-repo")

            result = await repo.delete_branch(name="feature/old-onboarding")
            assert result == {
                "name": "feature/old-onboarding",
                "message": "branch deleted",
                "ephemeral": False,
            }

            delete_call = client_instance.request.call_args_list[0]
            assert delete_call.args[0] == "DELETE"
            assert delete_call.args[1].endswith("/repos/branches")
            assert delete_call.kwargs["json"] == {"name": "feature/old-onboarding"}

    @pytest.mark.asyncio
    async def test_delete_branch_ephemeral(self, git_storage_options: dict) -> None:
        """Test that delete_branch forwards the ephemeral flag and surfaces it."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        delete_branch_response = MagicMock()
        delete_branch_response.status_code = 200
        delete_branch_response.is_success = True
        delete_branch_response.json.return_value = {
            "name": "merge/123e4567-e89b-12d3-a456-426614174000",
            "message": "branch deleted",
            "ephemeral": True,
        }

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            client_instance.request = AsyncMock(return_value=delete_branch_response)

            repo = await storage.create_repo(id="test-repo")

            result = await repo.delete_branch(
                name="merge/123e4567-e89b-12d3-a456-426614174000",
                ephemeral=True,
            )
            assert result == {
                "name": "merge/123e4567-e89b-12d3-a456-426614174000",
                "message": "branch deleted",
                "ephemeral": True,
            }

            delete_call = client_instance.request.call_args_list[0]
            assert delete_call.kwargs["json"] == {
                "name": "merge/123e4567-e89b-12d3-a456-426614174000",
                "ephemeral": True,
            }

    @pytest.mark.asyncio
    async def test_delete_branch_validates_name(self, git_storage_options: dict) -> None:
        """Test that delete_branch validates the branch name."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)

            repo = await storage.create_repo(id="test-repo")

            with pytest.raises(ValueError, match="delete_branch name is required"):
                await repo.delete_branch(name="   ")

            with pytest.raises(ValueError, match="delete_branch name must not start with refs/"):
                await repo.delete_branch(name="refs/heads/feature/demo")


class TestRepoDiffOperations:
    """Tests for diff operations."""

    @pytest.mark.asyncio
    async def test_get_branch_diff(self, git_storage_options: dict) -> None:
        """Test getting branch diff."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        diff_response = MagicMock()
        diff_response.status_code = 200
        diff_response.is_success = True
        diff_response.json.return_value = {
            "branch": "feature",
            "base": "main",
            "stats": {"additions": 10, "deletions": 5, "files_changed": 2},
            "files": [
                {
                    "path": "README.md",
                    "state": "modified",
                    "raw": "diff --git ...",
                    "bytes": 100,
                    "is_eof": True,
                    "additions": 7,
                    "deletions": 2,
                },
                {
                    "path": "new-file.py",
                    "state": "added",
                    "raw": "diff --git ...",
                    "bytes": 200,
                    "is_eof": True,
                    "additions": 3,
                    "deletions": 0,
                },
            ],
            "filtered_files": [],
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=create_response
            )
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=diff_response
            )

            repo = await storage.create_repo(id="test-repo")
            result = await repo.get_branch_diff(branch="feature", base="main")

            assert result is not None
            assert "stats" in result
            assert result["stats"]["additions"] == 10
            assert len(result["files"]) == 2
            assert result["files"][0]["additions"] == 7
            assert result["files"][0]["deletions"] == 2

    @pytest.mark.asyncio
    async def test_get_branch_diff_with_ephemeral(self, git_storage_options: dict) -> None:
        """Test getting branch diff with ephemeral flag."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        diff_response = MagicMock()
        diff_response.status_code = 200
        diff_response.is_success = True
        diff_response.json.return_value = {
            "branch": "feature",
            "base": "main",
            "stats": {"additions": 5, "deletions": 2, "files_changed": 1},
            "files": [
                {
                    "path": "test.py",
                    "state": "modified",
                    "raw": "diff --git ...",
                    "bytes": 50,
                    "is_eof": True,
                }
            ],
            "filtered_files": [],
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_get = AsyncMock(return_value=diff_response)
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=create_response
            )
            mock_client.return_value.__aenter__.return_value.get = mock_get

            repo = await storage.create_repo(id="test-repo")
            result = await repo.get_branch_diff(branch="feature", base="main", ephemeral=True)

            assert result is not None
            assert result["stats"]["additions"] == 5

            # Verify the URL contains the ephemeral parameter
            call_args = mock_get.call_args
            url = call_args[0][0]
            parsed = urlparse(url)
            params = parse_qs(parsed.query)
            assert params["ephemeral"] == ["true"]
            assert params["branch"] == ["feature"]
            assert params["base"] == ["main"]

    @pytest.mark.asyncio
    async def test_get_branch_diff_with_ephemeral_base(self, git_storage_options: dict) -> None:
        """Test getting branch diff with ephemeral_base flag."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        diff_response = MagicMock()
        diff_response.status_code = 200
        diff_response.is_success = True
        diff_response.json.return_value = {
            "branch": "feature",
            "base": "main",
            "stats": {"additions": 8, "deletions": 3, "files_changed": 2},
            "files": [],
            "filtered_files": [],
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_get = AsyncMock(return_value=diff_response)
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=create_response
            )
            mock_client.return_value.__aenter__.return_value.get = mock_get

            repo = await storage.create_repo(id="test-repo")
            result = await repo.get_branch_diff(branch="feature", base="main", ephemeral_base=True)

            assert result is not None
            assert result["stats"]["additions"] == 8

            # Verify the URL contains the ephemeral_base parameter
            call_args = mock_get.call_args
            url = call_args[0][0]
            parsed = urlparse(url)
            params = parse_qs(parsed.query)
            assert params["ephemeral_base"] == ["true"]
            assert params["branch"] == ["feature"]
            assert params["base"] == ["main"]

    @pytest.mark.asyncio
    async def test_get_branch_diff_with_both_ephemeral_flags(
        self, git_storage_options: dict
    ) -> None:
        """Test getting branch diff with both ephemeral and ephemeral_base flags."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        diff_response = MagicMock()
        diff_response.status_code = 200
        diff_response.is_success = True
        diff_response.json.return_value = {
            "branch": "feature",
            "base": "main",
            "stats": {"additions": 12, "deletions": 6, "files_changed": 3},
            "files": [],
            "filtered_files": [],
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_get = AsyncMock(return_value=diff_response)
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=create_response
            )
            mock_client.return_value.__aenter__.return_value.get = mock_get

            repo = await storage.create_repo(id="test-repo")
            result = await repo.get_branch_diff(
                branch="feature", base="main", ephemeral=True, ephemeral_base=True
            )

            assert result is not None
            assert result["stats"]["additions"] == 12

            # Verify the URL contains both ephemeral parameters
            call_args = mock_get.call_args
            url = call_args[0][0]
            parsed = urlparse(url)
            params = parse_qs(parsed.query)
            assert params["ephemeral"] == ["true"]
            assert params["ephemeral_base"] == ["true"]
            assert params["branch"] == ["feature"]
            assert params["base"] == ["main"]

    @pytest.mark.asyncio
    async def test_get_branch_diff_ephemeral_false(self, git_storage_options: dict) -> None:
        """Test getting branch diff with ephemeral explicitly set to False."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        diff_response = MagicMock()
        diff_response.status_code = 200
        diff_response.is_success = True
        diff_response.json.return_value = {
            "branch": "feature",
            "base": "main",
            "stats": {"additions": 4, "deletions": 1, "files_changed": 1},
            "files": [],
            "filtered_files": [],
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_get = AsyncMock(return_value=diff_response)
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=create_response
            )
            mock_client.return_value.__aenter__.return_value.get = mock_get

            repo = await storage.create_repo(id="test-repo")
            result = await repo.get_branch_diff(branch="feature", base="main", ephemeral=False)

            assert result is not None

            # Verify the URL contains ephemeral=false
            call_args = mock_get.call_args
            url = call_args[0][0]
            parsed = urlparse(url)
            params = parse_qs(parsed.query)
            assert params["ephemeral"] == ["false"]

    @pytest.mark.asyncio
    async def test_get_commit_diff(self, git_storage_options: dict) -> None:
        """Test getting commit diff."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        diff_response = MagicMock()
        diff_response.status_code = 200
        diff_response.is_success = True
        diff_response.json.return_value = {
            "sha": "abc123",
            "stats": {"additions": 3, "deletions": 1, "files_changed": 1},
            "files": [
                {
                    "path": "config.json",
                    "state": "modified",
                    "raw": "diff --git a/config.json b/config.json...",
                    "bytes": 150,
                    "is_eof": True,
                    "additions": 3,
                    "deletions": 1,
                }
            ],
            "filtered_files": [],
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=create_response
            )
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=diff_response
            )

            repo = await storage.create_repo(id="test-repo")
            result = await repo.get_commit_diff(sha="abc123")

            assert result is not None
            assert "stats" in result
            assert result["stats"]["files_changed"] == 1
            assert result["files"][0]["path"] == "config.json"
            assert result["files"][0]["additions"] == 3
            assert result["files"][0]["deletions"] == 1

    @pytest.mark.asyncio
    async def test_get_commit_diff_with_base_sha(self, git_storage_options: dict) -> None:
        """Test getting commit diff with base_sha parameter."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        diff_response = MagicMock()
        diff_response.status_code = 200
        diff_response.is_success = True
        diff_response.json.return_value = {
            "sha": "abc123",
            "stats": {"additions": 5, "deletions": 2, "files_changed": 2},
            "files": [
                {
                    "path": "file1.py",
                    "state": "modified",
                    "raw": "diff --git ...",
                    "bytes": 100,
                    "is_eof": True,
                },
                {
                    "path": "file2.py",
                    "state": "added",
                    "raw": "diff --git ...",
                    "bytes": 50,
                    "is_eof": True,
                },
            ],
            "filtered_files": [],
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_get = AsyncMock(return_value=diff_response)
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=create_response
            )
            mock_client.return_value.__aenter__.return_value.get = mock_get

            repo = await storage.create_repo(id="test-repo")
            result = await repo.get_commit_diff(sha="abc123", base_sha="def456")

            assert result is not None
            assert result["stats"]["additions"] == 5
            assert len(result["files"]) == 2

            # Verify the URL contains the baseSha parameter
            call_args = mock_get.call_args
            url = call_args[0][0]
            parsed = urlparse(url)
            params = parse_qs(parsed.query)
            assert params["sha"] == ["abc123"]
            assert params["baseSha"] == ["def456"]


class TestRepoUpstreamOperations:
    """Tests for upstream operations."""

    @pytest.mark.asyncio
    async def test_pull_upstream(self, git_storage_options: dict) -> None:
        """Test pulling from upstream."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        pull_response = MagicMock()
        pull_response.status_code = 202
        pull_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(side_effect=[create_response, pull_response])

            repo = await storage.create_repo(id="test-repo")
            # Should not raise an exception
            await repo.pull_upstream(ref="main")

    @pytest.mark.asyncio
    async def test_restore_commit_json_decode_error(self, git_storage_options: dict) -> None:
        """Test restoring commit with non-JSON response (e.g., CDN HTML on 5xx)."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        # Mock a 502 response with HTML instead of JSON
        restore_response = MagicMock()
        restore_response.status_code = 502
        restore_response.is_success = False
        restore_response.reason_phrase = "Bad Gateway"
        # Simulate JSON decode error
        restore_response.json.side_effect = Exception("JSON decode error")
        restore_response.aread = AsyncMock(
            return_value=b"<html><body>502 Bad Gateway</body></html>"
        )

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                side_effect=[create_response, restore_response]
            )

            repo = await storage.create_repo(id="test-repo")

            with pytest.raises(RefUpdateError) as exc_info:
                await repo.restore_commit(
                    target_branch="main",
                    target_commit_sha="abc123",
                    commit_message="Restore commit",
                    author={"name": "Test", "email": "test@example.com"},
                )

            # Verify we got a RefUpdateError with meaningful message
            assert "502" in str(exc_info.value)
            assert "Bad Gateway" in str(exc_info.value)
            assert exc_info.value.status == "unavailable"  # 502 maps to "unavailable"

    @pytest.mark.asyncio
    async def test_pull_upstream_no_branch(self, git_storage_options: dict) -> None:
        """Test pulling from upstream without specifying branch."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        pull_response = MagicMock()
        pull_response.status_code = 202
        pull_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(side_effect=[create_response, pull_response])

            repo = await storage.create_repo(id="test-repo")
            # Should work without branch option
            await repo.pull_upstream()

    @pytest.mark.asyncio
    async def test_create_commit_from_diff(self, git_storage_options: dict) -> None:
        """Test creating a commit directly from a diff."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        stream_response = MagicMock()
        stream_response.is_success = True
        stream_response.aread = AsyncMock(
            return_value=(
                b'{"commit":{"commit_sha":"diff123","tree_sha":"tree123","target_branch":"main",'
                b'"pack_bytes":512,"blob_count":0},"result":{"success":true,"status":"ok",'
                b'"branch":"main","old_sha":"old123","new_sha":"diff123"}}'
            )
        )

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            stream_context = MagicMock()
            stream_context.__aenter__ = AsyncMock(return_value=stream_response)
            stream_context.__aexit__ = AsyncMock(return_value=None)
            client_instance.stream = MagicMock(return_value=stream_context)

            repo = await storage.create_repo(id="test-repo")
            result = await repo.create_commit_from_diff(
                target_branch="main",
                commit_message="Apply diff",
                diff="--- a/file.txt\n+++ b/file.txt\n@@\n+hello world\n",
                author={"name": "Test", "email": "test@example.com"},
            )

            assert result["commit_sha"] == "diff123"
            assert result["ref_update"]["new_sha"] == "diff123"

            client_instance.stream.assert_called_once()
            args, _ = client_instance.stream.call_args
            assert args[0] == "POST"
            assert args[1].endswith("/api/v1/repos/diff-commit")

    @pytest.mark.asyncio
    async def test_create_commit_from_diff_failure(self, git_storage_options: dict) -> None:
        """Test diff commit raising RefUpdateError on failure."""
        storage = GitStorage(git_storage_options)

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.is_success = True
        create_response.json.return_value = {"repo_id": "test-repo"}

        stream_response = MagicMock()
        stream_response.is_success = True
        stream_response.aread = AsyncMock(
            return_value=(
                b'{"commit":{"commit_sha":"fail123","tree_sha":"tree123","target_branch":"main",'
                b'"pack_bytes":512,"blob_count":0},"result":{"success":false,"status":"rejected",'
                b'"message":"conflict detected","branch":"main","old_sha":"old123","new_sha":"fail123"}}'
            )
        )

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=create_response)
            stream_context = MagicMock()
            stream_context.__aenter__ = AsyncMock(return_value=stream_response)
            stream_context.__aexit__ = AsyncMock(return_value=None)
            client_instance.stream = MagicMock(return_value=stream_context)

            repo = await storage.create_repo(id="test-repo")

            with pytest.raises(RefUpdateError) as exc_info:
                await repo.create_commit_from_diff(
                    target_branch="main",
                    commit_message="Apply diff",
                    diff="@diff-content",
                    author={"name": "Test", "email": "test@example.com"},
                )

            assert exc_info.value.status == "rejected"
            assert "conflict detected" in str(exc_info.value)


class TestCodeStorageAgentHeaderInRepo:
    """Tests for Code-Storage-Agent header in repo API requests."""

    @pytest.mark.asyncio
    async def test_list_files_includes_agent_header(self, git_storage_options: dict) -> None:
        """Test that listFiles includes Code-Storage-Agent header."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.json = MagicMock(
            return_value={"repo_id": "test-repo", "url": "https://example.com/repo.git"}
        )
        mock_response.status_code = 200
        mock_response.is_success = True

        # Mock list files response
        list_files_response = MagicMock()
        list_files_response.json = MagicMock(return_value={"paths": [], "ref": "main"})
        list_files_response.status_code = 200
        list_files_response.is_success = True
        list_files_response.raise_for_status = MagicMock()

        captured_headers = None

        with patch("httpx.AsyncClient") as mock_client:
            mock_get = AsyncMock(return_value=list_files_response)

            async def capture_get(*args, **kwargs):
                nonlocal captured_headers
                captured_headers = kwargs.get("headers")
                return await mock_get(*args, **kwargs)

            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )
            mock_client.return_value.__aenter__.return_value.get = capture_get

            repo = await storage.create_repo(id="test-repo")
            await repo.list_files()

            # Verify headers include Code-Storage-Agent
            assert captured_headers is not None
            assert "Code-Storage-Agent" in captured_headers
            assert captured_headers["Code-Storage-Agent"] == get_user_agent()

    @pytest.mark.asyncio
    async def test_list_files_with_metadata_includes_agent_header(
        self, git_storage_options: dict
    ) -> None:
        """Test that list_files_with_metadata includes Code-Storage-Agent header."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.json = MagicMock(
            return_value={"repo_id": "test-repo", "url": "https://example.com/repo.git"}
        )
        mock_response.status_code = 200
        mock_response.is_success = True

        list_response = MagicMock()
        list_response.json = MagicMock(
            return_value={
                "files": [],
                "commits": {},
                "ref": "main",
            }
        )
        list_response.status_code = 200
        list_response.is_success = True
        list_response.raise_for_status = MagicMock()

        captured_headers = None

        with patch("httpx.AsyncClient") as mock_client:
            mock_get = AsyncMock(return_value=list_response)

            async def capture_get(*args, **kwargs):
                nonlocal captured_headers
                captured_headers = kwargs.get("headers")
                return await mock_get(*args, **kwargs)

            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )
            mock_client.return_value.__aenter__.return_value.get = capture_get

            repo = await storage.create_repo(id="test-repo")
            await repo.list_files_with_metadata()

            assert captured_headers is not None
            assert "Code-Storage-Agent" in captured_headers
            assert captured_headers["Code-Storage-Agent"] == get_user_agent()

    @pytest.mark.asyncio
    async def test_list_branches_includes_agent_header(self, git_storage_options: dict) -> None:
        """Test that listBranches includes Code-Storage-Agent header."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.json = MagicMock(
            return_value={"repo_id": "test-repo", "url": "https://example.com/repo.git"}
        )
        mock_response.status_code = 200
        mock_response.is_success = True

        # Mock list branches response
        list_branches_response = MagicMock()
        list_branches_response.json = MagicMock(
            return_value={"branches": [], "cursor": None, "has_more": False}
        )
        list_branches_response.status_code = 200
        list_branches_response.is_success = True

        captured_headers = None

        with patch("httpx.AsyncClient") as mock_client:
            mock_get = AsyncMock(return_value=list_branches_response)

            async def capture_get(*args, **kwargs):
                nonlocal captured_headers
                captured_headers = kwargs.get("headers")
                return await mock_get(*args, **kwargs)

            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )
            mock_client.return_value.__aenter__.return_value.get = capture_get

            repo = await storage.create_repo(id="test-repo")
            await repo.list_branches()

            # Verify headers include Code-Storage-Agent
            assert captured_headers is not None
            assert "Code-Storage-Agent" in captured_headers
            assert captured_headers["Code-Storage-Agent"] == get_user_agent()

    @pytest.mark.asyncio
    async def test_create_branch_includes_agent_header(self, git_storage_options: dict) -> None:
        """Test that createBranch includes Code-Storage-Agent header."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.json = MagicMock(
            return_value={"repo_id": "test-repo", "url": "https://example.com/repo.git"}
        )
        mock_response.status_code = 200
        mock_response.is_success = True

        # Mock create branch response
        create_branch_response = MagicMock()
        create_branch_response.json = MagicMock(
            return_value={
                "message": "branch created",
                "target_branch": "feature/test",
                "target_is_ephemeral": False,
            }
        )
        create_branch_response.status_code = 200
        create_branch_response.is_success = True

        captured_headers = None

        with patch("httpx.AsyncClient") as mock_client:

            async def capture_post(*args, **kwargs):
                nonlocal captured_headers
                url = args[0] if args else ""
                if "branch" not in url:  # createRepo call
                    return mock_response
                else:  # createBranch call
                    captured_headers = kwargs.get("headers")
                    return create_branch_response

            mock_client.return_value.__aenter__.return_value.post = capture_post

            repo = await storage.create_repo(id="test-repo")
            await repo.create_branch(base_ref="main", target_branch="feature/test")

            # Verify headers include Code-Storage-Agent
            assert captured_headers is not None
            assert "Code-Storage-Agent" in captured_headers
            assert captured_headers["Code-Storage-Agent"] == get_user_agent()

    @pytest.mark.asyncio
    async def test_list_tags_includes_agent_header(self, git_storage_options: dict) -> None:
        """Test that list_tags includes Code-Storage-Agent header."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.json = MagicMock(
            return_value={"repo_id": "test-repo", "url": "https://example.com/repo.git"}
        )
        mock_response.status_code = 200
        mock_response.is_success = True

        list_tags_response = MagicMock()
        list_tags_response.json = MagicMock(return_value={"tags": [], "has_more": False})
        list_tags_response.status_code = 200
        list_tags_response.is_success = True
        list_tags_response.raise_for_status = MagicMock()

        captured_headers = None

        with patch("httpx.AsyncClient") as mock_client:
            mock_get = AsyncMock(return_value=list_tags_response)

            async def capture_get(*args, **kwargs):
                nonlocal captured_headers
                captured_headers = kwargs.get("headers")
                return await mock_get(*args, **kwargs)

            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )
            mock_client.return_value.__aenter__.return_value.get = capture_get

            repo = await storage.create_repo(id="test-repo")
            await repo.list_tags()

            assert captured_headers is not None
            assert "Code-Storage-Agent" in captured_headers
            assert captured_headers["Code-Storage-Agent"] == get_user_agent()
