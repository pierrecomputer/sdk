"""The request functions: they turn an operation spec and the arguments of a call into an HTTP
request, and the response into the result of its encoding. They apply the timeout and the retries.
`SyncRuntime` serves `Pierre`, and `AsyncRuntime` serves `AsyncPierre`."""

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field
from itertools import count
from typing import (
    Any,
    AsyncIterable,
    AsyncIterator,
    Dict,
    Iterable,
    Iterator,
    List,
    Mapping,
    Optional,
    Sequence,
    Tuple,
    Union,
)
from urllib.parse import quote

import httpx

from pierre import _retry
from pierre._credentials import (
    REQUEST_TOKEN_SECONDS,
    Credentials,
    Rules,
    TokenNeeds,
    check_ref_policies,
    check_ttl,
    copy_ref_policies,
)
from pierre._errors import (
    APIConnectionError,
    APITimeoutError,
    PierreError,
    api_error,
    problem_code,
)
from pierre._operation import JsonBodySpec, NdjsonBodySpec, OperationSpec
from pierre._page import AsyncPage, AsyncPaginator, Page
from pierre._response import RawResponse, claim_raw
from pierre._types import NotGiven, RequestOptions

# A repeat of these methods is safe.
_SAFE_METHODS = frozenset({"GET", "HEAD", "PUT", "DELETE"})

# The largest `Idempotency-Key`, in UTF-8 bytes.
_MAX_IDEMPOTENCY_KEY_BYTES = 255

# The characters that `encodeURIComponent` keeps, so that a path is the same in every SDK.
_SEGMENT_SAFE = "!~*'()"

Values = Dict[str, Any]


@dataclass(frozen=True)
class HttpConfig:
    """The settings of the transport of a client."""

    base_url: str
    credentials: Credentials
    # The `Pierre-Client` header.
    client: str
    default_headers: Mapping[str, str]
    # The timeout of each attempt, in seconds.
    timeout: float
    max_retries: int
    # The ref policies of the client, which a request option replaces.
    rules: Optional[Rules]


def check_timeout(timeout: object) -> float:
    if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or not timeout > 0:
        raise PierreError("`timeout` must be a number of seconds greater than 0.")
    return float(timeout)


def check_max_retries(max_retries: object) -> int:
    if isinstance(max_retries, bool) or not isinstance(max_retries, int) or max_retries < 0:
        raise PierreError("`max_retries` must be a whole number, 0 or more.")
    return max_retries


def copy_options(options: RequestOptions) -> RequestOptions:
    """A copy of the request options, their headers, and their ref policies, so that a later
    change by the caller does not change a request or a next page."""
    headers = options.extra_headers
    policies = options.ref_policies
    return RequestOptions(
        extra_headers=dict(headers) if isinstance(headers, Mapping) else headers,
        timeout=options.timeout,
        max_retries=options.max_retries,
        idempotency_key=options.idempotency_key,
        token_ttl=options.token_ttl,
        ref_policies=policies if isinstance(policies, NotGiven) else copy_ref_policies(policies),  # type: ignore[arg-type]
    )


def _given(value: Any, default: Any) -> Any:
    return default if isinstance(value, NotGiven) else value


@dataclass
class BodyFailure:
    """The first error of the body content, for example from a commit file's content function."""

    error: Optional[BaseException] = None


@dataclass
class Prepared:
    """The parts of a call that each attempt uses."""

    operation: OperationSpec[Any]
    url: httpx.URL
    # The headers without the token and the request headers.
    headers: List[Tuple[str, str]]
    json: Optional[bytes]
    # The lines of an NDJSON body: the first line, then the argument `chunks`.
    ndjson: Optional[Tuple[Values, object]]
    token: TokenNeeds
    request_headers: Mapping[str, str]
    timeout: float
    max_retries: int
    repeatable: bool
    failure: BodyFailure = field(default_factory=BodyFailure)


@dataclass
class Outcome:
    """The end of one attempt: the response and its data, or an error."""

    response: Optional[httpx.Response] = None
    data: Any = None
    error: Optional[PierreError] = None
    transient: bool = False
    retry_after: Optional[str] = None


class BaseRuntime:
    """The parts of a request that do no I/O."""

    def __init__(self, config: HttpConfig) -> None:
        self.config = config

    def prepare(
        self, operation: OperationSpec[Any], params: Mapping[str, Any], options: RequestOptions
    ) -> Prepared:
        config = self.config
        ttl = check_ttl(_given(options.token_ttl, REQUEST_TOKEN_SECONDS), "token_ttl")
        # A request option replaces the client option.
        rules = check_ref_policies(_given(options.ref_policies, None), "ref_policies")
        if rules is None:
            rules = config.rules or ()
        if len(rules) > 0 and config.credentials.fixed:
            raise PierreError(
                "A client with a fixed `token` cannot use `ref_policies`. "
                "Give `private_key` or `get_token`."
            )
        timeout = check_timeout(_given(options.timeout, config.timeout))
        max_retries = check_max_retries(_given(options.max_retries, config.max_retries))
        idempotency_key = _idempotency_key(operation, options.idempotency_key)

        values: Values = {
            name: value for name, value in params.items() if not isinstance(value, NotGiven)
        }
        body = operation.body
        # The SDK names a new repository when the caller does not.
        if (
            operation.repo_claim
            and "repo_name" not in values
            and body is not None
            and "repo_name" in body.fields
        ):
            values["repo_name"] = str(uuid.uuid4())

        headers: List[Tuple[str, str]] = [
            ("Pierre-Client", config.client),
            ("Accept", "application/json" if operation.response_encoding == "json" else "*/*"),
        ]
        # The default headers come after `Pierre-Client`, so a client such as the CLI can name
        # itself. The token comes later, and the request headers come last.
        for name, text in config.default_headers.items():
            _set(headers, name, text)
        query: List[Tuple[str, Union[str, int, float, bool, None]]] = []
        for parameter in operation.parameters:
            if parameter.location == "path" or parameter.field not in values:
                continue
            # `None` cannot be a query or header value, so it raises `PierreError`.
            value = values[parameter.field]
            if parameter.location == "query":
                # A query array is any sequence that is not text: one pair for each value.
                items = (
                    value
                    if isinstance(value, Sequence) and not isinstance(value, (str, bytes))
                    else [value]
                )
                query.extend(
                    (parameter.name, _wire_text(operation, parameter.field, item)) for item in items
                )
            else:
                _set(headers, parameter.name, _wire_text(operation, parameter.field, value))
        repo: Optional[str] = None
        if operation.repo_claim:
            claim = values.get("repo_name")
            if not isinstance(claim, str):
                raise PierreError(f"{operation.id} needs `repo_name`")
            repo = claim
        if idempotency_key is not None:
            _set(headers, "Idempotency-Key", idempotency_key)

        content: Optional[bytes] = None
        ndjson: Optional[Tuple[Values, object]] = None
        fields = {} if body is None else _pick(values, body.fields)
        if isinstance(body, JsonBodySpec) and (body.required or len(fields) > 0):
            _set(headers, "Content-Type", "application/json")
            content = _json_text(operation, fields).encode("utf-8")
        elif isinstance(body, NdjsonBodySpec):
            _set(headers, "Content-Type", "application/x-ndjson")
            ndjson = ({body.first: fields}, values.get("chunks"))
        url = httpx.URL(config.base_url.rstrip("/") + _expand_path(operation, values))
        if query:
            url = url.copy_merge_params(query)
        extra = options.extra_headers
        return Prepared(
            operation=operation,
            url=url,
            headers=headers,
            json=content,
            ndjson=ndjson,
            token=TokenNeeds(scopes=operation.scopes, repo=repo, ttl=ttl, rules=rules),
            request_headers=dict(extra) if isinstance(extra, Mapping) else {},
            timeout=timeout,
            max_retries=max_retries,
            # The SDK cannot send a stream twice, so a streaming body never retries.
            repeatable=ndjson is None
            and (operation.method in _SAFE_METHODS or idempotency_key is not None),
        )

    def headers_of(self, prepared: Prepared, token: str) -> httpx.Headers:
        headers = list(prepared.headers)
        _set(headers, "Authorization", f"Bearer {token}")
        for name, value in prepared.request_headers.items():
            _set(headers, name, value)
        return httpx.Headers(headers)

    def success(self, operation: OperationSpec[Any], response: httpx.Response) -> bool:
        return response.is_success or (response.status_code == 304 and operation.not_modified)

    def failure(self, response: httpx.Response, content: bytes) -> Outcome:
        body = _parse_error_body(content)
        return Outcome(
            response=response,
            error=api_error(response.status_code, body, response.headers),
            transient=_retry.transient_status(response.status_code, problem_code(body)),
            retry_after=response.headers.get("retry-after"),
        )

    def connection_error(
        self, prepared: Prepared, error: Exception
    ) -> Union[Outcome, BaseException]:
        """The outcome of an attempt that got no response, or the error to raise as it is."""
        operation = prepared.operation
        # The caller's content failed, not the connection: give its own error.
        if prepared.failure.error is not None:
            return prepared.failure.error
        if isinstance(error, httpx.TimeoutException):
            timeout = APITimeoutError(f"{operation.id}: no response within {prepared.timeout:g} s")
            timeout.__cause__ = error
            return Outcome(error=timeout, transient=True)
        if isinstance(error, PierreError):
            return error
        # Any other failure of the send means that the request got no response, as in
        # TypeScript: a transport can raise more than `httpx.RequestError`.
        connection = APIConnectionError(f"{operation.id}: {error!r}")
        connection.__cause__ = error
        return Outcome(error=connection, transient=True)

    def timeout_outcome(self, prepared: Prepared) -> Outcome:
        """The outcome of an attempt that passed its timeout, which a retry can repeat."""
        return Outcome(
            error=APITimeoutError(
                f"{prepared.operation.id}: no response within {prepared.timeout:g} s"
            ),
            transient=True,
        )

    def json_data(self, operation: OperationSpec[Any], content: bytes) -> Any:
        try:
            return json.loads(content)
        except ValueError as error:
            raise PierreError(f"{operation.id}: the response body is not JSON") from error

    def none_data(self, operation: OperationSpec[Any], response: httpx.Response) -> Any:
        return {"status": response.status_code, "headers": declared_headers(operation, response)}

    def result(self, operation: OperationSpec[Any], outcome: Outcome, raw: bool) -> Any:
        """The data of the outcome, or a `RawResponse` for `with_raw_response`."""
        if not raw:
            return outcome.data
        response = outcome.response
        assert response is not None
        return RawResponse(
            data=outcome.data,
            response=response,
            headers=declared_headers(operation, response),
            request_id=response.headers.get("x-request-id"),
        )

    def token_needs(self, repo: str, options: RequestOptions) -> TokenNeeds:
        if self.config.credentials.fixed:
            raise PierreError(
                "A client with a fixed `token` cannot make a token for another repository. "
                "Give that token in the params."
            )
        ttl = check_ttl(_given(options.token_ttl, REQUEST_TOKEN_SECONDS), "token_ttl")
        return TokenNeeds(scopes=("git:read",), repo=repo, ttl=ttl, rules=())


def declared_headers(operation: OperationSpec[Any], response: httpx.Response) -> Dict[str, str]:
    """The declared response headers that the response has, by field."""
    headers: Dict[str, str] = {}
    for header in operation.response_headers:
        value = response.headers.get(header.name)
        if value is not None:
            headers[header.field] = value
    return headers


def _set(headers: List[Tuple[str, str]], name: str, value: str) -> None:
    """Sets a header, and removes each other value of its name, without case."""
    lower = name.lower()
    headers[:] = [(key, item) for key, item in headers if key.lower() != lower]
    headers.append((name, value))


def _idempotency_key(operation: OperationSpec[Any], key: Union[str, NotGiven]) -> Optional[str]:
    """The caller's key, or a new UUID for an operation that accepts one."""
    if isinstance(key, NotGiven):
        return str(uuid.uuid4()) if operation.idempotency_key else None
    # The server ignores a key that the operation does not accept, so a retry could repeat the
    # write.
    if not operation.idempotency_key:
        raise PierreError(f"{operation.id} does not accept an idempotency key.")
    size = len(key.encode("utf-8")) if isinstance(key, str) else 0
    if size == 0 or size > _MAX_IDEMPOTENCY_KEY_BYTES:
        raise PierreError(
            f"`idempotency_key` must have 1 to {_MAX_IDEMPOTENCY_KEY_BYTES} bytes of UTF-8."
        )
    return key


def _expand_path(operation: OperationSpec[Any], values: Values) -> str:
    """Puts the path parameters in the path. Each value is one segment, so `/` is `%2F`."""
    path = operation.path
    for parameter in operation.parameters:
        if parameter.location != "path":
            continue
        value = values.get(parameter.field)
        if value is None or value == "":
            raise PierreError(f"{operation.id} needs `{parameter.field}`")
        segment = quote(_wire_text(operation, parameter.field, value), safe=_SEGMENT_SAFE)
        # A URL parser resolves `.` and `..`, which would send the request to another route.
        if segment in (".", ".."):
            raise PierreError(f"{operation.id}: `{parameter.field}` cannot be `{segment}`")
        path = path.replace(f"{{{parameter.name}}}", segment)
    return path


def _wire_text(operation: OperationSpec[Any], field: str, value: object) -> str:
    """The text of a path, query, or header value. The model allows only scalar parameters."""
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return str(int(value)) if value.is_integer() else repr(value)
    raise PierreError(f"{operation.id}: `{field}` must be a string, a number, or a boolean")


def _pick(values: Values, fields: Tuple[str, ...]) -> Values:
    """The given fields. A missing field is not sent, and `None` is sent as `null`."""
    return {name: values[name] for name in fields if name in values}


def _parse_error_body(content: bytes) -> object:
    text = content.decode("utf-8", errors="replace")
    if text == "":
        return None
    try:
        return json.loads(text)
    except ValueError:
        return text


def _json_text(operation: OperationSpec[Any], value: object) -> str:
    """The JSON text of a body or of a line. NaN and infinity are not JSON, so they raise
    `PierreError`."""
    try:
        return json.dumps(value, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    except ValueError as error:
        raise PierreError(f"{operation.id}: the body is not valid JSON: {error}") from error


def _line(operation: OperationSpec[Any], value: object) -> bytes:
    return (_json_text(operation, value) + "\n").encode("utf-8")


class _DeadlineError(Exception):
    """The deadline of an attempt of `Pierre` passed."""


def _check_deadline(deadline: float) -> None:
    if time.monotonic() > deadline:
        raise _DeadlineError()


def _ndjson(
    operation: OperationSpec[Any],
    first: Values,
    rest: object,
    failure: BodyFailure,
    deadline: float,
) -> Iterator[bytes]:
    """The NDJSON lines of `Pierre`. It records an error of the caller's lines in `failure`, and
    stops the upload when the deadline of the attempt passes."""
    yield _line(operation, first)
    if rest is None:
        return
    if hasattr(rest, "__aiter__") or not isinstance(rest, Iterable):
        error = PierreError("`chunks` must be an iterable.")
        failure.error = error
        raise error
    lines = iter(rest)
    while True:
        try:
            line = next(lines, _END)
        except BaseException as error:
            if failure.error is None:
                failure.error = error
            raise
        if line is _END:
            return
        _check_deadline(deadline)
        yield _line(operation, line)


_END = object()


class _DeadlineStream(httpx.SyncByteStream):
    """A response stream that raises `_DeadlineError` when the deadline passes."""

    def __init__(self, stream: httpx.SyncByteStream, deadline: float) -> None:
        self._stream = stream
        self._deadline = deadline

    def __iter__(self) -> Iterator[bytes]:
        for chunk in self._stream:
            _check_deadline(self._deadline)
            yield chunk

    def close(self) -> None:
        self._stream.close()


def _read_within(response: httpx.Response, deadline: float) -> bytes:
    """Reads the body of a response, and raises `_DeadlineError` when the deadline passes.
    `response.read()` keeps the body on the response, so the caller can read it again."""
    if isinstance(response.stream, httpx.SyncByteStream):
        response.stream = _DeadlineStream(response.stream, deadline)
    return response.read()


async def _async_ndjson(
    operation: OperationSpec[Any], first: Values, rest: object, failure: BodyFailure
) -> AsyncIterator[bytes]:
    """The NDJSON lines of `AsyncPierre`, which also reads an async iterable."""
    yield _line(operation, first)
    if rest is None:
        return
    try:
        if isinstance(rest, AsyncIterable):
            async for line in rest:
                yield _line(operation, line)
        elif isinstance(rest, Iterable):
            for line in rest:
                yield _line(operation, line)
        else:
            raise PierreError("`chunks` must be an iterable or an async iterable.")
    except BaseException as error:
        if failure.error is None:
            failure.error = error
        raise


class SyncRuntime(BaseRuntime):
    """The transport of `Pierre`. `timeout` covers each attempt: the token, the upload, the
    response headers, and the body of a JSON response. The SDK cannot stop a blocking
    `get_token`, so an attempt fails when its token arrives after the deadline."""

    def __init__(self, config: HttpConfig, http_client: httpx.Client) -> None:
        super().__init__(config)
        self.http_client = http_client

    def request(
        self, operation: OperationSpec[Any], params: Mapping[str, Any], options: RequestOptions
    ) -> Any:
        """Sends one request, and returns the result of its encoding."""
        raw = claim_raw()
        outcome = self._send(self.prepare(operation, params, copy_options(options)))
        return self.result(operation, outcome, raw)

    def list(
        self, operation: OperationSpec[Any], params: Mapping[str, Any], options: RequestOptions
    ) -> Page[Any, Any]:
        """Sends a list request, and returns the first page, which also iterates over every item."""
        raw = claim_raw()
        item_field = operation.item_field
        if item_field is None:
            raise PierreError(f"{operation.id} is not a list")
        # Each next page sends the arguments and the request options of this call.
        first = dict(params)
        first_options = copy_options(options)

        def page(cursor: Optional[str]) -> Outcome:
            values = first if cursor is None else {**first, "cursor": cursor}
            outcome = self._send(self.prepare(operation, values, first_options))
            fields = _page_fields(outcome.data, item_field)
            assert outcome.response is not None
            outcome.data = Page(
                **fields,
                response=outcome.response,
                fetch=lambda next_cursor: page(next_cursor).data,
            )
            return outcome

        return self.result(operation, page(None), raw)  # type: ignore[no-any-return]

    def read_token(self, repo: str, options: RequestOptions) -> str:
        """A token with `git:read` on another repository, for example the source of a copy. The
        timeout covers it, as it covers the token of an attempt."""
        needs = self.token_needs(repo, options)
        timeout = check_timeout(_given(options.timeout, self.config.timeout))
        start = time.monotonic()
        token = self.config.credentials.token(needs)
        if time.monotonic() - start > timeout:
            raise APITimeoutError(f"no token for `{repo}` within {timeout:g} s")
        return token

    def _send(self, prepared: Prepared) -> Outcome:
        """Sends the request with its retries, and returns the outcome of the last attempt."""
        for attempt in count():
            outcome = self._attempt(prepared)
            if outcome.error is None:
                return outcome
            if not (prepared.repeatable and outcome.transient and attempt < prepared.max_retries):
                raise outcome.error
            _retry.sleep(_retry.retry_delay(outcome.retry_after, attempt))
        raise AssertionError("unreachable")

    def _attempt(self, prepared: Prepared) -> Outcome:
        operation = prepared.operation
        deadline = time.monotonic() + prepared.timeout
        token = self.config.credentials.token(prepared.token)
        # httpx gets the time that remains after the token, for each network step.
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return self.timeout_outcome(prepared)
        content: Union[bytes, Iterator[bytes], None] = prepared.json
        if prepared.ndjson is not None:
            content = _ndjson(operation, *prepared.ndjson, prepared.failure, deadline)
        request = self.http_client.build_request(
            operation.method,
            prepared.url,
            headers=self.headers_of(prepared, token),
            content=content,
            timeout=httpx.Timeout(remaining),
        )
        try:
            response = self.http_client.send(request, stream=True)
        except _DeadlineError:
            return self.timeout_outcome(prepared)
        except Exception as error:
            result = self.connection_error(prepared, error)
            if result is error:
                raise
            if isinstance(result, BaseException):
                raise result from error
            return result
        keep = False
        try:
            if time.monotonic() > deadline:
                return self.timeout_outcome(prepared)
            if not self.success(operation, response):
                try:
                    error_body = _read_within(response, deadline)
                except _DeadlineError:
                    return self.timeout_outcome(prepared)
                except Exception:
                    error_body = b""
                return self.failure(response, error_body)
            if operation.response_encoding == "bytes":
                # The platform stream type: the caller reads the body, and the
                # timeout ends with the headers.
                keep = True
                return Outcome(response=response, data=response)
            # The timeout covers a JSON body that the SDK reads, so a failed read retries.
            try:
                content_bytes = _read_within(response, deadline)
            except _DeadlineError:
                return self.timeout_outcome(prepared)
            except Exception as error:
                result = self.connection_error(prepared, error)
                if isinstance(result, BaseException):
                    raise
                return result
            if operation.response_encoding == "json":
                return Outcome(response=response, data=self.json_data(operation, content_bytes))
            if operation.response_encoding == "none":
                return Outcome(response=response, data=self.none_data(operation, response))
            raise PierreError(f"{operation.id}: NDJSON responses are not supported yet")
        finally:
            if not keep:
                response.close()


class AsyncRuntime(BaseRuntime):
    """The transport of `AsyncPierre`. `timeout` covers each attempt: the token, the upload, the
    response headers, and the body of a JSON response."""

    def __init__(self, config: HttpConfig, http_client: httpx.AsyncClient) -> None:
        super().__init__(config)
        self.http_client = http_client

    async def request(
        self, operation: OperationSpec[Any], params: Mapping[str, Any], options: RequestOptions
    ) -> Any:
        raw = claim_raw()
        outcome = await self._send(self.prepare(operation, params, copy_options(options)))
        return self.result(operation, outcome, raw)

    def list(
        self, operation: OperationSpec[Any], params: Mapping[str, Any], options: RequestOptions
    ) -> AsyncPaginator[Any, Any]:
        item_field = operation.item_field
        if item_field is None:
            raise PierreError(f"{operation.id} is not a list")
        first = dict(params)
        first_options = copy_options(options)

        async def page(cursor: Optional[str]) -> Outcome:
            values = first if cursor is None else {**first, "cursor": cursor}
            outcome = await self._send(self.prepare(operation, values, first_options))
            fields = _page_fields(outcome.data, item_field)
            assert outcome.response is not None

            async def fetch(next_cursor: str) -> AsyncPage[Any, Any]:
                return (await page(next_cursor)).data  # type: ignore[no-any-return]

            outcome.data = AsyncPage(**fields, response=outcome.response, fetch=fetch)
            return outcome

        async def start() -> AsyncPage[Any, Any]:
            raw = claim_raw()
            return self.result(operation, await page(None), raw)  # type: ignore[no-any-return]

        return AsyncPaginator(start)

    async def read_token(self, repo: str, options: RequestOptions) -> str:
        needs = self.token_needs(repo, options)
        timeout = check_timeout(_given(options.timeout, self.config.timeout))
        # The timeout covers this token, as it covers the token of an attempt.
        try:
            return await asyncio.wait_for(self.config.credentials.async_token(needs), timeout)
        except asyncio.TimeoutError:
            raise APITimeoutError(f"no token for `{repo}` within {timeout:g} s") from None

    async def _send(self, prepared: Prepared) -> Outcome:
        for attempt in count():
            try:
                outcome = await asyncio.wait_for(self._attempt(prepared), prepared.timeout)
            except asyncio.TimeoutError:
                outcome = self.timeout_outcome(prepared)
            if outcome.error is None:
                return outcome
            if not (prepared.repeatable and outcome.transient and attempt < prepared.max_retries):
                raise outcome.error
            await _retry.async_sleep(_retry.retry_delay(outcome.retry_after, attempt))
        raise AssertionError("unreachable")

    async def _attempt(self, prepared: Prepared) -> Outcome:
        operation = prepared.operation
        token = await self.config.credentials.async_token(prepared.token)
        content: Union[bytes, AsyncIterator[bytes], None] = prepared.json
        if prepared.ndjson is not None:
            content = _async_ndjson(operation, *prepared.ndjson, prepared.failure)
        request = self.http_client.build_request(
            operation.method,
            prepared.url,
            headers=self.headers_of(prepared, token),
            content=content,
            timeout=httpx.Timeout(prepared.timeout),
        )
        try:
            response = await self.http_client.send(request, stream=True)
        except Exception as error:
            result = self.connection_error(prepared, error)
            if result is error:
                raise
            if isinstance(result, BaseException):
                raise result from error
            return result
        keep = False
        try:
            if not self.success(operation, response):
                return self.failure(response, await _async_read_quietly(response))
            if operation.response_encoding == "bytes":
                keep = True
                return Outcome(response=response, data=response)
            try:
                content_bytes = await response.aread()
            except Exception as error:
                result = self.connection_error(prepared, error)
                if isinstance(result, BaseException):
                    raise
                return result
            if operation.response_encoding == "json":
                return Outcome(response=response, data=self.json_data(operation, content_bytes))
            if operation.response_encoding == "none":
                return Outcome(response=response, data=self.none_data(operation, response))
            raise PierreError(f"{operation.id}: NDJSON responses are not supported yet")
        finally:
            if not keep:
                await response.aclose()


def _page_fields(value: object, item_field: str) -> Dict[str, Any]:
    body: Mapping[str, Any] = value if isinstance(value, dict) else {}
    items = body.get(item_field)
    next_cursor = body.get("next_cursor")
    return {
        "data": items if isinstance(items, list) else [],
        "has_more": body.get("has_more") is True,
        "next_cursor": next_cursor if isinstance(next_cursor, str) else None,
        "body": value,
    }


async def _async_read_quietly(response: httpx.Response) -> bytes:
    try:
        return await response.aread()
    except Exception:
        return b""
