"""The errors of the SDK."""

from typing import Any, Dict, Literal, Mapping, Optional, Type, Union, cast

import httpx

from pierre._generated.schemas import (
    NotesWriteResult,
    RefUpdateResult,
    RestoredCommit,
    WrittenCommit,
)

# The docs page with the table of problem codes, in the Markdown form for agents.
ERROR_CODES_DOC_URL = "https://code.storage/docs/api/overview.md#error-codes"


class PierreError(Exception):
    """The base class of every error that the SDK raises."""


class APIConnectionError(PierreError):
    """The request got no response."""


class APITimeoutError(APIConnectionError):
    """The request got no response before its timeout."""


def _text(value: object) -> Optional[str]:
    return value if isinstance(value, str) and value != "" else None


def _problem(body: object) -> Mapping[str, Any]:
    return body if isinstance(body, dict) else {}


class APIError(PierreError):
    """An HTTP error response. Branch on `code`, not on the message."""

    status: int
    # The problem `code`, for example `repository_not_found`.
    code: Optional[str]
    title: Optional[str]
    detail: Optional[str]
    # The `X-Request-Id` response header, or `None` when the server does not send it.
    request_id: Optional[str]
    # The headers of the error response, for example `retry-after`.
    headers: httpx.Headers
    # The parsed response body, with any extension members, or its text when it is not JSON.
    body: object
    # The docs page that explains the codes.
    doc_url: str

    def __init__(self, status: int, body: object, headers: Optional[httpx.Headers] = None) -> None:
        problem = _problem(body)
        code = _text(problem.get("code"))
        title = _text(problem.get("title"))
        detail = (
            _text(problem.get("detail"))
            or _text(problem.get("error"))
            or _text(problem.get("message"))
        )
        prefix = f"{status}" if code is None else f"{status} {code}"
        super().__init__(f"{prefix}: {detail or title or 'request failed'}")
        self.status = status
        self.code = code
        self.title = title
        self.detail = detail
        self.headers = headers if headers is not None else httpx.Headers()
        self.request_id = self.headers.get("x-request-id")
        self.body = body
        self.doc_url = ERROR_CODES_DOC_URL


class BadRequestError(APIError):
    """A 400 response."""


class AuthenticationError(APIError):
    """A 401 response."""


class PermissionDeniedError(APIError):
    """A 403 response."""


class NotFoundError(APIError):
    """A 404 response."""


class ConflictError(APIError):
    """A 409 response."""


class RateLimitError(APIError):
    """A 429 response."""


class InternalServerError(APIError):
    """A 5xx response."""


class MergeConflictError(ConflictError):
    """A merge conflict. It carries the conflict fields of the response."""

    conflict_type: Optional[str]
    conflict_paths: object
    merge_base_sha: Optional[str]

    def __init__(self, status: int, body: object, headers: Optional[httpx.Headers] = None) -> None:
        super().__init__(status, body, headers)
        problem = _problem(body)
        self.conflict_type = _text(problem.get("conflict_type"))
        self.conflict_paths = problem.get("conflict_paths")
        self.merge_base_sha = _text(problem.get("merge_base_sha"))


class RefGuardError(ConflictError):
    """A Git write whose ref guard failed: a response with the code `ref_guard_failed`. `guard`
    names the request field of the guard, for example `expected_target_sha`. `current_sha` is the
    commit of the guarded ref, or 40 zeros when the ref does not exist; send it as the guard of the
    next attempt. The body of a commit write, a restore, or a notes write also keeps `result`, which
    `body` gives."""

    guard: Optional[str]
    current_sha: Optional[str]

    def __init__(self, status: int, body: object, headers: Optional[httpx.Headers] = None) -> None:
        super().__init__(status, body, headers)
        problem = _problem(body)
        self.guard = _text(problem.get("guard"))
        self.current_sha = _text(problem.get("current_sha"))


class RefUpdateError(APIError):
    """A Git write whose ref update failed: an error response whose body has `result`. It carries
    `result` and `commit`. A Git write method returns only when the ref update succeeded."""

    # The result of the ref update. `status` gives the reason, for example `conflict` or
    # `precondition_failed`. A notes write sends a `NotesWriteResult`, which has only `success`,
    # `status`, and `message`.
    result: Union[RefUpdateResult, NotesWriteResult]
    # The commit of the write, or `None` when the response has none. A restore has no `blob_count`.
    commit: Optional[Union[WrittenCommit, RestoredCommit]]

    def __init__(self, status: int, body: object, headers: Optional[httpx.Headers] = None) -> None:
        super().__init__(status, body, headers)
        problem = _problem(body)
        self.result = cast(Union[RefUpdateResult, NotesWriteResult], problem.get("result"))
        self.commit = problem.get("commit")


WebhookVerificationFailure = Literal[
    "missing_signature",
    "malformed_signature",
    "signature_mismatch",
    "timestamp_out_of_range",
    "invalid_payload",
]


class WebhookVerificationError(PierreError):
    """`verify_webhook` rejected the delivery. `reason` says why."""

    def __init__(self, reason: WebhookVerificationFailure, message: str) -> None:
        super().__init__(message)
        self.reason: WebhookVerificationFailure = reason


_BY_STATUS: Dict[int, Type[APIError]] = {
    400: BadRequestError,
    401: AuthenticationError,
    403: PermissionDeniedError,
    404: NotFoundError,
    409: ConflictError,
    429: RateLimitError,
}

# The codes of a merge conflict. Today the conflict body can also have `conflict_type` only.
_MERGE_CONFLICT_CODES = frozenset({"merge_conflict"})

# The code of a failed ref guard. Its body can also have `result`, so it is read first.
_REF_GUARD_FAILED = "ref_guard_failed"


def api_error(status: int, body: object, headers: httpx.Headers) -> APIError:
    """Picks the error class of an error response from the status and the body."""
    problem = _problem(body)
    code = _text(problem.get("code"))
    if code == _REF_GUARD_FAILED:
        return RefGuardError(status, body, headers)
    if isinstance(problem.get("result"), dict):
        return RefUpdateError(status, body, headers)
    if (code is not None and code in _MERGE_CONFLICT_CODES) or isinstance(
        problem.get("conflict_type"), str
    ):
        return MergeConflictError(status, body, headers)
    error_class = _BY_STATUS.get(status, InternalServerError if status >= 500 else APIError)
    return error_class(status, body, headers)


def problem_code(body: object) -> Optional[str]:
    """The problem `code` of a parsed body, or `None`."""
    return _text(_problem(body).get("code"))
