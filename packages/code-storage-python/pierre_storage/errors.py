"""Error classes for Pierre Git Storage SDK."""

from typing import TYPE_CHECKING, Any, Dict, Optional

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
            response: Raw response object; request authorization is removed
        """
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        if response is not None:
            try:
                request = response.request
            except (AttributeError, RuntimeError):
                request = None
            if request is not None:
                request.headers.pop("Authorization", None)
        self.response = response


class RefUpdateError(Exception):
    """Exception raised when a ref update fails."""

    def __init__(
        self,
        message: str,
        status: Optional[str] = None,
        reason: Optional[str] = None,
        ref_update: "Optional[RefUpdate]" = None,
    ) -> None:
        """Initialize the RefUpdateError.

        Args:
            message: Error message
            status: Status code from the server
            reason: Reason for the failure
            ref_update: Partial ref update information
        """
        super().__init__(message)
        self.message = message
        self.status = status or "unknown"
        self.reason = reason or self.status
        self.ref_update: Dict[str, str] = ref_update or {}  # type: ignore[assignment]


class DeploymentFailedError(Exception):
    """Exception raised when a deployment ends in a failed state."""

    def __init__(
        self,
        message: str,
        status: Optional[str] = None,
        error_code: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """Initialize the DeploymentFailedError.

        Args:
            message: Error message
            status: Terminal deployment status (error or canceled)
            error_code: Failure code reported by the server
            error_message: Failure message reported by the server
        """
        super().__init__(message)
        self.message = message
        self.status = status or "unknown"
        self.error_code = error_code or ""
        self.error_message = error_message or ""


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
