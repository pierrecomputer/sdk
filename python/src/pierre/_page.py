"""List pages."""

import asyncio
from typing import (
    Any,
    AsyncIterator,
    Awaitable,
    Callable,
    Generator,
    Generic,
    Iterator,
    List,
    Optional,
    TypeVar,
)

import httpx

from pierre._errors import PierreError

Item = TypeVar("Item")
Body = TypeVar("Body")


def _next_cursor(has_more: bool, next_cursor: Optional[str]) -> Optional[str]:
    return next_cursor if has_more and next_cursor else None


_NO_NEXT_PAGE = "No next page. Call `has_next_page()` before `get_next_page()`."


class Page(Generic[Item, Body]):
    """One page of a list in `Pierre`. `body` is the full response body, with the fields beside
    the items. Iteration gives the items of this page and of each next page. To serialize a page,
    serialize `body`, the response that the API sent: `json.dumps(page.body)`."""

    def __init__(
        self,
        *,
        data: List[Item],
        has_more: bool,
        next_cursor: Optional[str],
        body: Body,
        response: httpx.Response,
        fetch: Callable[[str], "Page[Item, Body]"],
    ) -> None:
        self.data = data
        self.has_more = has_more
        self.next_cursor = next_cursor
        self.body = body
        # The `httpx.Response` of this page. The SDK read its body.
        self.response = response
        self._fetch = fetch

    def has_next_page(self) -> bool:
        """Whether a next page exists: `has_more` is true, and `next_cursor` is not empty."""
        return _next_cursor(self.has_more, self.next_cursor) is not None

    def get_next_page(self) -> "Page[Item, Body]":
        """Gets the next page, with the arguments of the first call. Call `has_next_page()` first:
        with no next page, it raises `PierreError`."""
        cursor = _next_cursor(self.has_more, self.next_cursor)
        if cursor is None:
            raise PierreError(_NO_NEXT_PAGE)
        return self._fetch(cursor)

    def iter_pages(self) -> Iterator["Page[Item, Body]"]:
        """This page, then each next page."""
        page = self
        while True:
            yield page
            if not page.has_next_page():
                return
            page = page.get_next_page()

    def __iter__(self) -> Iterator[Item]:
        for page in self.iter_pages():
            yield from page.data


class AsyncPage(Generic[Item, Body]):
    """One page of a list in `AsyncPierre`. `async for` gives the items of this page and of each
    next page. To serialize a page, serialize `body`, the response that the API sent:
    `json.dumps(page.body)`."""

    def __init__(
        self,
        *,
        data: List[Item],
        has_more: bool,
        next_cursor: Optional[str],
        body: Body,
        response: httpx.Response,
        fetch: Callable[[str], Awaitable["AsyncPage[Item, Body]"]],
    ) -> None:
        self.data = data
        self.has_more = has_more
        self.next_cursor = next_cursor
        self.body = body
        # The `httpx.Response` of this page. The SDK read its body.
        self.response = response
        self._fetch = fetch

    def has_next_page(self) -> bool:
        """Whether a next page exists: `has_more` is true, and `next_cursor` is not empty."""
        return _next_cursor(self.has_more, self.next_cursor) is not None

    async def get_next_page(self) -> "AsyncPage[Item, Body]":
        """Gets the next page, with the arguments of the first call. Call `has_next_page()` first:
        with no next page, it raises `PierreError`."""
        cursor = _next_cursor(self.has_more, self.next_cursor)
        if cursor is None:
            raise PierreError(_NO_NEXT_PAGE)
        return await self._fetch(cursor)

    async def iter_pages(self) -> AsyncIterator["AsyncPage[Item, Body]"]:
        """This page, then each next page."""
        page = self
        while True:
            yield page
            if not page.has_next_page():
                return
            page = await page.get_next_page()

    async def __aiter__(self) -> AsyncIterator[Item]:
        async for page in self.iter_pages():
            for item in page.data:
                yield item


class AsyncPaginator(Generic[Item, Body]):
    """The result of a list method of `AsyncPierre`. `await` gives the first page, and
    `async for` gives the items of every page. The request starts at the first use, and every use
    reads that one request."""

    def __init__(self, start: Callable[[], Awaitable[AsyncPage[Item, Body]]]) -> None:
        self._start = start
        self._first: "Optional[asyncio.Future[AsyncPage[Item, Body]]]" = None

    async def _page(self) -> AsyncPage[Item, Body]:
        # One task holds the first request, so that uses at the same time share its result or
        # its error. A cancel stops only the use that the caller cancels, so a later use still
        # reads the request.
        if self._first is None:
            self._first = asyncio.ensure_future(self._start())
        return await asyncio.shield(self._first)

    def __await__(self) -> Generator[Any, None, AsyncPage[Item, Body]]:
        return self._page().__await__()

    async def __aiter__(self) -> AsyncIterator[Item]:
        page = await self._page()
        async for item in page:
            yield item
