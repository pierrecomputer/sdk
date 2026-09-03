"""Repository implementation for Pierre Git Storage SDK."""

import asyncio
import contextlib
import math
import time
import warnings
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from types import TracebackType
from typing import Any, Callable, Dict, List, Literal, Optional, cast
from urllib.parse import quote, urlencode

import httpx

from pierre_storage.commit import (
    CommitBuilderImpl,
    resolve_commit_ttl_seconds,
    send_diff_commit_request,
)
from pierre_storage.errors import (
    ApiError,
    DeploymentFailedError,
    RefUpdateError,
    infer_ref_update_reason,
)
from pierre_storage.types import (
    BlameLine,
    BlameResult,
    BranchInfo,
    CommitBuilder,
    CommitInfo,
    CommitMetadata,
    CommitResult,
    CommitSignature,
    CreateBranchResult,
    CreateCommitOptions,
    CreateDeploymentResult,
    CreateTagResult,
    DeleteBranchResult,
    DeleteTagResult,
    DeploymentResult,
    DeploymentStatus,
    DeploymentTarget,
    DiffFileState,
    FileDiff,
    FileMetadata,
    FileRequestHeaders,
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
    ListDeploymentsResult,
    ListFilesResult,
    ListFilesWithMetadataResult,
    ListNotesRefsResult,
    ListTagsResult,
    MergeBranchesResult,
    MergeStrategy,
    NoteReadResult,
    NotesRefInfo,
    NoteWriteResult,
    PreviewMergeResult,
    Refs,
    RefUpdate,
    RestoreCommitResult,
    TagInfo,
    TreeEntry,
)
from pierre_storage.version import get_user_agent

DEFAULT_TOKEN_TTL_SECONDS = 3600  # 1 hour
ZERO_DATETIME_UTC = datetime.min.replace(tzinfo=timezone.utc)


def _build_jwt_options(
    permissions: List[str],
    ttl: int,
    ref_policies: Optional[Refs] = None,
) -> Dict[str, Any]:
    """Assemble the JWT options dict, attaching ref policies when supplied."""
    options: Dict[str, Any] = {"permissions": permissions, "ttl": ttl}
    if ref_policies:
        options["refs"] = ref_policies
    return options


class StreamingResponse:
    """Stream wrapper that keeps the HTTP client alive until closed."""

    def __init__(
        self,
        response: httpx.Response,
        client: httpx.AsyncClient,
        stream_context: Optional[contextlib.AbstractAsyncContextManager[Any]] = None,
    ) -> None:
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


def _deployment_result(data: Dict[str, Any]) -> DeploymentResult:
    """Normalize one deployment response."""
    target_raw = str(data["target"])
    if target_raw not in ("preview", "production"):
        raise ValueError(f"unsupported deployment target: {target_raw}")
    target = cast(DeploymentTarget, target_raw)
    status_raw = str(data["status"])
    if status_raw not in ("queued", "building", "ready", "error", "canceled"):
        raise ValueError(f"unsupported deployment status: {status_raw}")
    status = cast(DeploymentStatus, status_raw)
    result: DeploymentResult = {
        "id": str(data["id"]),
        "target": target,
        "ref": str(data["ref"]),
        "commit_sha": str(data["commit_sha"]),
        "status": status,
        "created_at": str(data["created_at"]),
        "updated_at": str(data["updated_at"]),
    }
    url = data.get("url")
    if isinstance(url, str):
        result["url"] = url
    error_code = data.get("error_code")
    if isinstance(error_code, str):
        result["error_code"] = error_code
    error_message = data.get("error_message")
    if isinstance(error_message, str):
        result["error_message"] = error_message
    return result


def _deployment_api_error(response: httpx.Response, fallback: str) -> ApiError:
    """Build an SDK API error from a deployment response."""
    message = fallback
    try:
        payload = response.json()
        if isinstance(payload, dict) and isinstance(payload.get("error"), str):
            message = payload["error"]
    except ValueError:
        pass
    return ApiError(message, status_code=response.status_code, response=response)


_CONDITIONAL_HEADER_NAMES = {
    "range": "Range",
    "if_match": "If-Match",
    "if_none_match": "If-None-Match",
    "if_modified_since": "If-Modified-Since",
    "if_unmodified_since": "If-Unmodified-Since",
    "if_range": "If-Range",
}

_FILE_RESPONSE_ALLOWED_STATUS_CODES = (200, 206, 304, 412, 416)


def build_conditional_headers(
    headers: Optional[FileRequestHeaders],
) -> Dict[str, str]:
    """Convert SDK header dict (snake_case) to HTTP headers (canonical case)."""
    if not headers:
        return {}
    out: Dict[str, str] = {}
    for key, http_name in _CONDITIONAL_HEADER_NAMES.items():
        value = headers.get(key)
        if isinstance(value, str) and value:
            out[http_name] = value
    return out


def parse_file_metadata_headers(response: httpx.Response) -> FileMetadata:
    """Parse FileMetadata from HEAD or GET response headers."""
    headers = response.headers
    metadata: FileMetadata = {
        "status_code": response.status_code,
        "blob_sha": headers.get("x-blob-sha", ""),
        "last_commit_sha": headers.get("x-last-commit-sha", ""),
    }
    content_length = headers.get("content-length")
    if content_length is not None and content_length != "":
        with contextlib.suppress(TypeError, ValueError):
            metadata["size"] = int(content_length)
    etag = headers.get("etag")
    if etag:
        metadata["etag"] = etag
    raw_last_modified = headers.get("last-modified")
    if raw_last_modified:
        metadata["raw_last_modified"] = raw_last_modified
        with contextlib.suppress(TypeError, ValueError):
            parsed = parsedate_to_datetime(raw_last_modified)
            if parsed is not None:
                metadata["last_modified"] = parsed
    accept_ranges = headers.get("accept-ranges")
    if accept_ranges:
        metadata["accept_ranges"] = accept_ranges
    content_range = headers.get("content-range")
    if content_range:
        metadata["content_range"] = content_range
    content_type = headers.get("content-type")
    if content_type:
        metadata["content_type"] = content_type
    return metadata


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
        ref_policies: Optional[Refs] = None,
    ) -> str:
        """Get remote URL for Git operations.

        Args:
            permissions: List of permissions (e.g., ["git:write", "git:read"])
            ttl: Token TTL in seconds
            ops: Deprecated. Repo-wide policy operations. Use
                ``ref_policies=[{"pattern": "*", "ops": [...]}]`` instead.
            ref_policies: Ordered per-ref policy rules (first match wins)

        Returns:
            Git remote URL with embedded JWT
        """
        if ops is not None:
            warnings.warn(
                "ops is deprecated. Use ref_policies=[{'pattern': '*', 'ops': [...]}] instead.",
                DeprecationWarning,
                stacklevel=2,
            )
        options: Dict[str, Any] = {}
        if permissions is not None:
            options["permissions"] = permissions
        if ttl is not None:
            options["ttl"] = ttl
        if ops is not None:
            options["ops"] = ops
        if ref_policies is not None:
            options["refs"] = ref_policies

        jwt_token = self.generate_jwt(self._id, options if options else None)
        url = f"https://t:{jwt_token}@{self.storage_base_url}/{self._id}.git"
        return url

    async def get_import_remote_url(
        self,
        *,
        permissions: Optional[list[str]] = None,
        ttl: Optional[int] = None,
        ops: Optional[list[str]] = None,
        ref_policies: Optional[Refs] = None,
    ) -> str:
        """Get import remote URL for Git operations.

        Args:
            permissions: List of permissions (e.g., ["git:write", "git:read"])
            ttl: Token TTL in seconds
            ops: Deprecated. See :meth:`get_remote_url` for details. Use
                ``ref_policies=[{"pattern": "*", "ops": [...]}]`` instead.
            ref_policies: Ordered per-ref policy rules (first match wins)

        Returns:
            Git remote URL with embedded JWT pointing to import namespace
        """
        if ops is not None:
            warnings.warn(
                "ops is deprecated. Use ref_policies=[{'pattern': '*', 'ops': [...]}] instead.",
                DeprecationWarning,
                stacklevel=2,
            )
        url = await self.get_remote_url(
            permissions=permissions, ttl=ttl, ops=ops, ref_policies=ref_policies
        )
        return url.replace(".git", "+import.git")

    async def get_ephemeral_remote_url(
        self,
        *,
        permissions: Optional[list[str]] = None,
        ttl: Optional[int] = None,
        ops: Optional[list[str]] = None,
        ref_policies: Optional[Refs] = None,
    ) -> str:
        """Get ephemeral remote URL for Git operations.

        Args:
            permissions: List of permissions (e.g., ["git:write", "git:read"])
            ttl: Token TTL in seconds
            ops: Deprecated. See :meth:`get_remote_url` for details. Use
                ``ref_policies=[{"pattern": "*", "ops": [...]}]`` instead.
            ref_policies: Ordered per-ref policy rules (first match wins)

        Returns:
            Git remote URL with embedded JWT pointing to ephemeral namespace
        """
        if ops is not None:
            warnings.warn(
                "ops is deprecated. Use ref_policies=[{'pattern': '*', 'ops': [...]}] instead.",
                DeprecationWarning,
                stacklevel=2,
            )
        url = await self.get_remote_url(
            permissions=permissions, ttl=ttl, ops=ops, ref_policies=ref_policies
        )
        return url.replace(".git", "+ephemeral.git")

    async def get_file_stream(
        self,
        *,
        path: str,
        ref: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        ephemeral_base: Optional[bool] = None,
        headers: Optional[FileRequestHeaders] = None,
        ttl: Optional[int] = None,
    ) -> StreamingResponse:
        """Get file content as streaming response.

        Args:
            path: File path to retrieve
            ref: Git ref (branch, tag, or commit SHA)
            ephemeral: Whether to read from the ephemeral namespace
            ephemeral_base: Whether to resolve the base branch under the ephemeral namespace
            headers: Optional ``Range``/conditional headers forwarded to the
                server. 206/304/412/416 are passed through without raising.
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
        if ephemeral_base is not None:
            params["ephemeral_base"] = "true" if ephemeral_base else "false"

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/file"
        if params:
            url += f"?{urlencode(params)}"

        request_headers: Dict[str, str] = {
            "Authorization": f"Bearer {jwt}",
            "Code-Storage-Agent": get_user_agent(),
        }
        request_headers.update(build_conditional_headers(headers))

        client = httpx.AsyncClient()
        try:
            stream_context = client.stream(
                "GET",
                url,
                headers=request_headers,
                timeout=30.0,
            )
            response = await stream_context.__aenter__()
            # Range and conditional outcomes should remain inspectable.
            if response.status_code not in _FILE_RESPONSE_ALLOWED_STATUS_CODES:
                response.raise_for_status()
        except Exception:
            await client.aclose()
            raise

        return StreamingResponse(response, client, stream_context)

    async def head_file(
        self,
        *,
        path: str,
        ref: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        ephemeral_base: Optional[bool] = None,
        headers: Optional[FileRequestHeaders] = None,
        ttl: Optional[int] = None,
    ) -> FileMetadata:
        """Issue ``HEAD /repos/file`` and return parsed response metadata.

        Returns blob SHA, last-commit SHA, size, ETag and Last-Modified
        without downloading the file body.
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl})

        params = {"path": path}
        if ref:
            params["ref"] = ref
        if ephemeral is not None:
            params["ephemeral"] = "true" if ephemeral else "false"
        if ephemeral_base is not None:
            params["ephemeral_base"] = "true" if ephemeral_base else "false"

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/file"
        if params:
            url += f"?{urlencode(params)}"

        request_headers: Dict[str, str] = {
            "Authorization": f"Bearer {jwt}",
            "Code-Storage-Agent": get_user_agent(),
        }
        request_headers.update(build_conditional_headers(headers))

        async with httpx.AsyncClient() as client:
            response = await client.head(
                url,
                headers=request_headers,
                timeout=30.0,
            )
            if response.status_code not in _FILE_RESPONSE_ALLOWED_STATUS_CODES:
                response.raise_for_status()
            return parse_file_metadata_headers(response)

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
        path: Optional[str] = None,
        recursive: Optional[bool] = None,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
        ttl: Optional[int] = None,
    ) -> ListFilesResult:
        """List files in repository.

        Args:
            ref: Git ref (branch, tag, or commit SHA)
            ephemeral: Whether to read from the ephemeral namespace
            path: Optional repository-relative subtree to list
            recursive: When false, only direct children are returned
            cursor: Pagination cursor returned by a previous call
            limit: Maximum number of entries to return (default 1000, max 5000)
            ttl: Token TTL in seconds

        Returns:
            Paths, structured ``entries`` (blobs+trees+symlinks+submodules),
            resolved ref, and pagination state.
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl})

        params: Dict[str, str] = {}
        if ref:
            params["ref"] = ref
        if ephemeral is not None:
            params["ephemeral"] = "true" if ephemeral else "false"
        if path:
            params["path"] = path
        if recursive is not None:
            params["recursive"] = "true" if recursive else "false"
        if cursor:
            params["cursor"] = cursor
        if limit is not None:
            params["limit"] = str(limit)

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

            entries: List[TreeEntry] = []
            for entry in data.get("entries") or []:
                entries.append(
                    {
                        "path": entry["path"],
                        "type": entry["type"],
                        "mode": entry["mode"],
                    }
                )

            result: ListFilesResult = {
                "paths": list(data.get("paths") or []),
                "ref": data["ref"],
                "entries": entries,
                "has_more": bool(data.get("has_more", False)),
            }
            next_cursor = data.get("next_cursor")
            if next_cursor:
                result["next_cursor"] = next_cursor
            return result

    async def list_files_with_metadata(
        self,
        *,
        ref: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        path: Optional[str] = None,
        recursive: Optional[bool] = None,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
        ttl: Optional[int] = None,
    ) -> ListFilesWithMetadataResult:
        """List files with metadata in repository.

        Args:
            ref: Git ref (branch, tag, or commit SHA)
            ephemeral: Whether to read from the ephemeral namespace
            path: Optional repository-relative subtree to list
            recursive: Accepted for API symmetry; listings are always recursive
            cursor: Pagination cursor from a previous response
            limit: Maximum number of files to return (default 200, max 1000)
            ttl: Token TTL in seconds

        Returns:
            Files with mode/size/type/last commit metadata, resolved ref and
            pagination state.
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl})

        params: Dict[str, str] = {}
        if ref:
            params["ref"] = ref
        if ephemeral is not None:
            params["ephemeral"] = "true" if ephemeral else "false"
        if path:
            params["path"] = path
        if recursive is not None:
            params["recursive"] = "true" if recursive else "false"
        if cursor:
            params["cursor"] = cursor
        if limit is not None:
            params["limit"] = str(limit)

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

            files: List[FileWithMetadata] = []
            for file in data["files"]:
                entry: FileWithMetadata = {
                    "path": file["path"],
                    "mode": file["mode"],
                    "size": file["size"],
                    "last_commit_sha": file["last_commit_sha"],
                }
                file_type = file.get("type")
                if file_type:
                    entry["type"] = file_type
                files.append(entry)

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

            result: ListFilesWithMetadataResult = {
                "files": files,
                "commits": commits,
                "ref": data["ref"],
                "has_more": bool(data.get("has_more", False)),
            }
            next_cursor = data.get("next_cursor")
            if next_cursor:
                result["next_cursor"] = next_cursor
            return result

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
        ref_policies: Optional[Refs] = None,
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
            _build_jwt_options(["git:write"], ttl_value, ref_policies),
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
                    elif isinstance(error_data, dict) and error_data.get("error"):
                        message = str(error_data["error"])
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
        ephemeral: Optional[bool] = None,
        ttl: Optional[int] = None,
        ref_policies: Optional[Refs] = None,
    ) -> DeleteBranchResult:
        """Delete a branch.

        When ``ephemeral`` is true, the branch is resolved and removed under the
        repository's ephemeral namespace rather than the persistent one.
        """
        name_clean = name.strip()
        if not name_clean:
            raise ValueError("delete_branch name is required")
        if name_clean.startswith("refs/"):
            raise ValueError("delete_branch name must not start with refs/")

        ttl_value = resolve_invocation_ttl_seconds({"ttl": ttl} if ttl is not None else None)
        jwt = self.generate_jwt(
            self._id,
            _build_jwt_options(["git:write"], ttl_value, ref_policies),
        )

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/branches"

        body: dict[str, object] = {"name": name_clean}
        if ephemeral is not None:
            body["ephemeral"] = bool(ephemeral)

        async with httpx.AsyncClient() as client:
            response = await client.request(
                "DELETE",
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json",
                    "Code-Storage-Agent": get_user_agent(),
                },
                json=body,
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
                "ephemeral": bool(data.get("ephemeral", False)),
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
        squash: Optional[bool] = None,
        ttl: Optional[int] = None,
        ref_policies: Optional[Refs] = None,
    ) -> MergeBranchesResult:
        """Merge a source branch into a target branch.

        Provide expected_target_sha to require the target branch to still point at that
        commit. Omit it to merge into the current target tip; native Code Storage
        targets may retry stale target/repository movement while preserving the
        resolved source commit.
        """
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
        if squash is True and strategy_clean == "ff_only":
            raise ValueError("merge squash is incompatible with the ff_only strategy")

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

        if squash is not None:
            payload["squash"] = bool(squash)

        ttl_value = resolve_invocation_ttl_seconds({"ttl": ttl} if ttl is not None else None)
        jwt = self.generate_jwt(
            self._id,
            _build_jwt_options(["git:write"], ttl_value, ref_policies),
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

    async def preview_merge(
        self,
        *,
        source_branch: str,
        target_branch: str,
        include_content: Optional[bool] = None,
        ttl: Optional[int] = None,
    ) -> PreviewMergeResult:
        """Preview a merge without creating commits or updating refs."""
        source_branch_clean = source_branch.strip()
        target_branch_clean = target_branch.strip()

        if not source_branch_clean:
            raise ValueError("preview_merge source_branch is required")
        if not target_branch_clean:
            raise ValueError("preview_merge target_branch is required")

        ttl_value = resolve_invocation_ttl_seconds({"ttl": ttl} if ttl is not None else None)
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl_value})

        params: Dict[str, str] = {
            "source_branch": source_branch_clean,
            "target_branch": target_branch_clean,
        }
        if include_content is not None:
            params["include_content"] = "true" if include_content else "false"

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/merge/preview"
        url += f"?{urlencode(params)}"

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {jwt}",
                    "Code-Storage-Agent": get_user_agent(),
                },
                timeout=180.0,
            )

            if response.status_code != 200:
                message = "Preview merge failed"
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
            result: PreviewMergeResult = {
                "status": data["status"],
                "result": data["result"],
                "source_branch": data["source_branch"],
                "target_branch": data["target_branch"],
                "source_tip_sha": data["source_tip_sha"],
                "target_tip_sha": data["target_tip_sha"],
                "conflict_paths": data.get("conflict_paths", []),
                "conflicts": data.get("conflicts", []),
                "filtered_conflicts": data.get("filtered_conflicts", []),
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
        ref_policies: Optional[Refs] = None,
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
            _build_jwt_options(["git:write"], ttl_value, ref_policies),
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
        ref_policies: Optional[Refs] = None,
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
            _build_jwt_options(["git:read", "git:write"], ttl_value, ref_policies),
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
        path: Optional[str] = None,
        ttl: Optional[int] = None,
    ) -> ListCommitsResult:
        """List commits in repository.

        Args:
            branch: Branch name to list commits from
            cursor: Pagination cursor
            limit: Maximum number of commits to return
            ephemeral: When true, resolve `branch` under the ephemeral namespace
            path: Optional repository-relative path to scope the history to
                commits that touched that file or subtree.
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
        if path:
            params["path"] = path

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
                        "parent_shas": c["parent_shas"],
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
                "parent_shas": commit_raw["parent_shas"],
                "message": commit_raw["message"],
                "author_name": commit_raw["author_name"],
                "author_email": commit_raw["author_email"],
                "committer_name": commit_raw["committer_name"],
                "committer_email": commit_raw["committer_email"],
                "date": date,
                "raw_date": commit_raw["date"],
            }
            # Only surface these for signed commits, which carry both the
            # armored signature and the signed payload. If either is missing
            # (absent/null/empty) the commit is treated as unsigned and
            # neither key is attached.
            signature = commit_raw.get("signature")
            payload = commit_raw.get("payload")
            if signature and payload:
                commit["signature"] = signature
                commit["payload"] = payload
            return {"commit": commit}

    async def get_blame(
        self,
        *,
        path: str,
        ref: Optional[str] = None,
        ephemeral: Optional[bool] = None,
        ranges: Optional[List[str]] = None,
        detect_moves: Optional[bool] = None,
        ttl: Optional[int] = None,
    ) -> BlameResult:
        """Return per-line authorship for a file at a ref.

        Args:
            path: Repository-relative file path to blame.
            ref: Branch, tag, or commit SHA to blame at. Defaults to the
                repository default branch.
            ephemeral: Resolve ``ref`` from the ephemeral namespace.
            ranges: ``git blame -L``-style range specs. When omitted, the
                whole file is blamed.
            detect_moves: Follow the file across renames and copies.
            ttl: Token TTL in seconds.

        Returns:
            Per-line attribution plus a deduped commits map.
        """
        if not path.strip():
            raise ValueError("get_blame path is required")

        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl})

        params: List[tuple[str, str]] = [("path", path)]
        if ref is not None and ref.strip():
            params.append(("ref", ref.strip()))
        if ephemeral:
            params.append(("ephemeral", "true"))
        if ranges:
            for spec in ranges:
                params.append(("range", spec))
        if detect_moves:
            params.append(("detect_moves", "true"))

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/blame?{urlencode(params)}"

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

            lines: List[BlameLine] = []
            for entry in data.get("lines", []):
                author_time_raw = entry["author_time"]
                committer_time_raw = entry["committer_time"]
                line: BlameLine = {
                    "line_number": entry["line_number"],
                    "commit_sha": entry["commit_sha"],
                    "original_line_number": entry["original_line_number"],
                    "original_path": entry["original_path"],
                    "author_name": entry["author_name"],
                    "author_email": entry["author_email"],
                    "author_time": datetime.fromisoformat(author_time_raw.replace("Z", "+00:00")),
                    "raw_author_time": author_time_raw,
                    "committer_name": entry["committer_name"],
                    "committer_email": entry["committer_email"],
                    "committer_time": datetime.fromisoformat(
                        committer_time_raw.replace("Z", "+00:00")
                    ),
                    "raw_committer_time": committer_time_raw,
                    "summary": entry["summary"],
                }
                previous = entry.get("previous_commit_sha")
                if previous:
                    line["previous_commit_sha"] = previous
                lines.append(line)

            return {
                "ref": data["ref"],
                "path": data["path"],
                "commit_sha": data["commit_sha"],
                "lines": lines,
            }

    async def get_note(
        self,
        *,
        sha: str,
        ref: Optional[str] = None,
        ttl: Optional[int] = None,
    ) -> NoteReadResult:
        """Read a git note.

        Args:
            sha: Git object SHA whose note to read.
            ref: Notes ref to read from. A bare name like ``reviews`` is placed
                under ``refs/notes/``; a fully-qualified ``refs/notes/*`` ref is
                also accepted. Defaults to ``refs/notes/commits``. Custom refs
                require the feature to be enabled server-side.
            ttl: Token TTL in seconds.
        """
        sha_clean = sha.strip()
        if not sha_clean:
            raise ValueError("get_note sha is required")

        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl})

        params = {"sha": sha_clean}
        if ref and ref.strip():
            params["ref"] = ref.strip()

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/notes?{urlencode(params)}"

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
        ref: Optional[str] = None,
        ttl: Optional[int] = None,
        ref_policies: Optional[Refs] = None,
    ) -> NoteWriteResult:
        """Create a git note.

        Set ``ref`` to target a notes ref other than ``refs/notes/commits``. A
        bare name like ``reviews`` is placed under ``refs/notes/``; a
        fully-qualified ``refs/notes/*`` ref is also accepted. Custom refs
        require the feature to be enabled server-side, and the JWT
        ``ref_policies`` must permit writing to the target ref.
        """
        return await self._write_note(
            action_label="create_note",
            action="add",
            sha=sha,
            note=note,
            expected_ref_sha=expected_ref_sha,
            author=author,
            ref=ref,
            ttl=ttl,
            ref_policies=ref_policies,
        )

    async def append_note(
        self,
        *,
        sha: str,
        note: str,
        expected_ref_sha: Optional[str] = None,
        author: Optional[CommitSignature] = None,
        ref: Optional[str] = None,
        ttl: Optional[int] = None,
        ref_policies: Optional[Refs] = None,
    ) -> NoteWriteResult:
        """Append to a git note.

        See :meth:`create_note` for how ``ref`` selects the notes ref.
        """
        return await self._write_note(
            action_label="append_note",
            action="append",
            sha=sha,
            note=note,
            expected_ref_sha=expected_ref_sha,
            author=author,
            ref=ref,
            ttl=ttl,
            ref_policies=ref_policies,
        )

    async def delete_note(
        self,
        *,
        sha: str,
        expected_ref_sha: Optional[str] = None,
        author: Optional[CommitSignature] = None,
        ref: Optional[str] = None,
        ttl: Optional[int] = None,
        ref_policies: Optional[Refs] = None,
    ) -> NoteWriteResult:
        """Delete a git note.

        Set ``ref`` to target a notes ref other than ``refs/notes/commits``; a
        bare name like ``reviews`` is placed under ``refs/notes/``.
        """
        sha_clean = sha.strip()
        if not sha_clean:
            raise ValueError("delete_note sha is required")

        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, _build_jwt_options(["git:write"], ttl, ref_policies))

        payload: Dict[str, Any] = {"sha": sha_clean}
        if ref and ref.strip():
            payload["ref"] = ref.strip()
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

    async def list_notes_refs(
        self,
        *,
        prefix: Optional[str] = None,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
        ttl: Optional[int] = None,
    ) -> ListNotesRefsResult:
        """List git notes refs under a prefix, with cursor pagination.

        Use this to discover custom notes namespaces before reading individual
        notes.

        Args:
            prefix: Notes ref prefix to enumerate. A bare prefix like
                ``reviews/`` is placed under ``refs/notes/``; a fully-qualified
                ``refs/notes/*`` prefix is also accepted. Defaults to
                ``refs/notes/``.
            cursor: Pagination cursor from a previous response.
            limit: Maximum number of notes refs to return (default 20).
            ttl: Token TTL in seconds.

        Returns:
            Notes refs with pagination info.

        Requires the custom notes refs feature to be enabled server-side; when
        it is not, the server responds with HTTP 400.
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, {"permissions": ["git:read"], "ttl": ttl})

        params: Dict[str, str] = {}
        if prefix and prefix.strip():
            params["prefix"] = prefix.strip()
        if cursor:
            params["cursor"] = cursor
        if limit is not None:
            params["limit"] = str(limit)

        url = f"{self.api_base_url}/api/v{self.api_version}/repos/notes/refs"
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

            refs: List[NotesRefInfo] = [
                {
                    "cursor": r["cursor"],
                    "ref": r["ref"],
                    "sha": r["sha"],
                }
                for r in data["refs"]
            ]

            return {
                "refs": refs,
                "next_cursor": data.get("next_cursor"),
                "has_more": data["has_more"],
                "prefix": data["prefix"],
            }

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
        git_apply_compatible: Optional[bool] = None,
        paths: Optional[list[str]] = None,
        ttl: Optional[int] = None,
    ) -> GetCommitDiffResult:
        """Get diff for a specific commit.

        Args:
            sha: Commit SHA
            base_sha: Optional base commit SHA to compare against
            git_apply_compatible: Generate raw diffs that can be applied to the base tree. Defaults to
                False.
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
        if git_apply_compatible is not None:
            params.append(("gitApplyCompatible", str(git_apply_compatible).lower()))
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
        ref_policies: Optional[Refs] = None,
    ) -> None:
        """Pull from upstream repository.

        Args:
            ref: Git ref to pull
            ttl: Token TTL in seconds
            ref_policies: Ordered per-ref policy rules (first match wins)

        Raises:
            ApiError: If pull fails
        """
        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, _build_jwt_options(["git:write"], ttl, ref_policies))

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

    async def create_deployment(
        self,
        *,
        ref: Optional[str] = None,
        target: Optional[DeploymentTarget] = None,
        idempotency_key: Optional[str] = None,
        ttl: Optional[int] = None,
    ) -> CreateDeploymentResult:
        """Create a deployment for a repository revision."""
        if target is not None and target not in ("preview", "production"):
            raise ValueError("create_deployment target must be preview or production")

        body: Dict[str, Any] = {}
        ref_clean = normalize_optional_ref(ref)
        if ref_clean is not None:
            body["ref"] = ref_clean
        if target is not None:
            body["target"] = target

        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(
            self._id,
            {"permissions": ["deployment:write"], "ttl": ttl},
        )
        headers = {
            "Authorization": f"Bearer {jwt}",
            "Content-Type": "application/json",
            "Code-Storage-Agent": get_user_agent(),
        }
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        repo_name = quote(self._id, safe="")
        url = f"{self.api_base_url}/api/repos/{repo_name}/deployments"

        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=body, timeout=30.0)
            if not response.is_success:
                raise _deployment_api_error(response, "Failed to create deployment")
            deployment = _deployment_result(response.json())

        result: CreateDeploymentResult = {
            **deployment,
            "location": response.headers.get("Location", ""),
            "idempotency_key": response.headers.get("Idempotency-Key", idempotency_key or ""),
            "idempotent_replayed": (
                response.headers.get("Idempotent-Replayed", "").lower() == "true"
                or response.status_code == 200
            ),
        }
        return result

    async def list_deployments(
        self,
        *,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
        ttl: Optional[int] = None,
    ) -> ListDeploymentsResult:
        """List durable deployments for the repository."""
        params: Dict[str, str] = {}
        if cursor is not None:
            params["cursor"] = cursor
        if limit is not None:
            params["limit"] = str(limit)

        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(
            self._id,
            {"permissions": ["deployment:read"], "ttl": ttl},
        )
        repo_name = quote(self._id, safe="")
        url = f"{self.api_base_url}/api/repos/{repo_name}/deployments"
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
                raise _deployment_api_error(response, "Failed to list deployments")
            data = response.json()

        return {
            "deployments": [_deployment_result(item) for item in data["deployments"]],
            "next_cursor": data.get("next_cursor"),
            "has_more": bool(data["has_more"]),
        }

    async def get_deployment(
        self,
        *,
        deployment_id: str,
        ttl: Optional[int] = None,
    ) -> DeploymentResult:
        """Get one durable deployment."""
        deployment_id_clean = deployment_id.strip()
        if not deployment_id_clean:
            raise ValueError("get_deployment deployment_id is required")

        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(
            self._id,
            {"permissions": ["deployment:read"], "ttl": ttl},
        )
        repo_name = quote(self._id, safe="")
        encoded_deployment_id = quote(deployment_id_clean, safe="")
        url = f"{self.api_base_url}/api/repos/{repo_name}/deployments/{encoded_deployment_id}"

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
                raise _deployment_api_error(response, "Failed to get deployment")
            return _deployment_result(response.json())

    async def deploy(
        self,
        *,
        target: DeploymentTarget,
        ref: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        poll_interval: float = 2.0,
        timeout: float = 600.0,
        ttl: Optional[int] = None,
    ) -> DeploymentResult:
        """Create a deployment and wait for it to reach a terminal state.

        Creates the deployment, then polls until it is ready, fails, or the
        timeout expires.

        Args:
            target: Deployment target
            ref: Branch, tag, or commit to deploy
            idempotency_key: Key used to make creation idempotent
            poll_interval: Seconds between polls (default 2.0)
            timeout: Overall wait budget in seconds (default 600.0)
            ttl: Token TTL in seconds

        Returns:
            Deployment result once its status is ready

        Raises:
            ValueError: If interval or timeout is not positive and finite
            DeploymentFailedError: If the deployment ends in error or canceled
            TimeoutError: If the timeout expires before a terminal state
        """
        if not math.isfinite(poll_interval) or poll_interval <= 0:
            raise ValueError("deploy poll_interval must be a positive finite number")
        if not math.isfinite(timeout) or timeout <= 0:
            raise ValueError("deploy timeout must be a positive finite number")

        deployment: DeploymentResult = await self.create_deployment(
            ref=ref,
            target=target,
            idempotency_key=idempotency_key,
            ttl=ttl,
        )
        deployment_id = deployment["id"]
        deadline = time.monotonic() + timeout
        while True:
            status = str(deployment["status"])
            if status == "ready":
                return deployment
            if status in ("error", "canceled"):
                error_code = deployment.get("error_code", "")
                error_message = deployment.get("error_message", "")
                raise DeploymentFailedError(
                    f"deploy deployment {deployment_id} ended with "
                    f"status {status} (error_code: {error_code}, "
                    f"error_message: {error_message})",
                    status=status,
                    error_code=error_code,
                    error_message=error_message,
                )
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError(
                    f"deploy timed out after {timeout}s waiting for "
                    f"deployment {deployment_id} (last status: {status})"
                )
            await asyncio.sleep(min(poll_interval, remaining))

            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError(
                    f"deploy timed out after {timeout}s waiting for "
                    f"deployment {deployment_id} (last status: {status})"
                )
            try:
                deployment = await asyncio.wait_for(
                    self.get_deployment(deployment_id=deployment_id, ttl=ttl),
                    timeout=remaining,
                )
            except asyncio.TimeoutError as error:
                raise TimeoutError(
                    f"deploy timed out after {timeout}s waiting for "
                    f"deployment {deployment_id} (last status: {status})"
                ) from error

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
        ref_policies: Optional[Refs] = None,
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
        jwt = self.generate_jwt(self._id, _build_jwt_options(["git:write"], ttl, ref_policies))

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
        ref_policies: Optional[Refs] = None,
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
                _build_jwt_options(["git:write"], ttl, ref_policies),
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
        ref_policies: Optional[Refs] = None,
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
                _build_jwt_options(["git:write"], ttl_value, ref_policies),
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
        ref: Optional[str] = None,
        ttl: Optional[int],
        ref_policies: Optional[Refs] = None,
    ) -> NoteWriteResult:
        sha_clean = sha.strip()
        if not sha_clean:
            raise ValueError(f"{action_label} sha is required")

        note_clean = note.strip()
        if not note_clean:
            raise ValueError(f"{action_label} note is required")

        ttl = ttl or DEFAULT_TOKEN_TTL_SECONDS
        jwt = self.generate_jwt(self._id, _build_jwt_options(["git:write"], ttl, ref_policies))

        payload: Dict[str, Any] = {
            "sha": sha_clean,
            "action": action,
            "note": note_clean,
        }
        if ref and ref.strip():
            payload["ref"] = ref.strip()
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
