"""The clients: options, environment variables, credentials, and the transport. `Pierre` serves
blocking code, and `AsyncPierre` serves `asyncio` code."""

import os
import re
from dataclasses import dataclass, replace
from types import TracebackType
from typing import Callable, Dict, Mapping, Optional, Sequence, Tuple, Type, TypeVar, Union
from urllib.parse import urlsplit

import httpx

from pierre._compat import Self
from pierre._credentials import (
    Credentials,
    GetToken,
    Rules,
    Signer,
    check_ref_policies,
    policies_of,
    token_issuer,
)
from pierre._errors import PierreError
from pierre._generated.client import (
    AsyncPierreNamespaces,
    AsyncPierreWithRawResponse,
    PierreNamespaces,
    PierreWithRawResponse,
)
from pierre._runtime import (
    AsyncRuntime,
    HttpConfig,
    SyncRuntime,
    check_max_retries,
    check_timeout,
)
from pierre._types import RefPolicy, TokenRequest
from pierre._version import __version__

_DEFAULT_TIMEOUT = 60.0
_DEFAULT_MAX_RETRIES = 2

# A DNS label: the form of an organization name in its default hosts.
_HOST_LABEL = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", re.IGNORECASE | re.ASCII)

_VARIABLES = (
    "PIERRE_ORG",
    "PIERRE_PRIVATE_KEY",
    "PIERRE_PRIVATE_KEY_FILE",
    "PIERRE_TOKEN",
    "PIERRE_API_BASE_URL",
    "PIERRE_GIT_HOST",
)


@dataclass(frozen=True)
class ClientOptions:
    """The settings of a client, on `pierre.options`. It holds no credential."""

    # The organization name, when the client knows it.
    org: Optional[str]
    base_url: str
    # The Git host, when the client knows the organization or `git_host` is set.
    git_host: Optional[str]
    # The timeout of each attempt, in seconds.
    timeout: float
    max_retries: int
    # The ref policies of each request token, when the client has them.
    ref_policies: Optional[Tuple[RefPolicy, ...]]


@dataclass(frozen=True)
class _Credential:
    kind: str
    value: object


@dataclass(frozen=True)
class _Settings:
    """The settings after the options and the environment, before the defaults."""

    org: Optional[str]
    base_url: Optional[str]
    git_host: Optional[str]
    timeout: float
    max_retries: int
    default_headers: Mapping[str, str]
    http_client: Optional[object]
    rules: Optional[Rules]
    credential: _Credential


def _environment() -> Dict[str, str]:
    """The Pierre variables of the process. An empty value counts as not set."""
    return {name: os.environ[name] for name in _VARIABLES if os.environ.get(name)}


def _credential_of(
    private_key: Optional[str], token: Optional[str], get_token: Optional[GetToken]
) -> Optional[_Credential]:
    """The credential in the options, or `None`. More than one is an error."""
    given = [value for value in (private_key, token, get_token) if value is not None]
    if len(given) > 1:
        raise PierreError("Give only one of `private_key`, `token`, and `get_token`.")
    if private_key is not None:
        key = private_key
        return _Credential("private_key", Signer(lambda: key))
    if token is not None:
        if not isinstance(token, str) or token == "":
            raise PierreError("`token` must not be empty.")
        return _Credential("token", token)
    if get_token is not None:
        if not callable(get_token):
            raise PierreError("`get_token` must be a function.")
        return _Credential("get_token", get_token)
    return None


def _read_key_file(path: str) -> str:
    try:
        with open(path, encoding="utf-8") as file:
            return file.read()
    except OSError as error:
        raise PierreError(f"Cannot read PIERRE_PRIVATE_KEY_FILE ({path}).") from error


def _environment_credential(env: Mapping[str, str]) -> _Credential:
    token = env.get("PIERRE_TOKEN")
    private_key = env.get("PIERRE_PRIVATE_KEY")
    key_file = env.get("PIERRE_PRIVATE_KEY_FILE")
    if token is not None:
        return _Credential("token", token)
    if private_key is not None:
        return _Credential("private_key", Signer(lambda: private_key))
    if key_file is not None:
        return _Credential("private_key", Signer(lambda: _read_key_file(key_file)))
    raise PierreError(
        "Give `private_key`, `token`, or `get_token`, or set PIERRE_PRIVATE_KEY, "
        "PIERRE_PRIVATE_KEY_FILE, or PIERRE_TOKEN."
    )


@dataclass(frozen=True)
class _Given:
    """The keyword arguments of a constructor or of `with_options`. `None` is not given."""

    org: Optional[str] = None
    private_key: Optional[str] = None
    token: Optional[str] = None
    get_token: Optional[GetToken] = None
    base_url: Optional[str] = None
    git_host: Optional[str] = None
    timeout: Optional[float] = None
    max_retries: Optional[int] = None
    default_headers: Optional[Mapping[str, str]] = None
    http_client: Optional[object] = None
    ref_policies: Optional[Sequence[RefPolicy]] = None


def _from_environment(given: _Given) -> _Settings:
    env = _environment()
    return _Settings(
        org=given.org if given.org is not None else env.get("PIERRE_ORG"),
        base_url=given.base_url if given.base_url is not None else env.get("PIERRE_API_BASE_URL"),
        git_host=given.git_host if given.git_host is not None else env.get("PIERRE_GIT_HOST"),
        timeout=check_timeout(given.timeout if given.timeout is not None else _DEFAULT_TIMEOUT),
        max_retries=check_max_retries(
            given.max_retries if given.max_retries is not None else _DEFAULT_MAX_RETRIES
        ),
        default_headers=dict(given.default_headers or {}),
        http_client=given.http_client,
        rules=check_ref_policies(given.ref_policies, "ref_policies"),
        # A credential in the options replaces every credential in the environment.
        credential=_credential_of(given.private_key, given.token, given.get_token)
        or _environment_credential(env),
    )


def _with_changes(parent: _Settings, changes: _Given) -> _Settings:
    rules = check_ref_policies(changes.ref_policies, "ref_policies")
    return _Settings(
        org=changes.org if changes.org is not None else parent.org,
        base_url=changes.base_url if changes.base_url is not None else parent.base_url,
        git_host=changes.git_host if changes.git_host is not None else parent.git_host,
        timeout=check_timeout(changes.timeout if changes.timeout is not None else parent.timeout),
        max_retries=check_max_retries(
            changes.max_retries if changes.max_retries is not None else parent.max_retries
        ),
        default_headers=dict(changes.default_headers)
        if changes.default_headers is not None
        else parent.default_headers,
        http_client=changes.http_client if changes.http_client is not None else parent.http_client,
        rules=rules if rules is not None else parent.rules,
        credential=_credential_of(changes.private_key, changes.token, changes.get_token)
        or parent.credential,
    )


def _check_base_url(base_url: str) -> str:
    """Checks that the base URL is an absolute `https` or `http` URL."""
    parts = urlsplit(base_url) if isinstance(base_url, str) else None
    if parts is None or parts.scheme not in ("https", "http") or parts.netloc == "":
        raise PierreError(
            "`base_url` must be an absolute https URL, for example https://api.acme.code.storage."
        )
    return base_url


@dataclass(frozen=True)
class _Resolved:
    """The settings with the defaults, which a client keeps."""

    settings: _Settings
    options: ClientOptions
    credentials: Credentials
    config: HttpConfig


def _resolve(settings: _Settings) -> _Resolved:
    credential = settings.credential
    org = settings.org
    if org is None and credential.kind == "token":
        org = token_issuer(str(credential.value))
    # The SDK does not verify a token, so its `iss` can name any host. A default host uses only a
    # host label, and so stays under `code.storage`.
    label = org if org is not None and _HOST_LABEL.fullmatch(org) else None
    if settings.base_url is None and label is None:
        raise PierreError(
            "Set `org` or PIERRE_ORG, or give `base_url`."
            if org is None
            else "The organization name is not a host label, so give `base_url`."
        )
    rules = settings.rules
    # The SDK cannot change the claims of a fixed token, so the limit would not apply.
    if credential.kind == "token" and rules:
        raise PierreError(
            "A client with a fixed `token` cannot have `ref_policies`. "
            "Give `private_key` or `get_token`."
        )
    base_url = _check_base_url(
        f"https://api.{label}.code.storage" if settings.base_url is None else settings.base_url
    )
    git_host = (
        (None if label is None else f"{label}.code.storage")
        if settings.git_host is None
        else settings.git_host
    )
    if credential.kind == "private_key":
        # The gateway finds the public keys of the organization by the `iss` claim.
        if org is None:
            raise PierreError("A private key needs `org` or PIERRE_ORG.")
        credentials = Credentials("private_key", org=org, signer=credential.value)  # type: ignore[arg-type]
    elif credential.kind == "token":
        credentials = Credentials("token", token=str(credential.value))
    else:
        credentials = Credentials("get_token", get_token=credential.value)  # type: ignore[arg-type]
    return _Resolved(
        # A copy keeps the organization of `options`, also when it came from the token.
        settings=replace(settings, org=org),
        options=ClientOptions(
            org=org,
            base_url=base_url,
            git_host=git_host,
            timeout=settings.timeout,
            max_retries=settings.max_retries,
            ref_policies=None if rules is None else tuple(policies_of(rules)),
        ),
        credentials=credentials,
        config=HttpConfig(
            base_url=base_url,
            credentials=credentials,
            client=f"pierre-sdk-python/{__version__}",
            default_headers=settings.default_headers,
            timeout=settings.timeout,
            max_retries=settings.max_retries,
            rules=rules,
        ),
    )


Client = TypeVar("Client", bound="_ClientCore")


class _ClientCore:
    """The settings of a client. Every top-level name other than `options`, `with_options`, and
    `with_raw_response` is free for an API namespace."""

    _resolved: _Resolved

    @property
    def options(self) -> ClientOptions:
        """The settings of the client. It holds no credential."""
        return self._resolved.options

    def _copy(self: Client, changes: _Given) -> Client:
        """A copy of the client with changed options. It does not read the environment again."""
        copy = type(self).__new__(type(self))
        copy._setup(_with_changes(self._resolved.settings, changes))
        return copy

    def _setup(self, settings: _Settings) -> None:
        raise NotImplementedError


class Pierre(_ClientCore, PierreNamespaces):
    """The Pierre client for blocking code. `Pierre()` reads `PIERRE_ORG` and
    `PIERRE_PRIVATE_KEY`, or the other variables in the docs. Each namespace path is a catalog ID
    in snake_case, for example `pierre.repos.branches.create()`.

    Docs: the MCP server at https://code.storage/docs/mcp, or the Markdown pages from
    https://code.storage/docs/llms.txt.
    """

    def __init__(
        self,
        *,
        org: Optional[str] = None,
        private_key: Optional[str] = None,
        token: Optional[str] = None,
        get_token: Optional[Callable[[TokenRequest], str]] = None,
        base_url: Optional[str] = None,
        git_host: Optional[str] = None,
        timeout: Optional[float] = None,
        max_retries: Optional[int] = None,
        default_headers: Optional[Mapping[str, str]] = None,
        http_client: Optional[httpx.Client] = None,
        ref_policies: Optional[Sequence[RefPolicy]] = None,
    ) -> None:
        """Makes a client. An option that is `None` takes its value from the environment, or its
        default.

        Args:
            org: The organization name. Default: `PIERRE_ORG`, or the `iss` claim of `token`.
            private_key: A PKCS #8 PEM private key. Default: `PIERRE_PRIVATE_KEY`, or the file at
                `PIERRE_PRIVATE_KEY_FILE`.
            token: A fixed token. Default: `PIERRE_TOKEN`.
            get_token: A function that returns a token for each request, for a client with no
                private key. It receives a `TokenRequest`.
            base_url: The API base URL. Default: `PIERRE_API_BASE_URL`, or
                `https://api.{org}.code.storage`.
            git_host: The Git host. Default: `PIERRE_GIT_HOST`, or `{org}.code.storage`.
            timeout: The timeout of each attempt, in seconds. Default: 60.
            max_retries: The number of retries of a transient failure. Default: 2.
            default_headers: Headers for every request.
            http_client: The `httpx.Client` that sends each request.
            ref_policies: The `refs` claim of each request token, which limits the refs that a
                write can change. A request option replaces it. A client with a fixed `token`
                cannot have it.
        """
        self._setup(
            _from_environment(
                _Given(
                    org=org,
                    private_key=private_key,
                    token=token,
                    get_token=get_token,
                    base_url=base_url,
                    git_host=git_host,
                    timeout=timeout,
                    max_retries=max_retries,
                    default_headers=default_headers,
                    http_client=http_client,
                    ref_policies=ref_policies,
                )
            )
        )

    def _setup(self, settings: _Settings) -> None:
        # The httpx client that this client made, which `__exit__` closes. A copy shares it, and
        # does not close it.
        self._made_client: Optional[httpx.Client] = None
        if settings.http_client is None:
            self._made_client = httpx.Client()
            settings = replace(settings, http_client=self._made_client)
        elif not isinstance(settings.http_client, httpx.Client):
            raise PierreError("`http_client` of `Pierre` must be an `httpx.Client`.")
        self._resolved = _resolve(settings)
        self._runtime = SyncRuntime(self._resolved.config, settings.http_client)  # type: ignore[arg-type]
        self._attach_namespaces(self._runtime)

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc: Optional[BaseException],
        traceback: Optional[TracebackType],
    ) -> None:
        """Closes the httpx client that `Pierre()` made. An `http_client` of the caller stays
        open."""
        if self._made_client is not None:
            self._made_client.close()

    def with_options(
        self,
        *,
        org: Optional[str] = None,
        private_key: Optional[str] = None,
        token: Optional[str] = None,
        get_token: Optional[Callable[[TokenRequest], str]] = None,
        base_url: Optional[str] = None,
        git_host: Optional[str] = None,
        timeout: Optional[float] = None,
        max_retries: Optional[int] = None,
        default_headers: Optional[Mapping[str, str]] = None,
        http_client: Optional[httpx.Client] = None,
        ref_policies: Optional[Sequence[RefPolicy]] = None,
    ) -> "Pierre":
        """Returns a copy of the client with changed options. The copy keeps every option that the
        call does not set, including `org`, and does not read the environment again. It keeps the
        credential, unless the call gives one. When `org` changes, the default hosts follow it."""
        return self._copy(
            _Given(
                org=org,
                private_key=private_key,
                token=token,
                get_token=get_token,
                base_url=base_url,
                git_host=git_host,
                timeout=timeout,
                max_retries=max_retries,
                default_headers=default_headers,
                http_client=http_client,
                ref_policies=ref_policies,
            )
        )

    @property
    def with_raw_response(self) -> PierreWithRawResponse:
        """The namespaces of the client, whose methods return a `RawResponse`: the result, the
        `httpx.Response`, the declared response headers, and the request ID."""
        return PierreWithRawResponse(self)


class AsyncPierre(_ClientCore, AsyncPierreNamespaces):
    """The Pierre client for `asyncio` code. It has the namespaces and the options of `Pierre`,
    and each method is async.

    Docs: the MCP server at https://code.storage/docs/mcp, or the Markdown pages from
    https://code.storage/docs/llms.txt.
    """

    def __init__(
        self,
        *,
        org: Optional[str] = None,
        private_key: Optional[str] = None,
        token: Optional[str] = None,
        get_token: Optional[GetToken] = None,
        base_url: Optional[str] = None,
        git_host: Optional[str] = None,
        timeout: Optional[float] = None,
        max_retries: Optional[int] = None,
        default_headers: Optional[Mapping[str, str]] = None,
        http_client: Optional[httpx.AsyncClient] = None,
        ref_policies: Optional[Sequence[RefPolicy]] = None,
    ) -> None:
        """Makes a client. The arguments are the arguments of `Pierre()`, except two:
        `get_token` can be async, and `http_client` is an `httpx.AsyncClient`."""
        self._setup(
            _from_environment(
                _Given(
                    org=org,
                    private_key=private_key,
                    token=token,
                    get_token=get_token,
                    base_url=base_url,
                    git_host=git_host,
                    timeout=timeout,
                    max_retries=max_retries,
                    default_headers=default_headers,
                    http_client=http_client,
                    ref_policies=ref_policies,
                )
            )
        )

    def _setup(self, settings: _Settings) -> None:
        # The httpx client that this client made, which `__aexit__` closes. A copy shares it, and
        # does not close it.
        self._made_client: Optional[httpx.AsyncClient] = None
        if settings.http_client is None:
            self._made_client = httpx.AsyncClient()
            settings = replace(settings, http_client=self._made_client)
        elif not isinstance(settings.http_client, httpx.AsyncClient):
            raise PierreError("`http_client` of `AsyncPierre` must be an `httpx.AsyncClient`.")
        self._resolved = _resolve(settings)
        self._runtime = AsyncRuntime(self._resolved.config, settings.http_client)  # type: ignore[arg-type]
        self._attach_namespaces(self._runtime)

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc: Optional[BaseException],
        traceback: Optional[TracebackType],
    ) -> None:
        """Closes the httpx client that `AsyncPierre()` made. An `http_client` of the caller
        stays open."""
        if self._made_client is not None:
            await self._made_client.aclose()

    def with_options(
        self,
        *,
        org: Optional[str] = None,
        private_key: Optional[str] = None,
        token: Optional[str] = None,
        get_token: Optional[GetToken] = None,
        base_url: Optional[str] = None,
        git_host: Optional[str] = None,
        timeout: Optional[float] = None,
        max_retries: Optional[int] = None,
        default_headers: Optional[Mapping[str, str]] = None,
        http_client: Optional[httpx.AsyncClient] = None,
        ref_policies: Optional[Sequence[RefPolicy]] = None,
    ) -> "AsyncPierre":
        """Returns a copy of the client with changed options, as `Pierre.with_options` does."""
        return self._copy(
            _Given(
                org=org,
                private_key=private_key,
                token=token,
                get_token=get_token,
                base_url=base_url,
                git_host=git_host,
                timeout=timeout,
                max_retries=max_retries,
                default_headers=default_headers,
                http_client=http_client,
                ref_policies=ref_policies,
            )
        )

    @property
    def with_raw_response(self) -> AsyncPierreWithRawResponse:
        """The namespaces of the client, whose methods return a `RawResponse`."""
        return AsyncPierreWithRawResponse(self)


AnyPierre = Union[Pierre, AsyncPierre]
