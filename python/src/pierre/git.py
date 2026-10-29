"""`pierre.git`: builds a Git remote URL with a token in it."""

import re
from typing import Coroutine, Literal, Optional, Sequence, Tuple, Union, overload
from urllib.parse import quote

from pierre._client import AsyncPierre, Pierre
from pierre._credentials import TokenNeeds, check_ref_policies, check_ttl
from pierre._errors import PierreError
from pierre._types import RefPolicy

__all__ = ["RefPolicy", "remote_url"]

_SUFFIXES = {"default": "", "ephemeral": "+ephemeral", "import": "+import"}

_DEFAULT_SCOPES = ("git:read", "git:write")

# A token in a remote URL lives 15 minutes by default.
_DEFAULT_TTL_SECONDS = 15 * 60

# A host name or an IP address, with an optional port.
_LABEL = r"[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?"
_HOST = re.compile(rf"(?:{_LABEL}(?:\.{_LABEL})*|\[[0-9A-Fa-f:.]+\])(?::([0-9]{{1,5}}))?")

# The characters that `encodeURIComponent` keeps, so that a path is the same in every SDK.
_SEGMENT_SAFE = "!~*'()"

Kind = Literal["default", "ephemeral", "import"]


def _host(git_host: Optional[str]) -> str:
    """The Git host of the client: a host name with an optional port. A scheme, a path, or another
    URL part would send the token to another host."""
    if git_host is None:
        raise PierreError("`remote_url` needs the Git host. Set `org` or `git_host`.")
    match = _HOST.fullmatch(git_host)
    if match is None:
        raise PierreError(
            "`git_host` must be a host name with an optional port, for example `acme.code.storage`."
        )
    host = git_host.lower()
    # A URL drops the default port.
    return host[: -len(":443")] if match.group(1) == "443" else host


def _repository_path(name: object) -> str:
    """The URL path of a repository name: each segment percent-encoded, with `/` between them."""
    if not isinstance(name, str) or name == "":
        raise PierreError("`repo_name` must be a non-empty string.")
    segments = name.split("/")
    # A URL parser resolves `.` and `..`, which would name another repository.
    if any(segment in ("", ".", "..") for segment in segments):
        raise PierreError(f"`repo_name` cannot have an empty, `.`, or `..` segment: {name}")
    return "/".join(quote(segment, safe=_SEGMENT_SAFE) for segment in segments)


def _prepare(
    client: Union[Pierre, AsyncPierre],
    repo_name: str,
    scopes: Optional[Sequence[str]],
    ttl: int,
    ref_policies: Optional[Sequence[RefPolicy]],
    kind: str,
) -> Tuple[str, TokenNeeds]:
    """The URL without the token, as a template, and the token that it needs."""
    if not isinstance(client, (Pierre, AsyncPierre)):
        raise PierreError("Give a client from `Pierre()` or `AsyncPierre()`.")
    if client._resolved.credentials.fixed:
        raise PierreError(
            "`remote_url` needs a client with `private_key` or `get_token`. "
            "A client with a fixed `token` cannot set the claims of its token."
        )
    host = _host(client.options.git_host)
    path = _repository_path(repo_name)
    suffix = _SUFFIXES.get(kind) if isinstance(kind, str) else None
    if suffix is None:
        raise PierreError("`kind` must be `default`, `ephemeral`, or `import`.")
    token_scopes = _DEFAULT_SCOPES if scopes is None else tuple(scopes)
    if isinstance(scopes, str) or len(token_scopes) == 0:
        raise PierreError("`scopes` must name at least one scope.")
    rules = check_ref_policies(ref_policies, "ref_policies")
    if rules is None:
        rules = client._resolved.settings.rules or ()
    # An ephemeral or import remote uses the token of its repository.
    needs = TokenNeeds(scopes=token_scopes, repo=repo_name, ttl=check_ttl(ttl, "ttl"), rules=rules)
    return f"https://t:{{token}}@{host}/{path}{suffix}.git", needs


def _url(template: str, token: str) -> str:
    return template.replace("{token}", quote(token, safe=""), 1)


async def _async_remote_url(
    client: AsyncPierre,
    repo_name: str,
    scopes: Optional[Sequence[str]],
    ttl: int,
    ref_policies: Optional[Sequence[RefPolicy]],
    kind: str,
) -> str:
    template, needs = _prepare(client, repo_name, scopes, ttl, ref_policies, kind)
    return _url(template, await client._resolved.credentials.async_token(needs))


@overload
def remote_url(
    client: Pierre,
    *,
    repo_name: str,
    scopes: Optional[Sequence[str]] = None,
    ttl: int = _DEFAULT_TTL_SECONDS,
    ref_policies: Optional[Sequence[RefPolicy]] = None,
    kind: Kind = "default",
) -> str: ...


@overload
def remote_url(
    client: AsyncPierre,
    *,
    repo_name: str,
    scopes: Optional[Sequence[str]] = None,
    ttl: int = _DEFAULT_TTL_SECONDS,
    ref_policies: Optional[Sequence[RefPolicy]] = None,
    kind: Kind = "default",
) -> Coroutine[None, None, str]: ...


def remote_url(
    client: Union[Pierre, AsyncPierre],
    *,
    repo_name: str,
    scopes: Optional[Sequence[str]] = None,
    ttl: int = _DEFAULT_TTL_SECONDS,
    ref_policies: Optional[Sequence[RefPolicy]] = None,
    kind: Kind = "default",
) -> Union[str, Coroutine[None, None, str]]:
    """Builds `https://t:<token>@{git_host}/{repo_name}.git` for `git clone`, `git fetch`, and
    `git push`. The token is a bearer credential that Git copies into `.git/config`, so keep the
    lifetime short. Longer work uses the credential helper (`pierre auth setup-git`).

    The client signs the token with its private key, or gets it from `get_token`. A client with a
    fixed `token` cannot set the claims of its token, so it raises `PierreError`. With
    `AsyncPierre`, await the result.

    Args:
        client: A `Pierre` or `AsyncPierre` client.
        repo_name: The repository name, for example `acme/web`.
        scopes: The scopes of the token. Default: `git:read` and `git:write`.
        ttl: The lifetime of the token in seconds, from 1 to 3600. Default: 900 (15 minutes).
        ref_policies: The rules of the `refs` claim. Default: the client's `ref_policies`, so a
            confined client stays confined through Git. An empty list adds no claim.
        kind: The form of the remote: `default`, `ephemeral` (`+ephemeral`), or `import`
            (`+import`).

    Docs: search for `remoteUrl` in the docs MCP server, https://code.storage/docs/mcp.
    """
    if isinstance(client, AsyncPierre):
        return _async_remote_url(client, repo_name, scopes, ttl, ref_policies, kind)
    template, needs = _prepare(client, repo_name, scopes, ttl, ref_policies, kind)
    return _url(template, client._resolved.credentials.token(needs))
