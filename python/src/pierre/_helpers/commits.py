"""The public form of the streaming commit writes. The wire form sends a
metadata line, then the content of each file as base64 chunk lines. These helpers take the
content itself and write the chunks."""

import base64
import inspect
import uuid
from typing import (
    Any,
    AsyncIterable,
    AsyncIterator,
    Awaitable,
    Callable,
    Dict,
    Iterable,
    Iterator,
    List,
    Literal,
    Mapping,
    Tuple,
    Union,
)

from pierre._compat import NotRequired, TypedDict
from pierre._content import (
    Content,
    async_chunks,
    async_close,
    chunks,
    close,
)
from pierre._errors import PierreError
from pierre._operation import OperationSpec
from pierre._runtime import AsyncRuntime, SyncRuntime
from pierre._types import RequestOptions

__all__ = [
    "CommitFile",
    "Content",
    "FileContent",
    "async_create_commit",
    "async_create_commit_from_diff",
    "create_commit",
    "create_commit_from_diff",
]

# File content, or a function that returns it when the SDK sends the file. In `AsyncPierre`, the
# function can be async.
FileContent = Union[Content, Callable[[], Union[Content, Awaitable[Content]]]]


class CommitFile(TypedDict):
    """One file of a commit."""

    # The repository path of the file.
    path: str
    # `upsert` by default.
    operation: NotRequired[Literal["upsert", "delete"]]
    # The Git file mode. `100644` by default for an upsert.
    mode: NotRequired[str]
    # The file content. An upsert needs it, and a delete must not have it.
    #
    # The SDK reads all of `files` before it sends any content, because the first NDJSON line
    # names every file. To open only one file at a time, give a function, for example
    # `lambda: open(path, "rb")`. The SDK calls the function when it sends that file, and closes
    # the file that the function returns. The SDK copies a `bytearray` or a `memoryview` when it
    # reads the entry, so a caller can reuse a buffer.
    content: NotRequired[FileContent]


# One checked file: the file fields, its content, and its content ID.
_Entry = Tuple[Dict[str, Any], object, str]


def _entry(file: object) -> _Entry:
    if not isinstance(file, Mapping) or not isinstance(file.get("path"), str):
        raise PierreError("Each file needs `path`.")
    path = file["path"]
    operation = file.get("operation", "upsert")
    content = file.get("content")
    if operation == "upsert" and content is None:
        raise PierreError(f"The file {path} needs `content`.")
    if operation == "delete" and content is not None:
        raise PierreError(f"The delete of {path} must not have `content`.")
    if isinstance(content, (bytearray, memoryview)):
        content = bytes(content)
    wire: Dict[str, Any] = {"path": path, "content_id": str(uuid.uuid4()), "operation": operation}
    if operation == "upsert":
        wire["mode"] = file.get("mode", "100644")
    return wire, content, wire["content_id"]


def _is_function(content: object) -> bool:
    return (
        callable(content)
        and not callable(getattr(content, "read", None))
        and not isinstance(content, (Iterable, AsyncIterable))
    )


def _blob_chunk(content_id: str, data: bytes, eof: bool) -> Dict[str, Any]:
    return {
        "blob_chunk": {
            "content_id": content_id,
            "data": base64.b64encode(data).decode("ascii"),
            "eof": eof,
        }
    }


def _sync_files(files: object) -> Iterable[object]:
    if hasattr(files, "__aiter__") or not isinstance(files, Iterable):
        raise PierreError(
            "`Pierre` takes a list or an iterable of files. Use `AsyncPierre` for an async iterable."
        )
    return files


def create_commit(
    runtime: SyncRuntime,
    operation: OperationSpec[Any],
    params: Mapping[str, Any],
    options: RequestOptions,
) -> Any:
    """`pierre.repos.commits.create`. The SDK reads all of `files` before the request."""
    metadata = {name: value for name, value in params.items() if name != "files"}
    entries = [_entry(file) for file in _sync_files(params["files"])]

    def blob_chunks() -> Iterator[Dict[str, Any]]:
        for _, content, content_id in entries:
            if content is None:
                continue
            source = content() if _is_function(content) else content  # type: ignore[operator]
            if inspect.isawaitable(source):
                if inspect.iscoroutine(source):
                    source.close()
                raise PierreError("`Pierre` takes a content function that is not async.")
            try:
                for data, eof in chunks(source):
                    yield _blob_chunk(content_id, data, eof)
            finally:
                if source is not content:
                    close(source)

    wire = {**metadata, "files": [entry[0] for entry in entries], "chunks": blob_chunks()}
    return runtime.request(operation, wire, options)


async def async_create_commit(
    runtime: AsyncRuntime,
    operation: OperationSpec[Any],
    params: Mapping[str, Any],
    options: RequestOptions,
) -> Any:
    """`pierre.repos.commits.create` of `AsyncPierre`, which also takes async files and content."""
    metadata = {name: value for name, value in params.items() if name != "files"}
    files = params["files"]
    entries: List[_Entry] = []
    if isinstance(files, AsyncIterable):
        async for file in files:
            entries.append(_entry(file))
    elif isinstance(files, Iterable):
        entries = [_entry(file) for file in files]
    else:
        raise PierreError("`files` must be a list, an iterable, or an async iterable of files.")

    async def blob_chunks() -> AsyncIterator[Dict[str, Any]]:
        for _, content, content_id in entries:
            if content is None:
                continue
            source = content() if _is_function(content) else content  # type: ignore[operator]
            if inspect.isawaitable(source):
                source = await source
            try:
                async for data, eof in async_chunks(source):
                    yield _blob_chunk(content_id, data, eof)
            finally:
                if source is not content:
                    await async_close(source)

    wire = {**metadata, "files": [entry[0] for entry in entries], "chunks": blob_chunks()}
    return await runtime.request(operation, wire, options)


def _diff_chunk(data: bytes, eof: bool) -> Dict[str, Any]:
    return {"diff_chunk": {"data": base64.b64encode(data).decode("ascii"), "eof": eof}}


def create_commit_from_diff(
    runtime: SyncRuntime,
    operation: OperationSpec[Any],
    params: Mapping[str, Any],
    options: RequestOptions,
) -> Any:
    """`pierre.repos.commits.create_from_diff`: the diff as `diff_chunk` lines."""
    metadata = {name: value for name, value in params.items() if name != "diff"}
    diff = params["diff"]

    def diff_chunks() -> Iterator[Dict[str, Any]]:
        for data, eof in chunks(diff):
            yield _diff_chunk(data, eof)

    return runtime.request(operation, {**metadata, "chunks": diff_chunks()}, options)


async def async_create_commit_from_diff(
    runtime: AsyncRuntime,
    operation: OperationSpec[Any],
    params: Mapping[str, Any],
    options: RequestOptions,
) -> Any:
    """`pierre.repos.commits.create_from_diff` of `AsyncPierre`."""
    metadata = {name: value for name, value in params.items() if name != "diff"}
    diff = params["diff"]

    async def diff_chunks() -> AsyncIterator[Dict[str, Any]]:
        async for data, eof in async_chunks(diff):
            yield _diff_chunk(data, eof)

    return await runtime.request(operation, {**metadata, "chunks": diff_chunks()}, options)
