"""Main client for Pierre Git Storage SDK."""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union, cast
from urllib.parse import urlencode

import httpx

from pierre_storage.auth import generate_jwt
from pierre_storage.errors import ApiError
from pierre_storage.repo import DEFAULT_TOKEN_TTL_SECONDS, RepoImpl
from pierre_storage.types import (
    BaseRepo,
    CreateGitCredentialResult,
    DeleteRepoResult,
    DeploymentSettings,
    ForkBaseRepo,
    GenericGitBaseRepo,
    GitCredential,
    GitHubBaseRepo,
    GitStorageOptions,
    ListReposResult,
    Repo,
    RepoInfo,
    UpdateRepoResult,
)
from pierre_storage.version import get_user_agent

DEFAULT_API_BASE_URL = "https://api.{{org}}.code.storage"
DEFAULT_STORAGE_BASE_URL = "{{org}}.code.storage"
DEFAULT_API_VERSION = 1


def _deployment_settings_payload(settings: DeploymentSettings) -> Dict[str, Any]:
    """Validate and copy deployment settings without rewriting environment keys."""
    if not settings:
        raise ValueError("deployment must include at least one setting")
    region = settings.get("serverless_function_region")
    if isinstance(region, str) and len(region) > 4:
        raise ValueError("deployment.serverless_function_region must not exceed 4 characters")
    if "env" in settings and not settings["env"]:
        raise ValueError("deployment.env must include at least one variable")
    return dict(settings)


class GitStorage:
    """Pierre Git Storage client."""

    def __init__(self, options: GitStorageOptions) -> None:
        """Initialize GitStorage client.

        Args:
            options: Client configuration options

        Raises:
            ValueError: If required options are missing or invalid
        """
        # Validate required fields
        if not options or "name" not in options:
            raise ValueError(
                "GitStorage requires a name. Please check your configuration and try again."
            )

        name = options["name"]

        if name is None:
            raise ValueError(
                "GitStorage requires a name. Please check your configuration and try again."
            )

        if not isinstance(name, str) or not name.strip():
            raise ValueError("GitStorage name must be a non-empty string.")

        has_key = "key" in options and options.get("key") is not None
        has_token = "token" in options and options.get("token") is not None

        if not has_key and not has_token:
            raise ValueError(
                "GitStorage requires either a key or a token. "
                "Please check your configuration and try again."
            )

        if has_key:
            key = options["key"]
            if not isinstance(key, str) or not key.strip():
                raise ValueError("GitStorage key must be a non-empty string.")

        if has_token:
            token = options["token"]
            if not isinstance(token, str) or not token.strip():
                raise ValueError("GitStorage token must be a non-empty string.")

        # Resolve configuration
        api_base_url = options.get("api_base_url") or self.get_default_api_base_url(name)
        storage_base_url = options.get("storage_base_url") or self.get_default_storage_base_url(
            name
        )
        api_version = options.get("api_version") or DEFAULT_API_VERSION
        default_ttl = options.get("default_ttl")

        self.options: GitStorageOptions = {
            "name": name,
            "api_base_url": api_base_url,
            "storage_base_url": storage_base_url,
            "api_version": api_version,
        }

        if has_key:
            self.options["key"] = options["key"]

        if has_token:
            self.options["token"] = options["token"]

        if default_ttl:
            self.options["default_ttl"] = default_ttl

    @staticmethod
    def get_default_api_base_url(name: str) -> str:
        """Get default API base URL with org name inserted.

        Args:
            name: Organization name

        Returns:
            API base URL with org name inserted
        """
        return DEFAULT_API_BASE_URL.replace("{{org}}", name)

    @staticmethod
    def get_default_storage_base_url(name: str) -> str:
        """Get default storage base URL with org name inserted.

        Args:
            name: Organization name

        Returns:
            Storage base URL with org name inserted
        """
        return DEFAULT_STORAGE_BASE_URL.replace("{{org}}", name)

    async def create_repo(
        self,
        *,
        id: Optional[str] = None,
        default_branch: Optional[str] = None,
        base_repo: Optional[BaseRepo] = None,
        deployment: Optional[DeploymentSettings] = None,
        ttl: Optional[int] = None,
    ) -> Repo:
        """Create a new repository.

        Args:
            id: Repository ID (auto-generated if not provided)
            default_branch: Default branch name (default: "main" for non-forks)
            base_repo: Optional external upstream or internal fork configuration
            deployment: Optional repository deployment settings
            ttl: Token TTL in seconds

        Returns:
            Created repository instance

        Raises:
            ApiError: If repository creation fails
        """
        repo_id = id or str(uuid.uuid4())
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        deployment_payload = (
            _deployment_settings_payload(deployment) if deployment is not None else None
        )
        permissions = ["repo:write"]
        if deployment is not None and "env" in deployment:
            permissions.append("deployment:write")
        jwt = self._generate_jwt(
            repo_id,
            {"permissions": permissions, "ttl": ttl},
        )

        url = f"{self.options['api_base_url']}/api/v{self.options['api_version']}/repos"
        body: Dict[str, Any] = {}
        if deployment_payload is not None:
            body["deployment"] = deployment_payload

        # Match backend priority: base_repo.default_branch > default_branch > 'main'
        explicit_default_branch = default_branch is not None
        resolved_default_branch: Optional[str] = None

        if base_repo:
            if "id" in base_repo:
                fork_repo = cast(ForkBaseRepo, base_repo)
                base_repo_token = self._generate_jwt(
                    fork_repo["id"],
                    {"permissions": ["git:read"], "ttl": ttl},
                )
                base_repo_payload: Dict[str, Any] = {
                    "provider": "code",
                    "owner": self.options["name"],
                    "name": fork_repo["id"],
                    "operation": "fork",
                    "auth": {"token": base_repo_token},
                }
                if fork_repo.get("ref"):
                    base_repo_payload["ref"] = fork_repo["ref"]
                if fork_repo.get("sha"):
                    base_repo_payload["sha"] = fork_repo["sha"]
                body["base_repo"] = base_repo_payload
                if explicit_default_branch:
                    resolved_default_branch = default_branch
                    body["default_branch"] = default_branch
            else:
                # Sync base repo: GitHub or generic git provider (gitlab, bitbucket, etc.)
                sync_repo = cast(Union[GitHubBaseRepo, GenericGitBaseRepo], base_repo)
                # Use the provider from base_repo if set, defaulting to "github"
                body["base_repo"] = {
                    "provider": "github",
                    **sync_repo,
                }
                if sync_repo.get("default_branch"):
                    resolved_default_branch = sync_repo["default_branch"]
                elif explicit_default_branch:
                    resolved_default_branch = default_branch
                else:
                    resolved_default_branch = "main"
                body["default_branch"] = resolved_default_branch
        else:
            resolved_default_branch = default_branch if explicit_default_branch else "main"
            body["default_branch"] = resolved_default_branch

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json",
                    "Code-Storage-Agent": get_user_agent(),
                },
                json=body,
                timeout=30.0,
            )

            if response.status_code == 409 and deployment is None:
                raise ApiError("Repository already exists", status_code=409)

            if not response.is_success:
                message = (
                    f"Failed to create repository: {response.status_code} {response.reason_phrase}"
                )
                try:
                    error_data = response.json()
                    if isinstance(error_data, dict) and isinstance(error_data.get("error"), str):
                        message = error_data["error"]
                except ValueError:
                    pass
                raise ApiError(
                    message,
                    status_code=response.status_code,
                    response=response,
                )

        return self.repo(
            id=repo_id,
            default_branch=resolved_default_branch or "main",
            created_at=datetime.now(timezone.utc).isoformat(),
        )

    async def update_repo(
        self,
        *,
        id: str,
        default_branch: Optional[str] = None,
        deployment: Optional[DeploymentSettings] = None,
        ttl: Optional[int] = None,
    ) -> UpdateRepoResult:
        """Update repository metadata or deployment settings."""
        repo_id = id.strip()
        if not repo_id:
            raise ValueError("update_repo id is required")

        body: Dict[str, Any] = {}
        if default_branch is not None and default_branch.strip():
            body["default_branch"] = default_branch.strip()
        if deployment is not None:
            body["deployment"] = _deployment_settings_payload(deployment)
        if not body:
            raise ValueError("update_repo requires default_branch or deployment settings")

        permissions = ["repo:write"]
        if deployment is not None and "env" in deployment:
            permissions.append("deployment:write")
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self._generate_jwt(repo_id, {"permissions": permissions, "ttl": ttl})
        url = f"{self.options['api_base_url']}/api/v{self.options['api_version']}/repo"

        async with httpx.AsyncClient() as client:
            response = await client.patch(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json",
                    "Code-Storage-Agent": get_user_agent(),
                },
                json=body,
                timeout=30.0,
            )
            if not response.is_success:
                message = (
                    f"Failed to update repository: {response.status_code} {response.reason_phrase}"
                )
                try:
                    error_data = response.json()
                    if isinstance(error_data, dict) and isinstance(error_data.get("error"), str):
                        message = error_data["error"]
                except ValueError:
                    pass
                raise ApiError(
                    message,
                    status_code=response.status_code,
                    response=response,
                )
            data = response.json()

        return {
            "repo_id": str(data["repo_id"]),
            "repo_name": str(data["repo_name"]),
            "default_branch": str(data["default_branch"]),
        }

    async def list_repos(
        self,
        *,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
        q: Optional[str] = None,
        ttl: Optional[int] = None,
    ) -> ListReposResult:
        """List repositories for the organization.

        Pass ``q`` to filter by a case-insensitive substring match against the
        repository ``url``. Empty/whitespace ``q`` is treated as omitted.
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self._generate_jwt(
            "org",
            {"permissions": ["org:read"], "ttl": ttl},
        )

        params: Dict[str, str] = {}
        if cursor:
            params["cursor"] = cursor
        if limit is not None:
            params["limit"] = str(limit)
        if q is not None:
            q_clean = q.strip()
            if q_clean:
                params["q"] = q_clean

        url = f"{self.options['api_base_url']}/api/v{self.options['api_version']}/repos"
        if params:
            url += f"?{urlencode(params)}"

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Code-Storage-Agent": get_user_agent(),
                },
                timeout=30.0,
            )

            if not response.is_success:
                raise ApiError(
                    f"Failed to list repositories: {response.status_code} {response.reason_phrase}",
                    status_code=response.status_code,
                    response=response,
                )

            data = response.json()
            repos: list[RepoInfo] = []
            for repo in data.get("repos", []):
                entry: RepoInfo = {
                    "repo_id": repo.get("repo_id", ""),
                    "url": repo.get("url", ""),
                    "default_branch": repo.get("default_branch", "main"),
                    "created_at": repo.get("created_at", ""),
                }
                if repo.get("base_repo"):
                    entry["base_repo"] = repo.get("base_repo")
                repos.append(entry)

            return {
                "repos": repos,
                "next_cursor": data.get("next_cursor"),
                "has_more": data.get("has_more", False),
            }

    async def find_one(self, *, id: str) -> Optional[Repo]:
        """Find a repository by ID.

        Args:
            id: Repository ID to find

        Returns:
            Repository instance if found, None otherwise
        """
        repo_id = id
        jwt = self._generate_jwt(
            repo_id,
            {"permissions": ["git:read"], "ttl": DEFAULT_TOKEN_TTL_SECONDS},
        )

        url = f"{self.options['api_base_url']}/api/v{self.options['api_version']}/repo"

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Code-Storage-Agent": get_user_agent(),
                },
                timeout=30.0,
            )

            if response.status_code == 404:
                return None

            if not response.is_success:
                raise ApiError(
                    f"Failed to find repository: {response.status_code} {response.reason_phrase}",
                    status_code=response.status_code,
                    response=response,
                )

            body = response.json()
            default_branch = body.get("default_branch", "main")
            created_at = body.get("created_at", "")

        return self.repo(id=repo_id, default_branch=default_branch, created_at=created_at)

    def repo(
        self,
        *,
        id: str,
        default_branch: Optional[str] = None,
        created_at: Optional[str] = None,
    ) -> Repo:
        """Create a Repo handle from known metadata without making an HTTP request.

        Args:
            id: Repository ID
            default_branch: Optional default branch (defaults to "main")
            created_at: Optional creation timestamp (defaults to "")

        Returns:
            Repository instance

        Raises:
            ValueError: If id is missing or invalid
        """
        if not isinstance(id, str) or not id.strip():
            raise ValueError("repo requires a non-empty repository id.")

        # These are guaranteed to be set in __init__
        api_base_url: str = self.options["api_base_url"]  # type: ignore[assignment]
        storage_base_url: str = self.options["storage_base_url"]  # type: ignore[assignment]
        name: str = self.options["name"]
        api_version: int = self.options["api_version"]  # type: ignore[assignment]

        return RepoImpl(
            id,
            default_branch or "main",
            api_base_url,
            storage_base_url,
            name,
            api_version,
            self._generate_jwt,
            created_at=created_at or "",
        )

    async def delete_repo(
        self,
        *,
        id: str,
        ttl: Optional[int] = None,
    ) -> DeleteRepoResult:
        """Delete a repository by ID.

        Args:
            id: Repository ID to delete
            ttl: Token TTL in seconds

        Returns:
            Deletion result with repo_id and message

        Raises:
            ApiError: If repository not found or already deleted
        """
        repo_id = id
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self._generate_jwt(
            repo_id,
            {"permissions": ["repo:write"], "ttl": ttl},
        )

        url = f"{self.options['api_base_url']}/api/v{self.options['api_version']}/repos/delete"

        async with httpx.AsyncClient() as client:
            response = await client.delete(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json",
                    "Code-Storage-Agent": get_user_agent(),
                },
                timeout=30.0,
            )

            if response.status_code == 404:
                raise ApiError("Repository not found", status_code=404)

            if response.status_code == 409:
                raise ApiError("Repository already deleted", status_code=409)

            if not response.is_success:
                raise ApiError(
                    f"Failed to delete repository: {response.status_code} {response.reason_phrase}",
                    status_code=response.status_code,
                    response=response,
                )

            body = response.json()
            return DeleteRepoResult(
                repo_id=body["repo_id"],
                message=body["message"],
            )

    async def create_git_credential(
        self,
        *,
        repo_id: str,
        password: str,
        username: Optional[str] = None,
        ttl: Optional[int] = None,
    ) -> CreateGitCredentialResult:
        """Create a generic git credential for a repository.

        Args:
            repo_id: Repository ID to associate the credential with
            password: Password or token for authentication
            username: Optional username for authentication
            ttl: Token TTL in seconds

        Returns:
            Created credential with id

        Raises:
            ApiError: If credential creation fails or already exists
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self._generate_jwt(
            repo_id,
            {"permissions": ["repo:write"], "ttl": ttl},
        )

        body: Dict[str, Any] = {
            "repo_id": repo_id,
            "password": password,
        }
        if username is not None:
            body["username"] = username

        url = f"{self.options['api_base_url']}/api/v{self.options['api_version']}/repos/git-credentials"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json",
                    "Code-Storage-Agent": get_user_agent(),
                },
                json=body,
                timeout=30.0,
            )

            if response.status_code == 409:
                raise ApiError("A credential already exists for this repository", status_code=409)

            if not response.is_success:
                raise ApiError(
                    f"Failed to create git credential: {response.status_code} {response.reason_phrase}",
                    status_code=response.status_code,
                    response=response,
                )

            data = response.json()
            return CreateGitCredentialResult(id=data["id"])

    async def update_git_credential(
        self,
        *,
        id: str,
        password: str,
        username: Optional[str] = None,
        ttl: Optional[int] = None,
    ) -> GitCredential:
        """Update an existing generic git credential.

        Args:
            id: Credential ID to update
            password: New password or token
            username: Optional new username
            ttl: Token TTL in seconds

        Returns:
            Updated credential info

        Raises:
            ApiError: If credential not found or update fails
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self._generate_jwt(
            "org",
            {"permissions": ["repo:write"], "ttl": ttl},
        )

        body: Dict[str, Any] = {
            "id": id,
            "password": password,
        }
        if username is not None:
            body["username"] = username

        url = f"{self.options['api_base_url']}/api/v{self.options['api_version']}/repos/git-credentials"

        async with httpx.AsyncClient() as client:
            response = await client.put(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json",
                    "Code-Storage-Agent": get_user_agent(),
                },
                json=body,
                timeout=30.0,
            )

            if response.status_code == 404:
                raise ApiError("Credential not found", status_code=404)

            if not response.is_success:
                raise ApiError(
                    f"Failed to update git credential: {response.status_code} {response.reason_phrase}",
                    status_code=response.status_code,
                    response=response,
                )

            data = response.json()
            result: GitCredential = {"id": data["id"]}
            if data.get("created_at"):
                result["created_at"] = data["created_at"]
            return result

    async def delete_git_credential(
        self,
        *,
        id: str,
        ttl: Optional[int] = None,
    ) -> None:
        """Delete a generic git credential.

        Args:
            id: Credential ID to delete
            ttl: Token TTL in seconds

        Raises:
            ApiError: If credential not found or deletion fails
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self._generate_jwt(
            "org",
            {"permissions": ["repo:write"], "ttl": ttl},
        )

        url = f"{self.options['api_base_url']}/api/v{self.options['api_version']}/repos/git-credentials"

        async with httpx.AsyncClient() as client:
            response = await client.request(
                "DELETE",
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json",
                    "Code-Storage-Agent": get_user_agent(),
                },
                json={"id": id},
                timeout=30.0,
            )

            if response.status_code == 404:
                raise ApiError("Credential not found", status_code=404)

            if not response.is_success:
                raise ApiError(
                    f"Failed to delete git credential: {response.status_code} {response.reason_phrase}",
                    status_code=response.status_code,
                    response=response,
                )

    def get_config(self) -> GitStorageOptions:
        """Get current client configuration.

        Returns:
            Copy of current configuration
        """
        return {**self.options}

    def _generate_jwt(
        self,
        repo_id: str,
        options: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Generate JWT token for authentication.

        Args:
            repo_id: Repository identifier
            options: JWT generation options (internal use)

        Returns:
            Signed JWT token or pre-minted token if set
        """
        token = self.options.get("token")
        if token:
            return token

        key = self.options.get("key")
        if not key:
            raise ValueError("GitStorage requires a key to generate a JWT.")

        permissions = ["git:write", "git:read"]
        ttl: int = 31536000  # 1 year default
        ops: Optional[List[str]] = None
        refs = None

        if options:
            if "permissions" in options:
                permissions = options["permissions"]
            if "ttl" in options:
                option_ttl = options["ttl"]
                if isinstance(option_ttl, int):
                    ttl = option_ttl
            if "ops" in options:
                ops = options["ops"]
            if "refs" in options:
                refs = options["refs"]
        elif "default_ttl" in self.options:
            default_ttl = self.options["default_ttl"]
            if isinstance(default_ttl, int):
                ttl = default_ttl

        return generate_jwt(
            key,
            self.options["name"],
            repo_id,
            permissions,
            ttl,
            ops,
            refs,
        )


def create_client(options: GitStorageOptions) -> GitStorage:
    """Create a GitStorage client.

    Args:
        options: Client configuration options

    Returns:
        GitStorage client instance
    """
    return GitStorage(options)
