"""Types that the generated layer and the runtime share."""

from dataclasses import dataclass
from typing import Generic, List, Literal, Mapping, Sequence, TypeVar, Union

from pierre._compat import NotRequired, TypedDict


class NotGiven:
    """The default of each optional argument. The SDK does not send it, and sends `None` as
    `null`."""

    def __bool__(self) -> Literal[False]:
        return False

    def __repr__(self) -> str:
        return "NOT_GIVEN"


NOT_GIVEN = NotGiven()

RefPolicyOp = Union[Literal["no-push", "no-force-push", "verify-sig"], str]


class RefPolicy(TypedDict):
    """One ordered rule of the `refs` claim. The first rule whose pattern
    matches a ref applies."""

    # A full ref name (`refs/heads/main`), a branch name (`main`), a prefix that ends with `/*`
    # (`refs/heads/feature/*`), or `*` for every ref. The gateway rejects another form.
    pattern: str
    # The policy operations. The gateway rejects an op that it does not know.
    ops: NotRequired[Sequence[RefPolicyOp]]


class TokenRequest(TypedDict):
    """The token that a request needs. `get_token` receives it."""

    # The scopes of the operation.
    scopes: List[str]
    # The `repo` claim, for a repository-scoped operation.
    repo: NotRequired[str]
    # The lifetime of the token, in seconds.
    ttl: int
    # The rules of the `refs` claim. Absent when the call has none.
    ref_policies: NotRequired[List[RefPolicy]]


Headers = TypeVar("Headers")


class HeadersResult(TypedDict, Generic[Headers]):
    """The result of an operation whose response has no body. `headers` holds the declared
    response headers, and is empty when the document declares none."""

    status: int
    headers: Headers


class NoHeaders(TypedDict, total=False):
    """The declared response headers of an operation that declares none."""


@dataclass(frozen=True)
class RequestOptions:
    """The keyword arguments of one call."""

    extra_headers: Union[Mapping[str, str], NotGiven] = NOT_GIVEN
    timeout: Union[float, NotGiven] = NOT_GIVEN
    max_retries: Union[int, NotGiven] = NOT_GIVEN
    idempotency_key: Union[str, NotGiven] = NOT_GIVEN
    token_ttl: Union[int, NotGiven] = NOT_GIVEN
    ref_policies: Union[Sequence[RefPolicy], NotGiven] = NOT_GIVEN
