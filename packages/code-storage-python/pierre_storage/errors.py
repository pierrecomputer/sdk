"""Error classes for Pierre Git Storage SDK."""

from typing import TYPE_CHECKING, Any, Dict, List, Literal, Optional

if TYPE_CHECKING:
    from pierre_storage.types import RefUpdate


class ApiError(Exception):
    """Exception raised for API errors."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        response: Optional[Any] = None,
    ) -> None:
        """Initialize the ApiError.

        Args:
            message: Error message
            status_code: HTTP status code
            response: Raw response object
        """
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.response = response


class RefUpdateError(Exception):
    """Exception raised when a ref update fails."""

    def __init__(
        self,
        message: str,
        status: Optional[str] = None,
        reason: Optional[str] = None,
        ref_update: "Optional[RefUpdate]" = None,
        guard: Optional[Literal["target", "source"]] = None,
        expected_sha: Optional[str] = None,
        actual_sha: Optional[str] = None,
        conflict_paths: Optional[List[str]] = None,
        merge_base_sha: Optional[str] = None,
    ) -> None:
        """Initialize the RefUpdateError.

        Args:
            message: Error message
            status: Status code from the server
            reason: Reason for the failure
            ref_update: Partial ref update information
            guard: Failed merge guard
            expected_sha: Caller-provided SHA for the failed guard
            actual_sha: Authoritative SHA for the failed guard
            conflict_paths: Paths that conflicted during a merge
            merge_base_sha: Merge base for a merge conflict
        """
        super().__init__(message)
        self.message = message
        self.status = status or "unknown"
        self.reason = reason or self.status
        self.ref_update: Dict[str, str] = ref_update or {}  # type: ignore[assignment]
        self.guard = guard
        self.expected_sha = expected_sha
        self.actual_sha = actual_sha
        self.conflict_paths = conflict_paths
        self.merge_base_sha = merge_base_sha


def parse_merge_ref_update_error(
    message: str, status_code: int, body: Any
) -> Optional[RefUpdateError]:
    """Parse a stable merge 409 response into a ref update error."""
    if status_code != 409 or not isinstance(body, dict):
        return None

    code = body.get("code")
    if code == "merge_conflict":
        conflict_paths = body.get("conflict_paths", [])
        merge_base_sha = body.get("merge_base_sha")
        if not isinstance(conflict_paths, list) or not all(
            isinstance(path, str) for path in conflict_paths
        ):
            return None
        if merge_base_sha is not None and not isinstance(merge_base_sha, str):
            return None
        return RefUpdateError(
            message,
            status=code,
            reason="conflict",
            conflict_paths=conflict_paths,
            merge_base_sha=merge_base_sha,
        )

    if code == "precondition_failed":
        guard = body.get("guard")
        expected_sha = body.get("expected_sha")
        actual_sha = body.get("actual_sha")
        if guard not in {"target", "source"}:
            return None
        if not isinstance(expected_sha, str) or not isinstance(actual_sha, str):
            return None
        return RefUpdateError(
            message,
            status=code,
            reason="precondition_failed",
            guard=guard,
            expected_sha=expected_sha,
            actual_sha=actual_sha,
        )

    return None


def infer_ref_update_reason(status_code: str) -> str:
    """Infer the ref update reason from HTTP status code.

    Args:
        status_code: HTTP status code as string

    Returns:
        Inferred reason string
    """
    status_map = {
        "400": "invalid",
        "401": "unauthorized",
        "403": "forbidden",
        "404": "not_found",
        "408": "timeout",
        "409": "conflict",
        "412": "precondition_failed",
        "422": "invalid",
        "429": "unavailable",
        "499": "timeout",
        "500": "internal",
        "502": "unavailable",
        "503": "unavailable",
        "504": "timeout",
    }
    return status_map.get(status_code, "unknown")
