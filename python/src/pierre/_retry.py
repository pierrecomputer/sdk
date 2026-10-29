"""The retry rules: which results are transient, and how long to wait."""

import asyncio
import random
import re
import time
from email.utils import parsedate_to_datetime
from typing import Optional

# The 409 codes of a condition that ends by itself.
_RETRYABLE_CONFLICT_CODES = frozenset({"repository_thawing", "sync_in_progress"})

# The first backoff delay, in seconds.
_INITIAL_DELAY = 0.5
# The longest backoff delay.
_MAX_BACKOFF = 8.0
# The longest `Retry-After` that the SDK waits. A longer value falls back to the backoff.
_MAX_RETRY_AFTER = 60.0

# The HTTP date form that servers send (IMF-fixdate, RFC 9110), for example
# `Sun, 06 Nov 1994 08:49:37 GMT`.
_HTTP_DATE = re.compile(
    r"[A-Z][a-z]{2}, [0-9]{2} [A-Z][a-z]{2} [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2} GMT", re.ASCII
)
_SECONDS = re.compile(r"[0-9]+(\.[0-9]+)?")

# The wait between two attempts. Tests replace them to record the delays.
sleep = time.sleep
async_sleep = asyncio.sleep


def transient_status(status: int, code: Optional[str]) -> bool:
    """Whether an error status can succeed on a repeat."""
    return (
        status in (408, 429)
        or status >= 500
        or (status == 409 and code is not None and code in _RETRYABLE_CONFLICT_CODES)
    )


def retry_delay(retry_after: Optional[str], attempt: int, now: Optional[float] = None) -> float:
    """The wait in seconds before retry number `attempt + 1`: the `Retry-After` value when it is
    60 seconds or less, or else an exponential backoff from 0.5 seconds, up to 8 seconds, less up
    to 25% jitter."""
    after = _retry_after_seconds(retry_after, time.time() if now is None else now)
    if after is not None and after <= _MAX_RETRY_AFTER:
        return after
    backoff: float = min(_INITIAL_DELAY * 2**attempt, _MAX_BACKOFF)
    return backoff * (1 - random.random() * 0.25)


def _retry_after_seconds(value: Optional[str], now: float) -> Optional[float]:
    """A `Retry-After` value in seconds or as an HTTP date, in seconds from `now`."""
    if value is None:
        return None
    text = value.strip()
    if _SECONDS.fullmatch(text):
        return float(text)
    if not _HTTP_DATE.fullmatch(text):
        return None
    try:
        date = parsedate_to_datetime(text)
    except (TypeError, ValueError):
        return None
    return max(0.0, date.timestamp() - now)
