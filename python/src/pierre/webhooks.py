"""`pierre.webhooks`: verifies a webhook delivery and returns the typed event."""

import hashlib
import hmac
import json
import re
import time
from typing import Any, Dict, List, Literal, Mapping, Optional, Sequence, Tuple, Union, cast

from pierre._compat import TypedDict
from pierre._errors import PierreError, WebhookVerificationError, WebhookVerificationFailure
from pierre._generated.webhooks import WEBHOOK_EVENT_TYPES, KnownWebhookEvent, WebhookEventType

__all__ = [
    "WEBHOOK_EVENT_TYPES",
    "KnownWebhookEvent",
    "UnknownWebhookEvent",
    "WebhookEventType",
    "WebhookVerificationError",
    "WebhookVerificationFailure",
    "verify_webhook",
]

_DEFAULT_TOLERANCE_SECONDS = 300
_KNOWN_TYPES = frozenset(WEBHOOK_EVENT_TYPES)
# ASCII digits only: `\d` also matches other digits, which `int()` reads.
_HEX_SIGNATURE = re.compile(r"[0-9a-fA-F]{64}")
_TIMESTAMP = re.compile(r"[0-9]+")


class UnknownWebhookEvent(TypedDict):
    """An event of a type that this SDK version does not know. Handle it in a default branch.

    `type` is `unknown`, not the type that Pierre sent, so that a check of `type` narrows the
    union. No Pierre event has the type `unknown`, because each type has the form
    `<resource>.<subject>.<verb>`, or is `push`."""

    type: Literal["unknown"]
    # The event type that Pierre sent, for example a type from a newer API version.
    event_type: str
    # The parsed payload.
    body: Dict[str, Any]


HeaderValue = Union[str, Sequence[str], None]


def _header(headers: Mapping[str, HeaderValue], name: str) -> Optional[str]:
    """A header of a mapping such as `httpx.Headers` or a dict, with any case."""
    for key, value in headers.items():
        if key.lower() != name:
            continue
        if value is None or isinstance(value, str):
            return value
        return value[0] if len(value) > 0 else None
    return None


def _parse_signature(header: str) -> Tuple[str, List[bytes]]:
    """The timestamp and the signatures of `t=<unix seconds>,sha256=<hex>[,sha256=<hex>...]`."""
    timestamp: Optional[str] = None
    signatures: List[bytes] = []
    for element in header.split(","):
        name, _, value = element.strip().partition("=")
        if name == "t" and _TIMESTAMP.fullmatch(value):
            timestamp = value
        if name == "sha256" and _HEX_SIGNATURE.fullmatch(value):
            signatures.append(bytes.fromhex(value))
    if timestamp is None or len(signatures) == 0:
        raise WebhookVerificationError(
            "malformed_signature",
            "X-Pierre-Signature must have the form `t=<unix seconds>,sha256=<hex>`.",
        )
    return timestamp, signatures


def verify_webhook(
    *,
    payload: Union[str, bytes, bytearray, memoryview],
    headers: Mapping[str, HeaderValue],
    secret: str,
    tolerance_seconds: float = _DEFAULT_TOLERANCE_SECONDS,
) -> Union[KnownWebhookEvent, UnknownWebhookEvent]:
    """Checks the `X-Pierre-Signature` header of a delivery: an HMAC-SHA256 of `<t>.<payload>`
    with the secret, and a timestamp `t` within `tolerance_seconds` of now. Returns the event, a
    union on `type`. Raises `WebhookVerificationError` when the check fails.

    Args:
        payload: The raw request body, before a JSON parse changes its bytes.
        headers: The request headers: `httpx.Headers`, or a dict such as the headers of a web
            framework.
        secret: The secret of the webhook subscription.
        tolerance_seconds: The largest difference between the delivery time and now, in seconds.
            Default: 300.

    Docs: search for `verifyWebhook` in the docs MCP server, https://code.storage/docs/mcp.
    """
    if isinstance(tolerance_seconds, bool) or not tolerance_seconds >= 0:
        raise PierreError("`tolerance_seconds` must be 0 or more.")
    if secret == "":
        raise PierreError("`secret` must not be empty.")
    header = _header(headers, "x-pierre-signature")
    if header is None:
        raise WebhookVerificationError(
            "missing_signature", "The request has no X-Pierre-Signature header."
        )
    timestamp, signatures = _parse_signature(header)
    body_bytes = payload.encode("utf-8") if isinstance(payload, str) else bytes(payload)
    expected = hmac.new(
        secret.encode("utf-8"), timestamp.encode("ascii") + b"." + body_bytes, hashlib.sha256
    ).digest()
    # `compare_digest` compares in constant time.
    valid = False
    for signature in signatures:
        if hmac.compare_digest(signature, expected):
            valid = True
    if not valid:
        raise WebhookVerificationError(
            "signature_mismatch", "The signature does not match the payload and the secret."
        )
    age = int(time.time()) - int(timestamp)
    if abs(age) > tolerance_seconds:
        raise WebhookVerificationError(
            "timestamp_out_of_range",
            f"The delivery is {age} seconds old, and the tolerance is {tolerance_seconds:g} seconds.",
        )

    try:
        body = json.loads(body_bytes)
    except ValueError:
        raise WebhookVerificationError("invalid_payload", "The payload is not JSON.") from None
    if not isinstance(body, dict):
        raise WebhookVerificationError("invalid_payload", "The payload is not a JSON object.")
    # Older push deliveries have no `type`. The `X-Pierre-Event` header is not signed, so the SDK
    # uses it only to name such a push.
    body_type = body.get("type")
    event_type: Optional[str] = body_type if isinstance(body_type, str) else None
    if event_type is None and _header(headers, "x-pierre-event") == "push":
        event_type = "push"
    if event_type is None or event_type == "":
        raise WebhookVerificationError("invalid_payload", "The payload has no event type.")
    if event_type in _KNOWN_TYPES:
        # The type is a known event type, and the payload follows its schema.
        return cast(KnownWebhookEvent, {**body, "type": event_type})
    return {"type": "unknown", "event_type": event_type, "body": body}
