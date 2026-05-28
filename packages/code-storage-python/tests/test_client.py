"""Tests for GitStorage client."""

from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest

from pierre_storage import GitStorage, create_client, generate_jwt
from pierre_storage.errors import ApiError
from pierre_storage.version import get_user_agent


class TestGitStorage:
    """Tests for GitStorage class."""

    def test_create_instance(self, git_storage_options: dict) -> None:
        """Test creating GitStorage instance."""
        storage = GitStorage(git_storage_options)
        assert storage is not None
        assert isinstance(storage, GitStorage)

    def test_store_key(self, git_storage_options: dict, test_key: str) -> None:
        """Test that key is stored."""
        storage = GitStorage(git_storage_options)
        config = storage.get_config()
        assert config["key"] == test_key

    def test_missing_options(self) -> None:
        """Test error when options are missing."""
        with pytest.raises(ValueError, match="GitStorage requires a name and key"):
            GitStorage({})  # type: ignore

    def test_null_key(self, test_key: str) -> None:
        """Test error when key is null."""
        with pytest.raises(ValueError, match="GitStorage requires a name and key"):
            GitStorage({"name": "test", "key": None})  # type: ignore

    def test_empty_key(self) -> None:
        """Test error when key is empty."""
        with pytest.raises(ValueError, match="GitStorage key must be a non-empty string"):
            GitStorage({"name": "test", "key": ""})

    def test_empty_name(self, test_key: str) -> None:
        """Test error when name is empty."""
        with pytest.raises(ValueError, match="GitStorage name must be a non-empty string"):
            GitStorage({"name": "", "key": test_key})

    def test_whitespace_key(self) -> None:
        """Test error when key is whitespace."""
        with pytest.raises(ValueError, match="GitStorage key must be a non-empty string"):
            GitStorage({"name": "test", "key": "   "})

    def test_whitespace_name(self, test_key: str) -> None:
        """Test error when name is whitespace."""
        with pytest.raises(ValueError, match="GitStorage name must be a non-empty string"):
            GitStorage({"name": "   ", "key": test_key})

    def test_non_string_key(self) -> None:
        """Test error when key is not a string."""
        with pytest.raises(ValueError, match="GitStorage key must be a non-empty string"):
            GitStorage({"name": "test", "key": 123})  # type: ignore

    def test_non_string_name(self, test_key: str) -> None:
        """Test error when name is not a string."""
        with pytest.raises(ValueError, match="GitStorage name must be a non-empty string"):
            GitStorage({"name": 123, "key": test_key})  # type: ignore

    @pytest.mark.asyncio
    async def test_create_repo(self, git_storage_options: dict) -> None:
        """Test creating a repository."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True
        mock_response.json.return_value = {"repo_id": "test-repo", "url": "https://test.git"}

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            repo = await storage.create_repo(id="test-repo")
            assert repo is not None
            assert repo.id == "test-repo"

    @pytest.mark.asyncio
    async def test_create_repo_sets_created_at(self, git_storage_options: dict) -> None:
        """Test that create_repo sets created_at on the returned repo."""
        from datetime import datetime, timezone

        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True
        mock_response.json.return_value = {"repo_id": "test-repo", "url": "https://test.git"}

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            before = datetime.now(timezone.utc).isoformat()
            repo = await storage.create_repo(id="test-repo")
            after = datetime.now(timezone.utc).isoformat()

            assert repo.created_at is not None
            assert len(repo.created_at) > 0
            assert repo.created_at >= before
            assert repo.created_at <= after

    @pytest.mark.asyncio
    async def test_create_repo_with_base_repo(self, git_storage_options: dict) -> None:
        """Test creating a repository with GitHub sync."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True
        mock_response.json.return_value = {"repo_id": "test-repo", "url": "https://test.git"}

        with patch("httpx.AsyncClient") as mock_client:
            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            repo = await storage.create_repo(
                id="test-repo",
                base_repo={
                    "owner": "octocat",
                    "name": "Hello-World",
                    "default_branch": "main",
                },
            )
            assert repo is not None
            assert repo.id == "test-repo"

            # Verify the request was made with base_repo in the body
            call_kwargs = mock_post.call_args[1]
            body = call_kwargs["json"]
            assert "base_repo" in body
            assert body["base_repo"]["provider"] == "github"
            assert body["base_repo"]["owner"] == "octocat"
            assert body["base_repo"]["name"] == "Hello-World"
            assert body["base_repo"]["default_branch"] == "main"

    @pytest.mark.asyncio
    async def test_create_repo_with_base_repo_forces_github_provider(
        self, git_storage_options: dict
    ) -> None:
        """Test that base_repo forces provider to 'github'."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            # Create repo without provider in base_repo
            await storage.create_repo(
                id="test-repo",
                base_repo={
                    "owner": "octocat",
                    "name": "Hello-World",
                },
            )

            # Verify provider was forced to 'github'
            call_kwargs = mock_post.call_args[1]
            body = call_kwargs["json"]
            assert body["base_repo"]["provider"] == "github"

    @pytest.mark.asyncio
    async def test_create_repo_with_public_github_base_repo_auth(
        self, git_storage_options: dict
    ) -> None:
        """Test creating a repository with public GitHub base repo auth."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            await storage.create_repo(
                id="test-repo",
                base_repo={
                    "owner": "octocat",
                    "name": "Hello-World",
                    "auth": {"auth_type": "public"},
                },
            )

            call_kwargs = mock_post.call_args[1]
            body = call_kwargs["json"]
            assert body["base_repo"]["provider"] == "github"
            assert body["base_repo"]["auth"]["auth_type"] == "public"

    @pytest.mark.asyncio
    async def test_create_repo_with_fork_base_repo(self, git_storage_options: dict) -> None:
        """Test creating a forked repository."""
        storage = GitStorage(git_storage_options)

        mock_post_response = MagicMock()
        mock_post_response.status_code = 200
        mock_post_response.is_success = True
        mock_post_response.json.return_value = {"repo_id": "test-repo"}

        with patch("httpx.AsyncClient") as mock_client:
            client_instance = mock_client.return_value.__aenter__.return_value
            client_instance.post = AsyncMock(return_value=mock_post_response)

            repo = await storage.create_repo(
                id="test-repo",
                base_repo={
                    "id": "template-repo",
                    "ref": "develop",
                },
            )
            assert repo.default_branch == "main"

            call_kwargs = client_instance.post.call_args[1]
            body = call_kwargs["json"]
            assert "default_branch" not in body
            assert body["base_repo"]["provider"] == "code"
            assert body["base_repo"]["owner"] == "test-customer"
            assert body["base_repo"]["name"] == "template-repo"
            assert body["base_repo"]["operation"] == "fork"
            assert body["base_repo"]["ref"] == "develop"

            token = body["base_repo"]["auth"]["token"]
            payload = jwt.decode(token, options={"verify_signature": False})
            assert payload["repo"] == "template-repo"
            assert payload["scopes"] == ["git:read"]

    @pytest.mark.asyncio
    async def test_create_repo_conflict(self, git_storage_options: dict) -> None:
        """Test creating a repository that already exists."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 409
        mock_response.is_success = False

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            with pytest.raises(ApiError, match="Repository already exists"):
                await storage.create_repo(id="existing-repo")

    @pytest.mark.asyncio
    async def test_list_repos(self, git_storage_options: dict) -> None:
        """Test listing repositories."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True
        mock_response.json.return_value = {
            "repos": [
                {
                    "repo_id": "repo-1",
                    "url": "owner/repo-1",
                    "default_branch": "main",
                    "created_at": "2024-01-01T00:00:00Z",
                    "base_repo": {"provider": "github", "owner": "owner", "name": "repo-1"},
                }
            ],
            "next_cursor": None,
            "has_more": False,
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            result = await storage.list_repos()
            assert result["has_more"] is False
            assert result["repos"][0]["repo_id"] == "repo-1"

            call_kwargs = mock_get.call_args[1]
            headers = call_kwargs["headers"]
            token = headers["Authorization"].replace("Bearer ", "")
            payload = jwt.decode(token, options={"verify_signature": False})
            assert payload["scopes"] == ["org:read"]
            assert payload["repo"] == "org"

    @pytest.mark.asyncio
    async def test_list_repos_with_cursor(self, git_storage_options: dict) -> None:
        """Test listing repositories with pagination."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True
        mock_response.json.return_value = {
            "repos": [],
            "next_cursor": "next",
            "has_more": True,
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            await storage.list_repos(cursor="cursor-1", limit=10)

            call_args = mock_get.call_args[0]
            api_url = call_args[0]
            assert "cursor=cursor-1" in api_url
            assert "limit=10" in api_url

    @pytest.mark.asyncio
    async def test_repo_without_http_request(self, git_storage_options: dict) -> None:
        """Test repo creates a usable Repo without network calls."""
        storage = GitStorage(git_storage_options)

        with patch("httpx.AsyncClient") as mock_client:
            repo = storage.repo(
                id="known-repo-id",
                default_branch="develop",
                created_at="2024-06-15T12:00:00Z",
            )

            assert repo.id == "known-repo-id"
            assert repo.default_branch == "develop"
            assert repo.created_at == "2024-06-15T12:00:00Z"
            mock_client.assert_not_called()

            url = await repo.get_remote_url(permissions=["git:read"])
            assert url.startswith("https://t:")
            assert "@test.code.storage/known-repo-id.git" in url
            mock_client.assert_not_called()

    def test_repo_defaults(self, git_storage_options: dict) -> None:
        """Test repo default values when optional metadata is omitted."""
        storage = GitStorage(git_storage_options)

        repo = storage.repo(id="known-repo-id")
        assert repo.id == "known-repo-id"
        assert repo.default_branch == "main"
        assert repo.created_at == ""

    def test_repo_requires_non_empty_id(self, git_storage_options: dict) -> None:
        """Test repo validates repository id."""
        storage = GitStorage(git_storage_options)

        with pytest.raises(ValueError, match="repo requires a non-empty repository id"):
            storage.repo(id="")
        with pytest.raises(ValueError, match="repo requires a non-empty repository id"):
            storage.repo(id="   ")

    @pytest.mark.asyncio
    async def test_find_one(self, git_storage_options: dict) -> None:
        """Test finding a repository."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True
        mock_response.json.return_value = {"id": "test-repo"}

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            repo = await storage.find_one(id="test-repo")
            assert repo is not None
            assert repo.id == "test-repo"

    @pytest.mark.asyncio
    async def test_find_one_created_at(self, git_storage_options: dict) -> None:
        """Test that find_one exposes created_at from API response."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True
        mock_response.json.return_value = {
            "default_branch": "main",
            "created_at": "2024-06-15T12:00:00Z",
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            repo = await storage.find_one(id="test-repo")
            assert repo is not None
            assert repo.created_at == "2024-06-15T12:00:00Z"

    @pytest.mark.asyncio
    async def test_find_one_created_at_missing(self, git_storage_options: dict) -> None:
        """Test that find_one defaults created_at to empty string when not in response."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True
        mock_response.json.return_value = {"default_branch": "main"}

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            repo = await storage.find_one(id="test-repo")
            assert repo is not None
            assert repo.created_at == ""

    @pytest.mark.asyncio
    async def test_find_one_not_found(self, git_storage_options: dict) -> None:
        """Test finding a repository that doesn't exist."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.is_success = False

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )

            repo = await storage.find_one(id="nonexistent")
            assert repo is None

    @pytest.mark.asyncio
    async def test_delete_repo(self, git_storage_options: dict) -> None:
        """Test deleting a repository."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True
        mock_response.json.return_value = {
            "repo_id": "test-repo",
            "message": "Repository test-repo deletion initiated.",
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.delete = AsyncMock(
                return_value=mock_response
            )

            result = await storage.delete_repo(id="test-repo")
            assert result["repo_id"] == "test-repo"
            assert "deletion initiated" in result["message"]

    @pytest.mark.asyncio
    async def test_delete_repo_sends_correct_request(self, git_storage_options: dict) -> None:
        """Test that delete_repo sends DELETE request with repo:write scope."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True
        mock_response.json.return_value = {
            "repo_id": "test-repo",
            "message": "Repository deletion initiated.",
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_delete = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.delete = mock_delete

            await storage.delete_repo(id="test-repo")

            # Verify the DELETE request was made to the correct URL
            mock_delete.assert_called_once()
            call_args = mock_delete.call_args[0]
            api_url = call_args[0]
            assert api_url == "https://api.test.code.storage/api/v1/repos/delete"

            # Verify headers include Authorization with repo:write scope
            call_kwargs = mock_delete.call_args[1]
            headers = call_kwargs["headers"]
            assert "Authorization" in headers
            assert headers["Authorization"].startswith("Bearer ")

            # Decode JWT and verify scope
            token = headers["Authorization"].replace("Bearer ", "")
            payload = jwt.decode(token, options={"verify_signature": False})
            assert payload["scopes"] == ["repo:write"]
            assert payload["repo"] == "test-repo"

    @pytest.mark.asyncio
    async def test_delete_repo_not_found(self, git_storage_options: dict) -> None:
        """Test deleting a repository that doesn't exist."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.is_success = False

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.delete = AsyncMock(
                return_value=mock_response
            )

            with pytest.raises(ApiError, match="Repository not found"):
                await storage.delete_repo(id="nonexistent")

    @pytest.mark.asyncio
    async def test_delete_repo_already_deleted(self, git_storage_options: dict) -> None:
        """Test deleting a repository that was already deleted."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 409
        mock_response.is_success = False

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.delete = AsyncMock(
                return_value=mock_response
            )

            with pytest.raises(ApiError, match="Repository already deleted"):
                await storage.delete_repo(id="already-deleted")

    @pytest.mark.asyncio
    async def test_delete_repo_with_custom_ttl(self, git_storage_options: dict) -> None:
        """Test delete_repo honors custom TTL."""
        storage = GitStorage(git_storage_options)
        custom_ttl = 300

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True
        mock_response.json.return_value = {
            "repo_id": "test-repo",
            "message": "Repository deletion initiated.",
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_delete = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.delete = mock_delete

            await storage.delete_repo(id="test-repo", ttl=custom_ttl)

            # Verify JWT has correct TTL
            call_kwargs = mock_delete.call_args[1]
            headers = call_kwargs["headers"]
            token = headers["Authorization"].replace("Bearer ", "")
            payload = jwt.decode(token, options={"verify_signature": False})
            assert payload["exp"] - payload["iat"] == custom_ttl

    @pytest.mark.asyncio
    async def test_create_repo_generic_git_base_repo(self, git_storage_options: dict) -> None:
        """Test creating a repository with a generic git base repo."""
        storage = GitStorage(git_storage_options)

        captured_body: dict = {}

        async def mock_post(url, **kwargs):  # type: ignore[no-untyped-def]
            captured_body.update(kwargs.get("json", {}))
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.is_success = True
            mock_response.json.return_value = {"repo_id": "test-repo", "url": "https://test.git"}
            return mock_response

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(side_effect=mock_post)

            repo = await storage.create_repo(
                id="test-repo",
                base_repo={
                    "provider": "gitlab",
                    "owner": "myorg",
                    "name": "myrepo",
                    "upstream_host": "gitlab.example.com",
                },
            )
            assert repo is not None

        assert captured_body["base_repo"]["provider"] == "gitlab"
        assert captured_body["base_repo"]["owner"] == "myorg"
        assert captured_body["base_repo"]["name"] == "myrepo"
        assert captured_body["base_repo"]["upstream_host"] == "gitlab.example.com"

    @pytest.mark.asyncio
    async def test_create_git_credential(self, git_storage_options: dict) -> None:
        """Test creating a git credential."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True
        mock_response.json.return_value = {"id": "cred-123"}

        with patch("httpx.AsyncClient") as mock_client:
            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            result = await storage.create_git_credential(
                repo_id="test-repo",
                password="secret-token",
                username="myuser",
            )

            assert result["id"] == "cred-123"

            # Verify the POST request was made to the correct URL
            mock_post.assert_called_once()
            call_args = mock_post.call_args[0]
            api_url = call_args[0]
            assert api_url == "https://api.test.code.storage/api/v1/repos/git-credentials"

            # Verify the body
            call_kwargs = mock_post.call_args[1]
            body = call_kwargs["json"]
            assert body["repo_id"] == "test-repo"
            assert body["password"] == "secret-token"
            assert body["username"] == "myuser"

    @pytest.mark.asyncio
    async def test_create_git_credential_without_username(
        self, git_storage_options: dict
    ) -> None:
        """Test creating a git credential without a username."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True
        mock_response.json.return_value = {"id": "cred-456"}

        with patch("httpx.AsyncClient") as mock_client:
            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            result = await storage.create_git_credential(
                repo_id="test-repo",
                password="secret-token",
            )

            assert result["id"] == "cred-456"

            call_kwargs = mock_post.call_args[1]
            body = call_kwargs["json"]
            assert "username" not in body

    @pytest.mark.asyncio
    async def test_create_git_credential_conflict(self, git_storage_options: dict) -> None:
        """Test creating a git credential when one already exists."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 409
        mock_response.is_success = False

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            with pytest.raises(ApiError, match="A credential already exists for this repository"):
                await storage.create_git_credential(
                    repo_id="test-repo",
                    password="secret-token",
                )

    @pytest.mark.asyncio
    async def test_update_git_credential(self, git_storage_options: dict) -> None:
        """Test updating a git credential."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True
        mock_response.json.return_value = {"id": "cred-123", "created_at": "2024-01-01T00:00:00Z"}

        with patch("httpx.AsyncClient") as mock_client:
            mock_put = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.put = mock_put

            result = await storage.update_git_credential(
                id="cred-123",
                password="new-secret",
                username="newuser",
            )

            assert result["id"] == "cred-123"
            assert result["created_at"] == "2024-01-01T00:00:00Z"

            # Verify the PUT request was made to the correct URL
            mock_put.assert_called_once()
            call_args = mock_put.call_args[0]
            api_url = call_args[0]
            assert api_url == "https://api.test.code.storage/api/v1/repos/git-credentials"

            # Verify the body
            call_kwargs = mock_put.call_args[1]
            body = call_kwargs["json"]
            assert body["id"] == "cred-123"
            assert body["password"] == "new-secret"
            assert body["username"] == "newuser"

    @pytest.mark.asyncio
    async def test_update_git_credential_not_found(self, git_storage_options: dict) -> None:
        """Test updating a git credential that doesn't exist."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.is_success = False

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.put = AsyncMock(
                return_value=mock_response
            )

            with pytest.raises(ApiError, match="Credential not found"):
                await storage.update_git_credential(
                    id="nonexistent-cred",
                    password="new-secret",
                )

    @pytest.mark.asyncio
    async def test_delete_git_credential(self, git_storage_options: dict) -> None:
        """Test deleting a git credential."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            mock_delete = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.delete = mock_delete

            result = await storage.delete_git_credential(id="cred-123")

            assert result is None

            # Verify the DELETE request was made to the correct URL
            mock_delete.assert_called_once()
            call_args = mock_delete.call_args[0]
            api_url = call_args[0]
            assert api_url == "https://api.test.code.storage/api/v1/repos/git-credentials"

            # Verify the body
            call_kwargs = mock_delete.call_args[1]
            body = call_kwargs["json"]
            assert body["id"] == "cred-123"

    @pytest.mark.asyncio
    async def test_delete_git_credential_not_found(self, git_storage_options: dict) -> None:
        """Test deleting a git credential that doesn't exist."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.is_success = False

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.delete = AsyncMock(
                return_value=mock_response
            )

            with pytest.raises(ApiError, match="Credential not found"):
                await storage.delete_git_credential(id="nonexistent-cred")

    def test_create_client_factory(self, git_storage_options: dict) -> None:
        """Test create_client factory function."""
        client = create_client(git_storage_options)
        assert isinstance(client, GitStorage)


class TestJWTGeneration:
    """Tests for JWT generation."""

    @pytest.mark.asyncio
    async def test_jwt_structure(self, git_storage_options: dict, test_key: str) -> None:
        """Test JWT has correct structure."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            repo = await storage.create_repo(id="test-repo")
            url = await repo.get_remote_url()

            # Extract JWT from URL
            import re

            match = re.search(r"https://t:(.+)@test\.code\.storage/test-repo\.git", url)
            assert match is not None
            token = match.group(1)

            # Decode JWT (without verification for testing)
            payload = jwt.decode(token, options={"verify_signature": False})

            assert payload["iss"] == "test-customer"
            assert payload["sub"] == "@pierre/storage"
            assert payload["repo"] == "test-repo"
            assert "scopes" in payload
            assert "iat" in payload
            assert "exp" in payload
            assert payload["exp"] > payload["iat"]

    @pytest.mark.asyncio
    async def test_jwt_default_permissions(self, git_storage_options: dict) -> None:
        """Test JWT has default permissions."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            repo = await storage.create_repo(id="test-repo")
            url = await repo.get_remote_url()

            # Extract and decode JWT
            import re

            match = re.search(r"https://t:(.+)@test\.code\.storage/test-repo\.git", url)
            token = match.group(1)
            payload = jwt.decode(token, options={"verify_signature": False})

            assert payload["scopes"] == ["git:write", "git:read"]

    @pytest.mark.asyncio
    async def test_jwt_custom_permissions(self, git_storage_options: dict) -> None:
        """Test JWT with custom permissions."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            repo = await storage.create_repo(id="test-repo")
            url = await repo.get_remote_url(permissions=["git:read"], ttl=3600)

            # Extract and decode JWT
            import re

            match = re.search(r"https://t:(.+)@test\.code\.storage/test-repo\.git", url)
            token = match.group(1)
            payload = jwt.decode(token, options={"verify_signature": False})

            assert payload["scopes"] == ["git:read"]
            assert payload["exp"] - payload["iat"] == 3600

    @pytest.mark.asyncio
    async def test_get_ephemeral_remote_url(self, git_storage_options: dict) -> None:
        """Test getting ephemeral remote URL."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            repo = await storage.create_repo(id="test-repo")
            url = await repo.get_ephemeral_remote_url()

            # Verify URL has +ephemeral.git suffix
            assert url.endswith("+ephemeral.git")
            assert "test-repo+ephemeral.git" in url

    @pytest.mark.asyncio
    async def test_get_import_remote_url(self, git_storage_options: dict) -> None:
        """Test getting import remote URL."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            repo = await storage.create_repo(id="test-repo")
            url = await repo.get_import_remote_url()

            assert url.endswith("+import.git")
            assert "test-repo+import.git" in url

    @pytest.mark.asyncio
    async def test_get_import_remote_url_with_permissions(
        self, git_storage_options: dict
    ) -> None:
        """Test import remote URL with custom permissions."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            repo = await storage.create_repo(id="test-repo")
            url = await repo.get_import_remote_url(permissions=["git:read"], ttl=3600)

            assert url.endswith("+import.git")

            import re

            match = re.search(r"https://t:(.+)@test\.code\.storage/test-repo\+import\.git", url)
            assert match is not None
            token = match.group(1)
            payload = jwt.decode(token, options={"verify_signature": False})

            assert payload["scopes"] == ["git:read"]
            assert payload["exp"] - payload["iat"] == 3600

    @pytest.mark.asyncio
    async def test_get_ephemeral_remote_url_with_permissions(
        self, git_storage_options: dict
    ) -> None:
        """Test ephemeral remote URL with custom permissions."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            repo = await storage.create_repo(id="test-repo")
            url = await repo.get_ephemeral_remote_url(permissions=["git:read"], ttl=3600)

            # Verify URL structure
            assert url.endswith("+ephemeral.git")

            # Extract and decode JWT
            import re

            match = re.search(r"https://t:(.+)@test\.code\.storage/test-repo\+ephemeral\.git", url)
            assert match is not None
            token = match.group(1)
            payload = jwt.decode(token, options={"verify_signature": False})

            assert payload["scopes"] == ["git:read"]
            assert payload["exp"] - payload["iat"] == 3600

    @pytest.mark.asyncio
    async def test_ephemeral_url_structure(self, git_storage_options: dict) -> None:
        """Test that get_ephemeral_remote_url has correct URL structure."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            repo = await storage.create_repo(id="test-repo")
            ephemeral_url = await repo.get_ephemeral_remote_url(permissions=["git:write"], ttl=1800)

            # Verify URL structure
            import re

            match = re.search(
                r"https://t:(.+)@test\.code\.storage/test-repo\+ephemeral\.git", ephemeral_url
            )
            assert match is not None, f"URL doesn't match expected pattern: {ephemeral_url}"

            # Verify JWT has correct scopes and TTL
            token = match.group(1)
            payload = jwt.decode(token, options={"verify_signature": False})
            assert payload["scopes"] == ["git:write"]
            assert payload["exp"] - payload["iat"] == 1800

    @pytest.mark.asyncio
    async def test_import_url_structure(self, git_storage_options: dict) -> None:
        """Test that get_import_remote_url has correct URL structure."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            repo = await storage.create_repo(id="test-repo")
            import_url = await repo.get_import_remote_url(permissions=["git:write"], ttl=1800)

            import re

            match = re.search(
                r"https://t:(.+)@test\.code\.storage/test-repo\+import\.git", import_url
            )
            assert match is not None, f"URL doesn't match expected pattern: {import_url}"

            token = match.group(1)
            payload = jwt.decode(token, options={"verify_signature": False})
            assert payload["scopes"] == ["git:write"]
            assert payload["exp"] - payload["iat"] == 1800


class TestPublicJWTHelper:
    """Tests for publicly exported generate_jwt function."""

    def test_generate_jwt_basic(self, test_key: str) -> None:
        """Test basic JWT generation with public helper."""
        token = generate_jwt(
            key_pem=test_key,
            issuer="test-customer",
            repo_id="test-repo",
        )

        # Decode and verify structure
        payload = jwt.decode(token, options={"verify_signature": False})

        assert payload["iss"] == "test-customer"
        assert payload["sub"] == "@pierre/storage"
        assert payload["repo"] == "test-repo"
        assert payload["scopes"] == ["git:write", "git:read"]
        assert "iat" in payload
        assert "exp" in payload

    def test_generate_jwt_with_custom_scopes(self, test_key: str) -> None:
        """Test JWT generation with custom scopes."""
        token = generate_jwt(
            key_pem=test_key,
            issuer="test-customer",
            repo_id="test-repo",
            scopes=["git:read"],
        )

        payload = jwt.decode(token, options={"verify_signature": False})
        assert payload["scopes"] == ["git:read"]

    def test_generate_jwt_with_custom_ttl(self, test_key: str) -> None:
        """Test JWT generation with custom TTL."""
        ttl = 3600
        token = generate_jwt(
            key_pem=test_key,
            issuer="test-customer",
            repo_id="test-repo",
            ttl=ttl,
        )

        payload = jwt.decode(token, options={"verify_signature": False})
        assert payload["exp"] - payload["iat"] == ttl

    def test_generate_jwt_with_all_parameters(self, test_key: str) -> None:
        """Test JWT generation with all parameters specified."""
        token = generate_jwt(
            key_pem=test_key,
            issuer="my-company",
            repo_id="my-repo-123",
            scopes=["git:write", "git:read", "repo:write"],
            ttl=7200,
        )

        payload = jwt.decode(token, options={"verify_signature": False})

        assert payload["iss"] == "my-company"
        assert payload["repo"] == "my-repo-123"
        assert payload["scopes"] == ["git:write", "git:read", "repo:write"]
        assert payload["exp"] - payload["iat"] == 7200

    def test_generate_jwt_with_ops(self, test_key: str) -> None:
        """Test JWT generation with policy operations."""
        token = generate_jwt(
            key_pem=test_key,
            issuer="test-customer",
            repo_id="test-repo",
            ops=["no-force-push"],
        )

        payload = jwt.decode(token, options={"verify_signature": False})
        assert payload["ops"] == ["no-force-push"]

    def test_generate_jwt_without_ops(self, test_key: str) -> None:
        """Test JWT generation omits ops when not provided."""
        token = generate_jwt(
            key_pem=test_key,
            issuer="test-customer",
            repo_id="test-repo",
        )

        payload = jwt.decode(token, options={"verify_signature": False})
        assert "ops" not in payload

    def test_generate_jwt_with_empty_ops(self, test_key: str) -> None:
        """Test JWT generation omits ops when empty list."""
        token = generate_jwt(
            key_pem=test_key,
            issuer="test-customer",
            repo_id="test-repo",
            ops=[],
        )

        payload = jwt.decode(token, options={"verify_signature": False})
        assert "ops" not in payload

    def test_generate_jwt_with_refs(self, test_key: str) -> None:
        """Test JWT generation with per-ref policy rules."""
        token = generate_jwt(
            key_pem=test_key,
            issuer="test-customer",
            repo_id="test-repo",
            refs=[
                {"pattern": "refs/heads/main", "ops": ["no-push"]},
                {"pattern": "*", "ops": ["no-force-push"]},
            ],
        )

        payload = jwt.decode(token, options={"verify_signature": False})
        assert payload["refs"] == [
            ["refs/heads/main", ["no-push"]],
            ["*", ["no-force-push"]],
        ]
        assert "ops" not in payload

    def test_generate_jwt_without_refs(self, test_key: str) -> None:
        """Test JWT generation omits refs when not provided."""
        token = generate_jwt(
            key_pem=test_key,
            issuer="test-customer",
            repo_id="test-repo",
        )

        payload = jwt.decode(token, options={"verify_signature": False})
        assert "refs" not in payload

    def test_generate_jwt_default_ttl(self, test_key: str) -> None:
        """Test JWT generation uses 1 year default TTL."""
        token = generate_jwt(
            key_pem=test_key,
            issuer="test-customer",
            repo_id="test-repo",
        )

        payload = jwt.decode(token, options={"verify_signature": False})
        # Default TTL is 1 year (31536000 seconds)
        assert payload["exp"] - payload["iat"] == 31536000

    def test_generate_jwt_invalid_key(self) -> None:
        """Test JWT generation with invalid key."""
        with pytest.raises(ValueError, match="Failed to load private key"):
            generate_jwt(
                key_pem="invalid-key",
                issuer="test-customer",
                repo_id="test-repo",
            )

    def test_generate_jwt_signature_valid(self, test_key: str) -> None:
        """Test that generated JWT signature can be verified."""
        from cryptography.hazmat.primitives import serialization

        # Generate token
        token = generate_jwt(
            key_pem=test_key,
            issuer="test-customer",
            repo_id="test-repo",
        )

        # Load public key for verification
        private_key = serialization.load_pem_private_key(
            test_key.encode("utf-8"),
            password=None,
        )
        public_key = private_key.public_key()
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )

        # Verify signature
        payload = jwt.decode(
            token,
            public_pem,
            algorithms=["ES256"],
        )

        assert payload["iss"] == "test-customer"
        assert payload["repo"] == "test-repo"


class TestAPIURLConstruction:
    """Tests for API URL construction with organization names."""

    def test_get_default_api_base_url(self) -> None:
        """Test that get_default_api_base_url inserts org name correctly."""
        url = GitStorage.get_default_api_base_url("test-org")
        assert url == "https://api.test-org.code.storage"

        url2 = GitStorage.get_default_api_base_url("production")
        assert url2 == "https://api.production.code.storage"

    def test_get_default_storage_base_url(self) -> None:
        """Test that get_default_storage_base_url inserts org name correctly."""
        url = GitStorage.get_default_storage_base_url("test-org")
        assert url == "test-org.code.storage"

        url2 = GitStorage.get_default_storage_base_url("production")
        assert url2 == "production.code.storage"

    @pytest.mark.asyncio
    async def test_api_requests_use_correct_url_with_org_name(
        self, git_storage_options: dict, test_key: str
    ) -> None:
        """Test that API requests are made to URLs with org name inserted."""
        # Create storage with name "test-customer"
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.json = MagicMock(
            return_value={"repo_id": "test-repo", "url": "https://example.com/repo.git"}
        )
        mock_response.status_code = 200
        mock_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            await storage.create_repo(id="test-repo")

            # Verify the POST request was made to the correct API URL
            # The URL should be https://api.test.code.storage (from fixture)
            mock_post.assert_called_once()
            call_args = mock_post.call_args[0]
            assert len(call_args) > 0
            api_url = call_args[0]
            assert api_url == "https://api.test.code.storage/api/v1/repos"

    @pytest.mark.asyncio
    async def test_api_requests_with_default_url_uses_org_name(self, test_key: str) -> None:
        """Test that API requests use org name when no custom URL is provided."""
        # Create storage without custom api_base_url
        storage = GitStorage({"name": "my-org", "key": test_key})

        mock_response = MagicMock()
        mock_response.json = MagicMock(
            return_value={"repo_id": "test-repo", "url": "https://example.com/repo.git"}
        )
        mock_response.status_code = 200
        mock_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            await storage.create_repo(id="test-repo")

            # Verify the POST request was made with org name in URL
            mock_post.assert_called_once()
            call_args = mock_post.call_args[0]
            api_url = call_args[0]
            # Should be https://api.my-org.code.storage when using defaults
            assert api_url == "https://api.my-org.code.storage/api/v1/repos"

    @pytest.mark.asyncio
    async def test_custom_api_url_overrides_default(self, test_key: str) -> None:
        """Test that custom API URL takes precedence over default with org name."""
        custom_url = "https://custom-api.example.com"
        storage = GitStorage({"name": "my-org", "key": test_key, "api_base_url": custom_url})

        mock_response = MagicMock()
        mock_response.json = MagicMock(
            return_value={"repo_id": "test-repo", "url": "https://example.com/repo.git"}
        )
        mock_response.status_code = 200
        mock_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            await storage.create_repo(id="test-repo")

            # Verify the POST request uses custom URL, not default with org name
            mock_post.assert_called_once()
            call_args = mock_post.call_args[0]
            api_url = call_args[0]
            assert api_url == f"{custom_url}/api/v1/repos"


class TestCodeStorageAgentHeader:
    """Tests for Code-Storage-Agent header in API requests."""

    @pytest.mark.asyncio
    async def test_create_repo_includes_agent_header(self, git_storage_options: dict) -> None:
        """Test that createRepo includes Code-Storage-Agent header."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.json = MagicMock(
            return_value={"repo_id": "test-repo", "url": "https://example.com/repo.git"}
        )
        mock_response.status_code = 200
        mock_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            await storage.create_repo(id="test-repo")

            # Verify headers include Code-Storage-Agent
            mock_post.assert_called_once()
            call_kwargs = mock_post.call_args[1]
            headers = call_kwargs["headers"]
            assert "Code-Storage-Agent" in headers
            assert headers["Code-Storage-Agent"] == get_user_agent()

    @pytest.mark.asyncio
    async def test_find_one_includes_agent_header(self, git_storage_options: dict) -> None:
        """Test that findOne includes Code-Storage-Agent header."""
        storage = GitStorage(git_storage_options)

        mock_response = MagicMock()
        mock_response.json = MagicMock(
            return_value={"repo_id": "test-repo", "url": "https://example.com/repo.git"}
        )
        mock_response.status_code = 200
        mock_response.is_success = True

        with patch("httpx.AsyncClient") as mock_client:
            mock_get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.get = mock_get

            await storage.find_one(id="test-repo")

            # Verify headers include Code-Storage-Agent
            mock_get.assert_called_once()
            call_kwargs = mock_get.call_args[1]
            headers = call_kwargs["headers"]
            assert "Code-Storage-Agent" in headers
            assert headers["Code-Storage-Agent"] == get_user_agent()
