"""`pierre.with_raw_response`: each method gives its result with the response.
The `with_raw_response` namespaces wrap the methods of the client namespaces, so they take the
same arguments."""

import functools
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Awaitable, Callable, Generic, Optional, TypeVar, cast

import httpx

from pierre._compat import ParamSpec
from pierre._errors import PierreError
from pierre._operation import OperationSpec

Data = TypeVar("Data")
Headers = TypeVar("Headers")
Params = ParamSpec("Params")


@dataclass(frozen=True)
class RawResponse(Generic[Data, Headers]):
    """The result of a method of `pierre.with_raw_response`."""

    # What the method of the client returns.
    data: Data
    # The `httpx.Response` of the last attempt. The SDK read its body, except for a byte stream,
    # whose `data` is this response.
    response: httpx.Response
    # The response headers that the document declares, by the wire form of each name.
    headers: Headers
    # The `X-Request-Id` header, or `None` when the server does not send it.
    request_id: Optional[str]


class _Claim:
    """Marks the first request of a `with_raw_response` call. A request inside the call, such as
    one from a content function, gives its plain result."""

    claimed = False


_RAW: "ContextVar[Optional[_Claim]]" = ContextVar("pierre_raw_response", default=None)


def claim_raw() -> bool:
    """Whether this request is the first request of a `with_raw_response` call."""
    claim = _RAW.get()
    if claim is None or claim.claimed:
        return False
    claim.claimed = True
    return True


def _checked(result: object) -> object:
    if not isinstance(result, RawResponse):
        raise PierreError("The method sent no request, so it has no response.")
    return result


def raw_method(
    method: Callable[Params, Data], operation: OperationSpec[Headers]
) -> Callable[Params, RawResponse[Data, Headers]]:
    """The method of `Pierre` that returns a `RawResponse`. `operation` gives the headers type."""

    @functools.wraps(method)
    def call(*args: Params.args, **kwargs: Params.kwargs) -> RawResponse[Data, Headers]:
        token = _RAW.set(_Claim())
        try:
            result: object = method(*args, **kwargs)
        finally:
            _RAW.reset(token)
        return cast(RawResponse[Data, Headers], _checked(result))

    return call


def async_raw_method(
    method: Callable[Params, Awaitable[Data]], operation: OperationSpec[Headers]
) -> Callable[Params, Awaitable[RawResponse[Data, Headers]]]:
    """The method of `AsyncPierre` that returns a `RawResponse`."""

    @functools.wraps(method)
    async def call(*args: Params.args, **kwargs: Params.kwargs) -> RawResponse[Data, Headers]:
        token = _RAW.set(_Claim())
        try:
            result: object = await method(*args, **kwargs)
        finally:
            _RAW.reset(token)
        return cast(RawResponse[Data, Headers], _checked(result))

    return call
