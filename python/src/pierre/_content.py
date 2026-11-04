"""Upload content in each form that the SDK accepts, as byte chunks."""

import inspect
from typing import (
    IO,
    Any,
    AsyncIterable,
    AsyncIterator,
    Iterable,
    Iterator,
    List,
    Tuple,
    Union,
)

from pierre._errors import PierreError

__all__ = [
    "MAX_CHUNK_BYTES",
    "Content",
    "async_chunks",
    "async_close",
    "chunks",
    "close",
    "is_bytes",
]

# One piece of content: text, which the SDK sends as UTF-8, or bytes.
ContentPiece = Union[str, bytes, bytearray, memoryview]

# Content of a file or a diff: one piece, a binary file, or an iterable of pieces. `AsyncPierre`
# also takes an async iterable of pieces and a file whose `read` is async.
Content = Union[
    ContentPiece,
    IO[bytes],
    Iterable[ContentPiece],
    AsyncIterable[ContentPiece],
]

# The gateway limits a decoded chunk to 4 MiB.
MAX_CHUNK_BYTES = 4 * 1024 * 1024

_CONTENT_FORMS = "a string, bytes, a binary file, or an iterable of bytes"


def is_bytes(value: object) -> bool:
    return isinstance(value, (bytes, bytearray, memoryview))


def _piece(value: object) -> bytes:
    if isinstance(value, str):
        return value.encode("utf-8")
    if isinstance(value, (bytes, bytearray, memoryview)):
        return bytes(value)
    raise PierreError(
        f"Each piece of `content` must be bytes or a string, not {type(value).__name__}."
    )


def _pieces(content: object) -> Iterator[bytes]:
    if isinstance(content, str) or is_bytes(content):
        yield _piece(content)
        return
    read = getattr(content, "read", None)
    if callable(read):
        while True:
            data = read(MAX_CHUNK_BYTES)
            if inspect.isawaitable(data):
                if inspect.iscoroutine(data):
                    data.close()
                raise PierreError(
                    "`Pierre` cannot read a file whose `read` is async. Use `AsyncPierre`."
                )
            if not data:
                return
            yield _piece(data)
    if hasattr(content, "__aiter__"):
        raise PierreError("`Pierre` cannot read an async iterable. Use `AsyncPierre`.")
    if isinstance(content, Iterable):
        for item in content:
            yield _piece(item)
        return
    raise PierreError(f"`content` must be {_CONTENT_FORMS}.")


async def _async_pieces(content: object) -> AsyncIterator[bytes]:
    if isinstance(content, str) or is_bytes(content):
        yield _piece(content)
        return
    read = getattr(content, "read", None)
    if callable(read):
        while True:
            data = read(MAX_CHUNK_BYTES)
            if inspect.isawaitable(data):
                data = await data
            if not data:
                return
            yield _piece(data)
    if isinstance(content, AsyncIterable):
        async for item in content:
            yield _piece(item)
        return
    if isinstance(content, Iterable):
        for item in content:
            yield _piece(item)
        return
    raise PierreError(f"`content` must be {_CONTENT_FORMS}, or an async iterable of bytes.")


class _Chunker:
    """Splits pieces into chunks of at most `MAX_CHUNK_BYTES`, and joins small pieces up to that
    size."""

    def __init__(self) -> None:
        self._parts: List[bytes] = []
        self._size = 0

    def add(self, piece: bytes) -> Iterator[bytes]:
        """Gives each full chunk. A full chunk goes out only when more bytes follow, so that the
        last chunk can have `eof`."""
        offset = 0
        while offset < len(piece):
            if self._size == MAX_CHUNK_BYTES:
                yield self.take()
            length = min(len(piece) - offset, MAX_CHUNK_BYTES - self._size)
            self._parts.append(piece[offset : offset + length])
            self._size += length
            offset += length

    def take(self) -> bytes:
        data = self._parts[0] if len(self._parts) == 1 else b"".join(self._parts)
        self._parts = []
        self._size = 0
        return data


def chunks(content: object) -> Iterator[Tuple[bytes, bool]]:
    """The chunks of content, each with `eof`. The last chunk has `eof`, and empty content gives
    one empty chunk."""
    chunker = _Chunker()
    for piece in _pieces(content):
        for full in chunker.add(piece):
            yield full, False
    yield chunker.take(), True


async def async_chunks(content: object) -> AsyncIterator[Tuple[bytes, bool]]:
    """`chunks` for `AsyncPierre`, which also reads async iterables and async files."""
    chunker = _Chunker()
    async for piece in _async_pieces(content):
        for full in chunker.add(piece):
            yield full, False
    yield chunker.take(), True


def close(content: Any) -> None:
    """Closes a file that a content function returned. The SDK opened it, so the SDK closes it."""
    method = getattr(content, "close", None)
    if callable(method) and callable(getattr(content, "read", None)):
        method()


async def async_close(content: Any) -> None:
    method = getattr(content, "close", None)
    if callable(method) and callable(getattr(content, "read", None)):
        result = method()
        if inspect.isawaitable(result):
            await result
