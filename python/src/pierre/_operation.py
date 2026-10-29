"""The facts of one operation, from the SDK model. The generated layer defines one spec for each
operation, and the runtime reads it to send the request."""

from dataclasses import dataclass
from typing import Generic, Literal, Optional, Tuple, TypeVar, Union

Headers = TypeVar("Headers")


@dataclass(frozen=True)
class ParameterSpec:
    """A path, query, or header parameter."""

    location: Literal["path", "query", "header"]
    # The wire name.
    name: str
    # The keyword argument.
    field: str


@dataclass(frozen=True)
class JsonBodySpec:
    """A JSON body: the runtime sends these arguments. When the body is optional and the call
    gives none of them, the runtime sends no body."""

    required: bool
    fields: Tuple[str, ...]


@dataclass(frozen=True)
class NdjsonBodySpec:
    """An NDJSON body: the first line is `{first: <these arguments>}`, and the argument `chunks`
    gives each later line when `rest` is true."""

    first: str
    fields: Tuple[str, ...]
    rest: bool


@dataclass(frozen=True)
class HeaderSpec:
    """A declared response header, by its wire name and its field."""

    name: str
    field: str


@dataclass(frozen=True)
class OperationSpec(Generic[Headers]):
    """One operation. `Headers` is the type of its declared response headers."""

    id: str
    method: Literal["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]
    path: str
    parameters: Tuple[ParameterSpec, ...]
    body: Union[JsonBodySpec, NdjsonBodySpec, None]
    response_encoding: Literal["json", "ndjson", "bytes", "none"]
    response_headers: Tuple[HeaderSpec, ...]
    # Whether a 304 response is a result, not an error.
    not_modified: bool
    scopes: Tuple[str, ...]
    # Whether the token needs a `repo` claim.
    repo_claim: bool
    # The response field that holds the items of a list, or `None` for another operation.
    item_field: Optional[str]
    idempotency_key: bool
