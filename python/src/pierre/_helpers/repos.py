"""The repository create. A copy reads its source with a token, and the SDK adds
that token when the caller gives none."""

from typing import Any, Mapping, Optional

from pierre._operation import OperationSpec
from pierre._runtime import AsyncRuntime, SyncRuntime
from pierre._types import RequestOptions


def _source(params: Mapping[str, Any]) -> Optional[Mapping[str, Any]]:
    """The source of a copy that needs a token, or `None`."""
    source = params.get("base_repo")
    if not isinstance(source, Mapping):
        return None
    auth = source.get("auth")
    # The deprecated sync form, with `provider`, reads no Code Storage repository.
    if source.get("provider") is not None or (isinstance(auth, Mapping) and "token" in auth):
        return None
    # The server rejects a copy with no source name.
    return source if isinstance(source.get("name"), str) else None


def _with_token(params: Mapping[str, Any], source: Mapping[str, Any], token: str) -> Any:
    auth = source.get("auth")
    return {
        **params,
        "base_repo": {
            **source,
            "auth": {**(auth if isinstance(auth, Mapping) else {}), "token": token},
        },
    }


def create_repo(
    runtime: SyncRuntime,
    operation: OperationSpec[Any],
    params: Mapping[str, Any],
    options: RequestOptions,
) -> Any:
    """`pierre.repos.create`, with a `git:read` token for the source repository of a copy."""
    source = _source(params)
    if source is not None:
        params = _with_token(params, source, runtime.read_token(source["name"], options))
    return runtime.request(operation, params, options)


async def async_create_repo(
    runtime: AsyncRuntime,
    operation: OperationSpec[Any],
    params: Mapping[str, Any],
    options: RequestOptions,
) -> Any:
    """`pierre.repos.create` of `AsyncPierre`."""
    source = _source(params)
    if source is not None:
        params = _with_token(params, source, await runtime.read_token(source["name"], options))
    return await runtime.request(operation, params, options)
