"""Repository implementation for Pierre Git Storage SDK."""

import contextlib
import warnings
from datetime import datetime, timezone
from types import TracebackType
from typing import Any, Callable, Dict, List, Literal, Optional
from urllib.parse import urlencode

import httpx

from pierre_storage.commit import (
    CommitBuilderImpl,
    resolve_commit_ttl_seconds,
    send_diff_commit_request,
)
from pierre_storage.errors import ApiError, RefUpdateError, infer_ref_update_reason
from pierre_storage.types import (
    BranchInfo,
    CommitBuilder,
    CommitInfo,
    CommitMetadata,
    CommitResult,
    CommitSignature,
    CreateBranchResult,
    CreateCommitOptions,
    CreateTagResult,
    DeleteBranchResult,
    DeleteTagResult,
    DiffFileState,
    FileDiff,
    FileSource,
    FileWithMetadata,
    FilteredFile,
    GetBranchDiffResult,
    GetCommitDiffResult,
    GetCommitResult,
    GrepFileMatch,
    GrepLine,
    GrepResult,
    ListBranchesResult,
    ListCommitsResult,
    ListFilesResult,
    ListFilesWithMetadataResult,
    ListTagsResult,
    MergeBranchesResult,
    MergeStrategy,
    NoteReadResult,
    NoteWriteResult,
    RefUpdate,
    RestoreCommitResult,
    TagInfo,
)
from pierre_storage.version import get_user_agent

DEFAULT_TOKEN_TTL_SECONDS = 3600  # 1 hour
ZERO_DATETIME_UTC = datetime.min.replace(tzinfo=timezone.utc)


class StreamingResponse:
    """Stream wrapper that keeps the HTTP client alive until closed."""

    def __init__(self, response: httpx.Response, client: httpx.AsyncClient, stream_context: Optional[contextlib.AbstractAsyncContextManager] = None) -> None:
        self._response = response
        self._client = client
        self._stream_context = stream_context

    def __getattr__(self, name: str) -> Any:
        return getattr(self._response, name)

    async def aclose(self) -> None:
        await self._response.aclose()
        if self._stream_context is not None:
            await self._stream_context.__aexit__(None, None, None)
        await self._client.aclose()

    async def __aenter__(self) -> "StreamingResponse":
        return self

    async def __aexit__(
        self,
        exc_type: Optional[type[BaseException]],
        exc: Optional[BaseException],
        tb: Optional[TracebackType],
    ) -> None:
        await self.aclose()


def resolve_invocation_ttl_seconds(
    options: Optional[Dict[str, Any]] = None,
    default_value: int = DEFAULT_TOKEN_TTL_SECONDS,
) -> int:
    """Resolve TTL for API invocations."""
    if options and "ttl" in options:
        ttl = options["ttl"]
        if isinstance(ttl, int) and ttl > 0:
            return int(ttl)
    return default_value


def normalize_diff_state(raw_state: str) -> DiffFileState:
    """Normalize diff state from raw format."""
    if not raw_state:
        return DiffFileState.UNKNOWN

    leading = raw_state.strip()[0].upper() if raw_state.strip() else ""
    state_map = {
        "A": DiffFileState.ADDED,
        "M": DiffFileState.MODIFIED,
        "D": DiffFileState.DELETED,
        "R": DiffFileState.RENAMED,
        "C": DiffFileState.COPIED,
        "T": DiffFileState.TYPE_CHANGED,
        "U": DiffFileState.UNMERGED,
    }
    return state_map.get(leading, DiffFileState.UNKNOWN)


def normalize_optional_ref(value: Optional[str]) -> Optional[str]:
    """Normalize optional branch/ref inputs by trimming blanks to None."""
    if value is None:
        return None

    normalized = value.strip()
    return normalized or None


def normalize_optional_string(value: Optional[str]) -> Optional[str]:
    """Normalize optional string inputs by trimming blanks to None."""
    if value is None:
        return None

    normalized = value.strip()
    return normalized or None


def normalize_optional_signature(
    value: Optional[CommitSignature],
    field_name: Literal["author", "committer"],
) -> Optional[CommitSignature]:
    """Validate and normalize an optional git signature."""
    if value is None:
        return None

    name = (value.get("name") or "").strip()
    email = (value.get("email") or "").strip()
    if not name or not email:
        raise ValueError(f"merge {field_name} name and email are required")

    return {"name": name, "email": email}


class RepoImpl:
    """Implementation of repository operations."""

    def __init__(
        self,
        repo_id: str,
        default_branch: str,
        api_base_url: str,
        storage_base_url: str,
        name: str,
        api_version: int,
        generate_jwt: Callable[[str, Optional[Dict[str, Any]]], str],
        created_at: str = "",
    ) -> None:
        """Initialize repository.

        Args:
            repo_id: Repository identifier
            default_branch: Default branch name
            api_base_url: API base URL
            storage_base_url: Storage base URL
            name: Customer name
            api_version: API version
            generate_jwt: Function to generate JWT tokens
            created_at: Repository creation timestamp
        """
        self._id = repo_id
        self._default_branch = default_branch
        self._created_at = created_at
        self.api_base_url = api_base_url.rstrip("/")
        self.storage_base_url = storage_base_url
        self.name = name
        self.api_version = api_version
        self.generate_jwt = generate_jwt

    @property
    def id(self) -> str:
        """Get repository ID."""
        return self._id

    @property
    def default_branch(self) -> str:
        """Get default branch name."""
        return self._default_branch

    @property
    def created_at(self) -> str:
        """Get repository creation timestamp."""
        return self._created_at

    async def get_remote_url(
        self,
        *,
        permissions: Optional[list[str]] = None,
        ttl: Optional[int] = None,
        ops: Optional[list[str]] = None,
    ) -> str:
        """Get remote URL for Git operations.

        Args:
            permissions: List of permissions (e.g., ["git:write", "git:read"])
            ttl: Token TTL in seconds
            ops: List of policy operations (e.g., ["no-force-push"])

        Returns:
            Git remote URL with embedded JWT
        """
        options: Dict[str, Any] = {}
        if permissions is not None:
            options["permissions"] = permissions
        if ttl is not None:
            options["ttl"] = ttl
        if ops is not None:
            options["ops"] = ops

        jwt_token = self.generate_jwt(self._id, options if options else None)
        url = f"https://t:{jwt_token}@{self.storage_base_url}/{self._id}.git"
        return url

    async def get_import_remote_url(
        self,
        *,
        permissions: Optional[list[str]] = None,
        ttl: Optional[int] = None,
        ops: Optional[list[str]] = None,
    ) -> str:
        """Get import remote URL for Git operations.

        Args:
            permissions: List of permissions (e.g., ["git:write", "git:read"])
            ttl: Token TTL in seconds
            ops: List of policy operations (e.g., ["no-force-push"])

        Returns:
            Git remote URL with embedded JWT pointing to import namespace
        """
        url = await self.get_remote_url(permissions=permissions, ttl=ttl, ops=ops)
        return url.replace(".git", "+import.git")

    async def get_ephemeral_remote_url(
        self,
        *,
        permissions: Optional[list[str]] = None,
        ttl: Optional[int] = None,
        ops: Optional[list[str]] = None,
    ) -> str:
        """Get ephemeral remote URL for Git operations.

        Args:
            permissions: List of permissions (e.g., ["git:write", "git:read"])
            ttl: Token TTL in seconds
            ops: List of policy operations (e.g., ["no-force-push"])

        Returns:
            Git remote URL with embedded JWT pointing to ephemeral namespace
        """
        url = await self.get_remote_url(permissions=permissions, ttl=ttl, ops=ops)
        return url.replace(".git", "+ephemeral.git")

    async def get_file_stream(
        self,
        *,
        path: str,
        ref: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        ttl: Optional[int] = None,
    ) -> StreamingResponse:
        """Get file content as streaming response.

        Args:
            path: File path to retrieve
            ref: Git ref (branch, tag, or commit SHA)
            ephemeral: Whether to read from the ephemeral namespace
            ttl: Token TTL in seconds

        Returns:
            HTTP response with file content stream
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl})

        params = {"path": path}
        if ref:
            params["ref"] = ref
        if ephemeral is not None:
            params["ephemeral"] = "true" if ephemeral else "false"

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/file"
        if params:
            url += f"?{urlencode(params)}"

        client = httpx.AsyncClient()
        try:
            stream_context = client.stream(
                "GET",
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Code-Storage-Agent": get_user_agent(),
                },
                timeout=30.0,
            )
            response = await stream_context.__aenter__()
            response.raise_for_status()
        except Exception:
            await client.aclose()
            raise

        return StreamingResponse(response, client, stream_context)

    async def get_archive_stream(
        self,
        *,
        ref: Optional[str] = None,
        include_globs: Optional[List[str]] = None,
        exclude_globs: Optional[List[str]] = None,
        max_blob_size: Optional[int] = None,
        archive_prefix: Optional[str] = None,
        ttl: Optional[int] = None,
    ) -> StreamingResponse:
        """Get repository archive as streaming response.

        Args:
            ref: Git ref (branch, tag, or commit SHA)
            include_globs: Optional include globs for archived files
            exclude_globs: Optional exclude globs for archived files
            max_blob_size: Optional max blob size in bytes
            archive_prefix: Optional archive prefix for tar entries
            ttl: Token TTL in seconds

        Returns:
            HTTP response with archive stream
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl})

        body: Dict[str, Any] = {}
        if ref and ref.strip():
            body["ref"] = ref.strip()
        if include_globs:
            body["include_globs"] = include_globs
        if exclude_globs:
            body["exclude_globs"] = exclude_globs
        if max_blob_size is not None:
            body["max_blob_size"] = max_blob_size
        if archive_prefix and archive_prefix.strip():
            body["archive"] = {"prefix": archive_prefix.strip()}

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/archive"

        client = httpx.AsyncClient()
        try:
            request_kwargs: Dict[str, Any] = {
                "headers": {
                    "Authorization": f"Bearer {jwt}",
                    "Code-Storage-Agent": get_user_agent(),
                },
                "timeout": 30.0,
            }
            if body:
                request_kwargs["json"] = body
            stream_context = client.stream("POST", url, **request_kwargs)
            response = await stream_context.__aenter__()
            response.raise_for_status()
        except Exception:
            await client.aclose()
            raise

        return StreamingResponse(response, client, stream_context)

    async def list_files(
        self,
        *,
        ref: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        ttl: Optional[int] = None,
    ) -> ListFilesResult:
        """List files in repository.

        Args:
            ref: Git ref (branch, tag, or commit SHA)
            ephemeral: Whether to read from the ephemeral namespace
            ttl: Token TTL in seconds

        Returns:
            List of file paths and ref
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl})

        params = {}
        if ref:
            params["ref"] = ref
        if ephemeral is not None:
            params["ephemeral"] = "true" if ephemeral else "false"

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/files"
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
            response.raise_for_status()
            data = response.json()
            return {"paths": data["paths"], "ref": data["ref"]}

    async def list_files_with_metadata(
        self,
        *,
        ref: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        ttl: Optional[int] = None,
    ) -> ListFilesWithMetadataResult:
        """List files with metadata in repository.

        Args:
            ref: Git ref (branch, tag, or commit SHA)
            ephemeral: Whether to read from the ephemeral namespace
            ttl: Token TTL in seconds

        Returns:
            Files with mode/size/last commit metadata and resolved ref
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl})

        params = {}
        if ref:
            params["ref"] = ref
        if ephemeral is not None:
            params["ephemeral"] = "true" if ephemeral else "false"

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/files/metadata"
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
            response.raise_for_status()
            data = response.json()

            files: List[FileWithMetadata] = [
                {
                    "path": file["path"],
                    "mode": file["mode"],
                    "size": file["size"],
                    "last_commit_sha": file["last_commit_sha"],
                }
                for file in data["files"]
            ]

            commits: Dict[str, CommitMetadata] = {}
            for sha, commit in data["commits"].items():
                raw_date = commit["date"]
                try:
                    parsed_date = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
                except (AttributeError, TypeError, ValueError):
                    parsed_date = ZERO_DATETIME_UTC
                commits[sha] = {
                    "author": commit["author"],
                    "date": parsed_date,
                    "raw_date": raw_date,
                    "message": commit["message"],
                }

            return {"files": files, "commits": commits, "ref": data["ref"]}

    async def list_branches(
        self,
        *,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
        ephemeral: Optional[bool] = None,
        ttl: Optional[int] = None,
    ) -> ListBranchesResult:
        """List branches in repository.

        Args:
            cursor: Pagination cursor
            limit: Maximum number of branches to return
            ephemeral: When true, list branches under the ephemeral namespace
            ttl: Token TTL in seconds

        Returns:
            List of branches with pagination info
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl})

        params = {}
        if cursor:
            params["cursor"] = cursor
        if limit is not None:
            params["limit"] = str(limit)
        if ephemeral is not None:
            params["ephemeral"] = "true" if ephemeral else "false"

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/branches"
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
            response.raise_for_status()
            data = response.json()

            branches: List[BranchInfo] = [
                {
                    "cursor": b["cursor"],
                    "name": b["name"],
                    "head_sha": b["head_sha"],
                    "created_at": b["created_at"],
                }
                for b in data["branches"]
            ]

            return {
                "branches": branches,
                "next_cursor": data.get("next_cursor"),
                "has_more": data["has_more"],
            }

    async def create_branch(
        self,
        *,
        base_ref: Optional[str] = None,
        base_branch: Optional[str] = None,
        target_branch: str,
        base_is_ephemeral: bool = False,
        target_is_ephemeral: bool = False,
        ttl: Optional[int] = None,
    ) -> CreateBranchResult:
        """Create or promote a branch.

        Args:
            base_ref: Preferred base ref (branch, tag, or commit SHA)
            base_branch: Deprecated branch-only base name
            target_branch: Target branch name
            base_is_ephemeral: Whether the base ref lives in the ephemeral namespace
            target_is_ephemeral: Whether to create the target in the ephemeral namespace
            ttl: Token TTL in seconds
        """
        base_ref_clean = normalize_optional_ref(base_ref)
        base_branch_clean = normalize_optional_ref(base_branch)
        target_branch_clean = target_branch.strip()

        effective_base = base_ref_clean or base_branch_clean
        if effective_base is None:
            raise ValueError("create_branch base_ref or base_branch is required")
        if not target_branch_clean:
            raise ValueError("create_branch target_branch is required")

        if base_branch_clean is not None:
            warnings.warn(
                "create_branch base_branch is deprecated; use base_ref instead",
                DeprecationWarning,
                stacklevel=2,
            )

        ttl_value = resolve_invocation_ttl_seconds({"ttl": ttl} if ttl is not None else None)
        jwt = self.generate_jwt(
            self._id,
            {"permissions": ["git:write"], "ttl": ttl_value},
        )

        payload: Dict[str, Any] = {
            "target_branch": target_branch_clean,
            "base_is_ephemeral": bool(base_is_ephemeral),
            "target_is_ephemeral": bool(target_is_ephemeral),
        }
        if base_ref_clean is not None:
            payload["base_ref"] = base_ref_clean
        else:
            payload["base_branch"] = base_branch_clean

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/branches/create"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json",
                    "Code-Storage-Agent": get_user_agent(),
                },
                json=payload,
                timeout=180.0,
            )

            if response.status_code != 200:
                message = "Create branch failed"
                try:
                    error_data = response.json()
                    if isinstance(error_data, dict) and error_data.get("message"):
                        message = str(error_data["message"])
                    else:
                        message = f"{message} with HTTP {response.status_code}"
                except Exception:
                    message = f"{message} with HTTP {response.status_code}"
                raise ApiError(message, status_code=response.status_code, response=response)

            data = response.json()

            result: CreateBranchResult = {
                "message": data.get("message", "branch created"),
                "target_branch": data["target_branch"],
                "target_is_ephemeral": data.get("target_is_ephemeral", False),
            }
            commit_sha = data.get("commit_sha")
            if commit_sha:
                result["commit_sha"] = commit_sha
            return result

    async def delete_branch(
        self,
        *,
        name: str,
        ttl: Optional[int] = None,
    ) -> DeleteBranchResult:
        """Delete a branch."""
        name_clean = name.strip()
        if not name_clean:
            raise ValueError("delete_branch name is required")
        if name_clean.startswith("refs/"):
            raise ValueError("delete_branch name must not start with refs/")

        ttl_value = resolve_invocation_ttl_seconds({"ttl": ttl} if ttl is not None else None)
        jwt = self.generate_jwt(
            self._id,
            {"permissions": ["git:write"], "ttl": ttl_value},
        )

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/branches"

        async with httpx.AsyncClient() as client:
            response = await client.request(
                "DELETE",
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json",
                    "Code-Storage-Agent": get_user_agent(),
                },
                json={"name": name_clean},
                timeout=30.0,
            )

            if response.status_code != 200:
                message = "Delete branch failed"
                try:
                    error_data = response.json()
                    if isinstance(error_data, dict) and error_data.get("message"):
                        message = str(error_data["message"])
                    elif isinstance(error_data, dict) and error_data.get("error"):
                        message = str(error_data["error"])
                    else:
                        message = f"{message} with HTTP {response.status_code}"
                except Exception:
                    message = f"{message} with HTTP {response.status_code}"
                raise ApiError(message, status_code=response.status_code, response=response)

            data = response.json()
            return {
                "name": data["name"],
                "message": data["message"],
            }

    async def merge(
        self,
        *,
        source_branch: str,
        target_branch: str,
        strategy: MergeStrategy,
        source_is_ephemeral: Optional[bool] = None,
        target_is_ephemeral: Optional[bool] = None,
        expected_target_sha: Optional[str] = None,
        commit_message: Optional[str] = None,
        author: Optional[CommitSignature] = None,
        committer: Optional[CommitSignature] = None,
        allow_unrelated_histories: Optional[bool] = None,
        ttl: Optional[int] = None,
    ) -> MergeBranchesResult:
        """Merge a source branch into a target branch."""
        source_branch_clean = source_branch.strip()
        target_branch_clean = target_branch.strip()
        strategy_clean = strategy.strip()

        if not source_branch_clean:
            raise ValueError("merge source_branch is required")
        if not target_branch_clean:
            raise ValueError("merge target_branch is required")
        if not strategy_clean:
            raise ValueError("merge strategy is required")
        if strategy_clean not in {"merge", "ff_only", "ff_prefer"}:
            raise ValueError("merge strategy must be one of merge, ff_only, ff_prefer")

        payload: Dict[str, Any] = {
            "source_branch": source_branch_clean,
            "target_branch": target_branch_clean,
            "strategy": strategy_clean,
        }
        if source_is_ephemeral is not None:
            payload["source_is_ephemeral"] = bool(source_is_ephemeral)
        if target_is_ephemeral is not None:
            payload["target_is_ephemeral"] = bool(target_is_ephemeral)

        expected_target_sha_clean = normalize_optional_string(expected_target_sha)
        if expected_target_sha_clean is not None:
            payload["expected_target_sha"] = expected_target_sha_clean

        commit_message_clean = normalize_optional_string(commit_message)
        if commit_message_clean is not None:
            payload["commit_message"] = commit_message_clean

        author_clean = normalize_optional_signature(author, "author")
        if author_clean is not None:
            payload["author"] = author_clean

        committer_clean = normalize_optional_signature(committer, "committer")
        if committer_clean is not None:
            payload["committer"] = committer_clean

        if allow_unrelated_histories is not None:
            payload["allow_unrelated_histories"] = bool(allow_unrelated_histories)

        ttl_value = resolve_invocation_ttl_seconds({"ttl": ttl} if ttl is not None else None)
        jwt = self.generate_jwt(
            self._id,
            {"permissions": ["git:write"], "ttl": ttl_value},
        )

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/merge"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json",
                    "Code-Storage-Agent": get_user_agent(),
                },
                json=payload,
                timeout=180.0,
            )

            if response.status_code != 200:
                message = "Merge failed"
                try:
                    error_data = response.json()
                    if isinstance(error_data, dict) and error_data.get("message"):
                        message = str(error_data["message"])
                    elif isinstance(error_data, dict) and error_data.get("error"):
                        message = str(error_data["error"])
                    else:
                        message = f"{message} with HTTP {response.status_code}"
                except Exception:
                    message = f"{message} with HTTP {response.status_code}"
                raise ApiError(message, status_code=response.status_code, response=response)

            data = response.json()
            result: MergeBranchesResult = {
                "result": data["result"],
                "commit_sha": data["commit_sha"],
                "tree_sha": data["tree_sha"],
                "source": {
                    "branch": data["source"]["branch"],
                    "ephemeral": data["source"]["ephemeral"],
                    "sha": data["source"]["sha"],
                },
                "target": {
                    "branch": data["target"]["branch"],
                    "ephemeral": data["target"]["ephemeral"],
                    "old_sha": data["target"]["old_sha"],
                    "new_sha": data["target"]["new_sha"],
                },
                "promoted_commits": data["promoted_commits"],
            }
            merge_base_sha = data.get("merge_base_sha")
            if merge_base_sha:
                result["merge_base_sha"] = merge_base_sha
            return result

    async def list_tags(
        self,
        *,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
        ttl: Optional[int] = None,
    ) -> ListTagsResult:
        """List tags in repository."""
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl})

        params = {}
        if cursor:
            params["cursor"] = cursor
        if limit is not None:
            params["limit"] = str(limit)

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/tags"
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
            response.raise_for_status()
            data = response.json()

            tags: List[TagInfo] = [
                {
                    "cursor": tag["cursor"],
                    "name": tag["name"],
                    "sha": tag["sha"],
                }
                for tag in data["tags"]
            ]

            return {
                "tags": tags,
                "next_cursor": data.get("next_cursor"),
                "has_more": data["has_more"],
            }

    async def create_tag(
        self,
        *,
        name: str,
        target: str,
        ttl: Optional[int] = None,
    ) -> CreateTagResult:
        """Create a tag."""
        name_clean = name.strip()
        if not name_clean:
            raise ValueError("create_tag name is required")
        if name_clean.startswith("refs/"):
            raise ValueError("create_tag name must not start with refs/")

        target_clean = target.strip()
        if not target_clean:
            raise ValueError("create_tag target is required")

        ttl_value = resolve_invocation_ttl_seconds({"ttl": ttl} if ttl is not None else None)
        jwt = self.generate_jwt(
            self._id,
            {"permissions": ["git:write"], "ttl": ttl_value},
        )

        payload = {"name": name_clean, "target": target_clean}
        url = f"{self.api_base_url}/api/v{self.api_version}/repos/tags"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json",
                    "Code-Storage-Agent": get_user_agent(),
                },
                json=payload,
                timeout=180.0,
            )

            if response.status_code != 200:
                message = "Create tag failed"
                try:
                    error_data = response.json()
                    if isinstance(error_data, dict) and error_data.get("message"):
                        message = str(error_data["message"])
                    elif isinstance(error_data, dict) and error_data.get("error"):
                        message = str(error_data["error"])
                    else:
                        message = f"{message} with HTTP {response.status_code}"
                except Exception:
                    message = f"{message} with HTTP {response.status_code}"
                raise ApiError(message, status_code=response.status_code, response=response)

            data = response.json()
            return {
                "name": data["name"],
                "sha": data["sha"],
                "message": data["message"],
            }

    async def delete_tag(
        self,
        *,
        name: str,
        ttl: Optional[int] = None,
    ) -> DeleteTagResult:
        """Delete a tag."""
        name_clean = name.strip()
        if not name_clean:
            raise ValueError("delete_tag name is required")
        if name_clean.startswith("refs/"):
            raise ValueError("delete_tag name must not start with refs/")

        ttl_value = resolve_invocation_ttl_seconds({"ttl": ttl} if ttl is not None else None)
        jwt = self.generate_jwt(
            self._id,
            {"permissions": ["git:read", "git:write"], "ttl": ttl_value},
        )

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/tags"

        async with httpx.AsyncClient() as client:
            response = await client.request(
                "DELETE",
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json",
                    "Code-Storage-Agent": get_user_agent(),
                },
                json={"name": name_clean},
                timeout=30.0,
            )

            if response.status_code != 200:
                message = "Delete tag failed"
                try:
                    error_data = response.json()
                    if isinstance(error_data, dict) and error_data.get("message"):
                        message = str(error_data["message"])
                    elif isinstance(error_data, dict) and error_data.get("error"):
                        message = str(error_data["error"])
                    else:
                        message = f"{message} with HTTP {response.status_code}"
                except Exception:
                    message = f"{message} with HTTP {response.status_code}"
                raise ApiError(message, status_code=response.status_code, response=response)

            data = response.json()
            return {
                "name": data["name"],
                "message": data["message"],
            }

    async def promote_ephemeral_branch(
        self,
        *,
        base_branch: Optional[str] = None,
        target_branch: Optional[str] = None,
        ttl: Optional[int] = None,
    ) -> CreateBranchResult:
        """Promote an ephemeral branch to a persistent target branch."""
        base_clean = normalize_optional_ref(base_branch)
        if base_clean is None:
            raise ValueError("promote_ephemeral_branch base_branch is required")

        target_clean = normalize_optional_ref(target_branch) or base_clean

        return await self.create_branch(
            base_ref=base_clean,
            target_branch=target_clean,
            base_is_ephemeral=True,
            target_is_ephemeral=False,
            ttl=ttl,
        )

    async def list_commits(
        self,
        *,
        branch: Optional[str] = None,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
        ephemeral: Optional[bool] = None,
        ttl: Optional[int] = None,
    ) -> ListCommitsResult:
        """List commits in repository.

        Args:
            branch: Branch name to list commits from
            cursor: Pagination cursor
            limit: Maximum number of commits to return
            ephemeral: When true, resolve `branch` under the ephemeral namespace
            ttl: Token TTL in seconds

        Returns:
            List of commits with pagination info
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl})

        params = {}
        if branch:
            params["branch"] = branch
        if cursor:
            params["cursor"] = cursor
        if limit is not None:
            params["limit"] = str(limit)
        if ephemeral is not None:
            params["ephemeral"] = "true" if ephemeral else "false"

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/commits"
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
            response.raise_for_status()
            data = response.json()

            commits: List[CommitInfo] = []
            for c in data["commits"]:
                date = datetime.fromisoformat(c["date"].replace("Z", "+00:00"))
                commits.append(
                    {
                        "sha": c["sha"],
                        "message": c["message"],
                        "author_name": c["author_name"],
                        "author_email": c["author_email"],
                        "committer_name": c["committer_name"],
                        "committer_email": c["committer_email"],
                        "date": date,
                        "raw_date": c["date"],
                    }
                )

            return {
                "commits": commits,
                "next_cursor": data.get("next_cursor"),
                "has_more": data["has_more"],
            }

    async def get_commit(
        self,
        *,
        sha: str,
        ttl: Optional[int] = None,
    ) -> GetCommitResult:
        """Get metadata for a single commit, without computing its diff.

        Args:
            sha: Commit SHA (or any revision git can resolve, e.g. branch
                name or short SHA).
            ttl: Token TTL in seconds.

        Returns:
            Commit metadata under the ``commit`` key.
        """
        sha_clean = sha.strip()
        if not sha_clean:
            raise ValueError("get_commit sha is required")

        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl})

        url = (
            f"{self.api_base_url}/api/v{self.api_version}/repos/commit"
            f"?{urlencode({'sha': sha_clean})}"
        )

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Code-Storage-Agent": get_user_agent(),
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()

            commit_raw = data["commit"]
            date = datetime.fromisoformat(commit_raw["date"].replace("Z", "+00:00"))
            commit: CommitInfo = {
                "sha": commit_raw["sha"],
                "message": commit_raw["message"],
                "author_name": commit_raw["author_name"],
                "author_email": commit_raw["author_email"],
                "committer_name": commit_raw["committer_name"],
                "committer_email": commit_raw["committer_email"],
                "date": date,
                "raw_date": commit_raw["date"],
            }
            return {"commit": commit}

    async def get_note(
        self,
        *,
        sha: str,
        ttl: Optional[int] = None,
    ) -> NoteReadResult:
        """Read a git note."""
        sha_clean = sha.strip()
        if not sha_clean:
            raise ValueError("get_note sha is required")

        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl})

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/notes?{urlencode({'sha': sha_clean})}"

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Code-Storage-Agent": get_user_agent(),
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            return {
                "sha": data["sha"],
                "note": data["note"],
                "ref_sha": data["ref_sha"],
            }

    async def create_note(
        self,
        *,
        sha: str,
        note: str,
        expected_ref_sha: Optional[str] = None,
        author: Optional[CommitSignature] = None,
        ttl: Optional[int] = None,
    ) -> NoteWriteResult:
        """Create a git note."""
        return await self._write_note(
            action_label="create_note",
            action="add",
            sha=sha,
            note=note,
            expected_ref_sha=expected_ref_sha,
            author=author,
            ttl=ttl,
        )

    async def append_note(
        self,
        *,
        sha: str,
        note: str,
        expected_ref_sha: Optional[str] = None,
        author: Optional[CommitSignature] = None,
        ttl: Optional[int] = None,
    ) -> NoteWriteResult:
        """Append to a git note."""
        return await self._write_note(
            action_label="append_note",
            action="append",
            sha=sha,
            note=note,
            expected_ref_sha=expected_ref_sha,
            author=author,
            ttl=ttl,
        )

    async def delete_note(
        self,
        *,
        sha: str,
        expected_ref_sha: Optional[str] = None,
        author: Optional[CommitSignature] = None,
        ttl: Optional[int] = None,
    ) -> NoteWriteResult:
        """Delete a git note."""
        sha_clean = sha.strip()
        if not sha_clean:
            raise ValueError("delete_note sha is required")

        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:write"], "ttl": ttl})

        payload: Dict[str, Any] = {"sha": sha_clean}
        if expected_ref_sha and expected_ref_sha.strip():
            payload["expected_ref_sha"] = expected_ref_sha.strip()
        if author:
            author_name = author.get("name", "").strip()
            author_email = author.get("email", "").strip()
            if not author_name or not author_email:
                raise ValueError("delete_note author name and email are required when provided")
            payload["author"] = {"name": author_name, "email": author_email}

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/notes"

        async with httpx.AsyncClient() as client:
            response = await client.request(
                "DELETE",
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json",
                    "Code-Storage-Agent": get_user_agent(),
                },
                json=payload,
                timeout=30.0,
            )

            return self._parse_note_write_response(response, "delete_note")

    async def get_branch_diff(
        self,
        *,
        branch: str,
        base: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        ephemeral_base: Optional[bool] = None,
        paths: Optional[list[str]] = None,
        ttl: Optional[int] = None,
    ) -> GetBranchDiffResult:
        """Get diff between branches.

        Args:
            branch: Target branch name
            base: Base branch name (for comparison)
            ephemeral: Whether to resolve the branch under the ephemeral namespace
            ephemeral_base: Whether to resolve the base branch under the ephemeral namespace
            paths: Optional paths to filter the diff to specific files
            ttl: Token TTL in seconds

        Returns:
            Branch diff with stats and file changes
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl})

        params: list[tuple[str, str]] = [("branch", branch)]
        if base:
            params.append(("base", base))
        if ephemeral is not None:
            params.append(("ephemeral", "true" if ephemeral else "false"))
        if ephemeral_base is not None:
            params.append(("ephemeral_base", "true" if ephemeral_base else "false"))
        if paths:
            for p in paths:
                params.append(("path", p))

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/branches/diff"
        url += f"?{urlencode(params)}"

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Code-Storage-Agent": get_user_agent(),
                },
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()

            files: List[FileDiff] = []
            for f in data["files"]:
                files.append(
                    {
                        "path": f["path"],
                        "state": normalize_diff_state(f["state"]),
                        "raw_state": f["state"],
                        "old_path": f.get("old_path"),
                        "raw": f["raw"],
                        "bytes": f["bytes"],
                        "is_eof": f["is_eof"],
                        "additions": f.get("additions", 0),
                        "deletions": f.get("deletions", 0),
                    }
                )

            filtered_files: List[FilteredFile] = []
            for f in data.get("filtered_files", []):
                filtered_files.append(
                    {
                        "path": f["path"],
                        "state": normalize_diff_state(f["state"]),
                        "raw_state": f["state"],
                        "old_path": f.get("old_path"),
                        "bytes": f["bytes"],
                        "is_eof": f["is_eof"],
                    }
                )

            return {
                "branch": data["branch"],
                "base": data["base"],
                "stats": data["stats"],
                "files": files,
                "filtered_files": filtered_files,
            }

    async def get_commit_diff(
        self,
        *,
        sha: str,
        base_sha: Optional[str] = None,
        paths: Optional[list[str]] = None,
        ttl: Optional[int] = None,
    ) -> GetCommitDiffResult:
        """Get diff for a specific commit.

        Args:
            sha: Commit SHA
            base_sha: Optional base commit SHA to compare against
            paths: Optional paths to filter the diff to specific files
            ttl: Token TTL in seconds

        Returns:
            Commit diff with stats and file changes
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl})

        params: list[tuple[str, str]] = [("sha", sha)]
        if base_sha:
            params.append(("baseSha", base_sha))
        if paths:
            for p in paths:
                params.append(("path", p))
        url = f"{self.api_base_url}/api/v{self.api_version}/repos/diff"
        url += f"?{urlencode(params)}"

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Code-Storage-Agent": get_user_agent(),
                },
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()

            files: List[FileDiff] = []
            for f in data["files"]:
                files.append(
                    {
                        "path": f["path"],
                        "state": normalize_diff_state(f["state"]),
                        "raw_state": f["state"],
                        "old_path": f.get("old_path"),
                        "raw": f["raw"],
                        "bytes": f["bytes"],
                        "is_eof": f["is_eof"],
                        "additions": f.get("additions", 0),
                        "deletions": f.get("deletions", 0),
                    }
                )

            filtered_files: List[FilteredFile] = []
            for f in data.get("filtered_files", []):
                filtered_files.append(
                    {
                        "path": f["path"],
                        "state": normalize_diff_state(f["state"]),
                        "raw_state": f["state"],
                        "old_path": f.get("old_path"),
                        "bytes": f["bytes"],
                        "is_eof": f["is_eof"],
                    }
                )

            return {
                "sha": data["sha"],
                "stats": data["stats"],
                "files": files,
                "filtered_files": filtered_files,
            }

    async def grep(
        self,
        *,
        pattern: str,
        ref: Optional[str] = None,
        rev: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        paths: Optional[list[str]] = None,
        case_sensitive: Optional[bool] = None,
        file_filters: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
        limits: Optional[Dict[str, Any]] = None,
        pagination: Optional[Dict[str, Any]] = None,
        ttl: Optional[int] = None,
    ) -> GrepResult:
        """Run grep against the repository.

        Args:
            pattern: Regex pattern to search for
            ref: Git ref to search (defaults to server-side default branch)
            rev: Deprecated alias for ref
            ephemeral: When true, resolve `ref` under the ephemeral namespace
            paths: Git pathspecs to restrict search
            case_sensitive: Whether search is case-sensitive (default: server default)
            file_filters: Optional filters with include_globs/exclude_globs/extension_filters
            context: Optional context with before/after
            limits: Optional limits with max_lines/max_matches_per_file
            pagination: Optional pagination with cursor/limit
            ttl: Token TTL in seconds

        Returns:
            Grep results with matches, pagination info, and query metadata
        """
        pattern_clean = pattern.strip()
        if not pattern_clean:
            raise ValueError("grep pattern is required")
        if rev and rev.strip():
            warnings.warn(
                "repo.grep rev is deprecated; use ref instead",
                DeprecationWarning,
                stacklevel=2,
            )

        ttl_value = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl_value})

        body: Dict[str, Any] = {
            "query": {
                "pattern": pattern_clean,
            }
        }

        if case_sensitive is not None:
            body["query"]["case_sensitive"] = bool(case_sensitive)
        if ref:
            body["ref"] = ref
        elif rev:
            body["ref"] = rev
        if ephemeral is not None:
            body["ephemeral"] = bool(ephemeral)
        if paths:
            body["paths"] = paths
        if file_filters:
            body["file_filters"] = file_filters
        if context:
            body["context"] = context
        if limits:
            body["limits"] = limits
        if pagination:
            body["pagination"] = pagination

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/grep"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json",
                    "Code-Storage-Agent": get_user_agent(),
                },
                json=body,
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()

            matches: List[GrepFileMatch] = []
            for match in data.get("matches", []):
                lines: List[GrepLine] = []
                for line in match.get("lines", []):
                    lines.append(
                        {
                            "line_number": int(line["line_number"]),
                            "text": line["text"],
                            "type": line["type"],
                        }
                    )
                matches.append({"path": match["path"], "lines": lines})

            result: GrepResult = {
                "query": data["query"],
                "repo": data["repo"],
                "matches": matches,
                "has_more": bool(data["has_more"]),
                "next_cursor": data.get("next_cursor"),
            }
            return result

    async def pull_upstream(
        self,
        *,
        ref: Optional[str] = None,
        ttl: Optional[int] = None,
    ) -> None:
        """Pull from upstream repository.

        Args:
            ref: Git ref to pull
            ttl: Token TTL in seconds

        Raises:
            ApiError: If pull fails
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:write"], "ttl": ttl})

        body = {}
        if ref:
            body["ref"] = ref

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/pull-upstream"

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

            if response.status_code != 202:
                text = await response.aread()
                raise Exception(f"Pull Upstream failed: {response.status_code} {text.decode()}")

    async def restore_commit(
        self,
        *,
        target_branch: str,
        target_commit_sha: str,
        author: CommitSignature,
        commit_message: Optional[str] = None,
        expected_head_sha: Optional[str] = None,
        committer: Optional[CommitSignature] = None,
        ttl: Optional[int] = None,
    ) -> RestoreCommitResult:
        """Restore a previous commit.

        Args:
            target_branch: Target branch name
            target_commit_sha: Commit SHA to restore
            author: Author signature (name and email)
            commit_message: Optional commit message
            expected_head_sha: Expected HEAD SHA for optimistic locking
            committer: Optional committer signature (name and email)
            ttl: Token TTL in seconds

        Returns:
            Restore result with commit info

        Raises:
            ValueError: If required options are missing
            RefUpdateError: If restore fails
        """
        target_branch = target_branch.strip()
        if not target_branch:
            raise ValueError("restoreCommit target_branch is required")
        if target_branch.startswith("refs/"):
            raise ValueError("restoreCommit target_branch must not include refs/ prefix")

        target_commit_sha = target_commit_sha.strip()
        if not target_commit_sha:
            raise ValueError("restoreCommit target_commit_sha is required")

        author_name = author.get("name", "").strip()
        author_email = author.get("email", "").strip()
        if not author_name or not author_email:
            raise ValueError("restoreCommit author name and email are required")

        ttl = ttl or resolve_commit_ttl_seconds(None)
        jwt = self.generate_jwt(self._id, {"permissions": ["git:write"], "ttl": ttl})

        metadata: Dict[str, Any] = {
            "target_branch": target_branch,
            "target_commit_sha": target_commit_sha,
            "author": {"name": author_name, "email": author_email},
        }

        if commit_message:
            metadata["commit_message"] = commit_message.strip()

        if expected_head_sha:
            metadata["expected_head_sha"] = expected_head_sha.strip()

        if committer:
            committer_name = committer.get("name", "").strip()
            committer_email = committer.get("email", "").strip()
            if not committer_name or not committer_email:
                raise ValueError(
                    "restoreCommit committer name and email are required when provided"
                )
            metadata["committer"] = {"name": committer_name, "email": committer_email}

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/restore-commit"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json",
                    "Code-Storage-Agent": get_user_agent(),
                },
                json={"metadata": metadata},
                timeout=180.0,
            )

            # Try to parse JSON response, fallback to text for 5xx errors
            try:
                payload = response.json()
            except Exception as exc:
                # If JSON parsing fails (e.g., CDN HTML response on 5xx), use text
                status = infer_ref_update_reason(str(response.status_code))
                text = await response.aread()
                message = f"Restore commit failed with HTTP {response.status_code}"
                if response.reason_phrase:
                    message += f" {response.reason_phrase}"
                # Include response body for debugging
                if text:
                    message += f": {text.decode('utf-8', errors='replace')[:200]}"
                raise RefUpdateError(message, status=status) from exc

            # Check if we got a result block (with or without commit)
            if "result" in payload:
                result = payload["result"]
                ref_update = self._to_ref_update(result)

                # Check if the operation succeeded
                if not result.get("success"):
                    # Failure - raise with server message and ref_update
                    raise RefUpdateError(
                        result.get(
                            "message", f"Restore commit failed with status {result.get('status')}"
                        ),
                        status=result.get("status"),
                        ref_update=ref_update,
                    )

                # Success - must have commit field
                if "commit" not in payload:
                    raise RefUpdateError(
                        "Restore commit succeeded but server did not return commit details",
                        status="unknown",
                    )

                commit = payload["commit"]
                return {
                    "commit_sha": commit["commit_sha"],
                    "tree_sha": commit["tree_sha"],
                    "target_branch": commit["target_branch"],
                    "pack_bytes": commit["pack_bytes"],
                    "ref_update": ref_update,
                }

            # No result block - handle as generic error
            status = infer_ref_update_reason(str(response.status_code))
            message = f"Restore commit failed with HTTP {response.status_code}"
            if response.reason_phrase:
                message += f" {response.reason_phrase}"

            raise RefUpdateError(message, status=status)

    def create_commit(
        self,
        *,
        target_branch: str,
        commit_message: str,
        author: CommitSignature,
        expected_head_sha: Optional[str] = None,
        base_branch: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        ephemeral_base: Optional[bool] = None,
        committer: Optional[CommitSignature] = None,
        ttl: Optional[int] = None,
    ) -> CommitBuilder:
        """Create a new commit builder.

        Args:
            target_branch: Target branch name
            commit_message: Commit message
            author: Author signature (name and email)
            expected_head_sha: Expected HEAD SHA for optimistic locking
            base_branch: Base branch to branch off from
            ephemeral: Whether to mark the target branch as ephemeral
            ephemeral_base: Whether the base branch is ephemeral
            committer: Optional committer signature (name and email)
            ttl: Token TTL in seconds

        Returns:
            Commit builder for fluent API
        """
        options: CreateCommitOptions = {
            "target_branch": target_branch,
            "commit_message": commit_message,
            "author": author,
        }
        if expected_head_sha:
            options["expected_head_sha"] = expected_head_sha
        if base_branch:
            options["base_branch"] = base_branch
        if ephemeral is not None:
            options["ephemeral"] = bool(ephemeral)
        if ephemeral_base is not None:
            options["ephemeral_base"] = bool(ephemeral_base)
        if committer:
            options["committer"] = committer

        ttl = ttl or resolve_commit_ttl_seconds(None)
        options["ttl"] = ttl

        def get_auth_token() -> str:
            return self.generate_jwt(
                self._id,
                {"permissions": ["git:write"], "ttl": ttl},
            )

        return CommitBuilderImpl(
            options,
            get_auth_token,
            self.api_base_url,
            self.api_version,
        )

    async def create_commit_from_diff(
        self,
        *,
        target_branch: str,
        commit_message: str,
        diff: FileSource,
        author: CommitSignature,
        expected_head_sha: Optional[str] = None,
        base_branch: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        ephemeral_base: Optional[bool] = None,
        committer: Optional[CommitSignature] = None,
        ttl: Optional[int] = None,
    ) -> CommitResult:
        """Create a commit by applying a unified diff."""
        if diff is None:
            raise ValueError("createCommitFromDiff diff is required")

        options: CreateCommitOptions = {
            "target_branch": target_branch,
            "commit_message": commit_message,
            "author": author,
        }
        if expected_head_sha:
            options["expected_head_sha"] = expected_head_sha
        if base_branch:
            options["base_branch"] = base_branch
        if ephemeral is not None:
            options["ephemeral"] = bool(ephemeral)
        if ephemeral_base is not None:
            options["ephemeral_base"] = bool(ephemeral_base)
        if committer:
            options["committer"] = committer

        ttl_value = ttl or resolve_commit_ttl_seconds(None)
        options["ttl"] = ttl_value

        def get_auth_token() -> str:
            return self.generate_jwt(
                self._id,
                {"permissions": ["git:write"], "ttl": ttl_value},
            )

        return await send_diff_commit_request(
            options,
            diff,
            get_auth_token,
            self.api_base_url,
            self.api_version,
        )

    async def _write_note(
        self,
        *,
        action_label: str,
        action: str,
        sha: str,
        note: str,
        expected_ref_sha: Optional[str],
        author: Optional[CommitSignature],
        ttl: Optional[int],
    ) -> NoteWriteResult:
        sha_clean = sha.strip()
        if not sha_clean:
            raise ValueError(f"{action_label} sha is required")

        note_clean = note.strip()
        if not note_clean:
            raise ValueError(f"{action_label} note is required")

        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:write"], "ttl": ttl})

        payload: Dict[str, Any] = {
            "sha": sha_clean,
            "action": action,
            "note": note_clean,
        }
        if expected_ref_sha and expected_ref_sha.strip():
            payload["expected_ref_sha"] = expected_ref_sha.strip()
        if author:
            author_name = author.get("name", "").strip()
            author_email = author.get("email", "").strip()
            if not author_name or not author_email:
                raise ValueError(f"{action_label} author name and email are required when provided")
            payload["author"] = {"name": author_name, "email": author_email}

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/notes"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json",
                    "Code-Storage-Agent": get_user_agent(),
                },
                json=payload,
                timeout=30.0,
            )

            return self._parse_note_write_response(response, action_label)

    def _parse_note_write_response(
        self,
        response: httpx.Response,
        action_label: str,
    ) -> NoteWriteResult:
        try:
            payload = response.json()
        except Exception as exc:
            message = f"{action_label} failed with HTTP {response.status_code}"
            if response.reason_phrase:
                message += f" {response.reason_phrase}"
            try:
                body_text = response.text
            except Exception:
                body_text = ""
            if body_text:
                message += f": {body_text[:200]}"
            raise ApiError(message, status_code=response.status_code, response=response) from exc

        if isinstance(payload, dict) and "error" in payload:
            raise ApiError(
                str(payload.get("error")),
                status_code=response.status_code,
                response=response,
            )

        if not isinstance(payload, dict) or "result" not in payload:
            message = f"{action_label} failed with HTTP {response.status_code}"
            if response.reason_phrase:
                message += f" {response.reason_phrase}"
            raise ApiError(message, status_code=response.status_code, response=response)

        result = payload.get("result", {})
        note_result: NoteWriteResult = {
            "sha": payload.get("sha", ""),
            "target_ref": payload.get("target_ref", ""),
            "new_ref_sha": payload.get("new_ref_sha", ""),
            "result": {
                "success": bool(result.get("success")),
                "status": str(result.get("status", "")),
            },
        }

        base_commit = payload.get("base_commit")
        if isinstance(base_commit, str) and base_commit:
            note_result["base_commit"] = base_commit
        if result.get("message"):
            note_result["result"]["message"] = result.get("message")

        if not result.get("success"):
            raise RefUpdateError(
                result.get(
                    "message",
                    f"{action_label} failed with status {result.get('status')}",
                ),
                status=result.get("status"),
                ref_update={
                    "branch": payload.get("target_ref", ""),
                    "old_sha": payload.get("base_commit", ""),
                    "new_sha": payload.get("new_ref_sha", ""),
                },
            )

        return note_result

    def _to_ref_update(self, result: Dict[str, Any]) -> RefUpdate:
        """Convert result to ref update."""
        return {
            "branch": result.get("branch", ""),
            "old_sha": result.get("old_sha", ""),
            "new_sha": result.get("new_sha", ""),
        }
