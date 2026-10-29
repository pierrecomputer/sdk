"""The Pierre SDK: `Pierre` for blocking code and `AsyncPierre` for `asyncio` code.

The local utilities are in their modules: `pierre.auth`, `pierre.git`, and `pierre.webhooks`. The
types of the API are in `pierre.types`.

Docs: the MCP server at https://code.storage/docs/mcp, or the Markdown pages from
https://code.storage/docs/llms.txt.
"""

from pierre._client import AsyncPierre, ClientOptions, Pierre
from pierre._errors import (
    APIConnectionError,
    APIError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    ConflictError,
    InternalServerError,
    MergeConflictError,
    NotFoundError,
    PermissionDeniedError,
    PierreError,
    RateLimitError,
    RefGuardError,
    RefUpdateError,
    WebhookVerificationError,
)
from pierre._page import AsyncPage, AsyncPaginator, Page
from pierre._response import RawResponse
from pierre._types import NOT_GIVEN, NotGiven
from pierre._version import __version__

__all__ = [
    "__version__",
    "NOT_GIVEN",
    "APIConnectionError",
    "APIError",
    "APITimeoutError",
    "AsyncPage",
    "AsyncPaginator",
    "AsyncPierre",
    "AuthenticationError",
    "BadRequestError",
    "ClientOptions",
    "ConflictError",
    "InternalServerError",
    "MergeConflictError",
    "NotFoundError",
    "NotGiven",
    "Page",
    "PermissionDeniedError",
    "Pierre",
    "PierreError",
    "RateLimitError",
    "RawResponse",
    "RefGuardError",
    "RefUpdateError",
    "WebhookVerificationError",
]
